'use client'

import { useId } from "react"
import { motion } from "framer-motion"
import { legendaryTitleStyle } from "@/lib/animations"

function rand(n: number) { return Math.random() * n }

const PARTICLE_COUNT = 12

export default function LegendaryTitle({ text }: { text: string }) {
  const uid = useId()
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    key: `${uid}-${i}`,
    x: rand(100) - 50,
    y: rand(100) - 50,
    size: rand(3) + 2,
    delay: rand(3),
    duration: rand(1.5) + 2,
  }))

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
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
            left: `${rand(80) + 10}%`,
            top: `${rand(80) + 10}%`,
          }}
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [0, 1.2, 1, 0],
            y: [0, -12 - rand(16)],
            x: [0, rand(16) - 8],
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
