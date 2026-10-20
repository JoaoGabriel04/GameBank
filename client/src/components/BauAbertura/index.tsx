'use client'

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { Puzzle, Sparkles } from "lucide-react"
import { gsap } from "gsap"
import { RARIDADES } from "@/constants/raridade"
import BauItemPreview from "@/components/BauItemPreview"
import CoinIcon from "@/components/CoinIcon"
import { efeitoRaridade, melhorRaridade } from "@/lib/motion"
import { useMotionPrefs } from "@/lib/motion/prefs"
import { preloadSonsBau } from "@/utils/sfx"
import Antecipacao from "./Antecipacao"
import CartaItem, { type CartaHandle } from "./CartaItem"
import Estouro from "./Estouro"
import Moedas from "./Moedas"
import { BAU_IMAGENS, type BauResultado } from "./tipos"

export type { BauResultado, ItemResultado } from "./tipos"

// Abertura de baú (docs/animacoes/BOOST_ANIMACOES_GAMEBANK.md, Fase 2).
// Orquestra as fases; cada uma é um componente com a própria timeline:
//   luz     Antecipacao (o baú treme, a luz vaza) → Estouro (camada por
//           cima; no pico do clarão a fase troca por baixo da luz)
//   coins   Moedas (contagem com tique)
//   itens   CartaItem, uma carta por item (flip 3D por raridade)
//   resumo  tudo o que veio
// A recompensa já foi concedida pelo servidor: aqui é só apresentação.

type Fase = "luz" | "coins" | "itens" | "resumo"

type BauAberturaProps = {
  resultado: BauResultado | null
  onClose: () => void
}

export default function BauAbertura({ resultado, onClose }: BauAberturaProps) {
  const [fase, setFase]       = useState<Fase>("luz")
  const [itemIdx, setItemIdx] = useState(0)
  const [resumoVisiveis, setResumoVisiveis] = useState<number[]>([])
  const [estourando, setEstourando] = useState(false)
  const cenaRef  = useRef<HTMLDivElement>(null)
  const cartaRef = useRef<CartaHandle>(null)
  const resumoRef = useRef<HTMLDivElement>(null)
  const saindoRef = useRef(false)

  const { nivel } = useMotionPrefs()
  const melhor = melhorRaridade(resultado?.itens.map(i => i.raridade) ?? [])
  const efeitoMelhor = efeitoRaridade(melhor, nivel)
  const imagemBau = BAU_IMAGENS[resultado?.tipoBau ?? ""] ?? "/images/cofrinho.webp"

  // Reset ao receber novo resultado
  useEffect(() => {
    if (!resultado) return
    setFase("luz")
    setItemIdx(0)
    setResumoVisiveis([])
    setEstourando(false)
  }, [resultado])

  useEffect(() => { preloadSonsBau() }, [])

  // ── FASE RESUMO ───────────────────────────────────────────────────
  useEffect(() => {
    if (fase !== "resumo" || !resumoRef.current) return

    const ctx = gsap.context(() => {
      gsap.fromTo(resumoRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: "power2.out" }
      )

      // Coins/XP card
      const coinsCard = resumoRef.current?.querySelector<HTMLElement>('.resumo-card[data-idx="-1"]')
      if (coinsCard) {
        setTimeout(() => {
          gsap.fromTo(coinsCard, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" })
          setResumoVisiveis(prev => (prev.includes(-1) ? prev : [...prev, -1]))
        }, 150)
      }

      // Item cards
      resultado?.itens.forEach((_, i) => {
        setTimeout(() => {
          setResumoVisiveis(prev => [...prev, i])
          const card = resumoRef.current?.querySelector<HTMLElement>(`.resumo-card[data-idx="${i}"]`)
          if (card) {
            gsap.fromTo(card, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" })
          }
        }, (i + 1) * 150 + 150)
      })
    })

    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase])

  const avancar = useCallback(() => {
    if (!resultado) return

    if (fase === "luz") {
      // Toque na antecipação adianta o estouro; durante o estouro, nada.
      if (!estourando) setEstourando(true)
      return
    }

    if (fase === "coins") {
      // Sem itens (usuário já tem tudo) — pular direto para resumo
      setFase(resultado.itens.length === 0 ? "resumo" : "itens")
      return
    }

    if (fase === "itens") {
      // O toque primeiro termina a carta em curso; com ela revelada, avança.
      if (cartaRef.current?.tocar()) return
      if (saindoRef.current) return
      saindoRef.current = true
      const proximo = itemIdx + 1
      const seguir = () => {
        saindoRef.current = false
        if (proximo >= resultado.itens.length) setFase("resumo")
        else setItemIdx(proximo)
      }
      if (cartaRef.current) cartaRef.current.sair(seguir)
      else seguir()
      return
    }

    if (fase === "resumo") {
      // Exige que o card de coins/XP (idx -1) já tenha animado E todos os itens visíveis
      const coinsCardVisivel = resumoVisiveis.includes(-1);
      if (coinsCardVisivel && resumoVisiveis.length >= (resultado?.itens.length ?? 0) + 1) {
        onClose()
      }
    }
  }, [fase, itemIdx, resultado, resumoVisiveis, onClose, estourando])

  if (!resultado) return null

  // ── MULTI-OPEN: summary direto ─────────────────────────────────────
  if (resultado.batches) {
    return createPortal(
      <div style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "#09090b", overflowY: "auto",
        padding: "48px 24px 100px",
      }}>
        <p className="font-jaro text-xl text-zinc-100 text-center mb-2">
          Baús abertos!
        </p>
        <p className="font-inconsolata text-xs text-zinc-500 text-center mb-6">
          {resultado.quantidade} × {resultado.tipoBau}
        </p>

        {/* Total coins/XP */}
        <div className="flex justify-center gap-4 mb-6">
          <div style={{
            background: "#09090b", border: "1px solid #fbbf2422",
            borderRadius: 12, padding: "10px 20px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <CoinIcon size={20} />
            <span className="font-inconsolata text-sm text-amber-400 font-semibold">
              +{resultado.totalCoinsGanhos?.toLocaleString("pt-BR")}
            </span>
          </div>
          {resultado.totalXpBonus ? (
            <div style={{
              background: "#09090b", border: "1px solid #22d3ee22",
              borderRadius: 12, padding: "10px 20px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span className="font-inconsolata text-sm text-cyan-400">+{resultado.totalXpBonus} XP</span>
            </div>
          ) : null}
        </div>

        {/* Items grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 w-full max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto">
          {resultado.itens.map((i, idx) => {
            const cor = RARIDADES[i.raridade]?.cor ?? "#a1a1aa"
            return (
              <div key={`${i.id}-${idx}`}
                className="flex flex-col items-center gap-2 text-center p-3 sm:p-4"
                style={{
                  background: "#09090b",
                  border: `1px solid ${cor}22`,
                  borderTop: `2px solid ${cor}66`,
                  borderRadius: 12,
                }}
              >
                <div style={{ width: 56, height: 56 }}>
                  <BauItemPreview item={i} size={56} />
                </div>
                <p className="font-inconsolata text-[11px] text-zinc-400 leading-tight" style={{ margin: 0 }}>
                  {i.name}
                </p>
                <p className="font-inconsolata text-[11px] inline-flex items-center gap-1" style={{ color: cor, margin: 0 }}>
                  +{i.fragmentosGanhos} <Puzzle size={11} />
                </p>
                {i.itemCompleto && (
                  <Sparkles size={12} color="#4ade80" aria-label="Item desbloqueado" />
                )}
              </div>
            )
          })}
        </div>

        <button onClick={(e) => { e.stopPropagation(); onClose() }}
          style={{
            display: "block", margin: "32px auto 0",
            background: "#18181b", border: "1px solid #27272a",
            borderRadius: 16, padding: "12px 40px",
            fontFamily: "var(--font-inconsolata)", fontSize: 14,
            color: "#d4d4d8", cursor: "pointer",
          }}
        >
          Fechar
        </button>
      </div>,
      document.body
    )
  }

  const item = resultado.itens[itemIdx]

  return createPortal(
    <div
      onClick={avancar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        cursor: "pointer",
        userSelect: "none",
        background: "#09090b",
        overflow: "hidden",
      }}
    >
      {/* Cena: tudo o que treme no impacto. O estouro fica por cima dela. */}
      <div ref={cenaRef} style={{ position: "absolute", inset: 0 }}>
        {fase === "luz" && (
          <Antecipacao imagem={imagemBau} efeito={efeitoMelhor} nivel={nivel} onPronto={() => setEstourando(true)} />
        )}

        {fase === "coins" && (
          <Moedas coins={resultado.coinsGanhos} xpBonus={resultado.xpBonus} nivel={nivel} />
        )}

        {fase === "itens" && item && (
          <CartaItem
            key={`${item.id}-${itemIdx}`}
            ref={cartaRef}
            item={item}
            imagemBau={imagemBau}
            restantes={resultado.itens.length - itemIdx - 1}
            nivel={nivel}
          />
        )}

        {/* ── FASE RESUMO ───────────────────────────────────────────── */}
        {fase === "resumo" && (
          <div
            ref={resumoRef}
            style={{
              position: "absolute", inset: 0,
              background: "#09090b", opacity: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center",
              padding: "48px 24px 100px",
              overflowY: "auto",
            }}
          >
            <p style={{ fontFamily: "var(--font-jaro)", fontSize: 22, color: "#f4f4f5", marginBottom: 24 }}>
              Resumo do baú
            </p>

            <div
              className="resumo-card w-full max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-4xl"
              data-idx="-1"
              style={{
                opacity: 0,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#09090b",
                border: "1px solid #fbbf2422",
                borderLeft: "3px solid #fbbf24",
                borderRadius: "0 10px 10px 0",
                padding: "10px 16px", marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CoinIcon size={20} />
                <span style={{ fontFamily: "var(--font-inconsolata)", fontSize: 13, color: "#d4d4d8" }}>Coins</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {resultado.xpBonus && (
                  <span style={{ fontFamily: "var(--font-inconsolata)", fontSize: 14, color: "#22d3ee", fontWeight: 600 }}>
                    +{resultado.xpBonus} XP
                  </span>
                )}
                <span style={{ fontFamily: "var(--font-inconsolata)", fontSize: 14, color: "#fbbf24", fontWeight: 600 }}>
                  +{resultado.coinsGanhos.toLocaleString("pt-BR")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 w-full max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-4xl">
              {resultado.itens.map((i, idx) => {
                const cor = RARIDADES[i.raridade]?.cor ?? "#a1a1aa"
                return (
                  <div
                    key={i.id}
                    className="resumo-card flex flex-col items-center gap-2 text-center p-3 sm:p-4"
                    data-idx={idx}
                    style={{
                      opacity: 0,
                      background: "#09090b",
                      border: `1px solid ${cor}22`,
                      borderTop: `2px solid ${cor}66`,
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ width: 56, height: 56 }}>
                      <BauItemPreview item={i} size={56} />
                    </div>
                    <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 11, color: "#d4d4d8", margin: 0, lineHeight: 1.3 }}>
                      {i.name}
                    </p>
                    <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 11, color: cor, margin: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      +{i.fragmentosGanhos} <Puzzle size={11} />
                    </p>
                    {i.itemCompleto && (
                      <Sparkles size={12} color="#4ade80" aria-label="Item desbloqueado" />
                    )}
                  </div>
                )
              })}
            </div>

            {resumoVisiveis.includes(-1) && resumoVisiveis.length >= resultado.itens.length + 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onClose() }}
                style={{
                  position: "fixed",
                  bottom: 32,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 16,
                  padding: "12px 40px",
                  fontFamily: "var(--font-inconsolata)",
                  fontSize: 14,
                  color: "#d4d4d8",
                  cursor: "pointer",
                  zIndex: 10,
                }}
              >
                Fechar
              </button>
            )}
          </div>
        )}
      </div>

      {estourando && (
        <Estouro
          efeito={efeitoMelhor}
          nivel={nivel}
          duplo={melhor === "LENDARIO"}
          alvoTremor={cenaRef}
          onPico={() => setFase(f => (f === "luz" ? "coins" : f))}
          onFim={() => setEstourando(false)}
        />
      )}
    </div>,
    document.body
  )
}
