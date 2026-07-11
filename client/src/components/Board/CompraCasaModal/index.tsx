'use client'

import { useState } from "react"
import { Loader2 } from "lucide-react"
import Modal from "@/components/Modal"
import Button1 from "@/components/Button01"
import { useGameStore } from "@/stores/gameStore"
import { useToast } from "@/components/Toast"
import { formatCurrency } from "@/utils/format"
import { PROPERTY_COLORS, type CorPropriedade } from "@/types/game"

type Props = {
  sessionId: number
  nome: string
  preco: number
  cor?: CorPropriedade
}

export default function CompraCasaModal({ sessionId, nome, preco, cor }: Props) {
  const { comprarCasaAtual, recusarCompra } = useGameStore()
  const { success: toastSuccess, error: toastError } = useToast()
  const [loading, setLoading] = useState(false)
  const [acao, setAcao] = useState<"comprar" | "recusar" | null>(null)

  const colorInfo = cor ? PROPERTY_COLORS.find(c => c.value === cor) : null

  const handle = async (aceitar: boolean) => {
    if (loading) return
    setAcao(aceitar ? "comprar" : "recusar")
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
      setAcao(null)
    }
  }

  return (
    <Modal isOpen onClose={() => handle(false)} title="Propriedade disponível" size="sm">
      <div className="p-2 text-center font-inconsolata">
        {colorInfo && (
          <div className={`w-full h-2 rounded-full mb-4 ${colorInfo.bg}`} />
        )}

        <p className="text-zinc-300 mb-1">Você caiu em</p>
        <p className={`text-xl font-jaro mb-3 ${colorInfo?.text ?? "text-zinc-100"}`}>
          {nome}
        </p>
        <p className="text-green-400 text-lg font-semibold mb-6">
          R$ {formatCurrency(preco)}
        </p>
        <div className="flex gap-3">
          <Button1 size="full" color="red" disabled={loading} handle={loading ? undefined : () => handle(false)}>
            {loading && acao === "recusar" ? <Loader2 className="animate-spin inline-block mr-1" size={16} /> : null}
            Recusar
          </Button1>
          <Button1 size="full" color="green" disabled={loading} handle={loading ? undefined : () => handle(true)}>
            {loading && acao === "comprar" ? <Loader2 className="animate-spin inline-block mr-1" size={16} /> : null}
            Comprar
          </Button1>
        </div>
      </div>
    </Modal>
  )
}
