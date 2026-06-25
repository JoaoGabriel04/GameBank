/* eslint-disable */
"use client";

import Especiais from "@/components/Especiais";
import Inicio from "@/components/Inicio";
import Loja from "@/components/Loja";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { useProfileStore } from "@/stores/profileStore";

import { connectSocket, disconnectSocket, onReconnect, clearReconnectCallbacks, onSessionClosed, clearSessionClosedCallbacks, useCardStore } from "@/stores/socketStore";
import { useNegotiationStore } from "@/stores/negotiationStore";
import { listarPendentesApi } from "@/services/api/negotiations";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import { setRoomToken } from "@/stores/roomTokenStore";
import { useSession } from "@/hooks/useApi";
import { sessionsApi } from "@/services/api/sessions";
import { Eye, EyeOff } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import UserBanner from "@/components/UserBanner";
import PlayerCard from "@/components/PlayerCard";
import UserName from "@/components/UserName";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeIn } from "@/lib/animations";
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
import { faPowerOff, faPlay, faUsers, faClock, faGamepad, faHouse, faStore, faStar, faTrophy } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { RankedPlayer, Player } from "@/types/game";
import { toApiErr, apiErrMsg } from "@/lib/api-error";
import { PLAYER_COLORS } from "@/types/game";

const linksNav = ["Início", "Loja", "Especiais", "Ranking", "Histórico"];

const tabIcons: Record<string, IconDefinition> = {
  "Início":    faHouse,
  "Loja":      faStore,
  "Especiais": faStar,
  "Ranking":   faTrophy,
  "Histórico": faClock,
};

export default function Game() {
  const { success: toastSuccess, error: toastError, warning: toastWarning, info: toastInfo } = useToast();
  const vh = useViewportHeight();
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

  // --- WebSocket ------------------------------------------------------------
  useEffect(() => {
    if (!sessionId) return;

    // Restaura podium cacheado caso o usuário tenha perdido o evento (reconexão pós-fim)
    const cachedPodium = sessionStorage.getItem(`podium_${sessionId}`);
    if (cachedPodium) {
      try {
        setPodiumData(JSON.parse(cachedPodium));
        setSessionEnded(true);
      } catch {
        sessionStorage.removeItem(`podium_${sessionId}`);
      }
    }

    connectSocket(sessionId);
    onReconnect(() => mutate());
    onSessionClosed((ranking) => {
      setSessionEnded(true);
      if (ranking) {
        setPodiumData(ranking);
        sessionStorage.setItem(`podium_${sessionId}`, JSON.stringify(ranking));
      }
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

  // --- Card drawn → toast broadcast --------------------------------------
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

  // --- SWR → Zustand (fallback) --------------------------------------------
  useEffect(() => {
    if (swrSession) {
      useGameStore.setState({ currentSession: swrSession });
    }
  }, [swrSession]);

  // Hidrata o store de negociações ao carregar/reconectar — evita desaparecer após refresh
  useEffect(() => {
    if (!sessionId || !swrSession || !authUser?.id) return;
    const me = swrSession.jogadores?.find((p: Player) => p.userId === authUser.id);
    if (!me?.id) return;
    listarPendentesApi(sessionId, me.id)
      .then((list: unknown[]) => {
        const negStore = useNegotiationStore.getState();
        const typed = list as import("@/types/game").Negotiation[];
        const received = typed.filter((n) => n.toPlayerId === me.id);
        const sent = typed.find((n) => n.fromPlayerId === me.id) ?? null;
        negStore.setPendentes(received);
        negStore.setMinhaNegociacao(sent);
      })
      .catch(() => {});
  }, [sessionId, swrSession, authUser?.id]);

  // Restaura a aba salva no localStorage
  useEffect(() => {
    setAbaAtual(localStorage.getItem("abaAtual") || "Início");
  }, []);

  // Lida com erros de carregamento da sessão
  useEffect(() => {
    if (isLoading || sessionEnded) return;
    if (!swrSession && isError) {
      if (endLoading) return;
      const axiosError = isError as { response?: { status?: number } };
      const status = axiosError?.response?.status;
      if (!status || (status !== 404 && status !== 401 && status !== 403)) return;

      setRoomToken(null);
      disconnectSocket();

      // 404 → sessão deletada (partida encerrada enquanto desconectado).
      // Tenta buscar o resultado salvo em GameResult para exibir o pódio.
      if (status === 404) {
        setSessionEnded(true);
        if (sessionId) {
          sessionsApi.getResultado(sessionId)
            .then((res) => {
              if (res.data?.ranking?.length) {
                setPodiumData(res.data.ranking);
              }
            })
            .catch(() => {});
        }
        return;
      }

      const msg =
        status === 401 ? "Acesso não autorizado a esta sala" :
        "Você não tem permissão para acessar esta sala";
      toastError(msg);
      router.push("/user/sessions");
    }
  }, [isLoading, sessionEnded, swrSession, isError, router, endLoading, toastError]);

  const handleEndGame = async () => {
    if (!currentSession) return;
    if (!window.confirm("Tem certeza que deseja finalizar este jogo? Esta ação não pode ser desfeita."))
      return;
    setEndLoading(true);
    try {
      await endSession(currentSession.id);
      setRoomToken(null);
      disconnectSocket();
      toastInfo(
        currentSession.status === "Esperando"
          ? "Sala encerrada com sucesso."
          : "Partida finalizada com sucesso."
      );
      router.push("/user/sessions");
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? "Erro ao finalizar a partida";
      if ((e?.response?.status ?? 0) >= 500) { toastError(msg); } else { toastWarning(msg); }
    } finally {
      setEndLoading(false);
    }
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
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? "Erro ao sair da sala";
      if ((e?.response?.status ?? 0) >= 500) { toastError(msg); } else { toastWarning(msg); }
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
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? "Erro ao desistir da partida";
      if ((e?.response?.status ?? 0) >= 500) { toastError(msg); } else { toastWarning(msg); }
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
    } catch (err) {
      toastError(apiErrMsg(err, "Erro ao sair da sala"));
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
    } catch (err) {
      const e = toApiErr(err);
      const msg = e?.response?.data?.message ?? e?.response?.data?.error ?? "Erro ao iniciar jogo";
      if ((e?.response?.status ?? 0) >= 500) { toastError(msg); } else { toastWarning(msg); }
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


  // -- Waiting Room --------------------------------------------------------
  function renderWaitingRoom() {
    if (!currentSession) return null;
    const allPlayers = currentSession.jogadores || [];
    const activePlayers = allPlayers.filter((p) => !p.desistiu);
    const spectators = allPlayers.filter((p) => p.desistiu);
    const times = currentSession.times || [];
    const isDuplas = currentSession.modo === "duplas";

    const MIN_PLAYERS = process.env.NODE_ENV === "development" ? 1 : 3;
    const teamsWithPlayers = isDuplas
      ? new Set(activePlayers.map((p) => p.teamId).filter(Boolean)).size
      : 0;
    const allInTeam = isDuplas && activePlayers.every((p) => p.teamId);
    const canStart = isDuplas
      ? activePlayers.length >= MIN_PLAYERS && allInTeam && teamsWithPlayers >= 2
      : activePlayers.length >= MIN_PLAYERS;

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
                    ? activePlayers.length < MIN_PLAYERS
                      ? `Aguardando mais ${MIN_PLAYERS - activePlayers.length} jogador${MIN_PLAYERS - activePlayers.length !== 1 ? "es" : ""}`
                      : !allInTeam
                        ? "Todos os jogadores precisam estar em um time"
                        : "Necessário pelo menos 2 times com jogadores"
                    : `Aguardando mais ${MIN_PLAYERS - activePlayers.length} jogador${MIN_PLAYERS - activePlayers.length !== 1 ? "es" : ""}`}
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

          {!isOwner && (
            <Button1
              size="lg"
              color="red"
              handle={quitLoading ? undefined : handleQuit}
              disabled={quitLoading}
              className="w-full max-w-xs mx-auto"
            >
              Sair da Sala
            </Button1>
          )}
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
                          <PlayerCard player={p} patrimonio={currentSession?.saldoInicial ?? 0} />
                        </div>
                      ))}
                    </div>
                  );
                })
              ) : (
                activePlayers.map((p) => (
                  <PlayerCard key={p.id} player={p} patrimonio={currentSession?.saldoInicial ?? 0} />
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
                  <UserAvatar avatarUrl={p.avatarUrl} avatarUpdatedAt={p.avatarUpdatedAt} nome={p.nome} size="sm" frame={p.frame} frameType={p.frameType} frameAnimated={p.frameAnimated} frameScale={p.frameScale ?? 145} />
                  <UserName
                    nome={p.nome}
                    badge={p.badge}
                    badgeImageUrl={p.badgeImageUrl}
                    badgeVariant="micro"
                  />
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
            onClose={() => {
              sessionStorage.removeItem(`podium_${sessionId}`);
              router.push("/user/sessions");
            }}
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
    <>
      {/*
        Flex coluna de altura total:
        - Mobile:  header (shrink-0) | conteúdo (flex-1 + overflow-y-auto) | nav (shrink-0)
        - Desktop: header+tabs (shrink-0) | conteúdo (flex-1 + overflow-y-auto) — nav oculto
        min-h-0 no conteúdo é obrigatório para overflow-y-auto funcionar dentro de flex
      */}
      <div className="flex flex-col w-full bg-zinc-950 overflow-hidden" style={{ height: vh }}>

        {/* LINHA 1 — Header (não rola) */}
        <header className="shrink-0 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800">

          {/* Barra superior: logo | nome da sessão | ações */}
          <div className="flex items-center justify-between px-4 h-12 gap-3">

            {/* Esquerda: logo */}
            <Link
              href="/user"
              className="font-jaro text-xl bg-linear-to-r from-green-500 to-amber-400 bg-clip-text text-transparent shrink-0 hover:opacity-80 transition-opacity"
            >
              GameBank
            </Link>

            {/* Centro: nome da sessão */}
            <span className="font-jaro text-sm text-zinc-500 truncate hidden sm:block flex-1 text-center select-none">
              {currentSession.nome}
            </span>

            {/* Direita: ações de sessão — botões compactos */}
            {!isWaiting && (
              <div className="flex items-center gap-2 shrink-0">
                {!isOwner && (
                  <button
                    onClick={quitLoading ? undefined : handleQuit}
                    disabled={quitLoading}
                    className="font-jaro text-xs uppercase tracking-wider px-3 py-1 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Sair
                  </button>
                )}
                {isOwner && (
                  <button
                    onClick={endLoading ? undefined : handleEndGame}
                    disabled={endLoading}
                    className="font-jaro text-xs uppercase tracking-wider px-3 py-1 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <FontAwesomeIcon icon={faPowerOff} className="text-[10px]" />
                    Finalizar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Abas desktop com ícones (apenas quando em jogo) */}
          {!isWaiting && (
            <nav className="hidden lg:block border-t border-zinc-800/50">
              <ul className="grid grid-cols-5">
                {linksNav.map((link) => (
                  <li
                    key={link}
                    onClick={() => {
                      localStorage.setItem("abaAtual", link);
                      setAbaAtual(link);
                    }}
                    className={`h-10 flex justify-center items-center gap-2 font-inconsolata text-sm transition-colors cursor-pointer select-none ${
                      abaAtual === link
                        ? "border-b-2 border-green-500 font-bold text-green-400"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-green-500/5"
                    }`}
                  >
                    <FontAwesomeIcon icon={tabIcons[link]} className="text-xs" />
                    {link}
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </header>

        {/* LINHA 2 — Conteúdo rolável */}
        <section className="flex-1 w-full overflow-hidden">
          <section className="w-full h-full overflow-y-auto px-4">
          <div className="pb-6">
            {!isWaiting && (
              <div className="w-full flex flex-col mt-4 mb-2 border-b border-zinc-800 pb-4">
                {/* Informações do jogador */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {currentPlayer && (
                      <UserAvatar avatarUrl={currentPlayer.avatarUrl} avatarUpdatedAt={currentPlayer.avatarUpdatedAt} nome={currentPlayer.nome} size="md" frame={currentPlayer.frame} frameType={currentPlayer.frameType} frameAnimated={currentPlayer.frameAnimated} frameScale={currentPlayer.frameScale ?? 145} />
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
                        {currentPlayer && (
                          <UserName
                            nome={currentPlayer.nome}
                            badge={currentPlayer.badge}
                            badgeImageUrl={currentPlayer.badgeImageUrl}
                            badgeVariant="micro"
                          />
                        )}
                        {!currentPlayer && <span>—</span>}
                        <span>·</span>
                        <span>{showSaldo ? `R$ ${formatCurrency(currentPlayer?.saldo ?? 0)}` : "R$ •••••"}</span>
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
                      <button
                        onClick={desistirLoading ? undefined : handleDesistir}
                        disabled={desistirLoading}
                        className="font-jaro text-xs uppercase tracking-wider px-3 py-1 border border-red-500/60 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Desistir
                      </button>
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

            <AnimatePresence mode="wait">
              <motion.div key={abaAtual} variants={fadeIn} animate="visible">
                {renderConteudo()}
              </motion.div>
            </AnimatePresence>
          </div>
          </section>
        </section>

        {/* LINHA 3 — Nav mobile (oculto no desktop via lg:hidden) */}
        <div className="shrink-0 lg:hidden">
          <GameBottomNav
            linksNav={linksNav}
            abaAtual={abaAtual}
            onSelect={(tab) => {
              localStorage.setItem("abaAtual", tab);
              setAbaAtual(tab);
            }}
          />
        </div>
      </div>

      {/* Overlays position:fixed — fora do flex, funcionam normalmente */}
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
    </>
  );
}
