"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"
import IconeEvento, { COR_EVENTO_HEX } from "@/components/Game/IconeEvento"
import Modal from "../../Modal"
import type { EventoDef } from "@/constants/eventos"

const CORES: Record<EventoDef["cor"], string> = {
  verde: "text-emerald-400",
  vermelho: "text-red-400",
  amarelo: "text-amber-400",
  azul: "text-sky-400",
}

const AUTO_FECHA_MS = 6000

type Props = {
  isOpen: boolean
  evento: EventoDef | null
  onClose: () => void
}

// Modal exibido para TODOS os jogadores no momento em que um evento
// econômico entra em vigor (virada de rodada). Fecha sozinho em ~6s ou
// no clique — reaberto manualmente pelo EventoBadge mostra o mesmo
// conteúdo sem o auto-fechamento forçado da ativação.
export default function EventoModal({ isOpen, evento, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(onClose, AUTO_FECHA_MS)
    return () => clearTimeout(timer)
  }, [isOpen, onClose])

  if (!evento) return null
  const cor = COR_EVENTO_HEX[evento.cor] ?? COR_EVENTO_HEX.azul
  const ruim = evento.cor === "vermelho"

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center py-2">
        {/* Ícone entra girando num círculo da cor do evento, com ondas.
            Evento ruim treme; evento bom dá um salto. */}
        <div className="relative mx-auto mb-4 w-20 h-20">
          {[0, 1].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{ border: `2px solid ${cor}` }}
              initial={{ scale: 0.9, opacity: 0.7 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 1.1, delay: 0.25 + i * 0.35, ease: "easeOut" }}
            />
          ))}
          <motion.div
            className="absolute inset-0 rounded-full flex items-center justify-center"
            style={{ background: `${cor}22`, boxShadow: `0 0 30px ${cor}55`, color: cor }}
            initial={{ scale: 0, rotate: -40 }}
            animate={ruim
              ? { scale: 1, rotate: 0, x: [0, 0, -7, 7, -5, 5, 0] }
              : { scale: 1, rotate: 0, y: [0, 0, -10, 0, -4, 0] }}
            transition={{ scale: { type: "spring", damping: 11, stiffness: 220 }, rotate: { type: "spring", damping: 11, stiffness: 220 }, x: { duration: 0.6, delay: 0.35 }, y: { duration: 0.7, delay: 0.35 } }}
          >
            <IconeEvento codigo={evento.codigo} size={38} />
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.3 }}>
          <p className={`font-jaro text-xl mb-3 ${CORES[evento.cor]}`}>{evento.nome}</p>
          <p className="font-inconsolata text-sm text-zinc-300 mb-3">{evento.descricao}</p>
          <div className="px-3 py-2 bg-zinc-800/60 rounded-lg">
            <p className="font-inconsolata text-xs text-zinc-400">➜ {evento.dica}</p>
          </div>
          <p className="font-inconsolata text-[10px] text-zinc-600 mt-4">Vale pelas próximas 2 rodadas</p>
        </motion.div>
      </div>
    </Modal>
  )
}
