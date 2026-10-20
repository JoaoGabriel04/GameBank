"use client"

import { useRef } from "react"
import { createTimeline, gsap, useGSAP } from "@/lib/motion/gsap"
import type { NivelEfeitos } from "@/lib/motion"
import CoinIcon from "@/components/CoinIcon"
import Contador from "@/components/Contador"
import Faiscas, { type FaiscasHandle } from "@/components/Faiscas"
import { porNivel } from "@/lib/motion/prefs"
import { playSfx } from "@/utils/sfx"

// Moedas garantidas, logo depois do estouro (entram por baixo da luz). A
// contagem só começa quando o clarão já baixou, com tique de moeda.

type Props = {
  coins: number
  xpBonus?: number
  nivel: NivelEfeitos
}

// O clarão leva ~350 ms para baixar: a contagem espera por ele.
const ATRASO_MS = 380

export default function Moedas({ coins, xpBonus, nivel }: Props) {
  const raiz = useRef<HTMLDivElement>(null)
  const faiscas = useRef<FaiscasHandle>(null)

  useGSAP(() => {
    const q = gsap.utils.selector(raiz)
    const { tl, dispose } = createTimeline({}, { limiteMs: 3000, instantanea: nivel === "desligado" })
    tl.fromTo(q(".moe-circulo"), { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "gb-pop" }, 0.15)
    tl.fromTo(q(".moe-texto"), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }, 0.3)
    tl.fromTo(q(".moe-dica"), { opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.3)
    tl.call(() => {
      const el = q(".moe-circulo")[0] as HTMLElement | undefined
      const r = el?.getBoundingClientRect()
      if (r) faiscas.current?.explodir({
        x: r.left + r.width / 2, y: r.top + r.height / 2,
        cor: "#fbbf24", qtd: porNivel(40, nivel), forca: 520, gravidade: 700, tamanho: 2.2, vida: [0.5, 1.1],
      })
    }, [], ATRASO_MS / 1000)
    return dispose
  }, { scope: raiz })

  return (
    <div
      ref={raiz}
      style={{
        position: "absolute", inset: 0, background: "#09090b",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
      }}
    >
      <Faiscas ref={faiscas} />
      <div
        className="moe-circulo"
        style={{
          width: 200, height: 200, borderRadius: "50%", opacity: 0,
          border: "2px solid #fbbf2466", boxShadow: "0 0 30px #fbbf2444, 0 0 60px #fbbf2422", background: "#09090b",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <CoinIcon size={80} />
      </div>

      <div className="moe-texto" style={{ textAlign: "center", opacity: 0 }}>
        <Contador
          valor={coins}
          prefixo="+"
          sufixo={xpBonus ? " coins" : ""}
          duracaoMs={1100}
          atrasoMs={ATRASO_MS}
          onTique={() => playSfx("contagem-moedas")}
          style={{ fontFamily: "var(--font-jaro)", fontSize: 32, color: "#fbbf24", display: "block" }}
        />
        {xpBonus ? (
          <>
            <Contador
              valor={xpBonus}
              prefixo="+"
              sufixo=" XP"
              duracaoMs={900}
              atrasoMs={ATRASO_MS + 300}
              style={{ fontFamily: "var(--font-jaro)", fontSize: 24, color: "#22d3ee", display: "block", marginTop: 4 }}
            />
            <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 13, color: "#52525b", marginTop: 4 }}>
              Bônus por baú vazio
            </p>
          </>
        ) : (
          <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 13, color: "#71717a", marginTop: 4 }}>
            Coins garantidos
          </p>
        )}
      </div>

      <p
        className="moe-dica"
        style={{ fontFamily: "var(--font-inconsolata)", fontSize: 12, color: "#52525b", position: "absolute", bottom: 48, opacity: 0 }}
      >
        Toque para continuar
      </p>
    </div>
  )
}
