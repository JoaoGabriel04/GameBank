"use client";

import { useMemo } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { getPropData } from "@/utils/properties";
import type { Player, SessionPropriedade } from "@/types/game";
import PlayerCard from "../PlayerCard";

function calculatePatrimonio(player: Player, allPosses: SessionPropriedade[]): number {
  if (player.desistiu && player.patrimonyAtDesistir != null) {
    return player.patrimonyAtDesistir;
  }
  let total = player.saldo;
  for (const sp of allPosses) {
    if (sp.playerId !== player.id) continue;
    const prop = getPropData(sp);
    if (!prop) continue;
    if (sp.hipotecada) {
      total += prop.hipoteca;
    } else {
      total += prop.custo_compra;
      total += sp.casas * prop.custo_casa;
    }
  }
  return total;
}

interface RankedPlayer {
  player: Player;
  patrimonio: number;
  propCount: number;
  pos: number;
}

export default function Ranking() {
  const currentSession = useGameStore((s) => s.currentSession);
  const authUser = useAuthStore((s) => s.user);

  const currentPlayer = currentSession?.jogadores?.find(
    (p) => p.userId === authUser?.id
  );

  const rankedPlayers = useMemo<RankedPlayer[]>(() => {
    if (!currentSession?.jogadores) return [];
    const allPosses = currentSession.sessionPosses ?? [];
    return currentSession.jogadores
      .map((p) => ({
        player: p,
        patrimonio: calculatePatrimonio(p, allPosses),
        propCount: allPosses.filter((sp) => sp.playerId === p.id).length,
        pos: 0,
      }))
      .sort((a, b) => b.patrimonio - a.patrimonio)
      .map((entry, index) => ({ ...entry, pos: index + 1 }));
  }, [currentSession]);

  if (!currentSession) return null;


  return (
    <div className="space-y-4 px-4 sm:px-6 lg:px-10">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-jaro text-zinc-100">Ranking</h2>
        <span className="text-xs font-inconsolata text-zinc-600">
          {rankedPlayers.length} jogador{rankedPlayers.length !== 1 ? "es" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rankedPlayers.map((entry) => (
          <PlayerCard
            key={entry.player.id}
            player={entry.player}
            patrimonio={entry.patrimonio}
            rankPosition={entry.pos}
            isMe={entry.player.id === currentPlayer?.id}
            propCount={entry.propCount}
            desistiu={entry.player.desistiu}
          />
        ))}
      </div>

      {rankedPlayers.length === 0 && (
        <p className="text-sm font-inconsolata text-zinc-500">Nenhum jogador na sessão.</p>
      )}
    </div>
  );
}
