import api from './index'
import { GameSession } from '@/types/game'
import { PlayerColor } from '@/types/game'

export interface TeamInput {
  nome: string;
  cor: string;
}

export interface CreateSessionOptions {
  nome?: string;
  senha?: string;
  modo?: 'individual' | 'duplas';
  maxJogadores?: number;
  saldoInicial?: number;
  times?: TeamInput[];
  criadorNome?: string;
  criadorCor?: string;
  criadorTeamIndex?: number;
}

export const sessionsApi = {
  getAll: () => api.get<GameSession[]>('/sessions/all-sessions'),
  
  create: (data: CreateSessionOptions) =>
    api.post<GameSession & { roomToken?: string }>('/sessions/new-session', data),
  
  join: (sessionId: number, data: { senha?: string; nome: string; cor: string; teamId?: number; spectator?: boolean }) =>
    api.post<GameSession & { roomToken?: string }>(`/sessions/${sessionId}/join`, data),
  
  start: (sessionId: number) =>
    api.post<GameSession>(`/sessions/${sessionId}/start`),

  desistir: (sessionId: number) =>
    api.post<{ message: string }>(`/sessions/${sessionId}/desistir`),

  quit: (sessionId: number) =>
    api.post<{ message: string }>(`/sessions/${sessionId}/quit`),

  myPlayer: (sessionId: number) =>
    api.get<{ player: { id: number; nome: string; cor: string } | null }>(`/sessions/${sessionId}/my-player`),

  load: (sessionId: number) =>
    api.post<GameSession>(`/sessions/load-session/${sessionId}`),

  delete: (sessionId: number) =>
    api.delete<GameSession>(`/sessions/delete/${sessionId}`),

  getMyActive: () =>
    api.get<{ session: { id: number; nome: string; modo: string; status: string } | null }>('/sessions/my-active'),
}

export const getSessionsApi = () => sessionsApi.getAll().then(res => res.data)

export const createSessionApi = (nome: string, senha?: string, modo?: 'individual' | 'duplas', maxJogadores?: number, saldoInicial?: number, times?: TeamInput[], criadorNome?: string, criadorCor?: string, criadorTeamIndex?: number): Promise<GameSession> =>
  sessionsApi.create({ nome, senha, modo, maxJogadores, saldoInicial, times, criadorNome, criadorCor, criadorTeamIndex }).then(res => res.data)

export const joinSessionApi = (sessionId: number, data: { senha?: string; nome: string; cor: string; teamId?: number }): Promise<GameSession> =>
  sessionsApi.join(sessionId, data).then(res => res.data)

export const loadSessionApi = (sessionId: number): Promise<GameSession> =>
  sessionsApi.load(sessionId).then(res => res.data)

export const endSessionApi = (sessionId: number): Promise<GameSession> =>
  sessionsApi.delete(sessionId).then(res => res.data)

export const startSessionApi = (sessionId: number): Promise<GameSession> =>
  sessionsApi.start(sessionId).then(res => res.data)
