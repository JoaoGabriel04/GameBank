'use client'

import { useId, useMemo, useRef, useEffect } from "react"
import gsap from "gsap"
import { legendaryTitleStyle } from "@/lib/animations"

const PARTICLE_COUNT = 12

export default function LegendaryTitle({ text }: { text: string }) {
  const uid = useId()
  const containerRef = useRef<HTMLSpanElement>(null)

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

  useEffect(() => {
    if (!containerRef.current) return
    const els = containerRef.current.querySelectorAll<HTMLElement>(".particle")
    const tweens = Array.from(els).map((el, i) => {
      const p = particles[i]
      return gsap.fromTo(
        el,
        { opacity: 0, scale: 0, x: 0, y: 0 },
        {
          keyframes: [
            { opacity: 0, scale: 0, x: 0, y: 0, duration: 0 },
            { opacity: 1, scale: 1.2, x: p.travelX * 0.5, y: p.travelY * 0.5, duration: p.duration * 0.35 },
            { opacity: 1, scale: 1, x: p.travelX, y: p.travelY, duration: p.duration * 0.3 },
            { opacity: 0, scale: 0, x: p.travelX, y: p.travelY, duration: p.duration * 0.35 },
          ],
          repeat: -1,
          delay: p.delay,
          ease: "none",
        }
      )
    })
    return () => { tweens.forEach((t) => t.kill()) }
  }, [particles])

  return (
    <span
      ref={containerRef}
      style={{ position: "relative", display: "inline-block", overflow: "hidden" }}
    >
      <span
        className="font-inconsolata text-xs px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10"
        style={legendaryTitleStyle}
      >
        {text}
      </span>
      {particles.map((p) => (
        <span
          key={p.key}
          className="particle"
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
            opacity: 0,
          }}
        />
      ))}
    </span>
  )
}
