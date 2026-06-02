"use client";

import { useState, useEffect, useMemo } from "react";
import Modal from "../Modal";
import { useNegotiationStore } from "@/stores/negotiationStore";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/components/Toast";
import {
  aceitarNegociacaoApi,
  recusarNegociacaoApi,
  contraOfertarNegociacaoApi,
} from "@/services/api/negotiations";
import {
  Check, X, ArrowLeftRight, Timer,
} from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import UserBanner from "@/components/UserBanner";
import type { Negotiation } from "@/types/game";
import { sortSessionPosses } from "@/utils/properties";
import { formatCurrency } from "@/utils/format";

export default function NegotiationResponseModal() {
  const { success: toastSuccess, error: toastError, warning: toastWarning, info: toastInfo } = useToast();
  const { currentSession, loadSession } = useGameStore();
  const authUser = useAuthStore((s) => s.user);
  const {
    activeNegotiation, setActive, removePendente,
    minhaNegociacaoPendente, setMinhaNegociacao,
    minhaNegociacaoAberto, setMinhaNegociacaoAberto,
  } = useNegotiationStore();

  const currentPlayer = useMemo(
    () => currentSession?.jogadores.find((p) => p.userId === authUser?.id) ?? null,
    [currentSession?.jogadores, authUser?.id]
  );

  const fromPlayer = useMemo(
    () => currentSession?.jogadores.find((p) => p.id === activeNegotiation?.fromPlayerId) ?? null,
    [currentSession?.jogadores, activeNegotiation?.fromPlayerId]
  );

  const targetPlayer = useMemo(
    () => currentSession?.jogadores.find((p) => p.id === minhaNegociacaoPendente?.toPlayerId) ?? null,
    [currentSession?.jogadores, minhaNegociacaoPendente?.toPlayerId]
  );

  const showPendingView = minhaNegociacaoAberto && !!minhaNegociacaoPendente && !activeNegotiation;

  const [reqLoading, setReqLoading] = useState(false);
  const [isCountering, setIsCountering] = useState(false);

  // Counter-offer state (simple IDs + money, like create modal)
  const [counterOfferPropIds, setCounterOfferPropIds] = useState<number[]>([]);
  const [counterOfferMoney, setCounterOfferMoney] = useState(0);
  const [counterWantPropIds, setCounterWantPropIds] = useState<number[]>([]);
  const [counterWantMoney, setCounterWantMoney] = useState(0);

  const isExpired = activeNegotiation && activeNegotiation.status !== "pendente";

  // My non-hipotecada, non-negociando properties
  const mySessionPosses = useMemo(
    () => sortSessionPosses(
      currentSession?.sessionPosses
        .filter((p) => p.playerId === currentPlayer?.id && !p.hipotecada && !p.negociando) ?? []
    ),
    [currentSession?.sessionPosses, currentPlayer?.id]
  )

  // FromPlayer (original sender) properties — na contra-oferta NÃO filtra
  // negociando, pois as props ofertadas ainda estão locked até enviar
  const fromPlayerPosses = useMemo(
    () => sortSessionPosses(
      currentSession?.sessionPosses
        .filter((p) => p.playerId === activeNegotiation?.fromPlayerId && !p.hipotecada) ?? []
    ),
    [currentSession?.sessionPosses, activeNegotiation?.fromPlayerId]
  );

  function resetCounter() {
    setCounterOfferPropIds([]);
    setCounterOfferMoney(0);
    setCounterWantPropIds([]);
    setCounterWantMoney(0);
    setIsCountering(false);
  }

  function initCounter(negotiation: Negotiation) {
    const offerIds: number[] = [];
    const wantIds: number[] = [];
    let moneyOffer = 0;
    let moneyWant = 0;

    for (const item of negotiation.items) {
      if (item.sessionPossesId) {
        if (item.fromSide) {
          offerIds.push(item.sessionPossesId);
          if (item.valor) moneyOffer += item.valor;
        } else {
          wantIds.push(item.sessionPossesId);
          if (item.valor) moneyWant += item.valor;
        }
      } else if (item.valor) {
        if (item.fromSide) moneyOffer += item.valor;
        else moneyWant += item.valor;
      }
    }

    // Inverts: what they offered becomes what I want, what they wanted becomes what I offer
    setCounterOfferPropIds(wantIds);
    setCounterOfferMoney(moneyWant);
    setCounterWantPropIds(offerIds);
    setCounterWantMoney(moneyOffer);
    setIsCountering(true);
  }

  function toggleCounterOfferProp(id: number) {
    setCounterOfferPropIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleCounterWantProp(id: number) {
    setCounterWantPropIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleAceitar(negotiation: Negotiation) {
    if (!currentPlayer) return;
    setReqLoading(true);
    try {
      await aceitarNegociacaoApi(negotiation.id, currentPlayer.id);
      removePendente(negotiation.id);
      setActive(null);
      if (negotiation.sessionId) await loadSession(negotiation.sessionId);
      toastSuccess("Negociação aceita!");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao aceitar negociação";
      if (err?.response?.status >= 500) { toastError(msg) } else { toastWarning(msg) }
    } finally {
      setReqLoading(false);
    }
  }

  async function handleRecusar(negotiation: Negotiation) {
    if (!currentPlayer) return;
    setReqLoading(true);
    try {
      await recusarNegociacaoApi(negotiation.id, currentPlayer.id);
      toastInfo("Negociação recusada.");
      removePendente(negotiation.id);
      setActive(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao recusar negociação";
      if (err?.response?.status >= 500) { toastError(msg) } else { toastWarning(msg) }
    } finally {
      setReqLoading(false);
    }
  }

  async function handleContraOfertar(negotiation: Negotiation) {
    if (!currentPlayer || !currentSession) return;
    if (counterOfferPropIds.length === 0 && counterWantPropIds.length === 0 && counterOfferMoney <= 0 && counterWantMoney <= 0) {
      return toastWarning("Adicione pelo menos um item à contra-oferta!");
    }

    const offerItems = [
      ...counterOfferPropIds.map((id) => ({ sessionPossesId: id, fromSide: true })),
      ...(counterOfferMoney > 0 ? [{ fromSide: true, valor: counterOfferMoney }] : []),
    ];
    const wantItems = [
      ...counterWantPropIds.map((id) => ({ sessionPossesId: id, fromSide: false })),
      ...(counterWantMoney > 0 ? [{ fromSide: false, valor: counterWantMoney }] : []),
    ];

    setReqLoading(true);
    try {
      const newNegotiation: Negotiation = await contraOfertarNegociacaoApi(
        negotiation.id,
        currentPlayer.id,
        offerItems as any,
        wantItems as any
      );
      toastSuccess("Contra-oferta enviada!");
      removePendente(negotiation.id);
      setActive(null);
      resetCounter();
      // Registra a nova negociação como "minha proposta pendente"
      if (newNegotiation) {
        setMinhaNegociacao(newNegotiation);
        setMinhaNegociacaoAberto(true);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Erro ao enviar contra-oferta";
      if (err?.response?.status >= 500) { toastError(msg) } else { toastWarning(msg) }
    } finally {
      setReqLoading(false);
    }
  }

  // Timer countdown — negociação recebida (activeNegotiation)
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!activeNegotiation) { setTimeLeft(null); return; }
    const deadline = activeNegotiation.expiresAt
      ? new Date(activeNegotiation.expiresAt).getTime()
      : new Date(activeNegotiation.createdAt).getTime() + 120_000;
    const update = () => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 0 && activeNegotiation.status === "pendente") {
        removePendente(activeNegotiation.id);
        setActive(null);
        if (activeNegotiation.sessionId) loadSession(activeNegotiation.sessionId);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeNegotiation?.id, activeNegotiation?.expiresAt, activeNegotiation?.status]);

  // Timer countdown — negociação pendente (minhaNegociacaoPendente)
  const [pendingTimeLeft, setPendingTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!minhaNegociacaoPendente) { setPendingTimeLeft(null); return; }
    const deadline = minhaNegociacaoPendente.expiresAt
      ? new Date(minhaNegociacaoPendente.expiresAt).getTime()
      : new Date(minhaNegociacaoPendente.createdAt).getTime() + 120_000;
    const update = () => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setPendingTimeLeft(left);
      if (left <= 0) { setMinhaNegociacao(null); setMinhaNegociacaoAberto(false); }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [minhaNegociacaoPendente?.id, minhaNegociacaoPendente?.expiresAt]);

  const modalTitle = showPendingView
    ? "Negociação Enviada"
    : isCountering ? "Contra-Oferta" : "Negociação Recebida";

  return (
    <Modal
      size={isCountering ? "lg" : "md"}
      title={modalTitle}
      isOpen={(!!activeNegotiation && !isExpired) || showPendingView}
      onClose={() => { setActive(null); resetCounter(); setMinhaNegociacaoAberto(false); }}
    >
      {/* ── Vista pendente (proponente aguardando resposta) ── */}
      {showPendingView && minhaNegociacaoPendente && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-sm font-inconsolata text-zinc-400">
            <Timer className="w-4 h-4" />
            <span className={pendingTimeLeft !== null && pendingTimeLeft <= 10 ? "text-red-400 font-bold" : ""}>
              {pendingTimeLeft ?? "—"}s
            </span>
          </div>

          {targetPlayer && (
            <div className="relative overflow-hidden rounded-xl border border-zinc-700">
              <UserBanner banner={targetPlayer.banner} spriteId={targetPlayer.spriteId} className="absolute inset-0 w-full h-full" />
              <div className="absolute inset-0 bg-black/60" />
              <div className="relative z-10 flex items-center gap-3 p-3">
                <UserAvatar
                  avatarUrl={targetPlayer.avatarUrl}
                  avatarUpdatedAt={targetPlayer.avatarUpdatedAt}
                  nome={targetPlayer.nome}
                  size="sm"
                />
                <div>
                  <p className="text-xs font-inconsolata text-zinc-400">Aguardando resposta de</p>
                  <p className="text-sm font-inconsolata text-zinc-100 font-semibold">{targetPlayer.nome}</p>
                </div>
                <div className="ml-auto">
                  <span className="text-xs font-inconsolata text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full">
                    Pendente
                  </span>
                </div>
              </div>
            </div>
          )}

          {minhaNegociacaoPendente.items.length > 0 && (
            <div className="space-y-3">
              {(() => {
                const offer = minhaNegociacaoPendente.items.filter((i) => i.fromSide);
                const want  = minhaNegociacaoPendente.items.filter((i) => !i.fromSide);
                const resolveName = (item: typeof offer[0]) => {
                  if (item.sessionPossesId) {
                    const sp = currentSession?.sessionPosses.find((p) => p.id === item.sessionPossesId);
                    const nome = sp?.posses?.propriedade?.nome ?? `Propriedade #${item.sessionPossesId}`;
                    const casas = sp?.casas ?? 0;
                    return nome + (casas > 0 ? ` (${casas} casa${casas > 1 ? "s" : ""})` : "");
                  }
                  return item.valor ? `R$ ${item.valor.toLocaleString("pt-BR")}` : "—";
                };
                return (
                  <>
                    {offer.length > 0 && (
                      <div>
                        <p className="text-xs font-inconsolata text-zinc-500 uppercase tracking-wide mb-1">Você oferece</p>
                        <div className="space-y-1">
                          {offer.map((item) => (
                            <div key={item.id} className="p-2 bg-zinc-800 rounded-lg border border-zinc-700 text-sm font-inconsolata text-zinc-200">
                              {resolveName(item)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {want.length > 0 && (
                      <div>
                        <p className="text-xs font-inconsolata text-zinc-500 uppercase tracking-wide mb-1">Você quer</p>
                        <div className="space-y-1">
                          {want.map((item) => (
                            <div key={item.id} className="p-2 bg-zinc-800 rounded-lg border border-zinc-700 text-sm font-inconsolata text-zinc-200">
                              {resolveName(item)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          <button
            onClick={() => setMinhaNegociacaoAberto(false)}
            className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-inconsolata rounded-xl transition-colors cursor-pointer text-sm"
          >
            Fechar
          </button>
        </div>
      )}

      {/* ── Vista normal (negociação recebida / contra-oferta) ── */}
      {!showPendingView && activeNegotiation && timeLeft !== null && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-sm font-inconsolata text-zinc-400">
            <Timer className="w-4 h-4" />
            <span className={timeLeft <= 10 ? "text-red-400 font-bold" : ""}>
              {timeLeft}s
            </span>
          </div>

          {!isCountering ? (
            <>
              {fromPlayer && (
                <div className="relative overflow-hidden rounded-xl border border-zinc-700">
                  <UserBanner banner={fromPlayer.banner} spriteId={fromPlayer.spriteId} className="absolute inset-0 w-full h-full" />
                  <div className="absolute inset-0 bg-black/60" />
                  <div className="relative z-10 flex items-center gap-3 p-3">
                    <UserAvatar
                      avatarUrl={fromPlayer.avatarUrl}
                      avatarUpdatedAt={fromPlayer.avatarUpdatedAt}
                      nome={fromPlayer.nome}
                      size="sm"
                      ring
                    />
                    <div>
                      <p className="text-xs font-inconsolata text-zinc-400">Oferta de</p>
                      <p className="text-sm font-inconsolata text-zinc-100 font-semibold">{fromPlayer.nome}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeNegotiation.items.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-inconsolata text-zinc-500 uppercase tracking-wide">Itens</p>
                  {activeNegotiation.items.map((item) => {
                    const sp = currentSession?.sessionPosses.find((p) => p.id === item.sessionPossesId);
                    const propName = sp?.posses?.propriedade?.nome ?? (item.sessionPossesId ? `Propriedade #${item.sessionPossesId}` : null);
                    return (
                      <div key={item.id} className="p-2 bg-zinc-800 rounded-lg border border-zinc-700">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-inconsolata text-zinc-400">
                            {item.fromSide ? "➡ Oferece" : "⬅ Quer"}
                          </span>
                          <span className="text-sm font-inconsolata text-zinc-200">
                            {propName
                              ? `${propName}${(sp?.casas ?? 0) > 0 ? ` (${sp!.casas} casa${sp!.casas > 1 ? "s" : ""})` : ""}`
                              : item.valor
                                ? formatCurrency(item.valor)
                                : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleAceitar(activeNegotiation)}
                  disabled={reqLoading}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 text-white font-inconsolata rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" /> Aceitar
                </button>
                <button
                  onClick={() => initCounter(activeNegotiation)}
                  disabled={reqLoading}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-xs md:text-base text-white font-inconsolata rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ArrowLeftRight className="w-4 h-4" /> Contra-Ofertar
                </button>
                <button
                  onClick={() => handleRecusar(activeNegotiation)}
                  disabled={reqLoading}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 text-white font-inconsolata rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" /> Recusar
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {fromPlayer && (
                <div className="relative overflow-hidden rounded-xl border border-zinc-700">
                  <UserBanner banner={fromPlayer.banner} spriteId={fromPlayer.spriteId} className="absolute inset-0 w-full h-full" />
                  <div className="absolute inset-0 bg-black/60" />
                  <div className="relative z-10 flex items-center gap-3 p-3">
                    <UserAvatar
                      avatarUrl={fromPlayer.avatarUrl}
                      avatarUpdatedAt={fromPlayer.avatarUpdatedAt}
                      nome={fromPlayer.nome}
                      size="sm"
                    />
                    <div>
                      <p className="text-xs font-inconsolata text-zinc-400">Contra-oferta para</p>
                      <p className="text-sm font-inconsolata text-zinc-100 font-semibold">{fromPlayer.nome}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* O que eu ofereço */}
                <div className="space-y-2">
                  <h3 className="text-sm font-jaro text-zinc-200">O que eu ofereço</h3>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {mySessionPosses.length === 0 && (
                      <p className="text-xs font-inconsolata text-zinc-500 italic">Nenhuma propriedade disponível</p>
                    )}
                    {mySessionPosses.map((sp) => {
                      const propData = sp.posses?.propriedade;
                      const casas = sp.casas ?? 0;
                      const selected = counterOfferPropIds.includes(sp.id);
                      return (
                        <label
                          key={sp.id}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                            selected ? "bg-purple-500/20 border border-purple-500" : "bg-zinc-800 border border-zinc-700 hover:border-zinc-500"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleCounterOfferProp(sp.id)}
                            className="accent-purple-500"
                          />
                          <span className="text-sm font-inconsolata text-zinc-200">
                            {propData?.nome ?? `Prop #${sp.possesId}`}
                            {casas > 0 ? ` (${casas} casa${casas > 1 ? "s" : ""})` : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-inconsolata text-zinc-400">+ R$</span>
                    <input
                      type="number"
                      min={0}
                      value={counterOfferMoney}
                      onChange={(e) => setCounterOfferMoney(Math.max(0, Number(e.target.value)))}
                      className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 font-inconsolata"
                    />
                  </div>
                </div>

                {/* O que eu quero */}
                <div className="space-y-2">
                  <h3 className="text-sm font-jaro text-zinc-200">O que eu quero</h3>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {fromPlayerPosses.length === 0 && (
                      <p className="text-xs font-inconsolata text-zinc-500 italic">Nenhuma propriedade disponível</p>
                    )}
                    {fromPlayerPosses.map((sp) => {
                      const propData = sp.posses?.propriedade;
                      const casas = sp.casas ?? 0;
                      const selected = counterWantPropIds.includes(sp.id);
                      return (
                        <label
                          key={sp.id}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                            selected ? "bg-green-500/20 border border-green-500" : "bg-zinc-800 border border-zinc-700 hover:border-zinc-500"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleCounterWantProp(sp.id)}
                            className="accent-green-500"
                          />
                          <span className="text-sm font-inconsolata text-zinc-200">
                            {propData?.nome ?? `Prop #${sp.possesId}`}
                            {casas > 0 ? ` (${casas} casa${casas > 1 ? "s" : ""})` : ""}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-inconsolata text-zinc-400">+ R$</span>
                    <input
                      type="number"
                      min={0}
                      value={counterWantMoney}
                      onChange={(e) => setCounterWantMoney(Math.max(0, Number(e.target.value)))}
                      className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 font-inconsolata"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleContraOfertar(activeNegotiation)}
                  disabled={reqLoading || (counterOfferPropIds.length === 0 && counterWantPropIds.length === 0 && counterOfferMoney <= 0 && counterWantMoney <= 0)}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white font-inconsolata rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {reqLoading ? "Enviando..." : "Enviar Contra-Oferta"}
                </button>
                <button
                  onClick={() => resetCounter()}
                  className="py-2 px-4 bg-zinc-700 hover:bg-zinc-600 text-white font-inconsolata rounded-lg transition-colors cursor-pointer"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
