"use client";

import type { Player, SessionPropriedade, Propriedade } from "@/types/game";
import { getAccentHex } from "@/components/Game/sections/shared";
import { formatCurrency } from "@/utils/format";
import UserBadge from "@/components/UserBadge";

type Props = {
  item: { sessionProp: SessionPropriedade; prop: Propriedade };
  selected: boolean;
  onClick: () => void;
  getAluguel: (prop: Propriedade, casas: number) => number;
  owner?: Player | null;
};

export default function PropertyCard({ item, selected, onClick, getAluguel, owner }: Props) {
  const accent = getAccentHex(item.prop.grupo_cor);
  const casas = item.sessionProp.casas ?? 0;
  const aluguelValor = getAluguel(item.prop, casas);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border overflow-hidden transition-all cursor-pointer text-left ${
        selected
          ? "border-amber-400 bg-amber-500/5"
          : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-500"
      }`}
    >
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />
      <div className="p-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-inconsolata text-zinc-200 truncate">{item.prop.nome}</span>
          <span className="shrink-0 text-[10px] font-inconsolata px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400">
            {item.prop.grupo_cor}
          </span>
        </div>
        <div className="flex items-center gap-1 mb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-sm ${i < casas ? "opacity-100" : "opacity-20"}`} style={{ backgroundColor: accent }} />
          ))}
        </div>
        <div className="flex justify-between text-xs font-inconsolata text-zinc-400">
          <span>&#127968; {casas}/{5}</span>
          <span className="text-green-400">R$ {formatCurrency(aluguelValor)}</span>
        </div>
        {owner && (
          <div className="flex items-center gap-1 mt-2 text-[10px] font-inconsolata text-zinc-500">
            Dono: <UserBadge badge={owner.badge} imageUrl={owner.badgeImageUrl} variant="micro" />
            <span className="text-zinc-400">{owner.nome}</span>
          </div>
        )}
      </div>
    </button>
  );
}
