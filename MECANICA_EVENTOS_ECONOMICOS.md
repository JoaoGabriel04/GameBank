# Implementação: Eventos Econômicos — GameBank

## Contexto

Segunda das cinco mecânicas econômicas (ver MECANICAS_ECONOMICAS.md).
A cada **2 rodadas completas**, um evento econômico afeta **toda a rodada
seguinte** — mexendo em aluguéis, IPTU, manutenção, custo de construção e
renda passiva.

O evento é **anunciado com 1 rodada de antecedência** e é **público** — todos
sabem ao mesmo tempo. O que diferencia os jogadores é a **capacidade de
reagir** (ter liquidez, estar bem posicionado), não informação privilegiada.

**PRÉ-REQUISITO:** a Mecânica 1 (Manutenção + IPTU + Renda Passiva) deve
estar implementada. Vários eventos dependem dela.

**IMPORTANTE — exclusivo do Modo Tabuleiro.** O Modo Banca não é afetado.

---

## DESCOBERTA DA AUDITORIA — Não existe conceito de "rodada"

O código atual tem `rodadasDevendo` (contador individual de falência) e
`turnosPrisao`, mas **a sessão não conta rodadas globais**. O `avancarTurno`
cicla a `ordemTurnos` com módulo, sem detectar quando a volta se completa.

**Isso precisa ser criado.** É a base de toda a mecânica.

---

## ETAPA 0 — Auditoria obrigatória

```bash
# 1. Confirmar que não há contador de rodadas na sessão
grep -n "rodadaAtual\|rodada\|voltaCompleta" server/prisma/schema.prisma

# 2. Ver o avancarTurno (onde a rodada será detectada)
grep -n "avancarTurno\|ordemTurnos\|parseOrdem" server/src/modules/turno/turno.service.ts

# 3. Pontos onde o ALUGUEL é calculado (backend E frontend)
grep -rn "calcularAluguel" server/src/modules/turno/turno.service.ts
grep -rn "getAluguel" client/src/stores/gameStore.ts

# 4. Pontos onde CUSTO DE CASA é usado (construção/venda)
grep -n "custo_casa" server/src/modules/propriedade/propriedade.service.ts

# 5. Confirmar que a Mecânica 1 (IPTU/manutenção) já existe
ls server/src/constants/economia.ts && cat server/src/constants/economia.ts
```

**Se `economia.ts` não existir, PARE.** Implemente a Mecânica 1 primeiro.

---

## ETAPA 1 — Contador de rodadas (base da mecânica)

### Schema

```prisma
model Session {
  // ...campos existentes...
  rodadaAtual     Int     @default(1)   // rodada em curso
  eventoAtual     String?               // evento ativo NESTA rodada (código)
  eventoProximo   String?               // evento anunciado para a PRÓXIMA rodada
}
```

### Detectar rodada completa no `avancarTurno`

Uma rodada completa quando o turno **volta ao primeiro jogador ativo da
ordem**. Modificar `avancarTurno`:

```typescript
private async avancarTurno(sessionId, session, porTimeout = false) {
  const ordem = parseOrdem(session.ordemTurnos);
  // ...lógica existente de encontrar o próximo...

  if (!proximo) { /* ...existente... */ }

  // ── NOVO: detectar rodada completa ────────────────────────────────
  // A rodada vira quando o próximo jogador é o PRIMEIRO ativo da ordem
  const jogadoresAtivos = ordem
    .map(id => jogadoresPorId.get(id))
    .filter(j => j && !j.desistiu);
  const primeiroAtivoId = jogadoresAtivos[0]?.id;

  const rodadaVirou = proximo.id === primeiroAtivoId
    && session.turnoAtualPlayerId !== primeiroAtivoId;  // evita contar no início

  let novaRodada = session.rodadaAtual;
  if (rodadaVirou) {
    novaRodada = session.rodadaAtual + 1;
    await this.processarViradaDeRodada(sessionId, novaRodada, session);
  }

  await turnoRepository.updateTurno(sessionId, {
    turnoAtualPlayerId: proximo.id,
    turnoIniciadoEm: new Date(),
    ...(rodadaVirou ? { rodadaAtual: novaRodada } : {}),
  });

  // ...resto existente (agendarTimeout, emit)...
}
```

**ATENÇÃO:** o `pularProximaRodada` (feriado) já pula jogadores no loop. Um
jogador pulado **não impede** a rodada de virar — a contagem é pela ordem,
não por quem efetivamente jogou.

---

## ETAPA 2 — Catálogo de eventos

Criar `server/src/constants/eventos.ts`:

```typescript
export type EventoEfeito = {
  /** Multiplicador aplicado ao aluguel cobrado nesta rodada. */
  aluguelMult?: number;
  /** Multiplicador aplicado ao IPTU na passagem pelo Início. */
  iptuMult?: number;
  /** Multiplicador aplicado à manutenção na passagem pelo Início. */
  manutencaoMult?: number;
  /** Multiplicador aplicado à renda passiva na passagem pelo Início. */
  rendaPassivaMult?: number;
  /** Multiplicador aplicado ao custo de construir casas. */
  custoConstrucaoMult?: number;
  /** Multiplicador aplicado ao rendimento das ações (grupo Preto). */
  acoesMult?: number;
  /** Crédito imediato a todos os jogadores ao iniciar a rodada. */
  creditoImediato?: number;
};

export type EventoDef = {
  codigo: string;
  nome: string;
  descricao: string;      // o que acontece
  dica: string;           // como reagir (mostrar no aviso)
  icone: string;          // emoji ou nome de ícone
  cor: "verde" | "vermelho" | "amarelo" | "azul";  // tom do evento
  efeito: EventoEfeito;
};

export const EVENTOS: EventoDef[] = [
  {
    codigo: "CRISE_IMOBILIARIA",
    nome: "Crise Imobiliária",
    descricao: "Os aluguéis despencam. Ninguém quer alugar.",
    dica: "Aluguéis caem 50%. Se você vive de aluguel, aperte o cinto.",
    icone: "📉", cor: "vermelho",
    efeito: { aluguelMult: 0.5 },
  },
  {
    codigo: "BOOM_IMOBILIARIO",
    nome: "Boom Imobiliário",
    descricao: "O mercado está aquecido. Todos querem alugar.",
    dica: "Aluguéis sobem 50%. Bom momento para ter propriedades desenvolvidas.",
    icone: "📈", cor: "verde",
    efeito: { aluguelMult: 1.5 },
  },
  {
    codigo: "IPTU_EXTRAORDINARIO",
    nome: "IPTU Extraordinário",
    descricao: "A prefeitura dobrou o imposto sobre imóveis.",
    dica: "IPTU dobra nesta rodada. Hipotecar o que não usa pode salvar seu caixa.",
    icone: "🏛️", cor: "vermelho",
    efeito: { iptuMult: 2 },
  },
  {
    codigo: "ISENCAO_FISCAL",
    nome: "Isenção Fiscal",
    descricao: "O governo isentou o IPTU nesta rodada.",
    dica: "IPTU zerado. Momento ideal para segurar patrimônio.",
    icone: "🎁", cor: "verde",
    efeito: { iptuMult: 0 },
  },
  {
    codigo: "ESCASSEZ_MATERIAL",
    nome: "Escassez de Material",
    descricao: "Faltam materiais. Construir ficou caro.",
    dica: "Construção custa +50%. Se ia construir, talvez espere.",
    icone: "🚧", cor: "vermelho",
    efeito: { custoConstrucaoMult: 1.5 },
  },
  {
    codigo: "AQUECIMENTO_MERCADO",
    nome: "Aquecimento do Mercado",
    descricao: "Materiais em promoção. Construir ficou barato.",
    dica: "Construção custa -30%. Ótima hora para desenvolver.",
    icone: "🔨", cor: "verde",
    efeito: { custoConstrucaoMult: 0.7 },
  },
  {
    codigo: "INFLACAO",
    nome: "Inflação",
    descricao: "Os custos de manter imóveis dispararam.",
    dica: "Manutenção +50%. Muitas casas podem virar prejuízo.",
    icone: "💸", cor: "vermelho",
    efeito: { manutencaoMult: 1.5 },
  },
  {
    codigo: "RECESSAO",
    nome: "Recessão",
    descricao: "A economia parou. Nenhuma renda passiva nesta rodada.",
    dica: "Renda passiva zerada. Ter caixa é essencial.",
    icone: "🏚️", cor: "vermelho",
    efeito: { rendaPassivaMult: 0 },
  },
  {
    codigo: "DIVIDENDOS",
    nome: "Dividendos Extraordinários",
    descricao: "As empresas distribuíram lucros excepcionais.",
    dica: "Ações rendem o dobro. Quem investiu em ações se dá bem.",
    icone: "💹", cor: "verde",
    efeito: { acoesMult: 2 },
  },
  {
    codigo: "INJECAO_LIQUIDEZ",
    nome: "Injeção de Liquidez",
    descricao: "O banco central injetou dinheiro na economia.",
    dica: "Todos recebem R$ 1.000 imediatamente.",
    icone: "💰", cor: "verde",
    efeito: { creditoImediato: 1000 },
  },
];

export const EVENTO_INTERVALO_RODADAS = 2;

export function getEvento(codigo: string | null | undefined): EventoDef | null {
  if (!codigo) return null;
  return EVENTOS.find(e => e.codigo === codigo) ?? null;
}

/** Sorteia um evento diferente do atual (evita repetir em sequência). */
export function sortearEvento(excluir?: string | null): EventoDef {
  const pool = EVENTOS.filter(e => e.codigo !== excluir);
  return pool[Math.floor(Math.random() * pool.length)];
}
```

**Balanceamento:** 5 eventos positivos, 5 negativos. Sorteio aleatório
uniforme, sem repetir o anterior.

---

## ETAPA 3 — Ciclo de vida do evento

### Fluxo temporal

```
Rodada 1:  (sem evento)         → ao virar: anuncia evento para R2
Rodada 2:  eventoAtual = X      → efeitos de X ativos
           (jogadores reagem)
           ao virar: anuncia evento para R4? NÃO — intervalo é 2
Rodada 3:  (sem evento)         → ao virar: anuncia evento para R4
Rodada 4:  eventoAtual = Y      → efeitos de Y ativos
...
```

**Regra:** evento ativo nas rodadas **pares**; anúncio acontece ao virar
para a rodada **ímpar** anterior.

### Processar virada de rodada

```typescript
private async processarViradaDeRodada(
  sessionId: number,
  novaRodada: number,
  session: { eventoProximo?: string | null; eventoAtual?: string | null }
) {
  // 1. O evento anunciado vira o evento ATIVO desta rodada
  const eventoAtivo = session.eventoProximo ?? null;

  // 2. Sortear o PRÓXIMO evento, se a próxima rodada for de evento
  //    (evento nas rodadas pares → anuncia quando a próxima rodada é par)
  const proximaRodadaTemEvento = (novaRodada + 1) % EVENTO_INTERVALO_RODADAS === 0;
  const eventoProximo = proximaRodadaTemEvento
    ? sortearEvento(eventoAtivo).codigo
    : null;

  await turnoRepository.updateTurno(sessionId, {
    eventoAtual: eventoAtivo,
    eventoProximo,
  });

  // 3. Aplicar efeito imediato (se houver — ex: Injeção de Liquidez)
  const def = getEvento(eventoAtivo);
  if (def?.efeito.creditoImediato) {
    await this.aplicarCreditoImediato(sessionId, def.efeito.creditoImediato);
  }

  // 4. Registrar no histórico
  if (eventoAtivo) {
    await turnoRepository.criarHistorico({
      sessionId,
      tipo: "EVENTO_ECONOMICO",
      detalhes: `Rodada ${novaRodada}: ${def?.nome} — ${def?.descricao}`,
    });
  }

  // 5. Notificar todos (ver Etapa 5)
  emitToRoom(sessionId, "evento:mudou", {
    rodada: novaRodada,
    eventoAtual: eventoAtivo,
    eventoProximo,
  });
}
```

---

## ETAPA 4 — Aplicar os modificadores (pontos exatos)

Os modificadores afetam **a rodada inteira**. Criar um helper central:

```typescript
// server/src/modules/turno/turno.service.ts

/** Busca os multiplicadores do evento ativo da sessão. */
private async getModificadores(sessionId: number): Promise<EventoEfeito> {
  const session = await turnoRepository.findSessionComTurno(sessionId);
  const def = getEvento(session?.eventoAtual);
  return def?.efeito ?? {};
}
```

### 4.1 — Aluguel (backend)

Em `resolverCasa`, onde o aluguel é cobrado (~linha 309):

```typescript
const mods = await this.getModificadores(sessionId);

// Aluguel de propriedade normal
let valor = this.calcularAluguel(posse.propriedade, posse.casas);
valor = Math.round(valor * (mods.aluguelMult ?? 1));

// Aluguel de AÇÃO (grupo Preto) — usa acoesMult, não aluguelMult
// (o rendimento de ação é 500 × nº de dados)
let valorAcao = 500 * numDados;
valorAcao = Math.round(valorAcao * (mods.acoesMult ?? 1));
```

### 4.2 — IPTU, Manutenção e Renda Passiva (extrato do Início)

No `calcularExtratoInicio` (criado na Mecânica 1):

```typescript
private async calcularExtratoInicio(sessionId: number, playerId: number) {
  const mods = await this.getModificadores(sessionId);

  // ...loop pelas propriedades...
  const propIptu = Math.round(prop.custo_compra * IPTU_PCT * (mods.iptuMult ?? 1));
  const propManut = Math.round(
    prop.custo_casa * MANUTENCAO_PCT * casasEquivalentes * (mods.manutencaoMult ?? 1)
  );
  const propRenda = Math.round(
    aluguelAtual * RENDA_PASSIVA_PCT * (mods.rendaPassivaMult ?? 1)
  );
  // ...
}
```

### 4.3 — Custo de construção

Em `propriedade.service.ts`, onde casas são compradas (linhas ~91, ~180, ~259):

```typescript
// ANTES:
const custoCasa = propriedade.propriedade.custo_casa;

// DEPOIS:
const mods = await turnoService.getModificadores(sessionId);  // tornar público
const custoCasa = Math.round(
  propriedade.propriedade.custo_casa * (mods.custoConstrucaoMult ?? 1)
);
```

**ATENÇÃO — venda de casas:** a venda devolve 50% do custo. Decidir:
- **Opção A (recomendada):** venda usa o custo BASE (sem modificador). Evita
  exploit de "comprar barato no boom, vender caro na escassez".
- Manter `valorVenda = custo_casa * 0.5` sem modificador.

### 4.4 — Frontend: `getAluguel` no gameStore

O frontend calcula aluguel para exibição. Deve refletir o evento ativo:

```typescript
// client/src/stores/gameStore.ts
getAluguel: (propriedade, casas) => {
  const base = /* ...cálculo existente... */;
  const evento = get().currentSession?.eventoAtual;
  const mult = getEventoMult(evento, "aluguelMult") ?? 1;
  return Math.round(base * mult);
}
```

**Criar espelho do catálogo no client:** `client/src/constants/eventos.ts`
com os mesmos códigos, nomes, ícones e multiplicadores (para exibição).

---

## ETAPA 5 — UI/UX (crítico)

O evento só funciona se o jogador **entender e conseguir reagir**. Sem UI
clara, vira punição aleatória.

### 5.1 — Banner de aviso (evento anunciado)

Quando `eventoProximo` existe, mostrar banner **persistente e destacado** no
topo do tabuleiro:

```
┌──────────────────────────────────────────────────────┐
│ ⚠️  PRÓXIMA RODADA: 📉 Crise Imobiliária             │
│     Aluguéis caem 50%. Se você vive de aluguel,      │
│     aperte o cinto.                                  │
└──────────────────────────────────────────────────────┘
```

- Cor do banner segue `evento.cor` (vermelho = ruim, verde = bom)
- Sempre visível durante a rodada de antecedência
- Não pode ser dispensado (é informação crítica)

### 5.2 — Modal de evento ativo (ao virar a rodada)

Quando o evento entra em vigor, modal para **todos os jogadores**:

```
┌────────────────────────────────┐
│           📉                   │
│    CRISE IMOBILIÁRIA           │
│                                │
│  Os aluguéis despencam.        │
│  Ninguém quer alugar.          │
│                                │
│  ➜ Aluguéis caem 50%           │
│    nesta rodada                │
│                                │
│         [ Entendi ]            │
└────────────────────────────────┘
```

- Animação GSAP (padrão do projeto)
- Fecha em 6s ou no clique
- Aparece para todos simultaneamente

### 5.3 — Indicador permanente do evento ativo

Badge fixo (canto do tabuleiro / header do jogo):

```
[ 📉 Crise Imobiliária · Aluguéis −50% ]
```

Clicável → reabre o modal com detalhes.

### 5.4 — Refletir o evento nos números da UI

**Essencial:** onde o aluguel é exibido (PropertyDetailModal, PropertyCard,
aba Início), mostrar o valor **já modificado**, com indicação visual:

```
Aluguel: R$ 1.500  →  R$ 750  📉
                       ↑ riscado o original, destaque no novo
```

Sem isso o jogador não entende por que recebeu menos.

### 5.5 — Ordem de notificação (delay)

O modal de evento aparece **na virada da rodada**, antes do primeiro jogador
rolar os dados. Não deve competir com o modal de turno/dados.

Sequência: virada de rodada → modal de evento → começa o turno do 1º jogador.

---

## ETAPA 6 — Atualizar regras (Client + README)

### Onboarding
Adicionar seção explicando:
- A cada 2 rodadas, um evento econômico afeta todos
- O evento é **anunciado com 1 rodada de antecedência**
- Todos sabem ao mesmo tempo — o que conta é **saber reagir**
- Exemplos: crise derruba aluguéis, boom os multiplica, IPTU pode dobrar

### README
```markdown
### Modo Tabuleiro — Eventos Econômicos
- Evento a cada 2 rodadas, anunciado com 1 rodada de antecedência
- 10 eventos: crises, booms, mudanças de IPTU, custo de construção, dividendos
- Afetam a rodada inteira: aluguéis, IPTU, manutenção, renda passiva, construção
- Informação pública — a vantagem vem de saber reagir, não de saber antes
```

---

## ETAPA 7 — Testes manuais obrigatórios

### Contador de rodadas
- [ ] `rodadaAtual` incrementa quando o turno volta ao 1º jogador ativo
- [ ] Jogador que desistiu não impede a rodada de virar
- [ ] Feriado (pular vez) não quebra a contagem de rodadas
- [ ] Contador não incrementa duas vezes na mesma volta

### Ciclo do evento
- [ ] Evento é anunciado 1 rodada antes (`eventoProximo`)
- [ ] Ao virar a rodada, `eventoProximo` vira `eventoAtual`
- [ ] Evento ativo dura exatamente 1 rodada
- [ ] Novo evento não repete o anterior imediatamente
- [ ] Injeção de Liquidez credita R$ 1.000 a todos imediatamente

### Modificadores (testar cada um)
- [ ] Crise: aluguel cobrado é 50% do normal
- [ ] Boom: aluguel cobrado é 150%
- [ ] IPTU Extraordinário: IPTU dobra no extrato do Início
- [ ] Isenção Fiscal: IPTU zerado no extrato
- [ ] Inflação: manutenção +50% no extrato
- [ ] Recessão: renda passiva zerada no extrato
- [ ] Escassez: construir casa custa +50%
- [ ] Aquecimento: construir casa custa -30%
- [ ] Dividendos: ações (grupo Preto) rendem 2x
- [ ] Venda de casa NÃO é afetada por modificador (usa custo base)

### Não quebrar o existente
- [ ] Ordem de turnos intacta
- [ ] Compra de propriedade funciona normal
- [ ] Hipoteca/deshipoteca funciona normal
- [ ] Falência em 3 rodadas funciona normal
- [ ] Prisão e feriado funcionam normal
- [ ] Extrato do Início (Mecânica 1) funciona com e sem evento
- [ ] Modo Banca NÃO é afetado

### UX
- [ ] Banner de aviso aparece na rodada de antecedência
- [ ] Banner tem cor correta (verde/vermelho) e dica de reação
- [ ] Modal de evento aparece para todos ao virar a rodada
- [ ] Badge do evento ativo visível permanentemente
- [ ] Aluguéis exibidos na UI refletem o modificador
- [ ] Custo de construção exibido reflete o modificador
- [ ] Modal de evento não conflita com modal de dados/turno

### Build
- [ ] `make validate` passa

---

## Definição de "pronto"

1. `rodadaAtual` contando corretamente no schema e no `avancarTurno`
2. `eventos.ts` (backend) e espelho no client
3. Ciclo anúncio → ativação → expiração funcionando
4. Todos os 10 eventos aplicando seus modificadores nos pontos corretos
5. Banner de aviso + modal de evento + badge permanente
6. Valores na UI refletindo os modificadores ativos
7. Regras atualizadas (onboarding + README)
8. Todos os testes passando; Modo Banca intacto

---

## Nota de balanceamento

10 eventos (5 bons, 5 ruins), sorteio uniforme. Após partidas reais, avaliar:
- Se um evento é sempre devastador → suavizar o multiplicador
- Se um evento é irrelevante → intensificar
- Se o intervalo de 2 rodadas é muito frequente/raro → ajustar
  `EVENTO_INTERVALO_RODADAS`
