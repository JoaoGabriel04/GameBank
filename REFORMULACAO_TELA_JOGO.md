# Reformulação: Tela de Jogo e Centralização — GameBank

## Contexto

Depois das cinco mecânicas econômicas, o código acumulou dois God Objects e
a tela de jogo não comporta mais as informações que o jogo produz.

| Arquivo | Linhas | Responsabilidades acumuladas |
|---|---|---|
| `Inicio/index.tsx` | 1.757 | saldo, propriedades, transferência, aluguel, cartas, negociação, empréstimo, casas, dívidas |
| `turno.service.ts` | 1.536 | dados, movimento, casas, prisão, extrato, eventos, leilão, juros, timers |
| `page.tsx` | 946 | orquestra tudo |
| `Board/index.tsx` | 688 | tabuleiro, zoom, modais |

**A tese central:** a remodelação da UI e a centralização de código são a
**mesma tarefa**. Quebrar o `Inicio` em seções *é* a refatoração.

**Regra inviolável:** o Modo Banca não pode ser afetado em nenhuma fase.

---

## PROBLEMA CONFIRMADO — Regra duplicada

`calcularAluguel` existe em dois lugares com implementações independentes:
- `server/src/modules/turno/turno.service.ts` (linha ~789)
- `client/src/stores/gameStore.ts` (`getAluguel` / `getAluguelBase`)

Se uma mudar e a outra não, **o jogador vê um valor e paga outro**. O mesmo
risco existe em `calcularPatrimonio` (repetido em falência, desistência e
leilão) e nos modificadores de evento.

Resolver isso é a Fase 1.

---

## FASES

| Fase | O que faz | Risco | Depende de |
|---|---|---|---|
| 1 | Núcleo compartilhado (regras de dinheiro num lugar só) | 🟡 Médio | — |
| 2 | Backend: `turno.service` → orquestrador + serviços | 🟡 Médio | Fase 1 |
| 3 | Frontend: novo layout da tela de jogo | 🟡 Médio | — |
| 4 | Frontend: `Inicio` → seções (Visão / Imóveis / Banco) | 🔴 Alto | Fase 3 |
| 5 | Chat como aba própria (com anti-flood) | 🟢 Baixo | Fase 3 |
| 6 | Histórico das últimas 5 jogadas | 🟢 Baixo | Fase 3 |

Implemente **uma fase por vez**, validando entre cada uma.

---

# FASE 1 — Núcleo compartilhado de regras

## Objetivo
Regras de dinheiro vivem em **um só lugar**. Backend e frontend consomem a
mesma fonte. Elimina o risco de divergência.

## Etapa 0 — Auditoria

```bash
# Ver as duas implementações de aluguel
sed -n '789,801p' server/src/modules/turno/turno.service.ts
grep -n -A12 "getAluguelBase:" client/src/stores/gameStore.ts

# Ver patrimônio duplicado (falência, desistência, leilão)
grep -rn "patrimony\|calcularPatrimonio" server/src --include="*.ts" | grep -v node_modules

# Ver modificadores de evento
grep -n "getModificadores" server/src/modules/turno/turno.service.ts
```

## Etapa 1 — Criar o core

O projeto não tem pasta compartilhada entre client e server. Duas opções:

**Opção A (recomendada — menor atrito):** duplicação controlada.
Criar `server/src/shared/economia-core.ts` e um espelho
`client/src/shared/economia-core.ts` com **conteúdo idêntico**, e um teste
que garante que não divergem.

**Opção B:** workspace compartilhado (`packages/shared`). Mais correto, mas
exige mexer no build, no Docker e no tsconfig. **Não recomendo agora** —
alto risco para o ganho.

Seguir a **Opção A**.

```typescript
// server/src/shared/economia-core.ts
// ESPELHADO em client/src/shared/economia-core.ts — manter idênticos.

export type PropriedadeAluguel = {
  aluguel_base: number; aluguel_1c: number; aluguel_2c: number;
  aluguel_3c: number; aluguel_4c: number; aluguel_hotel: number;
};

/** Aluguel de uma propriedade conforme o número de casas. Fonte única. */
export function calcularAluguel(prop: PropriedadeAluguel, casas: number): number {
  switch (casas) {
    case 0: return prop.aluguel_base ?? 0;
    case 1: return prop.aluguel_1c ?? prop.aluguel_base ?? 0;
    case 2: return prop.aluguel_2c ?? prop.aluguel_1c ?? prop.aluguel_base ?? 0;
    case 3: return prop.aluguel_3c ?? prop.aluguel_2c ?? prop.aluguel_base ?? 0;
    case 4: return prop.aluguel_4c ?? prop.aluguel_3c ?? prop.aluguel_base ?? 0;
    default: return prop.aluguel_hotel ?? prop.aluguel_4c ?? prop.aluguel_base ?? 0;
  }
}

export type PosseParaPatrimonio = {
  casas: number;
  propriedade: { custo_compra: number; custo_casa: number } | null;
};

/** Patrimônio = saldo + valor das propriedades + casas. Fonte única. */
export function calcularPatrimonio(saldo: number, posses: PosseParaPatrimonio[]): number {
  let total = saldo;
  for (const p of posses) {
    if (!p.propriedade) continue;
    total += p.propriedade.custo_compra;
    total += (p.casas ?? 0) * p.propriedade.custo_casa;
  }
  return total;
}

/** Aplica um multiplicador e arredonda. Fonte única para eventos. */
export function aplicarMod(valor: number, mult?: number): number {
  return Math.round(valor * (mult ?? 1));
}
```

## Etapa 2 — Substituir os usos

- `turno.service.ts`: remover o `calcularAluguel` privado, importar do core
- `gameStore.ts`: remover `getAluguelBase`, importar do core
- Falência, desistência e leilão: usar `calcularPatrimonio` do core
- Modificadores de evento: usar `aplicarMod`

**Não mudar comportamento.** É refatoração pura — os valores calculados
devem ser exatamente os mesmos de antes.

## Etapa 3 — Teste anti-divergência

```typescript
// server/src/shared/__tests__/espelho.test.ts
// Garante que os dois arquivos não divergiram.
import { readFileSync } from "node:fs";

test("economia-core do client e do server são idênticos", () => {
  const server = readFileSync("server/src/shared/economia-core.ts", "utf8");
  const client = readFileSync("client/src/shared/economia-core.ts", "utf8");
  expect(server).toBe(client);
});
```

## Testes
- [ ] Aluguel cobrado é idêntico ao de antes (testar com 0-5 casas)
- [ ] Aluguel exibido na UI bate com o cobrado
- [ ] Patrimônio no ranking/falência/leilão idêntico ao anterior
- [ ] Eventos econômicos aplicam os mesmos multiplicadores
- [ ] Teste de espelho passa
- [ ] `make validate` passa

---

# FASE 2 — Backend: orquestrador + serviços

## Objetivo
`turno.service.ts` (1.536 linhas) vira um **orquestrador que não calcula
nada** — só chama serviços na ordem certa.

## Divisão proposta

```
server/src/modules/turno/
├── turno.service.ts          ← orquestrador (~250 linhas)
├── turno.repository.ts       (mantém)
├── turno.controller.ts       (mantém)
└── services/
    ├── dados.service.ts       rolar, duplos, opções de movimento
    ├── movimento.service.ts   mover, passar pelo início, escolha
    ├── casa-resolver.service.ts  resolver cada tipo de casa
    ├── economia.service.ts    extrato, IPTU, manutenção, renda, juros
    ├── rodada.service.ts      contador de rodada, eventos econômicos
    └── timer.service.ts       timeouts, varreduras, recuperação
```

**O que sai do turno.service e para onde:**

| Método atual | Vai para |
|---|---|
| `rolarDados`, `calcularOpcoesMovimento` | `dados.service` |
| `escolherMovimento`, `moverEResolver` | `movimento.service` |
| `resolverCasa`, `rolarDadosEmPrisao` | `casa-resolver.service` |
| `calcularExtratoInicio`, `aplicarJurosEmprestimo`, `cobrarComFallbackDivida` | `economia.service` |
| `processarViradaDeRodada`, `getModificadores` | `rodada.service` |
| `agendarTimeout`, `avancarPorTimeout`, `varrerTurnosExpirados`, `garantirTimerAtivo`, `recoverStuckSessions` | `timer.service` |
| `iniciarLeilao`, `darLance`, `encerrarLeilaoInterno`, `varrerLeiloesExpirados` | **mover para `modules/leilao/`** (já existe!) |
| `calcularAluguel`, `calcularPatrimonio` | **`shared/economia-core.ts`** (Fase 1) |

**O que FICA no turno.service (orquestrador):**
`iniciarTurnos`, `passarVez`, `avancarTurno`, `verificarFalencia`,
`validarESessaoAtiva` — e a coordenação das chamadas.

## Cuidados críticos

### Locks — não aninhar
Os serviços extraídos **não devem chamar `withLock`**. O lock fica no
orquestrador. Se um serviço precisar de lock, ele recebe o contexto já
travado.

```typescript
// turno.service.ts (orquestrador)
async rolarDados(sessionId: number, playerId: number) {
  return withLock(`turno:${sessionId}`, async () => {
    const session = await this.validarESessaoAtiva(sessionId);
    // ... validações ...

    // Serviços NÃO travam — recebem o contexto
    const resultado = await dadosService.rolar(sessionId, player, session);
    // ...
  });
}
```

### Timers em memória
`turnoTimers` e `duplosConsecutivos` são `Map` no escopo do módulo. Ao
mover para `timer.service`, **manter a mesma instância** — não criar dois
Maps. Exportar do `timer.service` e importar onde precisar.

### Imports circulares
`economia.service` precisa de `rodada.service` (modificadores), e
`casa-resolver` precisa de `economia.service`. Cuidado com ciclos.
**Solução:** os serviços recebem os modificadores como **parâmetro**, não
os buscam. O orquestrador busca uma vez e repassa.

## Testes
- [ ] Fluxo completo de turno funciona idêntico
- [ ] Rolar, escolher movimento, resolver casa, passar vez
- [ ] Leilão funciona (agora no módulo próprio)
- [ ] Timers e varreduras funcionam (vez não trava)
- [ ] Extrato do Início, eventos, juros — todos iguais
- [ ] Nenhum deadlock (locks não aninhados)
- [ ] `make validate` passa

---

# FASE 3 — Novo layout da tela de jogo

## Objetivo
Reorganizar a tela para comportar as informações que o jogo produz.

## Layout mobile (prioritário — é onde os jogadores estão)

```
┌─────────────────────────┐
│ GameBank    [Finalizar] │  header
├─────────────────────────┤
│                         │
│      TABULEIRO          │  ~45% da altura
│   zoom/pan  [⊕] [⛶]    │  âncora + maximizar
│                         │
├─────────────────────────┤
│ Crise imobiliária −50%  │  faixa do evento (cor muda)
│                rodada 7 │
├─────────────────────────┤
│  Ana  │ SUA VEZ 43s │ Léo │  timeline de turno
├─────────────────────────┤
│    [ Rolar dados ]      │  ação principal
├─────────────────────────┤
│  Saldo      Patrimônio  │  stats
│  R$ 12.400  R$ 31.900   │
├─────────────────────────┤
│  Últimas jogadas        │  histórico curto
│  • Você caiu em X  −750 │
│  • Ana passou início +1.2k│
├─────────────────────────┤
│ Visão Imóveis Banco Chat Ranking │  bottom nav
└─────────────────────────┘
```

**Ordem = hierarquia de atenção:** onde estou → contexto → de quem é a vez
→ o que faço → meu estado → o que aconteceu.

## Layout desktop

Tabuleiro em ~1/4 (canto superior esquerdo), painéis à direita ocupando o
resto. Mesmas seções, dispostas lado a lado em vez de empilhadas.

## Componentes novos

```
client/src/components/Game/
├── GameShell/index.tsx        orquestrador do layout + nav
├── BoardPanel/index.tsx       tabuleiro compacto (45% mobile / 25% desktop)
├── BoardModal/index.tsx       tabuleiro maximizado (SÓ VISUALIZAÇÃO)
├── EventoBanner/index.tsx     faixa do evento econômico
├── TurnoTimeline/index.tsx    anterior | atual | próximo
├── AcaoPrincipal/index.tsx    botão contextual (rolar / escolher / aguardar)
└── StatsRapidas/index.tsx     saldo + patrimônio
```

## BoardModal — regras

**O tabuleiro maximizado é SÓ PARA VISUALIZAR.** Não tem ações dentro.

Motivo: se o jogador pudesse rolar dados lá, seria preciso duplicar o modal
de resultado, o de compra e o de escolha de movimento dentro do overlay.
Manutenção dobrada e superfície de bug maior.

- Abre como modal com overlay escuro
- Zoom/pan livre, âncora para centralizar no próprio peão
- Botão de fechar bem visível
- **Sem botões de ação** — o jogador fecha e age na tela principal
- Se for a vez dele e o modal estiver aberto, mostrar um aviso discreto:
  "É a sua vez — feche para jogar"

## EventoBanner — regras

- Cor segue o tipo do evento (vermelho = ruim, verde = bom)
- Sempre visível quando há evento ativo ou anunciado
- Evento **anunciado** (próxima rodada) tem visual distinto do **ativo**
- Clicável → abre o modal com a descrição completa e a dica de reação

## TurnoTimeline — regras

- Mostra apenas o vizinho imediato de cada lado (anterior / próximo)
- Com 6 jogadores, mostrar todos vira poluição
- Destaque forte em quem está jogando agora
- Countdown visível quando é a vez do jogador local

## Testes
- [ ] Tabuleiro ocupa ~45% da altura no mobile
- [ ] Zoom/pan funcionam no tabuleiro compacto
- [ ] Âncora centraliza no próprio peão
- [ ] Maximizar abre o modal em tela cheia
- [ ] Modal do tabuleiro NÃO tem ações
- [ ] Faixa de evento aparece com a cor certa
- [ ] Timeline mostra anterior/atual/próximo corretamente
- [ ] Ação principal muda conforme o estado (rolar / escolher / aguardar)
- [ ] Desktop usa o layout de painéis
- [ ] Modo Banca não é afetado
- [ ] `make validate` passa

---

# FASE 4 — Quebrar o `Inicio` em seções

## Objetivo
`Inicio/index.tsx` (1.757 linhas, ~20 `useState`, 56 refs a modal) vira
três seções coesas.

**RISCO ALTO.** É o arquivo mais complexo do frontend. Faça com cuidado.

## Divisão

```
client/src/components/Game/sections/
├── VisaoSection/index.tsx      stats, últimas jogadas, evento, projeção
├── ImoveisSection/
│   ├── index.tsx               lista de propriedades por grupo
│   ├── ConstruirModal/         comprar casas
│   ├── VenderModal/            vender casas
│   ├── HipotecaModal/          hipotecar / deshipotecar
│   └── NegociarModal/          propor negociação
├── BancoSection/
│   ├── index.tsx               transferir, dívidas
│   ├── TransferirModal/
│   ├── EmprestimoModal/        pegar (com projeção de juros)
│   └── QuitarModal/            quitar empréstimo
└── RankingSection/index.tsx    patrimônio + histórico completo
```

## Onde cada coisa vai

| Hoje no `Inicio` | Vai para |
|---|---|
| Saldo, patrimônio, projeção do Início | `VisaoSection` |
| Lista de propriedades, grupos, construir, vender, hipotecar | `ImoveisSection` |
| Transferir, empréstimo, dívidas | `BancoSection` |
| Negociação | `ImoveisSection` (contexto natural: você troca imóveis) |
| Cartas especiais | `VisaoSection` (é estado do jogador) |
| Ranking e histórico | `RankingSection` (fundir as duas abas atuais) |

## Regra de ouro

**Cada seção busca só o que precisa.** Hoje o `Inicio` puxa o estado inteiro
da sessão e deriva tudo com 12 `useMemo`. As seções devem consumir seletores
específicos do Zustand:

```typescript
// RUIM (padrão atual — re-renderiza tudo a qualquer mudança)
const session = useGameStore(s => s.currentSession)

// BOM (só re-renderiza quando o saldo muda)
const saldo = useGameStore(s => s.currentSession?.meuPlayer?.saldo)
```

Isso reduz re-renders e é o que torna a UI fluida no celular.

## Testes
- [ ] Todas as funções continuam funcionando (transferir, construir, vender,
      hipotecar, negociar, empréstimo, quitar, sortear carta)
- [ ] Nenhuma função foi perdida na migração
- [ ] Bug das ações (não construir casa em ação) continua corrigido
- [ ] Projeção do Início aparece na Visão
- [ ] Re-renders reduzidos (verificar no React DevTools Profiler)
- [ ] `make validate` passa

---

# FASE 5 — Chat como aba própria

## Objetivo
Tirar a bolinha flutuante. Chat vira aba, com proteções contra flood.

## Regras

```typescript
// client/src/constants/chat.ts
export const CHAT_MAX_CARACTERES = 200;
export const CHAT_MAX_LINHAS = 3;
export const CHAT_COOLDOWN_MS = 2000;        // 1 msg a cada 2s
export const CHAT_BURST_MAX = 5;             // máx 5 msgs
export const CHAT_BURST_JANELA_MS = 10_000;  // em 10s
```

## Frontend
- Contador de caracteres visível (200 máximo)
- Shift+Enter quebra linha; máximo 3 linhas
- Botão de enviar desabilitado durante o cooldown
- Badge de não-lidas no ícone da aba
- Auto-scroll para a última mensagem

## Backend (obrigatório — não confiar no cliente)
Aplicar rate limit no evento de chat do Socket.IO:

```typescript
// Reutilizar o socketRateLimit já existente no projeto
socket.on("chat:mensagem", async (data) => {
  const permitido = await socketRateLimit(socket, {
    evento: "chat",
    limite: CHAT_BURST_MAX,
    janela: CHAT_BURST_JANELA_MS / 1000,
    mensagem: "Aguarde antes de enviar mais mensagens.",
  });
  if (!permitido) return;

  // Validar tamanho no servidor também
  if (data.texto.length > CHAT_MAX_CARACTERES) {
    return socket.emit("erro", "Mensagem muito longa.");
  }

  // ...lógica existente...
});
```

## Testes
- [ ] Chat é uma aba (bolinha flutuante removida)
- [ ] Máximo 200 caracteres, com contador
- [ ] Quebra de linha funciona (máx 3 linhas)
- [ ] Cooldown de 2s entre mensagens
- [ ] Burst de 5 mensagens em 10s é bloqueado
- [ ] Rate limit aplicado no BACKEND (não só na UI)
- [ ] Badge de não-lidas funciona
- [ ] `make validate` passa

---

# FASE 6 — Histórico das últimas 5 jogadas

## Objetivo
O jogador vê o que aconteceu recentemente, sem inchar o banco.

## Regra
Manter **apenas as 5 últimas jogadas** por sessão. Ao inserir a 6ª, a mais
antiga é removida.

## Implementação

**Não criar tabela nova.** O `Historico` já existe e registra tudo. A "últimas
5 jogadas" é uma **consulta**, não um armazenamento separado:

```typescript
// Buscar as 5 últimas entradas relevantes de jogada
async getUltimasJogadas(sessionId: number, limite = 5) {
  return prisma.historico.findMany({
    where: {
      sessionId,
      tipo: { in: [
        "PAGAMENTO_ALUGUEL", "COMPRA_PROPRIEDADE", "PASSAGEM_INICIO",
        "SORTE_REVES", "IMPOSTO", "RESTITUICAO", "PRISAO", "LEILAO",
      ]},
    },
    orderBy: { id: "desc" },
    take: limite,
  });
}
```

**Sobre "não lotar o banco":** o `Historico` completo tem valor (a aba
Histórico o usa, e é auditoria da partida). Não apagar registros antigos.

Se o volume for preocupante, a limpeza correta é **por sessão encerrada**,
não por contagem:

```typescript
// Job periódico: limpar histórico de sessões finalizadas há mais de 30 dias
await prisma.historico.deleteMany({
  where: {
    session: {
      status: "Finalizada",
      finalizadaEm: { lt: subDays(new Date(), 30) },
    },
  },
});
```

Isso mantém o banco enxuto sem perder o histórico de partidas em andamento.

## UI
- Card "Últimas jogadas" na `VisaoSection`
- Cada linha: quem, o quê, e o **valor** (+1.262 / −750)
- Sem o valor, o histórico é decorativo. Com ele, o jogador lê a economia
  da partida.

## Testes
- [ ] Mostra as 5 últimas jogadas
- [ ] Valores aparecem com sinal e cor (verde/vermelho)
- [ ] Atualiza em tempo real via socket
- [ ] Aba Histórico continua mostrando o histórico completo
- [ ] `make validate` passa

---

## CHECKLIST FINAL

### Não quebrou nada
- [ ] Modo Banca 100% funcional
- [ ] Todas as cinco mecânicas econômicas funcionando
- [ ] Compra, venda, hipoteca, negociação, transferência
- [ ] Prisão, feriado, falência, desistência
- [ ] Leilão, empréstimo, eventos, extrato do Início
- [ ] Loja, cofre, ranking, missões intactos

### Ganhos verificáveis
- [ ] `calcularAluguel` existe em UM lugar (não dois)
- [ ] `turno.service.ts` abaixo de 400 linhas
- [ ] `Inicio/index.tsx` não existe mais (virou seções)
- [ ] Nenhum componente acima de 500 linhas
- [ ] Re-renders reduzidos no mobile

### Qualidade
- [ ] Sem locks aninhados (nenhum deadlock)
- [ ] Sem imports circulares
- [ ] `make validate` passa
