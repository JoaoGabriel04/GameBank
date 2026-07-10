'use client'

import { useState } from "react"
import Modal from "@/components/Modal"
import Button1 from "@/components/Button01"
import { useGameStore } from "@/stores/gameStore"
import { useToast } from "@/components/Toast"
import { formatCurrency } from "@/utils/format"

type Props = {
  sessionId: number
  nome: string
  preco: number
}

export default function CompraCasaModal({ sessionId, nome, preco }: Props) {
  const { comprarCasaAtual, recusarCompra } = useGameStore()
  const { success: toastSuccess, error: toastError } = useToast()
  const [loading, setLoading] = useState(false)

  const handle = async (aceitar: boolean) => {
    if (loading) return
    setLoading(true)
    try {
      const ok = aceitar ? await comprarCasaAtual(sessionId) : await recusarCompra(sessionId)
      if (ok) {
        toastSuccess(aceitar ? `Você comprou ${nome}!` : `Você recusou a compra de ${nome}.`)
      } else {
        toastError("Não foi possível concluir a ação.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen onClose={() => handle(false)} title="Propriedade disponível" size="sm">
      <div className="p-2 text-center font-inconsolata">
        <p className="text-zinc-300 mb-1">Você caiu em</p>
        <p className="text-xl font-jaro text-zinc-100 mb-3">{nome}</p>
        <p className="text-green-400 text-lg font-semibold mb-6">
          R$ {formatCurrency(preco)}
        </p>
        <div className="flex gap-3">
          <Button1 size="full" color="red" handle={loading ? undefined : () => handle(false)}>
            Recusar
          </Button1>
          <Button1 size="full" color="green" handle={loading ? undefined : () => handle(true)}>
            Comprar
          </Button1>
        </div>
      </div>
    </Modal>
  )
}
