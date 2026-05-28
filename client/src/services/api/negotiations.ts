import api from './index'

export const criarNegociacaoApi = (
  sessionId: number,
  fromPlayerId: number,
  toPlayerId: number,
  offerItems: { sessionPossesId?: number | null; fromSide: boolean; valor?: number | null }[],
  wantItems: { sessionPossesId?: number | null; fromSide: boolean; valor?: number | null }[]
) =>
  api.post('/negociacoes/criar', { sessionId, fromPlayerId, toPlayerId, offerItems, wantItems }).then(res => res.data)

export const aceitarNegociacaoApi = (id: number, playerId: number) =>
  api.post(`/negociacoes/${id}/aceitar`, { playerId }).then(res => res.data)

export const recusarNegociacaoApi = (id: number, playerId: number) =>
  api.post(`/negociacoes/${id}/recusar`, { playerId }).then(res => res.data)

export const contraOfertarNegociacaoApi = (
  id: number,
  playerId: number,
  offerItems: { sessionPossesId?: number | null; fromSide: boolean; valor?: number | null }[],
  wantItems: { sessionPossesId?: number | null; fromSide: boolean; valor?: number | null }[]
) =>
  api.post(`/negociacoes/${id}/contra-oferta`, { playerId, offerItems, wantItems }).then(res => res.data)

export const listarPendentesApi = (sessionId: number, playerId: number) =>
  api.get(`/negociacoes/pendentes/${playerId}`, { params: { sessionId } }).then(res => res.data)
