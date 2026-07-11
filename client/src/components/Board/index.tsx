'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCrosshairs } from "@fortawesome/free-solid-svg-icons"
import BoardTile from "./BoardTile"
import TurnoBanner from "./TurnoBanner"
import TurnoModal from "./TurnoModal"
import Pawns from "./Pawns"
import { GRID_SIZE, TILE_SIZE, BOARD_SIZE, posToGrid, posToPixelCenter } from "@/utils/tabuleiro-layout"
import { ARTE_CENTRAL, FUNDO_TABULEIRO, GRUPO_IMAGENS_PRELOAD } from "@/utils/tabuleiro-images"
import { useGameStore } from "@/stores/gameStore"
import { useToast } from "@/components/Toast"
import { playSfx, stopSfx } from "@/utils/sfx"
import type { RolarDadosResult } from "@/services/api/turno"
import type { Casa, GameSession } from "@/types/game"

const MIN_SCALE = 0.3
const MAX_SCALE = 2.5

type Props = {
  tabuleiro: Casa[]
  session: GameSession
  meuPlayerId?: number
}

export default function Board({ tabuleiro, session, meuPlayerId }: Props) {
  const { rolarDados, comprarCasaAtual, recusarCompra } = useGameStore()
  const { success: toastSuccess, error: toastError } = useToast()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 })
  const transformRef = useRef(transform)
  transformRef.current = transform
  const dragState = useRef<{ dragging: boolean; lastX: number; lastY: number }>({ dragging: false, lastX: 0, lastY: 0 })
  const pinchState = useRef<{ pinching: boolean; startDist: number; startScale: number; centerX: number; centerY: number }>({ pinching: false, startDist: 0, startScale: 1, centerX: 0, centerY: 0 })

  // ── Modal unificado de turno (rolar dados → resultado → desfecho/ação) ──
  const [rolando, setRolando] = useState(false)
  const [resultado, setResultado] = useState<RolarDadosResult | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [erroCompra, setErroCompra] = useState<string | null>(null)
  const decidindoRef = useRef(false)

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

  const clampPosition = useCallback((t: typeof transform) => {
    const vp = viewportRef.current
    if (!vp) return t
    const rect = vp.getBoundingClientRect()
    const bw = BOARD_SIZE * t.scale
    const bh = BOARD_SIZE * t.scale
    const margin = Math.min(rect.width, rect.height) * 0.15
    const minX = Math.min(0, margin - bw)
    const maxX = Math.max(0, rect.width - margin)
    const minY = Math.min(0, margin - bh)
    const maxY = Math.max(0, rect.height - margin)
    if (minX > maxX) return { ...t, x: (rect.width - bw) / 2, y: (rect.height - bh) / 2 }
    return {
      ...t,
      x: Math.min(maxX, Math.max(minX, t.x)),
      y: Math.min(maxY, Math.max(minY, t.y)),
    }
  }, [])

  // Wrapper que aplica clampPosition após cada atualização
  const setTransformClamped = useCallback((updater: typeof transform | ((prev: typeof transform) => typeof transform)) => {
    setTransform(prev => clampPosition(typeof updater === "function" ? updater(prev) : updater))
  }, [clampPosition])

  const centerOn = useCallback((pos: number, scale?: number) => {
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const { x, y } = posToPixelCenter(pos)
    const s = scale ?? transform.scale
    setTransformClamped({
      scale: s,
      x: rect.width / 2 - x * s,
      y: rect.height / 2 - y * s,
    })
  }, [setTransformClamped, transform.scale])

  // Preload das imagens de grupo — evita flash ao renderizar o tabuleiro,
  // já que as mesmas 9 imagens se repetem em várias casas.
  useEffect(() => {
    GRUPO_IMAGENS_PRELOAD.forEach(src => { const img = new Image(); img.src = src })
  }, [])

  // Ao montar: ajusta escala para caber o tabuleiro inteiro na viewport, centralizado
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const fitScale = clampScale(Math.min(rect.width / BOARD_SIZE, rect.height / BOARD_SIZE) * 0.95)
    setTransformClamped({
      scale: fitScale,
      x: (rect.width - BOARD_SIZE * fitScale) / 2,
      y: (rect.height - BOARD_SIZE * fitScale) / 2,
    })
  }, [setTransformClamped])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const vp = viewportRef.current
    if (!vp) return
    const rect = vp.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setTransformClamped(t => {
      const newScale = clampScale(t.scale + delta)
      const nx = mouseX - (mouseX - t.x) * (newScale / t.scale)
      const ny = mouseY - (mouseY - t.y) * (newScale / t.scale)
      return { scale: newScale, x: nx, y: ny }
    })
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return
    dragState.current = { dragging: true, lastX: e.clientX, lastY: e.clientY }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.dragging) return
    const dx = e.clientX - dragState.current.lastX
    const dy = e.clientY - dragState.current.lastY
    dragState.current.lastX = e.clientX
    dragState.current.lastY = e.clientY
    setTransformClamped(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
  }

  const handlePointerUp = () => {
    dragState.current.dragging = false
  }

  const dist = (touches: React.TouchList) => {
    const [a, b] = [touches[0], touches[1]]
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  const center = (touches: React.TouchList, rect: DOMRect) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
    y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
  })

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      dragState.current.dragging = false
      pinchState.current = { pinching: true, startDist: dist(e.touches), startScale: transformRef.current.scale, centerX: 0, centerY: 0 }
    } else if (e.touches.length === 1) {
      pinchState.current.pinching = false
      dragState.current = { dragging: true, lastX: e.touches[0].clientX, lastY: e.touches[0].clientY }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 2 && pinchState.current.pinching) {
      const ratio = dist(e.touches) / pinchState.current.startDist
      const vp = viewportRef.current
      if (!vp) return
      const rect = vp.getBoundingClientRect()
      const { x: cx, y: cy } = center(e.touches, rect)
      const newScale = clampScale(pinchState.current.startScale * ratio)
      setTransformClamped(t => {
        const nx = cx - (cx - t.x) * (newScale / t.scale)
        const ny = cy - (cy - t.y) * (newScale / t.scale)
        return { scale: newScale, x: nx, y: ny }
      })
    } else if (e.touches.length === 1 && dragState.current.dragging) {
      const dx = e.touches[0].clientX - dragState.current.lastX
      const dy = e.touches[0].clientY - dragState.current.lastY
      dragState.current.lastX = e.touches[0].clientX
      dragState.current.lastY = e.touches[0].clientY
      setTransformClamped(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
    }
  }

  const handleTouchEnd = () => {
    pinchState.current.pinching = false
    dragState.current.dragging = false
  }

  const jogadoresAtivos = (session.jogadores ?? []).filter(p => !p.desistiu)

  // Derivado do estado da sessão (não da resposta transitória de rolar-dados)
  // pra sobreviver a um refresh de página enquanto a decisão está pendente.
  const jogadorDaVez = jogadoresAtivos.find(p => p.id === session.turnoAtualPlayerId)
  const minhaVez = !!meuPlayerId && jogadorDaVez?.id === meuPlayerId

  const handleRolarDados = useCallback(async () => {
    if (rolando) return
    setRolando(true)
    stopSfx("tempo-acabando")
    playSfx("rolando-dados")
    try {
      const r = await rolarDados(session.id)
      if (!r) return
      if (r.falido) {
        toastError(r.mensagem ?? "Você faliu por não quitar suas dívidas a tempo.")
        return
      }
      // foiPreso cobre os 3 duplos seguidos; "Vá para a Detenção" não seta
      // esse campo (o jogador só é redirecionado dentro de resolverCasa),
      // então também detectamos pela mensagem do backend.
      if (r.foiPreso || /prisão/i.test(r.mensagem ?? "")) {
        playSfx("foi-preso")
      } else if (/aluguel/i.test(r.mensagem ?? "")) {
        playSfx("pagou-aluguel")
      }
      setResultado(r)
      setModalAberto(true)
    } catch (err: any) {
      toastError(err?.response?.data?.message || "Erro ao rolar dados")
    } finally {
      setRolando(false)
    }
  }, [rolando, rolarDados, session.id, toastError])

  const handleComprar = useCallback(async () => {
    if (decidindoRef.current || !resultado?.compraDisponivel) return
    decidindoRef.current = true
    const nome = resultado.compraDisponivel.nome
    setErroCompra(null)
    try {
      const ok = await comprarCasaAtual(session.id)
      if (ok) {
        setModalAberto(false)
        setErroCompra(null)
        playSfx("comprou-propriedade")
        toastSuccess(`Você comprou ${nome}!`)
      } else {
        const storeError = useGameStore.getState().error
        if (storeError?.toLowerCase().includes("saldo")) {
          setErroCompra("Saldo insuficiente! Vá até a aba Início para vender casas ou hipotecar imóveis e conseguir mais dinheiro. Depois volte aqui e tente novamente.")
        } else {
          setErroCompra(storeError || "Não foi possível concluir a compra.")
        }
      }
    } finally {
      decidindoRef.current = false
    }
  }, [resultado, comprarCasaAtual, session.id, toastSuccess, toastError])

  const handleRecusar = useCallback(async () => {
    if (decidindoRef.current || !resultado?.compraDisponivel) return
    decidindoRef.current = true
    setErroCompra(null)
    const nome = resultado.compraDisponivel.nome
    try {
      const ok = await recusarCompra(session.id)
      setModalAberto(false)
      if (ok) toastSuccess(`Você recusou a compra de ${nome}.`)
      else toastError("Não foi possível concluir a ação.")
    } finally {
      decidindoRef.current = false
    }
  }, [resultado, recusarCompra, session.id, toastSuccess, toastError])

  const handleFecharModal = useCallback(() => {
    setModalAberto(false)
  }, [])

  const handleJogarNovamente = useCallback(() => {
    // Duplo: turno permanece com o mesmo jogador (backend não avança a
    // vez) — só limpar o resultado pra próxima rolagem partir "limpa".
    setResultado(null)
  }, [])

  // Fallback: se a sessão indica ação pendente mas não há resultado local
  // (ex.: refresh de página em meio a uma decisão), sintetiza um resultado
  // mínimo já na fase "acao" — sem repetir a animação de dados de uma
  // rolagem que já aconteceu antes desta montagem.
  let resultadoModal = resultado
  let modalAbertoFinal = modalAberto
  let faseInicialModal: "rolando" | "acao" = "rolando"
  if (!resultado && minhaVez && session.aguardandoAcao && jogadorDaVez) {
    const casaAtual = tabuleiro.find(c => c.pos === (jogadorDaVez.posicao ?? 0))
    if (casaAtual && (casaAtual.tipo === "propriedade" || casaAtual.tipo === "acao") && casaAtual.propId != null) {
      const posse = session.sessionPosses?.find(sp => sp.propId === casaAtual.propId)
      if (posse && !posse.playerId && posse.propriedade) {
        resultadoModal = {
          dado1: session.ultimoDado1 ?? 1,
          dado2: session.ultimoDado2 ?? 1,
          duplo: false,
          foiPreso: false,
          novaPosicao: casaAtual.pos,
          aguardandoAcao: true,
          compraDisponivel: {
            propId: casaAtual.propId,
            sessionPossesId: posse.id,
            nome: posse.propriedade.nome,
            preco: posse.propriedade.custo_compra,
          },
        }
        modalAbertoFinal = true
        faseInicialModal = "acao"
      }
    }
  }
  const nomeCasaModal = resultadoModal?.novaPosicao != null
    ? tabuleiro.find(c => c.pos === resultadoModal!.novaPosicao)?.nome
    : undefined

  return (
    <div className="flex flex-col flex-1 min-h-0 select-none">
      {session.turnoAtualPlayerId != null && (
        <TurnoBanner session={session} meuPlayerId={meuPlayerId} rolando={rolando} onRolarDados={handleRolarDados} />
      )}
      <TurnoModal
        aberto={modalAbertoFinal}
        resultado={resultadoModal}
        nomeCasa={nomeCasaModal}
        erroCompra={erroCompra}
        faseInicial={faseInicialModal}
        onComprar={handleComprar}
        onRecusar={handleRecusar}
        onFechar={handleFecharModal}
        onJogarNovamente={handleJogarNovamente}
      />
      <div
        className="relative w-full flex-1 min-h-0 bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden touch-none"
        style={{
          backgroundImage: `url(${FUNDO_TABULEIRO})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
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
            <div
              className="pointer-events-none overflow-hidden rounded-lg"
              style={{ gridRow: "2 / 11", gridColumn: "2 / 11" }}
            >
              <img
                src={ARTE_CENTRAL}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover opacity-90"
                draggable={false}
              />
            </div>
            {tabuleiro.map((casa) => {
              const { row, col } = posToGrid(casa.pos)
              const sessionPosse = casa.propId != null
                ? session.sessionPosses?.find(sp => sp.propId === casa.propId)
                : undefined
              const donoJogador = sessionPosse?.playerId
                ? jogadoresAtivos.find(p => p.id === sessionPosse.playerId)
                : undefined
              return (
                <div key={casa.pos} style={{ gridRow: row, gridColumn: col }}>
                  <BoardTile
                    casa={casa}
                    sessionPosse={sessionPosse}
                    donoJogador={donoJogador}
                    destaque={casa.pos === (jogadorDaVez?.posicao ?? -1)}
                  />
                </div>
              )
            })}
          </div>
          <Pawns players={jogadoresAtivos} />
        </div>
      </div>

      {meuPlayerId != null && (
        <button
          onClick={() => {
            const mine = jogadoresAtivos.find(p => p.id === meuPlayerId)
            centerOn(mine?.posicao ?? 0, 1.2)
          }}
          className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-zinc-900/90 border border-zinc-700 hover:border-green-500 flex items-center justify-center text-zinc-300 hover:text-green-400 transition-colors cursor-pointer"
          title="Centralizar no meu peão"
        >
          <FontAwesomeIcon icon={faCrosshairs} />
        </button>
      )}
      </div>
    </div>
  )
}
