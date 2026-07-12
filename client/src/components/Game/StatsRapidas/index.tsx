"use client";

import { useMemo, useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import { formatCurrency } from "@/utils/format";
import { calcularPatrimonio } from "@/shared/economia-core";
import { Eye, EyeOff } from "lucide-react";

type Props = {
  meuPlayerId?: number;
};

export default function StatsRapidas({ meuPlayerId }: Props) {
  const currentSession = useGameStore((s) => s.currentSession);
  const [showSaldo, setShowSaldo] = useState(true);

  const currentPlayer = useMemo(
    () => currentSession?.jogadores?.find((p) => p.id === meuPlayerId),
    [currentSession, meuPlayerId]
  );

  const patrimonio = useMemo(() => {
    if (!currentPlayer || !currentSession) return 0;
    const posses = currentSession.sessionPosses
      .filter((sp) => sp.playerId === currentPlayer.id)
      .map((sp) => ({
        casas: sp.casas,
        propriedade: sp.propriedade
          ? { custo_compra: sp.propriedade.custo_compra, custo_casa: sp.propriedade.custo_casa }
          : null,
      }));
    return calcularPatrimonio(currentPlayer.saldo, posses);
  }, [currentPlayer, currentSession]);

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
      <div className="flex-1">
        <span className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wider">Saldo</span>
        <p className="text-lg font-jaro text-green-400">
          {showSaldo ? `R$ ${formatCurrency(currentPlayer?.saldo ?? 0)}` : "R$ •••••"}
        </p>
      </div>
      <div className="w-px h-8 bg-zinc-800" />
      <div className="flex-1">
        <span className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wider">Patrimônio</span>
        <p className="text-lg font-jaro text-amber-400">
          {showSaldo ? `R$ ${formatCurrency(patrimonio)}` : "R$ •••••"}
        </p>
      </div>
      <button
        onClick={() => setShowSaldo(!showSaldo)}
        className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer shrink-0"
      >
        {showSaldo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
