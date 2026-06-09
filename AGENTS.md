# GameBank

Gerenciador multiplayer de Banco Imobiliário (Super Máquina).

| Camada | Stack |
|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind CSS v4 + TS |
| State | Zustand + SWR (Zustand = fonte única) |
| Backend | Express.js + TS |
| ORM | Prisma 7 + PostgreSQL 16 |
| Infra | Docker Compose (dev/prod) |
| Auth | JWT + bcrypt + OAuth (Google, Discord) |
| Validação | Zod (compartilhado `server/src/shared/schemas/`) |
| Tempo real | Socket.IO (`/game` namespace) + Redis adapter |
| Upload | Cloudinary (avatars) via `multer` (memória) |

## Arquitetura (server)

```
Middleware (auth, room-auth, lock, validation)
  → Controller (req/res, status codes)
    → Service (regras de negócio, $transaction, AppError)
      → Repository (queries Prisma puras, sem lógica)
```

Cada módulo em `server/src/modules/<modulo>/`:
- `<modulo>.repository.ts` — queries Prisma puras, sem lógica de negócio
- `<modulo>.service.ts` — regras, transações, validações, AppError
- `<modulo>.controller.ts` — extrai req, chama service, retorna res
- Rotas **sempre** em `server/src/api/routes/<modulo>.route.ts` — nunca dentro do módulo

**Exceção ao repository**: `avatar` não tem repository pois só encapsula chamadas à API do Cloudinary (sem Prisma).

## Comandos

```bash
make dev             # Sobe dev com Docker (--build)
make dev-up          # Sobe dev detached
make dev-logs        # Logs
make dev-shell SVC=server  # Shell no container
make db-reset        # Recria banco do zero
make db-studio       # Prisma Studio
make db-purge-missions  # Limpa missões diárias/semanais compartilhadas
make db-migrate-xp   # Converte XP cumulativo → XP por nível (uma vez)
make test            # Health check HTTP
# Build manual:
cd server && npm run build                # prisma generate + tsc
cd client && npx next build --turbopack
# Se schema.prisma foi alterado, rodar antes do build:
npx prisma migrate dev --name <descricao>
```

Após npm install: `docker compose -f docker-compose.dev.yml build --no-cache server|client`

## Admin

O usuário admin é criado automaticamente no startup do servidor via `seedAdmin()` em `server/src/utils/seed-admin.ts`. Não requer comando manual.

Para ativar, adicionar ao `.env` raiz:
```
ADMIN_EMAIL=admin@gamebank.com
ADMIN_PASSWORD=troque-esta-senha
```

Se as variáveis não estiverem definidas, o seed é ignorado silenciosamente. O upsert é idempotente — rodar múltiplas vezes não duplica o usuário.

## Middleware chain (rotas protegidas)

1. `authenticate` — JWT do header `Authorization: Bearer <token>`
2. `authenticateRoom("params", "sessionId")` — cookie `room_token_{sessionId}` ou header `X-Room-Token`. **Exceção**: usuário JWT já jogador da sessão passa sem token de sala. Sessões sem senha passam direto.
3. `lock` — mutex por chave (ex.: `session:{id}`) para evitar race conditions em operações críticas (banco, propriedades, dívidas).
4. `validate(schema, "body" | "params" | "query")` — Zod.

## Animações

Stack: Framer Motion ^12 + CSS `@keyframes` (anti-flash) + GSAP (legado em `Modal` e `MobileMenu`).

| Técnica | Uso | Local |
|---|---|---|
| `AnimatePresence` | Entrada/saída de modais, toasts, dropdowns | `ConfirmationModal`, `UModal`, `EditProfileModal`, `ToastProvider`, `UserNav`, `Chat`, `ColorDropdown` |
| `variants` (stagger) | Listas com fade+slide em sequência | `Dashboard`, `Perfil`, `Sessions`, `Ranking`, `Loja`, `Cofre`, `Recompensas`, `New Session` |
| `mode="wait"` + `fadeIn` | Transição entre abas e páginas | `game/[sessionId]` tabs, `(main)/layout.tsx` |
| CSS `.anti-flash` | Previne flash de hidratação | `globals.css` — `@keyframes anti-flash` 0.01s `both` |
| `initial={false}` | Pula animação de entrada no mount inicial | Page layout (primeiro load não anima) |
| GSAP | Scale+fade legacy | `Modal`, `MobileMenu` (mantido) |

Variants centralizadas em `client/src/lib/animations.ts`: `backdrop`, `modalBox`, `slideUp`, `fadeIn`, `staggerContainer`, `staggerItem`.

## Navegação

O UserNav exibe 5 abas no bottom nav (grid-cols-5): Dashboard, Cofre, Loja, Recompensas, Ranking. Perfil foi removido da navbar — acessível apenas clicando no avatar do usuário (header desktop e mobile).

## Arquivos mortos (não removidos)

| Arquivo | Motivo |
|---|---|
| `client/src/components/BadgeCollection/index.tsx` | Substituído pelo Cofre (`/user/cofre`) |
| `client/src/components/Header/index.tsx` | Substituído pelo `UserNav` + `LandingHeader` |
| `client/src/components/MobileMenu/index.tsx` | Não utilizado |
| `client/src/components/PlayerCard/index.tsx` | Substituído por versão local em `Inicio`/game page |
| `client/src/components/Title1/index.tsx` | Não utilizado |
| `client/src/components/ui/button.tsx` | shadcn/ui não utilizado |
| `client/src/components/ui/dropdown-menu.tsx` | shadcn/ui não utilizado |
| `client/src/components/ui/select.tsx` | shadcn/ui não utilizado |
| `client/src/lib/asyncAction.ts` | Nunca importado |
| `client/src/hooks/useBannerCatalog.ts` | Nunca importado (só usado por `services/api/banners.ts` que por sua vez só é importado por este hook) |
| `client/src/constants/badges.ts` | Nunca importado |
| `root/SESSION.md` | Log de terminal |
| `root/INSTRUCOES.md` | Notas de design obsoletas |
| `root/GameBank Design System/` | Mockups de design |
| `root/screenshots/` | Screenshots não referenciados |

## WebSocket

- `server/src/lib/socket.ts`: `initSocket(httpServer)` — namespace `/game`
- `client/src/stores/socketStore.ts`: `connectSocket(sessionId)`
- Controllers chamam `emitSessionUpdated(id, data)` após mutações. Client escuta `session:updated` → Zustand.
- **`socket.data.userId` = `User.id` (JWT)** — preenchido na conexão via JWT do handshake.
- **`socket.data.playerId` = `SessionPlayer.id`** — preenchido em `setSocketPlayerId()` após o join na sala; pode ser `undefined` se o usuário não for jogador da sessão. Handlers do chat buscam `SessionPlayer` via `findFirst({ where: { sessionId, userId } })` usando `socket.data.userId`.
- **Não confundir**: `socket.data.userId` é o `User.id`; `socket.data.playerId` é o `SessionPlayer.id`. São IDs de tabelas diferentes.

### Funções de emit

| Função | Assinatura | Uso |
|---|---|---|
| `emitSessionUpdated` | `(sessionId, data)` | Broadcast para todos na sala — atualiza estado da sessão |
| `emitToPlayer` | `(sessionId, playerId, event, data)` | Emite para um `SessionPlayer` específico pelo `SessionPlayer.id` — usado para notificações de negociação |
| `emitChatMessage` | `(sessionId, message)` | Broadcast de mensagem de chat para a sala |

### Redis adapter

O Socket.IO usa `@socket.io/redis-adapter` para suportar múltiplas instâncias. Se o Redis não estiver disponível, cai em modo single-instância (in-memory). O tracking de sockets ativos por usuário (`user:socket:{userId}`) também é mantido no Redis com fallback em Map local. Configuração em `server/src/lib/redis.ts` e `server/src/lib/socket.ts`.

### One socket por usuário

Ao fazer join, o sistema desconecta qualquer socket anterior do mesmo `User.id` e emite `force_disconnect` para o cliente antigo — impede sessões duplicadas.

## Upload de avatar (Cloudinary)

Fluxo completo:

1. Client envia `multipart/form-data` com campo `avatar`
2. `avatarUpload` middleware (`multer` em memória) recebe o buffer
3. `validateAndProcessAvatar` (`server/src/lib/image-validation.ts`) valida MIME e redimensiona
4. `uploadAvatarToCloudinary` (`server/src/modules/avatar/avatar.service.ts`) faz upload e retorna `{ url, publicId }`
5. Service salva `avatarUrl` + `avatarPublicId` + `avatarUpdatedAt` no banco
6. Se o banco falhar após upload, `rollbackCloudinaryUpload` remove o arquivo órfão

Variáveis necessárias: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_AVATAR_FOLDER` (default: `gamebank/avatars`).

Alternativa: avatar preset (string `preset:<id>`) — não usa Cloudinary.

## Validação Zod

Schemas compartilhados ficam em `server/src/shared/schemas/`:
- `auth.schema.ts`, `banco.schema.ts`, `player.schema.ts`, `propriedade.schema.ts`, `session.schema.ts`

Constantes de avatar/banner: `server/src/shared/constants/`.

Schemas usados só no client ficam em `client/src/` (sem compartilhamento).

## Next.js App Router — regras do cliente

- **Todo componente que usa hooks (`useState`, `useEffect`, `useRouter`, stores Zustand, etc.) precisa de `'use client'` no topo do arquivo.** Sem a diretiva, a assinatura reativa do Zustand não é configurada corretamente — o componente renderiza uma vez com o estado inicial e não recebe notificações de mudança. Componentes sem `'use client'` que "funcionam" por estarem dentro de um boundary cliente são frágeis.
- **Variáveis de ambiente públicas do cliente** (`NEXT_PUBLIC_*`) são injetadas via `environment:` no `docker-compose.dev.yml`, lendo do `.env` raiz (ex.: `NEXT_PUBLIC_FOO: ${FOO:-default}`). Para expor uma nova variável: adicionar ao `.env` + `.env.example` raiz **e** ao bloco `environment:` do serviço `client` no compose. O client não possui `.env.local` próprio.

## Z-index (hierarquia de camadas)

| Camada | Valor | Exemplos |
|---|---|---|
| Navbars fixas | `z-40` | `SiteBottomNav`, `GameBottomNav` |
| Header | `z-100` | `Header` |
| Modais / overlays full-screen | `z-[200]` | `EditProfileModal`, `Modal`, `ConfirmationModal`, `PodiumModal`, `MobileMenu`, `Loading` |
| Toast | `z-[100000]` | `ToastProvider` |

**Regra:** qualquer novo modal/overlay que cubra a tela inteira deve usar `z-[200]`. Usar `z-50` (padrão Tailwind) faz o overlay ficar atrás do Header.

## Sistema de XP

`User.xp` armazena **apenas XP dentro do nível atual** (não cumulativo). Quando o usuário acumula XP suficiente para o próximo nível, o excedente é transferido.

**Fórmula:** `xpForLevel(level) = floor(200 * 1.04^(level-1))` (nível 2 = 200 XP, nível 3 = 208 XP, ...)

**Helpers em `server/src/utils/level.ts`:**
| Função | Descrição |
|---|---|
| `xpForLevel(level)` | XP necessário para subir do nível atual para o próximo |
| `totalXpForLevels(level)` | Total cumulativo de XP necessário para alcançar o nível (migration apenas) |
| `getLevelFromXp(totalXp)` | Calcula nível a partir de XP total (migration/repair apenas) |
| `addXp(currentXp, currentLevel, amount)` | Adiciona XP com level-up automático (while-loop) |
| `subXp(currentXp, currentLevel, amount)` | Remove XP com level-down automático |

**Regras:**
- Sempre usar `addXp()`/`subXp()` ao modificar XP — nunca `{ increment: delta }`
- Escrever `xp` e `level` como valores absolutos no banco (não increment)
- Ranking ordena por `level DESC, xp DESC`
- Profile service auto-corrige se `xp >= xpForLevel(level)` (reconstroi total, recalcula)

**Migração (uma vez, após deploy):** `make db-migrate-xp` converte XP cumulativo → por nível.

## Bugs conhecidos (não repetir)

| Sintoma | Causa | Correção |
|---|---|---|
| Landing page quebrada no F5 (botões enormes/inertes) | `authStore.loadFromStorage()` executado antes da hidratação React → `hydration mismatch` | Auto-load removido do módulo. Header chama via `useEffect`. Game page chama explicitamente. |
| `ERR_NETWORK` no `loadSession` sem resposta HTTP | `authenticateRoom` async sem try/catch — Express 4 não trata async rejection | Corpo inteiro do middleware envolto em try/catch |
| 429/Network Error em toda rota `/api` | `rate-limit-redis` incompatível + `passOnError` não existe em express-rate-limit v8.5.2 | Store in-memory, sem `passOnError` |
| `setMessages is not a function` | Zustand criado antes do hot-reload; método novo ausente | Usar `useXxxStore.setState()` em vez de método do store |
| `ERR_ERL_KEY_GEN_IPV6` no rate-limiter | `keyGenerator` usando `req.ip` direto — express-rate-limit v8 exige o helper para IPv6 | `ipKeyGenerator(req.ip ?? "")` — a função recebe `string`, não o objeto `Request` |
| Import `Cannot find module '…/lib/cloudinary.js'` | Caminho relativo errado ao mover arquivo entre pastas de módulo | Contar os `../` a partir do arquivo de origem; `modules/avatar/` → `../../lib/` |
| `track()` cria UserMission para daily/weekly de outro usuário | `findActiveMissionsByMetric` retorna todas as missions; upsert no repository cria vínculo indevido | `track()` em missions.service.ts: pular (continue) se `tipo` daily/weekly e `existing` for null |

## CSP (helmet)

`server/src/index.ts` configura `connect-src` com `http://localhost:7000` e `https://gamebank-vtsb.onrender.com`. **Não remover** — browser bloqueia chamadas API com "Network Error".

## Convenções

| O quê | Padrão |
|---|---|
| Arquivos | `kebab-case` |
| Classes | `PascalCase` |
| Funções/variáveis | `camelCase` |
| Zod schemas | `PascalCase + Schema` (em `server/src/shared/schemas/`) |
| Erros de negócio | `AppError(statusCode, message)` |
| Imports | alfabético: externos → internos → tipos |
| Commits | `feat:` / `refactor:` / `fix:` / `docs:` — rodar build antes |
