"use client"

import { useEffect } from "react"
import { useLeilaoStore } from "@/stores/socketStore"
import { formatCurrency } from "@/utils/format"
import type { GameSession } from "@/types/game"

const AUTO_FECHA_MS = 6000

type Props = {
  session: GameSession
  meuPlayerId?: number
}

// Revelação do Leilão Cego — só agora (nunca antes) os lances de todos
// ficam visíveis. É o momento de tensão da mecânica.
export default function LeilaoResultadoModal({ session, meuPlayerId }: Props) {
  const { resultado, clearResultado } = useLeilaoStore()

  useEffect(() => {
    if (!resultado) return
    const timer = setTimeout(clearResultado, AUTO_FECHA_MS)
    return () => clearTimeout(timer)
  }, [resultado, clearResultado])

  if (!resultado) return null

  const nomeDoJogador = (playerId: number) =>
    session.jogadores?.find(p => p.id === playerId)?.nome ?? "Jogador"

  const linhas = [...resultado.lances].sort((a, b) => b.valor - a.valor)
  const vencedorNome = resultado.vencedorId != null ? nomeDoJogador(resultado.vencedorId) : null
  const abaixoDaTabela = resultado.valorFinal != null
    ? session.sessionPosses?.find(sp => sp.propId === resultado.propId)?.propriedade?.custo_compra
    : undefined

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] px-4"
      onClick={clearResultado}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center"
      >
        <p className="text-3xl mb-2">🔨</p>
        <p className="font-jaro text-lg text-zinc-100 mb-3">Resultado do Leilão</p>

        <div className="space-y-1.5 mb-4 text-left">
          {linhas.map(l => {
            const souEu = l.playerId === meuPlayerId
            const venceu = l.playerId === resultado.vencedorId
            return (
              <div
                key={l.playerId}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg font-inconsolata text-sm ${
                  venceu ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-zinc-800/40"
                }`}
              >
                <span className={venceu ? "text-emerald-300 font-semibold" : "text-zinc-300"}>
                  {venceu && "🏆 "}{nomeDoJogador(l.playerId)}{souEu ? " (você)" : ""}
                </span>
                <span className={venceu ? "text-emerald-300 font-semibold" : "text-zinc-400"}>
                  {l.valor > 0 ? `R$ ${formatCurrency(l.valor)}` : "passou"}
                </span>
              </div>
            )
          })}
          {linhas.length === 0 && (
            <p className="font-inconsolata text-sm text-zinc-500 italic">Ninguém deu lance.</p>
          )}
        </div>

        {vencedorNome && resultado.valorFinal != null ? (
          <p className="font-inconsolata text-sm text-zinc-300 mb-4">
            {vencedorNome} arrematou por R$ {formatCurrency(resultado.valorFinal)}
            {abaixoDaTabela != null && abaixoDaTabela > resultado.valorFinal && (
              <> (R$ {formatCurrency(abaixoDaTabela - resultado.valorFinal)} abaixo da tabela)</>
            )}
          </p>
        ) : (
          <p className="font-inconsolata text-sm text-zinc-500 mb-4">
            Ninguém arrematou. A propriedade continua sem dono.
          </p>
        )}

        <button
          onClick={clearResultado}
          className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-inconsolata text-sm rounded-xl cursor-pointer"
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
