'use client';

/**
 * Recompensas / Missões — redesign
 * Salve em: src/app/user/(main)/recompensas/page.tsx
 *
 * Visual do protótipo: cards com glow, ícone por métrica, barra de progresso
 * colorida por tipo, chip de status, botão "Resgatar" com estado otimista.
 *
 * ⚠️  Claim: não existe endpoint /missions/:id/claim ainda.
 *    Quando criado, substitua o TODO abaixo por: await claimMissionApi(m.id)
 */

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import {
  Building2, Home, Coins, Gamepad2, Crown, Trophy, Sparkles,
} from "lucide-react";
import CoinIcon from "@/components/CoinIcon";
import { Loader2 } from "lucide-react";
import { useProfileStore } from "@/stores/profileStore";
import { useToast } from "@/components/Toast";
import { Progress, Chip, Segmented, UBtn } from "@/components/user/UserUI";
import type { UserMission } from "@/types/shop";

/* ── Metric → visual metadata ── */
type MetricTone = "emerald" | "teal" | "amber" | "violet" | "sky" | "cyan";

interface MetricMeta {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: MetricTone;
  label: string;
}

const METRIC_META: Record<string, MetricMeta> = {
  properties_bought: { icon: Building2, tone: "cyan",    label: "Propriedades compradas" },
  houses_built:      { icon: Home,      tone: "emerald", label: "Casas construídas"      },
  rent_earned:       { icon: Coins,     tone: "amber",   label: "Aluguéis recebidos"     },
  games_played:      { icon: Gamepad2,  tone: "violet",  label: "Partidas jogadas"        },
  wins:              { icon: Crown,     tone: "amber",   label: "Vitórias"               },
  top3:              { icon: Trophy,    tone: "sky",     label: "Pódios (Top 3)"          },
};

const TONE_ICON_COLOR: Record<MetricTone, string> = {
  emerald: "#34d399",
  teal:    "#2dd4bf",
  amber:   "#fbbf24",
  violet:  "#a78bfa",
  sky:     "#38bdf8",
  cyan:    "#22d3ee",
};

const TONE_BG: Record<MetricTone, string> = {
  emerald: "bg-emerald-500/10 border-emerald-500/20",
  teal:    "bg-teal-500/10 border-teal-500/20",
  amber:   "bg-amber-500/10 border-amber-500/20",
  violet:  "bg-violet-500/10 border-violet-500/20",
  sky:     "bg-sky-500/10 border-sky-500/20",
  cyan:    "bg-cyan-500/10 border-cyan-500/20",
};

function getMetaMeta(metric: string): MetricMeta {
  return METRIC_META[metric] ?? { icon: Trophy, tone: "emerald", label: metric };
}

/* ── Countdown badge ── */
function CountdownBadge({ expiresAt }: { expiresAt: string }) {
  const calc = useCallback(() => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expirada";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}min`;
  }, [expiresAt]);

  const [remaining, setRemaining] = useState(calc);

  useEffect(() => {
    setRemaining(calc());
    const iv = setInterval(() => setRemaining(calc()), 60000);
    return () => clearInterval(iv);
  }, [calc]);

  const isUrgent = new Date(expiresAt).getTime() - Date.now() < 2 * 3600000;

  return (
    <span className={`font-inconsolata text-[10px] ${isUrgent ? "text-red-400" : "text-zinc-500"}`}>
      ⏱ {remaining}
    </span>
  );
}

/* ── Mission card ── */
function MissionCard({
  m,
  onClaim,
  claiming,
}: {
  m: UserMission;
  onClaim: (id: number) => void;
  claiming: Set<number>;
}) {
  const meta    = getMetaMeta(m.metric);
  const tone    = meta.tone;
  const Icon    = meta.icon;
  const iconClr = TONE_ICON_COLOR[tone];
  const iconBg  = TONE_BG[tone];

  const progress   = m.progress ?? 0;
  const target     = m.target ?? 1;
  const pct        = Math.min(100, Math.round((progress / target) * 100));
  const isDone     = m.completed && !m.claimed;
  const isClaimed  = m.claimed;

  return (
    <div
      className={`relative rounded-2xl border p-4 overflow-hidden transition-all ${
        isDone
          ? "border-green-500/40 bg-gradient-to-br from-green-500/5 to-transparent shadow-[0_0_40px_-15px_rgba(74,222,128,.3)]"
          : isClaimed
          ? "border-zinc-800/60 bg-zinc-900/40 opacity-60"
          : "border-zinc-800 bg-zinc-900"
      }`}
    >
      {/* Top glow stripe for completed */}
      {isDone && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-500/0 via-green-400 to-green-500/0" />
      )}

      {/* Header */}
      <div className="flex items-start gap-3">
        <span
          className={`w-11 h-11 rounded-xl grid place-items-center border shrink-0 ${iconBg}`}
          style={{ color: iconClr }}
        >
          <Icon size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-jaro text-base text-zinc-100">{m.name}</h3>
            {isClaimed && <Chip tone="zinc">Resgatada</Chip>}
            {isDone    && <Chip tone="green" dot>Concluída!</Chip>}
            {m.tipo === "daily"  && <Chip tone="cyan">Diária</Chip>}
            {m.tipo === "weekly" && <Chip tone="violet">Semanal</Chip>}
            {m.expiresAt && !m.claimed && <CountdownBadge expiresAt={m.expiresAt} />}
          </div>
          <p className="font-inconsolata text-[11px] text-zinc-500 mt-0.5">{m.description}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between font-inconsolata text-[10px]">
          <span className="text-zinc-500">Progresso</span>
          <span className="text-zinc-300">
            {Math.min(progress, target).toLocaleString("pt-BR")} / {target.toLocaleString("pt-BR")} · {pct}%
          </span>
        </div>
        <Progress value={Math.min(progress, target)} max={target} tone={tone} height={6} />
      </div>

      {/* Footer: rewards + action */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="font-inconsolata text-xs text-cyan-300">
            +{m.xpReward?.toLocaleString("pt-BR")} XP
          </span>
          <span className="inline-flex items-center gap-1 font-inconsolata text-xs text-amber-300">
            <CoinIcon size={12} />+{m.coinReward?.toLocaleString("pt-BR")}
          </span>
        </div>

        {isDone && (
          <UBtn
            variant="primary"
            size="sm"
            icon={claiming.has(m.id) ? Loader2 : Sparkles}
            onClick={() => onClaim(m.id)}
            disabled={claiming.has(m.id)}
          >
            Resgatar
          </UBtn>
        )}
        {isClaimed && (
          <span className="font-inconsolata text-[11px] text-zinc-600 italic">
            Já resgatada
          </span>
        )}
        {!m.completed && (
          <span className="font-inconsolata text-[11px] text-zinc-500">
            {100 - pct}% restante
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function RecompensasPage() {
  const { missions, loading, loadMissions, claimMission, claimAllMissions } = useProfileStore();
  const { success: toastSuccess, error: toastError } = useToast();
  const [filter, setFilter] = useState("Todas");
  const [tipoFilter, setTipoFilter] = useState("Todas");
  const [claimingIds, setClaimingIds] = useState<Set<number>>(new Set());
  const [claimingAll, setClaimingAll] = useState(false);

  useEffect(() => {
    loadMissions();
  }, [loadMissions]);

  async function handleClaim(id: number) {
    if (claimingIds.has(id)) return;

    setClaimingIds((prev) => new Set(prev).add(id));
    try {
      const result = await claimMission(id);
      toastSuccess(`+${result.xpEarned} XP e +${result.coinsEarned} moedas resgatados!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao resgatar recompensa";
      toastError(msg);
    } finally {
      setClaimingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  async function handleClaimAll() {
    if (claimingAll || available === 0) return;
    setClaimingAll(true);
    try {
      const result = await claimAllMissions();
      toastSuccess(`${result.claimedCount} missões resgatadas! +${result.xpEarned} XP e +${result.coinsEarned} moedas.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao resgatar missões";
      toastError(msg);
    } finally {
      setClaimingAll(false);
    }
  }

  const available    = missions.filter((m) => m.completed && !m.claimed).length;
  const inProgress   = missions.filter((m) => !m.completed).length;
  const claimedCount = missions.filter((m) => m.claimed).length;

  const list = missions.filter((m) => {
    if (tipoFilter === "Diárias")    return m.tipo === "daily";
    if (tipoFilter === "Semanais")   return m.tipo === "weekly";

    return true;
  }).filter((m) => {
    if (filter === "Disponíveis")   return m.completed && !m.claimed;
    if (filter === "Em andamento")  return !m.completed;
    if (filter === "Resgatadas")    return m.claimed;
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pt-16 lg:pt-6">

      {/* Summary cards */}
      <motion.div
        className="grid grid-cols-3 gap-3"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {[
          { label: "Para resgatar", val: available,    tone: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
          { label: "Em andamento",  val: inProgress,   tone: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
          { label: "Resgatadas",    val: claimedCount, tone: "text-zinc-400",  bg: "bg-zinc-800 border-zinc-700"         },
        ].map((s) => (
          <motion.div key={s.label} variants={staggerItem} className={`border rounded-2xl p-3 text-center ${s.bg}`}>
            <p className={`font-jaro text-2xl leading-none ${s.tone}`}>{s.val}</p>
            <p className="font-inconsolata text-[10px] text-zinc-500 mt-1">{s.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {available > 0 && (
        <motion.div variants={staggerItem} initial="hidden" animate="visible">
          <button
            onClick={handleClaimAll}
            disabled={claimingAll}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-green-500/30 bg-green-500/5 font-jaro text-sm text-green-400 hover:bg-green-500/10 hover:border-green-500/50 transition-all disabled:opacity-50 cursor-pointer"
          >
            {claimingAll ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {claimingAll ? "Resgatando…" : `Resgatar todas (${available})`}
          </button>
        </motion.div>
      )}

      {/* Tipo filter */}
      <Segmented
        value={tipoFilter}
        onChange={setTipoFilter}
        options={["Todas", "Diárias", "Semanais"]}
      />

      {/* Status filter */}
      <Segmented
        value={filter}
        onChange={setFilter}
        options={["Todas", "Disponíveis", "Em andamento", "Resgatadas"]}
      />

      {/* Mission list */}
      {loading.missions ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-center font-inconsolata text-sm text-zinc-600 py-12">
          Nenhuma missão nesta categoria.
        </p>
      ) : (
        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {list.map((m) => (
            <motion.div key={m.id} variants={staggerItem}>
              <MissionCard m={m} onClaim={handleClaim} claiming={claimingIds} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
