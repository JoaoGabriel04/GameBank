"use client";

import { useEffect, useState } from "react";
import { adminApi, type AdminDashboard } from "@/services/api/admin";
import UserAvatar from "@/components/UserAvatar";
import { Users, Gamepad2, Trophy, ShoppingBag, RefreshCw } from "lucide-react";

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="font-jaro text-2xl text-white">{value.toLocaleString("pt-BR")}</p>
        <p className="font-inconsolata text-xs text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setData(await adminApi.getDashboard());
    } catch {
      // erro silencioso
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-zinc-500 font-inconsolata text-center py-20">Erro ao carregar dashboard.</p>;
  }

  const STATUS_COLOR: Record<string, string> = {
    "Esperando":    "text-amber-400",
    "Em Andamento": "text-green-400",
    "Finalizada":   "text-zinc-500",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-jaro text-2xl text-white">Dashboard</h1>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 rounded-xl text-sm font-inconsolata transition-colors cursor-pointer">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-6 h-6 text-blue-400" />}     label="Usuários"  value={data.totalUsers}    color="bg-blue-500/10" />
        <StatCard icon={<Gamepad2 className="w-6 h-6 text-green-400" />} label="Sessões"   value={data.totalSessions}  color="bg-green-500/10" />
        <StatCard icon={<Trophy className="w-6 h-6 text-amber-400" />}   label="Finalizadas" value={data.totalFinished} color="bg-amber-500/10" />
        <StatCard icon={<ShoppingBag className="w-6 h-6 text-violet-400" />} label="Itens na Loja" value={data.totalItems} color="bg-violet-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Últimos usuários */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h2 className="font-jaro text-base text-zinc-200">Últimos Usuários</h2>
          </div>
          <div className="divide-y divide-zinc-800">
            {data.recentUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                <UserAvatar avatarUrl={u.avatarUrl} avatarUpdatedAt={u.avatarUpdatedAt} nome={u.nome} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-inconsolata text-sm text-zinc-200 truncate">{u.nome}</p>
                  <p className="font-inconsolata text-[10px] text-zinc-500 truncate">{u.email}</p>
                </div>
                <span className="font-inconsolata text-[10px] text-zinc-600 shrink-0">
                  {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Últimas sessões */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h2 className="font-jaro text-base text-zinc-200">Últimas Sessões</h2>
          </div>
          <div className="divide-y divide-zinc-800">
            {data.recentSessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-inconsolata text-sm text-zinc-200 truncate">{s.nome || `Sala #${s.id}`}</p>
                  <p className="font-inconsolata text-[10px] text-zinc-500">
                    {s.jogadores.length}/{s.maxJogadores} jogadores
                  </p>
                </div>
                <span className={`font-inconsolata text-[10px] shrink-0 ${STATUS_COLOR[s.status] ?? "text-zinc-500"}`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Últimas partidas */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <h2 className="font-jaro text-base text-zinc-200">Últimas Partidas (1º lugar)</h2>
          </div>
          <div className="divide-y divide-zinc-800">
            {data.recentGames.map((g) => (
              <div key={g.id} className="flex items-center gap-3 px-5 py-3">
                <span className="font-jaro text-lg text-yellow-400 shrink-0">🥇</span>
                <div className="flex-1 min-w-0">
                  <p className="font-inconsolata text-sm text-zinc-200 truncate">{g.user.nome}</p>
                  <p className="font-inconsolata text-[10px] text-zinc-500">
                    R$ {g.patrimony.toLocaleString("pt-BR")}
                  </p>
                </div>
                <span className="font-inconsolata text-[10px] text-zinc-600 shrink-0">
                  {new Date(g.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
            {data.recentGames.length === 0 && (
              <p className="px-5 py-6 text-xs font-inconsolata text-zinc-600 text-center">Nenhuma partida finalizada.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
