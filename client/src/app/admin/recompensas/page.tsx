"use client";

/**
 * Recompensas / Missões — Admin
 * Salve em: src/app/admin/recompensas/page.tsx
 */

import { useEffect, useState } from "react";
import {
  Target, Plus, Pencil, Trash2, Check, X, Coins,
  Building, Home, Trophy, Crown, Gamepad2,
} from "lucide-react";
import { useAdminStore } from "@/stores/adminStore";
import { useToast } from "@/components/Toast";
import type { AdminMission, MissionInput } from "@/services/api/admin";
import {
  Panel, Chip, Toggle, Segmented, Btn, Field,
  AdminInput, AdminTextarea, AdminSelect, AdminModal, Progress,
} from "@/components/admin/AdminUI";
import type { LucideIcon } from "lucide-react";

/* ── Metric map ── */
const METRIC_META: Record<string, { label: string; icon: LucideIcon; tone: "cyan" | "emerald" | "amber" | "violet" | "sky" }> = {
  properties_bought: { label: "Propriedades compradas", icon: Building,  tone: "cyan"    },
  houses_built:      { label: "Casas construídas",      icon: Home,      tone: "emerald" },
  rent_earned:       { label: "Aluguéis recebidos",     icon: Coins,     tone: "amber"   },
  games_played:      { label: "Partidas jogadas",       icon: Gamepad2,  tone: "violet"  },
  wins:              { label: "Vitórias",                icon: Crown,     tone: "amber"   },
  top3:              { label: "Pódios (Top 3)",          icon: Trophy,    tone: "sky"     },
};

const TONE_CLASSES: Record<string, string> = {
  cyan:    "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  amber:   "bg-amber-500/10 text-amber-300 border-amber-500/20",
  violet:  "bg-violet-500/10 text-violet-300 border-violet-500/20",
  sky:     "bg-sky-500/10 text-sky-300 border-sky-500/20",
};

/* ── Mission modal ── */
const EMPTY: MissionInput = {
  name: "", description: "", metric: "wins",
  target: 10, xpReward: 300, coinReward: 150, perGame: false, active: true,
};

function MissionModal({
  mission,
  onClose,
  onSave,
}: {
  mission: AdminMission | "new" | null;
  onClose: () => void;
  onSave: (data: MissionInput, id?: number) => Promise<void>;
}) {
  const isNew = mission === "new";
  const [form, setForm] = useState<MissionInput>(
    isNew ? EMPTY : mission ? { ...mission } : EMPTY
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(isNew ? EMPTY : mission && mission !== "new" ? { ...mission } : EMPTY);
  }, [mission]);

  if (!mission) return null;

  const set = (k: keyof MissionInput, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form, isNew ? undefined : (mission as AdminMission).id);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminModal open={!!mission} onClose={onClose} width={540}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h2 className="font-jaro text-lg text-white flex items-center gap-2 whitespace-nowrap">
          <Target size={18} className="text-cyan-400" />
          {isNew ? "Nova missão" : "Editar missão"}
        </h2>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer p-1">
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <Field label="Nome">
          <AdminInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="ex: Campeão Absoluto" required />
        </Field>
        <Field label="Descrição">
          <AdminTextarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Métrica">
            <AdminSelect value={form.metric} onChange={(e) => set("metric", e.target.value)}>
              {Object.entries(METRIC_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </AdminSelect>
          </Field>
          <Field label="Meta">
            <AdminInput type="number" min={1} value={form.target} onChange={(e) => set("target", +e.target.value)} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Recompensa XP">
            <AdminInput type="number" min={0} value={form.xpReward} onChange={(e) => set("xpReward", +e.target.value)} />
          </Field>
          <Field label="Recompensa Coins">
            <AdminInput type="number" min={0} value={form.coinReward} onChange={(e) => set("coinReward", +e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(["Por partida", "Ativa"] as const).map((label) => {
            const key = label === "Por partida" ? "perGame" : "active";
            return (
              <div key={key} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <span className="font-inconsolata text-sm text-zinc-200 whitespace-nowrap">{label}</span>
                <Toggle on={!!form[key]} onChange={(v) => set(key, v)} />
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 pt-1">
          <Btn variant="ghost" className="flex-1 justify-center" onClick={onClose}>Cancelar</Btn>
          <Btn type="submit" variant="primary" icon={Check} className="flex-1 justify-center" disabled={saving}>
            {saving ? "Salvando…" : isNew ? "Criar" : "Salvar"}
          </Btn>
        </div>
      </form>
    </AdminModal>
  );
}

/* ── Mission card ── */
function MissionCard({
  m,
  onEdit,
  onDelete,
  onToggle,
}: {
  m: AdminMission;
  onEdit: (m: AdminMission) => void;
  onDelete: (id: number) => void;
  onToggle: (m: AdminMission) => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const meta = METRIC_META[m.metric] ?? METRIC_META.wins;
  const tone = meta.tone;
  const Icon = meta.icon;

  return (
    <div className={`border rounded-2xl p-4 transition-all ${m.active ? "border-zinc-800 bg-zinc-900" : "border-zinc-800/60 bg-zinc-900/40 opacity-60"}`}>
      <div className="flex items-start gap-3">
        <span className={`w-11 h-11 rounded-xl grid place-items-center border shrink-0 ${TONE_CLASSES[tone]}`}>
          <Icon size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-jaro text-base text-white">{m.name}</h3>
            {m.perGame && <Chip tone="sky">por partida</Chip>}
          </div>
          <p className="font-inconsolata text-[11px] text-zinc-500 mt-0.5 leading-snug">
            {m.description}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(m)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800 cursor-pointer transition-colors"
          >
            <Pencil size={13} />
          </button>
          {confirmDel ? (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => { setConfirmDel(false); onDelete(m.id); }} className="text-rose-400 hover:text-rose-300 cursor-pointer p-1"><Check size={13} /></button>
              <button type="button" onClick={() => setConfirmDel(false)} className="text-zinc-500 hover:text-white cursor-pointer p-1"><X size={13} /></button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDel(true)} className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer transition-colors"><Trash2 size={13} /></button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
        <div className="flex items-center gap-4">
          <span className="font-inconsolata text-[11px] text-zinc-400">
            Meta <b className="font-jaro text-zinc-200">{m.target.toLocaleString("pt-BR")}</b>
          </span>
          <span className="font-inconsolata text-xs text-cyan-300">+{m.xpReward} XP</span>
          <span className="inline-flex items-center gap-1 font-inconsolata text-xs text-amber-300">
            <Coins size={11} />+{m.coinReward}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Toggle on={m.active} onChange={() => onToggle(m)} size="sm" />
          <span className="font-inconsolata text-[10px] text-zinc-500 w-10">
            {m.active ? "ativa" : "inativa"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function AdminRecompensasPage() {
  const { missions, loadingMissions, loadMissions, createMission, updateMission, deleteMission } = useAdminStore();
  const { success: ok, error: err } = useToast();
  const [modal, setModal] = useState<AdminMission | "new" | null>(null);

  useEffect(() => { loadMissions(); }, [loadMissions]);

  async function handleSave(data: MissionInput, id?: number) {
    try {
      if (id === undefined) { await createMission(data); ok("Missão criada!"); }
      else                  { await updateMission(id, data); ok("Missão atualizada!"); }
    } catch { err("Erro ao salvar missão."); throw new Error(); }
  }

  async function handleDelete(id: number) {
    try { await deleteMission(id); ok("Missão removida."); }
    catch { err("Erro ao remover missão."); }
  }

  async function handleToggle(m: AdminMission) {
    try { await updateMission(m.id, { active: !m.active }); }
    catch { err("Erro ao alternar missão."); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-inconsolata text-xs text-zinc-500">
          {missions.filter((m) => m.active).length} ativas · {missions.length} no total
        </p>
        <Btn variant="primary" icon={Plus} onClick={() => setModal("new")}>
          Nova missão
        </Btn>
      </div>

      {loadingMissions ? (
        <p className="py-20 text-center font-inconsolata text-sm text-zinc-500">Carregando…</p>
      ) : missions.length === 0 ? (
        <p className="py-20 text-center font-inconsolata text-sm text-zinc-600">Nenhuma missão cadastrada.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {missions.map((m) => (
            <MissionCard
              key={m.id} m={m}
              onEdit={setModal}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <MissionModal mission={modal} onClose={() => setModal(null)} onSave={handleSave} />
      )}
    </div>
  );
}
