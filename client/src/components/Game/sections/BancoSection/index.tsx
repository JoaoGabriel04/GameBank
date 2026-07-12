"use client";

import { useState, useMemo } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, LoaderCircle } from "lucide-react";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/utils/format";
import { toApiErr } from "@/lib/api-error";
import { getAccentHex } from "@/components/Game/sections/shared";
import { sortPropItems, getPropData } from "@/utils/properties";
import type { Player, SessionPropriedade, Propriedade } from "@/types/game";
import Modal from "@/components/Modal";
import PlayerCard from "@/components/PlayerCard";
import UserBadge from "@/components/UserBadge";

type Props = {
  currentPlayer: Player | null | undefined;
  isOwner: boolean;
  onNavigate?: (tab: string) => void;
};

function ValorInput({ value, onChange, max }: { value: number; onChange: (v: number) => void; max?: number }) {
  const QUICK_VALUES = [100, 500, 2000, 5000, 10000, 50000, 100000];
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
  );
}

function PropertyCard({ item, selected, onClick, getAluguel, owner }: {
  item: { sessionProp: SessionPropriedade; prop: Propriedade };
  selected: boolean;
  onClick: () => void;
  getAluguel: (prop: Propriedade, casas: number) => number;
  owner?: Player | null;
}) {
  const accent = getAccentHex(item.prop.grupo_cor);
  const casas = item.sessionProp.casas ?? 0;
  const aluguelValor = getAluguel(item.prop, casas);
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
        {owner && (
          <div className="flex items-center gap-1 mt-2 text-[10px] font-inconsolata text-zinc-500">
            Dono: <UserBadge badge={owner.badge} imageUrl={owner.badgeImageUrl} variant="micro" />
            <span className="text-zinc-400">{owner.nome}</span>
          </div>
        )}
      </div>
    </button>
  );
}

export default function BancoSection({ currentPlayer, onNavigate }: Props) {
  const { success: toastSuccess, error: toastError, warning: toastWarning, info: toastInfo } = useToast();
  const { currentSession, loadSession, getAluguel, deposito, saque, transferencia, aluguel, aluguelAcao, pagarDivida } = useGameStore();
  const { user: authUser } = useAuthStore();

  const [activeModal, setActiveModal] = useState<"deposito" | "saque" | "transferencia" | "aluguel" | null>(null);
  const [valor, setValor] = useState(0);
  const [selectedRecipient, setSelectedRecipient] = useState<number | null>(null);
  const [selectedRentProp, setSelectedRentProp] = useState<number | null>(null);
  const [numDados, setNumDados] = useState(0);
  const [reqLoading, setReqLoading] = useState(false);

  const isSpectator = !!currentPlayer?.desistiu;
  const isTabuleiro = currentSession?.tipoJogo === "tabuleiro";

  const jogadores = useMemo(() => currentSession?.jogadores ?? [], [currentSession?.jogadores]);

  const myDebts = useMemo(
    () => (currentSession?.debts ?? []).filter((d) => d.playerId === currentPlayer?.id && !d.pago),
    [currentSession?.debts, currentPlayer?.id]
  );

  const rentableProps = useMemo(() => {
    if (!currentSession) return [];
    return sortPropItems(
      currentSession.sessionPosses
        .filter((p) => !!p.playerId && p.playerId !== currentPlayer?.id)
        .map((sp) => ({ sessionProp: sp, prop: getPropData(sp) }))
        .filter((item): item is { sessionProp: typeof item.sessionProp; prop: NonNullable<ReturnType<typeof getPropData>> } => item.prop !== null)
    );
  }, [currentSession, currentPlayer?.id]);

  const selectedRentData = useMemo(() => {
    if (!selectedRentProp || !currentSession) return null;
    const sp = currentSession.sessionPosses.find((p) => p.id === selectedRentProp);
    if (!sp) return null;
    const prop = getPropData(sp);
    if (!prop) return null;
    return { sessionProp: sp, prop };
  }, [selectedRentProp, currentSession]);

  function closeModal() {
    setActiveModal(null);
    setValor(0);
    setSelectedRecipient(null);
    setSelectedRentProp(null);
    setNumDados(0);
  }

  async function handleDeposito() {
    if (!currentPlayer || valor <= 0) return toastWarning("Valor inválido!");
    if (!currentSession) return;
    if (valor >= 10000000) return toastWarning("Valor muito alto!");
    setReqLoading(true);
    try {
      await deposito({ userId: currentPlayer.id, sessionId: currentSession.id, valor });
      await loadSession(currentSession.id);
      toastSuccess("Depósito realizado!");
      closeModal();
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.message ?? "Erro no depósito";
      if ((e?.response?.status ?? 0) >= 500) { toastError(msg); } else { toastWarning(msg); }
      closeModal();
    } finally {
      setReqLoading(false);
    }
  }

  async function handleSaque() {
    if (!currentPlayer || valor <= 0) return toastWarning("Valor inválido!");
    if (!currentSession) return;
    if (currentPlayer.saldo < valor) return toastWarning("Saldo insuficiente!");
    setReqLoading(true);
    try {
      await saque({ userId: currentPlayer.id, sessionId: currentSession.id, valor });
      await loadSession(currentSession.id);
      toastSuccess("Saque realizado!");
      closeModal();
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.message ?? "Erro no saque";
      if ((e?.response?.status ?? 0) >= 500) { toastError(msg); } else { toastWarning(msg); }
      closeModal();
    } finally {
      setReqLoading(false);
    }
  }

  async function handleTransferencia() {
    if (!currentPlayer || selectedRecipient == null || valor <= 0) return toastWarning("Campos inválidos!");
    if (!currentSession) return;
    if (currentPlayer.saldo < valor) return toastWarning("Saldo insuficiente!");
    if (currentPlayer.id === selectedRecipient) return toastWarning("Não pode transferir para si mesmo!");
    setReqLoading(true);
    try {
      await transferencia({ pagadorId: currentPlayer.id, recebedorId: selectedRecipient, sessionId: currentSession.id, valor });
      await loadSession(currentSession.id);
      toastInfo("Transferência realizada!");
      closeModal();
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.message ?? "Erro na transferência";
      if ((e?.response?.status ?? 0) >= 500) { toastError(msg); } else { toastWarning(msg); }
      closeModal();
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

  async function handlePagarDivida(debtId: number, debtValor: number) {
    if (!currentPlayer || !currentSession) return;
    if (currentPlayer.saldo < debtValor) return toastWarning("Saldo insuficiente para pagar esta dívida!");
    setReqLoading(true);
    try {
      await pagarDivida(debtId, currentPlayer.id, currentSession.id);
      await loadSession(currentSession.id);
      toastInfo(`Dívida de R$ ${formatCurrency(debtValor)} paga!`);
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.message ?? "Erro ao pagar dívida";
      if ((e?.response?.status ?? 0) >= 500) { toastError(msg); } else { toastWarning(msg); }
    } finally {
      setReqLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {!isSpectator && (
        <>
          <div>
            <h4 className="text-xs font-inconsolata text-zinc-600 uppercase tracking-wider mb-2.5">Transações Bancárias</h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: ArrowDownToLine, label: "Depositar", modal: "deposito" as const, color: "text-green-400 bg-green-500/10" },
                { icon: ArrowUpFromLine, label: "Sacar", modal: "saque" as const, color: "text-red-400 bg-red-500/10" },
                { icon: ArrowRightLeft, label: "Transferir", modal: "transferencia" as const, color: "text-sky-400 bg-sky-500/10" },
              ].filter((a) => !(isTabuleiro && (a.modal === "deposito" || a.modal === "saque"))).map((action) => (
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

          {!isTabuleiro && (
            <div>
              <h4 className="text-xs font-inconsolata text-zinc-600 uppercase tracking-wider mb-2.5">Aluguel</h4>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => { setActiveModal("aluguel"); setNumDados(0); }}
                  className="flex flex-col items-center gap-2 p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-amber-400 bg-amber-500/10">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-inconsolata text-zinc-400 text-center leading-tight">Pagar Aluguel</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

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
                  disabled={reqLoading || !currentPlayer || currentPlayer.saldo < debt.valor}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-inconsolata rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
                >
                  {reqLoading ? "..." : `Pagar R$ ${formatCurrency(debt.valor)}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal size="md" title="Depositar" isOpen={activeModal === "deposito"} onClose={closeModal}>
        <div className="space-y-5">
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <span className="text-sm font-inconsolata text-zinc-400">Jogador</span>
            <span className="inline-flex items-center gap-1.5">
              {currentPlayer && <UserBadge badge={currentPlayer.badge} imageUrl={currentPlayer.badgeImageUrl} variant="micro" />}
              <span className="text-sm font-inconsolata text-zinc-100 font-semibold">{currentPlayer?.nome ?? "—"}</span>
            </span>
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

      <Modal size="md" title="Sacar" isOpen={activeModal === "saque"} onClose={closeModal}>
        <div className="space-y-5">
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <span className="text-sm font-inconsolata text-zinc-400">Jogador</span>
            <span className="inline-flex items-center gap-1.5">
              {currentPlayer && <UserBadge badge={currentPlayer.badge} imageUrl={currentPlayer.badgeImageUrl} variant="micro" />}
              <span className="text-sm font-inconsolata text-zinc-100 font-semibold">{currentPlayer?.nome ?? "—"}</span>
            </span>
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

      <Modal size="md" title="Transferir Dinheiro" isOpen={activeModal === "transferencia"} onClose={closeModal}>
        <div className="space-y-5">
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <span className="text-sm font-inconsolata text-zinc-400">Pagador</span>
            <span className="inline-flex items-center gap-1.5">
              {currentPlayer && <UserBadge badge={currentPlayer.badge} imageUrl={currentPlayer.badgeImageUrl} variant="micro" />}
              <span className="text-sm font-inconsolata text-zinc-100 font-semibold">{currentPlayer?.nome ?? "—"}</span>
            </span>
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

      <Modal size="md" title="Pagar Aluguel" isOpen={activeModal === "aluguel"} onClose={closeModal}>
        <div className="space-y-5">
          <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <span className="text-sm font-inconsolata text-zinc-400">Pagador</span>
            <span className="inline-flex items-center gap-1.5">
              {currentPlayer && <UserBadge badge={currentPlayer.badge} imageUrl={currentPlayer.badgeImageUrl} variant="micro" />}
              <span className="text-sm font-inconsolata text-zinc-100 font-semibold">{currentPlayer?.nome ?? "—"}</span>
            </span>
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
                      setSelectedRentProp(item.sessionProp.id);
                      setNumDados(0);
                    }}
                    getAluguel={getAluguel}
                    owner={currentSession?.jogadores?.find((j) => j.id === item.sessionProp.playerId)}
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

          {selectedRentData && (() => {
            const owner = currentSession?.jogadores?.find((j) => j.id === selectedRentData.sessionProp.playerId);
            return (
              <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-inconsolata text-zinc-200">{selectedRentData.prop.nome}</p>
                    <p className="text-xs font-inconsolata text-zinc-500">
                      {selectedRentData.prop.grupo_cor} · {selectedRentData.sessionProp.casas} casa(s)
                    </p>
                    {owner && (
                      <p className="text-[10px] font-inconsolata text-zinc-500 flex items-center gap-1 mt-1">
                        Dono: <UserBadge badge={owner.badge} imageUrl={owner.badgeImageUrl} variant="micro" />
                        <span className="text-zinc-400">{owner.nome}</span>
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-inconsolata text-zinc-500">Aluguel</p>
                    <p className="text-lg font-jaro font-semibold" style={{ color: getAccentHex(selectedRentData.prop.grupo_cor) }}>
                      R$ {formatCurrency(getAluguel(selectedRentData.prop, selectedRentData.sessionProp.casas))}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          <button
            onClick={handleAluguel}
            disabled={reqLoading || !currentPlayer || !selectedRentProp}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-jaro rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {reqLoading ? "Pagando..." : "Confirmar Pagamento"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
