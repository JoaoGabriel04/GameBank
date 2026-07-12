import { io, Socket } from "socket.io-client";
import { useGameStore } from "./gameStore";
import { useNegotiationStore } from "./negotiationStore";
import { useAuthStore } from "./authStore";
import { getRoomToken } from "./roomTokenStore";
import { toast } from "@/lib/toast";
import type { ChatMessage, GameNotification, Negotiation } from "@/types/game";
import { nextSeq, resetSeq } from "@/lib/socket-sequence";
import { playSfx } from "@/utils/sfx";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ""
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.NODE_ENV === "development"
      ? "http://localhost:7000"
      : "https://gamebank-vtsb.onrender.com";

const BASE_URL = API_URL.replace(/\/api\/?$/, "");

let socket: Socket | null = null;
let currentSessionId: number | null = null;
let sessionEnded = false;
let reconnectCallbacks: (() => void)[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sessionClosedCallbacks: ((ranking?: any[]) => void)[] = [];

export interface VoteRequestData {
  sessionId: number;
  ownerId: number;
  ownerNome: string;
  requiredUserIds: number[];
  playerNames?: Record<number, string>;
  currentVotes?: Record<number, "yes" | "no">;
}
export interface VoteUpdateData {
  sessionId: number;
  votes: Record<number, "yes" | "no">;
  requiredUserIds: number[];
}
export interface VoteCancelledData {
  sessionId: number;
  cancellerNome?: string;
}

let voteRequestCallbacks: ((data: VoteRequestData) => void)[] = [];
let voteUpdateCallbacks: ((data: VoteUpdateData) => void)[] = [];
let voteCancelledCallbacks: ((data: VoteCancelledData) => void)[] = [];

export function onVoteRequest(cb: (data: VoteRequestData) => void) { voteRequestCallbacks.push(cb); }
export function onVoteUpdate(cb: (data: VoteUpdateData) => void) { voteUpdateCallbacks.push(cb); }
export function onVoteCancelled(cb: (data: VoteCancelledData) => void) { voteCancelledCallbacks.push(cb); }
export function clearVoteCallbacks() {
  voteRequestCallbacks = [];
  voteUpdateCallbacks = [];
  voteCancelledCallbacks = [];
}

export function emitRequestEnd() {
  socket?.emit("game:request_end");
}

export function emitVote(vote: "yes" | "no") {
  socket?.emit("game:vote", { vote });
}

// ─── Kick vote ─────────────────────────────────────────────────────────────

export interface KickVoteRequestData {
  sessionId: number;
  targetPlayerId: number;
  targetNome: string;
  initiatorNome: string;
  requiredUserIds: number[];
  playerNames: Record<number, string>;
  votes: Record<number, "yes" | "no">;
  expiresAt: string;
}
export interface KickVoteUpdateData {
  sessionId: number;
  votes: Record<number, "yes" | "no">;
  requiredUserIds: number[];
}
export interface KickVoteResultData {
  sessionId: number;
  passed: boolean;
  targetNome: string;
  targetPlayerId: number;
}

let kickVoteRequestCallbacks: ((data: KickVoteRequestData) => void)[] = [];
let kickVoteUpdateCallbacks:  ((data: KickVoteUpdateData)  => void)[] = [];
let kickVoteResultCallbacks:  ((data: KickVoteResultData)  => void)[] = [];

export function onKickVoteRequest(cb: (data: KickVoteRequestData) => void) { kickVoteRequestCallbacks.push(cb); }
export function onKickVoteUpdate (cb: (data: KickVoteUpdateData)  => void) { kickVoteUpdateCallbacks.push(cb); }
export function onKickVoteResult (cb: (data: KickVoteResultData)  => void) { kickVoteResultCallbacks.push(cb); }
export function clearKickVoteCallbacks() {
  kickVoteRequestCallbacks = [];
  kickVoteUpdateCallbacks  = [];
  kickVoteResultCallbacks  = [];
}

export function emitKickVoteInit(targetPlayerId: number) {
  socket?.emit("game:kick_vote_init", { targetPlayerId });
}
export function emitKickVote(vote: "yes" | "no") {
  socket?.emit("game:kick_vote", { vote });
}

function getToken(): string {
  return typeof window !== "undefined"
    ? localStorage.getItem("jwt_token") || ""
    : "";
}

export function onReconnect(cb: () => void) {
  reconnectCallbacks.push(cb);
}

export function clearReconnectCallbacks() {
  reconnectCallbacks = [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function onSessionClosed(cb: (ranking?: any[]) => void) {
  sessionClosedCallbacks.push(cb);
}

export function clearSessionClosedCallbacks() {
  sessionClosedCallbacks = [];
}

export function connectSocket(sessionId: number) {
  if (socket?.connected && currentSessionId === sessionId) return;

  disconnectSocket();

  currentSessionId = sessionId;
  sessionEnded = false;

  socket = io(`${BASE_URL}/game`, {
    auth: { token: getToken(), roomToken: getRoomToken() },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    if (sessionEnded) return;
    socket?.emit("session:join", { sessionId });
  });

  socket.on("reconnect", () => {
    if (sessionEnded) return;
    resetSeq(sessionId); // seq 0 no próximo chat:send sinaliza reconexão ao servidor
    socket?.emit("session:join", { sessionId });
    reconnectCallbacks.forEach((cb) => cb());
  });

  socket.on("session:updated", (data) => {
    const { sessionId: updatedId, turnoAtualPlayerId: novoPlayerId, jogadores } = data || {};
    if (updatedId && updatedId !== sessionId) return;

    const antigo = useGameStore.getState().currentSession;
    const antigoPlayerId = antigo?.turnoAtualPlayerId;

    // Adiado (junto com o toast) até o TurnoModal revelar o resultado —
    // ver comentário abaixo.
    if (antigoPlayerId != null && novoPlayerId && novoPlayerId !== antigoPlayerId && jogadores?.length) {
      useGameStore.getState().deferOrRun(() => {
        const authUser = useAuthStore.getState().user;
        const meuJogador = jogadores.find((p: { userId?: number | null }) => p.userId === authUser?.id);
        const novoJogador = jogadores.find((p: { id: number }) => p.id === novoPlayerId);

        if (meuJogador && novoJogador?.id === meuJogador.id) {
          toast.success("É a sua vez de jogar!");
        } else if (novoJogador) {
          toast.info(`Vez de ${novoJogador.nome}`);
        }
      });
    }

    // BUG 2 (TABULEIRO_FIXES): passa pelo buffer — se uma rolagem local
    // estiver em andamento (holdSessionUpdates), a posição do peão e o
    // estado do turno só se aplicam depois que o TurnoModal revelar o
    // resultado dos dados, evitando que o peão se mova antes do jogador
    // ver o número. O toast acima usa o mesmo gate (deferOrRun) — sem
    // isso ele chegava antes do próprio jogador ver quanto tirou.
    useGameStore.getState().applyOrBufferSession(data);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket.on("session:closed", (data: { sessionId: number; ranking?: any[] }) => {
    if (data.sessionId !== sessionId) return;
    sessionClosedCallbacks.forEach((cb) => cb(data.ranking));
  });

  socket.on("disconnect", () => {});
  socket.on("connect_error", () => {});

  socket.on("error", ({ message }) => {
    console.error("Socket error:", message);
  });

  socket.on("erro:rate-limit", (data: { evento: string; mensagem: string; aguardar: number }) => {
    toast.error(data.mensagem);
  });

  socket.on("erro:sequencia", (data: { esperado: number; recebido: number; mensagem: string }) => {
    // Sincronizar contador local com o esperado pelo servidor
    resetSeq(sessionId);
    toast.error(data.mensagem);
  });

  socket.on("servidor:reiniciando", (data: { mensagem: string; em: number }) => {
    toast.warning(data.mensagem);
  });

  // Chat — histórico ao entrar na sala
  socket.on("chat:history", (data: ChatMessage[]) => {
    useChatStore.setState({ messages: data });
  });

  // Chat — mensagem nova
  socket.on("chat:message", (data: ChatMessage) => {
    useChatStore.getState().addMessage(data);
  });

  // Notificações
  socket.on("notification:new", (data: GameNotification) => {
    useNotificationStore.getState().addNotification(data);
  });

  // Evento econômico — virada de rodada (Mecânica 2). O eventoAtual/
  // eventoProximo em si já chega via session:updated (currentSession);
  // isto aqui é só o "pulso" de transição pra disparar o modal de
  // ativação uma única vez (não a cada re-render da sessão).
  socket.on("evento:mudou", (data: { rodada: number; eventoAtual: string | null; eventoProximo: string | null }) => {
    useEventoStore.getState().setUltimoEvento(data);
  });

  // Leilão Cego (Mecânica 4) — o estado emLeilao/leilaoPropId em si já
  // chega via session:updated; estes eventos cuidam do que a sessão
  // sozinha não carrega: o SIGILO (nunca o valor do lance, só "decidiu")
  // e a revelação pontual do resultado.
  socket.on("leilao:iniciado", (data: { propId: number; nome: string; precoTabela: number; lanceMinimo: number; timeoutMs: number }) => {
    useLeilaoStore.getState().iniciar(data);
  });

  socket.on("leilao:jogador_decidiu", (data: { playerId: number }) => {
    useLeilaoStore.getState().marcarDecidiu(data.playerId);
  });

  socket.on("leilao:resultado", (data: { propId: number; lances: { playerId: number; valor: number }[]; vencedorId: number | null; valorFinal: number | null }) => {
    useLeilaoStore.getState().setResultado(data);
  });

  // Aluguel recebido — broadcast na sala, filtrado por toUserId
  socket.on("aluguel:toast", (data: { fromPlayerNome: string; toPlayerId: number; toUserId?: number | null; valor: number; propriedadeNome: string }) => {
    const myId = useAuthStore.getState().user?.id;
    if (data.toUserId && data.toUserId === myId) {
      toast.success(`Você recebeu R$ ${data.valor.toLocaleString("pt-BR")} de ${data.fromPlayerNome} (${data.propriedadeNome})`);
      playSfx("pagou-aluguel")
    }
  });

  // Passagem pelo Início (IPTU/manutenção/renda passiva) — o próprio
  // jogador já recebe o extrato completo (modal) na resposta da rolagem;
  // aqui só tratamos o toast curto pros demais jogadores da sala.
  socket.on("inicio:extrato", (data: { playerId: number; playerUserId?: number | null; playerNome: string; extrato: { liquido: number } }) => {
    const myId = useAuthStore.getState().user?.id;
    if (data.playerUserId && data.playerUserId === myId) return;
    const sinal = data.extrato.liquido >= 0 ? "+" : "−";
    const valor = Math.abs(data.extrato.liquido).toLocaleString("pt-BR");
    if (data.extrato.liquido >= 0) {
      toast.success(`${data.playerNome} passou pelo Início: ${sinal}R$ ${valor}`);
    } else {
      toast.error(`${data.playerNome} passou pelo Início: ${sinal}R$ ${valor} (virou dívida)`);
    }
  });

  // Transferência recebida — broadcast na sala, filtrado por toUserId
  socket.on("transferencia:toast", (data: { fromPlayerNome: string; toPlayerId: number; toUserId?: number | null; valor: number }) => {
    const myId = useAuthStore.getState().user?.id;
    if (data.toUserId && data.toUserId === myId) {
      toast.success(`Você recebeu R$ ${data.valor.toLocaleString("pt-BR")} de ${data.fromPlayerNome}`);
    }
  });

  // Sorte e Revés — carta sorteada (broadcast). Adiado como o toast de
  // vez acima: se for a própria rolagem do jogador (caiu em Notícias),
  // sem isso o toast da carta chegava antes dele ver o resultado dos
  // dados no próprio modal.
  socket.on("card:drawn", (data) => {
    useGameStore.getState().deferOrRun(() => {
      useCardStore.getState().addCardEvent(data);
    });
  });

  // Sorte e Revés — carta prisão usada (broadcast)
  socket.on("carta_prisao:usada", (data) => {
    useCardStore.getState().addCardEvent(data);
  });

  // Atualização de cosméticos de jogador (equip/desequip durante sessão ativa)
  socket.on("player:updated", (data: { userId: number; badge: string | null; badgeImageUrl: string | null; banner: string | null; frame: string | null; frameType: string | null; frameAnimated: boolean; frameScale: number }) => {
    useGameStore.getState().updatePlayerInSession(data.userId, {
      badge: data.badge,
      badgeImageUrl: data.badgeImageUrl,
      banner: data.banner,
      frame: data.frame,
      frameType: data.frameType as "image" | "gradient" | null,
      frameAnimated: data.frameAnimated,
      frameScale: data.frameScale,
    });
  });

  // Negociação — evento broadcast confiável (substitui eventos targeted individuais)
  // type: "new" | "accepted" | "rejected" | "counter" | "expired"
  // targetUserId: quem deve ver o toast
  socket.on("negotiation:toast", (data: {
    type: string;
    role?: string;
    targetUserId?: number | null;
    negotiation?: Negotiation;
    negotiationId?: number;
  }) => {
    const myId = useAuthStore.getState().user?.id;
    const negStore = useNegotiationStore.getState();
    const isMyToast = data.targetUserId && data.targetUserId === myId;

    if (data.type === "new" && data.negotiation) {
      // Só o alvo adiciona à lista de pendentes
      if (isMyToast) {
        negStore.addPendente(data.negotiation);
        negStore.setActive(data.negotiation);
      }
      if (isMyToast) toast.info("Você recebeu uma nova proposta de negociação!");
    } else if (data.type === "accepted") {
      // Todos removem a negociação pendente
      if (data.negotiation) {
        negStore.removePendente(data.negotiation.id);
      }
      negStore.setMinhaNegociacao(null);
      negStore.setMinhaNegociacaoAberto(false);
      if (isMyToast) {
        if (data.role === "proposer") {
          toast.success("Sua negociação foi aceita!");
        } else {
          toast.success("Negociação concluída com sucesso!");
        }
      }
      // session:updated chega em seguida via emitUpdatedSession — não chamar loadSession aqui
    } else if (data.type === "rejected") {
      // Todos removem a negociação pendente
      if (data.negotiationId) {
        negStore.removePendente(data.negotiationId);
      }
      negStore.setMinhaNegociacao(null);
      negStore.setMinhaNegociacaoAberto(false);
      if (isMyToast) toast.error("Sua negociação foi recusada.");
      // session:updated chega em seguida via emitUpdatedSession — não chamar loadSession aqui
    } else if (data.type === "expired") {
      // Todos removem a negociação pendente
      if (data.negotiationId) {
        negStore.removePendente(data.negotiationId);
      }
      negStore.setMinhaNegociacao(null);
      negStore.setMinhaNegociacaoAberto(false);
      if (isMyToast) toast.warning("Negociação expirada por tempo limite.");
      // session:updated chega em seguida via emitSessionUpdated — não chamar loadSession aqui
    } else if (data.type === "counter" && data.negotiation) {
      // Contra-oferta: o proponente original vira alvo
      negStore.setMinhaNegociacao(null);
      negStore.setMinhaNegociacaoAberto(false);
      if (isMyToast) {
        negStore.addPendente(data.negotiation);
        negStore.setActive(data.negotiation);
      }
      if (isMyToast) toast.info("Você recebeu uma contra-oferta!");
      // session:updated chega em seguida via emitUpdatedSession — não chamar loadSession aqui
    }
  });

  // Votação para encerrar partida
  socket.on("game:vote_request", (data: VoteRequestData) => {
    voteRequestCallbacks.forEach((cb) => cb(data));
  });
  socket.on("game:vote_update", (data: VoteUpdateData) => {
    voteUpdateCallbacks.forEach((cb) => cb(data));
  });
  socket.on("game:vote_cancelled", (data: VoteCancelledData) => {
    voteCancelledCallbacks.forEach((cb) => cb(data));
  });

  // Votação de expulsão
  socket.on("game:kick_vote_request", (data: KickVoteRequestData) => {
    kickVoteRequestCallbacks.forEach((cb) => cb(data));
  });
  socket.on("game:kick_vote_update", (data: KickVoteUpdateData) => {
    kickVoteUpdateCallbacks.forEach((cb) => cb(data));
  });
  socket.on("game:kick_vote_result", (data: KickVoteResultData) => {
    kickVoteResultCallbacks.forEach((cb) => cb(data));
  });

  // Báu recebido após fim de partida (emitido pelo worker async)
  socket.on("bau:recebido", (data: { tipo: "premium" | "comum"; bauId: number }) => {
    const label = data.tipo === "premium" ? "Cofre Premium" : "Cofrinho";
    toast.success(`Você ganhou um ${label}! Abra no Cofre.`);
  });

  // Juros do empréstimo (Etapa 6)
  socket.on("emprestimo:juros", (data: { playerId: number; valorAnterior: number; valorAtual: number; jurosPct: number }) => {
    const myId = useAuthStore.getState().user?.id;
    const me = useGameStore.getState().currentSession?.jogadores.find(p => p.userId === myId);
    if (me && data.playerId === me.id) {
      toast.warning(`Juros do empréstimo: R$ ${data.valorAnterior.toLocaleString("pt-BR")} → R$ ${data.valorAtual.toLocaleString("pt-BR")}`);
    }
  });

  // Execução da garantia (Etapa 8)
  socket.on("emprestimo:garantia_executada", (data: { playerId: number; propId: number }) => {
    const myId = useAuthStore.getState().user?.id;
    const me = useGameStore.getState().currentSession?.jogadores.find(p => p.userId === myId);
    if (me && data.playerId === me.id) {
      toast.error("🏦 GARANTIA EXECUTADA — O banco tomou sua propriedade pelo empréstimo não pago.");
    } else {
      toast.warning("Um jogador perdeu a garantia do empréstimo na falência.");
    }
  });

  // Fallback: negotiation:expired via emitToUser individual (negotiation-cleanup.ts)
  socket.on("negotiation:expired", ({ negotiationId }: { negotiationId: number }) => {
    if (!currentSessionId) return;
    const store = useNegotiationStore.getState();
    store.removePendente(negotiationId);
    store.setMinhaNegociacao(null);
    store.setMinhaNegociacaoAberto(false);
  });

}

// --- Chat Store ----------------------------------------------------------

import { create } from "zustand";

interface ChatStore {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),
  clearMessages: () => set({ messages: [] }),
}));

export function sendChatMessage(texto: string) {
  if (socket?.connected && currentSessionId !== null) {
    socket.emit("chat:send", { texto, seq: nextSeq(currentSessionId) });
  }
}

// --- Notification Store --------------------------------------------------

interface NotificationStore {
  notifications: GameNotification[];
  addNotification: (n: GameNotification) => void;
  removeNotification: (id: number) => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  addNotification: (n) => set((s) => ({ notifications: [...s.notifications, n] })),
  removeNotification: (id) => set((s) => ({
    notifications: s.notifications.filter((x) => x.id !== id),
  })),
  clearNotifications: () => set({ notifications: [] }),
}));

// --- Card Events Store --------------------------------------------------

interface CardEventData {
  playerNome: string;
  playerId: number;
  tipoBaralho?: "sorte" | "reves";
  carta?: { id: number; texto: string; tipo: string; valor: number };
  effectDescription?: string;
}

interface CardStore {
  events: CardEventData[];
  addCardEvent: (data: CardEventData) => void;
  clearEvents: () => void;
}

export const useCardStore = create<CardStore>((set) => ({
  events: [],
  addCardEvent: (data) => set((s) => ({ events: [...s.events, data] })),
  clearEvents: () => set({ events: [] }),
}));

// --- Evento Econômico Store (Mecânica 2) ---------------------------------

interface EventoMudouData {
  rodada: number;
  eventoAtual: string | null;
  eventoProximo: string | null;
}

interface EventoStore {
  ultimoEvento: EventoMudouData | null;
  setUltimoEvento: (data: EventoMudouData) => void;
  clearUltimoEvento: () => void;
}

export const useEventoStore = create<EventoStore>((set) => ({
  ultimoEvento: null,
  setUltimoEvento: (data) => set({ ultimoEvento: data }),
  clearUltimoEvento: () => set({ ultimoEvento: null }),
}));

// --- Leilão Cego Store (Mecânica 4) --------------------------------------

export interface LeilaoIniciadoData {
  propId: number;
  nome: string;
  precoTabela: number;
  lanceMinimo: number;
  timeoutMs: number;
}

export interface LeilaoResultadoData {
  propId: number;
  lances: { playerId: number; valor: number }[];
  vencedorId: number | null;
  valorFinal: number | null;
}

interface LeilaoStore {
  ativo: LeilaoIniciadoData | null;
  decididos: number[]; // playerIds que já deram lance/passaram — NUNCA o valor
  resultado: LeilaoResultadoData | null;
  iniciar: (data: LeilaoIniciadoData) => void;
  marcarDecidiu: (playerId: number) => void;
  setResultado: (data: LeilaoResultadoData) => void;
  clearResultado: () => void;
  reset: () => void;
}

export const useLeilaoStore = create<LeilaoStore>((set) => ({
  ativo: null,
  decididos: [],
  resultado: null,
  iniciar: (data) => set({ ativo: data, decididos: [], resultado: null }),
  marcarDecidiu: (playerId) => set((s) => ({
    decididos: s.decididos.includes(playerId) ? s.decididos : [...s.decididos, playerId],
  })),
  setResultado: (data) => set({ resultado: data, ativo: null }),
  clearResultado: () => set({ resultado: null }),
  reset: () => set({ ativo: null, decididos: [], resultado: null }),
}));

export function disconnectSocket() {
  if (socket) {
    if (currentSessionId) {
      socket.emit("session:leave", currentSessionId);
    }
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentSessionId = null;
  }
  reconnectCallbacks = [];
  sessionClosedCallbacks = [];
  clearVoteCallbacks();
  clearKickVoteCallbacks();
  clearChatAndNotifications();
}

function clearChatAndNotifications() {
  useChatStore.getState().clearMessages();
  useNotificationStore.getState().clearNotifications();
  useCardStore.getState().clearEvents();
  useEventoStore.getState().clearUltimoEvento();
  useLeilaoStore.getState().reset();
  useNegotiationStore.getState().clearNegotiations();
}
