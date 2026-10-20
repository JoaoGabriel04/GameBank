'use client'

import { useRef, useEffect } from "react"
import { gsap } from "gsap"
import { useMotionPrefs } from "@/lib/motion/prefs"

export function useBannerGlow(cor: string, ativo: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  // Brilho pulsando em box-shadow é caro: só no nível "completo".
  const { reduced } = useMotionPrefs()

  useEffect(() => {
    if (!ativo || reduced || !ref.current) return
    const el = ref.current
    const tween = gsap.to(el, {
      boxShadow: `0 0 12px ${cor}66, 0 0 30px ${cor}33, inset 0 0 20px ${cor}11`,
      duration: 1.8,
      ease: "power1.inOut",
      yoyo: true,
      repeat: -1,
    })
    return () => {
      tween.kill()
      gsap.set(el, { clearProps: "boxShadow" })
    }
  }, [ativo, cor, reduced])

  return ref
}
