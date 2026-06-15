'use client'

import { useRef, useEffect } from "react"
import { gsap } from "gsap"

export function useBannerGlow(cor: string, ativo: boolean) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ativo || !ref.current) return
    const tween = gsap.to(ref.current, {
      boxShadow: `0 0 12px ${cor}66, 0 0 30px ${cor}33, inset 0 0 20px ${cor}11`,
      duration: 1.8,
      ease: "power1.inOut",
      yoyo: true,
      repeat: -1,
    })
    return () => { tween.kill() }
  }, [ativo, cor])

  return ref
}
