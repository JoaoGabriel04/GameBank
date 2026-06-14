'use client'

import { useId, useMemo } from "react"
import { motion } from "framer-motion"
import { legendaryTitleStyle } from "@/lib/animations"

const PARTICLE_COUNT = 12

export default function LegendaryTitle({ text }: { text: string }) {
  const uid = useId()

  // Posições estáveis — rand() no style={} executa a cada render e reposiciona as partículas
  const particles = useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      key: `${uid}-${i}`,
      left: Math.random() * 80 + 10,
      top: Math.random() * 80 + 10,
      size: Math.random() * 3 + 2,
      delay: Math.random() * 3,
      duration: Math.random() * 1.5 + 2,
      travelY: -(Math.random() * 6 + 3),
      travelX: Math.random() * 8 - 4,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        overflow: "hidden",
      }}
    >
      <span
        className="font-inconsolata text-xs px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10"
        style={legendaryTitleStyle}
      >
        {text}
      </span>
      {particles.map((p) => (
        <motion.span
          key={p.key}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "#fde68a",
            boxShadow: "0 0 6px rgba(251,191,36,0.6), 0 0 12px rgba(245,158,11,0.3)",
            pointerEvents: "none",
            left: `${p.left}%`,
            top: `${p.top}%`,
          }}
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [0, 1.2, 1, 0],
            y: [0, p.travelY],
            x: [0, p.travelX],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  )
}
