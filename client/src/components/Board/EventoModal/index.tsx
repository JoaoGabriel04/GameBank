"use client"

import { useEffect } from "react"
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="text-center py-2">
        <p className="text-5xl mb-3">{evento.icone}</p>
        <p className={`font-jaro text-xl mb-3 ${CORES[evento.cor]}`}>{evento.nome}</p>
        <p className="font-inconsolata text-sm text-zinc-300 mb-3">{evento.descricao}</p>
        <div className="px-3 py-2 bg-zinc-800/60 rounded-lg">
          <p className="font-inconsolata text-xs text-zinc-400">➜ {evento.dica}</p>
        </div>
        <p className="font-inconsolata text-[10px] text-zinc-600 mt-4">Vale pelas próximas 2 rodadas</p>
      </div>
    </Modal>
  )
}
