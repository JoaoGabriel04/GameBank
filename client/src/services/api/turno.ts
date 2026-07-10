import api from './index'

export interface RolarDadosResult {
  dado1: number
  dado2: number
  duplo: boolean
  foiPreso: boolean
  novaPosicao: number
  passouInicio: boolean
  turnoAtualPlayerId?: number | null
  avancou?: boolean
}

export const turnoApi = {
  passarVez: (sessionId: number) =>
    api.post<{ turnoAtualPlayerId: number | null; avancou: boolean }>(`/turno/${sessionId}/passar-vez`),

  rolarDados: (sessionId: number) =>
    api.post<RolarDadosResult>(`/turno/${sessionId}/rolar-dados`),
}

export const passarVezApi = (sessionId: number) =>
  turnoApi.passarVez(sessionId).then(res => res.data)

export const rolarDadosApi = (sessionId: number) =>
  turnoApi.rolarDados(sessionId).then(res => res.data)
