import api from './index'

export interface CompraDisponivel {
  propId: number
  sessionPossesId: number
  nome: string
  preco: number
}

export interface RolarDadosResult {
  dado1: number
  dado2: number
  duplo: boolean
  foiPreso: boolean
  novaPosicao?: number
  passouInicio?: boolean
  turnoAtualPlayerId?: number | null
  avancou?: boolean
  aguardandoAcao?: boolean
  compraDisponivel?: CompraDisponivel
  mensagem?: string
  escapouPrisao?: boolean
  aindaPreso?: boolean
  pagouMulta?: boolean
  tentativasPrisao?: number
  falido?: boolean
}

export const turnoApi = {
  passarVez: (sessionId: number) =>
    api.post<{ turnoAtualPlayerId: number | null; avancou: boolean }>(`/turno/${sessionId}/passar-vez`),

  rolarDados: (sessionId: number) =>
    api.post<RolarDadosResult>(`/turno/${sessionId}/rolar-dados`),

  comprarCasaAtual: (sessionId: number) =>
    api.post(`/turno/${sessionId}/comprar-casa-atual`),

  recusarCompra: (sessionId: number) =>
    api.post(`/turno/${sessionId}/recusar-compra`),

  sairPrisaoComCarta: (sessionId: number) =>
    api.post<{ mensagem: string }>(`/turno/${sessionId}/usar-carta-prisao`),
}

export const passarVezApi = (sessionId: number) =>
  turnoApi.passarVez(sessionId).then(res => res.data)

export const rolarDadosApi = (sessionId: number) =>
  turnoApi.rolarDados(sessionId).then(res => res.data)

export const comprarCasaAtualApi = (sessionId: number) =>
  turnoApi.comprarCasaAtual(sessionId).then(res => res.data)

export const recusarCompraApi = (sessionId: number) =>
  turnoApi.recusarCompra(sessionId).then(res => res.data)

export const sairPrisaoComCartaApi = (sessionId: number) =>
  turnoApi.sairPrisaoComCarta(sessionId).then(res => res.data)
