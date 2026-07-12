"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { backdrop, modalBox } from "@/lib/animations";
import Board from "@/components/Board";
import type { GameSession } from "@/types/game";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExpand, faCompress, faCrosshairs, faXmark } from "@fortawesome/free-solid-svg-icons";

type Props = {
  session: GameSession;
  meuPlayerId?: number;
  isOpen: boolean;
  onClose: () => void;
};

export default function BoardModal({ session, meuPlayerId, isOpen, onClose }: Props) {
  const minhaVez = !!meuPlayerId && session.turnoAtualPlayerId === meuPlayerId;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80"
          variants={backdrop}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            className="relative w-full h-full flex flex-col"
            variants={modalBox}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header do modal */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
              <h2 className="font-jaro text-sm text-zinc-100">Tabuleiro</h2>
              <div className="flex items-center gap-3">
                {minhaVez && (
                  <span className="text-xs font-inconsolata text-amber-400 animate-pulse">
                    É a sua vez — feche para jogar
                  </span>
                )}
                <button
                  onClick={onClose}
                  className="text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
                >
                  <FontAwesomeIcon icon={faXmark} className="text-xl" />
                </button>
              </div>
            </div>

            {/* Board maximizado — sem ações, só visualização */}
            <div className="flex-1 min-h-0">
              {session.tabuleiro && (
                <Board
                  tabuleiro={session.tabuleiro}
                  session={session}
                  meuPlayerId={meuPlayerId}
                />
              )}
            </div>

            {/* Aviso no rodapé */}
            <div className="px-4 py-2 bg-zinc-900 border-t border-zinc-800 shrink-0 text-center">
              <p className="text-[11px] font-inconsolata text-zinc-600">
                Visualização do tabuleiro — use o botão "Rolar Dados" na tela principal para jogar
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
