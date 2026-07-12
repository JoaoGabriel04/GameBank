"use client";

import { useState } from "react";
import {
  Check, Building2, ArrowLeft, ArrowRight, Minus, Plus,
} from "lucide-react";
import Modal from "@/components/Modal";
import UserAvatar from "@/components/UserAvatar";
import UserBanner from "@/components/UserBanner";
import UserBadge from "@/components/UserBadge";
import PlayerCard from "@/components/PlayerCard";
import { formatCurrency } from "@/utils/format";
import { getAccentHex } from "@/components/Game/sections/shared";
import type { Player, SessionPropriedade } from "@/types/game";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentPlayer: Player | null | undefined;
  jogadores: Player[];
  mySessionPosses: SessionPropriedade[];
  targetPlayerPosses: SessionPropriedade[];
  currentSession: { sessionPosses?: SessionPropriedade[] } | null;
  onSuccess: () => void;
};

export default function NegociarModal({
  isOpen, onClose, currentPlayer, jogadores,
  mySessionPosses, targetPlayerPosses, currentSession, onSuccess,
}: Props) {
  const [targetPlayer, setTargetPlayer] = useState<number | null>(null);
  const [offerPropIds, setOfferPropIds] = useState<number[]>([]);
  const [offerMoney, setOfferMoney] = useState(0);
  const [wantPropIds, setWantPropIds] = useState<number[]>([]);
  const [wantMoney, setWantMoney] = useState(0);
  const [reqLoading, setReqLoading] = useState(false);

  function resetState() {
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

  async function handleSubmit() {
    if (!currentPlayer || !targetPlayer) return;
    if (offerPropIds.length === 0 && wantPropIds.length === 0 && offerMoney <= 0 && wantMoney <= 0) return;
    if (offerPropIds.length === 0 && wantPropIds.length === 0 && offerMoney === wantMoney) return;

    setReqLoading(true);
    try {
      const { criarNegociacaoApi } = await import("@/services/api/negotiations");
      const { useGameStore } = await import("@/stores/gameStore");
      const { useNegotiationStore } = await import("@/stores/negotiationStore");

      const session = useGameStore.getState().currentSession;
      if (!session) return;

      const offerItems = [
        ...offerPropIds.map((id) => ({ sessionPossesId: id, fromSide: true })),
        ...(offerMoney > 0 ? [{ fromSide: true, valor: offerMoney }] : []),
      ];
      const wantItems = [
        ...wantPropIds.map((id) => ({ sessionPossesId: id, fromSide: false })),
        ...(wantMoney > 0 ? [{ fromSide: false, valor: wantMoney }] : []),
      ];

      const negotiation = await criarNegociacaoApi(session.id, currentPlayer.id, targetPlayer, offerItems, wantItems);
      useNegotiationStore.getState().setMinhaNegociacao(negotiation);
      useNegotiationStore.getState().setMinhaNegociacaoAberto(true);
      await useGameStore.getState().loadSession(session.id);
      onClose();
      resetState();
    } catch {
      // error handled by caller
    } finally {
      setReqLoading(false);
    }
  }

  const target = jogadores.find((p) => p.id === targetPlayer);
  const targetPosses = targetPlayer
    ? (currentSession?.sessionPosses?.filter(
        (sp) => sp.playerId === targetPlayer && !sp.hipotecada && !sp.negociando
      ) ?? [])
    : [];

  return (
    <Modal
      size="lg"
      title="Nova Negociação"
      isOpen={isOpen}
      onClose={() => { onClose(); resetState(); }}
    >
      <div className="relative overflow-hidden rounded-xl border border-zinc-700 mb-4">
        <UserBanner banner={currentPlayer?.banner} animated={currentPlayer?.bannerAnimated} rarity={currentPlayer?.bannerRaridade} className="absolute inset-0 w-full h-full" />
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
                const propCount = currentSession?.sessionPosses?.filter(
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
          {target && (
            <div className="relative overflow-hidden rounded-xl border border-purple-500/40 mb-2">
              <UserBanner banner={target.banner} animated={target.bannerAnimated} rarity={target.bannerRaridade} className="absolute inset-0 w-full h-full" />
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
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="space-y-2">
              <div className="flex items-center gap-2 border-b border-zinc-700 pb-2">
                <ArrowRight className="w-4 h-4 text-green-400" />
                <h3 className="text-sm font-jaro text-zinc-200">O que eu quero</h3>
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {targetPosses.length === 0 && (
                  <p className="text-xs font-inconsolata text-zinc-600 italic py-3 text-center">
                    Nenhuma propriedade disponível
                  </p>
                )}
                {targetPosses.map((sp) => {
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
                onClick={handleSubmit}
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
  );
}
