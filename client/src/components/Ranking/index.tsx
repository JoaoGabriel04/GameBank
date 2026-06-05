"use client";

import { useMemo } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { PLAYER_COLORS } from "@/types/game";
import { getPropData } from "@/utils/properties";
import { formatCurrency } from "@/utils/format";
import type { Player, SessionPropriedade } from "@/types/game";
import UserBanner from "../UserBanner";
import UserAvatar from "../UserAvatar";
import UserBadge from "../UserBadge";

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
              className={`relative overflow-hidden rounded-xl border transition-colors ${
                isMe ? "border-green-500/60" : "border-zinc-800 hover:border-zinc-600"
              }`}
            >
              <UserBanner banner={entry.player.banner} spriteId={entry.player.spriteId} className="absolute inset-0 w-full h-full" />
              <div className="absolute inset-0 bg-black/35" />
              <div className="relative z-10 flex items-center gap-4 p-4">
                <div className="w-8 text-center shrink-0">
                  {entry.pos <= 3 ? (
                    <span className="text-lg">{medals[entry.pos - 1]}</span>
                  ) : (
                    <span className="text-sm font-inconsolata text-zinc-400">#{entry.pos}</span>
                  )}
                </div>

                <UserAvatar
                  avatarUrl={entry.player.avatarUrl}
                  avatarUpdatedAt={entry.player.avatarUpdatedAt}
                  nome={entry.player.nome}
                  size="md"
                  ring={isMe}
                />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <UserBadge badge={entry.player.badge} imageUrl={entry.player.badgeImageUrl} variant="small" />
                      <p className={`text-sm font-inconsolata truncate ${isMe ? "text-green-400 font-bold" : "text-zinc-100"}`}>
                        {entry.player.nome}
                      </p>
                      {isMe && (
                      <span className="text-[10px] font-inconsolata text-green-500 bg-green-500/20 px-1.5 py-0.5 rounded">
                        VOCÊ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs font-inconsolata text-zinc-400 mt-0.5">
                    <span>R$ {formatCurrency(entry.player.saldo)}</span>
                    <span className="text-zinc-600">·</span>
                    <span>{entry.propCount} propriedade{entry.propCount !== 1 ? "s" : ""}</span>
                    {entry.player.desistiu && (
                      <span className="text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded text-[10px]">Desistiu</span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] font-inconsolata text-zinc-400 uppercase tracking-wider">Patrimônio</p>
                  <p className="text-base font-jaro text-zinc-100">R$ {formatCurrency(entry.patrimonio)}</p>
                </div>
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
