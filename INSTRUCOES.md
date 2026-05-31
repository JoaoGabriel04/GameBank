# Plano: Reestruturação de Rotas — `/` · `/user` · `/admin`

## Visão geral da mudança

```
ANTES                          DEPOIS
──────────────────────         ──────────────────────────────
/                              /                 ← landing pública (sem menu)
/loja                          /user             ← dashboard do jogador
/recompensas                   /user/loja
/sessions                      /user/recompensas
/new-session                   /user/sessions
/perfil                        /user/new-session
/configuracoes                 /user/perfil
/game/[sessionId]              /user/configuracoes
/saibamais                     /user/game/[sessionId]
                               /admin            ← dashboard admin
                               /admin/loja
                               /admin/usuarios
                               /admin/sessions
                               /admin/missoes
/login         ← sem mudança
/register      ← sem mudança
/onboarding    ← sem mudança
/auth/callback ← sem mudança
/saibamais     ← manter como rota pública (conteúdo de apoio)
```

---

## Dependência prévia

Este plano **depende** do campo `isAdmin` no `User` descrito em `PLANO_ADMIN_E_REDESIGN.md`:
- `isAdmin: boolean` no schema Prisma (já migrado)
- `isAdmin` no `JwtPayload` do servidor
- `isAdmin` na interface `AuthUser` do `authStore.ts`

Se ainda não foi aplicado, aplique essa parte antes de executar este plano.

---

## Parte 1 — Stores e utilitários

### 1.1 `client/src/stores/authStore.ts`

Adicionar `isAdmin` na interface `AuthUser` (se ainda não foi feito):

```ts
export interface AuthUser {
  id: number
  email: string
  nome: string
  avatarUrl?: string | null
  avatarUpdatedAt?: string | null
  banner?: string | null
  profileComplete: boolean
  isAdmin: boolean   // ← adicionar
}
```

---

### 1.2 `client/src/utils/authRedirect.ts`

Substituir o conteúdo inteiro por:

```ts
import type { AuthUser } from "@/stores/authStore";

export function getPostAuthPath(user: AuthUser, redirect?: string | null) {
  if (!user.profileComplete) return "/onboarding";

  // Admin vai direto para o painel
  if (user.isAdmin) return "/admin";

  // Redirect personalizado (ex: voltando de página protegida)
  if (redirect && redirect.startsWith("/") && redirect !== "/onboarding") {
    // Não redirecionar para rotas de admin se não for admin
    if (!redirect.startsWith("/admin")) return redirect;
  }

  return "/user";
}
```

---

### 1.3 `client/src/utils/menuOptions.ts`

Substituir o conteúdo inteiro por:

```ts
export const userMenuOptions = [
  { text: "Salas",       url: "/user/sessions" },
  { text: "Loja",        url: "/user/loja" },
  { text: "Recompensas", url: "/user/recompensas" },
]
```

Remover o array `menuOptions` antigo (não é mais usado).

---

## Parte 2 — Componentes

### 2.1 Criar `client/src/components/LandingHeader/index.tsx` (arquivo novo)

Header minimalista exclusivo da landing `/`. Apenas logo + botão contextual.

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

export default function LandingHeader() {
  const router = useRouter();
  const { user, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  function handleCTA() {
    if (!user) {
      router.push("/login");
      return;
    }
    router.push(user.isAdmin ? "/admin" : "/user");
  }

  return (
    <header className="absolute top-0 left-0 w-full flex items-center justify-between px-6 sm:px-10 h-20 z-50">
      <Link href="/">
        <Image
          src="/images/gamebank-logo.png"
          alt="GameBank"
          width={100}
          height={100}
          className="w-14"
        />
      </Link>

      <button
        onClick={handleCTA}
        className="font-jaro text-sm px-5 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white transition-colors"
      >
        {user ? "Acessar" : "Entrar"}
      </button>
    </header>
  );
}
```

---

### 2.2 Criar `client/src/components/UserNav/index.tsx` (arquivo novo)

Barra de navegação exclusiva da área `/user`. Substitui `Header` + `SiteBottomNav` dentro dessa área.

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStore, faGift, faUsers, faChartLine, faUser,
} from "@fortawesome/free-solid-svg-icons";
import { useAuthStore } from "@/stores/authStore";
import UserAvatar from "@/components/UserAvatar";
import Button1 from "@/components/Button01";

const NAV_TABS = [
  { label: "Dashboard", icon: faChartLine, path: "/user" },
  { label: "Salas",     icon: faUsers,     path: "/user/sessions" },
  { label: "Loja",      icon: faStore,     path: "/user/loja" },
  { label: "Recompensas", icon: faGift,    path: "/user/recompensas" },
  { label: "Perfil",    icon: faUser,      path: "/user/perfil" },
];

export default function UserNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();

  const isActive = (path: string) =>
    path === "/user" ? pathname === "/user" : pathname.startsWith(path);

  return (
    <>
      {/* Desktop — header fixo no topo */}
      <header className="hidden lg:flex fixed top-0 left-0 w-full h-16 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 items-center justify-between px-10 z-50">
        <Link href="/user">
          <Image src="/images/gamebank-logo.png" alt="GameBank" width={100} height={100} className="w-12" />
        </Link>

        <nav className="flex items-center gap-8">
          {NAV_TABS.slice(1, 4).map((tab) => (
            <Link
              key={tab.path}
              href={tab.path}
              className={`font-jaro text-sm transition-colors ${
                isActive(tab.path) ? "text-green-400" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          {user && (
            <>
              <Link href="/user/perfil" className="flex items-center gap-2">
                <UserAvatar
                  avatarUrl={user.avatarUrl}
                  avatarUpdatedAt={user.avatarUpdatedAt}
                  nome={user.nome}
                  size="sm"
                  ring={isActive("/user/perfil")}
                />
                <span className="text-zinc-300 font-jaro text-sm truncate max-w-28">{user.nome}</span>
              </Link>
              <Button1 size="md" color="green" handle={() => router.push("/user/new-session")}>
                Criar Sala
              </Button1>
            </>
          )}
        </div>
      </header>

      {/* Mobile — bottom nav fixo */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800">
        <ul className="grid grid-cols-5 w-full">
          {NAV_TABS.map((tab) => (
            <li
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className={`flex flex-col items-center justify-center py-3 gap-0.5 cursor-pointer transition-colors select-none active:scale-95 ${
                isActive(tab.path) ? "text-green-400" : "text-zinc-500"
              }`}
            >
              {tab.path === "/user/perfil" && user ? (
                <UserAvatar
                  avatarUrl={user.avatarUrl}
                  avatarUpdatedAt={user.avatarUpdatedAt}
                  nome={user.nome}
                  size="sm"
                  ring={isActive("/user/perfil")}
                />
              ) : (
                <FontAwesomeIcon
                  icon={tab.icon}
                  className={`text-xl ${isActive(tab.path) ? "drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]" : ""}`}
                />
              )}
              <span className="text-[10px] font-inconsolata font-medium">{tab.label}</span>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
```

---

### 2.3 Criar `client/src/components/AdminNav/index.tsx` (arquivo novo)

Sidebar exclusiva da área `/admin`.

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStore, faUsers, faServer, faBullseye, faGaugeHigh,
} from "@fortawesome/free-solid-svg-icons";
import { ExternalLink } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import UserAvatar from "@/components/UserAvatar";

const ADMIN_TABS = [
  { label: "Dashboard",  icon: faGaugeHigh, path: "/admin" },
  { label: "Loja",       icon: faStore,     path: "/admin/loja" },
  { label: "Usuários",   icon: faUsers,     path: "/admin/usuarios" },
  { label: "Sessões",    icon: faServer,    path: "/admin/sessions" },
  { label: "Missões",    icon: faBullseye,  path: "/admin/missoes" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();

  const isActive = (path: string) =>
    path === "/admin" ? pathname === "/admin" : pathname.startsWith(path);

  return (
    <>
      {/* Desktop — sidebar lateral */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-full w-56 bg-zinc-950 border-r border-zinc-800 flex-col z-50">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-zinc-800">
          <Link href="/admin">
            <Image src="/images/gamebank-logo.png" alt="GameBank" width={80} height={80} className="w-10" />
          </Link>
          <div>
            <span className="font-jaro text-zinc-100 text-sm block leading-none">GameBank</span>
            <span className="font-inconsolata text-[10px] text-violet-400 uppercase tracking-widest">Admin</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {ADMIN_TABS.map((tab) => (
            <Link
              key={tab.path}
              href={tab.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-inconsolata transition-colors ${
                isActive(tab.path)
                  ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                  : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <FontAwesomeIcon icon={tab.icon} className="w-4" />
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-zinc-800 space-y-2">
          <Link
            href="/user"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-inconsolata text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Voltar ao site
          </Link>
          {user && (
            <div className="flex items-center gap-2 px-3 py-2">
              <UserAvatar avatarUrl={user.avatarUrl} avatarUpdatedAt={user.avatarUpdatedAt} nome={user.nome} size="sm" />
              <span className="font-inconsolata text-xs text-zinc-400 truncate">{user.nome}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile — bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800">
        <ul className="grid grid-cols-5 w-full">
          {ADMIN_TABS.map((tab) => (
            <li
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className={`flex flex-col items-center justify-center py-3 gap-0.5 cursor-pointer transition-colors select-none active:scale-95 ${
                isActive(tab.path) ? "text-violet-400" : "text-zinc-500"
              }`}
            >
              <FontAwesomeIcon icon={tab.icon} className="text-xl" />
              <span className="text-[9px] font-inconsolata font-medium">{tab.label}</span>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
```

---

### 2.4 Atualizar `client/src/components/AuthGuard/index.tsx`

Alterar o redirect pós-autenticação de `/sessions` para `/user`, e bloquear acesso admin às rotas `/user`:

```tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import Loading from "@/components/Loading";

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!user.profileComplete) {
      router.replace("/onboarding");
      return;
    }
    // Admin tentando acessar área de usuário → redireciona para admin
    if (user.isAdmin && pathname.startsWith("/user")) {
      router.replace("/admin");
    }
  }, [loading, user, router, pathname]);

  if (loading || !user || !user.profileComplete) {
    return <Loading label="Verificando autenticação..." />;
  }

  return <>{children}</>;
}
```

---

### 2.5 Criar `client/src/components/AdminGuard/index.tsx` (arquivo novo)

```tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import Loading from "@/components/Loading";

export default function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading, loadFromStorage } = useAuthStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    if (!user.isAdmin) { router.replace("/user"); }
  }, [loading, user, router]);

  if (loading || !user || !user.isAdmin) {
    return <Loading label="Verificando permissões..." />;
  }

  return <>{children}</>;
}
```

---

## Parte 3 — Página pública `/`

### 3.1 Atualizar `client/src/app/page.tsx`

Duas alterações cirúrgicas:

**a)** Substituir o import de `Header` por `LandingHeader`:
```ts
// Remover:
import Header from "@/components/Header"

// Adicionar:
import LandingHeader from "@/components/LandingHeader"
```

**b)** No JSX, trocar `<Header />` por `<LandingHeader />` e remover qualquer referência ao `SiteBottomNav` (o `Header` atual inclui o `SiteBottomNav` internamente — ao removê-lo, o bottom nav some junto).

**c)** Os botões "Criar Nova Sessão" e "Ver Sessões" no hero devem chamar `/user/sessions` e `/user/new-session` quando logado, ou `/login` quando não logado. Atualizar `handleNavigate`:
```ts
function handleNavigate(path: string) {
  if (user) {
    // Mapear caminhos antigos para novos
    const map: Record<string, string> = {
      "/sessions":    "/user/sessions",
      "/new-session": "/user/new-session",
    };
    router.push(map[path] ?? path);
  } else {
    router.push(`/login?redirect=${encodeURIComponent(path)}`);
  }
}
```

E atualizar os `handle` dos dois botões no hero:
```tsx
handle={() => handleNavigate('/new-session')}
handle={() => handleNavigate('/sessions')}
```

E o botão "Criar Sala e Jogar" no final da seção "Como Jogar":
```tsx
handle={() => handleNavigate('/new-session')}
```

---

## Parte 4 — Área `/user`

### 4.1 Criar `client/src/app/user/layout.tsx`

```tsx
import AuthGuard from "@/components/AuthGuard";
import UserNav from "@/components/UserNav";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <UserNav />
      {/* pt-16 = altura do header desktop; pb-20 = altura do bottom nav mobile */}
      <div className="lg:pt-16 pb-20 lg:pb-0 min-h-screen bg-zinc-950">
        {children}
      </div>
    </AuthGuard>
  );
}
```

---

### 4.2 Criar `client/src/app/user/page.tsx` — Dashboard do jogador

Conteúdo do dashboard (criar do zero):

**Seções:**
1. **Saudação** — "Olá, {nome}" + nível + coins
2. **Barra de XP** — progresso para o próximo nível
3. **Stats rápidos** — Partidas / Vitórias / Top 3 em cards com ícone colorido
4. **Atalhos** — botões grandes para: Criar Sala, Ver Salas, Loja, Recompensas
5. **Missões em andamento** — até 3 missões com progresso (link para `/user/recompensas`)
6. **Histórico recente** — últimas 3 partidas (link para `/user/perfil`)

Dados disponíveis: `useProfileStore` já tem `profile`, `missions`, `loadProfile`, `loadMissions`.

```tsx
'use client'

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { useProfileStore } from "@/stores/profileStore"
import Link from "next/link"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
  faCrown, faGamepad, faTrophy, faPlus, faUsers,
  faStore, faGift, faBolt, faArrowRight,
} from "@fortawesome/free-solid-svg-icons"
import { Loader2 } from "lucide-react"
import { getProfileHistoryApi } from "@/services/api/profile"
import { useState } from "react"

const xpForLevel = (level: number) => Math.floor(200 * Math.pow(1.04, level - 1))
const totalXpForLevels = (level: number) => {
  let total = 0
  for (let i = 1; i < level; i++) total += xpForLevel(i)
  return total
}

export default function UserDashboard() {
  const router = useRouter()
  const { user, token, loadFromStorage } = useAuthStore()
  const { profile, missions, loading, loadProfile, loadMissions } = useProfileStore()
  const [history, setHistory] = useState<any[] | null>(null)

  useEffect(() => { loadFromStorage() }, [loadFromStorage])
  useEffect(() => {
    if (token) { loadProfile(); loadMissions() }
  }, [token, loadProfile, loadMissions])
  useEffect(() => {
    if (token && history === null) {
      getProfileHistoryApi().then(setHistory).catch(() => setHistory([]))
    }
  }, [token, history])

  if (loading.profile || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
      </div>
    )
  }

  const xpCurrent = xpForLevel(profile.level)
  const xpPrevious = totalXpForLevels(profile.level)
  const xpIntoLevel = profile.xp - xpPrevious
  const xpProgress = Math.min((xpIntoLevel / xpCurrent) * 100, 100)
  const activeMissions = missions.filter((m: any) => !m.completed).slice(0, 3)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* Saudação */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-jaro text-2xl text-zinc-100">
            Olá, {profile.nome.split(" ")[0]} 👋
          </h1>
          <p className="font-inconsolata text-sm text-zinc-500 mt-0.5">
            Nível {profile.level} · {profile.xp.toLocaleString("pt-BR")} XP total
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2">
          <FontAwesomeIcon icon={faCrown} className="text-amber-400 text-sm" />
          <span className="font-jaro text-lg text-amber-300">{profile.coins.toLocaleString("pt-BR")}</span>
        </div>
      </div>

      {/* Barra de XP */}
      <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="font-inconsolata text-xs text-zinc-500 uppercase tracking-widest">XP</span>
          <span className="font-inconsolata text-xs text-zinc-500">
            {xpIntoLevel.toLocaleString("pt-BR")} / {xpCurrent.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-700"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
        <p className="font-inconsolata text-[10px] text-zinc-600 mt-1.5 text-right">
          Próximo nível: {(xpCurrent - xpIntoLevel).toLocaleString("pt-BR")} XP restantes
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: faGamepad, value: profile.totalGames, label: "Partidas",  color: "text-blue-400" },
          { icon: faCrown,   value: profile.totalWins,  label: "Vitórias",  color: "text-amber-400" },
          { icon: faTrophy,  value: profile.totalTop3,  label: "Top 3",     color: "text-orange-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center gap-1">
            <FontAwesomeIcon icon={stat.icon} className={`text-2xl ${stat.color}`} />
            <p className="font-jaro text-2xl text-zinc-100">{stat.value}</p>
            <p className="font-inconsolata text-[11px] text-zinc-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push("/user/new-session")}
          className="bg-green-600 hover:bg-green-500 text-white rounded-2xl p-4 flex items-center gap-3 transition-colors cursor-pointer"
        >
          <FontAwesomeIcon icon={faPlus} className="text-xl" />
          <div className="text-left">
            <p className="font-jaro text-base">Criar Sala</p>
            <p className="font-inconsolata text-[11px] text-green-200">Nova partida</p>
          </div>
        </button>
        <button
          onClick={() => router.push("/user/sessions")}
          className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl p-4 flex items-center gap-3 transition-colors cursor-pointer border border-zinc-700"
        >
          <FontAwesomeIcon icon={faUsers} className="text-xl text-blue-400" />
          <div className="text-left">
            <p className="font-jaro text-base">Ver Salas</p>
            <p className="font-inconsolata text-[11px] text-zinc-400">Entrar em jogo</p>
          </div>
        </button>
        <button
          onClick={() => router.push("/user/loja")}
          className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl p-4 flex items-center gap-3 transition-colors cursor-pointer border border-zinc-700"
        >
          <FontAwesomeIcon icon={faStore} className="text-xl text-violet-400" />
          <div className="text-left">
            <p className="font-jaro text-base">Loja</p>
            <p className="font-inconsolata text-[11px] text-zinc-400">Gastar coins</p>
          </div>
        </button>
        <button
          onClick={() => router.push("/user/recompensas")}
          className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl p-4 flex items-center gap-3 transition-colors cursor-pointer border border-zinc-700"
        >
          <FontAwesomeIcon icon={faGift} className="text-xl text-pink-400" />
          <div className="text-left">
            <p className="font-jaro text-base">Recompensas</p>
            <p className="font-inconsolata text-[11px] text-zinc-400">Missões e ranking</p>
          </div>
        </button>
      </div>

      {/* Missões em andamento */}
      {activeMissions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-jaro text-base text-zinc-300 flex items-center gap-2">
              <FontAwesomeIcon icon={faBolt} className="text-yellow-400 text-sm" />
              Missões
            </h2>
            <Link href="/user/recompensas" className="text-xs font-inconsolata text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
              Ver todas <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
            </Link>
          </div>
          <div className="space-y-2">
            {activeMissions.map((m: any) => {
              const pct = Math.min((m.progress / m.target) * 100, 100)
              return (
                <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-inconsolata text-xs text-zinc-300">{m.name}</span>
                    <span className="font-inconsolata text-[10px] text-zinc-500">
                      {Math.floor(m.progress)}/{m.target}
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Histórico recente */}
      {history && history.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-jaro text-base text-zinc-300">Partidas Recentes</h2>
            <Link href="/user/perfil" className="text-xs font-inconsolata text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
              Ver todas <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
            </Link>
          </div>
          <div className="space-y-2">
            {history.slice(0, 3).map((r: any) => (
              <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className={`font-jaro text-xl ${
                  r.position === 1 ? "text-yellow-400" :
                  r.position === 2 ? "text-zinc-300" :
                  r.position === 3 ? "text-amber-600" : "text-zinc-600"
                }`}>#{r.position}</span>
                <div className="flex items-center gap-3 text-xs font-inconsolata">
                  <span className="text-green-400">+{r.xpEarned} XP</span>
                  <span className="text-amber-400">+{r.coinsEarned} coins</span>
                  <span className="text-zinc-600">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
```

---

### 4.3 Mover páginas existentes para `/user/`

Cada uma das páginas abaixo deve ser **copiada** para o novo caminho e a **antiga deletada**.
O conteúdo permanece idêntico, com apenas duas mudanças em cada arquivo:

1. Remover `<Header aba="..." />` e `<SiteBottomNav aba="..." />` (e seus imports) — a navegação agora é responsabilidade do `UserLayout`
2. Ajustar `pt-30` → `pt-8` no `<main>` (pois o header agora é `h-16` fixo, já com `pt-16` no layout)
3. Atualizar qualquer `router.push` ou `href` que referencie os caminhos antigos

| Arquivo antigo | Novo caminho |
|---------------|--------------|
| `app/loja/page.tsx` | `app/user/loja/page.tsx` |
| `app/recompensas/page.tsx` | `app/user/recompensas/page.tsx` |
| `app/sessions/page.tsx` | `app/user/sessions/page.tsx` |
| `app/new-session/page.tsx` | `app/user/new-session/page.tsx` |
| `app/perfil/page.tsx` | `app/user/perfil/page.tsx` |
| `app/configuracoes/page.tsx` | `app/user/configuracoes/page.tsx` |
| `app/game/[sessionId]/page.tsx` | `app/user/game/[sessionId]/page.tsx` |

**Links internos a atualizar dentro dessas páginas:**

| Referência antiga | Nova referência |
|------------------|-----------------|
| `/sessions` | `/user/sessions` |
| `/new-session` | `/user/new-session` |
| `/loja` | `/user/loja` |
| `/recompensas` | `/user/recompensas` |
| `/perfil` | `/user/perfil` |
| `/configuracoes` | `/user/configuracoes` |
| `/game/` | `/user/game/` |

---

## Parte 5 — Área `/admin`

### 5.1 Criar `client/src/app/admin/layout.tsx`

```tsx
import AdminGuard from "@/components/AdminGuard";
import AdminNav from "@/components/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminNav />
      {/* lg:pl-56 = largura da sidebar desktop */}
      <div className="lg:pl-56 pb-20 lg:pb-0 min-h-screen bg-zinc-950">
        {children}
      </div>
    </AdminGuard>
  );
}
```

---

### 5.2 Criar `client/src/app/admin/page.tsx` — Dashboard admin

Dados a exibir (requer endpoints no servidor — ver Parte 6):

**4 cards de resumo no topo:**
- Total de usuários cadastrados
- Total de sessões criadas
- Total de partidas finalizadas
- Total de itens na loja

**3 seções de listagem:**
- Últimos 5 usuários cadastrados (avatar, nome, email, data)
- Últimas 5 sessões criadas (nome, status, nº jogadores, data)
- Últimas 5 partidas finalizadas (session, posição 1º, patrimônio vencedor, data)

Estilo: mesmo tema `zinc-950`, cards com borda `zinc-800`, mesma linguagem visual da loja.

---

### 5.3 Páginas admin restantes

As páginas `/admin/loja`, `/admin/usuarios`, `/admin/sessions`, `/admin/missoes` são detalhadas no arquivo `PLANO_ADMIN_E_REDESIGN.md`. Criar após o dashboard.

---

## Parte 6 — Endpoint de dashboard admin (servidor)

Adicionar em `server/src/modules/admin/admin.controller.ts`:

```ts
getDashboard: async (_req: Request, res: Response) => {
  try {
    const [
      totalUsers, totalSessions, totalFinished, totalItems,
      recentUsers, recentSessions, recentGames,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.session.count(),
      prisma.session.count({ where: { status: "Finalizada" } }),
      prisma.shopItem.count(),
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 5,
        select: { id: true, nome: true, email: true, avatarUrl: true, createdAt: true } }),
      prisma.session.findMany({ orderBy: { dataInicio: "desc" }, take: 5,
        select: { id: true, nome: true, status: true, maxJogadores: true, dataInicio: true,
          jogadores: { select: { id: true } } } }),
      prisma.gameResult.findMany({ orderBy: { createdAt: "desc" }, take: 5, where: { position: 1 },
        include: { user: { select: { nome: true } } } }),
    ]);
    res.json({ totalUsers, totalSessions, totalFinished, totalItems,
      recentUsers, recentSessions, recentGames });
  } catch (err) {
    res.status(500).json({ message: "Erro ao carregar dashboard" });
  }
},
```

Adicionar rota em `admin.route.ts`:
```ts
router.get("/dashboard", authenticate, requireAdmin, adminController.getDashboard);
```

Adicionar função no `client/src/services/api/admin.ts`:
```ts
export const getAdminDashboardApi = () =>
  api.get("/admin/dashboard").then(res => res.data);
```

---

## Parte 7 — Login e Onboarding

### 7.1 `client/src/app/login/page.tsx`

O `getPostAuthPath` já cuida do redirect correto após login. Verificar que após o `setAuth`, o código chama:
```ts
router.push(getPostAuthPath(user, searchParams.get("redirect")));
```
Se já está assim, nenhuma mudança necessária.

### 7.2 `client/src/app/onboarding/page.tsx`

Ao finalizar o onboarding, verificar que o redirect usa `getPostAuthPath`:
```ts
router.push(getPostAuthPath(updatedUser));
// Resultado: "/user" para usuários normais, "/admin" para admins
```

---

## Parte 8 — Saibamais e Auth Callback

### 8.1 `app/saibamais/page.tsx`

Manter em `/saibamais` como rota pública. Substituir `<Header />` por `<LandingHeader />` (sem menu, sem bottom nav).

### 8.2 `app/auth/callback/page.tsx`

Sem mudanças — o callback OAuth já usa `getPostAuthPath` para redirecionar.

---

## Checklist de execução

```
UTILITÁRIOS E STORES
[ ] authStore.ts         → adicionar isAdmin na interface AuthUser
[ ] authRedirect.ts      → reescrever com lógica de admin
[ ] menuOptions.ts       → trocar para userMenuOptions com caminhos /user/*

NOVOS COMPONENTES
[ ] LandingHeader        → criar
[ ] UserNav              → criar
[ ] AdminNav             → criar
[ ] AdminGuard           → criar
[ ] AuthGuard            → atualizar (redirect /user, bloquear admin)

ROTA PÚBLICA
[ ] app/page.tsx         → trocar Header por LandingHeader, atualizar paths

ÁREA /user
[ ] app/user/layout.tsx         → criar (AuthGuard + UserNav)
[ ] app/user/page.tsx           → criar (dashboard)
[ ] app/user/loja/page.tsx      → mover de /loja, remover Header/SiteBottomNav
[ ] app/user/recompensas/page.tsx → mover, remover nav, atualizar paths internos
[ ] app/user/sessions/page.tsx  → mover, remover nav, atualizar paths internos
[ ] app/user/new-session/page.tsx → mover, remover nav
[ ] app/user/perfil/page.tsx    → mover, remover nav, atualizar paths internos
[ ] app/user/configuracoes/page.tsx → mover, remover nav
[ ] app/user/game/[sessionId]/page.tsx → mover

DELETAR (após mover)
[ ] app/loja/page.tsx
[ ] app/recompensas/page.tsx
[ ] app/sessions/page.tsx
[ ] app/new-session/page.tsx
[ ] app/perfil/page.tsx
[ ] app/configuracoes/page.tsx
[ ] app/game/[sessionId]/page.tsx (e a pasta app/game/)

ÁREA /admin (servidor)
[ ] admin.controller.ts  → adicionar getDashboard
[ ] admin.route.ts       → adicionar GET /dashboard

ÁREA /admin (cliente)
[ ] app/admin/layout.tsx        → criar (AdminGuard + AdminNav)
[ ] app/admin/page.tsx          → criar (dashboard)

AJUSTES FINAIS
[ ] app/saibamais/page.tsx      → trocar Header por LandingHeader
[ ] app/onboarding/page.tsx     → confirmar redirect para /user
[ ] app/login/page.tsx          → confirmar redirect via getPostAuthPath
[ ] services/api/admin.ts       → adicionar getAdminDashboardApi
```

---

## Observações importantes

- O `layout.tsx` do Next.js App Router **envolve automaticamente** todos os filhos da pasta. Criar o `AuthGuard` no `user/layout.tsx` significa que nenhuma página individual dentro de `/user` precisa mais do componente `AuthGuard` individualmente — remover de todas.
- O mesmo se aplica ao `admin/layout.tsx` com `AdminGuard`.
- Ao mover o `game/[sessionId]` para `/user/game/[sessionId]`, verificar se há links externos ou compartilhados (ex: convites de sala) que apontem para `/game/...` e atualizar para `/user/game/...`.
- O componente `Header` existente pode ser mantido sem alterações (não é mais usado após a migração) ou deletado ao final.
- O `SiteBottomNav` existente também pode ser deletado após a migração.
