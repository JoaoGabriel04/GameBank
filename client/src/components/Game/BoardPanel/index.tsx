"use client";

import Board from "@/components/Board";
import type { GameSession } from "@/types/game";

type Props = {
  session: GameSession;
  meuPlayerId?: number;
  onMaximize: () => void;
};

export default function BoardPanel({ session, meuPlayerId, onMaximize }: Props) {
  if (!session.tabuleiro) return null;

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="relative flex-1 min-h-0">
        <Board
          tabuleiro={session.tabuleiro}
          session={session}
          meuPlayerId={meuPlayerId}
          interativo={false}
          onMaximize={onMaximize}
        />
      </div>
    </div>
  );
}
