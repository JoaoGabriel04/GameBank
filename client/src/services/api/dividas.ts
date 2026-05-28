import api from './index'
import type { Debt } from '@/types/game'

export const listarDividasApi = (sessionId: number, playerId: number): Promise<Debt[]> =>
  api.get(`/dividas/${sessionId}/${playerId}`).then(res => res.data)

export const pagarDividaApi = (debtId: number, playerId: number, sessionId: number) =>
  api.put(`/dividas/pagar/${debtId}`, { playerId, sessionId }).then(res => res.data)
