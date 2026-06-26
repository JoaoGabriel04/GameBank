'use client'

import { motion, AnimatePresence } from "framer-motion"
import { backdrop, modalBox } from "@/lib/animations"
import { X, Trophy, Star, Home, Crown, Package } from "lucide-react"
import type { GameResult } from "@/types/shop"

const POS_COLOR: Record<number, string> = {
  1: "text-yellow-400",
  2: "text-zinc-300",
  3: "text-amber-600",
}

const POS_LABEL: Record<number, string> = {
  1: "1º lugar",
  2: "2º lugar",
  3: "3º lugar",
}

interface Props {
  result: GameResult | null
  onClose: () => void
}

export default function GameResultDetailModal({ result, onClose }: Props) {
  return (
    <AnimatePresence>
      {result && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          <motion.div
            variants={backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            variants={modalBox}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-full max-w-sm mx-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800">
              <div>
                <span className={`font-jaro text-2xl ${POS_COLOR[result.position] ?? "text-zinc-500"}`}>
                  {POS_LABEL[result.position] ?? `${result.position}º lugar`}
                </span>
                <p className="font-inconsolata text-xs text-zinc-500 mt-0.5">
                  {new Date(result.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stats grid */}
            <div className="p-5 grid grid-cols-2 gap-3">
              <Stat
                icon={<Home className="w-4 h-4 text-sky-400" />}
                label="Patrimônio final"
                value={`R$ ${(result.patrimony ?? 0).toLocaleString("pt-BR")}`}
                className="col-span-2 bg-sky-950/40 border-sky-800/40"
              />
              <Stat
                icon={<Star className="w-4 h-4 text-violet-400" />}
                label="XP ganho"
                value={`+${result.xpEarned} XP`}
                className="bg-violet-950/30 border-violet-800/30"
              />
              <Stat
                icon={<span className="text-base leading-none">🪙</span>}
                label="Coins ganhos"
                value={`+${result.coinsEarned}`}
                className="bg-amber-950/30 border-amber-800/30"
              />
              <Stat
                icon={<Home className="w-4 h-4 text-emerald-400" />}
                label="Propriedades"
                value={String(result.propertiesCount ?? 0)}
                className="bg-emerald-950/30 border-emerald-800/30"
              />
              <Stat
                icon={<Crown className="w-4 h-4 text-yellow-400" />}
                label="Monopólios"
                value={String(result.monopoliesCount ?? 0)}
                className="bg-yellow-950/30 border-yellow-800/30"
              />
              {result.trophyDelta !== undefined && (
                <Stat
                  icon={<Trophy className="w-4 h-4 text-cyan-400" />}
                  label="Troféus"
                  value={`${(result.trophyDelta ?? 0) >= 0 ? "+" : ""}${result.trophyDelta}`}
                  sub={result.trophyBefore !== undefined
                    ? `${result.trophyBefore} → ${result.trophyAfter}`
                    : undefined}
                  className="col-span-2 bg-cyan-950/30 border-cyan-800/30"
                />
              )}
              {result.bauAdquirido && result.bauAdquirido.length > 0 && (() => {
                const tipo = result.bauAdquirido[0].bau.tipo
                const isPremium = tipo === "premium"
                return (
                  <div className={`col-span-2 border rounded-lg px-3 py-2.5 flex items-center gap-3 ${isPremium ? "bg-amber-950/30 border-amber-700/40" : "bg-zinc-800/40 border-zinc-700/40"}`}>
                    <Package className={`w-5 h-5 shrink-0 ${isPremium ? "text-amber-400" : "text-zinc-400"}`} />
                    <div>
                      <p className="font-inconsolata text-[10px] text-zinc-500 uppercase tracking-wider">Baú ganho</p>
                      <p className={`font-jaro text-base leading-tight ${isPremium ? "text-amber-300" : "text-zinc-300"}`}>
                        {isPremium ? "Cofre Premium" : "Cofrinho"}
                      </p>
                    </div>
                  </div>
                )
              })()}
              {result.penaltyReason && (
                <div className="col-span-2 bg-red-950/20 border border-red-800/30 rounded-lg px-3 py-2">
                  <p className="font-inconsolata text-[10px] text-red-400 uppercase tracking-wider mb-0.5">Penalidade</p>
                  <p className="font-inconsolata text-xs text-red-300">{result.penaltyReason}</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function Stat({
  icon,
  label,
  value,
  sub,
  className = "",
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  className?: string
}) {
  return (
    <div className={`border rounded-lg px-3 py-2.5 flex flex-col gap-0.5 ${className}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon}
        <span className="font-inconsolata text-[10px] text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <span className="font-jaro text-lg text-zinc-100 leading-tight">{value}</span>
      {sub && <span className="font-inconsolata text-[10px] text-zinc-500">{sub}</span>}
    </div>
  )
}
