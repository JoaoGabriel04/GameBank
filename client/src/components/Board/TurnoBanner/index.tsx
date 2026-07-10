'use client'

import { useEffect, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faHourglassHalf, faForward, faDice } from "@fortawesome/free-solid-svg-icons"
import type { GameSession } from "@/types/game"
import { useGameStore } from "@/stores/gameStore"
import { useToast } from "@/components/Toast"

const TURNO_TIMEOUT_S = 60

type Props = {
  session: GameSession
  meuPlayerId?: number
}

export default function TurnoBanner({ session, meuPlayerId }: Props) {
  const { passarVez, rolarDados } = useGameStore()
  const { info: toastInfo, success: toastSuccess } = useToast()
  const [restante, setRestante] = useState(TURNO_TIMEOUT_S)
  const [loading, setLoading] = useState(false)
  const [rolando, setRolando] = useState(false)

  const jogadorDaVez = session.jogadores?.find(p => p.id === session.turnoAtualPlayerId)
  const minhaVez = !!meuPlayerId && session.turnoAtualPlayerId === meuPlayerId

  useEffect(() => {
    if (!session.turnoIniciadoEm) return
    const inicio = new Date(session.turnoIniciadoEm).getTime()
    const tick = () => {
      const passado = Math.floor((Date.now() - inicio) / 1000)
      setRestante(Math.max(0, TURNO_TIMEOUT_S - passado))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session.turnoIniciadoEm, session.turnoAtualPlayerId])

  const handlePassarVez = async () => {
    if (loading) return
    setLoading(true)
    try {
      await passarVez(session.id)
    } finally {
      setLoading(false)
    }
  }

  const handleRolarDados = async () => {
    if (rolando) return
    setRolando(true)
    try {
      const r = await rolarDados(session.id)
      if (!r) return
      if (r.foiPreso) {
        toastInfo(`Deu ${r.dado1} e ${r.dado2} — 3 duplos seguidos! Direto pra prisão.`)
      } else {
        toastSuccess(`Deu ${r.dado1} e ${r.dado2}${r.duplo ? " (duplo — jogue de novo depois)" : ""}${r.passouInicio ? " · +R$ 2.000 (passou pelo Início)" : ""}`)
        if (r.mensagem) toastInfo(r.mensagem)
      }
    } finally {
      setRolando(false)
    }
  }

  return (
    <div className={`flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-lg border font-inconsolata text-sm ${
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
              onClick={handleRolarDados}
              disabled={rolando || !!session.aguardandoAcao}
              title={session.aguardandoAcao ? "Aguardando resolução da casa" : undefined}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <FontAwesomeIcon icon={faDice} />
              Rolar dados
            </button>
            <button
              onClick={handlePassarVez}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <FontAwesomeIcon icon={faForward} />
              Passar a vez
            </button>
          </>
        )}
      </div>
    </div>
  )
}
