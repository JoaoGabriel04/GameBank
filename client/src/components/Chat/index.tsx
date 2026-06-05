"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { slideUp } from "@/lib/animations";
import { useChatStore, sendChatMessage } from "@/stores/socketStore";
import { useGameStore } from "@/stores/gameStore";
import { MessageCircle, Send, X } from "lucide-react";
import UserBadge from "@/components/UserBadge";

export default function Chat() {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const messages = useChatStore((s) => s.messages);
  const currentSession = useGameStore((s) => s.currentSession);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  const handleSend = () => {
    if (!texto.trim()) return;
    sendChatMessage(texto.trim());
    setTexto("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const playerNames = new Map(
    currentSession?.jogadores.map((j) => [j.id, j.nome]) || []
  );

  const playerBadges = new Map(
    currentSession?.jogadores.map((j) => [j.id, j.badge]) || []
  );

  const playerBadgeImages = new Map(
    currentSession?.jogadores.map((j) => [j.id, j.badgeImageUrl]) || []
  );

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 lg:bottom-6 left-6 z-50 w-14 h-14 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-full flex items-center justify-center hover:border-green-500 transition-colors cursor-pointer"
      >
        <MessageCircle className="text-zinc-300 w-6 h-6" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={slideUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed bottom-40 lg:bottom-24 left-6 z-50 w-80 h-96 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-xl flex flex-col shadow-xl"
          >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
            <span className="text-zinc-100 font-jaro text-sm">Chat</span>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
            {messages.length === 0 && (
              <p className="text-zinc-600 text-xs text-center font-inconsolata mt-8">
                Nenhuma mensagem ainda
              </p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="text-sm">
                <span className="inline-flex items-center gap-1">
                  <UserBadge badge={playerBadges.get(msg.playerId)} imageUrl={playerBadgeImages.get(msg.playerId)} className="w-3 h-3 text-[7px]" />
                  <span
                    className="font-bold text-xs"
                    style={{ color: getPlayerColor(msg.playerId, currentSession) }}
                  >
                    {playerNames.get(msg.playerId) || msg.playerNome}
                  </span>
                  <span className="text-zinc-500 text-xs mr-1">:</span>
                </span>
                <span className="text-zinc-300 text-xs font-inconsolata">{msg.texto}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="px-4 py-3 border-t border-zinc-700 flex gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-zinc-800 text-zinc-100 text-sm rounded-lg px-3 py-2 border border-zinc-600 focus:outline-none focus:border-green-500 font-inconsolata"
            />
            <button
              onClick={handleSend}
              disabled={!texto.trim()}
              className="bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function getPlayerColor(playerId: number, session: any) {
  const player = session?.jogadores?.find((j: any) => j.id === playerId);
  if (!player) return "#a1a1aa";
  const colorMap: Record<string, string> = {
    red: "#ef4444", blue: "#3b82f6", green: "#22c55e",
    yellow: "#eab308", purple: "#a855f7", black: "#a1a1aa",
    orange: "#f97316", pink: "#ec4899", emerald: "#10b981",
  };
  return colorMap[player.cor] || "#a1a1aa";
}
