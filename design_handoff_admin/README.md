# Admin Console - Design Handoff

**Data:** 2026-06-01  
**Versão:** 1.0  
**Status:** Pronto para implementação

## 📋 Visão Geral

Redesign completo do painel admin do sgpController, transformado em um **console de operações denso e técnico** com:

- ✅ Sidebar rica com navegação por área (Visão Geral, Jogo ao Vivo, Comunidade, Conteúdo, Sistema)
- ✅ Dashboard com KPIs, gráficos, sessões ao vivo em tempo real
- ✅ Controle de sessões ao vivo (editar saldos, remover jogadores, pausar/encerrar)
- ✅ Gestão avançada de usuários (admin, nível/XP, itens, banir)
- ✅ Loja reformulada com CRUD visual
- ✅ Editor de cartas (Sorte/Revés)
- ✅ Economia global (saldo inicial, multiplicadores, simulador)
- ✅ Cosméticos (banner builder, sprite library)
- ✅ Log de auditoria filtrável
- ✅ Comando rápido (⌘K) para navegação

**Paleta:** Tons escuros (zinc-950/900) + acento ciano/teal (cyan-500)  
**Tipografia:** Jaro (displays) + Inconsolata (mono/dados)  
**Componentes:** Baseado em Lucide Icons

---

## 🎨 Tokens de Design

Todos em `tokens/design-tokens.ts` (pronto para colar):

### Cores
```
Primary: #06B6D4 (cyan-500)
Surface: #18181B (zinc-900)
Bg: #09090B (zinc-950)
Border: #27272A (zinc-800)
Text Primary: #F4F4F5 (zinc-100)
Text Secondary: #A1A1AA (zinc-500)
Success: #22C55E (green-500)
Warning: #F97316 (orange-500)
Error: #EF4444 (red-500)
```

### Tipografia
```
Display: Jaro (opsz: 72)
Body: Inter (14px)
Mono: Inconsolata (wght: 400/700)
```

### Spacing & Radii
```
Radius: 8px (sm), 12px (md), 16px (lg)
Gap: 2, 4, 8, 12, 16px
Shadow: rgba(0,0,0,0.3) offset 0 4px 6px
```

---

## 📱 Estrutura de Abas

### 1. Dashboard
**Arquivo:** `src/app/admin/page.tsx`

**Componentes:**
- KPI cards (4 itens): Usuários Ativos, Sessões ao Vivo, Receita Hoje, Top Jogador
- Gráfico: Crescimento 30d (linha dupla: usuários + receita)
- Donut: Distribuição da loja (itens vendidos por tipo)
- Tabela: Sessões ao vivo com status (jogadores, saldo total, duração)
- Feed: Atividade recente (últimas 10 ações)

**Estado esperado:** Recarrega a cada 30s (ou WebSocket)

---

### 2. Sessões ao Vivo
**Arquivo:** `src/app/admin/sessions/page.tsx`

**Componentes:**
- Filtro: Status (Todas, Esperando, Em Andamento, Finalizada)
- Tabela: ID, Nome, Modo, Jogadores, Saldo Total, Duração, Ações
- Drawer ao clicar: Painel de controle
  - Cada jogador: avatar, nome, saldo, ±botões rápidos, remover, kick
  - Ações gerais: pausar, encerrar, força saldo para todos

**APIs necessárias:**
- `GET /api/admin/sessions?status=...` (lista)
- `PATCH /api/admin/sessions/:id/player/:playerId/balance` (editar saldo)
- `PATCH /api/admin/sessions/:id/player/:playerId/kick` (remover)
- `PATCH /api/admin/sessions/:id/pause` (pausar)

---

### 3. Usuários
**Arquivo:** `src/app/admin/users/page.tsx`

**Componentes:**
- Filtro: Busca, Status (Ativo, Inativo, Banido), Role (User, Admin)
- Tabela: ID, Avatar, Nome, Email, Level, XP, Coins, Role, Banido, Ações
- Drawer ao clicar: Painel avançado
  - Sliders: Coins, Level, XP
  - Inventário: Listar items (equipped badge/title, outros)
  - Toggles: Admin, Banido
  - Ações: Deletar, Logs de atividade deste user

**APIs necessárias:**
- `GET /api/admin/users?search=...&role=...&status=...` (lista)
- `PATCH /api/admin/users/:id` (atualizar coins/level/xp/admin/ban)
- `GET /api/admin/users/:id/activity` (log)

---

### 4. Loja
**Arquivo:** `src/app/admin/shop/page.tsx`

**Componentes:**
- Filtro: Tipo (Todos, Títulos, Emblemas)
- Grid: Cards por item
  - Ícone/Preview (do badge/title real)
  - Nome, Descrição
  - Preço, Vendas, Ação (Editar)
- Botão: "+ Novo Item"
- Modal: Criar/Editar
  - Nome, Descrição, Tipo, Preço, Ícone, Value (JSON)
  - Preview ao vivo
  - Salvar/Deletar

**APIs necessárias:**
- `GET /api/admin/shop` (lista)
- `POST /api/admin/shop` (criar)
- `PATCH /api/admin/shop/:id` (editar)
- `DELETE /api/admin/shop/:id` (deletar)

---

### 5. Cartas (Sorte/Revés)
**Arquivo:** `src/app/admin/cards/page.tsx`

**Componentes:**
- Filtro: Tipo (Sorte, Revés)
- Tabela: ID, Texto, Efeito, Valor, Ações
- Botão: "+ Nova Carta"
- Modal: Criar/Editar
  - Tipo, Texto, Efeito (ganhar_dinheiro, etc)
  - Valor
  - Preview da carta (estilo jogo)
  - Salvar/Deletar

**APIs necessárias:**
- `GET /api/admin/cards?type=...` (lista)
- `POST /api/admin/cards` (criar)
- `PATCH /api/admin/cards/:id` (editar)
- `DELETE /api/admin/cards/:id` (deletar)

---

### 6. Missões
**Arquivo:** `src/app/admin/missions/page.tsx`

**Componentes:**
- Tabela: Nome, Métrica, Target, XP Reward, Coins Reward, Ações
- Botão: "+ Nova Missão"
- Modal: Criar/Editar
  - Nome, Descrição
  - Métrica (properties_bought, houses_built, etc)
  - Target, XP Reward, Coins Reward
  - Salvar/Deletar

**APIs necessárias:**
- `GET /api/admin/missions` (lista)
- `POST /api/admin/missions` (criar)
- `PATCH /api/admin/missions/:id` (editar)
- `DELETE /api/admin/missions/:id` (deletar)

---

### 7. Economia Global
**Arquivo:** `src/app/admin/economy/page.tsx`

**Componentes:**
- Painel 1: Configurações
  - Saldo inicial (slider 10k-50k)
  - Multiplicadores (XP, Coins, House costs)
  - Flags: economia afetada por sessões longas?
- Painel 2: Simulador de Recompensa
  - Input: XP ganho
  - Output: Coins esperados (com multiplicador)
  - Gráfico: Curva de recompensa
- Painel 3: Histórico de mudanças (auditoria de economia)

**APIs necessárias:**
- `GET /api/admin/economy` (config atual)
- `PATCH /api/admin/economy` (atualizar)
- `GET /api/admin/economy/history` (auditoria)

---

### 8. Cosméticos
**Arquivo:** `src/app/admin/cosmetics/page.tsx`

**Componentes:**
- Seção 1: Banner Builder
  - Upload de imagem ou URL
  - Preview (aspect ratio do banner no jogo)
  - Gerenciar banners (listar, deletar, preço)
- Seção 2: Sprite Library
  - Grid de sprites disponíveis (com tags)
  - Upload de novo sprite
  - Deletar

**APIs necessárias:**
- `GET /api/admin/cosmetics/banners` (lista)
- `POST /api/admin/cosmetics/banners` (upload)
- `DELETE /api/admin/cosmetics/banners/:id`
- `GET /api/admin/cosmetics/sprites` (lista)
- `POST /api/admin/cosmetics/sprites` (upload)
- `DELETE /api/admin/cosmetics/sprites/:id`

---

### 9. Auditoria
**Arquivo:** `src/app/admin/audit/page.tsx`

**Componentes:**
- Filtro: Tipo (Usuário, Sessão, Economia, Loja, Missão)
- Filtro: Data range
- Tabela: Timestamp, Tipo, Ator (admin), Ação, Detalhes, Alteração
- Expandível: Ver JSON completo da alteração

**APIs necessárias:**
- `GET /api/admin/audit?type=...&from=...&to=...` (lista)

---

## 🔌 APIs Necessárias (Backend)

### Endpoints Novos ou Estendidos

```
GET    /api/admin/dashboard          → KPIs, gráficos
GET    /api/admin/sessions?status=   → lista com tempo real
PATCH  /api/admin/sessions/:id/player/:pid/balance
PATCH  /api/admin/sessions/:id/player/:pid/kick
PATCH  /api/admin/sessions/:id/pause|end
GET    /api/admin/users?search=...   → lista avançada
PATCH  /api/admin/users/:id          → coins, level, xp, admin, ban
GET    /api/admin/users/:id/activity → log
GET    /api/admin/shop
POST   /api/admin/shop
PATCH  /api/admin/shop/:id
DELETE /api/admin/shop/:id
GET    /api/admin/cards?type=
POST   /api/admin/cards
PATCH  /api/admin/cards/:id
DELETE /api/admin/cards/:id
GET    /api/admin/missions
POST   /api/admin/missions
PATCH  /api/admin/missions/:id
DELETE /api/admin/missions/:id
GET    /api/admin/economy
PATCH  /api/admin/economy
GET    /api/admin/economy/history
GET    /api/admin/cosmetics/banners
POST   /api/admin/cosmetics/banners  → multipart/form-data
DELETE /api/admin/cosmetics/banners/:id
GET    /api/admin/cosmetics/sprites
POST   /api/admin/cosmetics/sprites  → multipart/form-data
DELETE /api/admin/cosmetics/sprites/:id
GET    /api/admin/audit?type=...&from=...&to=...
```

---

## 🏗️ Stack da Implementação

**Seu stack atual:**
- Next.js 16 (App Router)
- TypeScript
- Tailwind v4
- Prisma
- Lucide Icons

**O que muda:**
- Sidebar expande de `AdminNav` para componente rico
- Cada aba = rota `src/app/admin/<tab>/page.tsx`
- Componentes reutilizáveis: `Table`, `Modal`, `Drawer`, `Chart`, `KpiCard` em `src/components/admin/`
- Context: `AdminContext` para estado compartilhado (sessões ao vivo, filtros)
- API: Novos endpoints em `src/app/api/admin/` (ou expanda `services/api/admin.ts`)

---

## 📐 Componentes Principais (TSX)

Você criará em `src/components/admin/`:

```
AdminLayout.tsx          → Sidebar + Topbar + Outlet
AdminNav.tsx             → Sidebar rico com navegação
AdminTopbar.tsx          → Título, ⌘K, user menu
AdminTable.tsx           → Tabela genérica (sortável, paginável)
AdminModal.tsx           → Modal genérica
AdminDrawer.tsx          → Drawer lateral (sessões, usuários)
AdminChart.tsx           → Wrapper para Chart.js/Recharts
KpiCard.tsx              → Card com métrica e sparkline
StatusBadge.tsx          → Badge de status (ao vivo, parado, etc)
```

---

## 🎬 Fluxo de Implementação (Ordem)

1. **Sidebar + Layout** (AdminLayout, AdminNav, AdminTopbar)
2. **Dashboard** (KpiCard, Chart, mock data)
3. **Tabelas genéricas** (AdminTable, StatusBadge)
4. **Sessões ao vivo** (AdminDrawer, live control)
5. **Usuários avançado** (sliders, inventário)
6. **Loja** (Modal CRUD, preview)
7. **Cartas, Missões** (similar à Loja)
8. **Economia** (gráfico simulador)
9. **Cosméticos** (upload, preview)
10. **Auditoria** (filtro, expansível)

---

## ⚡ Notas Importantes

### Estado em Tempo Real
- Dashboard e Sessões precisam de **polling (30s)** ou **WebSocket** para dados live
- Se WebSocket, monta um socket em context e subscreve cada aba
- Se polling, use `setInterval` em `useEffect` com limpeza

### Validação Backend
- Endpoints devem validar `adminGuard()` (já tem no seu código)
- Auditoria: registre TODA mudança com `actor_id`, `action`, `before/after`

### Mobile
- Sidebar: collapse em mobile, menu hamburger
- Modals/Drawers: fullscreen em mobile
- Tabelas: scroll horizontal ou collapse de colunas

### Implementar Agora vs Depois
**Agora:**
- Sidebar, Dashboard, Tabelas, Loja básico
- Usuários com edição simples

**Depois:**
- Controle ao vivo de sessões (precisa WebSocket)
- Editor visual de cartas
- Cosméticos com upload real

---

## 📸 Screenshots

Veja a pasta `screenshots/` para cada aba renderizada.

---

## 🚀 Próximos Passos

1. Leia `tokens/design-tokens.ts` e coloque em seu `globals.css`
2. Crie `src/components/admin/` e comece por `AdminLayout.tsx`
3. Para cada aba, consulte sua seção acima
4. Implemente endpoints conforme necessário
5. Teste com dados reais do seu `schema.prisma`

Qualquer dúvida de implementação, Claude Code tem acesso a este documento inteiro.

---

**Gerado:** 2026-06-01  
**Prototipado em:** Claude Design (navegável em `gamebank-design-system/project/ui_kits/game-app/admin-console.html`)
