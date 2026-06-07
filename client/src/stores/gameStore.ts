import {
  GameSession,
  Player,
  PLAYER_COLORS,
  PlayerColor,
  Propriedade,
  SorteRevesCard,
} from "@/types/game";
import { create } from "zustand";
import { AxiosError } from "axios";
import {
  createSessionApi,
  endSessionApi,
  loadSessionApi,
  startSessionApi,
} from "@/services/api/sessions";
import {
  editPlayerApi,
  getPlayerByIdApi,
  removePlayerApi,
} from "@/services/api/players";
import {
  buyHouseApi,
  buyHousesBatchApi,
  sellHousesBatchApi,
  buyPropApi,
  getPropByIdApi,
  hipotecarPropApi,
  sellHouseApi,
  sellPropriedadeApi,
  trocaPropriedadeApi,
} from "@/services/api/properties";
import {
  comprarHipotecadaApi,
  responderNotificacaoApi,
} from "@/services/api/notifications";
import {
  aluguelAcaoApi,
  aluguelApi,
  depositoApi,
  receberDeTodosApi,
  saqueApi,
  transferenciaApi,
} from "@/services/api/banco";
import {
  sortearCartaApi,
  usarCartaPrisaoApi,
} from "@/services/api/cartas";
import {
  pagarDividaApi,
} from "@/services/api/dividas";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface GameStore {
  sessions: GameSession[];
  currentSession: GameSession | null;
  loading: boolean;
  loadingProperty: boolean; // loading separado para leituras (getPropertyById, getPlayerById)
  networkError: boolean;
  error: string | null;
  propertiesCache: Record<number, Propriedade>;

  createSession: (nome: string, senha?: string, modo?: 'individual' | 'duplas', maxJogadores?: number, saldoInicial?: number, times?: { nome: string; cor: string }[], criadorNome?: string, criadorCor?: string, criadorTeamIndex?: number) => Promise<number | undefined>;
  loadSession: (sessionId: number) => Promise<void>;
  startSession: (sessionId: number) => Promise<void>;
  endSession: (sessionId: number) => Promise<void>;
  getPlayerById: (playerId: number) => Promise<Player | undefined>;
  editPlayer: (playerId: number, nome: string, cor: PlayerColor) => Promise<void>;
  removePlayer: (playerId: number) => Promise<void>;
  getPropertyById: (propriedadeId: number) => Promise<Propriedade | null>;
  buyProperty: (propriedadeId: number, sessionId: number, userId: number) => Promise<void>;
  buyHouse: (params: { userId: number; sessionId: number; propriedadeId: number }) => Promise<void>;
  buyHousesBatch: (params: { userId: number; sessionId: number; sessaoPossesIds: number[] }) => Promise<void>;
  sellHousesBatch: (params: { userId: number; sessionId: number; items: { sessaoPossesId: number; quantidade: number }[] }) => Promise<void>;
  sellHouse: (params: { userId: number; sessionId: number; propriedadeId: number }) => Promise<void>;
  sellPropriedade: (propriedadeId: number, sessionId: number, userId: number) => Promise<void>;
  hipotecarProp: (propriedadeId: number, sessionId: number, userId: number) => Promise<void>;
  deposito: (params: { userId: number; sessionId: number; valor: number }) => Promise<void>;
  saque: (params: { userId: number; sessionId: number; valor: number }) => Promise<void>;
  transferencia: (params: { pagadorId: number; recebedorId: number; sessionId: number; valor: number }) => Promise<void>;
  aluguel: (params: { sessionId: number; pagadorId: number; sessionPossesId: number }) => Promise<void>;
  aluguelAcao: (params: { sessionId: number; pagadorId: number; sessionPossesId: number; numDados: number }) => Promise<void>;
  trocaPropriedades: (params: { propriedadeId: number; sessionId: number; userId: number }) => Promise<void>;
  receberDeTodos: (params: { sessionId: number; userId: number }) => Promise<void>;
  comprarHipotecada: (sessionPossesId: number, sessionId: number, compradorId: number) => Promise<void>;
  responderNotificacao: (notificationId: number, aceitar: boolean, respondedorId: number, sessionId: number) => Promise<void>;
  sortearCarta: (sessionId: number, playerId: number) => Promise<{ tipoBaralho: "sorte" | "reves"; carta: SorteRevesCard; effectDescription: string } | null>;
  usarCartaPrisao: (sessionId: number, playerId: number) => Promise<void>;
  pagarDivida: (debtId: number, playerId: number, sessionId: number) => Promise<void>;

  getAvailableColors: (excludePlayerId?: number) => PlayerColor[];
  getAluguel: (propriedade: Propriedade, casas: number) => number;
}

// ─── Utilitário de erro (fora do create, criado uma única vez) ─────────────────

function extractErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    return err.response?.data?.message || err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Erro desconhecido";
}

function handleError(
  set: (state: Partial<GameStore>) => void,
  err: unknown
) {
  set({ error: extractErrorMessage(err), loading: false });
  throw err;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({
  sessions: [],
  currentSession: null,
  loading: false,
  loadingProperty: false,
  networkError: false,
  error: null,
  propertiesCache: {},

  // ── Sessões ──────────────────────────────────────────────────────────────

  createSession: async (nome, senha, modo, maxJogadores, saldoInicial, times, criadorNome, criadorCor, criadorTeamIndex) => {
    set({ loading: true, error: null });
    try {
      const newSession = await createSessionApi(nome, senha, modo, maxJogadores, saldoInicial, times, criadorNome, criadorCor, criadorTeamIndex);
      if (!newSession) return;

      set((state) => ({
        sessions: [...state.sessions, newSession],
        currentSession: newSession,
        propertiesCache: {},
        loading: false,
      }));
      return newSession.id;
    } catch (err) {
      handleError(set, err);
    }
  },

  loadSession: async (sessionId) => {
    const { networkError } = get();
    set({ loading: true, error: null });
    try {
      const session = await loadSessionApi(sessionId);
      const resetCache = get().currentSession?.id !== session.id;

      set({
        currentSession: session,
        loading: false,
        networkError: false,
        ...(resetCache && { propertiesCache: {} }),
      });
    } catch (err) {
      if (!networkError) set({ networkError: true });
      set({ error: extractErrorMessage(err), loading: false });
    }
  },

  startSession: async (sessionId) => {
    set({ loading: true, error: null });
    try {
      const session = await startSessionApi(sessionId);
      set((state) => ({
        currentSession: session,
        sessions: state.sessions.map((s) => s.id === sessionId ? session : s),
        loading: false,
      }));
    } catch (err) {
      handleError(set, err);
    }
  },

  endSession: async (sessionId) => {
    set({ loading: true, error: null });
    try {
      await endSessionApi(sessionId);
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        currentSession: null,
        loading: false,
      }));
    } catch (err) {
      handleError(set, err);
    }
  },

  // ── Jogadores ────────────────────────────────────────────────────────────

  // Usa loadingProperty para não travar a UI principal durante leitura
  getPlayerById: async (playerId) => {
    set({ loadingProperty: true, error: null });
    try {
      const player = await getPlayerByIdApi(playerId);
      set({ loadingProperty: false });
      return player;
    } catch (err) {
      set({ loadingProperty: false, error: extractErrorMessage(err) });
    }
  },

  editPlayer: async (playerId, nome, cor) => {
    set({ loading: true, error: null });
    try {
      await editPlayerApi(playerId, nome, cor);
      set((state) => ({
        currentSession: state.currentSession
          ? {
              ...state.currentSession,
              jogadores: state.currentSession.jogadores.map((j) =>
                j.id === playerId ? { ...j, nome, cor } : j
              ),
            }
          : null,
        loading: false,
      }));
    } catch (err) {
      handleError(set, err);
    }
  },

  removePlayer: async (playerId) => {
    set({ loading: true, error: null });
    try {
      await removePlayerApi(playerId);
      set((state) => ({
        currentSession: state.currentSession
          ? {
              ...state.currentSession,
              jogadores: state.currentSession.jogadores.filter((j) => j.id !== playerId),
            }
          : null,
        loading: false,
      }));
    } catch (err) {
      handleError(set, err);
    }
  },

  // ── Propriedades ─────────────────────────────────────────────────────────

  // Usa loadingProperty para não travar a UI principal durante leitura
  getPropertyById: async (propriedadeId) => {
    const { propertiesCache } = get();
    if (propertiesCache[propriedadeId]) return propertiesCache[propriedadeId];

    set({ loadingProperty: true, error: null });
    try {
      const propriedade = await getPropByIdApi(propriedadeId);
      if (propriedade) {
        set((state) => ({
          propertiesCache: { ...state.propertiesCache, [propriedadeId]: propriedade },
          loadingProperty: false,
        }));
      }
      return propriedade ?? null;
    } catch (err) {
      set({ loadingProperty: false, error: extractErrorMessage(err) });
      return null;
    }
  },

  buyProperty: async (propriedadeId, sessionId, userId) => {
    set({ loading: true, error: null });
    try {
      await buyPropApi(propriedadeId, sessionId, userId);
      set((state) => {
        if (!state.currentSession) return { loading: false };
        const jogadores = state.currentSession.jogadores.map((j) =>
          j.id === userId ? { ...j } : j
        );
        const sessionPosses = state.currentSession.sessionPosses.map((sp) =>
          sp.possesId === propriedadeId ? { ...sp, playerId: userId } : sp
        );
        return {
          currentSession: { ...state.currentSession, jogadores, sessionPosses },
          loading: false,
        };
      });
    } catch (err) {
      handleError(set, err);
    }
  },

  sellPropriedade: async (propriedadeId, sessionId, userId) => {
    set({ loading: true, error: null });
    try {
      await sellPropriedadeApi(propriedadeId, sessionId, userId);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  hipotecarProp: async (propriedadeId, sessionId, userId) => {
    set({ loading: true, error: null });
    try {
      await hipotecarPropApi(propriedadeId, sessionId, userId);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  buyHouse: async ({ userId, sessionId, propriedadeId }) => {
    set({ loading: true, error: null });
    try {
      await buyHouseApi(userId, sessionId, propriedadeId);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  buyHousesBatch: async ({ userId, sessionId, sessaoPossesIds }) => {
    set({ loading: true, error: null });
    try {
      await buyHousesBatchApi(userId, sessionId, sessaoPossesIds);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  sellHousesBatch: async ({ userId, sessionId, items }) => {
    set({ loading: true, error: null });
    try {
      await sellHousesBatchApi(userId, sessionId, items);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  sellHouse: async ({ userId, sessionId, propriedadeId }) => {
    set({ loading: true, error: null });
    try {
      await sellHouseApi(userId, sessionId, propriedadeId);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  // ── Banco ────────────────────────────────────────────────────────────────

  deposito: async ({ userId, sessionId, valor }) => {
    set({ loading: true, error: null });
    try {
      await depositoApi(userId, sessionId, valor);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  saque: async ({ userId, sessionId, valor }) => {
    set({ loading: true, error: null });
    try {
      await saqueApi(userId, sessionId, valor);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  transferencia: async ({ pagadorId, recebedorId, sessionId, valor }) => {
    set({ loading: true, error: null });
    try {
      await transferenciaApi(pagadorId, recebedorId, sessionId, valor);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  aluguel: async ({ sessionId, pagadorId, sessionPossesId }) => {
    set({ loading: true, error: null });
    try {
      await aluguelApi(sessionId, pagadorId, sessionPossesId);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  aluguelAcao: async ({ sessionId, pagadorId, sessionPossesId, numDados }) => {
    set({ loading: true, error: null });
    try {
      await aluguelAcaoApi(sessionId, pagadorId, sessionPossesId, numDados);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  trocaPropriedades: async ({ propriedadeId, sessionId, userId }) => {
    set({ loading: true, error: null });
    try {
      await trocaPropriedadeApi(propriedadeId, sessionId, userId);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  receberDeTodos: async ({ sessionId, userId }) => {
    set({ loading: true, error: null });
    try {
      await receberDeTodosApi(sessionId, userId);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  comprarHipotecada: async (sessionPossesId, sessionId, compradorId) => {
    set({ loading: true, error: null });
    try {
      const result = await comprarHipotecadaApi(sessionPossesId, sessionId, compradorId);
      set({ loading: false });
      return result;
    } catch (err) {
      handleError(set, err);
    }
  },

  responderNotificacao: async (notificationId, aceitar, respondedorId, sessionId) => {
    set({ loading: true, error: null });
    try {
      await responderNotificacaoApi(notificationId, aceitar, respondedorId, sessionId);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  // ── Sorte e Revés ────────────────────────────────────────────────────────

  sortearCarta: async (sessionId, playerId) => {
    set({ loading: true, error: null });
    try {
      const result = await sortearCartaApi(sessionId, playerId);
      set({ loading: false });
      return result;
    } catch (err) {
      handleError(set, err);
    }
  },

  usarCartaPrisao: async (sessionId, playerId) => {
    set({ loading: true, error: null });
    try {
      await usarCartaPrisaoApi(sessionId, playerId);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  pagarDivida: async (debtId, playerId, sessionId) => {
    set({ loading: true, error: null });
    try {
      await pagarDividaApi(debtId, playerId, sessionId);
      set({ loading: false });
    } catch (err) {
      handleError(set, err);
    }
  },

  // ── Utilitários ──────────────────────────────────────────────────────────

  getAvailableColors: (excludePlayerId) => {
    const { currentSession } = get();
    const all = PLAYER_COLORS.map((c) => c.value);
    if (!currentSession) return all;

    const usedColors = currentSession.jogadores
      .filter((j) => j.id !== excludePlayerId)
      .map((j) => j.cor as PlayerColor);

    return all.filter((color) => !usedColors.includes(color));
  },

  getAluguel: (propriedade, casas) => {
    const alugueis = [
      propriedade.aluguel_base,
      propriedade.aluguel_1c,
      propriedade.aluguel_2c,
      propriedade.aluguel_3c,
      propriedade.aluguel_4c,
      propriedade.aluguel_hotel,
    ];
    return alugueis[Math.min(casas, 5)];
  },
}));