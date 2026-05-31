# Fix: Proponente não recebe Toast do resultado da negociação

## Diagnóstico

Existem dois bugs independentes que causam o problema:

### Bug 1 — Servidor: `emitToUser` falha silenciosamente (causa raiz principal)

No `negociacao.controller.ts`, todos os eventos de negociação usam `emitToUser`, que depende de um Map em memória (`activeSockets`) para encontrar o socket do destinatário:

```ts
// socket.ts
export function emitToUser(userId: number, event: string, data: unknown) {
  const socketId = activeSockets.get(userId); // retorna undefined se não encontrado
  if (!socketId) return;                       // sai silenciosamente
  const socket = nsp.sockets.get(socketId);
  socket?.emit(event, data);                   // também falha silenciosamente
}
```

Se o socket do usuário não está registrado em `activeSockets` (ex.: token JWT inválido ou ausente no handshake do socket, reconexão ainda não processada), nenhum evento chega ao cliente — **nenhum toast dispara**.

O sistema de expiração de negociações (`negotiation-cleanup.ts`) **já usa `emitToPlayer`** corretamente e funciona. O controller de negociação deve seguir o mesmo padrão.

`emitToPlayer` é mais confiável porque itera os sockets presentes no room da sessão em tempo real, usando `socket.data.playerId` que é atualizado a cada `session:join`. Não depende de Map em memória que pode estar stale.

### Bug 2 — Cliente: `iAmProposer` pode falhar no handler de `negotiation:accepted`

```ts
// socketStore.ts
const iAmProposer = !!authUser && data.fromPlayer?.userId === authUser.id;
```

Este check falha se `authUser` for `null` no momento do evento (raro mas possível durante re-hidratação do Zustand), ou se `data.fromPlayer.userId` for `null` (campo `userId` é opcional no modelo `SessionPlayer`). O resultado: o proponente recebe o evento mas nenhum toast é exibido.

O `minhaNegociacaoPendente` do store já armazena exatamente a negociação que o proponente enviou. Usar esse dado como fallback resolve o caso sem depender do `userId`.

---

## Alterações Necessárias

### Arquivo 1: `server/src/modules/negociacao/negociacao.controller.ts`

**Objetivo:** Trocar todos os `emitToUser` por `emitToPlayer`, usando os `playerId` já disponíveis no objeto de negociação. Remover variáveis `fromUserId`/`toUserId` que ficam sem uso.

**Passo 1 — Alterar o import:**

Localizar:
```ts
import { emitToUser } from "../../lib/socket.js";
```

Substituir por:
```ts
import { emitToPlayer } from "../../lib/socket.js";
```

---

**Passo 2 — Função `criar`:**

Localizar:
```ts
      const toUserId = negotiation?.toPlayer?.userId;
      if (toUserId) emitToUser(toUserId, "negotiation:new", negotiation);
```

Substituir por:
```ts
      if (negotiation?.toPlayerId) {
        emitToPlayer(body.sessionId, negotiation.toPlayerId, "negotiation:new", negotiation);
      }
```

---

**Passo 3 — Função `aceitar`:**

Localizar:
```ts
      const fromUserId = negotiation.fromPlayer?.userId;
      const toUserId   = negotiation.toPlayer?.userId;
      if (fromUserId) emitToUser(fromUserId, "negotiation:accepted", negotiation);
      if (toUserId)   emitToUser(toUserId,   "negotiation:accepted", negotiation);
```

Substituir por:
```ts
      emitToPlayer(negotiation.sessionId, negotiation.fromPlayerId, "negotiation:accepted", negotiation);
      emitToPlayer(negotiation.sessionId, negotiation.toPlayerId,   "negotiation:accepted", negotiation);
```

---

**Passo 4 — Função `recusar`:**

Localizar:
```ts
      const fromUserId = negotiation.fromPlayer?.userId;
      if (fromUserId) emitToUser(fromUserId, "negotiation:rejected", { negotiationId: negotiation.id });
```

Substituir por:
```ts
      emitToPlayer(negotiation.sessionId, negotiation.fromPlayerId, "negotiation:rejected", { negotiationId: negotiation.id });
```

---

**Passo 5 — Função `contraOfertar`:**

Localizar:
```ts
      const toUserId = newNegotiation.toPlayer?.userId;
      if (toUserId) emitToUser(toUserId, "negotiation:counter", newNegotiation);
```

Substituir por:
```ts
      emitToPlayer(newNegotiation.sessionId, newNegotiation.toPlayerId, "negotiation:counter", newNegotiation);
```

---

### Arquivo 2: `client/src/stores/socketStore.ts`

**Objetivo:** Adicionar `minhaNegociacaoPendente` como fallback no check `iAmProposer` dentro do handler `negotiation:accepted`.

Localizar este bloco exato:
```ts
  // Negociação — aceita
  socket.on("negotiation:accepted", (data: Negotiation) => {
    const negStore = useNegotiationStore.getState();
    const authUser = useAuthStore.getState().user;

    // Identifica papel via User.id presente no payload — independe do currentSession estar carregado
    const iAmProposer = !!authUser && data.fromPlayer?.userId === authUser.id;
    const iAmTarget   = !!authUser && data.toPlayer?.userId === authUser.id;

    negStore.removePendente(data.id);
    negStore.setMinhaNegociacao(null);
    negStore.setMinhaNegociacaoAberto(false);

    if (iAmProposer) toast.success("Sua negociação foi aceita!");
    else if (iAmTarget) toast.success("Negociação concluída com sucesso!");

    if (currentSessionId) useGameStore.getState().loadSession(currentSessionId);
  });
```

Substituir por:
```ts
  // Negociação — aceita
  socket.on("negotiation:accepted", (data: Negotiation) => {
    const negStore = useNegotiationStore.getState();
    const authUser = useAuthStore.getState().user;
    const minhaNeg = negStore.minhaNegociacaoPendente;

    // Fallback: se minhaNegociacaoPendente.id bate com a negociação aceita,
    // este cliente é o proponente — independe de userId estar preenchido no payload.
    const iAmProposer =
      (minhaNeg?.id === data.id) ||
      (!!authUser && data.fromPlayer?.userId === authUser.id);
    const iAmTarget = !!authUser && data.toPlayer?.userId === authUser.id;

    negStore.removePendente(data.id);
    negStore.setMinhaNegociacao(null);
    negStore.setMinhaNegociacaoAberto(false);

    if (iAmProposer) toast.success("Sua negociação foi aceita!");
    else if (iAmTarget) toast.success("Negociação concluída com sucesso!");

    if (currentSessionId) useGameStore.getState().loadSession(currentSessionId);
  });
```

---

## Verificação após aplicar as mudanças

Após as edições, confirmar que:

1. **`negociacao.controller.ts`** não contém mais nenhuma referência a `emitToUser` — apenas `emitToPlayer`.
2. **`negociacao.controller.ts`** não contém variáveis `fromUserId` ou `toUserId` soltas (sem uso).
3. **`socketStore.ts`** tem `minhaNeg` declarado antes da linha `iAmProposer`.
4. O TypeScript compila sem erros no servidor:
   ```bash
   cd server && npx tsc --noEmit
   ```
5. O TypeScript compila sem erros no cliente:
   ```bash
   cd client && npx tsc --noEmit
   ```

## Contexto adicional (não alterar)

- `emitToPlayer` já existe em `server/src/lib/socket.ts` e é usada corretamente em outros módulos (`banco.controller.ts`, `negotiation-cleanup.ts`).
- `minhaNegociacaoPendente` é setado em `NegotiationResponseModal/index.tsx` linha 197 logo após o HTTP POST de criação da negociação ter sucesso. O valor já está disponível quando o evento `negotiation:accepted` chega.
- **Não alterar** a lógica de `emitToUser` em `socket.ts` — ela ainda é usada por outros módulos.
- **Não alterar** o handler `negotiation:rejected` no cliente — ele já é incondicional e está correto; o problema era apenas a entrega server-side.
