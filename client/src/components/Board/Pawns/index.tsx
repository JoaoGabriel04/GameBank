'use client'

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { TOTAL_CASAS, posToPixelCenter } from "@/utils/tabuleiro-layout"
import PlayerAvatar from "@/components/Board/PlayerAvatar"
import type { Player } from "@/types/game"

const PASSO_DURACAO_S = 0.15
const MAX_CASAS_ANIMADAS = 12
// BUG 3 (TABULEIRO_FIXES): peões pouco visíveis nas casas de 140px —
// aumentado de 30 pra 44 e com sombra/anel branco (ver render abaixo).
const AVATAR_SIZE = 44

type Props = {
  players: Player[]
}

function tileCenterPx(pos: number) {
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

export default function Pawns({ players }: Props) {
  const elRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const ultimaPos = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    const elementos = elRefs.current
    for (const player of players) {
      const el = elementos.get(player.id)
      if (!el) continue

      const novaPos = player.posicao ?? 0
      const anterior = ultimaPos.current.get(player.id)

      if (anterior == null) {
        const { x, y } = tileCenterPx(novaPos)
        el.style.left = `${x}px`
        el.style.top = `${y}px`
        ultimaPos.current.set(player.id, novaPos)
        continue
      }

      if (anterior === novaPos) continue

      gsap.killTweensOf(el)

      const passos = (novaPos - anterior + TOTAL_CASAS) % TOTAL_CASAS
      if (passos === 0 || passos > MAX_CASAS_ANIMADAS) {
        const { x, y } = tileCenterPx(novaPos)
        gsap.to(el, { left: x, top: y, duration: 0.3, ease: "power2.out" })
      } else {
        const tl = gsap.timeline()
        for (let i = 1; i <= passos; i++) {
          const { x, y } = tileCenterPx((anterior + i) % TOTAL_CASAS)
          tl.to(el, { left: x, top: y, duration: PASSO_DURACAO_S, ease: "power1.inOut" })
        }
      }

      ultimaPos.current.set(player.id, novaPos)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.map(p => `${p.id}:${p.posicao}`).join(",")])

  return (
    <>
      {players.map((player) => {
        const { dx, dy } = offsetParaJogador(player.posicao ?? 0, players, player.id)
        return (
          <div
            key={player.id}
            ref={(el) => { if (el) elRefs.current.set(player.id, el) }}
            className="absolute"
            style={{ left: 0, top: 0, width: AVATAR_SIZE, height: AVATAR_SIZE, zIndex: 10 }}
          >
            <div
              className="rounded-full ring-2 ring-white/80"
              style={{
                marginLeft: dx,
                marginTop: dy,
                filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.7))",
              }}
            >
              <PlayerAvatar player={player} size={AVATAR_SIZE} />
            </div>
          </div>
        )
      })}
    </>
  )
}
