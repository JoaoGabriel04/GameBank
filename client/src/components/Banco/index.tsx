"use client";

import { useState, useMemo } from "react";
import Modal from "../Modal";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { PROPERTY_COLORS } from "@/types/game";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useToast } from "@/components/Toast";
import { sortSessionPosses } from "@/utils/properties";
import { ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Receipt } from "lucide-react";

export default function Banco() {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast()
  const authUser = useAuthStore((s) => s.user)

  const {
    currentSession,
    loadSession,
    deposito,
    saque,
    transferencia,
    aluguel,
    aluguelAcao,
    getAluguel,
  } = useGameStore();

  const currentPlayer = useMemo(
    () => currentSession?.jogadores.find((p) => p.userId === authUser?.id) ?? null,
    [currentSession?.jogadores, authUser?.id]
  )

  const [modalDeposito, setModalDeposito] = useState(false);
  const [modalSaque, setModalSaque] = useState(false);
  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [modalAlguel, setModalAluguel] = useState(false);

  const [selectedRecipient, setSelectedRecipient] = useState<number | null>(null);
  const [selectedPropriedade, setSelectedPropriedade] = useState<number | null>(null);
  const [valorOperacao, setValorOperacao] = useState(0);
  const [numeroDados, setNumeroDados] = useState(0);

  const [reqLoading, setReqLoading] = useState(false);

  const jogadores = useMemo(() => currentSession?.jogadores ?? [], [currentSession?.jogadores])

  function resetarValores() {
    setSelectedRecipient(null);
    setSelectedPropriedade(null);
    setValorOperacao(0);
    setNumeroDados(0);
  }

  function getBorderClass(grupo_cor?: string) {
    if (!grupo_cor) return "border-zinc-600 border-2";
    const colorInfo = PROPERTY_COLORS.find((c) => c.value === grupo_cor);
    if (!colorInfo) return "border-zinc-600 border-2";
    return `${colorInfo.border} border-t-4 border-2`;
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  async function depositar(valor: number) {
    if (!currentPlayer || valor <= 0)
      return toastError("Campos vazios ou valor inválido!");
    if (!currentSession) return;
    if (valor >= 10000000) return toastWarning("Valor muito alto!");

    try {
      setReqLoading(true);
      await deposito({ userId: currentPlayer.id, sessionId: currentSession.id, valor });

      await loadSession(currentSession.id);
      toastSuccess("Depósito realizado com sucesso!");
      setModalDeposito(false);
      resetarValores();
    } catch {
      toastError("Erro no depósito!");
      setModalDeposito(false);
      resetarValores();
    } finally {
      setReqLoading(false);
    }
  }

  async function retirar(valor: number) {
    if (!currentPlayer || valor <= 0)
      return toastError("Campos vazios ou valor inválido!");
    if (!currentSession) return;
    if (currentPlayer.saldo < valor) return toastError("Saldo insuficiente!");

    try {
      setReqLoading(true);
      await saque({ userId: currentPlayer.id, sessionId: currentSession.id, valor });

      await loadSession(currentSession.id);
      toastSuccess("Saque realizado com sucesso!");
      setModalSaque(false);
      resetarValores();
    } catch {
      toastError("Erro no saque!");
      setModalSaque(false);
      resetarValores();
    } finally {
      setReqLoading(false);
    }
  }

  async function transferir(recebedor: number | null, valor: number) {
    if (!currentPlayer || recebedor == null || valor <= 0)
      return toastError("Campos vazios ou valor inválido!");
    if (!currentSession) return;
    if (currentPlayer.saldo < valor) return toastError("Saldo insuficiente!");
    if (currentPlayer.id === recebedor)
      return toastError("Você não pode transferir para si mesmo!");

    try {
      setReqLoading(true);
      await transferencia({
        recebedorId: recebedor,
        pagadorId: currentPlayer.id,
        sessionId: currentSession.id,
        valor,
      });

      await loadSession(currentSession.id);
      toastSuccess("Transferência realizada com sucesso!");
      setModalTransferencia(false);
      resetarValores();
    } catch {
      toastError("Erro na transferência!");
      setModalTransferencia(false);
      resetarValores();
    } finally {
      setReqLoading(false);
    }
  }

  async function pagarAluguel(propriedadeId: number | undefined) {
    if (!currentPlayer || !propriedadeId) return toastError("Campos vazios!");
    if (!currentSession) return;

    const selectedProp = currentSession.sessionPosses.find(p => p.id === propriedadeId)
    if (!selectedProp) return toastError("Propriedade não encontrada!");

    try {
      setReqLoading(true);

      if (selectedProp.posses?.propriedade?.tipo === "ação") {
        await aluguelAcao({
          sessionId: currentSession.id,
          pagadorId: currentPlayer.id,
          sessionPossesId: propriedadeId,
          numDados: numeroDados,
        });
      } else {
        await aluguel({
          sessionId: currentSession.id,
          pagadorId: currentPlayer.id,
          sessionPossesId: propriedadeId,
        });
      }

      await loadSession(currentSession.id);
      toastSuccess("Aluguel pago com sucesso!");
      setModalAluguel(false);
      resetarValores();
    } catch {
      toastError("Erro ao pagar o aluguel.");
      setModalAluguel(false);
      resetarValores();
    } finally {
      setReqLoading(false);
    }
  }

  const selectedPropData = useMemo(() => {
    if (!selectedPropriedade || !currentSession) return null
    const sp = currentSession.sessionPosses.find(p => p.id === selectedPropriedade)
    if (!sp) return null
    return { sessionPosses: sp, propriedade: sp.posses?.propriedade ?? null }
  }, [selectedPropriedade, currentSession?.sessionPosses])

  return (
    <main className="w-full px-10">
      <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setModalDeposito(true)}
          className="w-full min-w-[200px] bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden hover:border-green-500 transition-colors cursor-pointer"
        >
          <div className="h-1.5 w-full bg-green-500" />
          <div className="p-4 flex flex-col items-center gap-2">
            <ArrowDownToLine className="w-8 h-8 text-green-500" />
            <span className="text-zinc-100 font-jaro text-lg">Depositar</span>
            <span className="text-zinc-500 text-xs font-inconsolata text-center">
              Adicione saldo ao jogador
            </span>
          </div>
        </button>

        <button
          onClick={() => setModalSaque(true)}
          className="w-full min-w-[200px] bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden hover:border-red-500 transition-colors cursor-pointer"
        >
          <div className="h-1.5 w-full bg-red-500" />
          <div className="p-4 flex flex-col items-center gap-2">
            <ArrowUpFromLine className="w-8 h-8 text-red-500" />
            <span className="text-zinc-100 font-jaro text-lg">Retirar</span>
            <span className="text-zinc-500 text-xs font-inconsolata text-center">
              Retire saldo do jogador
            </span>
          </div>
        </button>

        <button
          onClick={() => setModalTransferencia(true)}
          className="w-full min-w-[200px] bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden hover:border-sky-500 transition-colors cursor-pointer"
        >
          <div className="h-1.5 w-full bg-sky-500" />
          <div className="p-4 flex flex-col items-center gap-2">
            <ArrowRightLeft className="w-8 h-8 text-sky-500" />
            <span className="text-zinc-100 font-jaro text-lg">Transferir</span>
            <span className="text-zinc-500 text-xs font-inconsolata text-center">
              Mova dinheiro entre jogadores
            </span>
          </div>
        </button>

        <button
          onClick={() => setModalAluguel(true)}
          className="w-full min-w-[200px] bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden hover:border-amber-500 transition-colors cursor-pointer"
        >
          <div className="h-1.5 w-full bg-amber-500" />
          <div className="p-4 flex flex-col items-center gap-2">
            <Receipt className="w-8 h-8 text-amber-500" />
            <span className="text-zinc-100 font-jaro text-lg">Pagar Aluguel</span>
            <span className="text-zinc-500 text-xs font-inconsolata text-center">
              Pague aluguel de propriedade
            </span>
          </div>
        </button>
      </nav>

      {/* Modal Depósito */}
      <Modal
        size="md"
        title="Depósito"
        isOpen={modalDeposito}
        onClose={() => setModalDeposito(false)}
      >
        <p className="mb-3 font-inconsolata text-zinc-300">
          Depositar para: <span className="text-zinc-100 font-semibold">{currentPlayer?.nome ?? "—"}</span>
        </p>

        <label className="block text-sm font-inconsolata text-zinc-400 mb-1">Valor do depósito:</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={7}
          value={String(valorOperacao)}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/\D/g, "").slice(0, 7);
            setValorOperacao(cleaned ? Number(cleaned) : 0);
          }}
          className="bg-zinc-400/20 py-1 px-2 rounded w-full text-zinc-100 font-inconsolata"
        />

        <div className="w-full flex justify-center items-center mt-5">
          <button
            disabled={reqLoading || !currentPlayer || valorOperacao <= 0}
            onClick={() => depositar(valorOperacao)}
            className="px-16 py-1 bg-green-500 hover:bg-green-600 text-white rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reqLoading ? "Depositando..." : "Confirmar"}
          </button>
        </div>
      </Modal>

      {/* Modal Saque */}
      <Modal
        size="md"
        title="Saque"
        isOpen={modalSaque}
        onClose={() => setModalSaque(false)}
      >
        <p className="mb-3 font-inconsolata text-zinc-300">
          Sacar de: <span className="text-zinc-100 font-semibold">{currentPlayer?.nome ?? "—"}</span>
        </p>

        <label className="block text-sm font-inconsolata text-zinc-400 mb-1">Valor do saque:</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={7}
          value={String(valorOperacao)}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/\D/g, "").slice(0, 7);
            setValorOperacao(cleaned ? Number(cleaned) : 0);
          }}
          className="bg-zinc-400/20 py-1 px-2 rounded w-full text-zinc-100 font-inconsolata"
        />

        <div className="w-full flex justify-center items-center mt-5">
          <button
            disabled={reqLoading || !currentPlayer || valorOperacao <= 0}
            onClick={() => retirar(valorOperacao)}
            className="px-16 py-1 bg-green-500 hover:bg-green-600 text-white rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reqLoading ? "Sacando..." : "Confirmar"}
          </button>
        </div>
      </Modal>

      {/* Modal Transferência */}
      <Modal
        size="md"
        title="Transferência"
        isOpen={modalTransferencia}
        onClose={() => setModalTransferencia(false)}
      >
        <p className="mb-3 font-inconsolata text-zinc-300">
          Pagador: <span className="text-zinc-100 font-semibold">{currentPlayer?.nome ?? "—"}</span>
        </p>

        <label className="block text-sm font-inconsolata text-zinc-400 mb-1">Recebedor:</label>
        <Select
          onValueChange={(value) => setSelectedRecipient(Number(value))}
          value={selectedRecipient?.toString()}
        >
          <SelectTrigger className="w-full bg-zinc-900 border-zinc-700 text-zinc-100">
            <SelectValue placeholder="Selecione o recebedor" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            {jogadores
              .filter((p) => p.id !== currentPlayer?.id)
              .map((player) => (
                <SelectItem key={player.id} value={String(player.id)}>
                  {player.nome}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <label className="block text-sm font-inconsolata text-zinc-400 mt-4 mb-1">Valor:</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={7}
          value={String(valorOperacao)}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/\D/g, "").slice(0, 7);
            setValorOperacao(cleaned ? Number(cleaned) : 0);
          }}
          className="bg-zinc-400/20 py-1 px-2 rounded w-full text-zinc-100 font-inconsolata"
        />

        <div className="w-full flex justify-center items-center mt-5">
          <button
            disabled={reqLoading || !currentPlayer || !selectedRecipient || valorOperacao <= 0}
            onClick={() => transferir(selectedRecipient, valorOperacao)}
            className="px-16 py-1 bg-green-500 hover:bg-green-600 text-white rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reqLoading ? "Transferindo..." : "Confirmar"}
          </button>
        </div>
      </Modal>

      {/* Modal Pagar Aluguel */}
      <Modal
        size="md"
        title="Pagar Aluguel"
        isOpen={modalAlguel}
        onClose={() => {
          setModalAluguel(false);
          resetarValores();
        }}
      >
        <p className="mb-3 font-inconsolata text-zinc-300">
          Pagador: <span className="text-zinc-100 font-semibold">{currentPlayer?.nome ?? "—"}</span>
        </p>

        <label className="block text-sm font-inconsolata text-zinc-400 mb-1">
          Selecione a propriedade que o jogador caiu:
        </label>
        <Select
          onValueChange={(value) => setSelectedPropriedade(Number(value))}
          value={selectedPropriedade?.toString()}
        >
          <SelectTrigger className="w-full bg-zinc-900 border-zinc-700 text-zinc-100">
            <SelectValue placeholder="Selecione a propriedade" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            {sortSessionPosses(
              currentSession?.sessionPosses ?? []
            )
              .filter((p) => !!p.playerId)
              .filter((p) => p.playerId !== currentPlayer?.id)
              .map((poss) => {
                const propData = poss.posses?.propriedade;
                const label = propData?.nome ?? `Propriedade #${poss.possesId}`;
                return (
                  <SelectItem key={poss.id} value={String(poss.id)}>
                    {label}
                  </SelectItem>
                );
              })}
          </SelectContent>
        </Select>

        {/* Input para ações */}
        {selectedPropData?.propriedade?.tipo === "ação" && (
          <div className="mt-4">
            <label className="block text-sm font-inconsolata text-zinc-400 mb-1">
              Número tirado nos dados:
            </label>
            <input
              type="number"
              value={numeroDados}
              onChange={(e) => setNumeroDados(Number(e.target.value))}
              className="bg-zinc-400/20 py-1 px-2 rounded w-full"
            />
          </div>
        )}

        {/* Card de informação da propriedade */}
        {selectedPropData && (() => {
          const { sessionPosses: sp, propriedade: propData } = selectedPropData
          const casas = sp.casas ?? 0;
          const aluguelAtual = propData ? getAluguel(propData, casas) : 0;
          const borderClass = getBorderClass(propData?.grupo_cor);

          return (
            <div className={`mt-4 p-3 rounded-md bg-zinc-800 ${borderClass}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg text-zinc-100">
                    {propData?.nome ?? `Propriedade #${sp.possesId}`}
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Cor: {propData?.grupo_cor ?? "—"}
                  </p>
                  <p className="text-sm text-zinc-400">Casas: {casas}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-zinc-500">Aluguel atual</div>
                  <div className="text-xl font-bold text-green-400">
                    {formatCurrency(aluguelAtual)}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="w-full flex justify-center items-center mt-4">
          <button
            onClick={() => pagarAluguel(selectedPropriedade ?? undefined)}
            disabled={reqLoading || !currentPlayer || !selectedPropriedade}
            className="px-16 py-1 bg-green-500 hover:bg-green-600 text-white rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reqLoading ? "Pagando..." : "Confirmar"}
          </button>
        </div>
      </Modal>
    </main>
  );
}
