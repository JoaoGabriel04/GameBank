'use client'

import { useState, useEffect, useCallback } from "react"
import {
  Player,
  PLAYER_COLORS,
  PROPERTY_COLORS,
  Propriedade,
  SessionPropriedade,
} from "@/types/game"
import { useGameStore } from "@/stores/gameStore"
import MenuOptions from "../MenuOptions"
import Modal from "../Modal"
import ConfirmationModal from "../ConfirmationModal"
import { useToast } from "@/components/Toast"
import PropertyCard from "../PropertyCard"

interface PlayerCardProps {
  player: Player
  totalPropertyValue: number
}

type Group = {
  color: typeof PROPERTY_COLORS[0]
  sessionPosses: SessionPropriedade[]
  properties: Propriedade[]
}

type PendingAction = {
  type: 'buyHouse' | 'sellHouse' | 'hipotecar' | 'vender'
  propId: number
  title: string
  message: string
  confirmText: string
  color: 'green' | 'orange' | 'purple' | 'red'
  optimisticFn: () => void
  rollbackFn: () => void
  apiFn: () => Promise<void>
}

export default function PlayerCard({ player, totalPropertyValue }: PlayerCardProps) {
  const { success: toastSuccess, error: toastError } = useToast()

  const {
    currentSession,
    sellPropriedade,
    hipotecarProp,
    getPropertyById,
    getAluguel,
    buyHouse,
    sellHouse,
  } = useGameStore()

  const [propertiesByColor, setPropertiesByColor] = useState<Record<string, Group>>({})
  const [showPropertiesModal, setShowPropertiesModal] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const playerColor = PLAYER_COLORS.find((c) => c.value === player.cor)

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

  const loadProperties = useCallback(async () => {
    if (!currentSession) return

    const playerProperties = currentSession.sessionPosses.filter(
      (p) => p.playerId === player.id
    )
    const grouped: Record<string, Group> = {}

    for (const prop of playerProperties) {
      const propData = await getPropertyById(prop.possesId)
      if (!propData) continue

      const colorKey = propData.grupo_cor ?? "other"
      const colorInfo = PROPERTY_COLORS.find((c) => c.value === colorKey)
      const resolvedColor = colorInfo ?? {
        value: colorKey,
        label: colorKey,
        text: "text-zinc-400",
        bg: "bg-zinc-500",
        border: "border-zinc-500",
        total: 0,
      }

      if (!grouped[colorKey]) {
        grouped[colorKey] = { color: resolvedColor, properties: [], sessionPosses: [] }
      }

      grouped[colorKey].properties.push(propData)
      grouped[colorKey].sessionPosses.push(prop)
    }

    for (const group of Object.values(grouped)) {
      const sorted = group.properties
        .map((p, i) => ({ prop: p, sess: group.sessionPosses[i] }))
        .sort((a, b) => a.prop.nome.localeCompare(b.prop.nome, 'pt-BR'))

      group.properties = sorted.map(s => s.prop)
      group.sessionPosses = sorted.map(s => s.sess)
    }

    setPropertiesByColor(grouped)
  }, [currentSession, player.id, getPropertyById])

  useEffect(() => {
    loadProperties()
  }, [loadProperties])

  // ── Optimistic helpers ─────────────────────────────────────────────────────

  const updateCasasOptimistic = useCallback((propId: number, delta: 1 | -1) => {
    setPropertiesByColor((prev) => {
      const next = structuredClone(prev)
      for (const group of Object.values(next)) {
        const idx = group.properties.findIndex((p) => p.id === propId)
        if (idx !== -1) {
          group.sessionPosses[idx] = {
            ...group.sessionPosses[idx],
            casas: group.sessionPosses[idx].casas + delta,
          }
          break
        }
      }
      return next
    })
  }, [])

  const removePropertyOptimistic = useCallback((propId: number) => {
    setPropertiesByColor((prev) => {
      const next = structuredClone(prev)
      for (const [key, group] of Object.entries(next)) {
        const idx = group.properties.findIndex((p) => p.id === propId)
        if (idx !== -1) {
          group.properties.splice(idx, 1)
          group.sessionPosses.splice(idx, 1)
          if (group.properties.length === 0) delete next[key]
          break
        }
      }
      return next
    })
  }, [])

  // ── Preparar ação (abre modal de confirmação) ──────────────────────────────
  // Os dados do modal são calculados AGORA, com o estado atual.
  // O modal apenas exibe — não re-calcula nada.

  const prepareComprarCasa = (prop: Propriedade, sessionProp: SessionPropriedade) => {
    const casasDepois = sessionProp.casas + 1
    setPendingAction({
      type: 'buyHouse',
      propId: prop.id,
      title: 'Comprar Casa',
      message: `CASA em ${prop.nome.toUpperCase()}\n\nCusto: M$ ${prop.custo_casa.toLocaleString('pt-BR')}\nAluguel após compra: M$ ${getAluguel(prop, casasDepois).toLocaleString('pt-BR')}`,
      confirmText: 'Comprar',
      color: 'green',
      optimisticFn: () => updateCasasOptimistic(prop.id, 1),
      rollbackFn: () => updateCasasOptimistic(prop.id, -1),
      apiFn: () => buyHouse({ userId: player.id, sessionId: currentSession!.id, propriedadeId: prop.id }),
    })
  }

  const prepareVenderCasa = (prop: Propriedade, sessionProp: SessionPropriedade) => {
    const casasDepois = sessionProp.casas - 1
    setPendingAction({
      type: 'sellHouse',
      propId: prop.id,
      title: 'Vender Casa',
      message: `Vender 1 casa de ${prop.nome.toUpperCase()}\n\nVocê recebe: M$ ${Math.floor(prop.custo_casa / 2).toLocaleString('pt-BR')}\nNovo aluguel: M$ ${getAluguel(prop, casasDepois).toLocaleString('pt-BR')}`,
      confirmText: 'Vender',
      color: 'orange',
      optimisticFn: () => updateCasasOptimistic(prop.id, -1),
      rollbackFn: () => updateCasasOptimistic(prop.id, 1),
      apiFn: () => sellHouse({ userId: player.id, sessionId: currentSession!.id, propriedadeId: prop.id }),
    })
  }

  const prepareHipotecar = (prop: Propriedade) => {
    setPendingAction({
      type: 'hipotecar',
      propId: prop.id,
      title: 'Hipotecar Propriedade',
      message: `Hipotecar ${prop.nome.toUpperCase()}\n\nVocê recebe: M$ ${prop.hipoteca.toLocaleString('pt-BR')}\nPerde a propriedade se não quitar a dívida`,
      confirmText: 'Hipotecar',
      color: 'purple',
      optimisticFn: () => removePropertyOptimistic(prop.id),
      rollbackFn: () => loadProperties(),
      apiFn: () => hipotecarProp(prop.id, currentSession!.id, player.id),
    })
  }

  const prepareVender = (prop: Propriedade) => {
    setPendingAction({
      type: 'vender',
      propId: prop.id,
      title: 'Vender Propriedade',
      message: `Vender ${prop.nome.toUpperCase()}\n\nVocê recebe: M$ ${prop.custo_compra.toLocaleString('pt-BR')}\nCuidado: ação irreversível!`,
      confirmText: 'Vender',
      color: 'red',
      optimisticFn: () => removePropertyOptimistic(prop.id),
      rollbackFn: () => loadProperties(),
      apiFn: () => sellPropriedade(prop.id, currentSession!.id, player.id),
    })
  }

  // ── Confirmar ação ─────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!pendingAction || !currentSession) return
    setActionLoading(true)
    pendingAction.optimisticFn()
    setPendingAction(null) // fecha modal imediatamente
    try {
      await pendingAction.apiFn()
      toastSuccess(
        pendingAction.type === 'buyHouse' ? 'Casa comprada!' :
          pendingAction.type === 'sellHouse' ? 'Casa vendida!' :
            pendingAction.type === 'hipotecar' ? 'Propriedade hipotecada!' :
              'Propriedade vendida!'
      )
      console.log('sessão atualizada:',
        useGameStore.getState().currentSession?.sessionPosses.find(
          p => p.possesId === pendingAction.propId  // ← possesId
        )?.casas
      )
    } catch {
      pendingAction.rollbackFn()
      toastError(
        pendingAction.type === 'buyHouse' ? 'Erro ao comprar casa' :
          pendingAction.type === 'sellHouse' ? 'Erro ao vender casa' :
            pendingAction.type === 'hipotecar' ? 'Erro ao hipotecar' :
              'Erro ao vender propriedade'
      )
    } finally {
      setActionLoading(false)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

  const getPropertyActionsInfo = (
    group: Group,
    propData: Propriedade,
    sessionProp: SessionPropriedade
  ) => {
    const hasAllInGroup = group.properties.length === (group.color.total || 0)
    const hasHouses = sessionProp.casas > 0
    return {
      podeComprar: hasAllInGroup && sessionProp.casas < 5 && player.saldo >= propData.custo_casa,
      podeVenderCasa: hasHouses,
      podeHipotecar: !hasHouses && !sessionProp.hipotecada,
      podeVenderPropriedade: !hasHouses && !sessionProp.hipotecada,
    }
  }

  const totalProperties = Object.values(propertiesByColor).reduce(
    (acc, g) => acc + g.properties.length, 0
  )

  const totalGroupsComplete = Object.values(propertiesByColor).filter((group) => {
    const totalInGroup = group.color.total || 0
    return totalInGroup > 0 && group.properties.length === totalInGroup
  }).length

  const renderPropertyCard = (
    prop: Propriedade,
    sessionProp: SessionPropriedade,
    group: Group
  ) => {
    const actions = getPropertyActionsInfo(group, prop, sessionProp)
    return (
      <PropertyCard
        key={prop.id}
        nome={prop.nome}
        grupoCor={prop.grupo_cor}
        casas={sessionProp.casas}
        maxCasas={5}
        aluguel={getAluguel(prop, sessionProp.casas)}
        custoCasa={prop.custo_casa}
        valorVendaCasa={Math.floor(prop.custo_casa / 2)}
        valorHipoteca={prop.hipoteca}
        valorVendaPropriedade={prop.custo_compra}
        onComprarCasa={() => prepareComprarCasa(prop, sessionProp)}
        onVenderCasa={() => prepareVenderCasa(prop, sessionProp)}
        onHipotecar={() => prepareHipotecar(prop)}
        onVenderPropriedade={() => prepareVender(prop)}
        {...actions}
      />
    )
  }

  return (
    <main
      className="relative bg-zinc-900 border-2 overflow-hidden rounded-xl"
      style={{ borderColor: playerColor?.bg?.replace("bg-", "") || "#525252" }}
    >
      <div className={`${playerColor?.bg || "bg-zinc-500"} px-4 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-white font-bold">
                {player.nome.charAt(0).toUpperCase()}
              </span>
            </div>
            <h3 className="text-lg font-jaro text-white">{player.nome}</h3>
          </div>
          <MenuOptions
            playerId={player.id}
            playerName={player.nome}
            show={showMenu}
            onToggle={() => setShowMenu(!showMenu)}
          />
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-inconsolata text-zinc-400">Saldo</span>
          <span className="text-xl font-bold text-green-400 font-jaro">
            {formatCurrency(player.saldo)}
          </span>
        </div>

        {totalProperties > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(propertiesByColor)
                .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                .slice(0, 4)
                .map(([, group]) => {
                  const prop = group.properties[0]
                  const sessionProp = group.sessionPosses[0]
                  return renderPropertyCard(prop, sessionProp, group)
                })}
            </div>
            <button
              onClick={() => setShowPropertiesModal(true)}
              className="w-full py-2 text-center text-sm font-inconsolata text-zinc-400 hover:text-green-400 border border-zinc-700 hover:border-green-500 rounded-lg transition-colors cursor-pointer"
            >
              Ver todas as {totalProperties} propriedades →
            </button>
          </div>
        ) : (
          <p className="text-xs text-zinc-500 italic text-center py-2 font-inconsolata">
            Nenhuma propriedade
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-zinc-800">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-zinc-500 font-inconsolata">Valor Total</p>
              <p className="text-sm font-semibold text-zinc-100 font-jaro">
                {formatCurrency(totalPropertyValue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-inconsolata">Grupos</p>
              <p className="text-sm font-semibold text-zinc-100 font-jaro">
                {totalGroupsComplete}/{Object.keys(propertiesByColor).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de propriedades */}
      <Modal
        size="lg"
        title={`Propriedades de ${player.nome}`}
        isOpen={showPropertiesModal}
        onClose={() => setShowPropertiesModal(false)}
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          {Object.entries(propertiesByColor)
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
            .map(([colorKey, group]) => {
              const hasAll = group.properties.length === (group.color.total || 0)
              return (
                <div key={colorKey}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-jaro text-zinc-100 flex items-center gap-3 px-2">
                      <div className={`w-4 h-4 rotate-45 ${group.color.bg}`} />
                      {group.color.label}
                    </h3>
                    {hasAll && (
                      <span className="text-green-400 text-sm font-inconsolata">✅</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.properties.map((prop, idx) =>
                      renderPropertyCard(prop, group.sessionPosses[idx], group)
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </Modal>

      {/* Modal de confirmação — único, centralizado aqui */}
      <ConfirmationModal
        isOpen={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirm}
        title={pendingAction?.title ?? ''}
        message={pendingAction?.message ?? ''}
        confirmText={pendingAction?.confirmText ?? ''}
        color={pendingAction?.color ?? 'green'}
        loading={actionLoading}
      />
    </main>
  )
}