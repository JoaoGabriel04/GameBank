'use client'

import { useMemo } from "react"

type Sparkle = {
  id: number
  top: number
  left: number
  size: number
  delay: number
  duration: number
  driftX: number
  driftY: number
}

type BauParticulasProps = {
  cor: string
  ativo: boolean
  qtd?: number
}

export default function BauParticulas({ cor, ativo, qtd = 12 }: BauParticulasProps) {
  const sparkles: Sparkle[] = useMemo(() =>
    ativo
      ? Array.from({ length: qtd }, (_, i) => ({
          id: i,
          top: 10 + Math.random() * 80,
          left: 8 + Math.random() * 84,
          size: 1.5 + Math.random() * 4,
          delay: Math.random() * 3,
          duration: 1.2 + Math.random() * 2.5,
          driftX: (Math.random() - 0.5) * 80,
          driftY: (Math.random() - 0.5) * 80,
        }))
      : [],
    [ativo, qtd],
  )

  if (!ativo || sparkles.length === 0) return null

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      {sparkles.map((s) => (
        <div
          key={s.id}
          style={{
            position: "absolute",
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: s.size * 3,
            height: s.size * 3,
            "--drift-x": `${s.driftX}px`,
            "--drift-y": `${s.driftY}px`,
            animation: s.id % 2 === 0
              ? `bau-sparkle ${s.duration}s ease-in-out ${s.delay}s infinite`
              : `bau-sparkle-cross ${s.duration + 0.5}s ease-in-out ${s.delay + 0.3}s infinite`,
          } as React.CSSProperties}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: s.size,
                height: s.size,
                borderRadius: "50%",
                background: cor,
                boxShadow: `0 0 ${s.size * 3}px ${cor}, 0 0 ${s.size * 6}px ${cor}`,
              }}
            />
            <div
              style={{
                position: "absolute",
                width: s.size * 3,
                height: 1,
                background: `linear-gradient(90deg, transparent, ${cor}, transparent)`,
                borderRadius: "50%",
                boxShadow: `0 0 ${s.size * 1.5}px ${cor}`,
              }}
            />
            <div
              style={{
                position: "absolute",
                width: 1,
                height: s.size * 3,
                background: `linear-gradient(0deg, transparent, ${cor}, transparent)`,
                borderRadius: "50%",
                boxShadow: `0 0 ${s.size * 1.5}px ${cor}`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
