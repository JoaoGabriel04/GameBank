'use client'
import { useState, useMemo } from "react"
import { useGameStore } from "@/stores/gameStore"
import { useAuthStore } from "@/stores/authStore"
import { useNotificationStore } from "@/stores/socketStore"
import { LoaderCircle, ShoppingCart, Bell, Check, X as XIcon } from "lucide-react"
import { useToast } from "@/components/Toast"
import { PROPERTY_COLORS, Propriedade } from "@/types/game"
import { getPropData, groupByColor } from "@/utils/properties"

const COLOR_HEX: Record<string, string> = {
  lime:    "#84cc16",
  green:   "#15803d",
  red:     "#dc2626",
  blue:    "#2563eb",
  amber:   "#fcd34d",
  orange:  "#ea580c",
  pink:    "#db2777",
  purple:  "#7e22ce",
  zinc:    "#fafafa",
}

function getAccentHex(grupoCor: string | null): string {
  if (!grupoCor) return "#52525b"
  const found = PROPERTY_COLORS.find(c => c.value === grupoCor)
  if (!found) return COLOR_HEX[grupoCor] ?? "#52525b"
  const match = found.bg?.match(/bg-(\w+)/)
  if (match) return COLOR_HEX[match[1]] ?? "#52525b"
  return "#52525b"
}

const COLOR_LABELS: Record<string, string> = {}
for (const c of PROPERTY_COLORS) COLOR_LABELS[c.value] = c.label

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR')
}

export default function Loja() {
  const { success: toastSuccess, error: toastError } = useToast()
  const { currentSession, loadSession, buyProperty, comprarHipotecada, responderNotificacao } = useGameStore()
  const authUser = useAuthStore((s) => s.user)

  const currentPlayer = useMemo(
    () => currentSession?.jogadores.find((p) => p.userId === authUser?.id) ?? null,
    [currentSession?.jogadores, authUser?.id]
  )

  const allProperties = useMemo(
    () => currentSession?.sessionPosses ?? [],
    [currentSession?.sessionPosses]
  )

  const availableGroups = useMemo(() => {
    const items = allProperties
      .filter(p => p.playerId === null && !p.hipotecada)
      .map(sp => ({ prop: getPropData(sp), sessionProp: sp }))
      .filter((item): item is { prop: Propriedade; sessionProp: typeof item.sessionProp } => item.prop !== null)
    return groupByColor(items)
  }, [allProperties])

  const hipotecadaGroups = useMemo(() => {
    const items = allProperties
      .filter(p => p.playerId === null && p.hipotecada)
      .map(sp => ({ prop: getPropData(sp), sessionProp: sp }))
      .filter((item): item is { prop: Propriedade; sessionProp: typeof item.sessionProp } => item.prop !== null)
    return groupByColor(items)
  }, [allProperties])

  const [buyingPossesId, setBuyingPossesId] = useState<number | null>(null)

  async function handleBuy(sessionPossesId: number) {
    if (!currentPlayer || !currentSession) return
    setBuyingPossesId(sessionPossesId)
    try {
      await buyProperty(sessionPossesId, currentSession.id, currentPlayer.id)
      await loadSession(currentSession.id)
      toastSuccess("Propriedade comprada com sucesso!")
    } catch {
      toastError("Erro ao comprar propriedade")
    } finally {
      setBuyingPossesId(null)
    }
  }

  async function handleComprarHipoteca(sessionPossesId: number) {
    if (!currentPlayer || !currentSession) return
    setBuyingPossesId(sessionPossesId)
    try {
      const result = await comprarHipotecada(sessionPossesId, currentSession.id, currentPlayer.id)
      await loadSession(currentSession.id)
      const r = result as any
      if (r?.direto) {
        toastSuccess("Hipoteca quitada com sucesso!")
      } else {
        toastSuccess("Notificação enviada ao dono original!")
      }
    } catch (err: any) {
      toastError(err?.message || "Erro ao comprar hipoteca")
    } finally {
      setBuyingPossesId(null)
    }
  }

  async function handleResponder(notificationId: number, aceitar: boolean) {
    if (!currentPlayer || !currentSession) return
    try {
      await responderNotificacao(notificationId, aceitar, currentPlayer.id, currentSession.id)
      await loadSession(currentSession.id)
      toastSuccess(aceitar ? "Compra aprovada!" : "Compra recusada.")
      useNotificationStore.getState().removeNotification(notificationId)
    } catch (err: any) {
      toastError(err?.message || "Erro ao responder")
    }
  }

  function canAfford(custo: number): boolean {
    return currentPlayer ? currentPlayer.saldo >= custo : false
  }

  // ── Notificações ─────────────────────────────────────────────────────────
  const notifications = useNotificationStore((s) => s.notifications)
  const pendingNotifs = notifications.filter(
    (n) => n.tipo === "compra_hipotecada" && n.status === "pendente" && n.toPlayerId === currentPlayer?.id
  )

  function AvailablePropertyCard({
    sessionProp,
    propBase,
  }: {
    sessionProp: { id: number; possesId: number; playerId: number | null; hipotecada: boolean }
    propBase: Propriedade | null
  }) {
    if (!propBase) return null
    const accent = getAccentHex(propBase.grupo_cor)
    const isBuying = buyingPossesId === sessionProp.possesId
    const afford = canAfford(propBase.custo_compra)

    return (
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col hover:border-zinc-600 transition-colors">
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: accent }} />

        <div className="flex flex-col flex-1 p-4 gap-3">
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

          <div>
            <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide mb-0.5">Preço</p>
            <p className="text-lg font-jaro font-semibold" style={{ color: accent }}>
              R$ {formatCurrency(propBase.custo_compra)}
            </p>
          </div>

          <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-800">
            <div>
              <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide mb-0.5">Aluguel base</p>
              <p className="text-sm font-inconsolata text-zinc-300">R$ {formatCurrency(propBase.aluguel_base)}</p>
            </div>
            <button
              onClick={() => handleBuy(sessionProp.possesId)}
              disabled={isBuying || !currentPlayer || !afford}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-inconsolata font-medium ${accent === '#fafafa' ? 'text-black' : 'text-white'} transition-opacity hover:opacity-80 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
              style={{ backgroundColor: accent }}
              title={!currentPlayer ? "Você não está associado a um jogador" : !afford ? "Saldo insuficiente" : ""}
            >
              {isBuying
                ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                : <ShoppingCart className="w-3.5 h-3.5" />
              }
              {!currentPlayer ? "Indisponível" : !afford ? "Saldo insuf." : "Comprar"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10 px-4 sm:px-6 lg:px-10">

      {/* Notificações pendentes */}
      {pendingNotifs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-jaro text-amber-400 mb-1 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificações
          </h2>
          {pendingNotifs.map((n) => {
            const sp = currentSession?.sessionPosses.find((p) => p.id === n.sessionPossesId)
            const propData = sp ? getPropData(sp) : null
            const comprador = currentSession?.jogadores.find((j) => j.id === n.fromPlayerId)
            return (
              <div key={n.id} className="bg-zinc-900 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-zinc-100 font-inconsolata text-sm">
                    <span className="font-bold">{comprador?.nome || "Jogador"}</span> quer comprar a hipoteca de{" "}
                    <span className="font-bold">{propData?.nome || "uma propriedade"}</span>
                  </p>
                  <p className="text-zinc-500 text-xs font-inconsolata mt-1">
                    Valor: R$ {(propData?.hipoteca || 0 * 1.1).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResponder(n.id, true)}
                    className="bg-green-600 hover:bg-green-500 text-white rounded-lg px-4 py-2 text-sm font-inconsolata flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> Aceitar
                  </button>
                  <button
                    onClick={() => handleResponder(n.id, false)}
                    className="bg-red-600 hover:bg-red-500 text-white rounded-lg px-4 py-2 text-sm font-inconsolata flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <XIcon className="w-4 h-4" /> Recusar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Disponíveis */}
      <div>
        <h2 className="text-xl font-jaro text-zinc-100 mb-1">
          Loja de Propriedades
        </h2>
        <p className="text-sm font-inconsolata text-zinc-500 mb-4">
          Propriedades disponíveis para compra
          <span className="ml-2 text-xs">({availableGroups.reduce((sum, g) => sum + g.items.length, 0)})</span>
        </p>

        {!currentPlayer && (
          <p className="text-sm font-inconsolata text-amber-400 mb-4">
            Você precisa estar associado a um jogador para comprar propriedades.
          </p>
        )}

        {availableGroups.length > 0 ? (
          <div className="space-y-8">
            {availableGroups.map((group) => (
              <div key={group.cor}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getAccentHex(group.cor) }} />
                  <h3 className="text-sm font-jaro text-zinc-300 uppercase tracking-wide">
                    {COLOR_LABELS[group.cor] || group.cor}
                    <span className="ml-2 text-xs font-inconsolata text-zinc-500">({group.items.length})</span>
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {group.items.map(({ prop, sessionProp }) => (
                    <AvailablePropertyCard
                      key={sessionProp.id}
                      sessionProp={sessionProp}
                      propBase={prop}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-inconsolata text-zinc-500 italic">Nenhuma propriedade disponível no momento.</p>
        )}
      </div>

      {/* Hipotecadas */}
      {hipotecadaGroups.length > 0 && (
        <div>
          <h2 className="text-xl font-jaro text-zinc-100 mb-1">
            Propriedades Hipotecadas
          </h2>
          <p className="text-sm font-inconsolata text-zinc-500 mb-4">
            Propriedades disponíveis para comprar a hipoteca
            <span className="ml-2 text-xs">({hipotecadaGroups.reduce((sum, g) => sum + g.items.length, 0)})</span>
          </p>
          <div className="space-y-8">
            {hipotecadaGroups.map((group) => (
              <div key={group.cor}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getAccentHex(group.cor) }} />
                  <h3 className="text-sm font-jaro text-zinc-500 uppercase tracking-wide">
                    {COLOR_LABELS[group.cor] || group.cor}
                    <span className="ml-2 text-xs font-inconsolata text-zinc-600">({group.items.length})</span>
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {group.items.map(({ prop, sessionProp }) => {
                    const accent = getAccentHex(prop.grupo_cor)
                    const valorComJuros = Math.round(prop.hipoteca * 1.1)
                    const isBuying = buyingPossesId === sessionProp.id
                    const afford = canAfford(valorComJuros)
                    return (
                      <div key={sessionProp.id} className="relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col opacity-70 hover:opacity-100 transition-opacity">
                        <div className="h-1 w-full shrink-0" style={{ backgroundColor: accent }} />
                        <div className="flex flex-col flex-1 p-4 gap-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-zinc-400 font-jaro text-sm leading-snug line-clamp-2">
                              {prop.nome}
                            </span>
                            <span className="text-[10px] font-inconsolata font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                              Hipotecada
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide mb-0.5">Valor hipoteca</p>
                            <p className="text-lg font-jaro font-semibold text-amber-400">
                              R$ {formatCurrency(prop.hipoteca)}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-800">
                            <div>
                              <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide mb-0.5">Com +10%</p>
                              <p className="text-sm font-inconsolata text-zinc-300">R$ {formatCurrency(valorComJuros)}</p>
                            </div>
                            <button
                              onClick={() => handleComprarHipoteca(sessionProp.id)}
                              disabled={isBuying || !currentPlayer || !afford}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-inconsolata font-medium bg-amber-500 text-black transition-opacity hover:opacity-80 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title={!currentPlayer ? "Você não está associado a um jogador" : !afford ? "Saldo insuficiente" : ""}
                            >
                              {isBuying
                                ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                                : <ShoppingCart className="w-3.5 h-3.5" />
                              }
                              {!currentPlayer ? "Indisponível" : !afford ? "Saldo insuf." : "Comprar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
