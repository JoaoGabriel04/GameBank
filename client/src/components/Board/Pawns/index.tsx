'use client'

import { useLayoutEffect, useRef } from "react"
import { gsap } from "gsap"
import { TOTAL_CASAS, posToPixelCenter } from "@/utils/tabuleiro-layout"
import PlayerAvatar from "@/components/Board/PlayerAvatar"
import { useMotionPrefs } from "@/lib/motion/prefs"
import { corHexJogador, type Player } from "@/types/game"

// Peões no tabuleiro. A posição chega do store (session.jogadores[].posicao),
// que o Board só libera depois de o jogador ver os dados (holdSessionUpdates),
// então o peão nunca anda antes do resultado.
//
// Movimento (só transform, GPU):
// - até 12 casas (o máximo dos dados): anda casa a casa, com um pulo por
//   casa (no miolo do peão), ~130 ms por casa e teto de ~900 ms no total;
//   ao pousar, achata e a casa de destino pulsa na cor do jogador;
// - mais que isso (cartas, "vá para a prisão"): some e reaparece no
//   destino, em vez de atravessar o tabuleiro;
// - reduzido: desliza direto; desligado ou aba escondida: vai na hora.
// Um movimento novo no meio do caminho parte de onde o peão está desenhado.

const MAX_CASAS_ANDANDO = 12
const PASSO_S = 0.13
const TETO_S = 0.9
const PULO_PX = 26
// BUG 3 (TABULEIRO_FIXES): peões pouco visíveis nas casas de 140px —
// aumentado de 30 pra 44 e com sombra/anel branco (ver render abaixo).
const AVATAR_SIZE = 44

type Props = {
  players: Player[]
  /** Jogador da vez: o peão dele ganha um anel pulsante. */
  vezDe?: number | null
}

function canto(pos: number) {
  const { x, y } = posToPixelCenter(pos)
  return { x: x - AVATAR_SIZE / 2, y: y - AVATAR_SIZE / 2 }
}

// Quando múltiplos peões estão na mesma casa, espalha em pequeno círculo
// pra não se sobreporem completamente.
function offsetParaJogador(pos: number, players: Player[], playerId: number) {
  const naMesma = players.filter(p => (p.posicao ?? 0) === pos)
  const idx = naMesma.findIndex(p => p.id === playerId)
  const total = naMesma.length
  if (total <= 1) return { dx: 0, dy: 0 }
  const angle = (idx / total) * Math.PI * 2
  const raio = 14
  return { dx: Math.cos(angle) * raio, dy: Math.sin(angle) * raio }
}

export default function Pawns({ players, vezDe }: Props) {
  const elRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  // Casa em que cada peão está DESENHADO (não a lógica do store).
  const posVisual = useRef<Map<number, number>>(new Map())
  const animRefs = useRef<Map<number, gsap.core.Timeline>>(new Map())
  const pulsoRef = useRef<HTMLDivElement>(null)
  const { nivel } = useMotionPrefs()

  const pulsar = (pos: number, cor: string) => {
    const el = pulsoRef.current
    if (!el || nivel !== "completo") return
    const { x, y } = posToPixelCenter(pos)
    gsap.killTweensOf(el)
    gsap.fromTo(el,
      { x: x - 60, y: y - 60, scale: 0.35, opacity: 0.9, borderColor: cor },
      { scale: 1.15, opacity: 0, duration: 0.55, ease: "power2.out" },
    )
  }

  useLayoutEffect(() => {
    for (const player of players) {
      const el = elRefs.current.get(player.id)
      if (!el) continue
      const corpo = el.querySelector<HTMLElement>(".peao-corpo")
      const nova = player.posicao ?? 0
      const atual = posVisual.current.get(player.id)

      if (atual == null) {
        gsap.set(el, canto(nova))
        posVisual.current.set(player.id, nova)
        continue
      }
      if (atual === nova) continue

      animRefs.current.get(player.id)?.kill()
      const passos = (nova - atual + TOTAL_CASAS) % TOTAL_CASAS
      const cor = corHexJogador(player.cor)
      const chegou = () => {
        posVisual.current.set(player.id, nova)
        gsap.set(el, { zIndex: 10 })
      }

      if (nivel === "desligado" || document.hidden) {
        if (corpo) gsap.set(corpo, { y: 0, scaleX: 1, scaleY: 1, opacity: 1 })
        gsap.set(el, canto(nova))
        chegou()
        continue
      }

      gsap.set(el, { zIndex: 20 }) // quem anda passa por cima dos outros
      const tl = gsap.timeline({ onComplete: chegou })
      animRefs.current.set(player.id, tl)

      if (nivel === "reduzido") {
        tl.to(el, { ...canto(nova), duration: 0.25, ease: "power2.inOut" })
      } else if (passos > MAX_CASAS_ANDANDO) {
        // Teleporte: some na origem, reaparece no destino.
        if (corpo) tl.to(corpo, { scale: 0.2, opacity: 0, duration: 0.18, ease: "power2.in" })
        tl.set(el, canto(nova))
        if (corpo) tl.to(corpo, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2)" })
        tl.call(() => pulsar(nova, cor))
      } else {
        const d = Math.min(PASSO_S, TETO_S / passos)
        for (let i = 1; i <= passos; i++) {
          const casa = (atual + i) % TOTAL_CASAS
          tl.to(el, { ...canto(casa), duration: d, ease: "power1.inOut" })
          if (corpo) {
            tl.to(corpo, {
              keyframes: [
                { y: -PULO_PX, duration: d * 0.5, ease: "power2.out" },
                { y: 0, duration: d * 0.5, ease: "power2.in" },
              ],
            }, "<")
          }
          // Se um movimento novo chegar no meio, ele parte desta casa.
          tl.call(() => { posVisual.current.set(player.id, casa) })
        }
        // Pouso: achata e volta; a casa pulsa.
        if (corpo) {
          tl.to(corpo, { scaleX: 1.18, scaleY: 0.82, duration: 0.07, ease: "power2.out" })
          tl.to(corpo, { scaleX: 1, scaleY: 1, duration: 0.22, ease: "back.out(3)" })
        }
        tl.call(() => pulsar(nova, cor), [], "<")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.map(p => `${p.id}:${p.posicao}`).join(","), nivel])

  useLayoutEffect(() => () => { animRefs.current.forEach((t) => t.kill()) }, [])

  return (
    <>
      <div
        ref={pulsoRef}
        aria-hidden
        style={{
          position: "absolute", left: 0, top: 0, width: 120, height: 120, borderRadius: "50%",
          border: "4px solid #fff", opacity: 0, pointerEvents: "none", zIndex: 9,
        }}
      />
      {players.map((player) => {
        const { dx, dy } = offsetParaJogador(player.posicao ?? 0, players, player.id)
        return (
          <div
            key={player.id}
            ref={(el) => { if (el) elRefs.current.set(player.id, el) }}
            data-peao={player.id}
            className="absolute"
            style={{ left: 0, top: 0, width: AVATAR_SIZE, height: AVATAR_SIZE, zIndex: 10 }}
          >
            <div style={{ marginLeft: dx, marginTop: dy, position: "relative" }}>
              {player.id === vezDe && (
                <div
                  aria-hidden
                  className="gb-anel-vez absolute inset-0 rounded-full"
                  style={{ border: `3px solid ${corHexJogador(player.cor)}`, pointerEvents: "none" }}
                />
              )}
              <div
                className="peao-corpo rounded-full ring-2 ring-white/80"
                style={{ transformOrigin: "50% 100%", filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.7))" }}
              >
                <PlayerAvatar player={player} size={AVATAR_SIZE} />
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
