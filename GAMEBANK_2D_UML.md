# GameBank 2D — Pacote de UML

> Companion técnico do `GAMEBANK_2D_GDD.md`. Traduz o design em modelo de
> domínio, schema e fluxos. **O agente de implementação deve seguir
> exatamente estas estruturas** — não inventar entidades, campos ou fluxos
> alternativos sem antes confirmar com o time.
>
> Convenções seguidas (auditadas do schema atual): modelos em `PascalCase`,
> campos em `camelCase`, domínio de jogo em português (`Propriedade`,
> `saldo`), infraestrutura genérica em inglês (`User`, `Notification`).

---

## 0. Reaproveitamento — o que já existe e não deve ser recriado

Auditoria do schema atual encontrou dois reaproveitamentos importantes que
**eliminam trabalho** e mantêm o projeto consistente:

| Já existe (Modo Tabuleiro) | Reaproveitado por GameBank 2D como |
|---|---|
| `Session.tipoJogo` (enum `banca` \| `tabuleiro`) | Adicionar valor `mapa2d` |
| `Session.rodadaAtual` | **Mês atual** da partida (mesmo campo, sem criar novo) |
| `Session.eventoAtual` / `eventoProximo` / `eventoRodadasRestantes` | **Evento econômico do mês** — sistema idêntico já existe |
| `SessionPlayer.saldo`, `.desistiu`, `.motivoDesistencia`, `.patrimonyAtDesistir` | Reaproveitados diretamente, sem alteração |
| `Debt` (genérico: sessionId, playerId, valor, descricao, pago) | Reaproveitado para dívidas de impostos/manutenção não pagos |
| `Historico` (genérico, log por sessão) | Reaproveitado para o log de eventos do mês, mudanças de Reputação, execuções de garantia |
| Padrão `Propriedade` (estático) + `SessionPosses` (dinâmico por sessão) | **Espelhado** como `Terreno` (estático) + `SessionTerreno` (dinâmico) |
| Padrão de timer resiliente (varredura periódica + timestamp no banco, corrigido no BUG 6 do Modo Tabuleiro) | **Reaproveitado** para o fechamento de mês (ver Seção 4) |

**O que é genuinamente novo:** `Terreno`, `SessionTerreno`, `Construcao`,
`EmprestimoMapa`, e o campo `reputacao` em `SessionPlayer`.

---

## 1. Diagrama de Classes (Modelo de Domínio)

```mermaid
classDiagram
    class Session {
        +int id
        +TipoJogo tipoJogo
        +int rodadaAtual
        +string eventoAtual
        +string eventoProximo
        +int eventoRodadasRestantes
        +string status
    }

    class SessionPlayer {
        +int id
        +int sessionId
        +string nome
        +int saldo
        +float reputacao
        +boolean desistiu
        +string motivoDesistencia
        +int rodadasDevendo
        +calcularPatrimonio() int
        +calcularReputacaoEfetiva() float
    }

    class Terreno {
        +int id
        +string codigo
        +string regiaoNome
        +string categoria
        +float multiplicador
        +int slots
        +int precoBase
    }

    class SessionTerreno {
        +int id
        +int sessionId
        +int terrenoId
        +int donoId
        +DateTime adquiridoEm
        +int precoPago
    }

    class Construcao {
        +int id
        +int sessionTerrenoId
        +TipoConstrucao tipo
        +int nivel
        +int slotsOcupados
        +int aluguelPedido
        +int aluguelJustoUltimo
        +boolean ocupado
        +calcularManutencao() int
        +calcularAluguelJusto(contexto) int
    }

    class EmprestimoMapa {
        +int id
        +int sessionId
        +int playerId
        +int valorOriginal
        +int valorDevido
        +int garantiaSessionTerrenoId
        +boolean quitado
        +boolean executado
        +aplicarJurosMensal() void
    }

    class Debt {
        +int id
        +int sessionId
        +int playerId
        +int valor
        +string descricao
        +boolean pago
    }

    class Historico {
        +int id
        +int sessionId
        +string tipo
        +string detalhes
        +DateTime createdAt
    }

    Session "1" --> "N" SessionPlayer : possui
    Session "1" --> "N" SessionTerreno : contém
    Terreno "1" --> "N" SessionTerreno : instancia por sessão
    SessionPlayer "1" --> "N" SessionTerreno : é dono de
    SessionTerreno "1" --> "0..1" Construcao : tem
    SessionPlayer "1" --> "N" EmprestimoMapa : contrai
    EmprestimoMapa "1" --> "1" SessionTerreno : garantido por
    SessionPlayer "1" --> "N" Debt : deve
    Session "1" --> "N" Historico : registra
```

**Notas de design incorporadas nas entidades:**

- `SessionPlayer.reputacao` — novo campo, `Float @default(3.0)`, só usado
  quando `tipoJogo = mapa2d`
- `Terreno` é **estático**, populado uma vez no startup a partir de um JSON
  de referência (`server/data/mapa2d/terrenos.json`), no mesmo espírito de
  `propriedades.json` do Modo Tabuleiro
- `SessionTerreno` é o análogo direto de `SessionPosses` — dono, quando foi
  adquirido, e o preço efetivamente pago (pode variar por eventos)
- `Construcao.calcularAluguelJusto(contexto)` implementa a fórmula validada
  na Seção 5 do GDD (região × tipo × inflação × mercado × oferta/demanda)
- `EmprestimoMapa` é deliberadamente **separado** do `Emprestimo` já
  existente (Modo Tabuleiro) — a garantia referencia `SessionTerreno`, não
  `SessionPosses`; são domínios diferentes com FKs incompatíveis

---

## 2. Diagrama ER (Schema resumido)

```mermaid
erDiagram
    SESSION ||--o{ SESSION_PLAYER : "possui"
    SESSION ||--o{ SESSION_TERRENO : "contém"
    SESSION ||--o{ HISTORICO : "registra"
    TERRENO ||--o{ SESSION_TERRENO : "instancia"
    SESSION_PLAYER ||--o{ SESSION_TERRENO : "é dono"
    SESSION_TERRENO ||--o| CONSTRUCAO : "tem"
    SESSION_PLAYER ||--o{ EMPRESTIMO_MAPA : "contrai"
    SESSION_TERRENO ||--o| EMPRESTIMO_MAPA : "garante"
    SESSION_PLAYER ||--o{ DEBT : "deve"

    SESSION {
        int id PK
        enum tipoJogo
        int rodadaAtual "reaproveitado = mês atual"
        string eventoAtual "reaproveitado"
        string eventoProximo "reaproveitado"
    }
    SESSION_PLAYER {
        int id PK
        int sessionId FK
        int saldo "reaproveitado"
        float reputacao "NOVO, default 3.0"
        int rodadasDevendo "reaproveitado p/ falência"
    }
    TERRENO {
        int id PK
        string codigo UK
        string regiaoNome
        string categoria "comum|mediana|rica"
        float multiplicador
        int slots
        int precoBase
    }
    SESSION_TERRENO {
        int id PK
        int sessionId FK
        int terrenoId FK
        int donoId FK "nullable"
        int precoPago
        datetime adquiridoEm
    }
    CONSTRUCAO {
        int id PK
        int sessionTerrenoId FK
        enum tipo
        int nivel
        int aluguelPedido
        boolean ocupado
    }
    EMPRESTIMO_MAPA {
        int id PK
        int sessionId FK
        int playerId FK
        int valorDevido
        int garantiaSessionTerrenoId FK
        boolean quitado
        boolean executado
    }
    DEBT {
        int id PK
        int sessionId FK
        int playerId FK
        int valor
        boolean pago
    }
    HISTORICO {
        int id PK
        int sessionId FK
        string tipo
        string detalhes
    }
```

**Constraint crítica (requisito de segurança do GDD Seção 9):**

```
SESSION_TERRENO: @@unique([sessionId, terrenoId])
```

Isso é o que garante, no nível do banco, que um terreno não pode ter dois
donos ao mesmo tempo — combinado com a escrita atômica descrita na Seção 4.

---

## 3. Diagrama de Sequência — Compra de Terreno Concorrente

Implementa o requisito **não-negociável** do GDD (Seção 9): atomicidade via
`UPDATE ... WHERE`, nunca "verificar depois escrever" em dois passos.

```mermaid
sequenceDiagram
    actor J1 as Jogador A
    actor J2 as Jogador B
    participant API as API (mapa2d.controller)
    participant SVC as mapa2d.service
    participant DB as PostgreSQL

    par Requisições simultâneas
        J1->>API: POST /mapa2d/:sessionId/terreno/:id/comprar
        J2->>API: POST /mapa2d/:sessionId/terreno/:id/comprar
    end

    API->>SVC: comprarTerreno(sessionId, terrenoId, playerA)
    API->>SVC: comprarTerreno(sessionId, terrenoId, playerB)

    SVC->>DB: UPDATE session_terreno SET donoId=A WHERE terrenoId=X AND donoId IS NULL
    SVC->>DB: UPDATE session_terreno SET donoId=B WHERE terrenoId=X AND donoId IS NULL

    Note over DB: O banco serializa as duas escritas.<br/>Apenas UMA linha é afetada por UMA delas.

    DB-->>SVC: linhasAfetadas=1 (Jogador A)
    DB-->>SVC: linhasAfetadas=0 (Jogador B — já tinha dono)

    SVC-->>API: sucesso (A)
    SVC-->>API: erro 409 "Terreno já possui dono" (B)

    API-->>J1: 200 OK — terreno comprado
    API-->>J2: 409 Conflict — "Este terreno já foi comprado"

    SVC->>DB: INSERT Historico (compra confirmada)
    SVC->>DB: emitToRoom("terreno:comprado", {terrenoId, donoId: A})
```

**Ponto de implementação crítico:** a chamada ao banco **precisa** ser uma
única instrução condicional (`WHERE donoId IS NULL`), nunca:

```typescript
// ERRADO — TOCTOU, dois passos separados
const terreno = await db.sessionTerreno.findUnique(...);
if (!terreno.donoId) {
  await db.sessionTerreno.update({ donoId: playerId });  // ← janela de corrida aqui
}

// CERTO — atômico, um único passo
const resultado = await db.sessionTerreno.updateMany({
  where: { id: terrenoId, donoId: null },
  data: { donoId: playerId, precoPago, adquiridoEm: new Date() },
});
if (resultado.count === 0) throw new AppError(409, "Terreno já possui dono.");
```

Este mesmo padrão se aplica a **toda ação disputável**: subir de nível,
aceitar sublocação (fase 2), etc.

---

## 4. Diagrama de Sequência — Fechamento de Mês

```mermaid
sequenceDiagram
    participant TMR as timer.service (resiliente)
    participant SVC as mapa2d.service
    participant DB as PostgreSQL
    participant SOCK as socket.handler

    Note over TMR: Mesmo padrão do BUG 6 corrigido no Modo Tabuleiro:<br/>timestamp no banco + varredura periódica,<br/>NUNCA setTimeout solto em memória

    TMR->>SVC: fecharMes(sessionId)

    SVC->>DB: buscar todas Construcao da sessão (com SessionTerreno + dono)

    loop para cada Construcao ocupável
        SVC->>SVC: calcularAluguelJusto(regiao, tipo, inflacao, mercado, oferta_demanda)
        SVC->>SVC: avaliarOcupacao(aluguelPedido, justo, reputacaoDono)
        alt inquilino aceita
            SVC->>DB: creditar aluguelPedido ao dono
        else inquilino recusa
            SVC->>SVC: marcar Construcao.ocupado = false
        end
        SVC->>DB: debitar manutencao (mesmo se vago)
    end

    loop para cada SessionPlayer ativo
        SVC->>SVC: calcularImpostoProgressivo(patrimonioTotal)
        SVC->>DB: debitar IPTU (por SessionTerreno) + imposto progressivo
        SVC->>SVC: aplicarJurosMensal(EmprestimoMapa ativo, se houver)
        SVC->>SVC: atualizarReputacao(comportamento do mês)
        alt saldo insuficiente
            SVC->>DB: criar/atualizar Debt
            SVC->>SVC: incrementar rodadasDevendo
            alt rodadasDevendo >= 3
                SVC->>SVC: executarFalencia(player)
                Note over SVC: Executa garantia de EmprestimoMapa ANTES<br/>de zerar as propriedades (mesma ordem do Modo Tabuleiro)
            end
        else saldo suficiente
            SVC->>DB: zerar rodadasDevendo
        end
    end

    SVC->>SVC: processarViradaDeMes (evento: eventoProximo → eventoAtual, sorteia novo eventoProximo)
    SVC->>DB: criar Historico (resumo do mês, por jogador)
    SVC->>SOCK: emitToRoom("mes:fechado", {mesAtual, resumoPorJogador, eventoAtual})
    SVC->>TMR: reagendar fecharMes (próximo mês, +5min)
```

**Reaproveitamentos explícitos nesta sequência:**
- O ciclo de evento (`eventoProximo → eventoAtual`) é **idêntico** ao já
  implementado no Modo Tabuleiro — mesma função, mesmo padrão de anúncio
  antecipado
- A ordem "executar garantia antes de zerar propriedades" é a mesma lição
  do `MECANICA_EMPRESTIMOS.md` do Modo Tabuleiro
- O timer resiliente (varredura + timestamp) é o mesmo padrão do
  `FIX_TURNO_TRAVADO_CONTADOR.md` — **não reinventar**, adaptar

---

## 5. Diagrama de Estados — Ciclo de Vida do Jogador

```mermaid
stateDiagram-v2
    [*] --> Ativo: entra na partida (saldo R$1.000 + terreno grátis)

    Ativo --> Ativo: fecha o mês com saldo suficiente
    Ativo --> Devendo: saldo insuficiente ao fechar o mês (gera Debt)

    Devendo --> Ativo: quita a dívida (rodadasDevendo volta a 0)
    Devendo --> Devendo: 1º ou 2º mês consecutivo devendo (período de graça)
    Devendo --> Falido: 3º mês consecutivo devendo

    Ativo --> Desistiu: desiste voluntariamente
    Devendo --> Desistiu: desiste voluntariamente (se permitido)

    Falido --> [*]: propriedades voltam ao banco, garantia de<br/>empréstimo executada, sai da partida
    Desistiu --> [*]: sai da partida

    note right of Devendo
        Reputação já começa a cair
        neste estado (atraso conta
        negativamente, mesmo dentro
        do período de graça)
    end note

    note right of Falido
        Executar garantia de
        EmprestimoMapa ANTES
        de zerar SessionTerreno
    end note
```

---

## 6. Fluxograma — Decisão de Vitória ao Fim da Partida

```mermaid
flowchart TD
    A[Partida encerra:<br/>24 meses OU colapso populacional] --> B[Calcula patrimônio líquido<br/>de todos os jogadores ativos]
    B --> C[Ordena ranking por patrimônio]
    C --> D{Diferença entre<br/>1º e 2º é menor que<br/>o limiar percentual?}

    D -- Não --> E[Vence o 1º colocado<br/>por patrimônio]

    D -- Sim --> F{Algum dos dois tem<br/>Reputação >= 4.0?}

    F -- "Só um dos dois" --> G[Vence quem tem<br/>Reputação >= 4.0]
    F -- "Nenhum dos dois" --> E
    F -- "Ambos" --> H{Quem tem a MAIOR<br/>Reputação?}

    H --> I[Vence o de<br/>maior Reputação]

    E --> Z[Fim — declarar vencedor]
    G --> Z
    I --> Z
```

**Nota de implementação:** o "limiar percentual" (proposto ~12% do
patrimônio do líder, marcado `[A DEFINIR]` no GDD) deve ser uma **constante
configurável**, no mesmo espírito de `economia.ts` do Modo Tabuleiro —
nunca hardcoded inline na lógica de decisão.

---

## 7. Rotas da API (proposta inicial)

Seguindo o padrão do projeto (`Middleware → Controller → Service →
Repository`, rotas em `server/src/api/routes/`):

```
POST   /mapa2d/:sessionId/terreno/:terrenoId/comprar
POST   /mapa2d/:sessionId/terreno/:sessionTerrenoId/construir
POST   /mapa2d/:sessionId/construcao/:construcaoId/subir-nivel
POST   /mapa2d/:sessionId/construcao/:construcaoId/precificar   { aluguelPedido }
POST   /mapa2d/:sessionId/emprestimo/pegar                       { valor }
POST   /mapa2d/:sessionId/emprestimo/quitar
GET    /mapa2d/:sessionId/estado                                 (snapshot completo, para reconexão)
```

Cada rota disputável (comprar, subir-nível) segue o padrão de atomicidade da
Seção 3 deste documento.

---

## 8. Testes — onde vivem (não expostos por rota)

Seguindo exatamente o padrão já estabelecido no projeto (Jest + banco
isolado `gamebank_test`, **nunca** uma rota HTTP viva):

```
server/src/modules/mapa2d/
├── __tests__/
│   ├── terreno.service.test.ts       (unitário — compra, atomicidade)
│   ├── construcao.service.test.ts    (unitário — nível, aluguel justo)
│   ├── fechamento.service.test.ts    (integração — ciclo do mês completo)
│   └── reputacao.service.test.ts     (unitário — cálculo de reputação)
```

Rodar com `make test-ci` (já configurado), banco de teste já isolado — não é
necessário criar nenhuma rota `/testes` nova.

---

## Checklist de conformidade com o GDD

Antes de considerar a implementação "pronta", confirmar:

- [ ] `SessionTerreno` tem `@@unique([sessionId, terrenoId])` no schema
- [ ] Toda ação disputável usa `updateMany` com `WHERE` condicional, nunca
      "ler depois escrever" em dois passos
- [ ] `EmprestimoMapa` executa a garantia **antes** de zerar propriedades na
      falência
- [ ] O timer de fechamento de mês usa o padrão resiliente (timestamp +
      varredura), não `setTimeout` solto
- [ ] `Reputação` é calculada e persistida a cada fechamento de mês, com
      histórico rastreável (via `Historico`)
- [ ] Nenhuma rota `/testes` foi criada — testes vivem em `__tests__/` com
      banco isolado
- [ ] Constantes numéricas (limiar de vitória, coeficientes de reputação)
      ficam em arquivo de configuração dedicado, nunca hardcoded inline
