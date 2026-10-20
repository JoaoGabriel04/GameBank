"use client"

import { forwardRef, useImperativeHandle, useRef, useState } from "react"
import { Puzzle, Sparkles } from "lucide-react"
import { createTimeline, gsap, useGSAP } from "@/lib/motion/gsap"
import { efeitoRaridade, type NivelEfeitos } from "@/lib/motion"
import { RARIDADES } from "@/constants/raridade"
import BauItemPreview from "@/components/BauItemPreview"
import Faiscas, { type FaiscasHandle } from "@/components/Faiscas"
import { playSfx, type SfxNome } from "@/utils/sfx"
import Estouro from "./Estouro"
import { FUNDO_RARIDADE, type ItemResultado } from "./tipos"

// Revelação de um item: uma carta que vira (flip 3D). O verso é neutro e o
// fundo da raridade só entra quando a carta vira, então nada entrega a
// raridade antes da hora. Tratamento por raridade, depois de virar:
//   comum     pop simples
//   incomum   halo ciano
//   raro      halo + faíscas finas
//   épico     halo + anel de energia girando + tranco + vibração curta
//   lendário  suspense: o verso treme e vaza luz dourada; a carta vira no
//             pico de um estouro (Estouro.tsx) e raios dourados ficam atrás
//
// tocar(): termina a animação em curso (o suspense do lendário não pula com
// um toque; o botão "Pular" pula tudo). sair(): a carta sai pela esquerda.

export type CartaHandle = {
  /** true se o toque foi usado aqui (animação terminada ou ignorada). */
  tocar: () => boolean
  sair: (onFim: () => void) => void
}

type Props = {
  item: ItemResultado
  imagemBau: string
  restantes: number
  nivel: NivelEfeitos
}

const SOM_RARIDADE: Partial<Record<string, SfxNome>> = { RARO: "raro", EPICO: "epico", LENDARIO: "lendario" }

const CartaItem = forwardRef<CartaHandle, Props>(function CartaItem({ item, imagemBau, restantes, nivel }, ref) {
  const raiz = useRef<HTMLDivElement>(null)
  const palco = useRef<HTMLDivElement>(null)
  const faiscas = useRef<FaiscasHandle>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  const anelRef = useRef<gsap.core.Tween | null>(null)
  const girosRef = useRef<gsap.core.Tween[]>([])
  const suspenseRef = useRef(false)
  const reveladaRef = useRef(false)
  const disposePicoRef = useRef<(() => void) | null>(null)
  const [flash, setFlash] = useState(false)

  const lendario = item.raridade === "LENDARIO"
  const efeito = efeitoRaridade(item.raridade, nivel)
  const cor = RARIDADES[item.raridade]?.cor ?? "#a1a1aa"
  const completo = nivel === "completo"
  const q = gsap.utils.selector(raiz)

  // Depois de virar: fundo, halo, extras da raridade e as informações.
  const revelar = (tl: gsap.core.Timeline, t: number) => {
    tl.to(q(".car-fundo"), { opacity: 1, duration: 0.45, ease: "power2.out" }, t)
    if (item.raridade !== "COMUM") {
      tl.fromTo(q(".car-halo"), { opacity: 0, scale: 0.6 }, { opacity: 0.9, scale: 1.15, duration: 0.35, ease: "power2.out" }, t)
      tl.to(q(".car-halo"), { opacity: 0.45, scale: 1, duration: 0.6, ease: "power2.inOut" }, t + 0.35)
    }
    tl.call(() => {
      const som = SOM_RARIDADE[item.raridade]
      if (som) playSfx(som)
      const r = palco.current?.getBoundingClientRect()
      if (r && !lendario && (item.raridade === "RARO" || item.raridade === "EPICO")) {
        faiscas.current?.explodir({
          x: r.left + r.width / 2, y: r.top + r.height / 2, cor: efeito.cor,
          qtd: efeito.particulas * 2, forca: 520 + 260 * efeito.intensidade, gravidade: 380, tamanho: 1.8, vida: [0.5, 1.1],
        })
      }
      if (item.raridade === "EPICO") {
        anelRef.current = gsap.to(q(".car-anel"), { rotation: 360, duration: 3.2, ease: "none", repeat: -1 })
        if (completo) {
          gsap.fromTo(palco.current, { x: 0 }, { x: 9, duration: 0.4, ease: "gb-shake", clearProps: "x" })
          if (efeito.vibrar) navigator.vibrate?.(efeito.vibrar)
        }
      }
    }, [], t)
    if (item.raridade === "EPICO") {
      tl.fromTo(q(".car-anel"), { opacity: 0, scale: 0.7 }, { opacity: 0.9, scale: 1, duration: 0.45, ease: "gb-pop" }, t)
    }
    if (lendario) {
      tl.fromTo(q(".car-raios"), { opacity: 0, scale: 0.8 }, { opacity: 0.55, scale: 1, duration: 0.6, ease: "power2.out" }, t)
      // Giros contínuos ficam fora da timeline: dentro dela, a timeline
      // ficaria longa demais e o limite de segurança (ou um toque) faria
      // os raios pularem de posição.
      if (nivel === "completo") {
        tl.call(() => {
          girosRef.current.push(
            gsap.to(q(".car-raios"), { rotation: 360, duration: 60, ease: "none", repeat: -1 }),
            gsap.fromTo(q(".car-fundo-fluxo"), { xPercent: 0, yPercent: 0 }, { xPercent: -50, yPercent: -40, duration: 4, ease: "sine.inOut", yoyo: true, repeat: -1 }),
          )
        }, [], t)
      }
    }
    tl.fromTo(q(".car-info"), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power3.out" }, t + 0.2)
    if (item.fragmentosTotal) {
      const pct = Math.min(1, item.fragmentosAtuais / item.fragmentosTotal)
      tl.fromTo(q(".car-barra"), { scaleX: 0 }, { scaleX: pct, duration: 0.8, ease: "power2.out" }, t + 0.35)
    }
    tl.fromTo(q(".car-dica"), { opacity: 0 }, { opacity: 1, duration: 0.3 }, t + 0.6)
  }

  useGSAP(() => {
    const desligado = nivel === "desligado"
    const fim = () => { reveladaRef.current = true }
    const { tl, dispose } = createTimeline({ onComplete: lendario ? undefined : fim }, { limiteMs: lendario ? 4000 : 2500, instantanea: desligado })
    tlRef.current = tl

    // Entrada: a carta chega de costas. Opacidade e escala ficam num
    // wrapper: opacidade < 1 no elemento com preserve-3d achata o 3D e o
    // backface-visibility deixa de esconder a frente (aparecia espelhada).
    gsap.set(q(".car-carta"), { rotationY: 180 })
    tl.fromTo(q(".car-entrada"), { y: 40, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: "power3.out" }, 0)

    if (lendario) {
      // Suspense: treme cada vez mais, vaza luz dourada pelas bordas.
      suspenseRef.current = true
      const dur = Math.max(0.5, efeito.antecipacaoMs / 1000 * 0.7)
      tl.fromTo(q(".car-vaza"), { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1.25, duration: dur, ease: "power2.in" }, 0.3)
      if (completo) tl.to(q(".car-entrada"), { x: 7, rotation: 2.5, duration: dur, ease: "gb-tremor" }, 0.3)
      tl.call(() => setFlash(true), [], 0.3 + dur)
    } else {
      tl.call(() => playSfx("carta-virou"), [], 0.42)
      tl.to(q(".car-carta"), { rotationY: 0, duration: 0.6, ease: "back.out(1.4)" }, 0.42)
      tl.to(q(".car-entrada"), { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" }, 0.55)
      revelar(tl, 0.72)
    }

    return () => {
      dispose()
      disposePicoRef.current?.()
      anelRef.current?.kill()
      girosRef.current.forEach((g) => g.kill())
    }
  }, { scope: raiz })

  // Lendário: no pico do estouro, a carta já está virada por baixo da luz.
  const aoPico = () => {
    suspenseRef.current = false
    gsap.set(q(".car-carta"), { rotationY: 0 })
    gsap.set(q(".car-entrada"), { x: 0, rotation: 0 })
    gsap.set(q(".car-vaza"), { opacity: 0 })
    const { tl, dispose } = createTimeline({ onComplete: () => { reveladaRef.current = true } }, { limiteMs: 2500, instantanea: nivel === "desligado" })
    tlRef.current = tl
    disposePicoRef.current = dispose
    revelar(tl, 0)
  }

  useImperativeHandle(ref, () => ({
    tocar: () => {
      if (suspenseRef.current) return true
      if (!reveladaRef.current) {
        tlRef.current?.progress(1, false)
        reveladaRef.current = true
        return true
      }
      return false
    },
    sair: (onFim) => {
      let saiu = false
      const pronto = () => { if (!saiu) { saiu = true; onFim() } }
      gsap.to(q(".car-palco-geral"), { x: -80, opacity: 0, duration: 0.22, ease: "power2.in", onComplete: pronto })
      setTimeout(pronto, 600)
    },
  }))

  const fundo = FUNDO_RARIDADE[item.raridade]

  return (
    <div ref={raiz} style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#09090b" }}>
      {fundo && (
        <div className="car-fundo" style={{ position: "absolute", inset: 0, opacity: 0, overflow: "hidden", backgroundImage: lendario ? undefined : fundo }}>
          {lendario && (
            // Gradiente que "flui": uma camada 3× maior que desliza por
            // transform (GPU). Animar background-position repintaria a
            // tela inteira a cada quadro.
            <div className="car-fundo-fluxo" style={{ position: "absolute", left: 0, top: 0, width: "300%", height: "300%", backgroundImage: fundo }} />
          )}
        </div>
      )}

      <div
        className="car-palco-geral"
        style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}
      >
        <div ref={palco} style={{ position: "relative", width: 220, height: 290 }}>
          {lendario && (
            <div
              className="car-raios gb-luz"
              style={{
                position: "absolute", left: "50%", top: "50%", width: 760, height: 760, marginLeft: -380, marginTop: -380, opacity: 0, borderRadius: "50%",
                background: `repeating-conic-gradient(from 0deg, ${efeito.corClara}aa 0deg, ${cor}55 4deg, transparent 9deg, transparent 22.5deg)`,
                WebkitMaskImage: "radial-gradient(circle, #000 8%, rgba(0,0,0,0.5) 25%, transparent 50%)",
                maskImage: "radial-gradient(circle, #000 8%, rgba(0,0,0,0.5) 25%, transparent 50%)",
              }}
            />
          )}
          <div
            className="car-halo gb-luz"
            style={{
              position: "absolute", left: "50%", top: "50%", width: 420, height: 420, marginLeft: -210, marginTop: -210, opacity: 0, borderRadius: "50%",
              background: `radial-gradient(circle, ${cor}88 0%, ${cor}33 32%, transparent 62%)`,
            }}
          />
          {item.raridade === "EPICO" && (
            <div
              className="car-anel gb-luz"
              style={{
                position: "absolute", left: "50%", top: "50%", width: 340, height: 340, marginLeft: -170, marginTop: -170, opacity: 0, borderRadius: "50%",
                background: `conic-gradient(from 0deg, transparent 0deg, ${cor} 40deg, ${efeito.corClara} 70deg, ${cor} 100deg, transparent 150deg, transparent 180deg, ${cor} 220deg, ${efeito.corClara} 250deg, ${cor} 280deg, transparent 330deg)`,
                WebkitMaskImage: "radial-gradient(circle, transparent 57%, #000 59%, #000 63%, transparent 66%)",
                maskImage: "radial-gradient(circle, transparent 57%, #000 59%, #000 63%, transparent 66%)",
              }}
            />
          )}
          {lendario && (
            <div
              className="car-vaza gb-luz"
              style={{
                position: "absolute", inset: -40, opacity: 0, borderRadius: 28,
                background: `radial-gradient(ellipse at center, ${efeito.corClara}cc 0%, ${cor}66 30%, ${cor}22 52%, transparent 70%)`,
              }}
            />
          )}

          {/* A carta: verso (começa visível, girado 180°) e frente. */}
          <div className="car-entrada" style={{ position: "absolute", inset: 0, opacity: 0, perspective: 1000 }}>
          <div className="car-carta" style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
            <div
              aria-hidden
              style={{
                position: "absolute", inset: 0, borderRadius: 18, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0 6px, transparent 6px 12px), linear-gradient(150deg, #1d1d24, #0d0d11)",
                border: "1px solid #3f3f46", boxShadow: "inset 0 0 0 6px #111115, inset 0 0 0 7px #2a2a31",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagemBau} alt="" style={{ width: 96, height: 96, objectFit: "contain", opacity: 0.45, filter: "grayscale(0.4)" }} />
            </div>
            <div
              style={{
                position: "absolute", inset: 0, borderRadius: 18, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                background: "linear-gradient(160deg, #18181d, #0b0b0e)", border: `1px solid ${cor}66`,
                boxShadow: `0 0 40px ${cor}33, inset 0 1px 0 ${cor}44`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
              }}
            >
              <span
                style={{
                  background: `${cor}22`, border: `1px solid ${cor}66`, borderRadius: 20, padding: "4px 16px",
                  fontFamily: "var(--font-jaro)", fontSize: 13, color: cor,
                }}
              >
                {RARIDADES[item.raridade]?.label}
              </span>
              <BauItemPreview item={item} size={150} />
            </div>
          </div>
          </div>
        </div>

        <div className="car-info" aria-live="polite" style={{ textAlign: "center", opacity: 0, position: "relative" }}>
          <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 13, color: cor, marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Puzzle size={14} /> +{item.fragmentosGanhos} fragmentos
          </p>
          <p style={{ fontFamily: "var(--font-jaro)", fontSize: 22, color: "#f4f4f5", margin: "0 0 12px" }}>{item.name}</p>
          {item.fragmentosTotal ? (
            <div style={{ width: 260, margin: "0 auto 8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-inconsolata)", fontSize: 11, color: "#71717a", marginBottom: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Puzzle size={11} /> {item.fragmentosAtuais}/{item.fragmentosTotal}
                </span>
                <span>{Math.round((item.fragmentosAtuais / item.fragmentosTotal) * 100)}%</span>
              </div>
              <div style={{ background: "#27272a", borderRadius: 4, height: 6, overflow: "hidden" }}>
                <div className="car-barra" style={{ height: "100%", background: cor, borderRadius: 4, transformOrigin: "left", transform: "scaleX(0)" }} />
              </div>
            </div>
          ) : null}
          {item.itemCompleto && (
            <p style={{ fontFamily: "var(--font-inconsolata)", fontSize: 12, color: "#4ade80", marginTop: 4, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={13} /> Item desbloqueado!
            </p>
          )}
        </div>
      </div>

      <div className="car-dica" style={{ position: "absolute", bottom: 48, left: 0, right: 0, textAlign: "center", opacity: 0 }}>
        <span style={{ background: "#1a1a1a", border: "1px solid #27272a", borderRadius: 20, padding: "8px 20px", fontFamily: "var(--font-inconsolata)", fontSize: 13, color: "#a1a1aa" }}>
          {restantes > 0 ? `${restantes} ${restantes === 1 ? "item restante" : "itens restantes"}` : "Toque para ver o resumo"}
        </span>
      </div>

      <Faiscas ref={faiscas} />

      {flash && (
        <Estouro efeito={efeito} nivel={nivel} alvoTremor={palco} onPico={aoPico} onFim={() => setFlash(false)} />
      )}
    </div>
  )
})

export default CartaItem
