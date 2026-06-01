"use client";

import { useMemo } from "react";
import UserBadge from "@/components/UserBadge";
import { resolveBadge, BADGE_PRESETS, getBadgeStatus, getExpirationText, getLimitedEditionStatus, getLimitedEditionText } from "@/constants/badges";
import { Star, Lock, Clock, AlertCircle, Zap } from "lucide-react";

interface BadgeCollectionProps {
  userBadges?: string[]; // slugs dos badges que o usuário tem
  isOwner?: boolean; // se é o perfil do próprio usuário
}

export default function BadgeCollection({ userBadges = [], isOwner = false }: BadgeCollectionProps) {
  const badgesWithStatus = useMemo(() => {
    return BADGE_PRESETS.map((preset) => ({
      preset,
      owned: userBadges.includes(preset.slug),
    }));
  }, [userBadges]);

  // Agrupar por raridade
  const byRarity = useMemo(() => {
    const groups: Record<string, typeof badgesWithStatus> = {
      legendary: [],
      epic: [],
      rare: [],
      common: [],
    };
    badgesWithStatus.forEach((item) => {
      groups[item.preset.rarity].push(item);
    });
    return groups;
  }, [badgesWithStatus]);

  const ownedCount = badgesWithStatus.filter((b) => b.owned).length;
  const totalCount = BADGE_PRESETS.length;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-jaro text-base text-white flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400" />
          Coleção de Emblemas
        </h2>
        <span className="text-xs font-inconsolata text-zinc-500">
          {ownedCount}/{totalCount}
        </span>
      </div>

      {/* Grid de badges por raridade */}
      <div className="space-y-4">
        {(["legendary", "epic", "rare", "common"] as const).map((rarity) => {
          const badges = byRarity[rarity];
          if (badges.length === 0) return null;

          const rarityLabels: Record<typeof rarity, { label: string; color: string; bgColor: string }> = {
            legendary: { label: "Lendário", color: "text-yellow-400", bgColor: "bg-yellow-400/10" },
            epic: { label: "Épico", color: "text-purple-400", bgColor: "bg-purple-400/10" },
            rare: { label: "Raro", color: "text-blue-400", bgColor: "bg-blue-400/10" },
            common: { label: "Comum", color: "text-zinc-400", bgColor: "bg-zinc-400/10" },
          };

          const rarityInfo = rarityLabels[rarity];

          return (
            <div key={rarity} className="space-y-2">
              <span className={`text-[10px] font-inconsolata uppercase tracking-widest ${rarityInfo.color}`}>
                {rarityInfo.label}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {badges.map(({ preset, owned }) => {
                  const status = owned ? getBadgeStatus(preset) : null;
                  const expirationText = owned ? getExpirationText(preset) : null;
                  const limitedStatus = getLimitedEditionStatus(preset);
                  const limitedText = getLimitedEditionText(preset);

                  return (
                    <div
                      key={preset.slug}
                      className={`relative rounded-xl border p-3 flex flex-col items-center gap-2 transition-all ${
                        owned
                          ? status === "expired"
                            ? "border-zinc-700/50 bg-gradient-to-br from-zinc-800/30 to-zinc-900/30 opacity-60"
                            : status === "expiring_soon"
                            ? `border-orange-500/40 bg-gradient-to-br from-orange-900/20 to-zinc-900/40`
                            : limitedStatus === "very_rare"
                            ? `border-red-500/40 bg-gradient-to-br from-red-900/20 to-zinc-900/40`
                            : limitedStatus === "rare"
                            ? `border-yellow-500/40 bg-gradient-to-br from-yellow-900/20 to-zinc-900/40`
                            : `border-zinc-700 bg-gradient-to-br from-zinc-800/50 to-zinc-900/50`
                          : `border-zinc-800 bg-zinc-950/50 opacity-50`
                      }`}
                    >
                      {/* Cadeado para não possuído */}
                      {!owned && (
                        <div className="absolute -top-2 -right-2 w-5 h-5 bg-zinc-700 rounded-full flex items-center justify-center">
                          <Lock className="w-3 h-3 text-zinc-400" />
                        </div>
                      )}

                      {/* Ícone de expiração */}
                      {owned && status === "expiring_soon" && (
                        <div className="absolute -top-2 -right-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                          <Clock className="w-3 h-3 text-white" />
                        </div>
                      )}

                      {/* Ícone de limited edition raro */}
                      {owned && preset.limitedEdition && limitedStatus === "very_rare" && (
                        <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                          <Zap className="w-3 h-3 text-white" />
                        </div>
                      )}

                      {/* Badge */}
                      <UserBadge badge={preset.slug} variant="medium" />

                      {/* Nome e raridade */}
                      <div className="text-center w-full min-w-0">
                        <p className="text-[10px] font-inconsolata text-zinc-200 font-semibold truncate">
                          {preset.label}
                        </p>
                        <p className="text-[9px] font-inconsolata text-zinc-500 truncate">{preset.rarity}</p>
                      </div>

                      {/* Status */}
                      {owned && status === "expired" && (
                        <div className="mt-1 px-2 py-0.5 bg-zinc-700/50 border border-zinc-600/50 rounded text-[8px] text-zinc-400 font-inconsolata font-semibold">
                          EXPIRADO
                        </div>
                      )}
                      {owned && status === "expiring_soon" && expirationText && (
                        <div className="mt-1 px-2 py-0.5 bg-orange-500/20 border border-orange-500/40 rounded text-[8px] text-orange-400 font-inconsolata font-semibold">
                          {expirationText}
                        </div>
                      )}
                      {owned && preset.limitedEdition && limitedText && (
                        <div className={`mt-1 px-2 py-0.5 border rounded text-[8px] font-inconsolata font-semibold ${
                          limitedStatus === "sold_out"
                            ? "bg-zinc-700/50 border-zinc-600/50 text-zinc-400"
                            : limitedStatus === "very_rare"
                            ? "bg-red-500/20 border-red-500/40 text-red-400"
                            : limitedStatus === "rare"
                            ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400"
                            : "bg-blue-500/20 border-blue-500/40 text-blue-400"
                        }`}>
                          {limitedText}
                        </div>
                      )}
                      {owned && status === "active" && !preset.limitedEdition && (
                        <div className="mt-1 px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded text-[8px] text-green-400 font-inconsolata font-semibold">
                          POSSUÍDO
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

      {/* Mensagem vazia */}
      {ownedCount === 0 && !isOwner && (
        <p className="text-center text-sm text-zinc-500 font-inconsolata py-4">
          Este jogador ainda não possui emblemas.
        </p>
      )}

      {ownedCount === 0 && isOwner && (
        <p className="text-center text-sm text-zinc-500 font-inconsolata py-4">
          Compre emblemas na loja para começar sua coleção!
        </p>
      )}
    </div>
  );
}
