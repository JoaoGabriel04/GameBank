'use client'

import { useEffect, useRef, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faHourglassHalf, faDice, faLock, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons"
import type { GameSession } from "@/types/game"
import { useGameStore } from "@/stores/gameStore"
import { useToast } from "@/components/Toast"
import { playSfx } from "@/utils/sfx"

const TURNO_TIMEOUT_S = 60
const AVISO_TEMPO_S = 10

type Props = {
  session: GameSession
  meuPlayerId?: number
  rolando: boolean
  onRolarDados: () => void
}

export default function TurnoBanner({ session, meuPlayerId, rolando, onRolarDados }: Props) {
  const { sairPrisaoComCarta } = useGameStore()
  const { success: toastSuccess, error: toastError } = useToast()
  const [restante, setRestante] = useState(TURNO_TIMEOUT_S)
  const [usandoCarta, setUsandoCarta] = useState(false)

  const jogadorDaVez = session.jogadores?.find(p => p.id === session.turnoAtualPlayerId)
  const minhaVez = !!meuPlayerId && session.turnoAtualPlayerId === meuPlayerId
  const meuJogador = session.jogadores?.find(p => p.id === meuPlayerId)

  // Guarda anti-repetição: só toca "chegou-sua-vez" na transição
  // (não era minha vez → agora é), nunca em re-renders com a vez inalterada.
  const vezAnteriorRef = useRef<number | null>(null)
  useEffect(() => {
    const eraMinhaVez = !!meuPlayerId && vezAnteriorRef.current === meuPlayerId
    const agoraMinhaVez = !!meuPlayerId && session.turnoAtualPlayerId === meuPlayerId

    if (!eraMinhaVez && agoraMinhaVez) {
      playSfx("chegou-sua-vez")
    }

    vezAnteriorRef.current = session.turnoAtualPlayerId ?? null
  }, [session.turnoAtualPlayerId, meuPlayerId])

  // Guarda anti-repetição: "tempo-acabando" toca uma única vez por turno,
  // resetada sempre que a vez muda (novo turno = novo aviso possível).
  const alertouTempoRef = useRef(false)
  useEffect(() => {
    alertouTempoRef.current = false
  }, [session.turnoAtualPlayerId])

  useEffect(() => {
    if (!session.turnoIniciadoEm) return
    const inicio = new Date(session.turnoIniciadoEm).getTime()
    const tick = () => {
      const passado = Math.floor((Date.now() - inicio) / 1000)
      const restanteS = Math.max(0, TURNO_TIMEOUT_S - passado)
      setRestante(restanteS)

      if (minhaVez && restanteS === AVISO_TEMPO_S && !alertouTempoRef.current) {
        playSfx("tempo-acabando")
        alertouTempoRef.current = true
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session.turnoIniciadoEm, session.turnoAtualPlayerId, minhaVez])

  const handleUsarCartaPrisao = async () => {
    if (usandoCarta) return
    setUsandoCarta(true)
    try {
      const mensagem = await sairPrisaoComCarta(session.id)
      if (mensagem) toastSuccess(mensagem)
    } catch (err: any) {
      toastError(err?.response?.data?.message || "Erro ao usar carta")
    } finally {
      setUsandoCarta(false)
    }
  }

  return (
    <div className="mb-3 space-y-2">
      <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border font-inconsolata text-sm ${
        minhaVez ? "border-green-500/50 bg-green-500/10 text-green-300" : "border-zinc-800 bg-zinc-900/60 text-zinc-400"
      }`}>
        <span className="flex items-center gap-2">
          {minhaVez ? "Sua vez de jogar!" : jogadorDaVez ? `Vez de ${jogadorDaVez.nome}` : "Aguardando início dos turnos..."}
          {session.ultimoDado1 != null && session.ultimoDado2 != null && (
            <span className="text-xs text-zinc-500">(último: {session.ultimoDado1} · {session.ultimoDado2})</span>
          )}
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <FontAwesomeIcon icon={faHourglassHalf} />
            {restante}s
          </span>
          {minhaVez && (
            <>
              <button
                onClick={onRolarDados}
                disabled={rolando || !!session.aguardandoAcao}
                title={session.aguardandoAcao ? "Aguardando resolução da casa" : undefined}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <FontAwesomeIcon icon={faDice} />
                Rolar dados
              </button>

            </>
          )}
        </div>
      </div>

      {meuJogador?.emPrisao && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 font-inconsolata text-xs">
          <span className="flex items-center gap-2">
            <FontAwesomeIcon icon={faLock} />
            Você está na prisão ({meuJogador.turnosPrisao ?? 0} rodada{(meuJogador.turnosPrisao ?? 0) !== 1 ? "s" : ""} restante{(meuJogador.turnosPrisao ?? 0) !== 1 ? "s" : ""}) — role duplo pra sair
          </span>
          {meuJogador.carta_prisao && minhaVez && (
            <button
              onClick={handleUsarCartaPrisao}
              disabled={usandoCarta}
              className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Usar carta &quot;Saia da Prisão&quot;
            </button>
          )}
        </div>
      )}

      {!!meuJogador?.rodadasDevendo && meuJogador.rodadasDevendo > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 font-inconsolata text-xs">
          <FontAwesomeIcon icon={faTriangleExclamation} />
          Dívida pendente com o banco — {meuJogador.rodadasDevendo}/3 rodadas sem quitar (falência automática na 3ª)
        </div>
      )}
    </div>
  )
}
