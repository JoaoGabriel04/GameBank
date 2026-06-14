'use client';

import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, ChevronRight } from "lucide-react";
import { TROPHY_TIERS, getTierInfo, getTrophyAssetName, getTrophyLabel, type TrophyRank } from "@/utils/trophies";

interface Props {
  trophies: number;
  isOpen: boolean;
  onClose: () => void;
}

const RANK_META: Record<TrophyRank, { label: string; color: string; glow: string; bg: string; border: string }> = {
  BRONZE:   { label: "Bronze",   color: "text-amber-600",   glow: "shadow-amber-700/30",  bg: "bg-amber-900/20",  border: "border-amber-800/50"  },
  PRATA:    { label: "Prata",    color: "text-zinc-300",    glow: "shadow-zinc-500/30",   bg: "bg-zinc-800/30",   border: "border-zinc-600/50"   },
  OURO:     { label: "Ouro",     color: "text-yellow-400",  glow: "shadow-yellow-500/30", bg: "bg-yellow-900/20", border: "border-yellow-700/50" },
  PLATINA:  { label: "Platina",  color: "text-cyan-400",    glow: "shadow-cyan-500/30",   bg: "bg-cyan-900/20",   border: "border-cyan-700/50"   },
  DIAMANTE: { label: "Diamante", color: "text-violet-400",  glow: "shadow-violet-500/30", bg: "bg-violet-900/20", border: "border-violet-700/50" },
  MESTRE:   { label: "Mestre",   color: "text-red-400",     glow: "shadow-red-500/40",    bg: "bg-red-900/20",    border: "border-red-700/50"    },
};

// Agrupa tiers por divisão mantendo a ordem
const RANK_ORDER: TrophyRank[] = ["BRONZE", "PRATA", "OURO", "PLATINA", "DIAMANTE", "MESTRE"];
const tiersByRank = RANK_ORDER.map((rank) => ({
  rank,
  tiers: TROPHY_TIERS.filter((t) => t.rank === rank),
}));

export default function RankProgressModal({ trophies, isOpen, onClose }: Props) {
  const current = getTierInfo(trophies);
  const currentIdx = TROPHY_TIERS.findIndex((t) => t.rank === current.rank && t.tier === current.tier);
  const nextTier = currentIdx < TROPHY_TIERS.length - 1 ? TROPHY_TIERS[currentIdx + 1] : null;

  const withinProgress = current.max !== null
    ? Math.min(((trophies - current.min) / (current.max - current.min)) * 100, 100)
    : 100;

  const trophiesToNext = nextTier ? nextTier.min - trophies : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[200] max-h-[90vh] flex flex-col pb-20 rounded-t-2xl bg-zinc-950 border-t border-zinc-800 overflow-hidden"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-zinc-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-4 border-b border-zinc-800/60 shrink-0">
              <h2 className="font-jaro text-lg text-zinc-100">Patentes</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Current rank hero */}
            <div className="px-5 py-5 shrink-0">
              <div className={`rounded-2xl border ${RANK_META[current.rank].border} ${RANK_META[current.rank].bg} p-4`}>
                <div className="flex items-center gap-4">
                  {/* Badge grande */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/ranks/${getTrophyAssetName(trophies)}.png`}
                    alt={getTrophyLabel(trophies)}
                    style={{ width: 64, height: 64 }}
                    className="object-contain shrink-0 drop-shadow-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`font-jaro text-2xl leading-none ${RANK_META[current.rank].color}`}>
                      {getTrophyLabel(trophies)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/images/TROFEU.png" alt="" style={{ width: 13, height: 13 }} className="object-contain" />
                      <span className="font-inconsolata text-sm text-zinc-300">
                        {trophies.toLocaleString("pt-BR")} troféus
                      </span>
                    </div>
                  </div>

                  {nextTier && (
                    <div className="text-right shrink-0">
                      <p className="font-inconsolata text-[10px] text-zinc-500 uppercase tracking-wide">Próxima</p>
                      <p className="font-jaro text-sm text-zinc-300">{getTrophyLabel(nextTier.min)}</p>
                      <p className="font-inconsolata text-[11px] text-zinc-500 mt-0.5">
                        faltam {trophiesToNext} 🏆
                      </p>
                    </div>
                  )}
                  {!nextTier && (
                    <div className="text-right shrink-0">
                      <p className={`font-jaro text-sm ${RANK_META["MESTRE"].color}`}>Rank máximo</p>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between font-inconsolata text-[10px] text-zinc-500 mb-1.5">
                    <span>{trophies - current.min} / {current.max !== null ? current.max - current.min : "∞"}</span>
                    <span>{current.max !== null ? `${Math.round(withinProgress)}%` : "MAX"}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        current.rank === "BRONZE"   ? "bg-amber-600" :
                        current.rank === "PRATA"    ? "bg-zinc-400" :
                        current.rank === "OURO"     ? "bg-yellow-400" :
                        current.rank === "PLATINA"  ? "bg-cyan-400" :
                        current.rank === "DIAMANTE" ? "bg-violet-400" :
                        "bg-red-400"
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${withinProgress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tier list */}
            <div className="overflow-y-auto flex-1 px-5 pb-8 space-y-3">
              {tiersByRank.map(({ rank, tiers }) => {
                const meta = RANK_META[rank];
                return (
                  <div key={rank}>
                    <p className={`font-jaro text-sm mb-2 ${meta.color}`}>{meta.label}</p>
                    <div className="space-y-2">
                      {tiers.map((tier) => {
                        const isCurrentTier = tier.rank === current.rank && tier.tier === current.tier;
                        const isUnlocked = trophies >= tier.min;
                        const tierAsset = tier.rank === "MESTRE" ? "MESTRE" : `${tier.rank}_${tier.tier}`;
                        const tierLabel = tier.rank === "MESTRE" ? "Mestre" : `${meta.label} ${tier.tier}`;

                        return (
                          <div
                            key={`${tier.rank}_${tier.tier}`}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors ${
                              isCurrentTier
                                ? `${meta.bg} ${meta.border} shadow-md ${meta.glow}`
                                : isUnlocked
                                ? "bg-zinc-900/60 border-zinc-800/60"
                                : "bg-zinc-900/30 border-zinc-800/30 opacity-50"
                            }`}
                          >
                            {/* Badge */}
                            <div className="relative shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/ranks/${tierAsset}.png`}
                                alt={tierLabel}
                                style={{ width: 36, height: 36 }}
                                className={`object-contain ${!isUnlocked ? "grayscale" : ""}`}
                              />
                              {!isUnlocked && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Lock size={12} className="text-zinc-600" />
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`font-jaro text-sm leading-none ${isCurrentTier ? meta.color : isUnlocked ? "text-zinc-200" : "text-zinc-600"}`}>
                                  {tierLabel}
                                </p>
                                {isCurrentTier && (
                                  <span className={`font-inconsolata text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide ${meta.bg} ${meta.color} border ${meta.border}`}>
                                    Atual
                                  </span>
                                )}
                                {isUnlocked && !isCurrentTier && (
                                  <span className="font-inconsolata text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wide bg-zinc-800 text-zinc-400 border border-zinc-700">
                                    ✓
                                  </span>
                                )}
                              </div>
                              <p className="font-inconsolata text-[10px] text-zinc-500 mt-0.5">
                                {tier.max !== null
                                  ? `${tier.min.toLocaleString("pt-BR")} – ${tier.max.toLocaleString("pt-BR")} troféus`
                                  : `${tier.min.toLocaleString("pt-BR")}+ troféus`}
                              </p>
                            </div>

                            {/* Arrow / progress */}
                            {isCurrentTier && nextTier && (
                              <div className="shrink-0 text-right">
                                <ChevronRight size={16} className={meta.color} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
