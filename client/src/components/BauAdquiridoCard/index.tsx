'use client'

import { useState, useEffect } from "react"
import { Clock, Loader2 } from "lucide-react"
import type { BauAdquirido } from "@/stores/bauStore"

const BAU_IMAGENS: Record<string, string> = {
  comum:    "/images/Cofrinho.png",
  premium:  "/images/Cofre Premium.png",
  lendario: "/images/Cofre Lendário.png",
}

const BAU_CORES: Record<string, string> = {
  comum:    "#00BE03",
  premium:  "#9D00FF",
  lendario: "#FFC800",
}

function formatTimer(ms: number): string {
  if (ms <= 0) return ""
  const totalSeg = Math.floor(ms / 1000)
  const h = Math.floor(totalSeg / 3600)
  const m = Math.floor((totalSeg % 3600) / 60)
  const s = totalSeg % 60

  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

type Props = {
  bau: BauAdquirido
  onAbrir: () => void
  abrindo?: boolean
}

export default function BauAdquiridoCard({ bau, onAbrir, abrindo }: Props) {
  const [agora, setAgora] = useState(Date.now())
  const unlockAt = new Date(bau.unlockAt).getTime()
  const restante = unlockAt - agora
  const cor = BAU_CORES[bau.bau.tipo] ?? "#a1a1aa"

  useEffect(() => {
    if (bau.status !== "BLOQUEADO") return
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [bau.status])

  return (
    <button
      onClick={bau.status === "PRONTO" && !abrindo ? onAbrir : undefined}
      disabled={bau.status !== "PRONTO" || abrindo}
      className="flex flex-col items-center gap-2 rounded-xl p-3 transition-colors cursor-pointer text-center"
      style={{
        background: "#111113",
        border: `1px solid ${cor}22`,
        borderTop: `2px solid ${cor}66`,
        opacity: bau.status === "PRONTO" && !abrindo ? 1 : 0.7,
      }}
    >
      <div className="w-16 h-16 grid place-items-center">
        {abrindo ? (
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: cor }} />
        ) : (
          <img
            src={BAU_IMAGENS[bau.bau.tipo] ?? "/images/Cofrinho.png"}
            alt={bau.bau.tipo}
            className="w-16 h-16 object-contain"
          />
        )}
      </div>

      <span className="font-jaro text-[13px] text-zinc-100 truncate w-full">
        {bau.bau.nome}
      </span>

      {bau.status === "BLOQUEADO" && restante > 0 && (
        <div className="flex items-center gap-1.5 font-inconsolata text-[11px] text-zinc-400">
          <Clock size={12} />
          {formatTimer(restante)}
        </div>
      )}

      {bau.status === "BLOQUEADO" && restante <= 0 && (
        <span className="font-inconsolata text-[11px] text-green-400">
          Disponível
        </span>
      )}

      {bau.status === "PRONTO" && !abrindo && (
        <span
          className="font-inconsolata text-[11px] px-3 py-1 rounded-full"
          style={{ background: `${cor}22`, color: cor }}
        >
          Abrir
        </span>
      )}

      {bau.status === "PRONTO" && abrindo && (
        <span className="font-inconsolata text-[11px] text-zinc-500">
          Abrindo…
        </span>
      )}
    </button>
  )
}
