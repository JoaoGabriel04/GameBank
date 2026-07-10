'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCrosshairs } from "@fortawesome/free-solid-svg-icons"
import BoardTile from "./BoardTile"
import { GRID_SIZE, TILE_SIZE, BOARD_SIZE, posToGrid, posToPixelCenter } from "@/utils/tabuleiro-layout"
import type { Casa, GameSession } from "@/types/game"

const MIN_SCALE = 0.5
const MAX_SCALE = 3

type Props = {
  tabuleiro: Casa[]
  session: GameSession
  meuPlayerId?: number
}

export default function Board({ tabuleiro, session, meuPlayerId }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const dragState = useRef<{ dragging: boolean; lastX: number; lastY: number }>({ dragging: false, lastX: 0, lastY: 0 })
  const pinchState = useRef<{ pinching: boolean; startDist: number; startScale: number }>({ pinching: false, startDist: 0, startScale: 1 })

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

  const centerOn = useCallback((pos: number, scale?: number) => {
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const { x, y } = posToPixelCenter(pos)
    const s = scale ?? transform.scale
    setTransform({
      scale: s,
      x: rect.width / 2 - x * s,
      y: rect.height / 2 - y * s,
    })
  }, [transform.scale])

  // Ao montar: ajusta escala para caber o tabuleiro inteiro na viewport, centralizado
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const fitScale = clampScale(Math.min(rect.width / BOARD_SIZE, rect.height / BOARD_SIZE) * 0.95)
    setTransform({
      scale: fitScale,
      x: (rect.width - BOARD_SIZE * fitScale) / 2,
      y: (rect.height - BOARD_SIZE * fitScale) / 2,
    })
  }, [])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setTransform(t => ({ ...t, scale: clampScale(t.scale + delta) }))
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return // touch é tratado via touch events (suporta pinch)
    dragState.current = { dragging: true, lastX: e.clientX, lastY: e.clientY }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.dragging) return
    const dx = e.clientX - dragState.current.lastX
    const dy = e.clientY - dragState.current.lastY
    dragState.current.lastX = e.clientX
    dragState.current.lastY = e.clientY
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
  }

  const handlePointerUp = () => {
    dragState.current.dragging = false
  }

  const dist = (touches: React.TouchList) => {
    const [a, b] = [touches[0], touches[1]]
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchState.current = { pinching: true, startDist: dist(e.touches), startScale: transform.scale }
    } else if (e.touches.length === 1) {
      dragState.current = { dragging: true, lastX: e.touches[0].clientX, lastY: e.touches[0].clientY }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchState.current.pinching) {
      const ratio = dist(e.touches) / pinchState.current.startDist
      setTransform(t => ({ ...t, scale: clampScale(pinchState.current.startScale * ratio) }))
    } else if (e.touches.length === 1 && dragState.current.dragging) {
      const dx = e.touches[0].clientX - dragState.current.lastX
      const dy = e.touches[0].clientY - dragState.current.lastY
      dragState.current.lastX = e.touches[0].clientX
      dragState.current.lastY = e.touches[0].clientY
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchState.current.pinching = false
    if (e.touches.length === 0) dragState.current.dragging = false
  }

  const jogadoresAtivos = (session.jogadores ?? []).filter(p => !p.desistiu)

  return (
    <div className="relative w-full h-[70vh] min-h-[320px] bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden touch-none">
      <div
        ref={viewportRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative origin-top-left"
          style={{
            width: BOARD_SIZE,
            height: BOARD_SIZE,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          <div
            className="grid absolute inset-0"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, ${TILE_SIZE}px)`,
              gridTemplateRows: `repeat(${GRID_SIZE}, ${TILE_SIZE}px)`,
            }}
          >
            {tabuleiro.map((casa) => {
              const { row, col } = posToGrid(casa.pos)
              const sessionPosse = casa.propId != null
                ? session.sessionPosses?.find(sp => sp.propId === casa.propId)
                : undefined
              const players = jogadoresAtivos.filter(p => (p.posicao ?? 0) === casa.pos)
              return (
                <div key={casa.pos} style={{ gridRow: row, gridColumn: col }}>
                  <BoardTile casa={casa} sessionPosse={sessionPosse} players={players} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {meuPlayerId != null && (
        <button
          onClick={() => {
            const mine = jogadoresAtivos.find(p => p.id === meuPlayerId)
            centerOn(mine?.posicao ?? 0)
          }}
          className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-zinc-900/90 border border-zinc-700 hover:border-green-500 flex items-center justify-center text-zinc-300 hover:text-green-400 transition-colors cursor-pointer"
          title="Centralizar no meu peão"
        >
          <FontAwesomeIcon icon={faCrosshairs} />
        </button>
      )}
    </div>
  )
}
