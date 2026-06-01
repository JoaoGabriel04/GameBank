"use client";

import { useEffect, useState } from "react";
import { adminApi, type AdminDashboard } from "@/services/api/admin";
import { Panel, PanelHead, Delta, Chip, LiveDot } from "@/components/admin/AdminBase";
import { AreaChart, MultiLine, Donut, Sparkline, BarChart } from "@/components/admin/AdminCharts";
import { Users, Coins, Store, Server, Activity, TrendingUp, TrendingDown } from "lucide-react";

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setData(await adminApi.getDashboard());
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-zinc-500 font-mono text-center py-20">
        Erro ao carregar dashboard.
      </p>
    );
  }

  // Mock data for charts
  const mockGrowth = Array(30)
    .fill(0)
    .map(() => Math.floor(Math.random() * 100) + 100);
  const mockCoins = mockGrowth.map((v) => v * 1.5);

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Users}
          tone="cyan"
          label="Usuários totais"
          value={fmt(data.totalUsers)}
          delta={5.2}
          spark={mockGrowth}
        />
        <KpiCard
          icon={Coins}
          tone="amber"
          label="Coins em circulação"
          value={fmtK(data.totalUsers * 500)}
          delta={12.1}
          spark={mockCoins}
          sparkTone="amber"
        />
        <KpiCard
          icon={Store}
          tone="emerald"
          label="Receita da loja"
          value={fmtK(data.totalItems * 250)}
          delta={8.5}
          spark={mockGrowth.map((v) => v * 0.8)}
          sparkTone="emerald"
        />
        <KpiCard
          icon={Server}
          tone="violet"
          label="Sessões hoje"
          value={data.totalSessions}
          delta={9.2}
          spark={mockGrowth}
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
                { data: mockGrowth, color: "#22d3ee" },
                { data: mockCoins, color: "#fbbf24" },
              ]}
            />
            <div className="flex justify-between mt-2 font-mono text-[10px] text-zinc-600">
              <span>1 mai</span>
              <span>15 mai</span>
              <span>1 jun</span>
            </div>
          </div>
        </Panel>

        <Panel flush>
          <PanelHead title="Itens da loja" icon={Store} sub="Distribuição por tipo" />
          <div className="p-4 flex flex-col items-center">
            <Donut
              segments={[
                { value: 12, color: "#22d3ee", label: "Títulos" },
                { value: 8, color: "#a78bfa", label: "Badges" },
                { value: 5, color: "#34d399", label: "Cores" },
              ]}
            />
            <div className="grid grid-cols-3 gap-2 mt-4 w-full">
              <div className="text-center">
                <span className="block w-2 h-2 rounded-full mx-auto mb-1 bg-cyan-400" />
                <p className="font-jaro text-sm text-white leading-none">12</p>
                <p className="font-mono text-[9px] text-zinc-500">Títulos</p>
              </div>
              <div className="text-center">
                <span className="block w-2 h-2 rounded-full mx-auto mb-1 bg-violet-400" />
                <p className="font-jaro text-sm text-white leading-none">8</p>
                <p className="font-mono text-[9px] text-zinc-500">Badges</p>
              </div>
              <div className="text-center">
                <span className="block w-2 h-2 rounded-full mx-auto mb-1 bg-emerald-400" />
                <p className="font-jaro text-sm text-white leading-none">5</p>
                <p className="font-mono text-[9px] text-zinc-500">Cores</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Live + Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel flush className="lg:col-span-2">
          <PanelHead
            title="Sessões ativas"
            icon={Server}
            sub={`${data.recentSessions.length} partidas em andamento agora`}
            right={<Chip tone="emerald" dot>AO VIVO</Chip>}
          />
          <div className="divide-y divide-zinc-800">
            {data.recentSessions.slice(0, 3).map((s) => {
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
                      por anônimo · {s.duracao} s · modo {s.modo}
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
          </div>
        </Panel>

        <Panel flush>
          <PanelHead
            title="Atividade recente"
            icon={Activity}
            sub="Eventos do sistema"
          />
          <div className="divide-y divide-zinc-800/60">
            {[
              {
                text: "Novo usuário registrado",
                icon: Users,
                tone: "cyan",
                time: "agora",
              },
              {
                text: "Sessão finalizada",
                icon: Server,
                tone: "emerald",
                time: "2m",
              },
              {
                text: "Item comprado na loja",
                icon: Store,
                tone: "amber",
                time: "5m",
              },
            ].map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-7 h-7 rounded-lg grid place-items-center border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                    <Icon size={13} />
                  </span>
                  <p className="flex-1 font-mono text-[11px] text-zinc-300 leading-tight">
                    {a.text}
                  </p>
                  <span className="font-mono text-[9px] text-zinc-600 shrink-0">
                    {a.time}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Panel flush>
          <PanelHead title="Sessões / dia" icon={Server} />
          <div className="p-4">
            <BarChart
              data={mockGrowth.slice(-14)}
              tone="violet"
              h={120}
            />
          </div>
        </Panel>
        <Panel flush>
          <PanelHead title="Gasto na loja" icon={Coins} />
          <div className="p-4">
            <AreaChart
              data={mockGrowth.slice(-14).map((v) => v * 0.8)}
              tone="emerald"
              h={120}
              grid={false}
            />
          </div>
        </Panel>
        <Panel className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              Usuários ativos hoje
            </span>
            <Users size={14} className="text-cyan-400" />
          </div>
          <p className="font-jaro text-3xl text-white mt-2">{fmt(data.totalUsers * 0.6 | 0)}</p>
          <p className="font-mono text-[11px] text-zinc-500">85% de retenção semanal</p>
        </Panel>
        <Panel className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              Partidas finalizadas
            </span>
            <TrendingUp size={14} className="text-amber-400" />
          </div>
          <p className="font-jaro text-3xl text-white mt-2">{fmt(data.totalFinished)}</p>
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
        {delta !== undefined && (
          <Delta
            value={delta}
            Icon={delta >= 0 ? TrendingUp : TrendingDown}
          />
        )}
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
