'use client'

import { useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { gsap } from "gsap"
import { RARIDADES } from "@/constants/raridade"
import BauItemPreview from "@/components/BauItemPreview"
import BauParticulas from "@/components/BauParticulas"
import CoinIcon from "@/components/CoinIcon"

export type ItemResultado = {
  id: number
  name: string
  type: string
  value?: string | null
  imageUrl?: string | null
  raridade: string
  animated?: boolean | null
  fragmentosGanhos: number
  fragmentosAtuais: number
  fragmentosTotal?: number | null
  itemCompleto: boolean
}

export type BauResultado = {
  tipoBau: string
  coinsGanhos: number
  fragmentosTotal: number
  xpBonus?: number
  itens: ItemResultado[]
}

type Fase = "luz" | "coins" | "itens" | "suspense" | "resumo"

type BauAberturaProps = {
  resultado: BauResultado | null
  onClose: () => void
}

const BAU_IMAGENS: Record<string, string> = {
  comum:    "/images/Cofrinho.png",
  premium:  "/images/Cofre Premium.png",
  lendario: "/images/Cofre Lendário.png",
}

const BAU_CORES: Record<string, string> = {
  comum:    "#22c55e",
  premium:  "#22d3ee",
  lendario: "#f4f4f5",
}

export default function BauAbertura({ resultado, onClose }: BauAberturaProps) {
  const [fase, setFase]           = useState<Fase>("luz")
  const [itemIdx, setItemIdx]     = useState(0)
  const [bloqueado, setBloqueado] = useState(false)
  const [resumoVisiveis, setResumoVisiveis] = useState<number[]>([])

  // Fase: luz
  const pigRef   = useRef<HTMLImageElement>(null)
  const lightRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)

  // Fase: coins
  const coinsScreenRef = useRef<HTMLDivElement>(null)
  const coinsCircleRef = useRef<HTMLDivElement>(null)
  const coinsTextRef   = useRef<HTMLDivElement>(null)
  const coinsHintRef   = useRef<HTMLParagraphElement>(null)

  // Fase: itens / suspense
  const itemBadgeRef   = useRef<HTMLDivElement>(null)
  const itemCardRef    = useRef<HTMLDivElement>(null)
  const itemInfoRef    = useRef<HTMLDivElement>(null)
  const itemHintRef    = useRef<HTMLDivElement>(null)
  // Lendário reveal
  const lendRevealRef  = useRef<HTMLDivElement>(null)
  const lendFlashRef   = useRef<HTMLDivElement>(null)
  const fromSuspenseRef = useRef(false)

  // Fase: resumo
  const resumoRef = useRef<HTMLDivElement>(null)

  const item    = resultado?.itens[itemIdx] ?? null
  const corItem = RARIDADES[item?.raridade ?? "COMUM"]?.cor ?? "#a1a1aa"
  const isLend  = item?.raridade === "LENDARIO"
  const corBau  = BAU_CORES[resultado?.tipoBau ?? "comum"] ?? "#22c55e"

  // Reset ao receber novo resultado
  useEffect(() => {
    if (!resultado) return
    setFase("luz")
    setItemIdx(0)
    setBloqueado(false)
    setResumoVisiveis([])
  }, [resultado])

  // ── FASE LUZ ──────────────────────────────────────────────────────
  // resultado nas deps: o componente fica montado com resultado=null.
  // Quando resultado se torna não-null, fase já é "luz" e não muda —
  // sem resultado nas deps o efeito nunca re-dispara e a animação trava.
  useEffect(() => {
    if (fase !== "luz" || !resultado) return
    if (!pigRef.current || !lightRef.current || !flashRef.current) return

    gsap.set(lightRef.current, { scale: 0, opacity: 0 })

    const tl = gsap.timeline({ onComplete: () => setFase("coins") })

    tl.to(pigRef.current, {
      keyframes: [
        { scale: 1.05, rotation: -4, duration: 0.15 },
        { scale: 1.05, rotation:  4, duration: 0.15 },
        { scale: 1.10, rotation: -4, duration: 0.15 },
        { scale: 1.10, rotation:  4, duration: 0.15 },
        { scale: 1.20, rotation:  0, duration: 0.15 },
        { scale: 0,    opacity: 0,   duration: 0.20 },
      ],
      ease: "none",
    }, 0)

    tl.to(lightRef.current, {
      keyframes: [
        { scale: 0.3, opacity: 0.7, duration: 0.15 },
        { scale: 1,   opacity: 1,   duration: 0.20 },
        { scale: 5,   opacity: 1,   duration: 0.35 },
        { scale: 15,  opacity: 0,   duration: 0.40 },
      ],
      ease: "power2.out",
    }, 0.5)

    tl.to(flashRef.current, {
      keyframes: [
        { opacity: 0, duration: 0.05 },
        { opacity: 1, duration: 0.12 },
        { opacity: 1, duration: 0.06 },
        { opacity: 0, duration: 0.30 },
      ],
      ease: "none",
    }, 1.15)

    // Fallback: garante transição mesmo se onComplete não disparar
    const fallback = setTimeout(() => setFase("coins"), 2200)

    return () => {
      tl.kill()
      clearTimeout(fallback)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, resultado])

  // ── FASE COINS ────────────────────────────────────────────────────
  useEffect(() => {
    if (fase !== "coins") return
    if (!coinsScreenRef.current || !coinsCircleRef.current || !coinsTextRef.current || !coinsHintRef.current) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      tl.fromTo(coinsScreenRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: "power2.out" }
      )
      tl.fromTo(coinsCircleRef.current,
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" },
        0.1
      )
      tl.fromTo(coinsTextRef.current,
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" },
        0.35
      )
      tl.fromTo(coinsHintRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3 },
        0.7
      )
    })

    return () => ctx.revert()
  }, [fase])

  // ── FASE ITENS ────────────────────────────────────────────────────
  useEffect(() => {
    if (fase !== "itens") return
    if (!itemBadgeRef.current || !itemCardRef.current || !itemInfoRef.current) return

    const wasSuspense = fromSuspenseRef.current
    fromSuspenseRef.current = false

    const ctx = gsap.context(() => {
      const tl = gsap.timeline()

      if (wasSuspense) {
        // Card já está visível no centro — só revela os labels
        tl.fromTo(itemBadgeRef.current,
          { opacity: 0, scale: 0.75 },
          { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.6)" }
        )
        tl.fromTo(itemInfoRef.current,
          { y: 28, opacity: 0 },
          { y: 0,  opacity: 1, duration: 0.45, ease: "power3.out" },
          0.1
        )
      } else {
        // Entrada normal com push lateral
        tl.fromTo(itemBadgeRef.current,
          { y: -20, opacity: 0 },
          { y: 0,   opacity: 1, duration: 0.3, ease: "power3.out" }
        )
        tl.fromTo(itemCardRef.current,
          { x: "100%", opacity: 0 },
          { x: 0,      opacity: 1, duration: 0.4, ease: "power3.out" },
          0
        )
        tl.fromTo(itemInfoRef.current,
          { y: 20, opacity: 0 },
          { y: 0,  opacity: 1, duration: 0.35, ease: "power3.out" },
          0.15
        )
      }

      if (itemHintRef.current) {
        tl.fromTo(itemHintRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.3 },
          wasSuspense ? 0.3 : 0.4
        )
      }

      // Barra de progresso
      if (item?.fragmentosTotal) {
        const barEl = document.querySelector<HTMLElement>(".item-progress-bar")
        if (barEl) {
          const pct = Math.min(100, (item.fragmentosAtuais / item.fragmentosTotal) * 100)
          gsap.fromTo(barEl, { width: "0%" }, { width: `${pct}%`, duration: 0.8, ease: "power2.out", delay: 0.3 })
        }
      }
    })

    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, itemIdx])

  // ── FASE SUSPENSE (lendário) ──────────────────────────────────────
  useEffect(() => {
    if (fase !== "suspense") return
    if (!itemCardRef.current || !lendRevealRef.current || !lendFlashRef.current) return

    // Garante posição inicial limpa
    gsap.set(itemCardRef.current,   { scale: 0, opacity: 1, x: 0 })
    gsap.set(lendRevealRef.current, { opacity: 1 })
    gsap.set(lendFlashRef.current,  { opacity: 0 })

    const tl = gsap.timeline({
      onComplete: () => {
        fromSuspenseRef.current = true
        setBloqueado(false)
        setFase("itens")
      },
    })

    // 1. Círculo escala do centro — mais lento para criar expectativa
    tl.to(itemCardRef.current, {
      scale: 1, duration: 0.7, ease: "back.out(1.7)"
    }, 0)

    // 2. Primeira sequência de flashes — agitado
    tl.to(lendFlashRef.current, {
      keyframes: [
        { opacity: 0.65, duration: 0.07 },
        { opacity: 0,    duration: 0.10 },
        { opacity: 0.85, duration: 0.06 },
        { opacity: 0,    duration: 0.12 },
      ],
      ease: "none",
    }, 0.6)

    // 3. Bounce lento do círculo
    tl.to(itemCardRef.current, {
      scale: 1.08, duration: 0.2, ease: "power2.out",
      yoyo: true, repeat: 1,
    }, 0.85)

    // 4. Segunda sequência — mais intensa e prolongada
    tl.to(lendFlashRef.current, {
      keyframes: [
        { opacity: 0.9, duration: 0.08 },
        { opacity: 0.2, duration: 0.10 },
        { opacity: 1.0, duration: 0.08 },
        { opacity: 0.4, duration: 0.10 },
        { opacity: 0.9, duration: 0.06 },
        { opacity: 0,   duration: 0.25 },
      ],
      ease: "none",
    }, 1.1)

    // 5. Tremor do círculo durante os flashes
    tl.to(itemCardRef.current, {
      x: -8, duration: 0.06, ease: "none",
      yoyo: true, repeat: 8,
    }, 1.15)

    // 6. Terceira sequência — flash falso (acalma, depois explode)
    tl.to(lendFlashRef.current, {
      keyframes: [
        { opacity: 0.45, duration: 0.10 },
        { opacity: 0,    duration: 0.35 },
      ],
      ease: "none",
    }, 1.6)

    // 7. Pausa dramática — silêncio antes da explosão
    tl.to(itemCardRef.current, {
      scale: 1.02, duration: 0.3, ease: "power1.out",
    }, 1.9)

    // 8. Flash final — máxima intensidade
    tl.to(lendFlashRef.current, {
      keyframes: [
        { opacity: 1,   duration: 0.08 },
        { opacity: 0.6, duration: 0.08 },
        { opacity: 1,   duration: 0.08 },
        { opacity: 0,   duration: 0.50 },
      ],
      ease: "none",
    }, 2.3)

    // 9. Círculo treme e incha na explosão
    tl.to(itemCardRef.current, {
      x: 0, scale: 1.1, duration: 0.15, ease: "power3.out",
    }, 2.35)
    tl.to(itemCardRef.current, {
      scale: 1, duration: 0.25, ease: "power2.inOut",
    }, 2.55)

    // 10. Overlay de mistério some → conteúdo revelado
    tl.to(lendRevealRef.current, {
      opacity: 0, duration: 0.4, ease: "power2.out",
    }, 2.6)

    return () => { tl.kill() }
  }, [fase])

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
    if (bloqueado || !resultado) return

    if (fase === "luz") {
      gsap.killTweensOf([pigRef.current, lightRef.current, flashRef.current])
      setFase("coins")
      return
    }

    if (fase === "coins") {
      setFase("itens")
      return
    }

    if (fase === "itens") {
      const proximo = itemIdx + 1

      if (proximo >= resultado.itens.length) {
        if (!itemCardRef.current) return
        gsap.to(itemCardRef.current, {
          x: "-100%", opacity: 0, duration: 0.2, ease: "power2.in",
          onComplete: () => setFase("resumo"),
        })
        return
      }

      const proximoItem = resultado.itens[proximo]
      const isNextLend  = proximoItem.raridade === "LENDARIO"

      gsap.to(itemCardRef.current, {
        x: "-100%", opacity: 0, duration: 0.2, ease: "power2.in",
        onComplete: () => {
          setItemIdx(proximo)
          if (isNextLend) {
            setBloqueado(true)
            setFase("suspense")
          }
        },
      })
      return
    }

    if (fase === "resumo") {
      if (resumoVisiveis.length >= (resultado?.itens.length ?? 0)) {
        onClose()
      }
    }
  }, [fase, itemIdx, resultado, bloqueado, resumoVisiveis, onClose])

  if (!resultado) return null

  return createPortal(
    <div
      onClick={avancar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        cursor: bloqueado ? "default" : "pointer",
        userSelect: "none",
      }}
    >
      {/* ── FASE LUZ ──────────────────────────────────────────────── */}
      {fase === "luz" && (
        <div style={{
          position: "absolute", inset: 0,
          background: "#09090b",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={pigRef}
            src={BAU_IMAGENS[resultado.tipoBau] ?? "/images/Cofrinho.png"}
            alt="cofrinho"
            style={{ width: 160, height: 160, objectFit: "contain", zIndex: 2 }}
          />

          {/* Esfera de luz — gradiente radial branco, GSAP anima scale e opacity */}
          <div
            ref={lightRef}
            style={{
              position: "absolute",
              width: 80, height: 80,
              borderRadius: "50%",
              background: "radial-gradient(circle at center, rgba(255,255,255,1) 0%, rgba(255,255,255,0.7) 35%, rgba(255,255,255,0.15) 65%, transparent 100%)",
              boxShadow: "0 0 80px 40px rgba(255,255,255,0.35)",
              opacity: 0,
              zIndex: 10,
            }}
          />

          {/* Flash branco — gradiente radial, GSAP anima só opacity */}
          <div
            ref={flashRef}
            style={{
              position: "absolute", inset: 0,
              background: "radial-gradient(ellipse at center, rgba(255,255,255,1) 0%, rgba(255,255,255,0.92) 35%, rgba(255,255,255,0.6) 65%, rgba(255,255,255,0.15) 100%)",
              opacity: 0,
              zIndex: 20,
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* ── FASE COINS ────────────────────────────────────────────── */}
      {fase === "coins" && (
        <div
          ref={coinsScreenRef}
          style={{
            position: "absolute", inset: 0,
            background: "#09090b",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 16, opacity: 0,
          }}
        >
          <div
            ref={coinsCircleRef}
            style={{
              width: 200, height: 200,
              borderRadius: "50%",
              border: "2px solid #fbbf2466",
              boxShadow: "0 0 30px #fbbf2444, 0 0 60px #fbbf2422",
              background: "#09090b",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: 0,
            }}
          >
            <CoinIcon size={80} />
          </div>

          <div ref={coinsTextRef} style={{ textAlign: "center", opacity: 0 }}>
            {resultado.xpBonus ? (
              <>
                <p style={{ fontFamily: "var(--font-jaro)", fontSize: 32, color: "#fbbf24", margin: 0 }}>
                  +{resultado.xpBonus} XP
                </p>
                <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 13, color: "#22d3ee", marginTop: 4 }}>
                  Bônus por baú vazio
                </p>
              </>
            ) : (
              <>
                <p style={{ fontFamily: "var(--font-jaro)", fontSize: 32, color: "#fbbf24", margin: 0 }}>
                  +{resultado.coinsGanhos.toLocaleString("pt-BR")}
                </p>
                <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 13, color: "#71717a", marginTop: 4 }}>
                  Coins garantidos
                </p>
              </>
            )}
          </div>

          <p
            ref={coinsHintRef}
            style={{
              fontFamily: "var(--font-inconsolata)",
              fontSize: 12, color: "#52525b",
              position: "absolute", bottom: 48, opacity: 0,
            }}
          >
            Clique para continuar...
          </p>
        </div>
      )}

      {/* ── FASE ITENS / SUSPENSE ─────────────────────────────────── */}
      {(fase === "itens" || fase === "suspense") && item && (
        <div
          style={{
            position: "absolute", inset: 0,
            backgroundColor: "#09090b",
            backgroundImage: isLend
              ? "linear-gradient(-45deg, #2a1500, #5c2d00, #b85a00, #fbbf2433)"
              : item.raridade === "EPICO" ? "linear-gradient(to bottom, #09090b, #1f0033)"
              : item.raridade === "RARO"  ? "linear-gradient(to bottom, #09090b, #0a3b1e)"
              : "none",
            backgroundSize: isLend ? "400% 400%" : undefined,
            animation:      isLend ? "bau-lendario-bg 4s ease infinite" : undefined,
            overflow: "hidden",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 24,
          }}
        >
          <div
            ref={itemBadgeRef}
            style={{
              background: `${corItem}22`,
              border: `1px solid ${corItem}66`,
              borderRadius: 20,
              padding: "6px 20px",
              fontFamily: "var(--font-jaro)",
              fontSize: 14, color: corItem,
              zIndex: 1, opacity: 0,
            }}
          >
            {RARIDADES[item.raridade]?.label}
          </div>

          <div ref={itemCardRef} style={{ position: "relative", zIndex: 1, opacity: 0 }}>
            <BauItemPreview item={item} size={200} />

            {/* Overlay de mistério — cobre conteúdo durante o suspense lendário */}
            {isLend && (
              <div
                ref={lendRevealRef}
                style={{
                  position: "absolute",
                  top: "50%", left: "50%",
                  width: 200, height: 200,
                  transform: "translate(-50%, -50%)",
                  borderRadius: "50%",
                  background: "radial-gradient(circle at 38% 32%, #2a1200, #0d0800)",
                  border: "2px solid #fbbf2488",
                  boxShadow: "0 0 48px #fbbf2466, 0 0 100px #b85a0033",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  zIndex: 10,
                  opacity: 0,
                  pointerEvents: "none",
                }}
              >
                <span style={{ fontSize: 72, opacity: 0.25, userSelect: "none" }}>✨</span>
              </div>
            )}

            {(item.raridade === "EPICO" || item.raridade === "LENDARIO") && (
              <BauParticulas
                cor={corItem}
                ativo={fase === "itens"}
                qtd={isLend ? 20 : 12}
              />
            )}
          </div>

          {/* Flash de tela inteira para o reveal lendário */}
          {isLend && (
            <div
              ref={lendFlashRef}
              style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse at center, rgba(255,255,255,1) 0%, rgba(255,240,200,0.9) 40%, rgba(255,200,100,0.45) 70%, transparent 100%)",
                opacity: 0,
                zIndex: 50,
                pointerEvents: "none",
              }}
            />
          )}

          <div ref={itemInfoRef} style={{ textAlign: "center", zIndex: 1, opacity: 0 }}>
            <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 13, color: corItem, marginBottom: 4 }}>
              +{item.fragmentosGanhos} 🧩
            </p>
            <p style={{ fontFamily: "var(--font-jaro)", fontSize: 22, color: "#f4f4f5", margin: "0 0 12px" }}>
              {item.name}
            </p>

            {item.fragmentosTotal && (
              <div style={{ width: 260, margin: "0 auto 8px" }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontFamily: "var(--font-inconsolata)",
                  fontSize: 11, color: "#71717a", marginBottom: 6,
                }}>
                  <span>🧩 {item.fragmentosAtuais}/{item.fragmentosTotal}</span>
                  <span>{Math.round((item.fragmentosAtuais / item.fragmentosTotal) * 100)}%</span>
                </div>
                <div style={{ background: "#27272a", borderRadius: 4, height: 6, overflow: "hidden" }}>
                  <div
                    className="item-progress-bar"
                    style={{ width: 0, height: "100%", background: corItem, borderRadius: 4 }}
                  />
                </div>
              </div>
            )}

            {item.itemCompleto && (
              <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 12, color: "#4ade80", marginTop: 4 }}>
                ✨ Item desbloqueado!
              </p>
            )}
          </div>

          <div
            ref={itemHintRef}
            style={{ position: "absolute", bottom: 48, textAlign: "center", zIndex: 1, opacity: 0 }}
          >
            <div style={{
              background: "#1a1a1a", border: "1px solid #27272a",
              borderRadius: 20, padding: "8px 20px",
              fontFamily: "var(--font-inconsolata)",
              fontSize: 13, color: "#a1a1aa", marginBottom: 8,
            }}>
              {resultado.itens.length - itemIdx - 1} itens restantes
            </div>
            <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 11, color: "#52525b", margin: 0 }}>
              {fase === "suspense"
                ? "Prepare-se..."
                : itemIdx < resultado.itens.length - 1
                ? "Clique para revelar..."
                : "Clique para ver o resumo..."}
            </p>
          </div>
        </div>
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

          {resultado.xpBonus ? (
            <div
              className="resumo-card w-full max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-4xl"
              data-idx="-1"
              style={{
                opacity: 0,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "#09090b",
                border: "1px solid #22d3ee22",
                borderLeft: "3px solid #22d3ee",
                borderRadius: "0 10px 10px 0",
                padding: "10px 16px", marginBottom: 8,
              }}
            >
              <span style={{ fontFamily: "var(--font-inconsolata)", fontSize: 13, color: "#d4d4d8" }}>XP Bônus</span>
              <span style={{ fontFamily: "var(--font-inconsolata)", fontSize: 14, color: "#22d3ee", fontWeight: 600 }}>
                +{resultado.xpBonus}
              </span>
            </div>
          ) : (
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
              <span style={{ fontFamily: "var(--font-inconsolata)", fontSize: 14, color: "#fbbf24", fontWeight: 600 }}>
                +{resultado.coinsGanhos.toLocaleString("pt-BR")}
              </span>
            </div>
          )}

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
                  <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 11, color: cor, margin: 0 }}>
                    +{i.fragmentosGanhos} 🧩
                  </p>
                  {i.itemCompleto && (
                    <span style={{ fontSize: 10, color: "#4ade80" }}>✨</span>
                  )}
                </div>
              )
            })}
          </div>

          {resumoVisiveis.length >= resultado.itens.length && (
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
    </div>,
    document.body
  )
}
