"use client";

import { useMemo, useState, useCallback } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { useNegotiationStore } from "@/stores/negotiationStore";
import {
  PROPERTY_COLORS,
  PLAYER_COLORS,
} from "@/types/game";
import type { SorteRevesCard, Player, SessionPropriedade, Propriedade } from "@/types/game";
import { getPropData, groupByColor, sortPropItems } from "@/utils/properties";
import type { PropItem } from "@/utils/properties";
import PropertyDetailModal from "../PropertyDetailModal";
import ConfirmationModal from "../ConfirmationModal";
import Modal from "../Modal";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/utils/format";
import UserAvatar from "@/components/UserAvatar";
import UserBanner from "@/components/UserBanner";
import UserBadge from "@/components/UserBadge";
import {
  Eye,
  EyeOff,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  Receipt,
  ShoppingBag,
  Shuffle,
  Shield,
  PartyPopper,
  Frown,
  Handshake,
  Banknote,
  Home,
  Check,
  LoaderCircle,
  Plus,
  Minus,
} from "lucide-react";

interface InicioProps {
  isOwner: boolean;
  onNavigate?: (tab: string) => void;
}

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
};

function getAccentHex(grupoCor: string | null): string {
  if (!grupoCor) return "#52525b";
  const found = PROPERTY_COLORS.find((c) => c.value === grupoCor);
  if (!found) return COLOR_HEX[grupoCor] ?? "#52525b";
  const match = found.bg?.match(/bg-(\w+)/);
  if (match) return COLOR_HEX[match[1]] ?? "#52525b";
  return "#52525b";
}

const COLOR_LABELS: Record<string, string> = {}
for (const c of PROPERTY_COLORS) COLOR_LABELS[c.value] = c.label

type ModalType = "deposito" | "saque" | "transferencia" | "aluguel" | "casas" | "venderCasas" | null;

const QUICK_VALUES = [100, 500, 2000, 5000, 10000, 50000, 100000];

function ValorInput({ value, onChange, max }: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {QUICK_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            disabled={max !== undefined && v > max}
            className="px-3 py-1.5 text-xs font-inconsolata rounded-lg border border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700 hover:border-zinc-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            R$ {formatCurrency(v)}
          </button>
        ))}
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-inconsolata text-sm">R$</span>
        <input
          type="text"
          inputMode="numeric"
          maxLength={7}
          value={String(value)}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/\D/g, "").slice(0, 7);
            onChange(cleaned ? Number(cleaned) : 0);
          }}
          placeholder="0"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 pl-10 pr-4 text-zinc-100 font-inconsolata text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
        />
      </div>
    </div>
  )
}

function PlayerCard({ player, selected, onClick }: { player: Player; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border transition-all cursor-pointer text-left ${
        selected ? "border-green-500" : "border-zinc-700 hover:border-zinc-500"
      }`}
    >
      <UserBanner banner={player.banner} spriteId={player.spriteId} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-black/60 z-1" />
      <div className="relative z-20 flex items-center gap-3 p-3">
        <UserAvatar avatarUrl={player.avatarUrl} avatarUpdatedAt={player.avatarUpdatedAt} nome={player.nome} size="sm" ring={selected} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-inconsolata text-zinc-100 truncate">{player.nome}</p>
            <UserBadge badge={player.badge} variant="small" />
          </div>
          <p className="text-xs font-inconsolata text-zinc-400">R$ {formatCurrency(player.saldo)}</p>
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">✓</span>
          </div>
        )}
      </div>
    </button>
  )
}

function PropertyCard({ item, selected, onClick, getAluguel }: { item: { sessionProp: SessionPropriedade; prop: Propriedade }; selected: boolean; onClick: () => void; getAluguel: (prop: Propriedade, casas: number) => number }) {
  const accent = getAccentHex(item.prop.grupo_cor)
  const casas = item.sessionProp.casas ?? 0
  const aluguelValor = getAluguel(item.prop, casas)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border overflow-hidden transition-all cursor-pointer text-left ${
        selected
          ? "border-amber-400 bg-amber-500/5"
          : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-500"
      }`}
    >
      <div className="h-1 w-full" style={{ backgroundColor: accent }} />
      <div className="p-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-inconsolata text-zinc-200 truncate">{item.prop.nome}</span>
          <span className="shrink-0 text-[10px] font-inconsolata px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400">
            {item.prop.grupo_cor}
          </span>
        </div>
        <div className="flex items-center gap-1 mb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-sm ${i < casas ? "opacity-100" : "opacity-20"}`} style={{ backgroundColor: accent }} />
          ))}
        </div>
        <div className="flex justify-between text-xs font-inconsolata text-zinc-400">
          <span>🏠 {casas}/{5}</span>
          <span className="text-green-400">R$ {formatCurrency(aluguelValor)}</span>
        </div>
      </div>
    </button>
  )
}

export default function Inicio({ isOwner, onNavigate }: InicioProps) {
  const { success: toastSuccess, error: toastError, warning: toastWarning, info: toastInfo } = useToast()
  const { currentSession, loadSession, getAluguel, deposito, saque, transferencia, aluguel, aluguelAcao, sortearCarta, usarCartaPrisao, pagarDivida, buyHousesBatch, sellHousesBatch } = useGameStore();
  const { user: authUser } = useAuthStore();
  const { pendentes, setActive, minhaNegociacaoPendente, setMinhaNegociacaoAberto } = useNegotiationStore();

  const [showSaldo, setShowSaldo] = useState(true);
  const [selectedSessionPropId, setSelectedSessionPropId] = useState<number | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [valor, setValor] = useState(0);
  const [selectedRecipient, setSelectedRecipient] = useState<number | null>(null);
  const [selectedRentProp, setSelectedRentProp] = useState<number | null>(null);
  const [numDados, setNumDados] = useState(0);
  const [reqLoading, setReqLoading] = useState(false);

  const [cardResult, setCardResult] = useState<{
    tipoBaralho: "sorte" | "reves";
    carta: SorteRevesCard;
    effectDescription: string;
  } | null>(null);
  const [drawingCard, setDrawingCard] = useState(false);
  const [confirmSortearOpen, setConfirmSortearOpen] = useState(false);

  const currentPlayer = currentSession?.jogadores?.find(
    (p) => p.userId === authUser?.id
  );
  const isSpectator = !!currentPlayer?.desistiu;

  const myProps: PropItem[] = useMemo(() => {
    if (!currentSession || !currentPlayer) return [];
    return currentSession.sessionPosses
      .filter((sp) => sp.playerId === currentPlayer.id)
      .map((sp) => ({ prop: getPropData(sp), sessionProp: sp }))
      .filter((item): item is PropItem => item.prop !== null);
  }, [currentSession, currentPlayer]);

  const propertyGroups = useMemo(() => groupByColor(myProps), [myProps]);

  const selectedProp = useMemo<PropItem | null>(() => {
    if (!selectedSessionPropId || !currentSession) return null;
    const sessionProp = currentSession.sessionPosses.find(sp => sp.id === selectedSessionPropId);
    if (!sessionProp) return null;
    const prop = getPropData(sessionProp);
    if (!prop) return null;
    return { prop, sessionProp };
  }, [selectedSessionPropId, currentSession?.sessionPosses]);

  const patrimonio = useMemo(() => {
    if (!currentPlayer) return 0;
    let total = currentPlayer.saldo;
    for (const { prop, sessionProp } of myProps) {
      if (sessionProp.hipotecada) {
        total += prop.hipoteca;
      } else {
        total += prop.custo_compra;
        total += sessionProp.casas * prop.custo_casa;
      }
    }
    return total;
  }, [currentPlayer, myProps]);

  const jogadores = useMemo(() => currentSession?.jogadores ?? [], [currentSession?.jogadores])

  const rentableProps = useMemo(() => {
    if (!currentSession) return []
    return sortPropItems(
      currentSession.sessionPosses
        .filter((p) => !!p.playerId && p.playerId !== currentPlayer?.id)
        .map(sp => ({ sessionProp: sp, prop: getPropData(sp) }))
        .filter((item): item is { sessionProp: typeof item.sessionProp; prop: NonNullable<ReturnType<typeof getPropData>> } => item.prop !== null)
    )
  }, [currentSession, currentPlayer?.id])

  const selectedRentData = useMemo(() => {
    if (!selectedRentProp || !currentSession) return null
    const sp = currentSession.sessionPosses.find(p => p.id === selectedRentProp)
    if (!sp) return null
    const prop = getPropData(sp)
    if (!prop) return null
    return { sessionProp: sp, prop }
  }, [selectedRentProp, currentSession?.sessionPosses])

  const myDebts = useMemo(
    () => (currentSession?.debts ?? []).filter((d) => d.playerId === currentPlayer?.id && !d.pago),
    [currentSession?.debts, currentPlayer?.id]
  )

  const [selectedBatchProps, setSelectedBatchProps] = useState<number[]>([])

  const completedColorGroups = useMemo(() => {
    const totalPorCor = Object.fromEntries(PROPERTY_COLORS.map((c) => [c.value, c.total]))
    return propertyGroups.filter((g) => g.items.length === (totalPorCor[g.cor] ?? 0))
  }, [propertyGroups])

  function toggleBatchProp(sessionPossesId: number) {
    setSelectedBatchProps((prev) =>
      prev.includes(sessionPossesId) ? prev.filter((id) => id !== sessionPossesId) : [...prev, sessionPossesId]
    )
  }

  const [sellQuantities, setSellQuantities] = useState<Record<number, number>>({})

  function setSellQty(sessionPossesId: number, qty: number) {
    setSellQuantities((prev) => ({ ...prev, [sessionPossesId]: Math.max(0, qty) }))
  }

  const handleActionSuccess = useCallback(() => {
    const session = useGameStore.getState().currentSession;
    if (session) {
      loadSession(session.id);
    }
  }, [loadSession]);

  function closeModal() {
    setActiveModal(null)
    setValor(0)
    setSelectedRecipient(null)
    setSelectedRentProp(null)
    setNumDados(0)
    setSelectedBatchProps([])
    setSellQuantities({})
  }

  async function handleBatchBuy() {
    if (!currentPlayer || !currentSession || selectedBatchProps.length === 0) return
    setReqLoading(true)
    try {
      await buyHousesBatch({ userId: currentPlayer.id, sessionId: currentSession.id, sessaoPossesIds: selectedBatchProps })
      await loadSession(currentSession.id)
      setSelectedBatchProps([])
      closeModal()
      toastSuccess(`${selectedBatchProps.length} casa(s) comprada(s) com sucesso!`)
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao comprar casas"
      if (err?.response?.status >= 500) { toastError(msg) } else { toastWarning(msg) }
    } finally {
      setReqLoading(false)
    }
  }

  async function handleBatchSell() {
    if (!currentPlayer || !currentSession) return
    const items = Object.entries(sellQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ sessaoPossesId: Number(id), quantidade: qty }))
    if (!items.length) return
    setReqLoading(true)
    try {
      await sellHousesBatch({ userId: currentPlayer.id, sessionId: currentSession.id, items })
      await loadSession(currentSession.id)
      setSellQuantities({})
      closeModal()
      toastSuccess(`${items.length} propriedade(s) atualizada(s) com sucesso!`)
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao vender casas"
      if (err?.response?.status >= 500) { toastError(msg) } else { toastWarning(msg) }
    } finally {
      setReqLoading(false)
    }
  }

  async function handleDeposito() {
    if (!currentPlayer || valor <= 0) return toastWarning("Valor inválido!")
    if (!currentSession) return
    if (valor >= 10000000) return toastWarning("Valor muito alto!")
    setReqLoading(true)
    try {
      await deposito({ userId: currentPlayer.id, sessionId: currentSession.id, valor })
      await loadSession(currentSession.id)
      toastSuccess("Depósito realizado!")
      closeModal()
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro no depósito"
      if (err?.response?.status >= 500) { toastError(msg) } else { toastWarning(msg) }
      closeModal()
    } finally {
      setReqLoading(false)
    }
  }

  async function handleSaque() {
    if (!currentPlayer || valor <= 0) return toastWarning("Valor inválido!")
    if (!currentSession) return
    if (currentPlayer.saldo < valor) return toastWarning("Saldo insuficiente!")
    setReqLoading(true)
    try {
      await saque({ userId: currentPlayer.id, sessionId: currentSession.id, valor })
      await loadSession(currentSession.id)
      toastSuccess("Saque realizado!")
      closeModal()
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro no saque"
      if (err?.response?.status >= 500) { toastError(msg) } else { toastWarning(msg) }
      closeModal()
    } finally {
      setReqLoading(false)
    }
  }

  async function handleTransferencia() {
    if (!currentPlayer || selectedRecipient == null || valor <= 0) return toastWarning("Campos inválidos!")
    if (!currentSession) return
    if (currentPlayer.saldo < valor) return toastWarning("Saldo insuficiente!")
    if (currentPlayer.id === selectedRecipient) return toastWarning("Não pode transferir para si mesmo!")
    setReqLoading(true)
    try {
      await transferencia({ pagadorId: currentPlayer.id, recebedorId: selectedRecipient, sessionId: currentSession.id, valor })
      await loadSession(currentSession.id)
      toastInfo("Transferência realizada!")
      closeModal()
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro na transferência"
      if (err?.response?.status >= 500) { toastError(msg) } else { toastWarning(msg) }
      closeModal()
    } finally {
      setReqLoading(false)
    }
  }

  async function handleAluguel() {
    if (!currentPlayer || !selectedRentProp) return toastWarning("Selecione uma propriedade!")
    if (!currentSession) return
    setReqLoading(true)
    try {
      if (selectedRentData?.prop.tipo === "ação") {
        await aluguelAcao({ sessionId: currentSession.id, pagadorId: currentPlayer.id, sessionPossesId: selectedRentProp, numDados })
      } else {
        await aluguel({ sessionId: currentSession.id, pagadorId: currentPlayer.id, sessionPossesId: selectedRentProp })
      }
      await loadSession(currentSession.id)
      toastError("Aluguel pago!")
      closeModal()
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao pagar aluguel"
      if (err?.response?.status >= 500) { toastError(msg) } else { toastWarning(msg) }
      closeModal()
    } finally {
      setReqLoading(false)
    }
  }

  async function handleSortearConfirmado() {
    if (!currentPlayer || !currentSession) return
    setConfirmSortearOpen(false)
    setDrawingCard(true)
    try {
      const result = await sortearCarta(currentSession.id, currentPlayer.id)
      if (result) {
        setCardResult(result)
        await loadSession(currentSession.id)
        toastInfo("Carta sorteada!")
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao sortear carta"
      if (err?.response?.status >= 500) { toastError(msg) } else { toastWarning(msg) }
    } finally {
      setDrawingCard(false)
    }
  }

  async function handleUsarCartaPrisao() {
    if (!currentPlayer || !currentSession) return
    setReqLoading(true)
    try {
      await usarCartaPrisao(currentSession.id, currentPlayer.id)
      await loadSession(currentSession.id)
      toastSuccess("Carta 'Saia da Prisão' usada!")
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao usar carta prisão"
      if (err?.response?.status >= 500) { toastError(msg) } else { toastWarning(msg) }
    } finally {
      setReqLoading(false)
    }
  }

  async function handlePagarDivida(debtId: number, valor: number) {
    if (!currentPlayer || !currentSession) return
    if (currentPlayer.saldo < valor) return toastWarning("Saldo insuficiente para pagar esta dívida!")
    setReqLoading(true)
    try {
      await pagarDivida(debtId, currentPlayer.id, currentSession.id)
      await loadSession(currentSession.id)
      toastInfo(`Dívida de R$ ${formatCurrency(valor)} paga!`)
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao pagar dívida"
      if (err?.response?.status >= 500) { toastError(msg) } else { toastWarning(msg) }
    } finally {
      setReqLoading(false)
    }
  }

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-10">
      {/* ── Balance Widget ── */}
      <div className="relative overflow-hidden border border-zinc-800 rounded-xl">
        <UserBanner banner={currentPlayer?.banner} spriteId={currentPlayer?.spriteId} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <UserAvatar
                avatarUrl={currentPlayer?.avatarUrl}
                avatarUpdatedAt={currentPlayer?.avatarUpdatedAt}
                nome={currentPlayer?.nome || "?"}
                size="sm"
                ring
              />
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-inconsolata text-zinc-300">
                  {currentPlayer?.nome || "Você"}
                </p>
                <UserBadge badge={currentPlayer?.badge} />
              </div>
            </div>
            <button onClick={() => setShowSaldo(!showSaldo)} className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
              {showSaldo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-3xl font-jaro font-bold text-green-400 mb-4">
            {showSaldo ? `R$ ${formatCurrency(currentPlayer?.saldo ?? 0)}` : "R$ •••••"}
          </p>
          <div className="border-t border-white/10 pt-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-inconsolata text-zinc-400">Patrimônio Total</span>
              <span className="text-lg font-jaro text-zinc-100">R$ {formatCurrency(patrimonio)}</span>
            </div>
          </div>
        </div>
      </div>

      {!isSpectator && (
        <div className="space-y-5">
          {/* Transações Bancárias */}
          <div>
            <h4 className="text-xs font-inconsolata text-zinc-600 uppercase tracking-wider mb-2.5">Transações Bancárias</h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: ArrowDownToLine, label: "Depositar", modal: "deposito" as const, color: "text-green-400 bg-green-500/10" },
                { icon: ArrowUpFromLine, label: "Sacar", modal: "saque" as const, color: "text-red-400 bg-red-500/10" },
                { icon: ArrowRightLeft, label: "Transferir", modal: "transferencia" as const, color: "text-sky-400 bg-sky-500/10" },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => setActiveModal(action.modal)}
                  className="flex flex-col items-center gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${action.color}`}>
                    <action.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-inconsolata text-zinc-400 text-center leading-tight">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Propriedades */}
          <div>
            <h4 className="text-xs font-inconsolata text-zinc-600 uppercase tracking-wider mb-2.5">Propriedades</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Home, label: "Comprar Casas", modal: "casas" as const, color: "text-teal-400 bg-teal-500/10" },
                { icon: Banknote, label: "Vender Casas", modal: "venderCasas" as const, color: "text-orange-400 bg-orange-500/10" },
                { icon: Receipt, label: "Pagar Aluguel", modal: "aluguel" as const, color: "text-amber-400 bg-amber-500/10" }
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => setActiveModal(action.modal)}
                  className="flex flex-col items-center gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${action.color}`}>
                    <action.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-inconsolata text-zinc-400 text-center leading-tight">
                    {action.label}
                  </span>
                </button>
              ))}
              <button
                onClick={() => onNavigate?.("Loja")}
                className="flex flex-col items-center gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-purple-400 bg-purple-500/10">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <span className="text-xs font-inconsolata text-zinc-400 text-center leading-tight">Loja</span>
              </button>
            </div>
          </div>

          {/* Jogo */}
          <div>
            <h4 className="text-xs font-inconsolata text-zinc-600 uppercase tracking-wider mb-2.5">Jogo</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => setConfirmSortearOpen(true)}
                disabled={drawingCard || !currentPlayer}
                className="flex flex-col items-center gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-yellow-400 bg-yellow-500/10">
                  <Shuffle className="w-5 h-5" />
                </div>
                <span className="text-xs font-inconsolata text-zinc-400 text-center leading-tight">Sortear</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cartas Especiais ── */}
      <div>
        <h2 className="text-xl font-jaro text-zinc-100 mb-4">Cartas Especiais</h2>
        {currentPlayer?.carta_prisao ? (
          <div className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-inconsolata text-zinc-200">Saia da Prisão</p>
                <p className="text-xs font-inconsolata text-zinc-500">Clique em "Usar" para consumir</p>
              </div>
            </div>
            <button
              onClick={handleUsarCartaPrisao}
              disabled={reqLoading}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 text-white text-sm font-inconsolata rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              Usar
            </button>
          </div>
        ) : (
          <p className="text-sm font-inconsolata text-zinc-500 italic">Sem cartas especiais.</p>
        )}
      </div>

      {/* ── Dívidas Pendentes ── */}
      {myDebts.length > 0 && (
        <div>
          <h2 className="text-xl font-jaro text-zinc-100 mb-4 flex items-center gap-2">
            Dívidas Pendentes
            <span className="text-sm font-inconsolata bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
              {myDebts.length}
            </span>
          </h2>
          <div className="space-y-3">
            {myDebts.map((debt) => (
              <div
                key={debt.id}
                className="flex items-center justify-between p-4 bg-zinc-900 border border-red-800/40 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                    <span className="text-lg">💰</span>
                  </div>
                  <div>
                    <p className="text-sm font-inconsolata text-zinc-200">
                      R$ {formatCurrency(debt.valor)}
                    </p>
                    <p className="text-xs font-inconsolata text-zinc-500 line-clamp-1">
                      {debt.descricao}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handlePagarDivida(debt.id, debt.valor)}
                  disabled={reqLoading || currentPlayer!.saldo < debt.valor}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-inconsolata rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
                >
                  {reqLoading ? "..." : `Pagar R$ ${formatCurrency(debt.valor)}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Negociações ── */}
      {(pendentes.length > 0 || minhaNegociacaoPendente) && (
        <div>
          <h2 className="text-xl font-jaro text-zinc-100 mb-4 flex items-center gap-2">
            Negociações Pendentes
            <span className="text-sm font-inconsolata bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
              {pendentes.length + (minhaNegociacaoPendente ? 1 : 0)}
            </span>
          </h2>
          <div className="space-y-3">
            {/* Proposta enviada pelo proponente */}
            {minhaNegociacaoPendente && (
              <button
                onClick={() => setMinhaNegociacaoAberto(true)}
                className="w-full flex items-center justify-between p-4 bg-zinc-900 border border-amber-500/40 rounded-xl hover:border-amber-400 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Handshake className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-inconsolata text-zinc-200">
                      Proposta enviada para{" "}
                      <span className="text-amber-400 font-semibold">
                        {currentSession?.jogadores.find((p) => p.id === minhaNegociacaoPendente.toPlayerId)?.nome ?? "—"}
                      </span>
                    </p>
                    <p className="text-xs font-inconsolata text-zinc-500">
                      {minhaNegociacaoPendente.items.length} item(ns) · Aguardando resposta…
                    </p>
                  </div>
                </div>
                <span className="text-xs font-inconsolata text-amber-400 shrink-0">
                  Ver proposta →
                </span>
              </button>
            )}
            {/* Propostas recebidas */}
            {pendentes.map((n) => (
              <button
                key={n.id}
                onClick={() => setActive(n)}
                className="w-full flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-purple-500 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Handshake className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-inconsolata text-zinc-200">
                      Oferta de <span className="text-purple-400 font-semibold">{n.fromPlayer?.nome ?? "—"}</span>
                    </p>
                    <p className="text-xs font-inconsolata text-zinc-500">
                      {n.items.length} item(ns) · {new Date(n.createdAt).toLocaleTimeString("pt-BR")}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-inconsolata text-purple-400 shrink-0">
                  Ver detalhes →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── My Properties ── */}
      <div>
        <h2 className="text-xl font-jaro text-zinc-100 mb-4">
          Minhas Propriedades
          <span className="ml-2 text-sm font-inconsolata text-zinc-500">({myProps.length})</span>
        </h2>
        {propertyGroups.length === 0 ? (
          <p className="text-sm font-inconsolata text-zinc-500 italic">Nenhuma propriedade ainda. Vá até a Loja para comprar!</p>
        ) : (
          <div className="space-y-8">
            {propertyGroups.map((group) => (
              <div key={group.cor}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getAccentHex(group.cor) }} />
                  <h3 className="text-sm font-jaro text-zinc-300 uppercase tracking-wide">
                    {COLOR_LABELS[group.cor] || group.cor}
                    <span className="ml-2 text-xs font-inconsolata text-zinc-500">({group.items.length})</span>
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {group.items.map(({ prop, sessionProp }) => {
                    const accent = getAccentHex(prop.grupo_cor);
                    const isHipotecada = sessionProp.hipotecada;
                    return (
                      <button
                        key={sessionProp.id}
                        onClick={() => setSelectedSessionPropId(sessionProp.id)}
                        className="relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden text-left hover:border-zinc-600 transition-colors cursor-pointer"
                      >
                        <div className="h-1 w-full shrink-0" style={{ backgroundColor: accent }} />
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="text-zinc-100 font-inconsolata text-sm leading-snug line-clamp-2">{prop.nome}</span>
                            {isHipotecada && (
                              <span className="shrink-0 text-[10px] font-inconsolata font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Hipotecada</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mb-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div key={i} className={`w-2 h-2 rounded-sm ${i < sessionProp.casas ? "opacity-100" : "opacity-20"}`} style={{ backgroundColor: accent }} />
                            ))}
                          </div>
                          <p className="text-lg font-jaro font-semibold mt-2" style={{ color: accent }}>
                            R$ {formatCurrency(getAluguel(prop, sessionProp.casas))}
                          </p>
                          <p className="text-[10px] font-inconsolata text-zinc-500 uppercase tracking-wide">Aluguel Atual</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════
         MODAIS
         ════════════════════════════════════════════════ */}

      {/* ── Depósito ── */}
      <Modal size="md" title="Depositar" isOpen={activeModal === "deposito"} onClose={closeModal}>
        <div className="space-y-5">
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <span className="text-sm font-inconsolata text-zinc-400">Jogador</span>
            <span className="text-sm font-inconsolata text-zinc-100 font-semibold">{currentPlayer?.nome ?? "—"}</span>
          </div>
          <ValorInput value={valor} onChange={setValor} />
          <div className="flex justify-between items-center text-sm font-inconsolata text-zinc-500">
            <span>Saldo atual:</span>
            <span className={currentPlayer ? "text-zinc-100" : ""}>R$ {formatCurrency(currentPlayer?.saldo ?? 0)}</span>
          </div>
          <button
            onClick={handleDeposito}
            disabled={reqLoading || !currentPlayer || valor <= 0}
            className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-jaro rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {reqLoading ? "Depositando..." : "Confirmar Depósito"}
          </button>
        </div>
      </Modal>

      {/* ── Saque ── */}
      <Modal size="md" title="Sacar" isOpen={activeModal === "saque"} onClose={closeModal}>
        <div className="space-y-5">
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <span className="text-sm font-inconsolata text-zinc-400">Jogador</span>
            <span className="text-sm font-inconsolata text-zinc-100 font-semibold">{currentPlayer?.nome ?? "—"}</span>
          </div>
          <ValorInput value={valor} onChange={setValor} max={currentPlayer?.saldo} />
          <div className="flex justify-between items-center text-sm font-inconsolata text-zinc-500">
            <span>Saldo atual:</span>
            <span className={currentPlayer ? "text-zinc-100" : ""}>R$ {formatCurrency(currentPlayer?.saldo ?? 0)}</span>
          </div>
          <button
            onClick={handleSaque}
            disabled={reqLoading || !currentPlayer || valor <= 0}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-jaro rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {reqLoading ? "Sacando..." : "Confirmar Saque"}
          </button>
        </div>
      </Modal>

      {/* ── Transferência ── */}
      <Modal size="md" title="Transferir Dinheiro" isOpen={activeModal === "transferencia"} onClose={closeModal}>
        <div className="space-y-5">
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <span className="text-sm font-inconsolata text-zinc-400">Pagador</span>
            <span className="text-sm font-inconsolata text-zinc-100 font-semibold">{currentPlayer?.nome ?? "—"}</span>
          </div>

          <div>
            <p className="text-sm font-inconsolata text-zinc-400 mb-2">Recebedor</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {jogadores
                .filter((p) => p.id !== currentPlayer?.id)
                .map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    selected={selectedRecipient === player.id}
                    onClick={() => setSelectedRecipient(player.id)}
                  />
                ))}
              {jogadores.filter((p) => p.id !== currentPlayer?.id).length === 0 && (
                <p className="text-sm font-inconsolata text-zinc-500 col-span-2">Nenhum outro jogador na sala.</p>
              )}
            </div>
          </div>

          <ValorInput value={valor} onChange={setValor} max={currentPlayer?.saldo} />

          <div className="flex justify-between items-center text-sm font-inconsolata text-zinc-500">
            <span>Saldo atual:</span>
            <span className={currentPlayer ? "text-zinc-100" : ""}>R$ {formatCurrency(currentPlayer?.saldo ?? 0)}</span>
          </div>

          <button
            onClick={handleTransferencia}
            disabled={reqLoading || !currentPlayer || selectedRecipient == null || valor <= 0}
            className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-jaro rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {reqLoading ? "Transferindo..." : "Confirmar Transferência"}
          </button>
        </div>
      </Modal>

      {/* ── Pagar Aluguel ── */}
      <Modal size="md" title="Pagar Aluguel" isOpen={activeModal === "aluguel"} onClose={closeModal}>
        <div className="space-y-5">
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <span className="text-sm font-inconsolata text-zinc-400">Pagador</span>
            <span className="text-sm font-inconsolata text-zinc-100 font-semibold">{currentPlayer?.nome ?? "—"}</span>
          </div>

          <div>
            <p className="text-sm font-inconsolata text-zinc-400 mb-2">Propriedade onde caiu</p>
            {rentableProps.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {rentableProps.map((item) => (
                  <PropertyCard
                    key={item.sessionProp.id}
                    item={item}
                    selected={selectedRentProp === item.sessionProp.id}
                    onClick={() => {
                      setSelectedRentProp(item.sessionProp.id)
                      setNumDados(0)
                    }}
                    getAluguel={getAluguel}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm font-inconsolata text-zinc-500">Nenhuma propriedade para pagar aluguel no momento.</p>
            )}
          </div>

          {selectedRentData?.prop.tipo === "ação" && (
            <div>
              <p className="text-sm font-inconsolata text-zinc-400 mb-2">Número tirado nos dados</p>
              <input
                type="text"
                inputMode="numeric"
                value={String(numDados)}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, "");
                  setNumDados(cleaned ? Number(cleaned) : 0);
                }}
                placeholder="0"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-3 px-4 text-zinc-100 font-inconsolata text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
          )}

          {selectedRentData && (
            <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-inconsolata text-zinc-200">{selectedRentData.prop.nome}</p>
                  <p className="text-xs font-inconsolata text-zinc-500">
                    {selectedRentData.prop.grupo_cor} · {selectedRentData.sessionProp.casas} casa(s)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-inconsolata text-zinc-500">Aluguel</p>
                  <p className="text-lg font-jaro font-semibold" style={{ color: getAccentHex(selectedRentData.prop.grupo_cor) }}>
                    R$ {formatCurrency(getAluguel(selectedRentData.prop, selectedRentData.sessionProp.casas))}
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleAluguel}
            disabled={reqLoading || !currentPlayer || !selectedRentProp}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-jaro rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {reqLoading ? "Pagando..." : "Confirmar Pagamento"}
          </button>
        </div>
      </Modal>

      {/* ── Comprar Casas em Lote ── */}
      <Modal size="lg" title="Comprar Casas" isOpen={activeModal === "casas"} onClose={() => { setActiveModal(null); setSelectedBatchProps([]) }}>
        <div className="space-y-6">
          {completedColorGroups.length === 0 ? (
            <p className="text-sm font-inconsolata text-zinc-500 italic text-center py-8">
              Você precisa ter um grupo de cor completo para comprar casas.
            </p>
          ) : (
            completedColorGroups.map((group) => {
              const accent = getAccentHex(group.cor)
              return (
                <div key={group.cor}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
                    <h3 className="text-sm font-jaro text-zinc-300 uppercase tracking-wide">
                      {COLOR_LABELS[group.cor] || group.cor}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {group.items.map(({ prop, sessionProp }) => {
                      const isMax = sessionProp.casas >= 5
                      const selected = selectedBatchProps.includes(sessionProp.id)
                      return (
                        <button
                          key={sessionProp.id}
                          type="button"
                          onClick={() => !isMax && toggleBatchProp(sessionProp.id)}
                          disabled={isMax}
                          className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer ${
                            isMax
                              ? "border-zinc-700/50 bg-zinc-800/30 opacity-50 cursor-not-allowed"
                              : selected
                                ? "border-teal-500 bg-teal-500/10 shadow-[0_0_12px_rgba(20,184,166,0.15)]"
                                : "border-zinc-700 bg-zinc-800/60 hover:border-zinc-500"
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                              isMax
                                ? "border-zinc-600 bg-zinc-700/50"
                                : selected
                                  ? "border-teal-400 bg-teal-500"
                                  : "border-zinc-600 bg-zinc-800"
                            }`}
                          >
                            {isMax ? (
                              <span className="text-[10px] font-inconsolata text-zinc-500">5</span>
                            ) : selected ? (
                              <Check className="w-4 h-4 text-white" />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-inconsolata text-zinc-200 truncate">{prop.nome}</p>
                            <p className="text-xs font-inconsolata text-zinc-500">
                              {sessionProp.casas}/5 casas · R$ {formatCurrency(prop.custo_casa)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-2 h-2 rounded-sm ${i < sessionProp.casas ? "" : "opacity-20"}`}
                                style={{ backgroundColor: i < sessionProp.casas ? accent : "#52525b" }}
                              />
                            ))}
                          </div>
                          {isMax && (
                            <span className="absolute -top-1.5 -right-1.5 text-[10px] font-inconsolata bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full">
                              Máximo
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}

          {completedColorGroups.length > 0 && (
            <div className="border-t border-zinc-800 pt-4 space-y-4">
              <div className="flex items-center justify-between text-sm font-inconsolata">
                <span className="text-zinc-400">
                  {selectedBatchProps.length} propriedade{selectedBatchProps.length !== 1 ? "s" : ""} selecionada{selectedBatchProps.length !== 1 ? "s" : ""}
                </span>
                <span className="text-lg font-jaro text-teal-400">
                  R$ {formatCurrency(
                    completedColorGroups
                      .flatMap((g) => g.items)
                      .filter((item) => selectedBatchProps.includes(item.sessionProp.id))
                      .reduce((sum, item) => sum + item.prop.custo_casa, 0)
                  )}
                </span>
              </div>
              <button
                onClick={handleBatchBuy}
                disabled={reqLoading || selectedBatchProps.length === 0}
                className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-jaro rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {reqLoading ? (
                  <><LoaderCircle className="w-5 h-5 animate-spin" /> Comprando...</>
                ) : (
                  "Confirmar Compra"
                )}
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Vender Casas em Lote ── */}
      <Modal size="lg" title="Vender Casas" isOpen={activeModal === "venderCasas"} onClose={() => { setActiveModal(null); setSellQuantities({}) }}>
        <div className="space-y-6">
          {myProps.length === 0 ? (
            <p className="text-sm font-inconsolata text-zinc-500 italic text-center py-8">
              Nenhuma propriedade com casas para vender.
            </p>
          ) : (
            propertyGroups.map((group) => {
              const propsComCasas = group.items.filter((item) => item.sessionProp.casas > 0)
              if (!propsComCasas.length) return null
              const accent = getAccentHex(group.cor)
              return (
                <div key={group.cor}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
                    <h3 className="text-sm font-jaro text-zinc-300 uppercase tracking-wide">
                      {COLOR_LABELS[group.cor] || group.cor}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {propsComCasas.map(({ prop, sessionProp }) => {
                      const qty = sellQuantities[sessionProp.id] ?? 0
                      return (
                        <div
                          key={sessionProp.id}
                          className="flex items-center gap-3 p-3 bg-zinc-800/60 border border-zinc-700 rounded-xl"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-inconsolata text-zinc-200 truncate">{prop.nome}</p>
                            <p className="text-xs font-inconsolata text-zinc-500">
                              {sessionProp.casas} casa{sessionProp.casas !== 1 ? "s" : ""} · R$ {formatCurrency(prop.custo_casa)} cada
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSellQty(sessionProp.id, qty - 1)}
                              disabled={qty <= 0}
                              className="w-8 h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-zinc-200 cursor-pointer transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center text-sm font-jaro text-orange-400">{qty}</span>
                            <button
                              type="button"
                              onClick={() => setSellQty(sessionProp.id, qty + 1)}
                              disabled={qty >= sessionProp.casas}
                              className="w-8 h-8 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-zinc-200 cursor-pointer transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}

          {Object.values(sellQuantities).some((q) => q > 0) && (
            <div className="border-t border-zinc-800 pt-4 space-y-4">
              <div className="flex items-center justify-between text-sm font-inconsolata">
                <span className="text-zinc-400">
                  Total a receber
                </span>
                <span className="text-lg font-jaro text-green-400">
                  R$ {formatCurrency(
                    Object.entries(sellQuantities)
                      .filter(([, qty]) => qty > 0)
                      .reduce((sum, [id, qty]) => {
                        const prop = myProps.find((p) => p.sessionProp.id === Number(id))
                        return sum + (prop ? prop.prop.custo_casa * qty : 0)
                      }, 0)
                  )}
                </span>
              </div>
              <button
                onClick={handleBatchSell}
                disabled={reqLoading || !Object.values(sellQuantities).some((q) => q > 0)}
                className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white font-jaro rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {reqLoading ? (
                  <><LoaderCircle className="w-5 h-5 animate-spin" /> Vendendo...</>
                ) : (
                  "Confirmar Venda"
                )}
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Property Detail Modal */}
      {selectedProp && currentPlayer && currentSession && (
        <PropertyDetailModal
          key={selectedProp.sessionProp.id}
          isOpen={!!selectedProp}
          onClose={() => setSelectedSessionPropId(null)}
          propriedade={selectedProp.prop}
          sessionPropriedade={selectedProp.sessionProp}
          playerId={currentPlayer.id}
          sessionId={currentSession.id}
          playerSaldo={currentPlayer.saldo}
          podeVenderCasa={selectedProp.sessionProp.casas > 0 && !selectedProp.sessionProp.hipotecada}
          podeHipotecar={selectedProp.sessionProp.casas === 0 && !selectedProp.sessionProp.hipotecada}
          podeVender={selectedProp.sessionProp.casas === 0 && !selectedProp.sessionProp.hipotecada}
          onActionSuccess={handleActionSuccess}
        />
      )}

      {/* ── Confirmar Sorteio ── */}
      <ConfirmationModal
        isOpen={confirmSortearOpen}
        onClose={() => setConfirmSortearOpen(false)}
        onConfirm={handleSortearConfirmado}
        title="Sortear Carta"
        message="Tem certeza que deseja sortear uma carta de Sorte/Revés?"
        confirmText="Sim, Sortear!"
        color="purple"
      />

      {/* ── Modal Carta Sorteada ── */}
      <Modal
        size="sm"
        title={cardResult ? (cardResult.tipoBaralho === "sorte" ? "Sorte!" : "Revés!") : "Sorteando..."}
        isOpen={!!cardResult || drawingCard}
        onClose={() => { setCardResult(null); setDrawingCard(false) }}
      >
        {drawingCard && !cardResult ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center animate-glow">
              <Shuffle className="w-10 h-10 text-yellow-400 animate-shuffle" />
            </div>
            <p className="text-sm font-inconsolata text-zinc-400 animate-pulse">
              Sorteando carta...
            </p>
          </div>
        ) : cardResult && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              cardResult.tipoBaralho === "sorte"
                ? "bg-green-500/10"
                : "bg-red-500/10"
            }`}>
              {cardResult.tipoBaralho === "sorte" ? (
                <PartyPopper className="w-8 h-8 text-green-400" />
              ) : (
                <Frown className="w-8 h-8 text-red-400" />
              )}
            </div>
            <p className="text-lg font-jaro text-zinc-100 text-center">
              {cardResult.carta.texto}
            </p>
            <p className="text-sm font-inconsolata text-zinc-400 text-center">
              {cardResult.effectDescription}
            </p>
            <button
              onClick={() => setCardResult(null)}
              className="px-8 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-inconsolata rounded-lg transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}