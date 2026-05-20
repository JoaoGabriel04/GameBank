"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import PlayerCard from "../PlayerCard";
import { Player, Propriedade } from "@/types/game";
import { useCallback } from "react";
interface PlayerWithNetWorth extends Player {
  netWorth: number;
}

export default function Inicio() {
  const { currentSession, getPropertyById } = useGameStore();
  const [sortedPlayers, setSortedPlayers] = useState<PlayerWithNetWorth[]>([]);

  const calculateNetWorth = useCallback(
    async (player: Player): Promise<number> => {
      if (!currentSession) return player.saldo;

      const playerProperties = currentSession.sessionPosses.filter(
        (p) => p.playerId === player.id
      );

      let propertyValue = 0;
      for (const sessionProp of playerProperties) {
        const propData: Propriedade | null = await getPropertyById(sessionProp.possesId);
        if (propData) {
          if (sessionProp.hipotecada) {
            propertyValue += propData.hipoteca;
          } else {
            propertyValue += propData.custo_compra;
            propertyValue += sessionProp.casas * propData.custo_casa;
          }
        }
      }

      return player.saldo + propertyValue;
    },
    [currentSession, getPropertyById]
  );

  useEffect(() => {
    const sortPlayers = async () => {
      if (!currentSession?.jogadores) {
        setSortedPlayers([]);
        return;
      }

      const playersWithNetWorth = await Promise.all(
        currentSession.jogadores.map(async (player) => ({
          ...player,
          netWorth: await calculateNetWorth(player),
        }))
      );

      playersWithNetWorth.sort((a, b) => b.netWorth - a.netWorth);
      setSortedPlayers(playersWithNetWorth);
    };

    sortPlayers();
  }, [currentSession, calculateNetWorth]);

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sortedPlayers.map((player) => (
        <PlayerCard key={player.id} player={player} totalPropertyValue={player.netWorth} />
      ))}
    </div>
  );
}