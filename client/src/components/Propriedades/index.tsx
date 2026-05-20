'use client'
import { useState, useEffect, useRef, useMemo } from "react"
import { useGameStore } from "@/stores/gameStore"
import { LoaderCircle, ShoppingCart, MoreVertical, Plus, Minus, Archive, X } from "lucide-react"
import Modal from "../Modal"
import { useToast } from "@/components/Toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import Button1 from "../Button01"
import { Propriedade, PROPERTY_COLORS } from "@/types/game"
import ConfirmationModal from "../ConfirmationModal"

const COLOR_HEX: Record<string, string> = {
  blue:       "#1D4ED8",
  red:        "#dc2626",
  green:      "#16a34a",
  purple:     "#7c3aed",
  orange:     "#ea580c",
  amber:     "#ca8a04",
  pink:       "#db2777",
  cyan:       "#0891b2",
  brown:      "#92400e",
  gray:       "#6b7280",
  black:      "#18181b",
  white:      "#a1a1aa",
}

function getAccentHex(grupoCor: string | null): string {
  if (!grupoCor) return "#52525b"
  const found = PROPERTY_COLORS.find(c => c.value === grupoCor)
  if (!found) return COLOR_HEX[grupoCor] ?? "#52525b"
  // extrai a cor do tailwind class (ex: "bg-blue-600" → "blue")
  const match = found.bg?.match(/bg-(\w+)/)
  if (match) return COLOR_HEX[match[1]] ?? "#52525b"
  return "#52525b"
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR')
}

export default function Propriedades() {
  const { success: toastSuccess, error: toastError } = useToast()
  const { currentSession, loadSession, buyProperty, getPropertyById } = useGameStore()

  const allProperties = useMemo(
    () => currentSession?.sessionPosses ?? [],
    [currentSession?.sessionPosses]
  )

  const availableProperties = useMemo(
    () => allProperties
      .filter(p => p.playerId === null && !p.hipotecada)
      .sort((a, b) => a.possesId - b.possesId),
    [allProperties]
  )

  const hipotecadaProperties = useMemo(
    () => allProperties
      .filter(p => p.playerId === null && p.hipotecada)
      .sort((a, b) => a.possesId - b.possesId),
    [allProperties]
  )

  const [propertiesData, setPropertiesData] = useState<Record<number, Propriedade | null>>({})
  const [loading, setLoading] = useState(true)
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null)
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null)
  const [loadingBuy, setLoadingBuy] = useState(false)

  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    type: string
    title: string
    message: string
    confirmText: string
    color: 'green' | 'orange' | 'purple' | 'red'
    action: () => Promise<void>
  } | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    async function loadAllProperties() {
      if (!currentSession) { setLoading(false); return }
      setLoading(true)
      const cache: Record<number, Propriedade | null> = {}
      for (const sp of allProperties) {
        if (!cache[sp.possesId]) {
          cache[sp.possesId] = await getPropertyById(sp.possesId)
        }
      }
      setPropertiesData(cache)
      setLoading(false)
    }
    loadAllProperties()
  }, [currentSession, allProperties, getPropertyById])

  async function handleBuyProperty(propertyId: number, playerId: number, sessionId: number) {
    setLoadingBuy(true)
    try {
      await buyProperty(propertyId, sessionId, playerId)
      await loadSession(sessionId)
      toastSuccess("Propriedade comprada com sucesso!")
      setShowBuyModal(false)
      setSelectedPlayer(null)
      setSelectedProperty(null)
    } catch (error) {
      console.error("Erro ao comprar propriedade: ", error)
      toastError("Erro ao comprar propriedade")
    } finally {
      setLoadingBuy(false)
    }
  }

  function handleOpenMenu(e: React.MouseEvent, propId: number) {
    e.stopPropagation()
    setOpenMenuId(openMenuId === propId ? null : propId)
  }

  // ── Card: propriedade disponível ────────────────────────────────────────────
  const AvailablePropertyCard = ({
    sessionProp,
    propBase,
  }: {
    sessionProp: { id: number; possesId: number; playerId: number | null; hipotecada: boolean }
    propBase: Propriedade | null
  }) => {
    if (!propBase) return null
    const accent = getAccentHex(propBase.grupo_cor)

    return (
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col hover:border-zinc-600 transition-colors">
        {/* barra colorida */}
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: accent }} />

        <div className="flex flex-col flex-1 p-4 gap-3">
          {/* nome + badge */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-zinc-100 font-inconsolata text-base leading-snug line-clamp-2">
              {propBase.nome}
            </span>
            <span
              className="shrink-0 text-[10px] font-inconsolata font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${accent}22`, color: accent }}
            >
              Livre
            </span>
          </div>

          {/* preço de compra */}
          <div>
            <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide mb-0.5">Compra</p>
            <p className="text-lg font-jaro font-semibold" style={{ color: accent }}>
              R$ {formatCurrency(propBase.custo_compra)}
            </p>
          </div>

          {/* aluguel base + botão */}
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-800">
            <div>
              <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide mb-0.5">Aluguel base</p>
              <p className="text-sm font-inconsolata text-zinc-300">R$ {formatCurrency(propBase.aluguel_base)}</p>
            </div>
            <button
              onClick={() => {
                setSelectedProperty(sessionProp.possesId)
                setShowBuyModal(true)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-inconsolata font-medium text-white transition-opacity hover:opacity-80 cursor-pointer"
              style={{ backgroundColor: accent }}
            >
              {loadingBuy
                ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                : <ShoppingCart className="w-3.5 h-3.5" />
              }
              Comprar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Card: propriedade hipotecada ────────────────────────────────────────────
  const HipotecadaPropertyCard = ({
    sessionProp,
    propBase,
  }: {
    sessionProp: { id: number; possesId: number; casas: number; playerId: number | null; hipotecada: boolean }
    propBase: Propriedade | null
  }) => {
    if (!propBase) return null
    const accent = getAccentHex(propBase.grupo_cor)
    const propId = sessionProp.id

    return (
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col opacity-70">
        {/* barra colorida */}
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: accent }} />

        <div className="flex flex-col flex-1 p-4 gap-3">
          {/* nome + badge + menu */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-zinc-400 font-jaro text-sm leading-snug line-clamp-2">
              {propBase.nome}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-inconsolata font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                Hipotecada
              </span>
              <div className="relative">
                <button
                  onClick={(e) => handleOpenMenu(e, propId)}
                  className="p-1 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                >
                  <MoreVertical className="w-3.5 h-3.5 text-zinc-500" />
                </button>
                {openMenuId === propId && (
                  <div className="absolute right-0 top-6 z-30 w-40 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1">
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors font-inconsolata cursor-pointer">
                      <Plus className="w-3 h-3 text-green-400" />
                      Comprar Casa
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors font-inconsolata cursor-pointer">
                      <Minus className="w-3 h-3 text-amber-400" />
                      Vender Casa
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors font-inconsolata cursor-pointer">
                      <Archive className="w-3 h-3 text-purple-400" />
                      Hipotecar
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors font-inconsolata cursor-pointer">
                      <X className="w-3 h-3 text-red-400" />
                      Vender Tudo
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* valor hipoteca */}
          <div>
            <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide mb-0.5">Valor hipoteca</p>
            <p className="text-lg font-jaro font-semibold text-amber-400">
              R$ {formatCurrency(propBase.hipoteca)}
            </p>
          </div>

          {/* aluguel base */}
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-800">
            <div>
              <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide mb-0.5">Aluguel base</p>
              <p className="text-sm font-inconsolata text-zinc-500">R$ {formatCurrency(propBase.aluguel_base)}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500" />
      </div>
    )
  }

  return (
    <div className="space-y-10 px-4 sm:px-6 lg:px-10" ref={menuRef}>

      {/* Disponíveis */}
      <div>
        <h2 className="text-xl font-jaro text-zinc-100 mb-4">
          Propriedades Disponíveis
          <span className="ml-2 text-sm font-inconsolata text-zinc-500">({availableProperties.length})</span>
        </h2>

        {availableProperties.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {availableProperties.map((sp) => (
              <AvailablePropertyCard
                key={sp.id}
                sessionProp={sp}
                propBase={propertiesData[sp.possesId] ?? null}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm font-inconsolata text-zinc-500 italic">Nenhuma propriedade disponível.</p>
        )}
      </div>

      {/* Hipotecadas */}
      {hipotecadaProperties.length > 0 && (
        <div>
          <h2 className="text-xl font-jaro text-zinc-100 mb-4">
            Propriedades Hipotecadas
            <span className="ml-2 text-sm font-inconsolata text-zinc-500">({hipotecadaProperties.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {hipotecadaProperties.map((sp) => (
              <HipotecadaPropertyCard
                key={sp.id}
                sessionProp={sp}
                propBase={propertiesData[sp.possesId] ?? null}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal de compra */}
      <Modal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
        size="md"
        title="Comprar Propriedade"
      >
        <div className="flex flex-col gap-4">
          <p className="font-inconsolata text-zinc-300">
            Selecione o jogador que irá comprar esta propriedade:
          </p>

          <Select
            onValueChange={(value) => setSelectedPlayer(Number(value))}
            value={selectedPlayer?.toString()}
          >
            <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100">
              <SelectValue placeholder="-- Selecione um jogador --" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {currentSession?.jogadores.map((player) => (
                <SelectItem key={player.id} value={player.id.toString()} className="text-zinc-100">
                  {player.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex justify-end gap-3 mt-4">
            <Button1 size="sm" color="purple" handle={() => setShowBuyModal(false)}>
              Cancelar
            </Button1>
            <Button1
              size="sm"
              color="green"
              handle={() => {
                if (!selectedProperty || !selectedPlayer || !currentSession) return
                handleBuyProperty(selectedProperty, selectedPlayer, currentSession.id)
              }}
              disabled={loadingBuy || !selectedPlayer || !selectedProperty}
            >
              {loadingBuy ? "Comprando..." : "Confirmar Compra"}
            </Button1>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação */}
      {confirmAction && (
        <ConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => { setShowConfirmModal(false); setConfirmAction(null) }}
          onConfirm={async () => {
            if (confirmAction) {
              await confirmAction.action()
              setShowConfirmModal(false)
              setConfirmAction(null)
            }
          }}
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText}
          color={confirmAction.color}
          loading={false}
        />
      )}
    </div>
  )
}