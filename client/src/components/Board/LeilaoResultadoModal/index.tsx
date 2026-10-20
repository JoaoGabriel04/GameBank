"use client"

import { useEffect } from "react"
import { useLeilaoStore } from "@/stores/socketStore"
import { formatCurrency } from "@/utils/format"
import type { GameSession } from "@/types/game"
import PortalBody from "@/components/PortalBody"
import { motion } from "framer-motion"
import { Gavel, Trophy } from "lucide-react"
import Contador from "@/components/Contador"
import { useMotionPrefs } from "@/lib/motion/prefs"

const AUTO_FECHA_MS = 6000

type Props = {
  session: GameSession
  meuPlayerId?: number
}

// Revelação do Leilão Cego — só agora (nunca antes) os lances de todos
// ficam visíveis. É o momento de tensão da mecânica, então os lances
// aparecem um a um, do menor ao maior: cada linha vira e o valor conta até
// o final. O vencedor vem por último, depois de uma pausa maior, com brilho
// e troféu. O fechamento automático espera a revelação; "Continuar" vale a
// qualquer momento. Desligado: tudo de uma vez.
const PASSO_S = 0.5
const SUSPENSE_FINAL_S = 0.6

function LeilaoResultadoModalConteudo({ session, meuPlayerId }: Props) {
  const { resultado, clearResultado } = useLeilaoStore()
  const { nivel } = useMotionPrefs()
  const desligado = nivel === "desligado"

  // Do menor ao maior; quem passou primeiro.
  const linhas = resultado ? [...resultado.lances].sort((a, b) => a.valor - b.valor) : []
  const atrasoDe = (i: number) =>
    desligado ? 0 : 0.3 + i * PASSO_S + (i === linhas.length - 1 && resultado?.vencedorId != null ? SUSPENSE_FINAL_S : 0)
  const fimRevelacaoS = linhas.length ? atrasoDe(linhas.length - 1) + 0.6 : 0

  useEffect(() => {
    if (!resultado) return
    const timer = setTimeout(clearResultado, AUTO_FECHA_MS + fimRevelacaoS * 1000)
    return () => clearTimeout(timer)
  }, [resultado, clearResultado, fimRevelacaoS])

  if (!resultado) return null

  const nomeDoJogador = (playerId: number) =>
    session.jogadores?.find(p => p.id === playerId)?.nome ?? "Jogador"

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
        <Gavel size={30} className="mx-auto mb-2 text-purple-300" aria-hidden />
        <p className="font-jaro text-lg text-zinc-100 mb-3">Resultado do Leilão</p>

        <div className="space-y-1.5 mb-4 text-left" style={{ perspective: 600 }}>
          {linhas.map((l, i) => {
            const souEu = l.playerId === meuPlayerId
            const venceu = l.playerId === resultado.vencedorId
            const atraso = atrasoDe(i)
            return (
              <motion.div
                key={l.playerId}
                data-lance=""
                initial={desligado ? false : { opacity: 0, rotateX: -80, y: 6 }}
                animate={{ opacity: 1, rotateX: 0, y: 0 }}
                transition={{ delay: atraso, duration: 0.35, ease: "easeOut" }}
                className={`relative flex items-center justify-between px-2.5 py-1.5 rounded-lg font-inconsolata text-sm ${
                  venceu ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-zinc-800/40"
                }`}
              >
                {venceu && !desligado && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-lg"
                    style={{ boxShadow: "0 0 24px rgba(52,211,153,0.55)" }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0.35] }}
                    transition={{ delay: atraso + 0.35, duration: 0.9 }}
                  />
                )}
                <span className={`relative inline-flex items-center gap-1.5 ${venceu ? "text-emerald-300 font-semibold" : "text-zinc-300"}`}>
                  {venceu && (
                    <motion.span
                      initial={desligado ? false : { scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: atraso + 0.3, type: "spring", damping: 9, stiffness: 260 }}
                      className="inline-flex"
                    >
                      <Trophy size={14} aria-hidden />
                    </motion.span>
                  )}
                  {nomeDoJogador(l.playerId)}{souEu ? " (você)" : ""}
                </span>
                <span className={`relative ${venceu ? "text-emerald-300 font-semibold" : "text-zinc-400"}`}>
                  {l.valor > 0
                    ? <Contador valor={l.valor} prefixo="R$ " duracaoMs={venceu ? 650 : 400} atrasoMs={atraso * 1000} />
                    : "passou"}
                </span>
              </motion.div>
            )
          })}
          {linhas.length === 0 && (
            <p className="font-inconsolata text-sm text-zinc-500 italic">Ninguém deu lance.</p>
          )}
        </div>

        <motion.div
          initial={desligado ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: fimRevelacaoS, duration: 0.3 }}
        >
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
        </motion.div>

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

// No document.body: fora de qualquer ancestral com transform (ver PortalBody).
export default function LeilaoResultadoModal(props: Props) {
  return (
    <PortalBody>
      <LeilaoResultadoModalConteudo {...props} />
    </PortalBody>
  )
}
