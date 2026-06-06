# Plano de Animações e Transições — GameBank

## Stack de Animação

| Biblioteca | Uso | Estratégia |
|---|---|---|
| **Framer Motion** | Novas animações (modais, toasts, lists, tabs, páginas) | Padrão para tudo novo |
| **GSAP** | `Modal`, `MobileMenu` componentes | Manter como está (já funcionam) |
| **CSS/Tailwind** | `animate-spin`, `animate-slide-in`, `hover:scale-*`, `transition-colors` | Manter como está |
| **tw-animate-css** | `animate-in/out`, `fade-in-0`, `zoom-in-95` (Radix UI) | Manter como está |

### Bibliotecas instaladas
- `framer-motion ^12.23.22`
- `gsap ^3.15.0`
- `tw-animate-css ^1.4.0`
- `canvas-confetti ^1.9.4`
- `lenis ^1.3.23`

---

## Base: `client/src/lib/animations.ts`

Arquivo central com variants Framer Motion reutilizáveis.

```ts
import type { Variants } from "framer-motion";

export const backdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalBox: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", damping: 25, stiffness: 300 } },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: "100%" },
  visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 30, stiffness: 300 } },
  exit: { opacity: 0, y: "100%", transition: { duration: 0.2 } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 20, stiffness: 200 } },
};
```

---

## Fase 1 — Modais e Overlays

### 1.1 `ConfirmationModal/index.tsx`

**Antes**: `if (!isOpen) return null`, CSS `animate-fade-in`.
**Depois**: `AnimatePresence` + `motion.div` com `backdrop` + `modalBox` variants.

- Import: `{ motion, AnimatePresence }` de `framer-motion`
- Import: `{ backdrop, modalBox }` de `@/lib/animations`
- Remover linha `if (!isOpen) return null`
- Envolver JSX com `<AnimatePresence>{isOpen && (JSX)}</AnimatePresence>`
- Backdrop: `<motion.div variants={backdrop} initial="hidden" animate="visible" exit="exit" />`
- Box: `<motion.div variants={modalBox} initial="hidden" animate="visible" exit="exit" />`
- Manter todo o resto (classes, lógica, cores)

### 1.2 `user/UserUI.tsx` — UModal

**Antes**: `if (!open) return null`, sem animação, `z-50`.
**Depois**: `AnimatePresence` + `backdrop` + `modalBox`. Corrigir `z-50` → `z-[200]`.

- Import: `{ motion, AnimatePresence }` de `framer-motion`
- Import: `{ backdrop, modalBox }` de `@/lib/animations`
- Remover `if (!open) return null`
- Envolver JSX com `<AnimatePresence>{open && (JSX)}</AnimatePresence>`
- Backdrop: `motion.div` com variants
- Box: `motion.div` com variants
- Trocar `z-50` no backdrop e box para `z-[200]`

### 1.3 `EditProfileModal/index.tsx`

**Antes**: `if (!isOpen) return null`, sem animação.
**Depois**: `AnimatePresence` + `backdrop` + `modalBox`. `useEffect` que reseta estado mantido.

- Import: `{ motion, AnimatePresence }` de `framer-motion`
- Import: `{ backdrop, modalBox }` de `@/lib/animations`
- Remover `if (!isOpen) return null`
- Envolver JSX com `<AnimatePresence>{isOpen && (JSX)}</AnimatePresence>`
- Backdrop: `motion.div` com variants ← onClick={onClose} mantido
- Box: `motion.div` com variants ← onClick prevent default mantido

### 1.4 `Loading/index.tsx`

**Decisão**: Manter simples. Não vale o custo de mudar todos os pais (5+ arquivos) que fazem `{cond && <Loading />}`. Adicionar apenas `animate-fade-in` no container (já provido por `tw-animate-css`).

- Trocar `bg-black/70` por: fade-in entry animation via `animate-fade-in` no wrapper
- Ou usar `motion.div` com entry simples (sem exit, já que o pai desmonta)

### 1.5 `Modal/index.tsx` (GSAP)

**Não mexer.** Já tem animação GSAP funcional com enter (scale + fade) e exit (onComplete callback).

---

## Fase 2 — Toast Exit Animation

### 2.1 `Toast/ToastProvider.tsx`

**Antes**: `animate-slide-in` na entrada, sem animação de saída (remove instantaneamente via `setTimeout`).
**Depois**: `AnimatePresence` no container + `layout` + stagger + exit animation.

- Import: `{ motion, AnimatePresence }` de `framer-motion`
- Import: `{ staggerContainer, staggerItem }` de `@/lib/animations`
- Container: `<AnimatePresence>` com `mode="popLayout"` (permite sair sem travar entrada)
- Container wrapper: `<motion.div variants={staggerContainer} initial="hidden" animate="visible">`
- Cada toast: `<motion.div variants={staggerItem} layout>` com exit animado (opacidade 0, x: 50)
- `setTimeout` continua removendo do array (4s), `AnimatePresence` cuida do exit visual
- Botão X: `removeToast(id)` remove instantaneamente, exit anima

---

## Fase 3 — Listas com Stagger

### Padrão geral
```tsx
import { staggerContainer, staggerItem } from "@/lib/animations";
import { motion } from "framer-motion";

<motion.div variants={staggerContainer} initial="hidden" animate="visible" exit="hidden">
  {items.map(item => (
    <motion.div key={item.id} variants={staggerItem}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

### 3.1 Dashboard — LiveSessions cards
- **Arquivo**: `client/src/app/user/(main)/page.tsx`
- **Container**: `motion.div` em volta do `.map` horizontal
- **Cada card**: `motion.div` com `staggerItem`
- **key**: session.id

### 3.2 Dashboard — MissionsPreview list
- **Arquivo**: `client/src/app/user/(main)/page.tsx`
- **Container**: `motion.div` em volta do `.map` de missões ativas
- **Cada item**: `motion.div` com `staggerItem`

### 3.3 Dashboard — RecentGames list
- **Arquivo**: `client/src/app/user/(main)/page.tsx`
- **Container**: `motion.div` em volta do `.map` de resultados
- **Cada item**: `motion.div` com `staggerItem`

### 3.4 Perfil — StatsRow grid
- **Arquivo**: `client/src/app/user/(main)/perfil/page.tsx`
- **Container**: `motion.div` grid
- **Cada stat**: `motion.div` com `staggerItem`

### 3.5 Perfil — MatchHistory list
- **Arquivo**: `client/src/app/user/(main)/perfil/page.tsx`
- **Container**: `motion.div`
- **Cada match**: `motion.div` com `staggerItem`

### 3.6 Sessions — SessionCard grid
- **Arquivo**: `client/src/app/user/(main)/sessions/page.tsx`
- **Container**: `motion.div` grid
- **Cada card**: `motion.div` com `staggerItem`
- Re-anima ao trocar filtro (AnimatePresence mode="wait" com key=filter)

### 3.7 Ranking — Table rows
- **Arquivo**: `client/src/app/user/(main)/ranking/page.tsx`
- **Container**: `motion.div`
- **Cada row**: `motion.div` com `staggerItem`
- Manter click handler (abre PlayerModal)

### 3.8 Loja — Item grid
- **Arquivo**: `client/src/app/user/(main)/loja/page.tsx`
- **Container**: `motion.div` com `staggerContainer`
- **Cada card**: `motion.div` com `staggerItem`
- Re-anima ao trocar categoria: `key={cat}` no container

### 3.9 Cofre — Item grid
- **Arquivo**: `client/src/app/user/(main)/cofre/page.tsx`
- Mesmo padrão da Loja

### 3.10 Recompensas — Summary + MissionCard
- **Arquivo**: `client/src/app/user/(main)/recompensas/page.tsx`
- Summary cards: `motion.div` grid com stagger
- Mission list: `motion.div` com stagger + `key={filter}`

### 3.11 New Session — Team cards
- **Arquivo**: `client/src/app/user/(main)/new-session/page.tsx`
- Container: `motion.div` com stagger
- Cada team: `motion.div` com `staggerItem` + `layout` (anima reordenação)

---

## Fase 4 — Transições de Conteúdo Condicional

### 4.1 ActiveGameBanner (Dashboard)
- Envolver `{activeSession && <ActiveGameBanner />}` com `<AnimatePresence>`
- `<motion.div variants={slideUp}>`
- Key: `activeSession?.id`

### 4.2 Mobile bottom sheet — Loja
- **Arquivo**: `client/src/app/user/(main)/loja/page.tsx`
- Envolver `{mobileSheet && selected && (...)}` com `<AnimatePresence>`
- Backdrop: `backdrop` variants
- Sheet content: `slideUp` variants (slide de baixo)

### 4.3 Mobile bottom sheet — Cofre
- **Arquivo**: `client/src/app/user/(main)/cofre/page.tsx`
- Mesmo padrão da Loja

### 4.4 JoinModal (Sessions)
- **Arquivo**: `client/src/app/user/(main)/sessions/page.tsx`
- `UModal` já animado (Fase 1.2)
- Views internas (senha/time/espectador): `AnimatePresence mode="wait"` com key do step atual

### 4.5 Tab content — Game page
- **Arquivo**: `client/src/app/user/game/[sessionId]/page.tsx`
- Envolver `renderConteudo()` com `<AnimatePresence mode="wait">` e `key={abaAtual}`
- Wrap: `<motion.div variants={fadeIn}>` em cada conteúdo de aba

### 4.6 NegotiationResponseModal — View switching
- **Arquivo**: `client/src/components/NegotiationResponseModal/index.tsx`
- Views (pendente/resposta/counter-offer): `AnimatePresence mode="wait"` com key do view state

### 4.7 Ranking — PlayerModal conteúdo
- `UModal` já animado (Fase 1.2)
- Conteúdo interno: `AnimatePresence mode="wait"` para crossfade entre métricas (se aplicável)

---

## Fase 5 — Transições de Página

### 5.1 `(main)/layout.tsx`

**Antes**: Server component, `{children}` direto.
**Depois**: Client component com `AnimatePresence` + `usePathname()`.

- Adicionar `"use client"` no topo
- Import: `{ usePathname }` de `next/navigation`
- Import: `{ motion, AnimatePresence }` de `framer-motion`
- Import: `{ fadeIn }` de `@/lib/animations`
- Envolver `{children}` com:
  ```tsx
  <AnimatePresence mode="wait">
    <motion.div key={pathname} variants={fadeIn} initial="hidden" animate="visible" exit="exit">
      {children}
    </motion.div>
  </AnimatePresence>
  ```
- Duração: 0.15s exit, 0.2s entry (rápido, sem sensação de lentidão)
- Manter UserNav e classes de layout externas (fora do motion.div)

---

## Fase 6 — Micro-interações

### 6.1 UserNav — NotifBell dropdown
- **Arquivo**: `client/src/components/UserNav/index.tsx`
- Envolver `{open && (notification list)}` com `<AnimatePresence>`
- `<motion.div variants={slideUp}>` para o dropdown

### 6.2 Chat — Panel toggle
- **Arquivo**: `client/src/components/Chat/index.tsx`
- Envolver `{open && (chat panel)}` com `<AnimatePresence>`
- `<motion.div variants={slideUp}>` para o painel

### 6.3 ColorDropdown — Options dropdown
- **Arquivo**: `client/src/components/ColorDropdown/index.tsx`
- Envolver `{isOpen && (options)}` com `<AnimatePresence>`
- `<motion.div variants={fadeIn}>` para as opções

### 6.4 Botões interativos (whileTap)
Adicionar `whileTap={{ scale: 0.95 }}` do Framer Motion (ou manter CSS `active:scale-95` que já existe em vários lugares).

**Onde adicionar** (onde ainda não tem):
- Botão "Comprar agora" na Loja: `motion.button`
- Botão "Equipar" / "Remover" no Cofre: `motion.button`
- Botão "Resgatar" em Recompensas: `motion.button`
- Cards clicáveis (SessionCard, ShopItemCard, VaultItemCard): `motion.div` com `whileHover={{ scale: 1.01 }}`

### 6.5 GameBottomNav — Active indicator
- **Arquivo**: `client/src/components/GameBottomNav/index.tsx`
- Adicionar `motion.div` com `layoutId="active-tab"` para animar o indicador entre abas
- Ou manter CSS simples com `transition-colors` (já suficiente para bottom nav)

---

## Ordem de Execução

| # | Passo | Arquivo(s) | Est. tempo |
|---|---|---|---|
| 0 | Criar base | `lib/animations.ts` | 5min |
| 1 | ConfirmationModal | `ConfirmationModal/index.tsx` | 15min |
| 2 | UModal (UserUI) | `user/UserUI.tsx` | 15min |
| 3 | EditProfileModal | `EditProfileModal/index.tsx` | 15min |
| 4 | ToastProvider | `Toast/ToastProvider.tsx` | 20min |
| 5 | Dashboard stagger + banner | `user/(main)/page.tsx` | 20min |
| 6 | Perfil stagger | `user/(main)/perfil/page.tsx` | 15min |
| 7 | Sessions stagger | `user/(main)/sessions/page.tsx` | 15min |
| 8 | Ranking stagger | `user/(main)/ranking/page.tsx` | 15min |
| 9 | Loja stagger + sheet | `user/(main)/loja/page.tsx` | 20min |
| 10 | Cofre stagger + sheet | `user/(main)/cofre/page.tsx` | 20min |
| 11 | Recompensas stagger | `user/(main)/recompensas/page.tsx` | 15min |
| 12 | New session stagger | `user/(main)/new-session/page.tsx` | 10min |
| 13 | Game tab transitions | `user/game/[sessionId]/page.tsx` | 15min |
| 14 | Page transitions | `user/(main)/layout.tsx` | 10min |
| 15 | UserNav dropdown | `UserNav/index.tsx` | 10min |
| 16 | Chat panel | `Chat/index.tsx` | 10min |
| 17 | ColorDropdown | `ColorDropdown/index.tsx` | 10min |
| 18 | Micro-interações | Diversos | 15min |
| 19 | Type-check + build | — | 5min |

**Total estimado**: ~4 horas de implementação.

---

## Arquivos Modificados (18 únicos)

| Arquivo | Fase(s) |
|---|---|
| `lib/animations.ts` | Base |
| `ConfirmationModal/index.tsx` | 1 |
| `user/UserUI.tsx` | 1 |
| `EditProfileModal/index.tsx` | 1 |
| `Toast/ToastProvider.tsx` | 2 |
| `user/(main)/page.tsx` (Dashboard) | 3, 4 |
| `user/(main)/perfil/page.tsx` | 3 |
| `user/(main)/sessions/page.tsx` | 3, 4 |
| `user/(main)/ranking/page.tsx` | 3 |
| `user/(main)/loja/page.tsx` | 3, 4 |
| `user/(main)/cofre/page.tsx` | 3, 4 |
| `user/(main)/recompensas/page.tsx` | 3 |
| `user/(main)/new-session/page.tsx` | 3 |
| `user/game/[sessionId]/page.tsx` | 4 |
| `user/(main)/layout.tsx` | 5 |
| `UserNav/index.tsx` | 6 |
| `Chat/index.tsx` | 6 |
| `ColorDropdown/index.tsx` | 6 |

---

## Riscos e Observações

1. **Loading index.tsx**: Não mexer com AnimatePresence. Exigiria mudar todos os pais. Apenas CSS entry animation.
2. **Modal/index.tsx (GSAP)**: Manter. Componente estável com animação funcional.
3. **MobileMenu (GSAP)**: Manter. Já tem timeline de abertura/fechamento.
4. **Page transitions**: `mode="wait"` significa que a página atual sai completamente antes da nova entrar. Pode dar flash branco se o layout for server-rendered. Testar com Suspense se necessário.
5. **UModal z-index**: Corrigir de `z-50` para `z-[200]` durante a Fase 1.2 (bug conhecido em AGENTS.md).
