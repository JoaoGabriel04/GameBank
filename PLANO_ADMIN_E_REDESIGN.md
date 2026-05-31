# Plano: Painel Admin + Redesign Perfil & Recompensas

---

## Visão geral

Três entregas independentes, em ordem de execução recomendada:

1. **Backend admin** — campo `isAdmin` no User, seed, middleware e rotas protegidas
2. **Página de admin** (Next.js) — CRUD de itens da loja, gestão de tipos, preview
3. **Redesign Perfil & Recompensas** — mesma linguagem visual da nova Loja

---

## Parte 1 — Backend Admin

### 1.1 Prisma — adicionar `isAdmin` ao model User

**Arquivo:** `server/prisma/schema.prisma`

Adicionar campo no model `User`, após `profileComplete`:
```prisma
isAdmin  Boolean  @default(false)
```

Gerar e aplicar migration:
```bash
cd server
npx prisma migrate dev --name add_is_admin
```

---

### 1.2 Seed admin — `server/prisma/seed.ts` (criar arquivo novo)

Lê `ADMIN_EMAIL` e `ADMIN_PASSWORD` da `.env` e cria/atualiza o usuário admin.

```ts
import { PrismaClient } from "../generated/prisma/index.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn("[seed] ADMIN_EMAIL ou ADMIN_PASSWORD não definidos — pulando seed de admin.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { isAdmin: true, passwordHash },
    create: {
      email,
      nome: "Admin",
      passwordHash,
      isAdmin: true,
      profileComplete: true,
    },
  });

  console.log(`[seed] Admin garantido: ${admin.email} (id=${admin.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

Registrar o seed no `server/package.json`:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

Executar:
```bash
cd server && npx prisma db seed
```

---

### 1.3 `.env.example` — adicionar variáveis de admin

Adicionar ao final do arquivo `/home/user/GameBank/.env.example`:
```env
# ─── Admin ──────────────────────────────
ADMIN_EMAIL=admin@gamebank.com
ADMIN_PASSWORD=troque-esta-senha
```

---

### 1.4 JWT — incluir `isAdmin` no payload

**Arquivo:** `server/src/lib/jwt.ts`

Alterar interface e funções para carregar `isAdmin`:

```ts
export interface JwtPayload {
  userId: number;
  email: string;
  isAdmin: boolean;   // ← adicionar
}
```

Em `signToken`, receber `isAdmin` e incluir no payload.

**Arquivo:** `server/src/modules/auth/auth.service.ts` (ou onde `signToken` é chamado)

Passar `isAdmin: user.isAdmin` ao gerar o token.

---

### 1.5 Middleware `requireAdmin`

**Arquivo novo:** `server/src/middleware/admin.middleware.ts`

```ts
import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Acesso restrito a administradores." });
  }
  next();
}
```

---

### 1.6 Rotas admin — CRUD de ShopItems

**Arquivo novo:** `server/src/api/routes/admin.route.ts`

Rotas protegidas por `authenticate` + `requireAdmin`:

| Método | Rota | Ação |
|--------|------|------|
| `GET` | `/admin/shop/items` | Listar todos os itens (incluindo indisponíveis) |
| `POST` | `/admin/shop/items` | Criar novo item |
| `PATCH` | `/admin/shop/items/:id` | Editar item existente |
| `DELETE` | `/admin/shop/items/:id` | Remover item permanentemente |
| `PATCH` | `/admin/shop/items/:id/toggle` | Alternar `available` (ativar/desativar) |
| `GET` | `/admin/users` | Listar usuários (id, nome, email, isAdmin, coins, level) |
| `PATCH` | `/admin/users/:id/coins` | Ajustar coins de um usuário manualmente |

**Payload de criação/edição de item:**
```ts
{
  name: string;        // ex: "Lendário"
  description: string; // ex: "Título exclusivo para os melhores"
  price: number;       // em GameCoins
  type: "title" | "badge" | "color";
  value?: string;      // valor aplicado (cor hex, slug do título, etc.)
  icon?: string;       // nome de ícone FontAwesome ou URL
  available: boolean;
}
```

**Arquivo novo:** `server/src/modules/admin/admin.controller.ts`
**Arquivo novo:** `server/src/modules/admin/admin.service.ts`
**Arquivo novo:** `server/src/modules/admin/admin.repository.ts`

Registrar em `server/src/api/routes/index.ts`:
```ts
import adminRouter from "./admin.route.js";
apiRouter.use("/admin", adminRouter);
```

---

## Parte 2 — Página Admin (Next.js)

### Estrutura de arquivos a criar no cliente

```
client/src/app/admin/
  page.tsx              ← guard: redireciona se não for admin
  layout.tsx            ← sidebar lateral + header admin

client/src/app/admin/loja/
  page.tsx              ← CRUD de itens da loja

client/src/services/api/
  admin.ts              ← funções de API para as rotas /admin/*

client/src/stores/
  adminStore.ts         ← estado global do painel (itens, users, loading)
```

---

### 2.1 Guard de acesso — `client/src/app/admin/page.tsx`

- Verifica `user.isAdmin` via `useAuthStore`
- Se falso: redireciona para `/` com toast de erro
- Se verdadeiro: redireciona para `/admin/loja`

O campo `isAdmin` precisa ser adicionado à interface `AuthUser` em `authStore.ts`.

---

### 2.2 Layout admin — `client/src/app/admin/layout.tsx`

Sidebar fixa à esquerda (desktop) / bottom nav (mobile) com as seções:
- **Loja** (ícone `ShoppingBag`)
- **Usuários** (ícone `Users`)

Header com: logo GameBank, badge "ADMIN", nome do usuário, botão voltar ao site.

Mesmo tema escuro `zinc-950` da nova loja.

---

### 2.3 Página de gerenciamento da Loja — `client/src/app/admin/loja/page.tsx`

#### Layout da página

```
┌─────────────────────────────────────────────────────┐
│  🏪 Itens da Loja          [ + Novo Item ]           │
│  ─────────────────────────────────────────────────  │
│  Filtros: [ Todos ] [ Títulos ] [ Emblemas ] [Cores] │
│           [ Ativos ] [ Inativos ]                    │
│  ─────────────────────────────────────────────────  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │  [card]    │ │  [card]    │ │  [card]    │       │
│  └────────────┘ └────────────┘ └────────────┘       │
└─────────────────────────────────────────────────────┘
```

#### Card de item no painel admin

Reutiliza a linguagem visual da nova Loja (gradiente por tipo, glow), com ações adicionais:
- Toggle de disponibilidade (switch visual: ativo/inativo)
- Botão editar (abre modal)
- Botão excluir (com confirmação inline)
- Badge com contagem de usuários que possuem o item: `12 owners`

#### Modal de criação/edição de item

Campos:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| Nome | text | Nome do item |
| Descrição | textarea | Descrição curta |
| Tipo | select | `title` / `badge` / `color` |
| Preço | number | GameCoins |
| Valor | text | O que o item aplica (cor hex `#ff6600`, slug `lendario`, etc.) |
| Ícone | text | Nome do ícone FA ou URL de imagem |
| Disponível | toggle | Se aparece na loja |

Preview ao vivo do card (à direita do formulário no desktop) usando o mesmo `ShopItemCard` da loja, atualizado em tempo real conforme o usuário digita.

#### UX do CRUD

- **Criar**: botão `+ Novo Item` abre o modal em modo criação
- **Editar**: clique no ícone de lápis no card abre o modal preenchido
- **Toggle ativo/inativo**: clique no switch do card, otimista (atualiza UI antes do servidor confirmar)
- **Excluir**: clique no ícone de lixeira → aparece confirmação inline no card ("Confirmar exclusão?") com botões Sim/Não, sem modal separado
- Feedback com o mesmo banner animado (`CheckCircle` / `XCircle`) da nova loja

---

### 2.4 Página de usuários — `client/src/app/admin/usuarios/page.tsx`

Tabela com: Avatar · Nome · Email · Nível · Coins · Badge Admin · Ações

Ação disponível: **Ajustar coins** — inline, abre um campo numérico no próprio row da tabela para adicionar/remover coins.

---

## Parte 3 — Redesign Perfil & Recompensas

### 3.1 Perfil — `client/src/app/perfil/page.tsx`

#### O que muda

| Elemento atual | Novo design |
|---------------|-------------|
| Fundo `zinc-900` liso | `zinc-950` com glow decorativo verde/esmeralda no topo |
| Card de perfil `zinc-800` simples | Card com banner em full-width, avatar com ring colorida, nome em `font-jaro` maior |
| XP bar verde sólida | Barra com gradiente `from-green-500 to-emerald-400`, label de nível mais destacado |
| Stats em 3 cards `zinc-800` | Stats com ícone grande colorido, número em `font-jaro text-2xl`, label `font-inconsolata` |
| Itens equipados como pills `zinc-700` | Grid de mini-cards com gradiente por tipo (igual à loja) |
| Missões: lista plana | Cards com ícone de progresso, barra colorida (azul = em andamento, verde = concluída), recompensa visível |
| Histórico: rows simples | Rows com posição numerada em destaque, patrimônio, XP e coins ganhos em badges coloridos |

#### Estrutura visual esperada

```
┌─────────────────────────────────┐
│ [Banner full-width com gradiente]│  ← UserBanner existente, sem mudança de lógica
│   [Avatar]  Nome        ✏  ⚙  │
│            Título verde          │
│            Lv.12 · #42           │
│ ─────────────────────────────── │
│ ████████████████░░░  78% XP     │
│ ─────────────────────────────── │
│  🎮 32      👑 8       🏆 14   │
│ Partidas  Vitórias    Top 3      │
│ ─────────────────────────────── │
│  ⚡ Itens Equipados              │
│  [card violet] [card cyan]       │
│ ─────────────────────────────── │
│  📋 Missões                      │
│  [card missão com progresso]     │
│ ─────────────────────────────── │
│  🕐 Histórico                    │
│  [row com posição + earnings]    │
└─────────────────────────────────┘
```

---

### 3.2 Recompensas — `client/src/app/recompensas/page.tsx`

#### O que muda

| Elemento atual | Novo design |
|---------------|-------------|
| Tabs `zinc-800` com `bg-green-600` ativo | Tabs em pills brancos/escuros (igual aos filtros da loja) |
| Cards de missão `zinc-800` com ring verde | Cards com ícone temático por tipo de missão, barra de progresso gradiente, badge de recompensa |
| Ranking: rows simples | **Top 3 com cards grandes destacados** (1º ouro, 2º prata, 3º bronze) + lista normal para o restante |
| Modal de player: `zinc-800` simples | Modal com banner real do player, stats em cards destacados, itens equipados visíveis |

#### Ranking — layout especial para Top 3

```
        ┌─────────┐
        │  🥇 #1  │  ← card maior, borda dourada, glow
        │ [avatar]│
        │  Nome   │
        └─────────┘
  ┌───────┐     ┌───────┐
  │ 🥈 #2 │     │ 🥉 #3 │  ← cards médios
  └───────┘     └───────┘

  #4  Nome ....... XP
  #5  Nome ....... XP
  ...
```

#### Missões — ícone por métrica

| Métrica (`metric`) | Ícone |
|---------------------|-------|
| `properties_bought` | `faBuilding` |
| `houses_built` | `faHouse` |
| `rent_earned` | `faCoins` |
| `games_played` | `faGamepad` |
| `wins` | `faCrown` |
| `top3` | `faTrophy` |

---

## Ordem de execução recomendada

```
1. server/prisma/schema.prisma      ← adicionar isAdmin
2. npx prisma migrate dev           ← gerar migration
3. server/prisma/seed.ts            ← criar seed admin
4. server/package.json              ← registrar prisma.seed
5. .env.example                     ← adicionar ADMIN_EMAIL / ADMIN_PASSWORD
6. server/src/lib/jwt.ts            ← isAdmin no JwtPayload
7. server/src/modules/auth/         ← passar isAdmin no signToken
8. server/src/middleware/admin.middleware.ts   ← requireAdmin
9. server/src/modules/admin/        ← controller + service + repository
10. server/src/api/routes/admin.route.ts      ← rotas CRUD
11. server/src/api/routes/index.ts  ← registrar adminRouter
12. client/src/stores/authStore.ts  ← adicionar isAdmin à interface AuthUser
13. client/src/services/api/admin.ts          ← funções de API
14. client/src/stores/adminStore.ts           ← estado Zustand do admin
15. client/src/app/admin/layout.tsx           ← layout sidebar
16. client/src/app/admin/page.tsx             ← guard redirect
17. client/src/app/admin/loja/page.tsx        ← CRUD visual
18. client/src/app/perfil/page.tsx            ← redesign
19. client/src/app/recompensas/page.tsx       ← redesign
```

---

## Notas de implementação

- **Não criar rotas públicas** para os endpoints `/admin/*` — sempre checar `requireAdmin` após `authenticate`
- **Seed idempotente**: usar `upsert` no seed para que rodar múltiplas vezes não quebre nada
- **Preview ao vivo no modal de item**: reutilizar o componente `ShopItemCard` já criado na loja, passando os valores do form como props diretamente
- **Toggle otimista**: atualizar estado local imediatamente ao desativar/ativar item, reverter em caso de erro
- **isAdmin no JWT**: ao relogar após o seed, o token já carregará `isAdmin: true` — não precisa mecanismo extra de refresh
- **Proteção no cliente**: o guard em `/admin/page.tsx` é uma UX layer, não segurança real — a segurança real está no `requireAdmin` do servidor