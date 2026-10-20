'use client'

import { useEffect, useRef } from "react"
import PortalBody from "@/components/PortalBody"
import { curvaCss } from "@/lib/motion"
import { useMotionPrefs } from "@/lib/motion/prefs"

// Faixa que atravessa a tela quando a vez muda ("Sua vez!" / "Vez de X"),
// na cor do jogador. Não bloqueia toques e fica abaixo dos modais. Se a vez
// mudar de novo no meio, a faixa recomeça com o nome novo. Reduzido: só
// aparece e some; desligado: nada.

type Props = {
  /** Muda a cada troca de vez (id do jogador da vez). */
  vezDe: number | null | undefined
  texto: string
  cor: string
}

export default function FaixaVez({ vezDe, texto, cor }: Props) {
  const faixaRef = useRef<HTMLDivElement>(null)
  const textoRef = useRef<HTMLSpanElement>(null)
  const animRef = useRef<Animation | null>(null)
  const anteriorRef = useRef(vezDe)
  const { nivel } = useMotionPrefs()

  useEffect(() => {
    const antes = anteriorRef.current
    anteriorRef.current = vezDe
    const el = faixaRef.current
    if (!el || vezDe == null || antes == null || antes === vezDe || nivel === "desligado") return
    if (textoRef.current) textoRef.current.textContent = texto
    el.style.setProperty("--cor-vez", cor)
    animRef.current?.cancel()
    const quadros: Keyframe[] = nivel === "completo"
      ? [
          { transform: "translateX(-110%) skewX(-14deg)", opacity: 1 },
          { transform: "translateX(0) skewX(-14deg)", opacity: 1, offset: 0.25, easing: curvaCss.easeOut },
          { transform: "translateX(4%) skewX(-14deg)", opacity: 1, offset: 0.72, easing: curvaCss.easeIn },
          { transform: "translateX(115%) skewX(-14deg)", opacity: 1 },
        ]
      : [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
    animRef.current = el.animate(quadros, { duration: 1400, fill: "none" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vezDe])

  useEffect(() => () => animRef.current?.cancel(), [])

  return (
    <PortalBody>
      <div aria-hidden style={{ position: "fixed", left: 0, right: 0, top: "34%", height: 64, overflow: "hidden", pointerEvents: "none", zIndex: 150 }}>
        <div
          ref={faixaRef}
          data-faixa-vez=""
          style={{
            position: "absolute", inset: "0 -10%", opacity: 0, transform: "translateX(-110%)",
            background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--cor-vez, #22c55e) 75%, #000) 18%, var(--cor-vez, #22c55e) 50%, color-mix(in srgb, var(--cor-vez, #22c55e) 75%, #000) 82%, transparent)",
            boxShadow: "0 0 30px color-mix(in srgb, var(--cor-vez, #22c55e) 55%, transparent)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <span ref={textoRef} style={{ fontFamily: "var(--font-jaro)", fontSize: 26, color: "#fff", letterSpacing: "0.04em", textShadow: "0 2px 6px rgba(0,0,0,0.6)", transform: "skewX(14deg)" }} />
        </div>
      </div>
    </PortalBody>
  )
}
