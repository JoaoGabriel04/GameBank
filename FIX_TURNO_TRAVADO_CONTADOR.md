# Correção: Turno Travado e Contador Zerado

## Sintomas relatados

- A vez passava no servidor, mas **na tela do jogador nada mudava**
- O **contador ficava zerado**
- Às vezes o **F5 resolvia** — às vezes **nem o F5 resolvia**

## Diagnóstico — três bugs distintos

O fato de o F5 resolver **às vezes** é a pista central: são **dois problemas
diferentes** acontecendo, um no cliente (F5 resolve) e um que independe do
recarregamento (F5 não resolve).

---

# BUG A — `holdSessionUpdates` trava para sempre 🔴 CRÍTICO

**Sintoma:** tela congelada, vez não atualiza. **F5 resolve.**

## Causa

`holdSessionUpdates` é um estado **global** no `gameStore`. Ele foi criado na
correção do BUG 2 (ordem das informações) para segurar o `session:updated`
enquanto o modal revela os dados.

Enquanto está `true`, **todo** `session:updated` vai para um buffer
(`pendingSessionUpdate`) em vez de ser aplicado:

```typescript
// client/src/stores/gameStore.ts
applyOrBufferSession: (session) => {
  if (get().holdSessionUpdates) {
    pendingSessionUpdate = session;   // ← engavetado
    return;
  }
  set({ currentSession: session });
}
```

Em `Board/index.tsx`, o hold é ativado em `handleRolarDados` (linha ~409) e
`handleEscolherMovimento` (linha ~459). Existem **~8 caminhos de liberação**.

**Se qualquer um falhar, o hold fica `true` indefinidamente** — e a sessão
nunca mais é atualizada na tela.

### Os furos concretos

1. **Promise que nunca resolve.** No free tier, o servidor hiberna. A chamada
   `rolarDados()` / `escolherMovimento()` pode ficar pendurada sem resolver
   nem rejeitar. O `catch` nunca roda. O hold nunca é liberado.
   → `handleEscolherMovimento` **não tem `finally`** (só `try/catch`).

2. **`setTimeout` de segurança não é cancelado no unmount:**
   ```typescript
   setTimeout(() => setHoldSessionUpdates(false), 4000)
   ```
   Não há `clearTimeout`. Se o jogador tirar **duplo** e rolar de novo dentro
   de 4s, o timer da rolagem **anterior** libera o hold da rolagem **nova** —
   deixando o peão vazar antes do modal revelar.

3. **Sem cleanup no unmount do `Board`.** Se o jogador trocar de aba durante a
   rolagem, o componente desmonta sem liberar o hold.

## Correção

### A.1 — `finally` em todos os caminhos que ativam o hold

```typescript
// handleEscolherMovimento — hoje só tem try/catch
const handleEscolherMovimento = useCallback(async (escolha: EscolhaMovimento) => {
  setHoldSessionUpdates(true)
  try {
    const r = await escolherMovimento(session.id, escolha)
    if (!r) return
    // ...SFX e setResultado...
    setResultado(r)
  } catch (err: any) {
    toastError(err?.response?.data?.message || "Erro ao mover")
  } finally {
    setHoldSessionUpdates(false)   // ← SEMPRE libera
  }
}, [session.id, escolherMovimento, toastError, setHoldSessionUpdates])
```

### A.2 — Timeout de segurança com `clearTimeout` e ref

```typescript
const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null)

function armarLiberacaoDeSeguranca() {
  if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current)
  holdTimeoutRef.current = setTimeout(() => {
    setHoldSessionUpdates(false)
    holdTimeoutRef.current = null
  }, 4000)
}

// Em handleRolarDados, no lugar do setTimeout solto:
armarLiberacaoDeSeguranca()

// Em handleResultadoRevelado, cancelar o de segurança:
const handleResultadoRevelado = useCallback(() => {
  if (holdTimeoutRef.current) {
    clearTimeout(holdTimeoutRef.current)
    holdTimeoutRef.current = null
  }
  setHoldSessionUpdates(false)
  resultadoJaReveladoRef.current = true
}, [setHoldSessionUpdates])
```

### A.3 — Cleanup no unmount

```typescript
useEffect(() => {
  return () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current)
    setHoldSessionUpdates(false)   // nunca desmontar com o hold preso
  }
}, [setHoldSessionUpdates])
```

### A.4 — Watchdog no gameStore (rede de segurança final)

Mesmo com tudo acima, um caminho novo pode esquecer de liberar. Adicionar um
limite duro **no próprio store**:

```typescript
// client/src/stores/gameStore.ts
let holdWatchdog: NodeJS.Timeout | null = null;
const HOLD_MAX_MS = 6000;   // nenhuma sequência legítima passa disso

setHoldSessionUpdates: (hold) => {
  set({ holdSessionUpdates: hold });

  if (holdWatchdog) { clearTimeout(holdWatchdog); holdWatchdog = null; }

  if (hold) {
    // Se ninguém liberar em 6s, libera à força — o jogo nunca pode
    // ficar preso por causa do buffer de animação.
    holdWatchdog = setTimeout(() => {
      console.warn("[gameStore] hold liberado pelo watchdog");
      get().setHoldSessionUpdates(false);
    }, HOLD_MAX_MS);
    return;
  }

  // Ao liberar: aplica o que estava engavetado
  if (pendingSessionUpdate) {
    const buffered = pendingSessionUpdate;
    pendingSessionUpdate = null;
    set({ currentSession: buffered });
  }
  if (pendingCallbacks.length) {
    const callbacks = pendingCallbacks;
    pendingCallbacks = [];
    callbacks.forEach((cb) => cb());
  }
},
```

**Este watchdog é a correção mais importante do documento.** Ele garante que
nenhum bug futuro de liberação consiga travar a tela permanentemente.

---

# BUG B — Contador zerado pelo relógio do cliente 🔴 CRÍTICO

**Sintoma:** contador em 0. **F5 NÃO resolve.**

## Causa

O countdown compara o `turnoIniciadoEm` (hora do **servidor**) com
`Date.now()` (hora do **cliente**):

```typescript
// client/src/components/Game/TurnoTimeline/index.tsx
const inicio = new Date(currentSession.turnoIniciadoEm).getTime();  // servidor
const passado = Math.floor((Date.now() - inicio) / 1000);           // cliente
setRestante(Math.max(0, 60 - passado));
```

Se o relógio do jogador estiver **adiantado** em relação ao servidor, `passado`
fica grande e `restante` trava em **0**.

**O F5 não resolve porque o relógio do cliente continua adiantado.** Isso
explica por que só alguns jogadores eram afetados — só os de relógio
dessincronizado.

O mesmo cálculo está duplicado em três lugares:
- `Game/TurnoTimeline/index.tsx` (~linha 36)
- `Board/TurnoBanner/index.tsx` (~linha 57)
- `GameSfxLayer/index.tsx` (~linha 38)

## Correção — offset de relógio

Calcular, uma vez, a diferença entre o relógio do servidor e o do cliente, e
usá-la em todos os cálculos de tempo.

### B.1 — O servidor informa a hora dele

No payload de `loadSession` (ou num evento de socket), incluir:

```typescript
serverTime: new Date().toISOString(),
```

### B.2 — O cliente calcula o offset

```typescript
// client/src/utils/clock.ts
let serverOffsetMs = 0;

/** Diferença entre o relógio do servidor e o do cliente. */
export function setServerTime(serverIso: string) {
  serverOffsetMs = new Date(serverIso).getTime() - Date.now();
}

/** "Agora" na régua do servidor — use SEMPRE isto em cálculos de turno. */
export function serverNow(): number {
  return Date.now() + serverOffsetMs;
}
```

### B.3 — Usar `serverNow()` nos três countdowns

```typescript
import { serverNow } from "@/utils/clock"

const inicio = new Date(currentSession.turnoIniciadoEm).getTime();
const passado = Math.floor((serverNow() - inicio) / 1000);   // ← corrigido
setRestante(Math.max(0, 60 - passado));
```

### B.4 — Não sair cedo quando `turnoIniciadoEm` é `null`

Hoje:
```typescript
if (!currentSession.turnoIniciadoEm) return;   // ← contador congela no valor antigo
```

Se for `null`, o contador deve ser **zerado explicitamente**, não deixado no
valor anterior:

```typescript
if (!currentSession.turnoIniciadoEm) {
  setRestante(null);   // ou 0 — mas de forma explícita, sem congelar
  return;
}
```

---

# BUG C — `turnoIniciadoEm` escrito duas vezes 🟡 MÉDIO

**Sintoma:** dessincronia sutil entre o timer do servidor e o do cliente.

## Causa

Em `turno.service.ts` (`avancarTurno`, ~linha 378):

```typescript
await turnoRepository.updateTurno(sessionId, {
  turnoAtualPlayerId: proximo.id,
  turnoIniciadoEm: new Date(),      // ← escrita 1 (T1)
  aguardandoAcao: false,
});

await timerService.agendarTimeout(sessionId);
//   ↑ dentro dele: updateTurno({ turnoIniciadoEm: agora })  ← escrita 2 (T2)
```

`turnoIniciadoEm` é gravado **duas vezes**, com timestamps diferentes (T1 e T2,
separados por alguns ms + latência do banco).

Consequências:
- A idempotência do timeout usa `esperadoIso = T2`, mas o cliente pode ter
  recebido T1
- Duas escritas desnecessárias no banco por turno
- Janela de corrida entre a emissão do socket e a segunda escrita

## Correção

O `agendarTimeout` **não deve escrever** `turnoIniciadoEm`. Quem controla o
início do turno é o `avancarTurno`. O timer apenas **lê** o valor já gravado.

```typescript
// timer.service.ts
async agendarTimeout(sessionId: number, turnoIniciadoEm?: Date) {
  cancelTurnoTimer(sessionId);

  // Se não veio o timestamp, lê o que já está no banco (não escreve!)
  let inicio = turnoIniciadoEm;
  if (!inicio) {
    const s = await turnoRepository.findSessionComTurno(sessionId);
    if (!s?.turnoIniciadoEm) return;
    inicio = new Date(s.turnoIniciadoEm);
  }

  const esperadoIso = inicio.toISOString();
  const elapsed = Date.now() - inicio.getTime();
  const restante = Math.max(0, TURNO_TIMEOUT_MS - elapsed);

  const timer = setTimeout(async () => {
    try {
      await this.avancarPorTimeout(sessionId, esperadoIso);
    } catch (err: any) {
      if (err?.statusCode === 423) this.agendarTimeout(sessionId);
      else sessionLogger.error({ err, sessionId }, "erro ao avançar turno por timeout");
    }
  }, restante);

  turnoTimers.set(sessionId, timer);
}
```

E no `avancarTurno`, passar o timestamp que **acabou de ser gravado**:

```typescript
const agora = new Date();
await turnoRepository.updateTurno(sessionId, {
  turnoAtualPlayerId: proximo.id,
  turnoIniciadoEm: agora,
  aguardandoAcao: false,
});

await timerService.agendarTimeout(sessionId, agora);   // ← passa o valor, não regrava
```

**Vantagem extra:** o timer passa a respeitar o tempo **restante** (não reinicia
60s do zero), o que corrige o re-agendamento no F5.

Auditar os demais chamadores de `agendarTimeout` — se algum dependia do
efeito colateral de regravar `turnoIniciadoEm`, ajustar para gravar
explicitamente antes de chamar.

---

## ORDEM DE IMPLEMENTAÇÃO

| Ordem | Bug | Por quê |
|---|---|---|
| 1 | **A.4 — watchdog** | Correção de 10 linhas que impede a tela de travar permanentemente. Faça primeiro. |
| 2 | **A.1–A.3** | Fecha os furos de liberação do hold |
| 3 | **B** | Corrige o contador zerado que o F5 não resolve |
| 4 | **C** | Elimina a dupla escrita e corrige o re-agendamento |

---

## TESTES OBRIGATÓRIOS

### Bug A — hold travado
- [ ] Rolar dados e trocar de aba no meio → a tela continua atualizando
- [ ] Rolar dados com o servidor lento (simular 5s de latência) → não trava
- [ ] Tirar duplo e rolar de novo em menos de 4s → o peão não vaza antes do modal
- [ ] Forçar erro no `escolherMovimento` → o hold é liberado (tem `finally`)
- [ ] Watchdog: forçar `setHoldSessionUpdates(true)` sem liberar → em 6s libera
      sozinho e loga o aviso
- [ ] Após qualquer um desses, a vez continua passando normalmente na tela

### Bug B — contador
- [ ] Adiantar o relógio do sistema em 2 minutos → **o contador continua correto**
- [ ] Atrasar o relógio em 2 minutos → o contador continua correto
- [ ] O countdown bate com o timeout real do servidor (a vez passa quando chega a 0)
- [ ] Os três lugares (TurnoTimeline, TurnoBanner, GameSfxLayer) usam `serverNow()`
- [ ] `turnoIniciadoEm = null` → contador não fica congelado num valor antigo

### Bug C — timer
- [ ] `turnoIniciadoEm` é gravado **uma única vez** por turno
- [ ] F5 no meio do turno → o timer re-agenda pelo tempo **restante**, não 60s
- [ ] O timeout dispara no momento certo (não antes, não depois)
- [ ] A idempotência continua funcionando (turno não pula jogador)

### Não quebrou nada
- [ ] Fluxo completo de turno: rolar → escolher → resolver → passar
- [ ] Ordem das informações preservada (dados → peão → desfecho) — o BUG 2
      original não pode voltar
- [ ] Leilão, prisão, feriado, falência funcionando
- [ ] `make validate` passa

---

## Definição de "pronto"

1. Watchdog no `gameStore` (nenhum hold sobrevive a 6s)
2. `finally` em todos os handlers que ativam o hold
3. `setTimeout` de segurança com `clearTimeout` e ref
4. Cleanup no unmount do `Board`
5. `serverNow()` usado nos três countdowns
6. `turnoIniciadoEm` gravado uma única vez, no `avancarTurno`
7. `agendarTimeout` respeita o tempo restante
8. Todos os testes passando

---

## Nota

O `holdSessionUpdates` foi introduzido para corrigir o BUG 2 (peão movendo
antes do jogador ver os dados). A correção estava certa, mas criou um **ponto
único de falha**: um estado global que, se não for liberado, congela a tela.

O watchdog (A.4) transforma isso num problema **temporário e visível** (6s +
log) em vez de **permanente e silencioso**. Mesmo depois de fechar os furos
conhecidos, mantenha-o — é a rede que pega os furos futuros.
