'use client'

import { useState } from "react"
import type { ExtratoInicio } from "@/services/api/turno"

function fmt(valor: number) {
  const sinal = valor >= 0 ? "+" : "−"
  return `${sinal}R$ ${Math.abs(valor).toLocaleString("pt-BR")}`
}

type Props = {
  extrato: ExtratoInicio
}

// Conteúdo do extrato da passagem pelo Início — renderizado dentro do
// TurnoModal na fase "extrato-inicio". Verde = receita, vermelho =
// despesa, líquido em destaque.
export default function ExtratoInicioModal({ extrato }: Props) {
  const [verDetalhes, setVerDetalhes] = useState(false)
  const liquidoPositivo = extrato.liquido >= 0

  return (
    <div>
      <p className="font-jaro text-lg text-zinc-100 mb-1">🏁 Você passou pelo Início!</p>

      <div className="mt-3 space-y-1.5 text-left">
        <div className="flex justify-between font-inconsolata text-sm">
          <span className="text-zinc-400">Crédito do Início</span>
          <span className="text-emerald-400">{fmt(extrato.creditoInicio)}</span>
        </div>
        {extrato.iptu > 0 && (
          <div className="flex justify-between font-inconsolata text-sm">
            <span className="text-zinc-400">IPTU</span>
            <span className="text-red-400">{fmt(-extrato.iptu)}</span>
          </div>
        )}
        <div className="border-t border-zinc-700 my-2" />

        <div className="flex justify-between items-center">
          <span className="font-inconsolata text-sm text-zinc-300">LÍQUIDO</span>
          <span className={`font-jaro text-xl ${liquidoPositivo ? "text-emerald-400" : "text-red-400"}`}>
            {fmt(extrato.liquido)}
          </span>
        </div>
      </div>

      {!liquidoPositivo && (
        <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="font-inconsolata text-xs text-red-300">
            Seu IPTU superou o crédito do Início. Desenvolva propriedades para gerar
            renda passiva ou hipoteque o que não usa. Se o saldo não cobrir, o
            restante vira dívida.
          </p>
        </div>
      )}

      {extrato.detalhes.length > 0 && (
        <div className="mt-3">
          <button
            onClick={(e) => { e.stopPropagation(); setVerDetalhes(v => !v) }}
            className="text-xs font-inconsolata text-zinc-500 hover:text-zinc-300 underline decoration-dotted cursor-pointer"
          >
            {verDetalhes ? "Ocultar detalhes" : "Ver detalhes por propriedade"}
          </button>

          {verDetalhes && (
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto text-left">
              {extrato.detalhes.map((d) => (
                <div key={d.propId} className="px-2 py-1.5 bg-zinc-800/60 rounded-lg">
                  <p className="font-inconsolata text-xs text-zinc-200">
                    {d.nome} {d.casas > 0 && `(${d.casas >= 5 ? "hotel" : `${d.casas} casa${d.casas > 1 ? "s" : ""}`})`}
                  </p>
                  <div className="flex gap-3 mt-0.5 font-inconsolata text-[11px]">
                    {d.iptu > 0 && <span className="text-red-400">{fmt(-d.iptu)} IPTU</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
