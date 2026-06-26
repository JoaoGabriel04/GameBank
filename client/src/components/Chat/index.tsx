"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { slideUp } from "@/lib/animations";
import {
  useChatStore,
  sendChatMessage,
  onKickVoteRequest,
  onKickVoteUpdate,
  onKickVoteResult,
  clearKickVoteCallbacks,
  emitKickVoteInit,
  emitKickVote,
  type KickVoteRequestData,
  type KickVoteUpdateData,
} from "@/stores/socketStore";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { MessageCircle, Send, X, UserMinus, ChevronDown, CheckCircle, XCircle, Clock } from "lucide-react";
import UserBadge from "@/components/UserBadge";

export default function Chat() {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [showKickPicker, setShowKickPicker] = useState(false);
  const [kickVote, setKickVote] = useState<KickVoteRequestData | null>(null);
  const [kickUpdate, setKickUpdate] = useState<KickVoteUpdateData | null>(null);
  const [kickResult, setKickResult] = useState<{ passed: boolean; targetNome: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [myKickVote, setMyKickVote] = useState<"yes" | "no" | null>(null);

  const messages   = useChatStore((s) => s.messages);
  const session    = useGameStore((s) => s.currentSession);
  const authUser   = useAuthStore((s) => s.user);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const myPlayer = session?.jogadores?.find((p) => p.userId === authUser?.id);
  const myPlayerId  = myPlayer?.id;
  const isActivePlayer = !!myPlayer && !myPlayer.desistiu;

  // Jogadores elegíveis para expulsão: ativos, não-espectadores, não eu mesmo
  const kickTargets = (session?.jogadores ?? []).filter(
    (p) => !p.desistiu && p.id !== myPlayerId
  );

  // Callbacks de votação de expulsão
  useEffect(() => {
    onKickVoteRequest((data) => {
      setKickVote(data);
      setKickUpdate(null);
      setKickResult(null);
      setMyKickVote(null);
      const remaining = Math.round((new Date(data.expiresAt).getTime() - Date.now()) / 1000);
      setSecondsLeft(Math.max(0, remaining));
    });
    onKickVoteUpdate((data) => {
      setKickUpdate(data);
    });
    onKickVoteResult((data) => {
      setKickResult({ passed: data.passed, targetNome: data.targetNome });
      setKickVote(null);
      setKickUpdate(null);
      if (timerRef.current) clearInterval(timerRef.current);
      // Remove resultado após 5 s
      setTimeout(() => setKickResult(null), 5000);
    });
    return () => clearKickVoteCallbacks();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!kickVote) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          // Remove o card se expirar sem resolução do servidor
          setTimeout(() => setKickVote((v) => (v ? null : v)), 200);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [kickVote]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const handleSend = () => {
    if (!texto.trim()) return;
    sendChatMessage(texto.trim());
    setTexto("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleKickInit = useCallback((targetPlayerId: number) => {
    emitKickVoteInit(targetPlayerId);
    setShowKickPicker(false);
  }, []);

  const handleKickVote = (vote: "yes" | "no") => {
    if (myKickVote) return;
    setMyKickVote(vote);
    emitKickVote(vote);
  };

  const playerNames   = new Map(session?.jogadores.map((j) => [j.id, j.nome]) || []);
  const playerBadges  = new Map(session?.jogadores.map((j) => [j.id, j.badge]) || []);
  const playerBadgeImages = new Map(session?.jogadores.map((j) => [j.id, j.badgeImageUrl]) || []);

  // Dados do voto atual
  const votes        = kickUpdate?.votes ?? kickVote?.votes ?? {};
  const requiredIds  = kickUpdate?.requiredUserIds ?? kickVote?.requiredUserIds ?? [];
  const yesCount     = requiredIds.filter((uid) => votes[uid] === "yes").length;
  const noCount      = requiredIds.filter((uid) => votes[uid] === "no").length;
  const total        = requiredIds.length;
  const myUserId     = authUser?.id;
  const isEligible   = isActivePlayer && !!myUserId && requiredIds.includes(myUserId);
  const alreadyVoted = !!myUserId && votes[myUserId] !== undefined;

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 lg:bottom-6 left-6 z-50 w-14 h-14 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-full flex items-center justify-center hover:border-green-500 transition-colors cursor-pointer"
      >
        <MessageCircle className="text-zinc-300 w-6 h-6" />
        {kickVote && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-zinc-900 animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={slideUp}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed bottom-40 lg:bottom-24 left-6 z-50 w-80 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-xl flex flex-col shadow-xl max-h-[28rem]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 shrink-0">
              <span className="text-zinc-100 font-jaro text-sm">Chat</span>
              <div className="flex items-center gap-2">
                {/* Botão iniciar votação de expulsão (só jogadores ativos, sem voto ativo) */}
                {isActivePlayer && !kickVote && kickTargets.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowKickPicker((v) => !v)}
                      title="Votar expulsão"
                      className="flex items-center gap-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer px-1"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      <ChevronDown className={`w-3 h-3 transition-transform ${showKickPicker ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {showKickPicker && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute right-0 top-full mt-1 w-44 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10 overflow-hidden"
                        >
                          <p className="px-3 py-1.5 text-[10px] text-zinc-500 font-inconsolata uppercase tracking-wider border-b border-zinc-700">
                            Votar expulsar
                          </p>
                          {kickTargets.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => handleKickInit(p.id)}
                              className="w-full text-left px-3 py-2 text-xs font-inconsolata text-zinc-300 hover:bg-red-900/30 hover:text-red-300 transition-colors cursor-pointer"
                            >
                              {p.nome}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0">
              {messages.length === 0 && (
                <p className="text-zinc-600 text-xs text-center font-inconsolata mt-8">
                  Nenhuma mensagem ainda
                </p>
              )}
              {messages.map((msg) => {
                const isMe = msg.playerId === myPlayerId;
                return (
                  <div key={msg.id} className={`text-sm flex items-center gap-1 ${isMe ? "justify-end" : "justify-start"}`}>
                    {isMe ? (
                      <>
                        <span className="text-zinc-300 text-xs font-inconsolata">{msg.texto}</span>
                        <span className="text-green-400 font-bold text-xs">:Você</span>
                      </>
                    ) : (
                      <>
                        <UserBadge badge={playerBadges.get(msg.playerId)} imageUrl={playerBadgeImages.get(msg.playerId)} className="w-3 h-3 text-[7px] shrink-0" />
                        <span className="font-bold text-xs" style={{ color: getPlayerColor(msg.playerId, session) }}>
                          {playerNames.get(msg.playerId) || msg.playerNome}
                        </span>
                        <span className="text-zinc-500 text-xs mr-1">:</span>
                        <span className="text-zinc-300 text-xs font-inconsolata">{msg.texto}</span>
                      </>
                    )}
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Card de votação de expulsão ativa */}
            <AnimatePresence>
              {kickVote && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-red-800/40 bg-red-950/20 shrink-0 overflow-hidden"
                >
                  <div className="px-4 py-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-inconsolata text-[10px] text-red-400 uppercase tracking-wider">
                          Votação de expulsão
                        </p>
                        <p className="font-inconsolata text-xs text-zinc-300 mt-0.5">
                          <span className="text-zinc-100 font-semibold">{kickVote.initiatorNome}</span>
                          {" "}propôs expulsar{" "}
                          <span className="text-red-300 font-semibold">{kickVote.targetNome}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-zinc-500 shrink-0 ml-2">
                        <Clock className="w-3 h-3" />
                        <span className="font-inconsolata text-[10px]">{secondsLeft}s</span>
                      </div>
                    </div>

                    {/* Placar */}
                    <div className="flex gap-2 mb-2.5">
                      <div className="flex items-center gap-1 text-green-400">
                        <CheckCircle className="w-3 h-3" />
                        <span className="font-inconsolata text-[10px]">{yesCount} sim</span>
                      </div>
                      <div className="flex items-center gap-1 text-red-400">
                        <XCircle className="w-3 h-3" />
                        <span className="font-inconsolata text-[10px]">{noCount} não</span>
                      </div>
                      <span className="font-inconsolata text-[10px] text-zinc-600 ml-auto">{total} elegíveis</span>
                    </div>

                    {/* Votos individuais */}
                    <div className="flex flex-col gap-1 mb-2.5">
                      {requiredIds.map((uid) => {
                        const nome = kickVote.playerNames?.[uid] ?? `Jogador #${uid}`;
                        const v = votes[uid];
                        return (
                          <div key={uid} className="flex items-center justify-between">
                            <span className="font-inconsolata text-[10px] text-zinc-500">{nome}</span>
                            {v === "yes" ? <CheckCircle className="w-3 h-3 text-green-400" />
                              : v === "no" ? <XCircle className="w-3 h-3 text-red-400" />
                              : <Clock className="w-3 h-3 text-zinc-600 animate-pulse" />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Botões para elegíveis que ainda não votaram */}
                    {isEligible && !alreadyVoted && myUserId !== undefined && votes[myUserId] === undefined && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleKickVote("no")}
                          className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-300 rounded font-inconsolata text-[11px] transition-colors cursor-pointer"
                        >
                          Não
                        </button>
                        <button
                          onClick={() => handleKickVote("yes")}
                          className="flex-1 py-1.5 bg-red-900/50 hover:bg-red-800/70 border border-red-700/50 text-red-300 rounded font-inconsolata text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Expulsar
                        </button>
                      </div>
                    )}
                    {alreadyVoted && (
                      <p className="font-inconsolata text-[10px] text-zinc-600 text-center">
                        {myKickVote === "yes" ? "Você votou para expulsar" : "Você votou para manter"}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Resultado da votação */}
            <AnimatePresence>
              {kickResult && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`border-t shrink-0 px-4 py-2.5 ${kickResult.passed ? "border-red-800/40 bg-red-950/20" : "border-zinc-700 bg-zinc-800/40"}`}
                >
                  <p className="font-inconsolata text-xs text-center">
                    {kickResult.passed
                      ? <span className="text-red-300"><span className="font-semibold">{kickResult.targetNome}</span> foi expulso da partida.</span>
                      : <span className="text-zinc-400">Votação encerrada — <span className="font-semibold">{kickResult.targetNome}</span> permanece.</span>
                    }
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="px-4 py-3 border-t border-zinc-700 flex gap-2 shrink-0">
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

function getPlayerColor(playerId: number, session: { jogadores?: { id: number; cor?: string }[] } | null) {
  const player = session?.jogadores?.find((j) => j.id === playerId);
  if (!player) return "#a1a1aa";
  const colorMap: Record<string, string> = {
    red: "#ef4444", blue: "#3b82f6", green: "#22c55e",
    yellow: "#eab308", purple: "#a855f7", black: "#a1a1aa",
    orange: "#f97316", pink: "#ec4899", emerald: "#10b981",
  };
  return (player.cor ? colorMap[player.cor] : undefined) || "#a1a1aa";
}
