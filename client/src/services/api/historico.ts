import api from './index'
import type { Transacao } from '@/types/game'

export type PaginaHistorico = { itens: Transacao[]; proximoCursor: number | null }

// Histórico completo da partida, mais recentes primeiro. O payload da sessão
// só traz as últimas entradas; o resto vem daqui, página a página.
export const listarHistoricoApi = (sessionId: number, antesDe?: number) =>
  api.get<PaginaHistorico>(`/historico/${sessionId}`, { params: { limite: 100, antesDe } }).then(res => res.data)
