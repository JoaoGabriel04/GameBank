"use client";

import { useEffect, useState } from "react";
import { adminApi, type AuditEntry } from "@/services/api/admin";
import { useAdminStore } from "@/stores/adminStore";
import { Panel, PanelHead, Chip, LiveDot, Delta } from "@/components/admin/AdminUI";
import { AreaChart, MultiLine, Donut, Sparkline, BarChart } from "@/components/admin/AdminCharts";
import { Users, Coins, Store, Server, Activity, TrendingUp, Check, Bell, Ban } from "lucide-react";

function relativeTime(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function auditLabel(action: string): string {
  const labels: Record<string, string> = {
    "user.ban": "Usuário banido",
    "user.unban": "Usuário desbanido",
    "user.delete": "Usuário removido",
    "user.set_admin": "Admin concedido",
    "user.remove_admin": "Admin revogado",
    "user.adjust_coins": "Coins ajustados",
    "user.adjust_xp": "XP ajustado",
    "user.set_level": "Nível alterado",
    "session.end": "Sessão encerrada",
    "session.player.adjust_balance": "Saldo ajustado",
    "mission.toggle": "Missão alterada",
    "admin.shopitem.delete": "Item removido da loja",
    "admin.banner.update": "Banner atualizado",
    "admin.banner.delete": "Banner removido",
    "admin.banner.upload_image": "Imagem de banner enviada",
    "admin.user.sync_banner": "Banner de usuário sincronizado",
  };
  return labels[action] ?? action;
}

const SEV_ICON: Record<string, React.ComponentType<{ size: number; className?: string }>> = {
  info: Activity,
  success: Check,
  warn: Bell,
  danger: Ban,
};

const SEV_COLOR: Record<string, string> = {
  info: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  success: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  warn: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  danger: "text-rose-400 bg-rose-500/10 border-rose-500/30",
};

// Stable sparkline seeds — avoid random re-renders
const SPARK_SEED = Array(30).fill(0).map((_, i) => 100 + ((i * 37 + 13) % 80));
const SPARK_COINS = SPARK_SEED.map((v) => v * 1.5);

export default function AdminDashboardPage() {
  const { dashboard, loadingDashboard, loadDashboard, items, loadItems } = useAdminStore();
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([]);

  useEffect(() => {
    // loadDashboard is already called (and auto-refreshed) by AdminLayout
    // loadItems for donut chart
    if (items.length === 0) loadItems();
    // recent audit activity
    adminApi.listAudit({ limit: 5 }).then(setRecentActivity).catch(() => {});
  }, []);

  if (loadingDashboard && !dashboard) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <p className="text-zinc-500 font-mono text-center py-20">
        Erro ao carregar dashboard.
      </p>
    );
  }

  const titleCount = items.filter((i) => i.type === "title").length;
  const badgeCount = items.filter((i) => i.type === "badge").length;
  const bannerCount = items.filter((i) => i.type === "banner").length;
  const hasItems = items.length > 0;

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Users}
          tone="cyan"
          label="Usuários totais"
          value={fmt(dashboard.totalUsers)}
          spark={SPARK_SEED}
        />
        <KpiCard
          icon={Coins}
          tone="amber"
          label="Itens na loja"
          value={fmt(dashboard.totalItems)}
          spark={SPARK_COINS}
          sparkTone="amber"
        />
        <KpiCard
          icon={Store}
          tone="emerald"
          label="Sessões finalizadas"
          value={fmt(dashboard.totalFinished)}
          spark={SPARK_SEED.map((v) => v * 0.8)}
          sparkTone="emerald"
        />
        <KpiCard
          icon={Server}
          tone="violet"
          label="Sessões totais"
          value={dashboard.totalSessions}
          spark={SPARK_SEED}
          sparkTone="violet"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel flush className="lg:col-span-2">
          <PanelHead
            title="Crescimento & Economia"
            icon={Activity}
            sub="Usuários e coins em circulação · últimos 30 dias"
            right={
              <div className="hidden sm:flex items-center gap-3">
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  Usuários
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Coins
                </span>
              </div>
            }
          />
          <div className="p-4">
            <MultiLine
              h={210}
              series={[
                { data: SPARK_SEED, color: "#22d3ee" },
                { data: SPARK_COINS, color: "#fbbf24" },
              ]}
            />
            <p className="text-center font-mono text-[10px] text-zinc-600 mt-2">
              Dados históricos em desenvolvimento
            </p>
          </div>
        </Panel>

        <Panel flush>
          <PanelHead title="Itens da loja" icon={Store} sub="Distribuição por tipo" />
          <div className="p-4 flex flex-col items-center">
            {hasItems ? (
              <>
                <Donut
                  segments={[
                    { value: titleCount || 1, color: "#22d3ee", label: "Títulos" },
                    { value: badgeCount || 0, color: "#a78bfa", label: "Badges" },
                    { value: bannerCount || 0, color: "#34d399", label: "Banners" },
                  ]}
                />
                <div className="grid grid-cols-3 gap-2 mt-4 w-full">
                  <div className="text-center">
                    <span className="block w-2 h-2 rounded-full mx-auto mb-1 bg-cyan-400" />
                    <p className="font-jaro text-sm text-white leading-none">{titleCount}</p>
                    <p className="font-mono text-[9px] text-zinc-500">Títulos</p>
                  </div>
                  <div className="text-center">
                    <span className="block w-2 h-2 rounded-full mx-auto mb-1 bg-violet-400" />
                    <p className="font-jaro text-sm text-white leading-none">{badgeCount}</p>
                    <p className="font-mono text-[9px] text-zinc-500">Badges</p>
                  </div>
                  <div className="text-center">
                    <span className="block w-2 h-2 rounded-full mx-auto mb-1 bg-emerald-400" />
                    <p className="font-jaro text-sm text-white leading-none">{bannerCount}</p>
                    <p className="font-mono text-[9px] text-zinc-500">Banners</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="font-mono text-[11px] text-zinc-600 py-8">Carregando itens…</p>
            )}
          </div>
        </Panel>
      </div>

      {/* Live + Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel flush className="lg:col-span-2">
          <PanelHead
            title="Sessões recentes"
            icon={Server}
            sub={`${dashboard.recentSessions.length} sessões recentes`}
            right={<Chip tone="emerald" dot>AO VIVO</Chip>}
          />
          <div className="divide-y divide-zinc-800">
            {dashboard.recentSessions.slice(0, 3).map((s) => {
              const totalCoins = s.saldoTotal;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                >
                  <LiveDot />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-zinc-100 truncate">
                        {s.nome}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-600">
                        #{s.id}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-zinc-500">
                      {s.duracao} s · modo {s.modo}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center -space-x-1.5">
                    {s.jogadores.slice(0, 4).map((_, i) => (
                      <span
                        key={i}
                        className="w-6 h-6 rounded-full ring-2 ring-zinc-900 bg-cyan-400"
                      />
                    ))}
                  </div>
                  <div className="text-right shrink-0 w-24">
                    <p className="font-mono text-sm text-emerald-400">
                      R$ {fmtK(totalCoins)}
                    </p>
                    <p className="font-mono text-[10px] text-zinc-500">
                      {s.jogadores.length} jogadores
                    </p>
                  </div>
                </div>
              );
            })}
            {dashboard.recentSessions.length === 0 && (
              <p className="px-4 py-6 font-mono text-[11px] text-zinc-600">
                Nenhuma sessão recente.
              </p>
            )}
          </div>
        </Panel>

        <Panel flush>
          <PanelHead
            title="Atividade recente"
            icon={Activity}
            sub="Eventos do sistema"
          />
          <div className="divide-y divide-zinc-800/60">
            {recentActivity.length > 0 ? (
              recentActivity.map((entry) => {
                const Icon = SEV_ICON[entry.severity] ?? Activity;
                const colorClass = SEV_COLOR[entry.severity] ?? SEV_COLOR.info;
                return (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`w-7 h-7 rounded-lg grid place-items-center border ${colorClass}`}>
                      <Icon size={13} />
                    </span>
                    <p className="flex-1 font-mono text-[11px] text-zinc-300 leading-tight truncate">
                      {auditLabel(entry.action)}
                    </p>
                    <span className="font-mono text-[9px] text-zinc-600 shrink-0">
                      {relativeTime(entry.ts)}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="px-4 py-6 font-mono text-[11px] text-zinc-600">
                Sem atividade recente.
              </p>
            )}
          </div>
        </Panel>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Panel flush>
          <PanelHead title="Sessões / dia" icon={Server} />
          <div className="p-4">
            <BarChart
              data={SPARK_SEED.slice(-14)}
              tone="violet"
              h={120}
            />
          </div>
        </Panel>
        <Panel flush>
          <PanelHead title="Gasto na loja" icon={Coins} />
          <div className="p-4">
            <AreaChart
              data={SPARK_SEED.slice(-14).map((v) => v * 0.8)}
              tone="emerald"
              h={120}
              grid={false}
            />
          </div>
        </Panel>
        <Panel className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              Sessões ativas
            </span>
            <Users size={14} className="text-cyan-400" />
          </div>
          <p className="font-jaro text-3xl text-white mt-2">
            {fmt(dashboard.totalSessions - dashboard.totalFinished)}
          </p>
          <p className="font-mono text-[11px] text-zinc-500">em andamento ou aguardando</p>
        </Panel>
        <Panel className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              Partidas finalizadas
            </span>
            <TrendingUp size={14} className="text-amber-400" />
          </div>
          <p className="font-jaro text-3xl text-white mt-2">{fmt(dashboard.totalFinished)}</p>
          <p className="font-mono text-[11px] text-zinc-500">desde o lançamento</p>
        </Panel>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

function fmtK(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k" : String(n);
}

function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
  delta,
  spark,
  sparkTone,
}: {
  icon: React.ComponentType<{ size: number }>;
  tone: "cyan" | "amber" | "emerald" | "violet";
  label: string;
  value: string | number;
  delta?: number;
  spark?: number[];
  sparkTone?: string;
}) {
  const rings = {
    cyan: "text-cyan-400 bg-cyan-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    violet: "text-violet-400 bg-violet-500/10",
  };

  return (
    <Panel className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-lg grid place-items-center ${rings[tone]}`}>
          <Icon size={18} />
        </div>
        {delta !== undefined && <Delta value={delta} />}
      </div>
      <p className="font-jaro text-2xl text-white mt-3 leading-none">{value}</p>
      <p className="font-mono text-[11px] text-zinc-500 mt-1.5 uppercase tracking-wider">
        {label}
      </p>
      {spark && (
        <div className="mt-2 -mb-1">
          <Sparkline data={spark} tone={(sparkTone || tone) as any} w={140} h={32} />
        </div>
      )}
    </Panel>
  );
}
