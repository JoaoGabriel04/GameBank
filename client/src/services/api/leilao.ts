import api from './index'

export interface LeilaoIniciadoData {
  propId: number
  nome: string
  precoTabela: number
  lanceMinimo: number
  timeoutMs: number
}

export interface LeilaoJogadorDecidiuData {
  playerId: number
}

export interface LeilaoLanceRevelado {
  playerId: number
  valor: number
}

export interface LeilaoResultadoData {
  propId: number
  lances: LeilaoLanceRevelado[]
  vencedorId: number | null
  valorFinal: number | null
}

export interface DarLanceResult {
  lanceRegistrado?: boolean
  leilaoEncerrado?: boolean
  vencedor?: { playerId: number; valor: number } | null
  avancou?: boolean
  duplo?: boolean
  turnoAtualPlayerId?: number | null
}

export const leilaoApi = {
  darLance: (sessionId: number, valor: number) =>
    api.post<DarLanceResult>(`/leilao/${sessionId}/lance`, { valor }),
}

export const darLanceApi = (sessionId: number, valor: number) =>
  leilaoApi.darLance(sessionId, valor).then(res => res.data)
