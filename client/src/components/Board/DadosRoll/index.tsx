'use client'

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const DICE_FACES: Record<number, string> = {
  1: "⚀",
  2: "⚁",
  3: "⚂",
  4: "⚃",
  5: "⚄",
  6: "⚅",
}

const DICE_DOTS: Record<number, number[][]> = {
  1: [[1,1]],
  2: [[0,2],[2,0]],
  3: [[0,2],[1,1],[2,0]],
  4: [[0,0],[0,2],[2,0],[2,2]],
  5: [[0,0],[0,2],[1,1],[2,0],[2,2]],
  6: [[0,0],[0,2],[1,0],[1,2],[2,0],[2,2]],
}

function DiceFace({ value }: { value: number }) {
  const dots = DICE_DOTS[value] ?? []
  return (
    <div className="w-20 h-20 bg-white rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center p-3">
      <div className="w-full h-full grid grid-cols-3 grid-rows-3">
        {Array.from({ length: 9 }).map((_, i) => {
          const row = Math.floor(i / 3)
          const col = i % 3
          const hasDot = dots.some(([r, c]) => r === row && c === col)
          return (
            <div key={i} className="flex items-center justify-center">
              {hasDot && <div className="w-3 h-3 bg-zinc-900 rounded-full" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

type Props = {
  aberto: boolean
  rolando: boolean
  dado1?: number
  dado2?: number
  onClose: () => void
}

export default function DadosRoll({ aberto, rolando, dado1, dado2, onClose }: Props) {
  const [anim1, setAnim1] = useState(1)
  const [anim2, setAnim2] = useState(1)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (rolando) {
      timerRef.current = setInterval(() => {
        setAnim1(Math.floor(Math.random() * 6) + 1)
        setAnim2(Math.floor(Math.random() * 6) + 1)
      }, 100)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [rolando])

  const display1 = rolando ? anim1 : (dado1 ?? anim1)
  const display2 = rolando ? anim2 : (dado2 ?? anim2)
  const total = dado1 != null && dado2 != null ? dado1 + dado2 : null

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={rolando ? undefined : onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 flex flex-col items-center gap-6 min-w-[240px]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-jaro text-lg text-zinc-100">
              {rolando ? "Rolando dados..." : `Resultado`}
            </p>

            <div className="flex items-center gap-4">
              <div className={rolando ? "animate-bounce" : ""}>
                <DiceFace value={display1} />
              </div>
              <span className="text-2xl text-zinc-500 font-jaro">+</span>
              <div className={rolando ? "animate-bounce [animation-delay:0.1s]" : ""}>
                <DiceFace value={display2} />
              </div>
            </div>

            {!rolando && total != null && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="flex flex-col items-center gap-1"
              >
                <span className="text-3xl font-jaro text-green-400">
                  {total}
                </span>
                <span className="text-xs font-inconsolata text-zinc-500">
                  {dado1} + {dado2}
                </span>
              </motion.div>
            )}

            {!rolando && (
              <button
                onClick={onClose}
                className="mt-2 px-6 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-jaro text-sm transition-colors cursor-pointer"
              >
                OK
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
