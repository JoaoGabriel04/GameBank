'use client';

/**
 * Ranking Global
 * Salve em: src/app/user/(main)/ranking/page.tsx
 *
 * Cria a NOVA rota /user/ranking.
 * Carrega getRankingApi() uma vez e permite ordenação client-side por
 * 4 métricas (XP, Vitórias, Partidas, Win Rate).
 * Pódio visual para top 3 + tabela clicável com modal de player.
 */

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { Loader2, TrendingUp, Gamepad2, Crown, Trophy, ChevronRight, X } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { getRankingApi } from "@/services/api/ranking";
import UserAvatar from "@/components/UserAvatar";
import UserBanner from "@/components/UserBanner";
import UserBadge from "@/components/UserBadge";
import { Chip, Progress, Segmented, UModal, xpForLevel, totalXpForLevels } from "@/components/user/UserUI";
import type { RankingUser } from "@/types/shop";

/* ── Metric config ── */
type Metric = "xp" | "vitorias" | "partidas" | "winrate";

interface MetricMeta {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  getValue: (p: RankingUser) => number;
  format: (v: number) => string;
  unit: string;
}

const METRIC_META: Record<Metric, MetricMeta> = {
  xp:       { label: "XP",        icon: TrendingUp, getValue: (p) => p.xp ?? 0,                                               format: (v) => v.toLocaleString("pt-BR"), unit: "XP"       },
  vitorias: { label: "Vitórias",  icon: Crown,      getValue: (p) => p.totalWins ?? 0,                                        format: (v) => String(v),                 unit: "vitórias" },
  partidas: { label: "Partidas",  icon: Gamepad2,   getValue: (p) => p.totalGames ?? 0,                                       format: (v) => String(v),                 unit: "partidas" },
  winrate:  { label: "Win Rate",  icon: TrendingUp, getValue: (p) => p.totalGames > 0 ? Math.round((p.totalWins / p.totalGames) * 100) : 0, format: (v) => v + "%", unit: "%" },
};

/* ── Medal component ── */
const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function Medal({ rank }: { rank: number }) {
  if (MEDALS[rank]) return <span className="text-xl leading-none">{MEDALS[rank]}</span>;
  return <span className="font-jaro text-sm text-zinc-500">#{rank}</span>;
}

/* ── Player modal ── */
function PlayerModal({ player, onClose }: { player: RankingUser | null; onClose: () => void }) {
  const { user } = useAuthStore();
  if (!player) return null;

  const isMe = user?.id === player.id;
  const xpCurrent  = xpForLevel(player.level ?? 1);
  const xpPrevious = totalXpForLevels(player.level ?? 1);
  const xpInto     = (player.xp ?? 0) - xpPrevious;
  const pct        = Math.min(Math.round((xpInto / xpCurrent) * 100), 100);
  const winRate    = player.totalGames > 0 ? Math.round((player.totalWins / player.totalGames) * 100) : 0;

  return (
    <UModal open={!!player} onClose={onClose} width={400}>
      {/* Banner hero */}
      <div className="relative h-28 rounded-t-2xl overflow-hidden">
        <UserBanner
          banner={player.banner}
          spriteId={player.spriteId}
          className="absolute inset-0 w-full h-full"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(0deg,rgba(9,9,11,.85) 0%,transparent 60%)" }}
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 left-3 z-20 text-white/60 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-black/30 transition-colors"
        >
          <X size={16} />
        </button>
        {isMe && (
          <div className="absolute top-3 left-10 z-10">
            <Chip tone="green" dot>você</Chip>
          </div>
        )}
      </div>

      <div className="px-5 pb-5 bg-zinc-950 rounded-b-2xl">
        {/* Avatar overlap */}
        <div className="flex items-start justify-between -mt-8 mb-2">
          <div className="ring-4 ring-zinc-950 rounded-full z-10 relative">
            <UserAvatar
              avatarUrl={player.avatarUrl}
              avatarUpdatedAt={player.avatarUpdatedAt}
              nome={player.nome}
              size="lg"
              ring={isMe}
            />
          </div>
          <div className="pt-9 flex items-center gap-1.5">
          </div>
        </div>

        {/* Name + title */}
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <UserBadge badge={player.badge} imageUrl={player.badgeImageUrl} variant="small" />
          <h3 className="font-jaro text-xl text-white whitespace-nowrap">{player.nome}</h3>
          {player.title && <Chip tone="emerald">{player.title}</Chip>}
        </div>
        <p className="font-inconsolata text-xs text-zinc-500 mt-0.5">
          Nível {player.level} · #{player.position ?? "—"} no ranking
        </p>

        {/* XP bar */}
        <div className="mt-3 mb-4">
          <div className="flex justify-between font-inconsolata text-[10px] text-zinc-500 mb-1">
            <span>{xpInto.toLocaleString("pt-BR")} XP</span>
            <span>{pct}% → nível {(player.level ?? 1) + 1}</span>
          </div>
          <Progress value={xpInto} max={xpCurrent} tone="green" height={5} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: "Partidas", val: player.totalGames ?? 0,      icon: Gamepad2,   color: "text-violet-400" },
            { label: "Vitórias", val: player.totalWins ?? 0,       icon: Crown,      color: "text-yellow-400" },
            { label: "Win %",    val: winRate + "%",               icon: TrendingUp, color: "text-green-400"  },
            { label: "Top 3",    val: player.totalTop3 ?? "—",     icon: Trophy,     color: "text-amber-400"  },
          ].map(({ label, val, icon: Icon, color }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-center">
              <Icon size={13} className={`mx-auto mb-1 ${color}`} />
              <p className="font-jaro text-base text-white leading-none">{val}</p>
              <p className="font-inconsolata text-[9px] text-zinc-500 mt-1">{label}</p>
            </div>
          ))}
        </div>


      </div>
    </UModal>
  );
}

/* ── Podium ── */
function Podium({
  top3,
  metric,
  onSelect,
}: {
  top3: RankingUser[];
  metric: Metric;
  onSelect: (p: RankingUser) => void;
}) {
  const { user } = useAuthStore();
  const meta = METRIC_META[metric];
  // Display order: 2nd, 1st, 3rd
  const ordered = [top3[1], top3[0], top3[2]];
  const heights = ["h-24", "h-32", "h-20"];
  const scales  = ["scale-95", "scale-100", "scale-90"];
  const podiumStyles = [
    "bg-gradient-to-b from-zinc-400/10 to-zinc-400/0 border border-zinc-600/40",
    "bg-gradient-to-b from-yellow-500/20 to-yellow-500/5 border border-yellow-500/30",
    "bg-gradient-to-b from-amber-700/10 to-amber-700/0 border border-amber-700/30",
  ];

  return (
    <motion.div
      className="flex items-end justify-center gap-4 py-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {ordered.map((p, i) => {
        if (!p) return <motion.div key={`podium-empty-${i}`} variants={staggerItem} className="w-28" />;
        const isMe = user?.id === p.id;
        const value = meta.getValue(p);
        return (
          <motion.div
            key={`podium-${p.id}-${metric}`}
            variants={staggerItem}
            onClick={() => onSelect(p)}
            className={`flex flex-col items-center gap-2 ${scales[i]} cursor-pointer group`}
          >
            <div className="relative">
              <UserAvatar
                avatarUrl={p.avatarUrl}
                avatarUpdatedAt={p.avatarUpdatedAt}
                nome={p.nome}
                size={i === 1 ? "lg" : "md"}
                ring={isMe}
              />
              {isMe && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-zinc-950 grid place-items-center">
                  <span className="w-2 h-2 rounded-full bg-zinc-950" />
                </span>
              )}
            </div>
            <div className="text-center flex flex-col items-center gap-1">
              <UserBadge badge={p.badge} imageUrl={p.badgeImageUrl} variant="micro" />
              <p className="font-jaro text-sm text-zinc-100 truncate max-w-[80px] group-hover:text-green-300 transition-colors">
                {p.nome.split(" ")[0]}
              </p>
              {p.title && (
                <p className="font-inconsolata text-[9px] text-zinc-500">{p.title}</p>
              )}
            </div>
            <div className={`${heights[i]} w-24 rounded-t-xl flex flex-col items-center justify-end pb-3 ${podiumStyles[i]} hover:brightness-110 transition-all`}>
              <span className="text-2xl leading-none">{["🥈","🥇","🥉"][i]}</span>
              <p className="font-jaro text-base mt-1 text-zinc-100">{meta.format(value)}</p>
              <p className="font-inconsolata text-[9px] text-zinc-500">{meta.unit}</p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

/* ── Main page ── */
export default function RankingPage() {
  const { user } = useAuthStore();
  const [raw, setRaw]           = useState<RankingUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [metric, setMetric]     = useState<Metric>("xp");
  const [selected, setSelected] = useState<RankingUser | null>(null);

  useEffect(() => {
    const loadRanking = async () => {
      setLoading(true);
      try {
        const data = await getRankingApi();
        setRaw(data);
      } catch {
        setRaw([]);
      } finally {
        setLoading(false);
      }
    };

    loadRanking();
    // Refresh ranking every 2 minutes to show updated banners/items
    const interval = setInterval(loadRanking, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Client-side sort by selected metric
  const sorted = useMemo(() => {
    const meta = METRIC_META[metric];
    return [...raw]
      .sort((a, b) => meta.getValue(b) - meta.getValue(a))
      .map((p, i) => ({ ...p, position: i + 1 }));
  }, [raw, metric]);

  const top3  = sorted.slice(0, 3);
  const myPos = sorted.find((p) => p.id === user?.id);
  const meta  = METRIC_META[metric];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pt-16 lg:pt-6">

      {/* Metric segmented control */}
      <Segmented
        value={metric}
        onChange={(v) => setMetric(v as Metric)}
        options={[
          { value: "xp",       label: "XP"       },
          { value: "vitorias", label: "Vitórias"  },
          { value: "partidas", label: "Partidas"  },
          { value: "winrate",  label: "Win Rate"  },
        ]}
      />

      {/* My position banner */}
      {myPos && (
        <div className="flex items-center gap-3 bg-green-500/5 border border-green-500/30 rounded-2xl px-4 py-3">
          <span className="font-jaro text-2xl text-green-300">#{myPos.position}</span>
          <div className="flex-1">
            <p className="font-inconsolata text-sm text-zinc-200">Sua posição atual</p>
            <p className="font-inconsolata text-xs text-zinc-500">
              {meta.label}: {meta.format(meta.getValue(myPos))}
            </p>
          </div>
          <TrendingUp size={18} className="text-green-400" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
        </div>
      ) : (
        <>
          {/* Podium */}
          {top3.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <Podium top3={top3} metric={metric} onSelect={setSelected} />
            </div>
          )}

          {/* Full table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
              <span className="font-inconsolata text-[10px] uppercase tracking-wider text-zinc-500">
                Classificação completa
              </span>
              <Chip tone="zinc">{sorted.length} jogadores</Chip>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {sorted.map((p, i) => {
                const isMe  = p.id === user?.id;
                const value = meta.format(meta.getValue(p));
                return (
                  <motion.div
                    key={`rank-${metric}-${p.id}`}
                    variants={staggerItem}
                    onClick={() => setSelected(p)}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60 last:border-0 cursor-pointer transition-colors ${
                      isMe ? "bg-green-500/5 hover:bg-green-500/10" : "hover:bg-zinc-800/50"
                    }`}
                  >
                  <div className="w-7 text-center shrink-0">
                    <Medal rank={i + 1} />
                  </div>

                  <UserAvatar
                    avatarUrl={p.avatarUrl}
                    avatarUpdatedAt={p.avatarUpdatedAt}
                    nome={p.nome}
                    size="sm"
                    ring={isMe}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <UserBadge badge={p.badge} imageUrl={p.badgeImageUrl} variant="micro" />
                      <span className={`font-inconsolata text-sm truncate ${isMe ? "text-green-300" : "text-zinc-200"}`}>
                        {p.nome}
                      </span>
                      {isMe && <Chip tone="green">você</Chip>}
                      {p.title && (
                        <Chip tone="zinc" className="hidden sm:inline-flex">{p.title}</Chip>
                      )}
                    </div>
                    <p className="font-inconsolata text-[10px] text-zinc-500">Nível {p.level}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-jaro text-base text-zinc-100">{value}</p>
                    <p className="font-inconsolata text-[10px] text-zinc-500">{meta.unit}</p>
                  </div>

                  <ChevronRight size={14} className="text-zinc-700 shrink-0" />
                </motion.div>
              );
            })}
            </motion.div>
          </div>
        </>
      )}

      {selected && <PlayerModal player={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
