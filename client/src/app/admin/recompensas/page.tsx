"use client";

import { useEffect, useState } from "react";
import { useAdminStore } from "@/stores/adminStore";
import { useToast } from "@/components/Toast";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import type { AdminMission, MissionInput } from "@/services/api/admin";

const METRICS = [
  { value: "properties_bought", label: "Propriedades compradas", icon: "🏢" },
  { value: "houses_built",      label: "Casas construídas",      icon: "🏠" },
  { value: "rent_earned",       label: "Aluguel recebido",       icon: "💰" },
  { value: "games_played",      label: "Partidas jogadas",       icon: "🎮" },
  { value: "wins",              label: "Vitórias",               icon: "👑" },
  { value: "top3",              label: "Top 3",                  icon: "🏆" },
];

const EMPTY: MissionInput = {
  name: "", description: "", metric: "games_played",
  target: 1, xpReward: 50, coinReward: 10, perGame: false, active: true,
};

function MissionModal({ initial, onClose, onSave }: {
  initial: MissionInput | null;
  onClose: () => void;
  onSave: (data: MissionInput) => Promise<void>;
}) {
  const [form, setForm] = useState<MissionInput>(initial ?? EMPTY);
  const [saving, setSaving] = useState(false);

  function setField(key: keyof MissionInput, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="font-jaro text-lg text-white">{initial ? "Editar Missão" : "Nova Missão"}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-inconsolata text-zinc-400 mb-1 block">Nome</label>
            <input value={form.name} onChange={(e) => setField("name", e.target.value)} required className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-inconsolata text-zinc-100 focus:outline-none focus:border-zinc-500" />
          </div>
          <div>
            <label className="text-xs font-inconsolata text-zinc-400 mb-1 block">Descrição</label>
            <textarea value={form.description} onChange={(e) => setField("description", e.target.value)} required rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-inconsolata text-zinc-100 focus:outline-none focus:border-zinc-500 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-inconsolata text-zinc-400 mb-1 block">Métrica</label>
              <select value={form.metric} onChange={(e) => setField("metric", e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-inconsolata text-zinc-100 focus:outline-none">
                {METRICS.map((m) => <option key={m.value} value={m.value}>{m.icon} {m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-inconsolata text-zinc-400 mb-1 block">Meta</label>
              <input type="number" min={1} value={form.target} onChange={(e) => setField("target", Number(e.target.value))} required className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-inconsolata text-zinc-100 focus:outline-none focus:border-zinc-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-inconsolata text-zinc-400 mb-1 block">Recompensa XP</label>
              <input type="number" min={0} value={form.xpReward} onChange={(e) => setField("xpReward", Number(e.target.value))} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-inconsolata text-zinc-100 focus:outline-none focus:border-zinc-500" />
            </div>
            <div>
              <label className="text-xs font-inconsolata text-zinc-400 mb-1 block">Recompensa Coins</label>
              <input type="number" min={0} value={form.coinReward} onChange={(e) => setField("coinReward", Number(e.target.value))} className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-inconsolata text-zinc-100 focus:outline-none focus:border-zinc-500" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setField("active", e.target.checked)} className="accent-green-500 w-4 h-4" />
              <span className="text-sm font-inconsolata text-zinc-300">Ativa</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.perGame} onChange={(e) => setField("perGame", e.target.checked)} className="accent-blue-500 w-4 h-4" />
              <span className="text-sm font-inconsolata text-zinc-300">Por partida</span>
            </label>
          </div>
          <button type="submit" disabled={saving} className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 text-white font-inconsolata rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminRecompensasPage() {
  const { missions, loadingMissions, loadMissions, createMission, updateMission, deleteMission } = useAdminStore();
  const { success: toastSuccess, error: toastError } = useToast();
  const [modal, setModal] = useState<AdminMission | null | "new">(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => { loadMissions(); }, [loadMissions]);

  async function handleSave(data: MissionInput) {
    try {
      if (modal === "new") { await createMission(data); toastSuccess("Missão criada!"); }
      else if (modal) { await updateMission(modal.id, data); toastSuccess("Missão atualizada!"); }
    } catch { toastError("Erro ao salvar missão."); throw new Error(); }
  }

  async function handleDelete(id: number) {
    try { await deleteMission(id); toastSuccess("Missão removida."); setConfirmDelete(null); }
    catch { toastError("Erro ao remover missão."); }
  }

  const metricMeta = (metric: string) => METRICS.find((m) => m.value === metric) ?? { icon: "⭐", label: metric };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-jaro text-2xl text-white flex items-center gap-2">
          🏆 Missões
          <span className="text-sm font-inconsolata text-zinc-500 font-normal">({missions.length})</span>
        </h1>
        <button onClick={() => setModal("new")} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-inconsolata rounded-xl transition-colors cursor-pointer">
          <Plus className="w-4 h-4" /> Nova Missão
        </button>
      </div>

      {loadingMissions ? (
        <p className="text-zinc-500 font-inconsolata text-center py-20">Carregando missões...</p>
      ) : missions.length === 0 ? (
        <p className="text-zinc-500 font-inconsolata text-center py-20">Nenhuma missão cadastrada.</p>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
          {missions.map((m) => {
            const meta = metricMeta(m.metric);
            return (
              <div key={m.id} className={`flex items-center gap-4 px-5 py-4 ${!m.active ? "opacity-50" : ""}`}>
                <span className="text-2xl shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-inconsolata text-sm text-zinc-100 font-semibold truncate">{m.name}</p>
                    {!m.active && <span className="text-[10px] font-inconsolata bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded-full">Inativa</span>}
                    {m.perGame && <span className="text-[10px] font-inconsolata bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">Por partida</span>}
                  </div>
                  <p className="text-xs font-inconsolata text-zinc-500">{meta.label} · Meta: {m.target}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs font-inconsolata">
                  <span className="text-green-400">+{m.xpReward} XP</span>
                  <span className="text-yellow-400">+{m.coinReward} coins</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setModal(m)} className="text-zinc-400 hover:text-white transition-colors cursor-pointer"><Pencil className="w-4 h-4" /></button>
                  {confirmDelete === m.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDelete(m.id)} className="text-red-400 hover:text-red-300 cursor-pointer"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setConfirmDelete(null)} className="text-zinc-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(m.id)} className="text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal !== null && (
        <MissionModal
          initial={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
