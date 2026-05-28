import { io, Socket } from "socket.io-client";
import { useGameStore } from "./gameStore";
import { useNegotiationStore } from "./negotiationStore";
import { getRoomToken } from "./roomTokenStore";
import type { ChatMessage, GameNotification, Negotiation } from "@/types/game";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ""
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.NODE_ENV === "development"
      ? "http://localhost:7000"
      : "https://sgpcontroller.onrender.com";

const BASE_URL = API_URL.replace(/\/api\/?$/, "");

let socket: Socket | null = null;
let currentSessionId: number | null = null;
let reconnectCallbacks: (() => void)[] = [];

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

export function connectSocket(sessionId: number) {
  if (socket?.connected && currentSessionId === sessionId) return;

  disconnectSocket();

  currentSessionId = sessionId;

  socket = io(`${BASE_URL}/game`, {
    auth: { token: getToken(), roomToken: getRoomToken() },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    socket?.emit("session:join", { sessionId });
  });

  socket.on("reconnect", () => {
    socket?.emit("session:join", { sessionId });
    reconnectCallbacks.forEach((cb) => cb());
  });

  socket.on("session:updated", (data) => {
    const { sessionId: updatedId } = data || {};
    if (updatedId && updatedId !== sessionId) return;
    useGameStore.setState({ currentSession: data });
  });

  socket.on("session:closed", ({ sessionId: closedId }) => {
    if (closedId === sessionId) {
      useGameStore.setState({ currentSession: null });
    }
  });

  socket.on("player:balance", ({ userId, saldo }) => {
    const store = useGameStore.getState();
    const session = store.currentSession;
    if (!session) return;
    const jogadores = session.jogadores.map((j) =>
      j.id === userId ? { ...j, saldo } : j
    );
    useGameStore.setState({ currentSession: { ...session, jogadores } });
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

  // Sorte e Revés — carta sorteada (broadcast)
  socket.on("card:drawn", (data) => {
    useCardStore.getState().addCardEvent(data);
  });

  // Sorte e Revés — carta prisão usada (broadcast)
  socket.on("carta_prisao:usada", (data) => {
    useCardStore.getState().addCardEvent(data);
  });

  // Negociação — nova oferta recebida
  socket.on("negotiation:new", (data: Negotiation) => {
    useNegotiationStore.getState().addPendente(data);
    useNegotiationStore.getState().setActive(data);
  });

  // Negociação — aceita
  socket.on("negotiation:accepted", (data: Negotiation) => {
    useNegotiationStore.getState().removePendente(data.id);
  });

  // Negociação — recusada
  socket.on("negotiation:rejected", ({ negotiationId }: { negotiationId: number }) => {
    useNegotiationStore.getState().removePendente(negotiationId);
    if (currentSessionId) useGameStore.getState().loadSession(currentSessionId);
  });

  // Negociação — expirada
  socket.on("negotiation:expired", ({ negotiationId }: { negotiationId: number }) => {
    useNegotiationStore.getState().removePendente(negotiationId);
    if (currentSessionId) useGameStore.getState().loadSession(currentSessionId);
  });

  // Negociação — contra-oferta
  socket.on("negotiation:counter", (data: Negotiation) => {
    useNegotiationStore.getState().addPendente(data);
    useNegotiationStore.getState().setActive(data);
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
  clearChatAndNotifications();
}

function clearChatAndNotifications() {
  useChatStore.getState().clearMessages();
  useNotificationStore.getState().clearNotifications();
  useCardStore.getState().clearEvents();
  useNegotiationStore.getState().clearNegotiations();
}
