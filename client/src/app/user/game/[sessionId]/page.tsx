"use client";

import Especiais from "@/components/Especiais";
import Inicio from "@/components/Inicio";
import Loja from "@/components/Loja";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";

import { connectSocket, disconnectSocket, onReconnect, clearReconnectCallbacks, onSessionClosed, clearSessionClosedCallbacks, useCardStore } from "@/stores/socketStore";
import { setRoomToken } from "@/stores/roomTokenStore";
import { useSession } from "@/hooks/useApi";
import { sessionsApi } from "@/services/api/sessions";
import { Eye, EyeOff } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import UserBanner from "@/components/UserBanner";
import UserBadge from "@/components/UserBadge";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import Historico from "@/components/Historico";
import Ranking from "@/components/Ranking";
import { formatCurrency } from "@/utils/format";
import ConfirmationModal from "@/components/ConfirmationModal";
import Chat from "@/components/Chat";
import NegotiationResponseModal from "@/components/NegotiationResponseModal";
import PodiumModal from "@/components/PodiumModal";
import Link from "next/link";
import Loading from "@/components/Loading";
import Button1 from "@/components/Button01";
import GameBottomNav from "@/components/GameBottomNav";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPowerOff, faPlay, faUsers, faClock, faGamepad } from "@fortawesome/free-solid-svg-icons";
import type { RankedPlayer, Player } from "@/types/game";
import { PLAYER_COLORS } from "@/types/game";

const linksNav = ["Loja", "Especiais", "Início", "Ranking", "Histórico"];

export default function Game() {
  const { success: toastSuccess, error: toastError, warning: toastWarning, info: toastInfo } = useToast();
  const [abaAtual, setAbaAtual] = useState("Início");
  const [endLoading, setEndLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [quitLoading, setQuitLoading] = useState(false);
  const [desistirLoading, setDesistirLoading] = useState(false);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [showDesistirModal, setShowDesistirModal] = useState(false);
  const [showSaldo, setShowSaldo] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [podiumData, setPodiumData] = useState<RankedPlayer[] | null>(null);

  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId ? Number(params.sessionId) : null;

  // SWR busca e mantém a sessão atualizada via API (fallback)
  const { session: swrSession, isLoading, isError, mutate } = useSession(sessionId);

  // Store Zustand — usada pelos componentes filhos
  const { currentSession, endSession, startSession, loadSession } = useGameStore();
  const { user: authUser, loadFromStorage: loadAuth } = useAuthStore();

  // Carrega authUser do localStorage (substitui o auto-load removido do authStore)
  useEffect(() => { loadAuth(); }, [loadAuth]);

  const isOwner = !!currentSession?.ownerId && !!authUser?.id && currentSession.ownerId === authUser.id;

  // ─── WebSocket ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    connectSocket(sessionId);
    onReconnect(() => mutate());
    onSessionClosed((ranking) => {
      setSessionEnded(true);
      if (ranking) setPodiumData(ranking);
      setRoomToken(null);
      mutate(undefined, { revalidate: false });
      useProfileStore.getState().clearProfile();
      clearReconnectCallbacks();
      disconnectSocket();
    });
    return () => {
      clearReconnectCallbacks();
      clearSessionClosedCallbacks();
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
          if (last.tipoBaralho === "reves") {
            toastError(msg);
          } else {
            toastSuccess(msg);
          }
        }
      }
    });
    return unsub;
  }, [toastSuccess, toastError]);

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
    if (isLoading || sessionEnded) return;
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
      router.push("/user/sessions");
    }
  }, [isLoading, sessionEnded, swrSession, isError, router, endLoading, toastError]);

  const handleEndGame = async () => {
    if (!currentSession) return;
    if (!window.confirm("Tem certeza que deseja finalizar este jogo? Esta ação não pode ser desfeita."))
      return;
    setEndLoading(true);
    await endSession(currentSession.id);
    setEndLoading(false);
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
      toastInfo("Você saiu da sala.");
      router.push("/user/sessions");
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Erro ao sair da sala";
      if (err?.response?.status >= 500) { toastError(msg); } else { toastWarning(msg); }
    } finally {
      setQuitLoading(false);
    }
  };

  const handleDesistir = async () => {
    if (!currentSession) return;
    setShowDesistirModal(true);
  };

  const confirmDesistir = async () => {
    if (!currentSession) return;
    setShowDesistirModal(false);
    setDesistirLoading(true);
    try {
      await sessionsApi.desistir(currentSession.id);
      await loadSession(currentSession.id);
      toastInfo("Você desistiu da partida. Agora você é um espectador.");
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Erro ao desistir da partida";
      if (err?.response?.status >= 500) { toastError(msg); } else { toastWarning(msg); }
    } finally {
      setDesistirLoading(false);
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
      toastInfo("Você saiu da sala.");
      router.push("/user/sessions");
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
      mutate();
      toastInfo("Jogo iniciado!");
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Erro ao iniciar jogo";
      if (err?.response?.status >= 500) { toastError(msg); } else { toastWarning(msg); }
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

  // ── Player Card for Waiting Room ────────────────────────────────────────
  function WaitingPlayerCard({ player }: { player: Player }) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-zinc-800">
        <UserBanner banner={player.banner} spriteId={player.spriteId} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(0deg,rgba(9,9,11,.85) 0%,transparent 60%)" }} />
        <div className="relative z-10 flex items-center gap-3 p-3">
          <UserAvatar avatarUrl={player.avatarUrl} avatarUpdatedAt={player.avatarUpdatedAt} nome={player.nome} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <UserBadge badge={player.badge} imageUrl={player.badgeImageUrl} variant="small" />
              <span className="text-zinc-100 font-inconsolata font-medium truncate">{player.nome}</span>
            </div>
            <span className="text-zinc-300 text-sm font-inconsolata">
              R$ {(player.saldo || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting Room ────────────────────────────────────────────────────────
  function renderWaitingRoom() {
    if (!currentSession) return null;
    const allPlayers = currentSession.jogadores || [];
    const activePlayers = allPlayers.filter((p) => !p.desistiu);
    const spectators = allPlayers.filter((p) => p.desistiu);
    const times = currentSession.times || [];
    const isDuplas = currentSession.modo === "duplas";

    const teamsWithPlayers = isDuplas
      ? new Set(activePlayers.map((p) => p.teamId).filter(Boolean)).size
      : 0;
    const canStart = isDuplas
      ? activePlayers.length >= 2 && teamsWithPlayers >= 2
      : activePlayers.length >= 2;

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
              <span>{activePlayers.length}/{currentSession.maxJogadores || "?"} jogadores</span>
            </div>
            {spectators.length > 0 && (
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span>{spectators.length} espectador{spectators.length !== 1 ? "es" : ""}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faClock} />
              <span>Saldo inicial: R$ {(currentSession.saldoInicial || 25000).toLocaleString()}</span>
            </div>
          </div>

          {isOwner && (
            <div className="w-full max-w-xs mx-auto mb-3">
              <Button1
                size="lg"
                color="green"
                handle={startLoading || !canStart ? undefined : handleStartGame}
                disabled={startLoading || !canStart}
                className="w-full"
              >
                <FontAwesomeIcon icon={faPlay} className="mr-2" />
                {startLoading ? "Iniciando..." : "Iniciar Jogo"}
              </Button1>
              {!canStart && (
                <p className="text-xs font-inconsolata text-zinc-500 text-center mt-1">
                  {isDuplas
                    ? teamsWithPlayers < 2
                      ? "Necessário pelo menos 2 times com jogadores"
                      : "Necessário pelo menos 2 jogadores"
                    : "Necessário pelo menos 2 jogadores"}
                </p>
              )}
            </div>
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

        {/* Active Players list */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-xl font-jaro text-zinc-100 mb-4 flex items-center gap-2">
            <FontAwesomeIcon icon={faUsers} className="text-green-500" />
            Jogadores ({activePlayers.length}/{currentSession.maxJogadores || "?"})
          </h3>

          {activePlayers.length === 0 ? (
            <p className="text-zinc-500 font-inconsolata text-center py-8">
              Nenhum jogador ainda. Compartilhe o link da sala!
            </p>
          ) : (
            <div className="space-y-3">
              {isDuplas && times.length > 0 ? (
                times.map((team) => {
                  const teamPlayers = activePlayers.filter(j => j.teamId === team.id);
                  const teamColor = PLAYER_COLORS.find(c => c.value === team.cor);
                  return (
                    <div key={team.id} className="border border-zinc-700 rounded-lg overflow-hidden">
                      <div className={`px-4 py-2 flex items-center gap-2 ${teamColor?.bg || 'bg-zinc-700'}`}>
                        <span className="text-white font-semibold font-jaro text-sm">{team.nome}</span>
                        <span className="text-white/70 text-xs font-inconsolata ml-auto">
                          {teamPlayers.length} jogador{teamPlayers.length !== 1 ? 'es' : ''}
                        </span>
                      </div>
                      {teamPlayers.map((p) => (
                        <div key={p.id} className="px-4 py-3 border-t border-zinc-800">
                          <WaitingPlayerCard player={p} />
                        </div>
                      ))}
                    </div>
                  );
                })
              ) : (
                activePlayers.map((p) => (
                  <WaitingPlayerCard key={p.id} player={p} />
                ))
              )}
            </div>
          )}
        </div>

        {/* Spectators list */}
        {spectators.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mt-4">
            <h3 className="text-xl font-jaro text-zinc-500 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Espectadores ({spectators.length})
            </h3>
            <div className="space-y-3">
              {spectators.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
                  <UserAvatar avatarUrl={p.avatarUrl} avatarUpdatedAt={p.avatarUpdatedAt} nome={p.nome} size="sm" />
                  <div className="flex items-center gap-1.5">
                    <UserBadge badge={p.badge} imageUrl={p.badgeImageUrl} variant="micro" />
                    <span className="text-zinc-400 font-inconsolata">{p.nome}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                      {activePlayers.filter(j => j.teamId === team.id).length} jogador(es)
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
      case "Ranking":      return <Ranking />;
      case "Histórico":    return <Historico />;
      default:             return <Inicio isOwner={isOwner} onNavigate={(tab) => { localStorage.setItem("abaAtual", tab); setAbaAtual(tab); }} />;
    }
  };

  if (sessionEnded) {
    return (
      <>
        {podiumData ? (
          <PodiumModal
            ranking={podiumData}
            userId={authUser?.id}
            onClose={() => router.push("/user/sessions")}
          />
        ) : (
          <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
            <div className="text-center max-w-md px-6">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
                <FontAwesomeIcon icon={faPowerOff} className="text-3xl text-zinc-500" />
              </div>
              <h2 className="text-3xl font-jaro text-zinc-100 mb-3">Sala Finalizada</h2>
              <p className="text-zinc-400 font-inconsolata mb-8">
                Esta sala foi encerrada. Volte para a lista de salas para entrar em outra partida.
              </p>
              <Button1 size="lg" color="green" handle={() => router.push("/user/sessions")}>
                Voltar para Salas
              </Button1>
            </div>
          </div>
        )}
      </>
    );
  }

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
  const currentPlayer = currentSession?.jogadores?.find(
    (p) => p.userId === authUser?.id
  );
  const isSpectator = !!currentPlayer?.desistiu;
  const spectatorCount = currentSession?.jogadores?.filter((p) => p.desistiu).length ?? 0;

  return (
    <main className="w-full flex flex-col px-4 pb-24 min-h-screen bg-zinc-950">
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
              <ul className="w-full grid grid-cols-5 justify-center">
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

        </div>
      </header>

      <section className="mt-8">
        {!isWaiting && (
          <div className="w-full flex flex-col my-4 border-b border-zinc-800 pb-4">
            {/* Player info header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {currentPlayer && (
                  <UserAvatar avatarUrl={currentPlayer.avatarUrl} avatarUpdatedAt={currentPlayer.avatarUpdatedAt} nome={currentPlayer.nome} size="md" />
                )}
                <div>
                  <h1 className="text-xl font-jaro font-semibold text-zinc-100 flex items-center gap-2">
                    {currentSession.nome}
                    {isSpectator && (
                      <span className="text-xs font-inconsolata bg-zinc-700/50 text-zinc-400 px-2 py-0.5 rounded-full">
                        Espectador
                      </span>
                    )}
                  </h1>
                  <div className="text-sm font-inconsolata text-zinc-500 flex items-center gap-1.5">
                    {currentPlayer && <UserBadge badge={currentPlayer.badge} imageUrl={currentPlayer.badgeImageUrl} variant="micro" />}
                    {currentPlayer?.nome || "—"} · {showSaldo ? `R$ ${formatCurrency(currentPlayer?.saldo ?? 0)}` : "R$ •••••"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {spectatorCount > 0 && (
                  <span className="flex items-center gap-1 text-sm font-inconsolata text-zinc-500">
                    <Eye className="w-4 h-4" />
                    {spectatorCount}
                  </span>
                )}
                {currentPlayer && !isSpectator && (
                  <Button1
                    size="sm"
                    color="red"
                    handle={desistirLoading ? undefined : handleDesistir}
                    disabled={desistirLoading}
                  >
                    Desistir
                  </Button1>
                )}
                <button onClick={() => setShowSaldo(!showSaldo)} className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">
                  {showSaldo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-zinc-500 font-inconsolata text-xs">
              {formatDate(currentSession.dataInicio)} · {currentSession.jogadores.length} jogador{currentSession.jogadores.length !== 1 ? "es" : ""}
            </p>
          </div>
        )}

        {renderConteudo()}
      </section>

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
      <ConfirmationModal
        isOpen={showDesistirModal}
        onClose={() => setShowDesistirModal(false)}
        onConfirm={confirmDesistir}
        title="Desistir da Partida?"
        message="Você se tornará um espectador. Suas propriedades serão liberadas e seu saldo zerado. Você ainda poderá acompanhar a partida até o fim."
        confirmText="Desistir"
        cancelText="Cancelar"
        color="red"
        loading={desistirLoading}
      />

      <GameBottomNav
        linksNav={linksNav}
        abaAtual={abaAtual}
        onSelect={(tab) => {
          localStorage.setItem("abaAtual", tab);
          setAbaAtual(tab);
        }}
      />
    </main>
  );
}
