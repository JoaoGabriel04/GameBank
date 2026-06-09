import { io, Socket } from "socket.io-client";
import { useGameStore } from "./gameStore";
import { useNegotiationStore } from "./negotiationStore";
import { useAuthStore } from "./authStore";
import { getRoomToken } from "./roomTokenStore";
import { toast } from "@/lib/toast";
import type { ChatMessage, GameNotification, Negotiation } from "@/types/game";

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
    socket?.emit("session:join", { sessionId });
    reconnectCallbacks.forEach((cb) => cb());
  });

  socket.on("session:updated", (data) => {
    const { sessionId: updatedId } = data || {};
    if (updatedId && updatedId !== sessionId) return;
    useGameStore.setState({ currentSession: data });
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

  // Aluguel recebido — broadcast na sala, filtrado por toUserId
  socket.on("aluguel:toast", (data: { fromPlayerNome: string; toPlayerId: number; toUserId?: number | null; valor: number; propriedadeNome: string }) => {
    const myId = useAuthStore.getState().user?.id;
    if (data.toUserId && data.toUserId === myId) {
      toast.success(`Você recebeu R$ ${data.valor.toLocaleString("pt-BR")} de ${data.fromPlayerNome} (${data.propriedadeNome})`);
    }
  });

  // Transferência recebida — broadcast na sala, filtrado por toUserId
  socket.on("transferencia:toast", (data: { fromPlayerNome: string; toPlayerId: number; toUserId?: number | null; valor: number }) => {
    const myId = useAuthStore.getState().user?.id;
    if (data.toUserId && data.toUserId === myId) {
      toast.success(`Você recebeu R$ ${data.valor.toLocaleString("pt-BR")} de ${data.fromPlayerNome}`);
    }
  });

  // Sorte e Revés — carta sorteada (broadcast)
  socket.on("card:drawn", (data) => {
    useCardStore.getState().addCardEvent(data);
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
      if (currentSessionId) useGameStore.getState().loadSession(currentSessionId);
    } else if (data.type === "rejected") {
      // Todos removem a negociação pendente
      if (data.negotiationId) {
        negStore.removePendente(data.negotiationId);
      }
      negStore.setMinhaNegociacao(null);
      negStore.setMinhaNegociacaoAberto(false);
      if (isMyToast) toast.error("Sua negociação foi recusada.");
      if (currentSessionId) useGameStore.getState().loadSession(currentSessionId);
    } else if (data.type === "expired") {
      // Todos removem a negociação pendente
      if (data.negotiationId) {
        negStore.removePendente(data.negotiationId);
      }
      negStore.setMinhaNegociacao(null);
      negStore.setMinhaNegociacaoAberto(false);
      if (isMyToast) toast.warning("Negociação expirada por tempo limite.");
      if (currentSessionId) useGameStore.getState().loadSession(currentSessionId);
    } else if (data.type === "counter" && data.negotiation) {
      // Contra-oferta: o proponente original vira alvo
      negStore.setMinhaNegociacao(null);
      negStore.setMinhaNegociacaoAberto(false);
      if (isMyToast) {
        negStore.addPendente(data.negotiation);
        negStore.setActive(data.negotiation);
      }
      if (isMyToast) toast.info("Você recebeu uma contra-oferta!");
      if (currentSessionId) useGameStore.getState().loadSession(currentSessionId);
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

// ─── Chat Store ──────────────────────────────────────────────────────────

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
  if (socket?.connected) {
    socket.emit("chat:send", { texto });
  }
}

// ─── Notification Store ──────────────────────────────────────────────────

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

// ─── Card Events Store ──────────────────────────────────────────────────

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
  clearChatAndNotifications();
}

function clearChatAndNotifications() {
  useChatStore.getState().clearMessages();
  useNotificationStore.getState().clearNotifications();
  useCardStore.getState().clearEvents();
  useNegotiationStore.getState().clearNegotiations();
}
