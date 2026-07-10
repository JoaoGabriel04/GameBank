'use client'

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { TOTAL_CASAS, posToPixelCenter, TILE_SIZE } from "@/utils/tabuleiro-layout"
import { PLAYER_COLORS, type Player } from "@/types/game"

const PASSO_DURACAO_S = 0.18 // duração de cada casa andada
const MAX_CASAS_ANIMADAS = 12 // acima disso (ex: teleporte pra prisão), só salta

type Props = {
  players: Player[]
}

export default function Pawns({ players }: Props) {
  const refs = useRef<Map<number, HTMLDivElement>>(new Map())
  const posicoesAnteriores = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    const elementosAtuais = refs.current
    for (const player of players) {
      const el = refs.current.get(player.id)
      if (!el) continue

      const novaPos = player.posicao ?? 0
      const posAnterior = posicoesAnteriores.current.get(player.id)
      posicoesAnteriores.current.set(player.id, novaPos)

      const centro = (pos: number) => {
        const { x, y } = posToPixelCenter(pos)
        return { x: x - TILE_SIZE / 2, y: y - TILE_SIZE / 2 }
      }

      if (posAnterior == null) {
        // primeira renderização: só posiciona, sem animar
        gsap.set(el, centro(novaPos))
        continue
      }

      if (posAnterior === novaPos) continue

      const passos = (novaPos - posAnterior + TOTAL_CASAS) % TOTAL_CASAS
      if (passos === 0 || passos > MAX_CASAS_ANIMADAS) {
        // salto grande (ex: prisão) — sem animação casa-a-casa
        gsap.to(el, { ...centro(novaPos), duration: 0.3, ease: "power2.out" })
        continue
      }

      const tl = gsap.timeline()
      for (let i = 1; i <= passos; i++) {
        const { x, y } = centro((posAnterior + i) % TOTAL_CASAS)
        tl.to(el, { x, y, duration: PASSO_DURACAO_S, ease: "power1.inOut" })
          .to(el, { y: y - 6, duration: PASSO_DURACAO_S / 2, yoyo: true, repeat: 1, ease: "power1.inOut" }, "<")
      }
    }

    return () => {
      gsap.killTweensOf(Array.from(elementosAtuais.values()))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.map(p => `${p.id}:${p.posicao}`).join(",")])

  return (
    <>
      {players.map((player, idx) => {
        const cor = PLAYER_COLORS.find(c => c.value === player.cor)
        // pequeno leque pra não empilhar exatamente no centro quando vários
        // peões estão na mesma casa
        const offset = (idx % 4) * 6 - 9
        return (
          <div
            key={player.id}
            ref={(el) => { if (el) refs.current.set(player.id, el) }}
            className="absolute top-0 left-0 pointer-events-none flex items-center justify-center"
            style={{ width: TILE_SIZE, height: TILE_SIZE, marginLeft: offset, marginTop: offset }}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full border-2 border-zinc-950 shadow-md ${cor?.bg ?? "bg-zinc-500"}`}
              title={player.nome}
            />
          </div>
        )
      })}
    </>
  )
}
