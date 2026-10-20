"use client"

import { motion } from "framer-motion"
import { AlertTriangle } from "lucide-react"
import { getEvento } from "@/constants/eventos"
import { mola } from "@/lib/motion"
import IconeEvento from "@/components/Game/IconeEvento"

const CORES_BANNER: Record<string, string> = {
  verde: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  vermelho: "border-red-500/40 bg-red-500/10 text-red-300",
  amarelo: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  azul: "border-sky-500/40 bg-sky-500/10 text-sky-300",
}

const CORES_BADGE: Record<string, string> = {
  verde: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
  vermelho: "border-red-500/50 bg-red-500/15 text-red-300 hover:bg-red-500/25",
  amarelo: "border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25",
  azul: "border-sky-500/50 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25",
}

type Props = {
  eventoProximoCodigo?: string | null
  eventoAtualCodigo?: string | null
  onClickBadge: () => void
}

// Barra do evento econômico (Mecânica 2): banner de anúncio (persistente,
// não dispensável) quando há um evento anunciado para a próxima rodada de
// evento, e badge clicável quando um evento está ativo nesta rodada. As
// duas condições nunca coexistem no ciclo normal (ver processarViradaDeRodada
// em turno.service.ts), mas nada impede renderizar ambas se acontecer.
export default function EventoEconomicoBar({ eventoProximoCodigo, eventoAtualCodigo, onClickBadge }: Props) {
  const eventoProximo = getEvento(eventoProximoCodigo)
  const eventoAtual = getEvento(eventoAtualCodigo)

  if (!eventoProximo && !eventoAtual) return null

  return (
    <div className="mb-3 space-y-2">
      {eventoProximo && (
        // key: um anúncio novo entra deslizando (o mesmo não reanima).
        <motion.div
          key={eventoProximo.codigo}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={mola.firme}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-inconsolata text-xs ${CORES_BANNER[eventoProximo.cor]}`}
        >
          <AlertTriangle size={16} className="shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">PRÓXIMA RODADA:</span>{" "}
            <IconeEvento codigo={eventoProximo.codigo} size={13} className="inline -mt-0.5" /> {eventoProximo.nome} — {eventoProximo.dica}
          </span>
        </motion.div>
      )}

      {eventoAtual && (
        <motion.button
          key={eventoAtual.codigo}
          type="button"
          onClick={onClickBadge}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 12, stiffness: 260 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border font-inconsolata text-xs font-medium transition-colors cursor-pointer ${CORES_BADGE[eventoAtual.cor]}`}
        >
          <IconeEvento codigo={eventoAtual.codigo} size={14} /> {eventoAtual.nome}
        </motion.button>
      )}
    </div>
  )
}
