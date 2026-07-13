"use client";

import Board from "@/components/Board";
import type { GameSession } from "@/types/game";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExpand } from "@fortawesome/free-solid-svg-icons";

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
        />
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
          <button
            onClick={onMaximize}
            title="Maximizar tabuleiro"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/50 hover:bg-black/70 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer backdrop-blur-sm"
          >
            <FontAwesomeIcon icon={faExpand} className="text-xs" />
          </button>
        </div>
      </div>
    </div>
  );
}
