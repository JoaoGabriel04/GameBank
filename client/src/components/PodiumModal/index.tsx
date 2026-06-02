"use client"

import { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCrown, faCoins, faBolt, faXmark } from "@fortawesome/free-solid-svg-icons"
import type { RankedPlayer } from "@/types/game"
import UserBanner from "@/components/UserBanner"
import UserAvatar from "@/components/UserAvatar"
import UserBadge from "@/components/UserBadge"

interface PodiumModalProps {
  ranking: RankedPlayer[]
  userId?: number | null
  onClose: () => void
}

function getColorClass(cor?: string) {
  const map: Record<string, string> = {
    red: "bg-red-500", blue: "bg-blue-500", green: "bg-green-500",
    yellow: "bg-yellow-400", purple: "bg-purple-500", black: "bg-zinc-900",
    orange: "bg-orange-500", pink: "bg-pink-500", emerald: "bg-emerald-500", zinc: "bg-zinc-500",
  }
  return map[cor || ""] || "bg-zinc-500"
}

const medals = ["🥇", "🥈", "🥉"]
const podiumHeight = ["h-40", "h-28", "h-20"]

export default function PodiumModal({ ranking, userId, onClose }: PodiumModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const top3 = ranking.filter((r) => r.position <= 3)
  const meInRanking = ranking.find((r) => r.player.userId === userId)

  useEffect(() => {
    if (typeof window === "undefined") return
    import("canvas-confetti").then((confetti) => {
      confetti.default({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#fbbf24", "#22c55e", "#ef4444", "#3b82f6", "#a855f7"],
      })
      setTimeout(() => {
        confetti.default({
          particleCount: 80,
          spread: 120,
          origin: { y: 0.5, x: 0.2 },
          colors: ["#fbbf24", "#22c55e"],
        })
      }, 300)
      setTimeout(() => {
        confetti.default({
          particleCount: 80,
          spread: 120,
          origin: { y: 0.5, x: 0.8 },
          colors: ["#fbbf24", "#22c55e"],
        })
      }, 500)
    })
  }, [])

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 flex flex-col items-center justify-end pb-10">
      <button onClick={onClose} className="absolute top-6 right-6 text-zinc-400 hover:text-white z-10">
        <FontAwesomeIcon icon={faXmark} className="text-3xl" />
      </button>

      <h2 className="text-3xl font-jaro text-zinc-100 mb-4">Resultado Final</h2>

      <div className="flex items-end justify-center gap-3 px-4 w-full max-w-lg">
        <AnimatePresence>
          {top3.map((entry, i) => {
            const position = entry.position
            const medal = medals[position - 1]
            const height = podiumHeight[position - 1]
            const isMe = entry.player.userId === userId

            return (
              <motion.div
                key={position}
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.25, type: "spring", stiffness: 120, damping: 14 }}
                className="flex flex-col items-center"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.7 + i * 0.25, type: "spring", stiffness: 200 }}
                  className="text-4xl mb-1"
                >
                  {medal}
                </motion.div>

                <div className="relative mb-1">
                  <UserBanner banner={entry.player.banner} spriteId={entry.player.spriteId} className="h-8 w-20 rounded-t-xl" />
                  <div className="flex justify-center -mt-5">
                    <UserAvatar
                      avatarUrl={entry.player.avatarUrl}
                      avatarUpdatedAt={entry.player.avatarUpdatedAt}
                      nome={entry.player.nome}
                      size="lg"
                      ring={isMe}
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1 justify-center">
                  <p className="text-sm font-bold text-white truncate max-w-24 text-center">{entry.player.nome}</p>
                  <UserBadge badge={entry.player.badge} variant="large" />
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.0 + i * 0.25 }}
                  className="text-center mt-1 mb-2"
                >
                  {entry.player.desistiu && (
                    <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">Desistiu</span>
                  )}
                  <p className="text-xs text-green-400 flex items-center justify-center gap-1">
                    <FontAwesomeIcon icon={faBolt} className="text-[10px]" /> {entry.xpEarned} XP
                  </p>
                  {entry.coinsEarned > 0 && (
                    <p className="text-xs text-yellow-400 flex items-center justify-center gap-1">
                      <FontAwesomeIcon icon={faCoins} className="text-[10px]" /> {entry.coinsEarned} coins
                    </p>
                  )}
                </motion.div>

                <div className={`w-24 ${height} rounded-t-xl flex items-start justify-center pt-3 ${position === 1 ? "bg-gradient-to-t from-yellow-600 to-yellow-500 shadow-lg shadow-yellow-600/40" : position === 2 ? "bg-gradient-to-t from-zinc-600 to-zinc-500" : "bg-gradient-to-t from-amber-800 to-amber-700"}`}>
                  <span className="text-white text-2xl font-jaro font-bold drop-shadow-lg">{position}º</span>
                </div>

                <p className="text-[10px] text-zinc-500 mt-1">
                  Patrimônio: R$ {entry.patrimony.toLocaleString("pt-BR")}
                </p>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {meInRanking && meInRanking.position > 3 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, type: "spring" }}
          className="mt-6 bg-zinc-800/80 rounded-xl px-6 py-3 text-center"
        >
          <p className="text-sm text-zinc-300">
            Você ficou em <span className="text-white font-bold">{meInRanking.position}º</span> lugar
          </p>
          {meInRanking.xpEarned > 0 && (
            <p className="text-xs text-green-400 flex items-center justify-center gap-1 mt-1">
              <FontAwesomeIcon icon={faBolt} /> {meInRanking.xpEarned} XP
            </p>
          )}
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8 }}
        onClick={onClose}
        className="mt-6 px-8 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors text-sm"
      >
        Continuar
      </motion.button>
    </div>
  )
}
