'use client'

import { PROPERTY_COLORS } from "@/types/game"

type Props = {
  nome: string
  grupoCor: string | null
  casas: number
  maxCasas: number
  aluguel: number
  custoCasa: number
  valorVendaCasa: number
  valorHipoteca: number
  valorVendaPropriedade: number
  isDisponivel?: boolean
  playerName?: string
  onComprarCasa?: () => void
  onVenderCasa?: () => void
  onHipotecar?: () => void
  onVenderPropriedade?: () => void
  podeComprar?: boolean
  podeVenderCasa?: boolean
  podeHipotecar?: boolean
  podeVenderPropriedade?: boolean
}

export default function PropertyCard({
  nome,
  grupoCor,
  casas,
  maxCasas,
  aluguel,
  custoCasa,
  isDisponivel = false,
  playerName,
  onComprarCasa,
  onVenderCasa,
  onHipotecar,
  onVenderPropriedade,
  podeComprar = false,
  podeVenderCasa = false,
  podeHipotecar = false,
  podeVenderPropriedade = false
}: Props) {
  const colorInfo = grupoCor ? PROPERTY_COLORS.find(c => c.value === grupoCor) : null

  if (isDisponivel) {
    return (
      <div className="w-full p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg opacity-60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-zinc-300 font-inconsolata text-sm">{nome}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-zinc-500 font-inconsolata">
          <span>Disponível</span>
          <span>R$ {custoCasa?.toLocaleString('pt-BR') || 0}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-full p-3 bg-zinc-900 border-2 rounded-lg"
      style={{ borderTopColor: colorInfo?.border?.replace('border-', '') || '#525252' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {colorInfo && (
            <div className={`w-3 h-3 rotate-45 ${colorInfo.bg}`} />
          )}
          <span className="text-zinc-100 font-jaro text-sm">{nome}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-inconsolata mb-2">
        <span className="text-zinc-400">🏠 {casas}/{maxCasas}</span>
        <span className="text-green-400">💰 R$ {aluguel.toLocaleString('pt-BR')}</span>
      </div>

      {playerName && (
        <div className="text-xs text-zinc-500 font-inconsolata mb-2">
          Dono: {playerName}
        </div>
      )}

      <div className="flex gap-1 mt-2">
        <button
          onClick={onComprarCasa}
          disabled={!podeComprar}
          title="Comprar Casa"
          className="flex-1 py-1 px-2 bg-green-600/20 text-green-400 text-xs rounded hover:bg-green-600/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-inconsolata cursor-pointer"
        >
          [+]
        </button>
        <button
          onClick={onVenderCasa}
          disabled={!podeVenderCasa}
          title="Vender Casa"
          className="flex-1 py-1 px-2 bg-amber-600/20 text-amber-400 text-xs rounded hover:bg-amber-600/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-inconsolata cursor-pointer"
        >
          [-]
        </button>
        <button
          onClick={onHipotecar}
          disabled={!podeHipotecar}
          title="Hipotecar"
          className="flex-1 py-1 px-2 bg-purple-600/20 text-purple-400 text-xs rounded hover:bg-purple-600/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-inconsolata cursor-pointer"
        >
          [H]
        </button>
        <button
          onClick={onVenderPropriedade}
          disabled={!podeVenderPropriedade}
          title="Vender Propriedade"
          className="flex-1 py-1 px-2 bg-red-600/20 text-red-400 text-xs rounded hover:bg-red-600/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-inconsolata cursor-pointer"
        >
          [X]
        </button>
      </div>
    </div>
  )
}