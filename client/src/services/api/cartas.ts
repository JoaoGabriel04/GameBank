import api from './index'

export const sortearCartaApi = (sessionId: number, playerId: number) =>
  api.post('/cartas/sortear', { sessionId, playerId }).then(res => res.data)

export const usarCartaPrisaoApi = (sessionId: number, playerId: number) =>
  api.post('/cartas/usar-prisao', { sessionId, playerId }).then(res => res.data)
