"use client";

import Especiais from "@/components/Especiais";
import Inicio from "@/components/Inicio";
import Loja from "@/components/Loja";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { connectSocket, disconnectSocket, onReconnect, clearReconnectCallbacks, useCardStore } from "@/stores/socketStore";
import { setRoomToken } from "@/stores/roomTokenStore";
import { useSession } from "@/hooks/useApi";
import { sessionsApi } from "@/services/api/sessions";
import { Menu } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import Historico from "@/components/Historico";
import Modal from "@/components/Modal";
import ConfirmationModal from "@/components/ConfirmationModal";
import Chat from "@/components/Chat";
import NegotiationResponseModal from "@/components/NegotiationResponseModal";
import Link from "next/link";
import Loading from "@/components/Loading";
import Button1 from "@/components/Button01";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPowerOff, faPlay, faUsers, faClock, faArrowLeft, faGamepad } from "@fortawesome/free-solid-svg-icons";
import type { PlayerColor } from "@/types/game";
import { PLAYER_COLORS } from "@/types/game";

const linksNav = ["Início", "Loja", "Especiais", "Histórico"];

export default function Game() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [abaAtual, setAbaAtual] = useState("Início");
  const [endLoading, setEndLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [quitLoading, setQuitLoading] = useState(false);
  const [menuModal, setMenuModal] = useState(false);
  const [showQuitModal, setShowQuitModal] = useState(false);

  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId ? Number(params.sessionId) : null;

  // SWR busca e mantém a sessão atualizada via API (fallback)
  const { session: swrSession, isLoading, isError, mutate } = useSession(sessionId);

  // Store Zustand — usada pelos componentes filhos
  const { currentSession, endSession, startSession } = useGameStore();
  const { user: authUser, loadFromStorage: loadAuth } = useAuthStore();

  // Carrega authUser do localStorage (substitui o auto-load removido do authStore)
  useEffect(() => { loadAuth(); }, [loadAuth]);

  const isOwner = !!currentSession?.ownerId && !!authUser?.id && currentSession.ownerId === authUser.id;

  // ─── WebSocket ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    connectSocket(sessionId);
    onReconnect(() => mutate());
    return () => {
      clearReconnectCallbacks();
      disconnectSocket();
    };
  }, [sessionId, mutate]);

  // ─── Card drawn → toast broadcast ──────────────────────────────────────
  useEffect(() => {
    const unsub = useCardStore.subscribe((state, prev) => {
      if (state.events.length > prev.events.length) {
        const last = state.events[state.events.length - 1];
        if (last.effectDescription) {
          const msg = `${last.playerNome} ${last.effectDescription.replace(last.playerNome + " ", "")}`;
          toastSuccess(msg);
        }
      }
    });
    return unsub;
  }, [toastSuccess]);

  // ─── SWR → Zustand (fallback) ────────────────────────────────────────────
  useEffect(() => {
    if (swrSession) {
      useGameStore.setState({ currentSession: swrSession });
    }
  }, [swrSession]);

  // Restaura a aba salva no localStorage
  useEffect(() => {
    setAbaAtual(localStorage.getItem("abaAtual") || "Início");
  }, []);

  // Redireciona se não conseguir carregar a sessão (404, 401, 403), não em erro de rede
  useEffect(() => {
    if (isLoading) return;
    if (!swrSession && isError) {
      if (endLoading) return;
      const axiosError = isError as { response?: { status?: number } };
      const status = axiosError?.response?.status;
      if (!status || (status !== 404 && status !== 401 && status !== 403)) return;
      setRoomToken(null);
      disconnectSocket();
      const msg =
        status === 401 ? "Acesso não autorizado a esta sala" :
        status === 403 ? "Você não tem permissão para acessar esta sala" :
        "Sessão não encontrada";
      toastError(msg);
      router.push("/sessions");
    }
  }, [isLoading, swrSession, isError, router, endLoading, toastError]);

  const handleEndGame = async () => {
    if (!currentSession) return;
    if (!window.confirm("Tem certeza que deseja finalizar este jogo? Esta ação não pode ser desfeita."))
      return;
    setEndLoading(true);
    await endSession(currentSession.id);
    toastSuccess("Jogo finalizado com sucesso!");
    setEndLoading(false);
    router.push("/");
  };

  const handleQuit = async () => {
    if (!currentSession) return;

    if (currentSession.status === "Em Andamento") {
      setShowQuitModal(true);
      return;
    }

    setQuitLoading(true);
    try {
      await sessionsApi.quit(currentSession.id);
      setRoomToken(null);
      disconnectSocket();
      toastSuccess("Você saiu da sala.");
      router.push("/sessions");
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Erro ao sair da sala";
      toastError(msg);
    } finally {
      setQuitLoading(false);
    }
  };

  const confirmQuitInProgress = async () => {
    if (!currentSession) return;
    setShowQuitModal(false);
    setQuitLoading(true);
    try {
      await sessionsApi.quit(currentSession.id);
      setRoomToken(null);
      disconnectSocket();
      toastSuccess("Você saiu da sala.");
      router.push("/sessions");
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Erro ao sair da sala";
      toastError(msg);
    } finally {
      setQuitLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!currentSession) return;
    setStartLoading(true);
    try {
      await startSession(currentSession.id);
      toastSuccess("Jogo iniciado!");
      mutate();
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Erro ao iniciar jogo";
      toastError(msg);
    } finally {
      setStartLoading(false);
    }
  };

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const statusColors: Record<string, string> = {
    "Esperando": "text-amber-400 bg-amber-500/10 border-amber-500/30",
    "Em Andamento": "text-green-400 bg-green-500/10 border-green-500/30",
    "Finalizada": "text-red-400 bg-red-500/10 border-red-500/30",
  };

  // ── Waiting Room ────────────────────────────────────────────────────────
  function renderWaitingRoom() {
    if (!currentSession) return null;
    const jogadores = currentSession.jogadores || [];
    const times = currentSession.times || [];
    const isDuplas = currentSession.modo === "duplas";

    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center mb-8">
          <FontAwesomeIcon icon={faGamepad} className="text-6xl text-green-500 mb-4" />
          <h2 className="text-3xl font-jaro text-zinc-100 mb-2">{currentSession.nome || "Sala sem nome"}</h2>
          <p className="text-zinc-500 font-inconsolata mb-4">
            {formatDate(currentSession.dataInicio)}
          </p>
          <div className="flex justify-center gap-4 mb-6">
            <span className={`px-4 py-1.5 rounded-full text-sm font-inconsolata border ${statusColors["Esperando"]}`}>
              Aguardando Jogadores
            </span>
            <span className="px-4 py-1.5 bg-zinc-800 text-zinc-300 rounded-full text-sm font-inconsolata capitalize">
              {isDuplas ? `${times.length} times` : "Individual"}
            </span>
          </div>

          <div className="flex justify-center gap-6 text-zinc-400 font-inconsolata text-sm mb-8">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faUsers} />
              <span>{jogadores.length}/{currentSession.maxJogadores || "?"} jogadores</span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faClock} />
              <span>Saldo inicial: R$ {(currentSession.saldoInicial || 25000).toLocaleString()}</span>
            </div>
          </div>

          {isOwner && (
            <Button1
              size="lg"
              color="green"
              handle={startLoading ? undefined : handleStartGame}
              disabled={startLoading}
              className="w-full max-w-xs mx-auto mb-3"
            >
              <FontAwesomeIcon icon={faPlay} className="mr-2" />
              {startLoading ? "Iniciando..." : "Iniciar Jogo"}
            </Button1>
          )}

          {isOwner && (
            <Button1
              size="lg"
              color="red"
              handle={endLoading ? undefined : handleEndGame}
              disabled={endLoading}
              className="w-full max-w-xs mx-auto mb-3"
            >
              <FontAwesomeIcon icon={faPowerOff} className="mr-2" />
              Finalizar Sala
            </Button1>
          )}

          <Button1
            size="lg"
            color="red"
            handle={quitLoading ? undefined : handleQuit}
            disabled={quitLoading}
            className="w-full max-w-xs mx-auto"
          >
            Sair da Sala
          </Button1>
        </div>

        {/* Players list */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-xl font-jaro text-zinc-100 mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faUsers} className="text-green-500" />
            Jogadores ({jogadores.length}/{currentSession.maxJogadores || "?"})
          </h3>

          {jogadores.length === 0 ? (
            <p className="text-zinc-500 font-inconsolata text-center py-8">
              Nenhum jogador ainda. Compartilhe o link da sala!
            </p>
          ) : (
            <div className="space-y-3">
              {isDuplas && times.length > 0 ? (
                times.map((team) => {
                  const teamPlayers = jogadores.filter(j => j.teamId === team.id);
                  const teamColor = PLAYER_COLORS.find(c => c.value === team.cor);
                  return (
                    <div key={team.id} className="border border-zinc-700 rounded-lg overflow-hidden">
                      <div className={`px-4 py-2 flex items-center gap-2 ${teamColor?.bg || 'bg-zinc-700'}`}>
                        <span className="text-white font-semibold font-jaro text-sm">{team.nome}</span>
                        <span className="text-white/70 text-xs font-inconsolata ml-auto">
                          {teamPlayers.length} jogador{teamPlayers.length !== 1 ? 'es' : ''}
                        </span>
                      </div>
                      {teamPlayers.map((p) => {
                        const pColor = PLAYER_COLORS.find(c => c.value === p.cor);
                        return (
                          <div key={p.id} className="px-4 py-3 bg-zinc-950/50 flex items-center gap-3 border-t border-zinc-800">
                            <div className={`w-8 h-8 rounded-full ${pColor?.bg || 'bg-zinc-600'} flex items-center justify-center`}>
                              <span className="text-white text-sm font-bold">{p.nome.charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="text-zinc-100 font-inconsolata">{p.nome}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                jogadores.map((p) => {
                  const pColor = PLAYER_COLORS.find(c => c.value === p.cor);
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 bg-zinc-950/50 rounded-lg border border-zinc-800">
                      <div className={`w-10 h-10 rounded-full ${pColor?.bg || 'bg-zinc-600'} flex items-center justify-center`}>
                        <span className="text-white text-sm font-bold">{p.nome.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <span className="text-zinc-100 font-inconsolata font-medium">{p.nome}</span>
                        <span className="text-zinc-500 text-sm ml-2 font-inconsolata">
                          Saldo: R$ {(p.saldo || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {isDuplas && times.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mt-4">
            <h3 className="text-xl font-jaro text-zinc-100 mb-4">Times</h3>
            <div className="grid grid-cols-2 gap-3">
              {times.map((team) => {
                const tColor = PLAYER_COLORS.find(c => c.value === team.cor);
                return (
                  <div key={team.id} className={`p-4 rounded-lg border ${tColor?.border || 'border-zinc-700'} bg-zinc-950/50`}>
                    <div className={`text-sm font-bold ${tColor?.text || 'text-zinc-300'} font-jaro mb-1`}>
                      {team.nome}
                    </div>
                    <div className="text-zinc-500 text-xs font-inconsolata">
                      {jogadores.filter(j => j.teamId === team.id).length} jogador(es)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const renderConteudo = () => {
    if (!currentSession) return null;

    if (currentSession.status === "Esperando") {
      return renderWaitingRoom();
    }

    switch (abaAtual) {
      case "Início":       return <Inicio isOwner={isOwner} onNavigate={(tab) => { localStorage.setItem("abaAtual", tab); setAbaAtual(tab); }} />;
      case "Loja":         return <Loja />;
      case "Especiais":    return <Especiais />;
      case "Histórico":    return <Historico />;
      default:             return <Inicio isOwner={isOwner} onNavigate={(tab) => { localStorage.setItem("abaAtual", tab); setAbaAtual(tab); }} />;
    }
  };

  if (isLoading || !currentSession) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
          <p className="text-zinc-400">Carregando sessão...</p>
        </div>
      </div>
    );
  }

  const isWaiting = currentSession.status === "Esperando";

  return (
    <main className="w-full flex flex-col px-4 pb-6 min-h-screen bg-zinc-950">
      <header className="w-full py-2 flex flex-col items-center">
        <Link
          href={"/"}
          className="mt-4 text-4xl font-jaro font-bold bg-linear-to-r from-green-500 to-amber-400 bg-clip-text text-transparent"
        >
          GameBank
        </Link>

        <div className="w-full flex lg:flex-col justify-between items-center mt-4 lg:mt-1">
          {!isWaiting && (
            <div className="w-full flex lg:justify-end items-center space-x-3">
              <Button1
                size="md"
                color="red"
                handle={quitLoading ? undefined : handleQuit}
                disabled={quitLoading}
              >
                Sair
              </Button1>
              {isOwner && (
                <Button1
                  size="md"
                  color="red"
                  handle={endLoading ? undefined : handleEndGame}
                  disabled={endLoading}
                  className="flex flex-row gap-2"
                >
                  <FontAwesomeIcon icon={faPowerOff} className="mr-2" />
                  Finalizar
                </Button1>
              )}
            </div>
          )}

          {!isWaiting && (
            <nav className="w-full mt-10 hidden lg:flex">
              <ul className="w-full grid grid-cols-4 justify-center">
                {linksNav.map((link, index) => (
                  <li
                    key={index}
                    onClick={() => {
                      localStorage.setItem("abaAtual", link);
                      setAbaAtual(link);
                    }}
                    className={`h-10 flex justify-center items-center hover:bg-green-500/20 text-lg font-inconsolata transition-colors cursor-pointer ${
                      abaAtual === link
                        ? "border-b border-green-500/50 font-bold text-green-400"
                        : "text-zinc-500"
                    }`}
                  >
                    {link}
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {!isWaiting && (
            <button onClick={() => setMenuModal(true)} className="lg:hidden">
              <Menu className="w-8 h-8 text-zinc-300" />
            </button>
          )}
        </div>
      </header>

      <section className="mt-8">
        {!isWaiting && (
          <div className="w-full flex flex-col my-4 border-b border-zinc-800 pb-4">
            <h1 className="text-2xl font-jaro font-semibold text-zinc-100">
              {currentSession.nome}
            </h1>
            <p className="text-zinc-400 font-inconsolata">
              {formatDate(currentSession.dataInicio)} - Jogadores:{" "}
              {currentSession.jogadores.length}
            </p>
          </div>
        )}

        {renderConteudo()}
      </section>

      <Modal
        size="md"
        title="Menu"
        isOpen={menuModal}
        onClose={() => setMenuModal(false)}
      >
        <ul className="w-full grid grid-rows-4 justify-center">
          {linksNav.map((link, index) => (
            <li
              key={index}
              onClick={() => {
                localStorage.setItem("abaAtual", link);
                setAbaAtual(link);
                setMenuModal(false);
              }}
              className={`h-10 flex justify-center items-center hover:bg-purple-500/20 transition-colors cursor-pointer font-jaro ${
                abaAtual === link
                  ? "border-b border-purple-500 font-bold text-purple-400"
                  : "text-zinc-500"
              }`}
            >
              {link}
            </li>
          ))}
        </ul>
      </Modal>

      {endLoading && <Loading label="Finalizando..." />}
      {startLoading && <Loading label="Iniciando..." />}

      <NegotiationResponseModal />

      <Chat />

      <ConfirmationModal
        isOpen={showQuitModal}
        onClose={() => setShowQuitModal(false)}
        onConfirm={confirmQuitInProgress}
        title="Sair da Partida?"
        message="Você está em uma partida em andamento. Todas as suas propriedades serão perdidas (casas zeradas, propriedades liberadas) e seu saldo será zerado. Esta ação não pode ser desfeita."
        confirmText="Sair e Perder Tudo"
        cancelText="Cancelar"
        color="red"
        loading={quitLoading}
      />
    </main>
  );
}
