# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GameBank is a multiplayer manager for Super Banco Imobiliário (Brazilian Monopoly). It replaces the physical banker role with a full web app handling balances, properties, debts, and trades.

| Layer | Stack |
|---|---|
| Frontend | Next.js 16 (App Router) + Tailwind CSS v4 + TypeScript |
| State | Zustand (source of truth) + SWR (data fetching) |
| Backend | Express.js + TypeScript |
| ORM | Prisma 7 + PostgreSQL 16 |
| Real-time | Socket.IO (`/game` namespace) + Redis adapter |
| Auth | JWT + bcrypt + OAuth (Google, Discord) |
| Validation | Zod (shared schemas) |
| Upload | Cloudinary (avatars) via multer (memory storage) |
| Infra | Docker Compose (dev/prod) |

## Commands

```bash
# Development (Docker)
make dev             # Start dev with logs and build
make dev-up          # Start dev detached
make dev-down        # Stop dev
make dev-logs        # Follow logs
make dev-shell SVC=server  # Shell into container
make dev-restart SVC=server

# Database
make db-reset        # Drop volumes + recreate DB from scratch
make db-migrate      # Run prisma migrate dev inside container
make db-studio       # Open Prisma Studio
make db-purge-users  # Run purge-users script

# Manual builds (inside container or locally)
cd server && npm run build        # prisma generate + tsc
cd client && npx next build --turbopack

# Health check / integration test
make test

# Lint (client)
cd client && npm run lint
```

After `npm install` in a service, rebuild its image:
```bash
docker compose -f docker-compose.dev.yml build --no-cache server
# or
docker compose -f docker-compose.dev.yml build --no-cache client
```

If `schema.prisma` changed, run before build:
```bash
npx prisma migrate dev --name <description>
```

## Server Architecture

```
Middleware (auth → room-auth → lock → validate)
  → Controller (req/res, HTTP status codes)
    → Service (business rules, $transaction, AppError)
      → Repository (pure Prisma queries, no logic)
```

Each domain module lives in `server/src/modules/<module>/`:
- `<module>.repository.ts` — Prisma queries only, no business logic
- `<module>.service.ts` — rules, transactions, validation, `AppError`
- `<module>.controller.ts` — extract req params, call service, return res

Routes always in `server/src/api/routes/<module>.route.ts` — never inside the module folder.

**Exception**: `avatar` module has no repository because it only wraps Cloudinary API calls (no Prisma).

### Middleware chain (protected routes)

1. `authenticate` — validates JWT from `Authorization: Bearer <token>`
2. `authenticateRoom("params", "sessionId")` — validates `room_token_{sessionId}` cookie or `X-Room-Token` header. JWT players of the session bypass this. Password-less sessions bypass it too.
3. `lock` — mutex per key (e.g. `session:{id}`) to prevent race conditions on bank/property/debt operations
4. `validate(schema, "body"|"params"|"query")` — Zod validation

### WebSocket

- Init: `server/src/lib/socket.ts` → `initSocket(httpServer)`, namespace `/game`
- Client connection: `client/src/stores/socketStore.ts` → `connectSocket(sessionId)`
- After mutations, controllers call `emitSessionUpdated(id, data)`. Client listens `session:updated` → updates Zustand.
- `socket.data.userId` = `User.id` (from JWT handshake)
- `socket.data.playerId` = `SessionPlayer.id` (set after join; may be `undefined` for spectators)
- **Do not confuse**: `userId` and `playerId` are IDs from different tables.

| Emit function | Signature | Purpose |
|---|---|---|
| `emitSessionUpdated` | `(sessionId, data)` | Broadcast session state to all in room |
| `emitToPlayer` | `(sessionId, playerId, event, data)` | Send to one `SessionPlayer` by ID (negotiations) |
| `emitChatMessage` | `(sessionId, message)` | Broadcast chat message to room |

Redis adapter for multi-instance support (`@socket.io/redis-adapter`). Falls back to in-memory if Redis unavailable. Active socket tracking per user is maintained in Redis (`user:socket:{userId}`) with a local Map fallback — config in `server/src/lib/redis.ts` and `server/src/lib/socket.ts`.

One socket per user — on join, the server disconnects any prior socket for the same `User.id` and emits `force_disconnect` to the old client.

### Zod schemas

Shared schemas in `server/src/shared/schemas/`: currently `auth.schema.ts` and `bau.schema.ts`. Most validation is inline in the controllers (`Schema.parse(req.body)`); add a shared schema only when it's reused.

Avatar/banner constants (preset IDs, etc.) live in `server/src/shared/constants/`.

Client-only schemas live inside `client/src/` and are not shared.

### Data model conventions (read before touching `schema.prisma`)

- **Money is always `Int`** (`saldo`, `valor`, `patrimony`, `saldoInicial`). Never `Float`. Legit exceptions: `rewardMultiplier` (1.0/1.5) and mission counters (`target`/`progress`).
- **`SessionPosses` references `Propriedade` directly** via `propId`. The old `Posses` table (a 1:1 mirror) was removed — do not recreate it. Access the property via `sessionPosses.propriedade.*`.
- **State fields use native Prisma enums** (member name = stored string, no `@map`): `Raridade`, `ShopItemType`, `NegotiationStatus`, `NotificationStatus`, `PurchaseStatus`, `AuditSeverity`, `BauStatus`, `FrameTipo`, `MissionTipo`, `MissionMetric`, `SessionModo`. When a repo receives a `string` from req/query, cast at the Prisma boundary (`status as NegotiationStatus`) rather than propagating the enum type up to callers.
- **Intentionally NOT enums** (don't convert naively): `Session.status` (`"Em Andamento"` has a space + couples with the client), `Card.tipo`/`efeito` (accent + free-form admin content), `Coin/DiamondTransaction.tipo` (the `tipo` column name is overloaded across tables).
- **All FKs are declared** with `@relation` + `onDelete` (optional Session/ShopItem refs use `SetNull`; `Notification.sessionPosses` uses `Cascade`). Don't leave a bare `Int` pointing at another table.
- **Equipped cosmetics** (`User.frame/banner/frametype/frameanimated/frameScale`) are a **denormalized cache** resolved at equip time. When an admin edits a Frame/Banner, propagate the new look to equipped users via `resyncEquippedFrameForUsers`/`resyncEquippedBannerForUsers` (`admin.repository`). Same pragmatic stance as `user_items` (JSONB on `User`, no junction table).

### Migrations — critical gotchas

- **`server/generated/prisma` on the host is root-owned** (generated inside the container). Run `prisma generate`, `tsc`, and migrations **inside the container** or you typecheck against a stale client: `docker compose -f docker-compose.dev.yml exec server npx <cmd>`.
- **Prisma does NOT auto-cast `text→enum`** or alter a populated column's type — it tries to drop/recreate and fails (`No cast exists, the column would be dropped`). Write those migrations **by hand**: `ALTER COLUMN ... DROP DEFAULT; ALTER COLUMN ... TYPE "Enum" USING (col::text::"Enum"); ... SET DEFAULT`. For structural FK changes: add nullable column → `UPDATE` backfill → `SET NOT NULL` → swap constraints. Name the migration folder with a timestamp that sorts **after** the previous one.
- **Before declaring a new FK**, check for orphans (`SELECT ... WHERE NOT EXISTS`) and null/clean them inside the migration, or the constraint creation fails.
- **Verify actual stored values** (`SELECT DISTINCT col`) before defining an enum — schema comments may be stale.

### Admin user

Auto-created on server startup via `seedAdmin()` in `server/src/utils/seed-admin.ts`. Set in root `.env`:
```
ADMIN_EMAIL=admin@gamebank.com
ADMIN_PASSWORD=troque-esta-senha
```
Upsert is idempotent. Omitting the vars silently skips the seed.

## Client Architecture

### State management

Zustand stores in `client/src/stores/` are the single source of truth:
- `authStore.ts` — user auth state. **Do not auto-call `loadFromStorage()` at module level** — only call it from `useEffect` (Header) or explicitly (game page) to avoid hydration mismatches.
- `gameStore.ts` — active session state, updated via Socket.IO
- `socketStore.ts` — socket connection lifecycle
- `negotiationStore.ts` — trade offer state
- `profileStore.ts` — user profile
- `roomTokenStore.ts` — room tokens per session
- `adminStore.ts` / `musicStore.ts`
- `userNotificationStore.ts` — in-app notification state

SWR hooks in `client/src/hooks/useApi/` are used for fetching; Zustand is authoritative.

API calls centralized in `client/src/services/api/` (one file per domain).

### Navigation

UserNav bottom nav has 5 tabs (grid-cols-5): Dashboard, Cofre, Loja, Recompensas, Ranking. Perfil was removed from the navbar — it's only accessible by clicking the user avatar in the header (desktop and mobile).

### Animation stack

| Library | Usage |
|---|---|
| Framer Motion `^12` | `AnimatePresence` only — modals, bottom sheets, toasts, dropdowns, page transitions |
| GSAP `^3` + `@gsap/react` | Staggers, timelines, progress bars, infinite loops, `BauAbertura` phases. Use `useGSAP` from `@gsap/react` or plain `useEffect + useRef + gsap.*` |
| CSS / Tailwind | `animate-spin`, `hover:scale-*`, `transition-colors` |
| `tw-animate-css` | `animate-in/out`, `fade-in-0`, `zoom-in-95` (Radix UI patterns) |
| `canvas-confetti` | Celebration effects |
| `lenis` | Smooth scroll |

Reusable Framer Motion variants (`backdrop`, `modalBox`, `slideUp`, `fadeIn`, `staggerContainer`, `staggerItem`) are centralized in `client/src/lib/animations.ts`. Import from there instead of defining inline.

### Next.js App Router rules

- **Every component using hooks (`useState`, `useEffect`, `useRouter`, Zustand stores) needs `'use client'` at the top.** Without it, Zustand subscriptions are not set up — component renders once with initial state and never updates.
- Public env vars (`NEXT_PUBLIC_*`) are injected via `environment:` in `docker-compose.dev.yml` reading from the root `.env`. To expose a new var: add to root `.env` + `.env.example` + the `client` service `environment:` block in compose. The client has no `.env.local`.

### Z-index hierarchy

| Layer | Value | Examples |
|---|---|---|
| Fixed navbars | `z-40` | `SiteBottomNav`, `GameBottomNav` |
| Header | `z-100` | `Header` |
| Modals / full-screen overlays | `z-[200]` | `EditProfileModal`, `Modal`, `ConfirmationModal`, `PodiumModal`, `MobileMenu`, `Loading` |
| Toast | `z-[100000]` | `ToastProvider` |

New full-screen overlays must use `z-[200]`. Using `z-50` will place them behind the Header.

## Dead files (do not delete — kept for reference)

| File | Reason kept |
|---|---|
| `client/src/components/BadgeCollection/index.tsx` | Replaced by Cofre (`/user/cofre`) |
| `client/src/components/Header/index.tsx` | Replaced by `UserNav` + `LandingHeader` |
| `client/src/components/MobileMenu/index.tsx` | Unused |
| `client/src/components/PlayerCard/index.tsx` | Replaced by local version in game page |
| `client/src/components/Title1/index.tsx` | Unused |
| `client/src/components/ui/button.tsx` | shadcn/ui — unused |
| `client/src/components/ui/dropdown-menu.tsx` | shadcn/ui — unused |
| `client/src/components/ui/select.tsx` | shadcn/ui — unused |
| `client/src/lib/asyncAction.ts` | Never imported |
| `client/src/hooks/useBannerCatalog.ts` | Never imported |
| `client/src/constants/badges.ts` | Never imported |
| `INSTRUCOES.md` (root) | Obsolete design notes / terminal log |
| `ANIMACOES.md` (root) | Animation implementation plan — already executed |
| `GameBank Design System/` (root) | Design mockups |
| `screenshots/` (root) | Unreferenced screenshots |

## Conventions

| What | Pattern |
|---|---|
| Files | `kebab-case` |
| Classes | `PascalCase` |
| Functions / variables | `camelCase` |
| Zod schemas | `PascalCase + Schema` |
| Business errors | `AppError(statusCode, message)` |
| Imports | alphabetical: external → internal → types |
| Commits | `feat:` / `fix:` / `refactor:` / `docs:` — run build before committing |

## Known pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Landing page broken on F5 (huge/inert buttons) | `authStore.loadFromStorage()` at module level causes hydration mismatch | Only call from `useEffect` |
| `ERR_NETWORK` on `loadSession` with no HTTP response | `authenticateRoom` async middleware without try/catch — Express 4 doesn't handle async rejections | Wrap middleware body in try/catch |
| 429/Network Error on all `/api` routes | `rate-limit-redis` incompatible + `passOnError` missing in express-rate-limit v8.5.2 | Use in-memory store, no `passOnError` |
| `setMessages is not a function` | Zustand store created before hot-reload; new method missing | Use `useXxxStore.setState()` instead of store method |
| `ERR_ERL_KEY_GEN_IPV6` in rate limiter | `keyGenerator` passing `req.ip` directly — v8 requires the helper | `ipKeyGenerator(req.ip ?? "")` — takes `string` not `Request` |
| Import `Cannot find module '…/lib/cloudinary.js'` | Wrong relative path after moving file | Count `../` from `modules/avatar/` → `../../lib/` |

## CSP (helmet)

`server/src/index.ts` configures `connect-src` with `http://localhost:7000` and `https://gamebank-vtsb.onrender.com`. **Do not remove** — browsers block API calls with "Network Error" if this is missing.

## Cloudinary avatar upload flow

1. Client sends `multipart/form-data` with `avatar` field
2. `avatarUpload` middleware (multer, memory) receives buffer
3. `validateAndProcessAvatar` (`server/src/lib/image-validation.ts`) validates MIME and resizes
4. `uploadAvatarToCloudinary` (`avatar.service.ts`) uploads and returns `{ url, publicId }`
5. Service saves `avatarUrl` + `avatarPublicId` + `avatarUpdatedAt` to DB
6. If DB fails after upload, `rollbackCloudinaryUpload` removes the orphaned file

Required vars: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_AVATAR_FOLDER` (default: `gamebank/avatars`).

Alternative: avatar preset (string `preset:<id>`) skips Cloudinary entirely.
