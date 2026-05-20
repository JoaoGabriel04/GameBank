import api from './index'
import { GameSession } from '@/types/game'
import { PlayerColor } from '@/types/game'

export const sessionsApi = {
  getAll: () => api.get<GameSession[]>('/sessions/all-sessions'),
  
  create: (nome: string, jogadores: { nome: string; cor: PlayerColor }[]) =>
    api.post<GameSession>('/sessions/new-session', { nome, jogadores }),
  
  load: (sessionId: number) =>
    api.post<GameSession>(`/sessions/load-session/${sessionId}`),
  
  delete: (sessionId: number) =>
    api.delete<GameSession>(`/sessions/delete/${sessionId}`),
}

// Funções helper para compatibilidade com a store
export const getSessionsApi = () => sessionsApi.getAll().then(res => res.data)

export const createSessionApi = (nome: string, jogadores: { nome: string; cor: PlayerColor }[]): Promise<GameSession> =>
  sessionsApi.create(nome, jogadores).then(res => res.data)

export const loadSessionApi = (sessionId: number): Promise<GameSession> =>
  sessionsApi.load(sessionId).then(res => res.data)

export const endSessionApi = (sessionId: number): Promise<GameSession> =>
  sessionsApi.delete(sessionId).then(res => res.data)