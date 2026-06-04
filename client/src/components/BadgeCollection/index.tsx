"use client";

import { useMemo } from "react";
import UserBadge from "@/components/UserBadge";
import type { UserItem } from "@/types/shop";
import { RARITY_LABELS, getRarityChipClass } from "@/constants/rarity";
import { Star, Loader2, Trash2 } from "lucide-react";

interface BadgeCollectionProps {
  badgeItems: UserItem[];
  isOwner?: boolean;
  onEquip?: (item: UserItem) => void;
  onSell?: (item: UserItem) => void;
  equippingId?: number | null;
  sellingId?: number | null;
}

export default function BadgeCollection({ badgeItems = [], isOwner = false, onEquip, onSell, equippingId, sellingId }: BadgeCollectionProps) {
  const ownedCount = badgeItems.length;

  const byRarity = useMemo(() => {
    const groups: Record<string, UserItem[]> = {
      legendary: [],
      epic: [],
      rare: [],
      common: [],
    };
    badgeItems.forEach((item) => {
      const key = (item.rarity ?? "common") as keyof typeof groups;
      if (groups[key]) {
        groups[key].push(item);
      } else {
        groups.common.push(item);
      }
    });
    return groups;
  }, [badgeItems]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-jaro text-base text-white flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400" />
          Coleção de Emblemas
        </h2>
        <span className="text-xs font-inconsolata text-zinc-500">
          {ownedCount}
        </span>
      </div>

      {/* Grid de badges por raridade */}
      <div className="space-y-4">
        {(["legendary", "epic", "rare", "common"] as const).map((rarity) => {
          const items = byRarity[rarity];
          if (items.length === 0) return null;

          const rarityInfo: Record<string, { label: string; color: string; bgColor: string }> = {
            legendary: { label: "Lendário", color: "text-yellow-400", bgColor: "bg-yellow-400/10" },
            epic: { label: "Épico", color: "text-purple-400", bgColor: "bg-purple-400/10" },
            rare: { label: "Raro", color: "text-blue-400", bgColor: "bg-blue-400/10" },
            common: { label: "Comum", color: "text-zinc-400", bgColor: "bg-zinc-400/10" },
          };

          const info = rarityInfo[rarity];

          return (
            <div key={rarity} className="space-y-2">
              <span className={`text-[10px] font-inconsolata uppercase tracking-widest ${info.color}`}>
                {info.label}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items.map((item) => {
                  const Tag = onEquip ? "button" : "div";
                  return (
                    <Tag
                      key={item.id}
                      onClick={onEquip ? () => onEquip(item) : undefined}
                      className={`relative rounded-xl border ${
                        item.equipped
                          ? "border-cyan-500/50 bg-cyan-500/5"
                          : "border-zinc-700 bg-gradient-to-br from-zinc-800/50 to-zinc-900/50"
                      } p-3 flex flex-col items-center gap-2 ${onEquip ? "cursor-pointer hover:border-zinc-500 transition-all" : ""}`}
                    >
                      <UserBadge badge={item.value ? JSON.parse(item.value).badge : null} imageUrl={item.imageUrl} variant="medium" />
                      <div className="text-center w-full min-w-0">
                        <p className="text-[10px] font-inconsolata text-zinc-200 font-semibold truncate">
                          {item.name}
                        </p>
                        {item.rarity && (
                          <p className={`text-[9px] font-inconsolata ${getRarityChipClass(item.rarity)} mt-0.5 inline-block px-1.5 py-0.5 rounded capitalize`}>
                            {RARITY_LABELS[item.rarity] ?? item.rarity}
                          </p>
                        )}
                      </div>
                      {item.equipped && (
                        <div className="px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded text-[8px] text-green-400 font-inconsolata font-semibold">
                          EQUIPADO
                        </div>
                      )}
                      {isOwner && onSell && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onSell(item); }}
                          className="text-[9px] font-inconsolata text-zinc-500 hover:text-red-400 transition-colors mt-1 flex items-center gap-1"
                        >
                          <Trash2 size={10} />
                          Vender
                        </button>
                      )}
                      {(equippingId === item.id || sellingId === item.id) && (
                        <div className="absolute inset-0 grid place-items-center bg-zinc-900/80 rounded-xl">
                          <Loader2 size={16} className="animate-spin text-cyan-400" />
                        </div>
                      )}
                    </Tag>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {ownedCount === 0 && (
        <p className="text-center text-sm text-zinc-500 font-inconsolata py-4">
          {isOwner
            ? "Compre emblemas na loja para começar sua coleção!"
            : "Este jogador ainda não possui emblemas."}
        </p>
      )}
    </div>
  );
}
