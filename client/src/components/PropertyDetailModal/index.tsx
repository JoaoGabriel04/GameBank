'use client'

import { useState } from "react"
import Modal from "../Modal"
import ConfirmationModal from "../ConfirmationModal"
import { Propriedade, SessionPropriedade, PROPERTY_COLORS } from "@/types/game"
import { useGameStore } from "@/stores/gameStore"
import { useToast } from "@/components/Toast"
import Button1 from "../Button01"
import { toApiErr } from "@/lib/api-error"

const COLOR_HEX: Record<string, string> = {
  lime: "#84cc16",
  green: "#15803d",
  red: "#dc2626",
  blue: "#2563eb",
  amber: "#fcd34d",
  orange: "#ea580c",
  pink: "#db2777",
  purple: "#7e22ce",
  zinc: "#fafafa",
}

function getAccentHex(grupoCor: string | null): string {
  if (!grupoCor) return "#52525b"
  const found = PROPERTY_COLORS.find((c) => c.value === grupoCor)
  if (!found) return COLOR_HEX[grupoCor] ?? "#52525b"
  const match = found.bg?.match(/bg-(\w+)/)
  if (match) return COLOR_HEX[match[1]] ?? "#52525b"
  return "#52525b"
}

type Props = {
  isOpen: boolean
  onClose: () => void
  propriedade: Propriedade
  sessionPropriedade: SessionPropriedade
  playerId: number
  sessionId: number
  playerSaldo: number
  podeVenderCasa: boolean
  podeHipotecar: boolean
  podeVender: boolean
  onActionSuccess?: () => void
}

export default function PropertyDetailModal({
  isOpen, onClose, propriedade, sessionPropriedade,
  playerId, sessionId, podeHipotecar, podeVender,
  onActionSuccess,
}: Props) {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast()
  const { hipotecarProp, sellPropriedade, getAluguel } = useGameStore()

  const [confirmAction, setConfirmAction] = useState<{
    type: string
    title: string
    message: string
    confirmText: string
    color: 'green' | 'orange' | 'purple' | 'red'
    action: () => Promise<void>
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const accent = getAccentHex(propriedade.grupo_cor)
  const aluguelAtual = getAluguel(propriedade, sessionPropriedade.casas)
  const isHipotecada = sessionPropriedade.hipotecada

  const handleConfirm = async () => {
    if (!confirmAction) return
    setActionLoading(true)
    try {
      await confirmAction.action()
      setConfirmAction(null)
      const msg =
        confirmAction.type === 'sellHouse' ? 'Casa vendida!' :
        confirmAction.type === 'hipotecar' ? 'Propriedade hipotecada!' :
        'Propriedade vendida!'
      await onActionSuccess?.()
      if (confirmAction.type !== 'sellHouse') {
        toastSuccess(msg)
      } else {
        toastWarning(msg)
      }
    } catch (err) {
      const e = toApiErr(err)
      const msg = e?.response?.data?.message ??
        (confirmAction.type === 'sellHouse' ? 'Erro ao vender casa' :
        confirmAction.type === 'hipotecar' ? 'Erro ao hipotecar' :
        'Erro ao vender propriedade')
      if ((e?.response?.status ?? 0) >= 500) { toastError(msg) } else { toastWarning(msg) }
    } finally {
      setActionLoading(false)
    }
  }

  const prepareHipotecar = () => {
    setConfirmAction({
      type: 'hipotecar',
      title: 'Hipotecar Propriedade',
      message: `Hipotecar ${propriedade.nome.toUpperCase()}\n\nVocê recebe: R$ ${propriedade.hipoteca.toLocaleString('pt-BR')}\nA propriedade ficará indisponível até quitar a dívida.`,
      confirmText: 'Hipotecar',
      color: 'purple',
      action: () => hipotecarProp(propriedade.id, sessionId, playerId),
    })
  }

  const prepareVender = () => {
    setConfirmAction({
      type: 'vender',
      title: 'Vender Propriedade',
      message: `Vender ${propriedade.nome.toUpperCase()}\n\nVocê recebe: R$ ${propriedade.custo_compra.toLocaleString('pt-BR')}\nAção irreversível!`,
      confirmText: 'Vender',
      color: 'red',
      action: () => sellPropriedade(propriedade.id, sessionId, playerId),
    })
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="md" title={propriedade.nome}>
        <div className="flex flex-col gap-5">
          {/* Color bar */}
          <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: accent }} />

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide">Grupo</p>
              <p className="text-sm font-inconsolata text-zinc-200">{propriedade.grupo_cor}</p>
            </div>
            <div>
              <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide">Tipo</p>
              <p className="text-sm font-inconsolata text-zinc-200 capitalize">{propriedade.tipo}</p>
            </div>
            <div>
              <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide">Casas</p>
              <p className="text-sm font-inconsolata text-zinc-200">{sessionPropriedade.casas}/5</p>
            </div>
            <div>
              <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide">Status</p>
              <p className={`text-sm font-inconsolata ${isHipotecada ? 'text-amber-400' : 'text-green-400'}`}>
                {isHipotecada ? 'Hipotecada' : 'Ativa'}
              </p>
            </div>
          </div>

          {/* Values */}
          <div className="border-t border-zinc-800 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide">Valor Compra</p>
                <p className="text-lg font-jaro text-zinc-100">R$ {propriedade.custo_compra.toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide">Aluguel Atual</p>
                <p className="text-lg font-jaro" style={{ color: accent }}>R$ {aluguelAtual.toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide">Custo Casa</p>
                <p className="text-sm font-jaro text-zinc-300">R$ {propriedade.custo_casa.toLocaleString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide">Valor Hipoteca</p>
                <p className="text-sm font-jaro text-zinc-300">R$ {propriedade.hipoteca.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-zinc-800 pt-4">
            <p className="text-xs font-inconsolata text-zinc-500 uppercase tracking-wide mb-3">Ações</p>
            <div className="grid grid-cols-2 gap-3">
              <Button1
                size="sm" color="purple"
                handle={podeHipotecar ? prepareHipotecar : undefined}
                disabled={!podeHipotecar}
              >
                Hipotecar
              </Button1>
              <Button1
                size="sm" color="red"
                handle={podeVender ? prepareVender : undefined}
                disabled={!podeVender}
              >
                Vender
              </Button1>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={confirmAction?.title ?? ''}
        message={confirmAction?.message ?? ''}
        confirmText={confirmAction?.confirmText ?? ''}
        color={confirmAction?.color ?? 'green'}
        loading={actionLoading}
      />
    </>
  )
}
