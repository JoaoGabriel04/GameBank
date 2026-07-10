import api from './index'

export const turnoApi = {
  passarVez: (sessionId: number) =>
    api.post<{ turnoAtualPlayerId: number | null; avancou: boolean }>(`/turno/${sessionId}/passar-vez`),
}

export const passarVezApi = (sessionId: number) =>
  turnoApi.passarVez(sessionId).then(res => res.data)
