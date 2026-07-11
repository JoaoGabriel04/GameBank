'use client'

import { useEffect, useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faHourglassHalf, faDice, faLock, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons"
import type { GameSession } from "@/types/game"
import { useGameStore } from "@/stores/gameStore"
import { useToast } from "@/components/Toast"
import DadosRoll from "@/components/Board/DadosRoll"

const TURNO_TIMEOUT_S = 60

type Props = {
  session: GameSession
  meuPlayerId?: number
}

export default function TurnoBanner({ session, meuPlayerId }: Props) {
  const { rolarDados, sairPrisaoComCarta } = useGameStore()
  const { info: toastInfo, success: toastSuccess, error: toastError } = useToast()
  const [restante, setRestante] = useState(TURNO_TIMEOUT_S)
  const [rolando, setRolando] = useState(false)
  const [usandoCarta, setUsandoCarta] = useState(false)
  const [dado1, setDado1] = useState<number | undefined>()
  const [dado2, setDado2] = useState<number | undefined>()
  const [dadosAberto, setDadosAberto] = useState(false)

  const jogadorDaVez = session.jogadores?.find(p => p.id === session.turnoAtualPlayerId)
  const minhaVez = !!meuPlayerId && session.turnoAtualPlayerId === meuPlayerId
  const meuJogador = session.jogadores?.find(p => p.id === meuPlayerId)

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

  const handleRolarDados = async () => {
    if (rolando) return
    setDado1(undefined)
    setDado2(undefined)
    setRolando(true)
    setDadosAberto(true)
    try {
      const r = await rolarDados(session.id)
      if (!r) {
        setDadosAberto(false)
        return
      }

      // Falência: dispara antes de rolar os dados (nenhum dado foi jogado)
      if (r.falido) {
        setDadosAberto(false)
        toastError(r.mensagem ?? "Você faliu por não quitar suas dívidas a tempo.")
        return
      }

      setDado1(r.dado1)
      setDado2(r.dado2)
      if (r.foiPreso) {
        toastInfo(`Deu ${r.dado1} e ${r.dado2} — 3 duplos seguidos! Direto pra prisão.`)
      } else {
        toastSuccess(`Deu ${r.dado1} e ${r.dado2}${r.duplo ? " (duplo — jogue de novo depois)" : ""}${r.passouInicio ? " · +R$ 2.000 (passou pelo Início)" : ""}`)
        if (r.mensagem) toastInfo(r.mensagem)
      }
    } catch (err: any) {
      setDadosAberto(false)
      toastError(err?.response?.data?.message || "Erro ao rolar dados")
    } finally {
      setRolando(false)
    }
  }

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
      <DadosRoll
        aberto={dadosAberto}
        rolando={rolando}
        dado1={dado1}
        dado2={dado2}
        onClose={() => setDadosAberto(false)}
      />

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
                onClick={handleRolarDados}
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
