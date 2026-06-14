"use client";

import { useState, useMemo } from "react";
import Modal from "../Modal";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { useNegotiationStore } from "@/stores/negotiationStore";
import { useToast } from "@/components/Toast";
import { Eye, Handshake, Building2, ArrowRight, ArrowLeft, Plus, Minus, Check } from "lucide-react";
import CoinIcon from "@/components/CoinIcon";
import UserAvatar from "@/components/UserAvatar";
import UserBadge from "@/components/UserBadge";
import UserBanner from "@/components/UserBanner";
import PlayerCard from "@/components/PlayerCard";
import { PROPERTY_COLORS } from "@/types/game";
import { criarNegociacaoApi } from "@/services/api/negotiations";
import { sortSessionPosses } from "@/utils/properties";
import { formatCurrency } from "@/utils/format";
import { toApiErr } from "@/lib/api-error";

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
  const found = PROPERTY_COLORS.find((c) => c.value === grupoCor)
  if (!found) return COLOR_HEX[grupoCor] ?? "#52525b"
  const match = found.bg?.match(/bg-(\w+)/)
  if (match) return COLOR_HEX[match[1]] ?? "#52525b"
  return "#52525b"
}

interface ItemInput {
  sessionPossesId?: number | null;
  fromSide: boolean;
  valor?: number | null;
}

export default function Especiais() {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast()
  const authUser = useAuthStore((s) => s.user)
  const { currentSession, loadSession, receberDeTodos } = useGameStore();
  const { pendentes, setMinhaNegociacao, setMinhaNegociacaoAberto, minhaNegociacaoPendente } = useNegotiationStore();

  const currentPlayer = useMemo(
    () => currentSession?.jogadores.find((p) => p.userId === authUser?.id) ?? null,
    [currentSession?.jogadores, authUser?.id]
  )
  const isSpectator = !!currentPlayer?.desistiu

  const [modalNegociar, setModalNegociar] = useState(false);
  const [modalReceber, setModalReceber] = useState(false);
  const [reqLoading, setReqLoading] = useState(false);

  // Create negotiation state
  const [targetPlayer, setTargetPlayer] = useState<number | null>(null);
  const [offerPropIds, setOfferPropIds] = useState<number[]>([]);
  const [offerMoney, setOfferMoney] = useState(0);
  const [wantPropIds, setWantPropIds] = useState<number[]>([]);
  const [wantMoney, setWantMoney] = useState(0);

  const jogadores = useMemo(() => currentSession?.jogadores ?? [], [currentSession?.jogadores])

  const mySessionPosses = useMemo(
    () => sortSessionPosses(
      currentSession?.sessionPosses
        .filter((p) => p.playerId === currentPlayer?.id && !p.hipotecada && !p.negociando) ?? []
    ),
    [currentSession?.sessionPosses, currentPlayer?.id]
  )

  const targetPlayerPosses = useMemo(() => {
    if (!targetPlayer || !currentSession) return [];
    return sortSessionPosses(
      currentSession.sessionPosses
        .filter((p) => p.playerId === targetPlayer && !p.hipotecada && !p.negociando)
    );
  }, [targetPlayer, currentSession])

  function resetCreate() {
    setTargetPlayer(null);
    setOfferPropIds([]);
    setOfferMoney(0);
    setWantPropIds([]);
    setWantMoney(0);
  }

  function toggleOfferProp(id: number) {
    setOfferPropIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleWantProp(id: number) {
    setWantPropIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCriarNegociacao() {
    if (!currentPlayer || !targetPlayer || !currentSession) return;
    if (offerPropIds.length === 0 && wantPropIds.length === 0 && offerMoney <= 0 && wantMoney <= 0) {
      return toastWarning("Adicione pelo menos um item à negociação!");
    }
    if (offerPropIds.length === 0 && wantPropIds.length === 0 && offerMoney === wantMoney) {
      return toastWarning("A negociação precisa ter pelo menos uma propriedade ou diferença de dinheiro!");
    }

      setReqLoading(true);
    try {
      const offerItems: ItemInput[] = [
        ...offerPropIds.map((id) => ({ sessionPossesId: id, fromSide: true })),
        ...(offerMoney > 0 ? [{ fromSide: true, valor: offerMoney } as ItemInput] : []),
      ];
      const wantItems: ItemInput[] = [
        ...wantPropIds.map((id) => ({ sessionPossesId: id, fromSide: false })),
        ...(wantMoney > 0 ? [{ fromSide: false, valor: wantMoney } as ItemInput] : []),
      ];

      const negotiation = await criarNegociacaoApi(currentSession.id, currentPlayer.id, targetPlayer, offerItems, wantItems);
      setMinhaNegociacao(negotiation);
      setMinhaNegociacaoAberto(true);
      await loadSession(currentSession.id);
      setModalNegociar(false);
      resetCreate();
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.message ?? "Erro ao criar negociação";
      if ((e?.response?.status ?? 0) >= 500) { toastError(msg) } else { toastWarning(msg) }
    } finally {
      setReqLoading(false);
    }
  }

  async function handleReceberDeTodos() {
    if (!currentPlayer) return toastWarning("Campos Vazios!");
    if (!currentSession) return;

    for (const player of jogadores) {
      if (player.id !== currentPlayer.id && player.saldo < 500) {
        return toastWarning(`O Jogador ${player.nome} não tem saldo suficiente!`)
      }
    }

    try {
      setReqLoading(true);
      await receberDeTodos({
        userId: currentPlayer.id,
        sessionId: currentSession.id,
      });
      await loadSession(currentSession.id);
      toastSuccess("Pagamentos recebidos com sucesso!");
      setModalReceber(false);
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.message ?? "Erro ao receber de todos!";
      if ((e?.response?.status ?? 0) >= 500) { toastError(msg) } else { toastWarning(msg) }
      setModalReceber(false);
    } finally {
      setReqLoading(false);
    }
  }

  return (
    <main className="w-full px-10">
      {isSpectator ? (
        <div className="text-center py-8">
          <Eye className="w-12 h-12 text-zinc-500 mx-auto mb-3" />
          <p className="text-zinc-400 font-inconsolata">Você é um espectador e não pode realizar negociações.</p>
        </div>
      ) : (
      <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => minhaNegociacaoPendente ? setMinhaNegociacaoAberto(true) : setModalNegociar(true)}
          className="w-full min-w-[200px] bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden hover:border-purple-500 transition-colors cursor-pointer relative"
        >
          {(pendentes.length > 0 || minhaNegociacaoPendente) && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center z-10">
              {pendentes.length + (minhaNegociacaoPendente ? 1 : 0)}
            </span>
          )}
          <div className="h-1.5 w-full bg-purple-500" />
          <div className="p-4 flex flex-col items-center gap-2">
            <Handshake className="w-8 h-8 text-purple-500" />
            <span className="text-zinc-100 font-jaro text-lg">Negociar</span>
            <span className="text-zinc-500 text-xs font-inconsolata text-center">
              Negocie propriedades entre jogadores
            </span>
          </div>
        </button>

        <button
          onClick={() => setModalReceber(true)}
          className="w-full min-w-[200px] bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden hover:border-pink-500 transition-colors cursor-pointer"
        >
          <div className="h-1.5 w-full bg-pink-500" />
          <div className="p-4 flex flex-col items-center gap-2">
            <CoinIcon size={32} className="text-pink-500" />
            <span className="text-zinc-100 font-jaro text-lg">Receber</span>
            <span className="text-zinc-500 text-xs font-inconsolata text-center">
              Receba R$ 500 de todos os jogadores
            </span>
          </div>
        </button>
      </nav>
      )}

      {/* Modal de Criação de Negociação */}
      <Modal
        size="lg"
        title="Nova Negociação"
        isOpen={modalNegociar}
        onClose={() => { setModalNegociar(false); resetCreate(); }}
      >
        <div className="relative overflow-hidden rounded-xl border border-zinc-700 mb-4">
          <UserBanner banner={currentPlayer?.banner} animated={currentPlayer?.bannerAnimated} className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(0deg,rgba(9,9,11,.85) 0%,transparent 60%)" }} />
          <div className="relative z-10 flex items-center gap-3 p-3">
            <UserAvatar
              avatarUrl={currentPlayer?.avatarUrl}
              avatarUpdatedAt={currentPlayer?.avatarUpdatedAt}
              nome={currentPlayer?.nome || "?"}
              size="sm"
              ring
              frame={currentPlayer?.frame}
              frameType={currentPlayer?.frameType}
              frameAnimated={currentPlayer?.frameAnimated}
              frameScale={currentPlayer?.frameScale ?? 145}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-inconsolata text-zinc-300">Proponente</p>
              <div className="text-sm font-inconsolata text-zinc-100 font-semibold truncate flex items-center gap-1.5">
                {currentPlayer && <UserBadge badge={currentPlayer.badge} imageUrl={currentPlayer.badgeImageUrl} variant="micro" />}
                {currentPlayer?.nome ?? "—"}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-inconsolata text-zinc-400">Saldo</p>
              <p className="text-sm font-inconsolata text-green-400">R$ {formatCurrency(currentPlayer?.saldo ?? 0)}</p>
            </div>
          </div>
        </div>

        {!targetPlayer ? (
          <div className="space-y-3 mb-4">
            <p className="text-sm font-inconsolata text-zinc-400 mb-2">Selecione o jogador alvo:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {jogadores
                .filter((p) => p.id !== currentPlayer?.id)
                .map((player) => {
                  const propCount = currentSession?.sessionPosses.filter(
                    (sp) => sp.playerId === player.id && !sp.hipotecada && !sp.negociando
                  ).length ?? 0;
                  return (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      propCount={propCount}
                      onClick={() => setTargetPlayer(player.id)}
                    />
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              const target = jogadores.find((p) => p.id === targetPlayer);
              return target ? (
                <div className="relative overflow-hidden rounded-xl border border-purple-500/40 mb-2">
                  <UserBanner banner={target.banner} animated={target.bannerAnimated} className="absolute inset-0 w-full h-full" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(0deg,rgba(9,9,11,.85) 0%,transparent 60%)" }} />
                  <div className="relative z-10 flex items-center gap-3 p-3">
                    <UserAvatar avatarUrl={target.avatarUrl} avatarUpdatedAt={target.avatarUpdatedAt} nome={target.nome} size="sm" frame={target.frame} frameType={target.frameType} frameAnimated={target.frameAnimated} frameScale={target.frameScale ?? 145} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-inconsolata text-zinc-300">Negociando com</p>
                      <div className="text-sm font-jaro text-purple-300 truncate flex items-center gap-1.5">
                        <UserBadge badge={target.badge} imageUrl={target.badgeImageUrl} variant="micro" />
                        {target.nome}
                      </div>
                    </div>
                    <button
                      onClick={() => setTargetPlayer(null)}
                      className="text-xs font-inconsolata text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      Trocar
                    </button>
                  </div>
                </div>
              ) : null;
            })()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* O que eu ofereço */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 border-b border-zinc-700 pb-2">
                  <ArrowLeft className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-jaro text-zinc-200">O que eu ofereço</h3>
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {mySessionPosses.length === 0 && (
                    <p className="text-xs font-inconsolata text-zinc-600 italic py-3 text-center">
                      Nenhuma propriedade disponível
                    </p>
                  )}
                  {mySessionPosses.map((sp) => {
                    const propData = sp.propriedade;
                    const casas = sp.casas ?? 0;
                    const selected = offerPropIds.includes(sp.id);
                    const accent = propData?.grupo_cor ? getAccentHex(propData.grupo_cor) : "#52525b";
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => toggleOfferProp(sp.id)}
                        className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all text-left ${
                          selected
                            ? "bg-purple-500/15 border border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                            : "bg-zinc-800/60 border border-zinc-700/60 hover:border-zinc-500 hover:bg-zinc-800"
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-colors"
                          style={{
                            borderColor: selected ? accent : "transparent",
                            backgroundColor: selected ? `${accent}22` : "transparent",
                          }}
                        >
                          {selected ? (
                            <Check className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-inconsolata text-zinc-200 truncate block">
                            {propData?.nome ?? `Prop #${sp.propId}`}
                          </span>
                          <span className="text-[10px] font-inconsolata text-zinc-500">
                            Aluguel base: R$ {formatCurrency(propData?.aluguel_base ?? 0)}
                            {casas > 0 && ` · ${casas} casa${casas > 1 ? "s" : ""}`}
                          </span>
                        </div>
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: accent }}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 bg-zinc-800/40 rounded-lg p-2 border border-zinc-700/50">
                  <span className="text-xs font-inconsolata text-zinc-400">+ R$</span>
                  <div className="flex-1 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOfferMoney(Math.max(0, offerMoney - 500))}
                      disabled={offerMoney <= 0}
                      className="p-1 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Minus className="w-3 h-3 text-zinc-300" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={7}
                      value={String(offerMoney)}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 7);
                        setOfferMoney(cleaned ? Number(cleaned) : 0);
                      }}
                      className="w-full bg-zinc-800 border border-zinc-600 rounded px-2.5 py-1.5 text-sm text-zinc-100 font-inconsolata text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setOfferMoney(offerMoney + 500)}
                      className="p-1 rounded bg-zinc-700 hover:bg-zinc-600 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-zinc-300" />
                    </button>
                  </div>
                </div>
              </div>

              {/* O que eu quero */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 border-b border-zinc-700 pb-2">
                  <ArrowRight className="w-4 h-4 text-green-400" />
                  <h3 className="text-sm font-jaro text-zinc-200">O que eu quero</h3>
                </div>
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {targetPlayerPosses.length === 0 && (
                    <p className="text-xs font-inconsolata text-zinc-600 italic py-3 text-center">
                      Nenhuma propriedade disponível
                    </p>
                  )}
                  {targetPlayerPosses.map((sp) => {
                    const propData = sp.propriedade;
                    const casas = sp.casas ?? 0;
                    const selected = wantPropIds.includes(sp.id);
                    const accent = propData?.grupo_cor ? getAccentHex(propData.grupo_cor) : "#52525b";
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => toggleWantProp(sp.id)}
                        className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all text-left ${
                          selected
                            ? "bg-green-500/15 border border-green-500/60 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                            : "bg-zinc-800/60 border border-zinc-700/60 hover:border-zinc-500 hover:bg-zinc-800"
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border transition-colors"
                          style={{
                            borderColor: selected ? accent : "transparent",
                            backgroundColor: selected ? `${accent}22` : "transparent",
                          }}
                        >
                          {selected ? (
                            <Check className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-inconsolata text-zinc-200 truncate block">
                            {propData?.nome ?? `Prop #${sp.propId}`}
                          </span>
                          <span className="text-[10px] font-inconsolata text-zinc-500">
                            Aluguel base: R$ {formatCurrency(propData?.aluguel_base ?? 0)}
                            {casas > 0 && ` · ${casas} casa${casas > 1 ? "s" : ""}`}
                          </span>
                        </div>
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: accent }}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 bg-zinc-800/40 rounded-lg p-2 border border-zinc-700/50">
                  <span className="text-xs font-inconsolata text-zinc-400">+ R$</span>
                  <div className="flex-1 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setWantMoney(Math.max(0, wantMoney - 500))}
                      disabled={wantMoney <= 0}
                      className="p-1 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Minus className="w-3 h-3 text-zinc-300" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={7}
                      value={String(wantMoney)}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 7);
                        setWantMoney(cleaned ? Number(cleaned) : 0);
                      }}
                      className="w-full bg-zinc-800 border border-zinc-600 rounded px-2.5 py-1.5 text-sm text-zinc-100 font-inconsolata text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setWantMoney(wantMoney + 500)}
                      className="p-1 rounded bg-zinc-700 hover:bg-zinc-600 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-zinc-300" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="border-t border-zinc-700/50 pt-3 mt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-800/40 rounded-lg p-3">
                <div className="flex items-center gap-3 text-xs font-inconsolata">
                  <span className="text-zinc-400">
                    Oferecendo: <strong className="text-purple-400">
                      {offerPropIds.length} propriedade{offerPropIds.length !== 1 ? "s" : ""}
                      {offerMoney > 0 && ` + R$ ${formatCurrency(offerMoney)}`}
                    </strong>
                  </span>
                  <ArrowRight className="w-3 h-3 text-zinc-600" />
                  <span className="text-zinc-400">
                    Recebendo: <strong className="text-green-400">
                      {wantPropIds.length} propriedade{wantPropIds.length !== 1 ? "s" : ""}
                      {wantMoney > 0 && ` + R$ ${formatCurrency(wantMoney)}`}
                    </strong>
                  </span>
                </div>
                <button
                  onClick={handleCriarNegociacao}
                  disabled={reqLoading}
                  className="px-6 py-1.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:from-zinc-700 disabled:to-zinc-700 text-white text-sm font-inconsolata rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                >
                  {reqLoading ? "Enviando..." : "Enviar Proposta"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Receber de Todos */}
      <Modal
        size="md"
        title="Receber de Todos"
        isOpen={modalReceber}
        onClose={() => setModalReceber(false)}
      >
        <div className="mb-3 font-inconsolata text-zinc-300">
          Jogador: <span className="inline-flex items-center gap-1"><UserBadge badge={currentPlayer?.badge} imageUrl={currentPlayer?.badgeImageUrl} variant="micro" /><span className="text-zinc-100 font-semibold">{currentPlayer?.nome ?? "—"}</span></span>
        </div>
        <p className="text-sm font-inconsolata text-zinc-400 mb-4">
          Este jogador receberá R$ 500 de cada um dos outros jogadores.
        </p>

        <div className="w-full flex justify-center items-center mt-4">
          <button
            onClick={handleReceberDeTodos}
            disabled={reqLoading || !currentPlayer}
            className="px-16 py-1 bg-green-500 hover:bg-green-600 text-white rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reqLoading ? "Processando..." : "Confirmar"}
          </button>
        </div>
      </Modal>
    </main>
  );
}
