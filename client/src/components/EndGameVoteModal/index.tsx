'use client'

import { motion, AnimatePresence } from "framer-motion"
import { backdrop, modalBox } from "@/lib/animations"
import { CheckCircle, XCircle, Clock, Users } from "lucide-react"
import type { VoteRequestData, VoteUpdateData } from "@/stores/socketStore"

interface Props {
  isOpen: boolean
  isOwner: boolean
  voteData: VoteRequestData | null
  voteUpdate: VoteUpdateData | null
  onVote: (vote: "yes" | "no") => void
  myUserId?: number
  votingLoading?: boolean
}

export default function EndGameVoteModal({
  isOpen,
  isOwner,
  voteData,
  voteUpdate,
  onVote,
  myUserId,
  votingLoading = false,
}: Props) {
  if (!voteData) return null

  const votes = voteUpdate?.votes ?? voteData.currentVotes ?? {}
  const required = voteUpdate?.requiredUserIds ?? voteData.requiredUserIds
  const yesCount = required.filter((uid) => votes[uid] === "yes").length
  const total = required.length
  const myVote = myUserId ? votes[myUserId] : undefined
  const alreadyVoted = myVote !== undefined

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          {/* Backdrop sem pointer-events para bloquear clique — modal não pode ser fechado */}
          <motion.div
            variants={backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            variants={modalBox}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-sm mx-4 bg-zinc-900 border-2 border-amber-500/40 rounded-xl p-6 shadow-2xl"
          >
            {/* Ícone */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Users className="w-7 h-7 text-amber-400" />
              </div>
            </div>

            <h2 className="text-xl font-jaro text-zinc-100 text-center mb-1">
              Encerrar Partida?
            </h2>
            <p className="font-inconsolata text-sm text-zinc-400 text-center mb-5">
              {isOwner
                ? "Aguardando confirmação dos outros jogadores..."
                : `${voteData.ownerNome} quer encerrar a partida.`}
            </p>

            {/* Contagem de votos */}
            <div className="flex items-center justify-center gap-2 mb-5">
              <div className="flex items-center gap-1.5 bg-zinc-800 rounded-lg px-4 py-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="font-inconsolata text-sm text-green-400">
                  {yesCount}/{total} confirmaram
                </span>
              </div>
            </div>

            {/* Votos individuais */}
            <div className="flex flex-col gap-1.5 mb-5">
              {required.map((uid) => {
                const v = votes[uid]
                const nome = voteData.playerNames?.[uid] ?? `Jogador #${uid}`
                return (
                  <div
                    key={uid}
                    className="flex items-center justify-between bg-zinc-800/60 rounded-lg px-3 py-1.5"
                  >
                    <span className="font-inconsolata text-xs text-zinc-400">
                      {nome}
                    </span>
                    {v === "yes" ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : v === "no" ? (
                      <XCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-zinc-500 animate-pulse" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Botões de voto — só para não-donos que ainda não votaram */}
            {!isOwner && !alreadyVoted && (
              <div className="flex gap-3">
                <button
                  onClick={() => onVote("no")}
                  disabled={votingLoading}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-red-900/40 border border-zinc-700 hover:border-red-500/50 text-zinc-300 rounded-lg font-inconsolata text-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Recusar
                </button>
                <button
                  onClick={() => onVote("yes")}
                  disabled={votingLoading}
                  className="flex-1 py-2.5 bg-green-900/40 hover:bg-green-800/60 border border-green-700/50 hover:border-green-500 text-green-300 rounded-lg font-inconsolata text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            )}

            {!isOwner && alreadyVoted && (
              <div className="text-center">
                {myVote === "yes" ? (
                  <p className="font-inconsolata text-sm text-green-400 flex items-center justify-center gap-1.5">
                    <CheckCircle className="w-4 h-4" /> Você confirmou
                  </p>
                ) : (
                  <p className="font-inconsolata text-sm text-red-400 flex items-center justify-center gap-1.5">
                    <XCircle className="w-4 h-4" /> Você recusou
                  </p>
                )}
              </div>
            )}

            {isOwner && (
              <p className="font-inconsolata text-xs text-zinc-600 text-center">
                A votação expira automaticamente em 2 minutos.
              </p>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
