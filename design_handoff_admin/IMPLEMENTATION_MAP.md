# Mapa de Implementação - Admin Console

Guia passo a passo para implementar cada aba do novo admin em seu stack Next.js/TypeScript.

---

## 1️⃣ ESTRUTURA DE PASTAS

```
src/
├── app/
│   ├── admin/
│   │   ├── layout.tsx                 # AdminLayout com Sidebar + Topbar
│   │   ├── page.tsx                   # Dashboard
│   │   ├── sessions/
│   │   │   └── page.tsx               # Sessões ao vivo
│   │   ├── users/
│   │   │   └── page.tsx               # Usuários avançado
│   │   ├── shop/
│   │   │   └── page.tsx               # Loja
│   │   ├── cards/
│   │   │   └── page.tsx               # Cartas (Sorte/Revés)
│   │   ├── missions/
│   │   │   └── page.tsx               # Missões
│   │   ├── economy/
│   │   │   └── page.tsx               # Economia global
│   │   ├── cosmetics/
│   │   │   └── page.tsx               # Cosméticos
│   │   └── audit/
│   │       └── page.tsx               # Auditoria
│   └── api/
│       └── admin/
│           ├── dashboard/
│           │   └── route.ts           # GET /api/admin/dashboard
│           ├── sessions/
│           │   ├── route.ts           # GET, PATCH /api/admin/sessions
│           │   └── [id]/
│           │       └── player/
│           │           └── [playerId]/
│           │               └── route.ts
│           ├── users/
│           │   ├── route.ts
│           │   └── [id]/
│           │       ├── route.ts
│           │       └── activity/
│           │           └── route.ts
│           ├── shop/
│           │   ├── route.ts
│           │   └── [id]/
│           │       └── route.ts
│           ├── cards/
│           │   ├── route.ts
│           │   └── [id]/
│           │       └── route.ts
│           ├── missions/
│           │   ├── route.ts
│           │   └── [id]/
│           │       └── route.ts
│           ├── economy/
│           │   ├── route.ts
│           │   └── history/
│           │       └── route.ts
│           ├── cosmetics/
│           │   ├── banners/
│           │   │   ├── route.ts
│           │   │   └── [id]/
│           │   │       └── route.ts
│           │   └── sprites/
│           │       ├── route.ts
│           │       └── [id]/
│           │           └── route.ts
│           └── audit/
│               └── route.ts
│
├── components/
│   ├── admin/
│   │   ├── AdminLayout.tsx
│   │   ├── AdminNav.tsx
│   │   ├── AdminTopbar.tsx
│   │   ├── AdminTable.tsx
│   │   ├── AdminModal.tsx
│   │   ├── AdminDrawer.tsx
│   │   ├── KpiCard.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── Chart.tsx
│   │   ├── SessionDrawer.tsx
│   │   ├── UserDrawer.tsx
│   │   ├── ShopModal.tsx
│   │   ├── CardModal.tsx
│   │   ├── MissionModal.tsx
│   │   └── (mais conforme necessário)
│   └── (componentes existentes)
│
├── hooks/
│   ├── useAdmin.ts                   # Context + queries
│   ├── useAdminSessions.ts           # Live sessions
│   └── useAdminUsers.ts              # Gestão de usuários
│
├── contexts/
│   └── AdminContext.tsx              # Estado compartilhado (filtros, live data)
│
└── lib/
    └── admin/
        ├── types.ts                  # Tipos TypeScript
        ├── queries.ts                # Funções de fetch (SWR/React Query)
        └── mutations.ts              # Funções de POST/PATCH/DELETE
```

---

## 2️⃣ FASES DE IMPLEMENTAÇÃO

### FASE 0: Setup (Base)

**Crie a estrutura de contexto e hooks:**

```typescript
// src/contexts/AdminContext.tsx
import React, { createContext, useState } from "react";

export const AdminContext = createContext({});

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [selectedSession, setSelectedSession] = useState(null);
  const [filter, setFilter] = useState({ status: "all", search: "" });
  
  return (
    <AdminContext.Provider value={{ selectedSession, setSelectedSession, filter, setFilter }}>
      {children}
    </AdminContext.Provider>
  );
}

// src/hooks/useAdmin.ts
import { useContext } from "react";
import { AdminContext } from "@/contexts/AdminContext";

export function useAdmin() {
  return useContext(AdminContext);
}
```

**Crie tipos compartilhados:**

```typescript
// src/lib/admin/types.ts
export interface KPI {
  id: string;
  label: string;
  value: number;
  change: number;
  trend: "up" | "down" | "neutral";
}

export interface LiveSession {
  id: number;
  nome: string;
  modo: "individual" | "duplas";
  status: "Esperando" | "Em Andamento" | "Finalizada";
  jogadores: {
    id: number;
    nome: string;
    saldo: number;
    cor: string;
  }[];
  saldoTotal: number;
  duracao: number; // segundos
}

export interface AdminUser {
  id: number;
  nome: string;
  email: string;
  level: number;
  xp: number;
  coins: number;
  isAdmin: boolean;
  isBanned: boolean;
  avatar?: string;
}

// ... mais tipos
```

---

### FASE 1: Sidebar + Layout

**Crie o AdminLayout:**

```typescript
// src/app/admin/layout.tsx
"use client";

import { useState } from "react";
import AdminNav from "@/components/admin/AdminNav";
import AdminTopbar from "@/components/admin/AdminTopbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <AdminNav open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <AdminTopbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Crie a Sidebar (AdminNav):**

Veja `reference/AdminNav.tsx` para estrutura completa. Inclua:
- Navegação por área (Visão Geral, Jogo ao Vivo, etc)
- Badges ao vivo (ex: "3 sessões ativas")
- Comando rápido (⌘K)
- Collapse/expand em mobile

---

### FASE 2: Dashboard

**Crie página e componentes:**

```typescript
// src/app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import KpiCard from "@/components/admin/KpiCard";
import Chart from "@/components/admin/Chart";
import AdminTable from "@/components/admin/AdminTable";

export default function DashboardPage() {
  const [kpis, setKpis] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [liveSessions, setLiveSessions] = useState([]);

  useEffect(() => {
    // Fetch KPIs
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setKpis(data.kpis);
        setChartData(data.chartData);
        setLiveSessions(data.sessions);
      });

    // Refresh a cada 30s
    const interval = setInterval(() => {
      fetch("/api/admin/dashboard").then((r) => r.json()).then((data) => {
        setKpis(data.kpis);
        setChartData(data.chartData);
        setLiveSessions(data.sessions);
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} {...kpi} />
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Chart title="Crescimento 30d" data={chartData?.growth} type="line" />
        <Chart title="Distribuição Loja" data={chartData?.distribution} type="donut" />
      </div>

      {/* Sessões ao vivo */}
      <AdminTable
        title="Sessões ao Vivo"
        data={liveSessions}
        columns={["id", "nome", "modo", "jogadores", "saldoTotal", "duracao"]}
        onRowClick={(session) => router.push(`/admin/sessions?id=${session.id}`)}
      />
    </div>
  );
}
```

**Implemente KpiCard.tsx:**

```typescript
// src/components/admin/KpiCard.tsx
export function KpiCard({ label, value, change, trend }: KPI) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-zinc-500 uppercase">{label}</span>
        <span className={`text-sm font-mono ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
          {trend === 'up' ? '+' : ''}{change}%
        </span>
      </div>
      <p className="text-3xl font-jaro font-bold text-zinc-100">{value.toLocaleString()}</p>
    </div>
  );
}
```

---

### FASE 3: Tabelas Genéricas + Sessões

**Crie AdminTable.tsx (reutilizável para todas as abas):**

```typescript
// src/components/admin/AdminTable.tsx
interface AdminTableProps {
  title: string;
  data: any[];
  columns: string[];
  sortable?: string[];
  onRowClick?: (row: any) => void;
  actions?: (row: any) => React.ReactNode;
}

export function AdminTable({
  title,
  data,
  columns,
  sortable = [],
  onRowClick,
  actions,
}: AdminTableProps) {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="border-b border-zinc-800 px-6 py-4">
        <h3 className="text-lg font-jaro font-bold text-zinc-100">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-6 py-3 text-left text-xs font-mono text-zinc-500 cursor-pointer hover:text-zinc-300"
                  onClick={() => {
                    if (sortable.includes(col)) {
                      setSortBy(col);
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    }
                  }}
                >
                  {col}
                </th>
              ))}
              {actions && <th className="px-6 py-3 text-right text-xs font-mono text-zinc-500">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                className="border-b border-zinc-800 hover:bg-zinc-800 transition-colors cursor-pointer"
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col} className="px-6 py-4 text-sm text-zinc-100 font-mono">
                    {renderCell(row[col])}
                  </td>
                ))}
                {actions && (
                  <td className="px-6 py-4 text-right">
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderCell(value: any) {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}
```

**Crie a página de Sessões:**

```typescript
// src/app/admin/sessions/page.tsx
"use client";

import { useEffect, useState } from "react";
import AdminTable from "@/components/admin/AdminTable";
import SessionDrawer from "@/components/admin/SessionDrawer";
import { LiveSession } from "@/lib/admin/types";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<LiveSession | null>(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/admin/sessions?status=${filter}`);
      const data = await res.json();
      setSessions(data);
    };

    load();
    const interval = setInterval(load, 10000); // Refresh a cada 10s
    return () => clearInterval(interval);
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {["all", "Esperando", "Em Andamento", "Finalizada"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded text-sm font-mono ${
              filter === s
                ? "bg-cyan-500 text-zinc-950"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {s === "all" ? "Todas" : s}
          </button>
        ))}
      </div>

      <AdminTable
        title="Sessões Ativas"
        data={sessions}
        columns={["id", "nome", "modo", "jogadores", "saldoTotal", "status"]}
        onRowClick={(session) => setSelectedSession(session)}
      />

      {selectedSession && (
        <SessionDrawer session={selectedSession} onClose={() => setSelectedSession(null)} />
      )}
    </div>
  );
}
```

---

### FASE 4+: Outras Abas

Repita o padrão para cada aba:
1. Página em `src/app/admin/<tab>/page.tsx`
2. Modal ou Drawer em `src/components/admin/<Tab>Modal.tsx`
3. Endpoint(s) em `src/app/api/admin/<tab>/route.ts`
4. Hook(s) em `src/hooks/useAdmin<Tab>.ts` (opcional)

---

## 3️⃣ ENDPOINTS ESPERADOS (Backend)

Cada endpoint deve:
- ✅ Validar `adminGuard()` (já tem seu middleware)
- ✅ Retornar status corretos (200, 201, 400, 404, 500)
- ✅ Logar em auditoria

**Exemplo de endpoint:**

```typescript
// src/app/api/admin/users/route.ts
import { adminGuard } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/admin/audit";

export async function GET(req: Request) {
  const user = await adminGuard();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const role = searchParams.get("role");
  const status = searchParams.get("status");

  // Query com filtros
  const users = await db.user.findMany({
    where: {
      AND: [
        search ? { OR: [{ nome: { contains: search, mode: "insensitive" } }, { email: { contains: search } }] } : {},
        role ? { role } : {},
        status === "banned" ? { isBanned: true } : status === "inactive" ? { lastLogin: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } : {},
      ],
    },
    include: { items: true },
  });

  return Response.json(users);
}

export async function PATCH(req: Request) {
  const user = await adminGuard();
  const { id, ...updates } = await req.json();

  const before = await db.user.findUnique({ where: { id } });
  const after = await db.user.update({
    where: { id },
    data: updates,
  });

  await logAudit({
    actorId: user.id,
    action: "user_updated",
    targetId: id,
    targetType: "user",
    before,
    after,
  });

  return Response.json(after);
}
```

---

## 4️⃣ DICAS & GOTCHAS

### Estado em Tempo Real
- **Polling:** `setInterval` + `fetch` cada 30s no Dashboard, 10s em Sessões
- **WebSocket:** Melhor para muitos clientes; use Socket.io ou ws nativo
- **SWR:** Use `useSWR` com `refreshInterval` para auto-revalidate

### Validação de Acesso
- Sempre `await adminGuard()` nos endpoints
- Considere rate-limit para endpoints de admin

### Erros em Produção
- Trate erros de fetch; mostre toast de erro
- Log erros no backend (sentry, etc)

### Performance
- Paginação em tabelas grandes (Sessions, Users)
- Lazy load de Drawers/Modals
- Debounce em inputs de busca

### Mobile
- Sidebar como menu hamburger
- Modals em fullscreen
- Tabelas com scroll horizontal

---

## 5️⃣ PRÓXIMAS ETAPAS

1. **Importe `design-tokens.ts` em seu `globals.css`**
2. **Crie a estrutura de pastas acima**
3. **Implemente FASE 0 (Setup) e FASE 1 (Sidebar)**
4. **Implemente FASE 2 (Dashboard) com dados mock**
5. **Teste responsividade em mobile**
6. **Implemente FASE 3+ conforme prioridade**

---

**Dúvidas?** Consulte o README.md ou as screenshots em `screenshots/`.
