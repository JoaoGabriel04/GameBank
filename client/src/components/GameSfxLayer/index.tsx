'use client'

import { useEffect, useRef } from "react"
import { playSfx, stopSfx } from "@/utils/sfx"
import { serverNow } from "@/utils/clock"
import type { GameSession } from "@/types/game"

const TURNO_TIMEOUT_S = 60
const AVISO_TEMPO_S = 10

type Props = {
  session: GameSession
  meuPlayerId?: number
}

export default function GameSfxLayer({ session, meuPlayerId }: Props) {
  // ── "chegou-sua-vez" ──────────────────────────────────────────────
  const vezAnteriorRef = useRef<number | null>(null)
  useEffect(() => {
    const eraMinhaVez = !!meuPlayerId && vezAnteriorRef.current === meuPlayerId
    const agoraMinhaVez = !!meuPlayerId && session.turnoAtualPlayerId === meuPlayerId

    if (!eraMinhaVez && agoraMinhaVez) {
      playSfx("chegou-sua-vez")
    }

    vezAnteriorRef.current = session.turnoAtualPlayerId ?? null
  }, [session.turnoAtualPlayerId, meuPlayerId])

  // ── "tempo-acabando" ──────────────────────────────────────────────
  const alertouTempoRef = useRef(false)
  useEffect(() => {
    alertouTempoRef.current = false
    stopSfx("tempo-acabando")
  }, [session.turnoAtualPlayerId])

  useEffect(() => {
    if (!session.turnoIniciadoEm) return
    const inicio = new Date(session.turnoIniciadoEm).getTime()
    const minhaVez = !!meuPlayerId && session.turnoAtualPlayerId === meuPlayerId

    const tick = () => {
      // FIX_TURNO_TRAVADO_CONTADOR (BUG B.3): serverNow(), não Date.now().
      const passado = Math.floor((serverNow() - inicio) / 1000)
      const restanteS = Math.max(0, TURNO_TIMEOUT_S - passado)

      if (minhaVez && restanteS === AVISO_TEMPO_S && !alertouTempoRef.current) {
        playSfx("tempo-acabando")
        alertouTempoRef.current = true
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session.turnoIniciadoEm, session.turnoAtualPlayerId, meuPlayerId])

  // Garantir que o som pare ao desmontar
  useEffect(() => {
    return () => stopSfx("tempo-acabando")
  }, [])

  return null
}
