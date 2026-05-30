"use client";

import { useMemo } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { PLAYER_COLORS } from "@/types/game";
import { getPropData } from "@/utils/properties";
import type { Player, SessionPropriedade } from "@/types/game";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR");
}

function calculatePatrimonio(player: Player, allPosses: SessionPropriedade[]): number {
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

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4 px-4 sm:px-6 lg:px-10">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-jaro text-zinc-100">Ranking</h2>
        <span className="text-xs font-inconsolata text-zinc-600">
          {rankedPlayers.length} jogador{rankedPlayers.length !== 1 ? "es" : ""}
        </span>
      </div>

      <div className="space-y-2">
        {rankedPlayers.map((entry) => {
          const pColor = PLAYER_COLORS.find((c) => c.value === entry.player.cor);
          const isMe = entry.player.id === currentPlayer?.id;

          return (
            <div
              key={entry.player.id}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                isMe
                  ? "bg-green-500/5 border-green-500/30"
                  : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
              }`}
            >
              <div className="w-8 text-center">
                {entry.pos <= 3 ? (
                  <span className="text-lg">{medals[entry.pos - 1]}</span>
                ) : (
                  <span className="text-sm font-inconsolata text-zinc-500">#{entry.pos}</span>
                )}
              </div>

              <div className={`w-10 h-10 rounded-full ${pColor?.bg || "bg-zinc-600"} flex items-center justify-center flex-shrink-0`}>
                <span className="text-white text-sm font-bold">
                  {entry.player.nome.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-inconsolata truncate ${isMe ? "text-green-400 font-bold" : "text-zinc-200"}`}>
                    {entry.player.nome}
                  </p>
                  {isMe && (
                    <span className="text-[10px] font-inconsolata text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
                      VOCÊ
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs font-inconsolata text-zinc-500 mt-0.5">
                  <span>R$ {formatCurrency(entry.player.saldo)}</span>
                  <span className="text-zinc-700">·</span>
                  <span>{entry.propCount} propriedade{entry.propCount !== 1 ? "s" : ""}</span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-[11px] font-inconsolata text-zinc-600 uppercase tracking-wider">Patrimônio</p>
                <p className="text-base font-jaro text-zinc-100">R$ {formatCurrency(entry.patrimonio)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {rankedPlayers.length === 0 && (
        <p className="text-sm font-inconsolata text-zinc-500">Nenhum jogador na sessão.</p>
      )}
    </div>
  );
}
