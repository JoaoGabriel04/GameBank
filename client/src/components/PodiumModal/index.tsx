"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBolt, faXmark } from "@fortawesome/free-solid-svg-icons"
import CoinIcon from "@/components/CoinIcon"
import type { RankedPlayer } from "@/types/game"
import UserBanner from "@/components/UserBanner"
import UserAvatar from "@/components/UserAvatar"
import UserBadge from "@/components/UserBadge"

const BAU_IMAGENS: Record<string, string> = {
  comum:   "/images/Cofrinho.png",
  premium: "/images/Cofre Premium.png",
}

interface PodiumModalProps {
  ranking: RankedPlayer[]
  userId?: number | null
  onClose: () => void
}

const medals = ["🥇", "🥈", "🥉"]
const podiumHeight = ["h-40", "h-28", "h-20"]

export default function PodiumModal({ ranking, userId, onClose }: PodiumModalProps) {
  const top3 = ranking.filter((r) => r.position <= 3)
  const meInRanking = ranking.find((r) => r.player.userId === userId)
  const containerRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!containerRef.current) return
    const ctx = gsap.context(() => {
      gsap.set(".podium-col", { opacity: 0, y: 60 })
      gsap.set(".medal-emoji", { scale: 0, rotate: -20, opacity: 0 })
      gsap.set(".reward-info", { opacity: 0 })
      gsap.set(".me-card", { opacity: 0, y: 20 })
      gsap.set(".continue-btn", { opacity: 0, y: 20 })

      const tl = gsap.timeline()
      tl.to(".podium-col", { opacity: 1, y: 0, duration: 0.55, ease: "back.out(1.4)", stagger: 0.25 }, 0.4)
        .to(".medal-emoji", { scale: 1, rotate: 0, opacity: 1, duration: 0.45, ease: "back.out(2)", stagger: 0.25 }, 0.7)
        .to(".reward-info", { opacity: 1, duration: 0.35, stagger: 0.25 }, 1.0)
        .to(".me-card", { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, 1.5)
        .to(".continue-btn", { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, 1.8)
    }, containerRef)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={containerRef} className="fixed inset-0 z-[200] bg-black/80 flex flex-col items-center justify-end pb-10">
      <button onClick={onClose} className="absolute top-6 right-6 text-zinc-400 hover:text-white z-10">
        <FontAwesomeIcon icon={faXmark} className="text-3xl" />
      </button>

      <h2 className="text-3xl font-jaro text-zinc-100 mb-4">Resultado Final</h2>

      <div className="flex items-end justify-center gap-3 px-4 w-full max-w-lg">
        {top3.map((entry) => {
          const position = entry.position
          const medal = medals[position - 1]
          const height = podiumHeight[position - 1]
          const isMe = entry.player.userId === userId

          return (
            <div key={position} className="podium-col flex flex-col items-center">
              <span className="medal-emoji text-4xl mb-1">{medal}</span>

              <div className="flex flex-col items-center mb-1">
                <div className="w-20 h-8 rounded-t-xl overflow-hidden">
                  <UserBanner banner={entry.player.banner} animated={entry.player.bannerAnimated} rarity={entry.player.bannerRaridade} className="w-full h-full" />
                </div>
                <div className="flex justify-center -mt-5 z-10">
                  <UserAvatar
                    avatarUrl={entry.player.avatarUrl}
                    avatarUpdatedAt={entry.player.avatarUpdatedAt}
                    nome={entry.player.nome}
                    size="lg"
                    ring={isMe}
                    frame={entry.player.frame}
                    frameType={entry.player.frameType}
                    frameAnimated={entry.player.frameAnimated}
                    frameScale={entry.player.frameScale ?? 145}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 justify-center mt-2">
                <UserBadge badge={entry.player.badge} imageUrl={entry.player.badgeImageUrl} variant="small" />
                <p className="text-sm font-bold text-white truncate max-w-24 text-center">{entry.player.nome}</p>
              </div>

              <div className="reward-info text-center mt-1 mb-2">
                {entry.player.desistiu && (
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">Desistiu</span>
                )}
                <p className="text-xs text-green-400 flex items-center justify-center gap-1">
                  <FontAwesomeIcon icon={faBolt} className="text-[10px]" /> {entry.xpEarned} XP
                </p>
                {entry.coinsEarned > 0 && (
                  <p className="text-xs text-yellow-400 flex items-center justify-center gap-1">
                    <CoinIcon size={12} className="inline" /> {entry.coinsEarned} coins
                  </p>
                )}
                {entry.trophyDelta !== undefined && (
                  <p className={`text-xs flex items-center justify-center gap-1 ${(entry.trophyDelta ?? 0) >= 0 ? "text-cyan-400" : "text-rose-400"}`}>
                    {(entry.trophyDelta ?? 0) >= 0 ? "+" : ""}{entry.trophyDelta}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/TROFEU.png" alt="" style={{ width: 11, height: 11 }} className="object-contain" />
                  </p>
                )}
                {entry.bauEarned && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={BAU_IMAGENS[entry.bauEarned]}
                      alt={entry.bauEarned === "premium" ? "Cofre Premium" : "Cofrinho"}
                      style={{ width: 20, height: 20 }}
                      className="object-contain"
                    />
                    <span className={`text-[10px] font-inconsolata ${entry.bauEarned === "premium" ? "text-violet-400" : "text-green-400"}`}>
                      {entry.bauEarned === "premium" ? "Cofre Premium" : "Cofrinho"}
                    </span>
                  </div>
                )}
                {entry.penaltyReason && (
                  <p className="text-[10px] text-zinc-500 mt-1 max-w-28 mx-auto">⚠ {entry.penaltyReason}</p>
                )}
              </div>

              <div className={`w-24 ${height} rounded-t-xl flex items-start justify-center pt-3 ${position === 1 ? "bg-gradient-to-t from-yellow-600 to-yellow-500 shadow-lg shadow-yellow-600/40" : position === 2 ? "bg-gradient-to-t from-zinc-600 to-zinc-500" : "bg-gradient-to-t from-amber-800 to-amber-700"}`}>
                <span className="text-white text-2xl font-jaro font-bold drop-shadow-lg">{position}º</span>
              </div>

              <p className="text-[10px] text-zinc-500 mt-1">
                Patrimônio: R$ {entry.patrimony.toLocaleString("pt-BR")}
              </p>
            </div>
          )
        })}
      </div>

      {meInRanking && meInRanking.position > 3 && (
        <div className="me-card mt-6 bg-zinc-800/80 rounded-xl px-6 py-3 text-center">
          <p className="text-sm text-zinc-300">
            Você ficou em <span className="text-white font-bold">{meInRanking.position}º</span> lugar
          </p>
          {meInRanking.xpEarned > 0 && (
            <p className="text-xs text-green-400 flex items-center justify-center gap-1 mt-1">
              <FontAwesomeIcon icon={faBolt} /> {meInRanking.xpEarned} XP
            </p>
          )}
          {meInRanking.trophyDelta !== undefined && (
            <p className={`text-xs flex items-center justify-center gap-1 mt-1 ${(meInRanking.trophyDelta ?? 0) >= 0 ? "text-cyan-400" : "text-rose-400"}`}>
              {(meInRanking.trophyDelta ?? 0) >= 0 ? "+" : ""}{meInRanking.trophyDelta}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/TROFEU.png" alt="" style={{ width: 11, height: 11 }} className="object-contain" />
            </p>
          )}
        </div>
      )}

      <button
        className="continue-btn mt-6 px-8 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors text-sm"
        onClick={onClose}
      >
        Continuar
      </button>
    </div>
  )
}
