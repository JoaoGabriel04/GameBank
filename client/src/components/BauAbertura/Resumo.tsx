"use client"

import { useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Puzzle, Sparkles } from "lucide-react"
import { createTimeline, gsap, useGSAP } from "@/lib/motion/gsap"
import { melhorRaridade, type NivelEfeitos } from "@/lib/motion"
import { RARIDADES } from "@/constants/raridade"
import BauItemPreview from "@/components/BauItemPreview"
import BauParticulas from "@/components/BauParticulas"
import CoinIcon from "@/components/CoinIcon"
import Contador from "@/components/Contador"
import { playSfx } from "@/utils/sfx"
import type { ItemResultado } from "./tipos"

// Resumo do baú (um ou vários): moedas e XP contando, o melhor item em
// destaque e os demais em grade com entrada escalonada. Os botões entram
// por último, mas o fechar funciona desde o início: a recompensa já foi
// concedida e o resumo nunca prende o jogador. Tocar fora dos botões não
// fecha (antes fechava, e era fácil fechar sem querer).

type Props = {
  titulo: string
  subtitulo?: string
  coins: number
  xp?: number
  itens: ItemResultado[]
  nivel: NivelEfeitos
  onFechar: () => void
}

export default function Resumo({ titulo, subtitulo, coins, xp, itens, nivel, onFechar }: Props) {
  const raiz = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Melhor item: a raridade mais alta (empate: o primeiro).
  const { destaque, demais } = useMemo(() => {
    if (!itens.length) return { destaque: null, demais: [] as ItemResultado[] }
    const melhor = melhorRaridade(itens.map((i) => i.raridade))
    const idx = Math.max(0, itens.findIndex((i) => i.raridade === melhor))
    return { destaque: itens[idx], demais: itens.filter((_, i) => i !== idx) }
  }, [itens])

  useGSAP(() => {
    const q = gsap.utils.selector(raiz)
    const { tl, dispose } = createTimeline({}, { limiteMs: 4000, instantanea: nivel === "desligado" })
    tl.fromTo(q(".res-titulo"), { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }, 0)
    tl.fromTo(q(".res-moedas"), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }, 0.1)
    if (q(".res-destaque").length) {
      tl.fromTo(q(".res-destaque"), { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "gb-pop" }, 0.3)
    }
    tl.fromTo(q(".res-card"), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out", stagger: 0.07 }, 0.55)
    tl.fromTo(q(".res-acoes"), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }, 0.75 + Math.min(demais.length, 10) * 0.07)
    return dispose
  }, { scope: raiz })

  const corDestaque = destaque ? (RARIDADES[destaque.raridade]?.cor ?? "#a1a1aa") : "#a1a1aa"

  return (
    <div
      ref={raiz}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute", inset: 0, background: "#09090b", overflowY: "auto", cursor: "default",
        display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px 120px",
      }}
    >
      <div className="res-titulo" style={{ textAlign: "center", marginBottom: 18, opacity: 0 }}>
        <p style={{ fontFamily: "var(--font-jaro)", fontSize: 22, color: "#f4f4f5", margin: 0 }}>{titulo}</p>
        {subtitulo && <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 12, color: "#71717a", marginTop: 4 }}>{subtitulo}</p>}
      </div>

      <div className="res-moedas" style={{ display: "flex", gap: 10, marginBottom: 22, opacity: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#111113", border: "1px solid #fbbf2433", borderRadius: 12, padding: "10px 18px" }}>
          <CoinIcon size={20} />
          <Contador
            valor={coins}
            prefixo="+"
            duracaoMs={900}
            atrasoMs={150}
            onTique={() => playSfx("contagem-moedas")}
            style={{ fontFamily: "var(--font-jaro)", fontSize: 18, color: "#fbbf24" }}
          />
        </div>
        {xp ? (
          <div style={{ display: "flex", alignItems: "center", background: "#111113", border: "1px solid #22d3ee33", borderRadius: 12, padding: "10px 18px" }}>
            <Contador valor={xp} prefixo="+" sufixo=" XP" duracaoMs={800} atrasoMs={300} style={{ fontFamily: "var(--font-jaro)", fontSize: 18, color: "#22d3ee" }} />
          </div>
        ) : null}
      </div>

      {destaque && (
        <div
          className="res-destaque"
          style={{
            position: "relative", width: "100%", maxWidth: 340, marginBottom: 18, padding: "22px 16px 18px", opacity: 0,
            borderRadius: 18, background: `radial-gradient(ellipse at 50% 35%, ${corDestaque}26, #0d0d10 70%)`,
            border: `1px solid ${corDestaque}66`, boxShadow: `0 0 40px ${corDestaque}22`,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10, overflow: "hidden",
          }}
        >
          <BauParticulas cor={corDestaque} ativo qtd={destaque.raridade === "LENDARIO" ? 20 : 12} />
          <span style={{ position: "relative", fontFamily: "var(--font-inconsolata)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: corDestaque }}>
            Melhor item · {RARIDADES[destaque.raridade]?.label}
          </span>
          <div style={{ position: "relative" }}>
            <BauItemPreview item={destaque} size={110} />
          </div>
          <p style={{ position: "relative", fontFamily: "var(--font-jaro)", fontSize: 18, color: "#f4f4f5", margin: 0 }}>{destaque.name}</p>
          <p style={{ position: "relative", fontFamily: "var(--font-inconsolata)", fontSize: 12, color: corDestaque, margin: 0, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Puzzle size={12} /> +{destaque.fragmentosGanhos} fragmentos
            {destaque.itemCompleto && (<><span style={{ color: "#3f3f46" }}>·</span><Sparkles size={12} color="#4ade80" /><span style={{ color: "#4ade80" }}>desbloqueado</span></>)}
          </p>
        </div>
      )}

      {demais.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 w-full max-w-sm sm:max-w-xl md:max-w-2xl">
          {demais.map((i, idx) => {
            const cor = RARIDADES[i.raridade]?.cor ?? "#a1a1aa"
            return (
              <div
                key={`${i.id}-${idx}`}
                className="res-card flex flex-col items-center gap-1.5 text-center p-2.5"
                style={{ opacity: 0, background: "#0d0d10", border: `1px solid ${cor}22`, borderTop: `2px solid ${cor}66`, borderRadius: 12 }}
              >
                <BauItemPreview item={i} size={52} />
                <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 11, color: "#d4d4d8", margin: 0, lineHeight: 1.25 }}>{i.name}</p>
                <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 11, color: cor, margin: 0, display: "inline-flex", alignItems: "center", gap: 3 }}>
                  +{i.fragmentosGanhos} <Puzzle size={10} />
                  {i.itemCompleto && <Sparkles size={10} color="#4ade80" aria-label="Item desbloqueado" />}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <div
        className="res-acoes"
        style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "16px 20px 28px", display: "flex", justifyContent: "center", gap: 10, opacity: 0, background: "linear-gradient(to top, #09090b 60%, transparent)" }}
      >
        <button
          type="button"
          onClick={() => { onFechar(); router.push("/user/cofre") }}
          style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 14, padding: "12px 20px", fontFamily: "var(--font-inconsolata)", fontSize: 14, color: "#a1a1aa", cursor: "pointer" }}
        >
          Ver no cofre
        </button>
        <button
          type="button"
          autoFocus
          onClick={onFechar}
          style={{ background: "#16a34a", border: "1px solid #22c55e", borderRadius: 14, padding: "12px 32px", fontFamily: "var(--font-jaro)", fontSize: 15, color: "#fff", cursor: "pointer" }}
        >
          Fechar
        </button>
      </div>
    </div>
  )
}
