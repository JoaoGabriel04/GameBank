"use client";

import { useMemo, useState, useCallback } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { useNegotiationStore } from "@/stores/negotiationStore";
import { PROPERTY_COLORS } from "@/types/game";
import type { Player } from "@/types/game";
import { getPropData, groupByColor, sortPropItems } from "@/utils/properties";
import type { PropItem } from "@/utils/properties";
import PropertyDetailModal from "@/components/PropertyDetailModal";
import EmprestimoModal from "@/components/EmprestimoModal";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/utils/format";
import { getEvento } from "@/constants/eventos";
import { aplicarMod } from "@/shared/economia-core";
import { toApiErr } from "@/lib/api-error";
import UserAvatar from "@/components/UserAvatar";
import UserBadge from "@/components/UserBadge";
import PlayerCard from "@/components/PlayerCard";
import { getAccentHex, COLOR_LABELS } from "@/components/Game/sections/shared";
import { Home, Receipt, Banknote, Handshake, ShoppingBag } from "lucide-react";
import ComprarCasasModal from "./ComprarCasasModal";
import VenderCasasModal from "./VenderCasasModal";
import AluguelModal from "./AluguelModal";
import NegociarModal from "./NegociarModal";

type Props = {
  currentPlayer: Player | null | undefined;
  isOwner: boolean;
  onNavigate?: (tab: string) => void;
};

type ModalType = "casas" | "venderCasas" | "aluguel" | "emprestimo" | "negociar" | null;

export default function ImoveisSection({ currentPlayer, isOwner, onNavigate }: Props) {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const { currentSession, loadSession, getAluguel, getAluguelBase, buyHousesBatch, sellHousesBatch, aluguel, aluguelAcao } = useGameStore();
  const { user: authUser } = useAuthStore();
  const { pendentes, setActive, minhaNegociacaoPendente, setMinhaNegociacaoAberto } = useNegotiationStore();

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [reqLoading, setReqLoading] = useState(false);
  const [selectedSessionPropId, setSelectedSessionPropId] = useState<number | null>(null);
  const [selectedRentProp, setSelectedRentProp] = useState<number | null>(null);
  const [numDados, setNumDados] = useState(0);
  const [selectedBatchProps, setSelectedBatchProps] = useState<number[]>([]);
  const [sellQuantities, setSellQuantities] = useState<Record<number, number>>({});

  const isSpectator = !!currentPlayer?.desistiu;
  const isTabuleiro = currentSession?.tipoJogo === "tabuleiro";

  const myProps: PropItem[] = useMemo(() => {
    if (!currentSession || !currentPlayer) return [];
    return currentSession.sessionPosses
      .filter((sp) => sp.playerId === currentPlayer.id)
      .map((sp) => ({ prop: getPropData(sp), sessionProp: sp }))
      .filter((item): item is PropItem => item.prop !== null);
  }, [currentSession, currentPlayer]);

  const propertyGroups = useMemo(() => groupByColor(myProps), [myProps]);
  const jogadores = useMemo(() => currentSession?.jogadores ?? [], [currentSession?.jogadores]);

  const mySessionPosses = useMemo(
    () => currentSession?.sessionPosses
      .filter((p) => p.playerId === currentPlayer?.id && !p.hipotecada && !p.negociando) ?? [],
    [currentSession?.sessionPosses, currentPlayer?.id]
  );

  const rentableProps = useMemo(() => {
    if (!currentSession) return [];
    return sortPropItems(
      currentSession.sessionPosses
        .filter((p) => !!p.playerId && p.playerId !== currentPlayer?.id)
        .map(sp => ({ sessionProp: sp, prop: getPropData(sp) }))
        .filter((item): item is { sessionProp: typeof item.sessionProp; prop: NonNullable<ReturnType<typeof getPropData>> } => item.prop !== null)
    );
  }, [currentSession, currentPlayer?.id]);

  const selectedRentData = useMemo(() => {
    if (!selectedRentProp || !currentSession) return null;
    const sp = currentSession.sessionPosses.find(p => p.id === selectedRentProp);
    if (!sp) return null;
    const prop = getPropData(sp);
    if (!prop) return null;
    return { sessionProp: sp, prop };
  }, [selectedRentProp, currentSession]);

  const selectedProp = useMemo<PropItem | null>(() => {
    if (!selectedSessionPropId || !currentSession) return null;
    const sessionProp = currentSession.sessionPosses.find(sp => sp.id === selectedSessionPropId);
    if (!sessionProp) return null;
    const prop = getPropData(sessionProp);
    if (!prop) return null;
    return { prop, sessionProp };
  }, [selectedSessionPropId, currentSession]);

  const completedColorGroups = useMemo(() => {
    const totalPorCor = Object.fromEntries(PROPERTY_COLORS.map((c) => [c.value, c.total]));
    return propertyGroups.filter((g) => {
      const completo = g.items.length === (totalPorCor[g.cor] ?? 0);
      const ehAcao = g.items.some(({ prop }) => prop.tipo === "ação");
      return completo && !ehAcao;
    });
  }, [propertyGroups]);

  const custoConstrucaoMult = getEvento(currentSession?.eventoAtual)?.efeito.custoConstrucaoMult ?? 1;
  const custoCasaAtual = useCallback(
    (custoBase: number) => aplicarMod(custoBase, custoConstrucaoMult),
    [custoConstrucaoMult]
  );

  function toggleBatchProp(sessionPossesId: number) {
    setSelectedBatchProps((prev) =>
      prev.includes(sessionPossesId) ? prev.filter((id) => id !== sessionPossesId) : [...prev, sessionPossesId]
    );
  }

  function setSellQty(sessionPossesId: number, qty: number) {
    setSellQuantities((prev) => ({ ...prev, [sessionPossesId]: Math.max(0, qty) }));
  }

  function closeModal() {
    setActiveModal(null);
    setSelectedRentProp(null);
    setNumDados(0);
    setSelectedBatchProps([]);
    setSellQuantities({});
  }

  const handleActionSuccess = useCallback(() => {
    const session = useGameStore.getState().currentSession;
    if (session) {
      loadSession(session.id);
    }
  }, [loadSession]);

  async function handleBatchBuy() {
    if (!currentPlayer || !currentSession || selectedBatchProps.length === 0) return;
    setReqLoading(true);
    try {
      await buyHousesBatch({ userId: currentPlayer.id, sessionId: currentSession.id, sessaoPossesIds: selectedBatchProps });
      await loadSession(currentSession.id);
      setSelectedBatchProps([]);
      closeModal();
      toastSuccess(`${selectedBatchProps.length} casa(s) comprada(s) com sucesso!`);
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.message ?? "Erro ao comprar casas";
      if ((e?.response?.status ?? 0) >= 500) { toastError(msg); } else { toastWarning(msg); }
    } finally {
      setReqLoading(false);
    }
  }

  async function handleBatchSell() {
    if (!currentPlayer || !currentSession) return;
    const items = Object.entries(sellQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ sessaoPossesId: Number(id), quantidade: qty }));
    if (!items.length) return;
    setReqLoading(true);
    try {
      await sellHousesBatch({ userId: currentPlayer.id, sessionId: currentSession.id, items });
      await loadSession(currentSession.id);
      setSellQuantities({});
      closeModal();
      toastSuccess(`${items.length} propriedade(s) atualizada(s) com sucesso!`);
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.message ?? "Erro ao vender casas";
      if ((e?.response?.status ?? 0) >= 500) { toastError(msg); } else { toastWarning(msg); }
    } finally {
      setReqLoading(false);
    }
  }

  async function handleAluguel() {
    if (!currentPlayer || !selectedRentProp) return toastWarning("Selecione uma propriedade!");
    if (!currentSession) return;
    setReqLoading(true);
    try {
      if (selectedRentData?.prop.tipo === "ação") {
        await aluguelAcao({ sessionId: currentSession.id, pagadorId: currentPlayer.id, sessionPossesId: selectedRentProp, numDados });
      } else {
        await aluguel({ sessionId: currentSession.id, pagadorId: currentPlayer.id, sessionPossesId: selectedRentProp });
      }
      await loadSession(currentSession.id);
      toastError("Aluguel pago!");
      closeModal();
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.message ?? "Erro ao pagar aluguel";
      if ((e?.response?.status ?? 0) >= 500) { toastError(msg); } else { toastWarning(msg); }
      closeModal();
    } finally {
      setReqLoading(false);
    }
  }

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-10">
      {/* Ação buttons */}
      {!isSpectator && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Home, label: "Comprar Casas", modal: "casas" as const, color: "text-teal-400 bg-teal-500/10", acao: "casas" as const },
            { icon: Banknote, label: "Vender Casas", modal: "venderCasas" as const, color: "text-orange-400 bg-orange-500/10", acao: "venderCasas" as const },
            ...(isTabuleiro
              ? [{ icon: Banknote, label: "Empréstimo", modal: "emprestimo" as const, color: "text-green-400 bg-green-500/10", acao: null as string | null }]
              : [{ icon: Receipt, label: "Pagar Aluguel", modal: "aluguel" as const, color: "text-amber-400 bg-amber-500/10", acao: "aluguel" as const }]
            ),
          ].map((action) => {
            const isTurnAction = action.acao === "casas";
            const naoMinhaVez = isTabuleiro && isTurnAction && currentPlayer?.id !== currentSession?.turnoAtualPlayerId;
            return (
              <button
                key={action.label}
                onClick={() => !naoMinhaVez && setActiveModal(action.modal)}
                disabled={naoMinhaVez}
                className={`flex flex-col items-center gap-2 p-4 bg-zinc-900 border rounded-xl transition-colors ${naoMinhaVez ? "border-zinc-800/50 opacity-40 cursor-not-allowed" : "border-zinc-800 hover:border-zinc-600 cursor-pointer"}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${action.color}`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-inconsolata text-zinc-400 text-center leading-tight">
                  {action.label}
                </span>
              </button>
            );
          })}
          {!isTabuleiro && (
            <button
              onClick={() => onNavigate?.("Loja")}
              className="flex flex-col items-center gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-purple-400 bg-purple-500/10">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <span className="text-xs font-inconsolata text-zinc-400 text-center leading-tight">Loja</span>
            </button>
          )}
          <button
            onClick={() => minhaNegociacaoPendente ? setMinhaNegociacaoAberto(true) : setActiveModal("negociar")}
            disabled={isSpectator}
            className="flex flex-col items-center gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors cursor-pointer relative disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {(pendentes.length > 0 || minhaNegociacaoPendente) && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center z-10">
                {pendentes.length + (minhaNegociacaoPendente ? 1 : 0)}
              </span>
            )}
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-purple-400 bg-purple-500/10">
              <Handshake className="w-5 h-5" />
            </div>
            <span className="text-xs font-inconsolata text-zinc-400 text-center leading-tight">Negociações</span>
          </button>
        </div>
      )}

      {/* Negociações Pendentes */}
      {(pendentes.length > 0 || minhaNegociacaoPendente) && (
        <div>
          <h2 className="text-xl font-jaro text-zinc-100 mb-4 flex items-center gap-2">
            Negociações Pendentes
            <span className="text-sm font-inconsolata bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
              {pendentes.length + (minhaNegociacaoPendente ? 1 : 0)}
            </span>
          </h2>
          <div className="space-y-3">
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
                    <div className="text-sm font-inconsolata text-zinc-200">
                      Proposta enviada para{" "}
                      {(() => {
                        const p = currentSession?.jogadores.find((j) => j.id === minhaNegociacaoPendente.toPlayerId);
                        return (
                          <span className="inline-flex items-center gap-1">
                            {p && <UserBadge badge={p.badge} imageUrl={p.badgeImageUrl} variant="micro" />}
                            <span className="text-amber-400 font-semibold">{p?.nome ?? "—"}</span>
                          </span>
                        );
                      })()}
                    </div>
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
                    <div className="text-sm font-inconsolata text-zinc-200">
                      Oferta de{" "}
                      <span className="inline-flex items-center gap-1">
                        {n.fromPlayer && <UserBadge badge={n.fromPlayer.badge} imageUrl={n.fromPlayer.badgeImageUrl} variant="micro" />}
                        <span className="text-purple-400 font-semibold">{n.fromPlayer?.nome ?? "—"}</span>
                      </span>
                    </div>
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

      {/* Minhas Propriedades */}
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

      {/* Modais */}
      <ComprarCasasModal
        isOpen={activeModal === "casas"}
        onClose={() => { setActiveModal(null); setSelectedBatchProps([]); }}
        completedColorGroups={completedColorGroups}
        selectedBatchProps={selectedBatchProps}
        toggleBatchProp={toggleBatchProp}
        custoCasaAtual={custoCasaAtual}
        handleBatchBuy={handleBatchBuy}
        reqLoading={reqLoading}
        custoConstrucaoMult={custoConstrucaoMult}
      />

      <VenderCasasModal
        isOpen={activeModal === "venderCasas"}
        onClose={() => { setActiveModal(null); setSellQuantities({}); }}
        myProps={myProps}
        propertyGroups={propertyGroups}
        sellQuantities={sellQuantities}
        setSellQty={setSellQty}
        handleBatchSell={handleBatchSell}
        reqLoading={reqLoading}
      />

      {isTabuleiro && (
        <EmprestimoModal
          isOpen={activeModal === "emprestimo"}
          onClose={() => setActiveModal(null)}
          sessionId={currentSession?.id ?? 0}
          onSuccess={handleActionSuccess}
        />
      )}

      <AluguelModal
        isOpen={activeModal === "aluguel"}
        onClose={closeModal}
        currentPlayer={currentPlayer}
        currentSession={currentSession}
        rentableProps={rentableProps}
        selectedRentProp={selectedRentProp}
        setSelectedRentProp={setSelectedRentProp}
        numDados={numDados}
        setNumDados={setNumDados}
        selectedRentData={selectedRentData}
        getAluguel={getAluguel}
        handleAluguel={handleAluguel}
        reqLoading={reqLoading}
      />

      <NegociarModal
        isOpen={activeModal === "negociar"}
        onClose={() => setActiveModal(null)}
        currentPlayer={currentPlayer}
        jogadores={jogadores}
        mySessionPosses={mySessionPosses}
        targetPlayerPosses={[]}
        currentSession={currentSession}
        onSuccess={handleActionSuccess}
      />

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
    </div>
  );
}
