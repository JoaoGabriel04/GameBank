# sgpController

Gerenciador multiplayer de Banco Imobiliário (Super Máquina).

| Camada | Stack |
|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind CSS v4 + TS |
| State | Zustand + SWR (Zustand = fonte única) |
| Backend | Express.js + TS |
| ORM | Prisma 7 + PostgreSQL 16 |
| Infra | Docker Compose (dev/prod) |
| Auth | JWT + bcrypt |
| Validação | Zod (compartilhado `shared/schemas/`) |
| Tempo real | Socket.IO (`/game` namespace) |

## Arquitetura (server)

```
Middleware (auth, room-auth, validation)
  → Controller (req/res, status codes)
    → Service (regras de negócio, $transaction, AppError)
      → Repository (queries Prisma puras)
```

Cada módulo em `server/src/modules/<modulo>/`:
- `<modulo>.repository.ts` — CRUD Prisma, sem lógica
- `<modulo>.service.ts` — regras, transações, validações
- `<modulo>.controller.ts` — extrai req, chama service, retorna res
- Rotas centralizadas em `server/src/api/routes/`

## Comandos

```bash
make dev             # Sobe dev com Docker (--build)
make dev-up          # Sobe dev detached
make dev-logs        # Logs
make dev-shell SVC=server  # Shell no container
make db-reset        # Recria banco do zero
make db-studio       # Prisma Studio
make test            # Health check HTTP
# Build manual:
cd server && npm run build                # prisma generate + tsc
cd client && npx next build --turbopack
```

Após npm install: `docker compose -f docker-compose.dev.yml build --no-cache server|client`

## Middleware chain (rotas protegidas)

1. `authenticate` — JWT do header `Authorization: Bearer <token>`
2. `authenticateRoom("params", "sessionId")` — cookie `room_token_{sessionId}` ou header `X-Room-Token`. **Exceção**: usuário JWT já jogador da sessão passa sem token de sala. Sessões sem senha passam direto.
3. `validate(schema, "body" | "params" | "query")` — Zod.

## WebSocket

- `server/src/lib/socket.ts`: `initSocket(httpServer)` — namespace `/game`
- `client/src/stores/socketStore.ts`: `connectSocket(sessionId)`
- Controllers chamam `emitSessionUpdated(id, data)` após mutações. Client escuta `session:updated` → Zustand.
- **`socket.data.userId` = `User.id` (JWT)** — não confundir com `SessionPlayer.id`. Handlers buscam `SessionPlayer` via `findFirst({ where: { sessionId, userId } })`.

## Bugs conhecidos (não repetir)

| Sintoma | Causa | Correção |
|---|---|---|
| Landing page quebrada no F5 (botões enormes/inertes) | `authStore.loadFromStorage()` executado antes da hidratação React → `hydration mismatch` | Auto-load removido do módulo. Header chama via `useEffect`. Game page chama explicitamente. |
| `ERR_NETWORK` no `loadSession` sem resposta HTTP | `authenticateRoom` async sem try/catch — Express 4 não trata async rejection | Corpo inteiro do middleware envolto em try/catch |
| 429/Network Error em toda rota `/api` | `rate-limit-redis` incompatível + `passOnError` não existe em express-rate-limit v8.5.2 | Store in-memory, sem `passOnError` |
| `setMessages is not a function` | Zustand criado antes do hot-reload; método novo ausente | Usar `useXxxStore.setState()` em vez de método do store |

## CSP (helmet)

`server/src/index.ts` configura `connect-src` com `http://localhost:7000` e `https://sgpcontroller.onrender.com`. **Não remover** — browser bloqueia chamadas API com "Network Error".

## Convenções

| O quê | Padrão |
|---|---|
| Arquivos | `kebab-case` |
| Classes | `PascalCase` |
| Funções/variáveis | `camelCase` |
| Zod schemas | `PascalCase + Schema` (em `shared/schemas/`) |
| Erros de negócio | `AppError(statusCode, message)` |
| Imports | alfabético: externos → internos → tipos |
| Commits | `feat:` / `refactor:` / `fix:` / `docs:` — rodar build antes |
