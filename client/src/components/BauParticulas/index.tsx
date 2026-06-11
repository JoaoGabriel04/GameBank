'use client'

import { useEffect, useState } from "react"

type Particula = {
  id: number
  angle: number
  orbitR: number
  size: number
  duration: number
  delay: number
  cor: string
}

type BauParticulasProps = {
  cor: string
  ativo: boolean
  qtd?: number
}

export default function BauParticulas({ cor, ativo, qtd = 12 }: BauParticulasProps) {
  const [particulas, setParticulas] = useState<Particula[]>([])

  useEffect(() => {
    if (!ativo) { setParticulas([]); return }

    const novas: Particula[] = Array.from({ length: qtd }, (_, i) => ({
      id: i,
      angle: (360 / qtd) * i,
      orbitR: 60 + Math.random() * 40,
      size: 3 + Math.random() * 4,
      duration: 1.5 + Math.random() * 1.5,
      delay: Math.random() * 0.8,
      cor,
    }))
    setParticulas(novas)
  }, [ativo, cor, qtd])

  if (!ativo || particulas.length === 0) return null

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {particulas.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: p.cor,
            boxShadow: `0 0 ${p.size * 2}px ${p.cor}`,
            "--orbit-r": `${p.orbitR}px`,
            transform: `rotate(${p.angle}deg) translateX(${p.orbitR}px)`,
            animation: `bau-particle-orbit ${p.duration}s linear ${p.delay}s infinite`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
