"use client";

import { useMemo, useState, useCallback } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import type { Player } from "@/types/game";
import type { SorteRevesCard } from "@/types/game";
import ConfirmationModal from "@/components/ConfirmationModal";
import Modal from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/utils/format";
import {
  IPTU_PCT,
  MANUTENCAO_PCT,
  RENDA_PASSIVA_PCT,
  HOTEL_EQUIVALE_CASAS,
  CREDITO_INICIO,
} from "@/constants/economia";
import { getEvento } from "@/constants/eventos";
import { aplicarMod, calcularPatrimonio } from "@/shared/economia-core";
import { toApiErr } from "@/lib/api-error";
import UserAvatar from "@/components/UserAvatar";
import UserBanner from "@/components/UserBanner";
import UserName from "@/components/UserName";
import { getAccentHex, COLOR_LABELS, COLOR_HEX, QUICK_VALUES } from "@/components/Game/sections/shared";
import UltimasJogadas from "./UltimasJogadas";
import {
  Eye,
  EyeOff,
  Receipt,
  Shuffle,
  Shield,
  PartyPopper,
  Frown,
} from "lucide-react";

type Props = {
  currentPlayer?: Player | null;
  isOwner: boolean;
  onNavigate?: (tab: string) => void;
};

export default function VisaoSection({ currentPlayer, isOwner, onNavigate }: Props) {
  const { success: toastSuccess, error: toastError, warning: toastWarning, info: toastInfo } = useToast();
  const { currentSession, loadSession, getAluguelBase, sortearCarta, usarCartaPrisao, pagarDivida } = useGameStore();
  const { user: authUser } = useAuthStore();

  const [showSaldo, setShowSaldo] = useState(true);
  const [reqLoading, setReqLoading] = useState(false);
  const [confirmSortearOpen, setConfirmSortearOpen] = useState(false);
  const [cardResult, setCardResult] = useState<{
    tipoBaralho: "sorte" | "reves";
    carta: SorteRevesCard;
    effectDescription: string;
  } | null>(null);
  const [drawingCard, setDrawingCard] = useState(false);

  const isTabuleiro = currentSession?.tipoJogo === "tabuleiro";
  const isSpectator = !!currentPlayer?.desistiu;

  const patrimonio = useMemo(() => {
    if (!currentPlayer) return 0;
    const posses = (currentSession?.sessionPosses ?? [])
      .filter((sp) => sp.playerId === currentPlayer.id)
      .map((sp) => ({
        casas: sp.casas,
        propriedade: sp.propriedade
          ? { custo_compra: sp.propriedade.custo_compra, custo_casa: sp.propriedade.custo_casa }
          : null,
      }));
    return calcularPatrimonio(currentPlayer.saldo, posses);
  }, [currentPlayer, currentSession?.sessionPosses]);

  const projecaoInicio = useMemo(() => {
    if (!currentPlayer || !currentSession) return { receita: 0, despesa: 0, liquido: 0 };
    const myProps = currentSession.sessionPosses.filter(
      (sp) => sp.playerId === currentPlayer.id
    );
    const mods = getEvento(currentSession.eventoAtual)?.efeito ?? {};
    let iptu = 0, manutencao = 0, rendaPassiva = 0;
    for (const sp of myProps) {
      if (sp.hipotecada || !sp.propriedade) continue;
      if (sp.propriedade.tipo === "ação") continue;
      const casas = sp.casas ?? 0;
      const casasEquivalentes = casas >= 5 ? HOTEL_EQUIVALE_CASAS : casas;
      iptu += aplicarMod(sp.propriedade.custo_compra * IPTU_PCT, mods.iptuMult);
      manutencao += aplicarMod(
        sp.propriedade.custo_casa * MANUTENCAO_PCT * casasEquivalentes,
        mods.manutencaoMult
      );
      rendaPassiva += aplicarMod(
        getAluguelBase(sp.propriedade, casas) * RENDA_PASSIVA_PCT,
        mods.rendaPassivaMult
      );
    }
    const receita = CREDITO_INICIO + rendaPassiva;
    const despesa = iptu + manutencao;
    return { receita, despesa, liquido: receita - despesa };
  }, [currentPlayer, currentSession, getAluguelBase]);

  const myDebts = useMemo(
    () => (currentSession?.debts ?? []).filter(
      (d) => d.playerId === currentPlayer?.id && !d.pago
    ),
    [currentSession?.debts, currentPlayer?.id]
  );

  const handleActionSuccess = useCallback(() => {
    const session = useGameStore.getState().currentSession;
    if (session) {
      loadSession(session.id);
    }
  }, [loadSession]);

  async function handleSortearConfirmado() {
    if (!currentPlayer || !currentSession) return;
    setConfirmSortearOpen(false);
    setDrawingCard(true);
    try {
      const result = await sortearCarta(currentSession.id, currentPlayer.id);
      if (result) {
        setCardResult(result);
        await loadSession(currentSession.id);
        toastInfo("Carta sorteada!");
      }
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.message ?? "Erro ao sortear carta";
      if ((e?.response?.status ?? 0) >= 500) {
        toastError(msg);
      } else {
        toastWarning(msg);
      }
    } finally {
      setDrawingCard(false);
    }
  }

  async function handleUsarCartaPrisao() {
    if (!currentPlayer || !currentSession) return;
    setReqLoading(true);
    try {
      await usarCartaPrisao(currentSession.id, currentPlayer.id);
      await loadSession(currentSession.id);
      toastSuccess("Carta 'Saia da Prisão' usada!");
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.message ?? "Erro ao usar carta prisão";
      if ((e?.response?.status ?? 0) >= 500) {
        toastError(msg);
      } else {
        toastWarning(msg);
      }
    } finally {
      setReqLoading(false);
    }
  }

  async function handlePagarDivida(debtId: number, valor: number) {
    if (!currentPlayer || !currentSession) return;
    if (currentPlayer.saldo < valor) return toastWarning("Saldo insuficiente para pagar esta dívida!");
    setReqLoading(true);
    try {
      await pagarDivida(debtId, currentPlayer.id, currentSession.id);
      await loadSession(currentSession.id);
      toastInfo(`Dívida de R$ ${formatCurrency(valor)} paga!`);
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.message ?? "Erro ao pagar dívida";
      if ((e?.response?.status ?? 0) >= 500) {
        toastError(msg);
      } else {
        toastWarning(msg);
      }
    } finally {
      setReqLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* -- Balance Widget -- */}
      <div className="overflow-hidden border border-zinc-800 rounded-xl bg-zinc-950">
        <div className="h-24 relative">
          <UserBanner
            banner={currentPlayer?.banner}
            animated={currentPlayer?.bannerAnimated}
            rarity={currentPlayer?.bannerRaridade}
            className="absolute inset-0 w-full h-full"
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
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
              <UserName
                nome={currentPlayer?.nome || "Você"}
                badge={currentPlayer?.badge}
                badgeImageUrl={currentPlayer?.badgeImageUrl}
                title={currentPlayer?.title}
                titleAnimated={currentPlayer?.titleAnimated}
                titleRaridade={currentPlayer?.titleRaridade}
              />
            </div>
            <button
              onClick={() => setShowSaldo(!showSaldo)}
              className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              {showSaldo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-3xl font-jaro font-bold text-green-400 mb-4">
            {showSaldo ? `R$ ${formatCurrency(currentPlayer?.saldo ?? 0)}` : "R$ •••••"}
          </p>
          <div className="border-t border-white/10 pt-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-inconsolata text-zinc-400">Patrimônio Total</span>
              <span className="text-lg font-jaro text-zinc-100">
                R$ {formatCurrency(patrimonio)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* -- Projeção da próxima passagem pelo Início (Modo Tabuleiro) -- */}
      {isTabuleiro && (
        <div className="border border-zinc-800 rounded-xl bg-zinc-950 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-zinc-400" />
            <h4 className="text-xs font-inconsolata text-zinc-400 uppercase tracking-wider">
              Próxima passagem pelo Início
            </h4>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between font-inconsolata text-sm">
              <span className="text-zinc-500">Receita estimada</span>
              <span className="text-emerald-400">+R$ {formatCurrency(projecaoInicio.receita)}</span>
            </div>
            <div className="flex justify-between font-inconsolata text-sm">
              <span className="text-zinc-500">Despesas estimadas</span>
              <span className="text-red-400">−R$ {formatCurrency(projecaoInicio.despesa)}</span>
            </div>
            <div className="border-t border-zinc-800 my-2" />
            <div className="flex justify-between items-center">
              <span className="font-inconsolata text-sm text-zinc-300">Líquido previsto</span>
              <span
                className={`font-jaro text-lg ${
                  projecaoInicio.liquido >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {projecaoInicio.liquido >= 0 ? "+" : "−"}R${" "}
                {formatCurrency(Math.abs(projecaoInicio.liquido))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* -- Sortear (Modo Banca) -- */}
      {!isSpectator && !isTabuleiro && (
        <div>
          <h4 className="text-xs font-inconsolata text-zinc-600 uppercase tracking-wider mb-2.5">
            Jogo
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => setConfirmSortearOpen(true)}
              disabled={drawingCard || !currentPlayer}
              className="flex flex-col items-center gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-yellow-400 bg-yellow-500/10">
                <Shuffle className="w-5 h-5" />
              </div>
              <span className="text-xs font-inconsolata text-zinc-400 text-center leading-tight">
                Sortear
              </span>
            </button>
          </div>
        </div>
      )}

      {/* -- Cartas Especiais -- */}
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
                <p className="text-xs font-inconsolata text-zinc-500">
                  Clique em &quot;Usar&quot; para consumir
                </p>
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
          <p className="text-sm font-inconsolata text-zinc-500 italic">
            Sem cartas especiais.
          </p>
        )}
      </div>

      {/* -- Dívidas Pendentes -- */}
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
                  {reqLoading
                    ? "..."
                    : `Pagar R$ ${formatCurrency(debt.valor)}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -- Últimas jogadas -- */}
      {currentSession && (
        <UltimasJogadas historico={currentSession.historico ?? []} />
      )}

      {/* -- Confirmar Sorteio -- */}
      <ConfirmationModal
        isOpen={confirmSortearOpen}
        onClose={() => setConfirmSortearOpen(false)}
        onConfirm={handleSortearConfirmado}
        title="Sortear Carta"
        message="Tem certeza que deseja sortear uma carta de Sorte/Revés?"
        confirmText="Sim, Sortear!"
        color="purple"
      />

      {/* -- Modal Carta Sorteada -- */}
      <Modal
        size="sm"
        title={
          cardResult
            ? cardResult.tipoBaralho === "sorte"
              ? "Sorte!"
              : "Revés!"
            : "Sorteando..."
        }
        isOpen={!!cardResult || drawingCard}
        onClose={() => {
          setCardResult(null);
          setDrawingCard(false);
        }}
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
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center ${
                cardResult.tipoBaralho === "sorte"
                  ? "bg-green-500/10"
                  : "bg-red-500/10"
              }`}
            >
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
