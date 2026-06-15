'use client'

import { useMemo, useEffect, useRef } from "react"
import { gsap } from "gsap"

type Faisca = {
  id: number
  x: number
  delay: number
  dur: number
  size: number
  drift: number
}

type Sparkle = {
  id: number
  x: number
  y: number
  delay: number
  dur: number
  size: number
}

type BannerParticulasProps = {
  cor?: string
  ativo?: boolean
}

export default function BannerParticulas({ cor = "#fbbf24", ativo = true }: BannerParticulasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const faiscas = useMemo<Faisca[]>(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 5 + Math.random() * 90,
      delay: Math.random() * 3,
      dur: 2.5 + Math.random() * 2,
      size: 8 + Math.random() * 16,
      drift: (Math.random() - 0.5) * 30,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const sparkles = useMemo<Sparkle[]>(() =>
    Array.from({ length: 16 }, (_, i) => ({
      id: i,
      x: Math.random() * 92,
      y: Math.random() * 85,
      delay: Math.random() * 4,
      dur: 1.5 + Math.random() * 2,
      size: 8 + Math.random() * 10,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  useEffect(() => {
    if (!ativo || !containerRef.current) return

    const ctx = gsap.context(() => {
      const faiscaEls = containerRef.current!.querySelectorAll<HTMLElement>(".b-faisca")
      const sparkleEls = containerRef.current!.querySelectorAll<HTMLElement>(".b-sparkle")

      faiscaEls.forEach((el, i) => {
        const f = faiscas[i]
        if (!f) return
        gsap.fromTo(el,
          { y: "100%", x: 0, opacity: 0, scaleY: 1 },
          {
            y: "-20%",
            x: f.drift,
            opacity: 0.85,
            scaleY: 0.4,
            duration: f.dur,
            delay: f.delay,
            ease: "power1.inOut",
            repeat: -1,
            repeatDelay: Math.random() * 2,
            keyframes: [
              { y: "100%", x: 0, opacity: 0, scaleY: 1, duration: 0 },
              { y: "60%", opacity: 0.9, scaleY: 1.3, duration: f.dur * 0.4 },
              { y: "20%", opacity: 0.9, scaleY: 1, duration: f.dur * 0.4 },
              { y: "-20%", x: f.drift, opacity: 0, scaleY: 0.3, duration: f.dur * 0.2 },
            ],
          }
        )
      })

      sparkleEls.forEach((el, i) => {
        const s = sparkles[i]
        if (!s) return
        gsap.fromTo(el,
          { opacity: 0, scale: 0, rotation: 0 },
          {
            keyframes: [
              { opacity: 0, scale: 0, rotation: 0, duration: 0 },
              { opacity: 1, scale: 1.2, rotation: 22, duration: s.dur * 0.35 },
              { opacity: 0.8, scale: 1, rotation: 45, duration: s.dur * 0.3 },
              { opacity: 0, scale: 0, rotation: 90, duration: s.dur * 0.35 },
            ],
            repeat: -1,
            delay: s.delay,
            repeatDelay: 1 + Math.random() * 3,
            ease: "none",
          }
        )
      })
    }, containerRef)

    return () => { ctx.revert() }
  }, [ativo, faiscas, sparkles])

  if (!ativo) return null

  const svgSparkle = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='${encodeURIComponent(cor)}' d='M12 0 L13.5 10.5 L24 12 L13.5 13.5 L12 24 L10.5 13.5 L0 12 L10.5 10.5 Z'/%3E%3C/svg%3E")`

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 3,
      }}
    >
      {sparkles.map((s) => (
        <div
          key={s.id}
          className="b-sparkle"
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            opacity: 0,
            backgroundImage: svgSparkle,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            filter: `drop-shadow(0 0 3px ${cor})`,
          }}
        />
      ))}

      {faiscas.map((f) => (
        <div
          key={f.id}
          className="b-faisca"
          style={{
            position: "absolute",
            left: `${f.x}%`,
            bottom: 0,
            width: 2,
            height: f.size,
            opacity: 0,
            borderRadius: 2,
            background: `linear-gradient(to top, ${cor}, ${cor}88, transparent)`,
            filter: `blur(0.5px) drop-shadow(0 0 3px ${cor})`,
            transformOrigin: "bottom center",
          }}
        />
      ))}
    </div>
  )
}
