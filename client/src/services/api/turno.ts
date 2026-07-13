import api from './index'

export interface CompraDisponivel {
  propId: number
  sessionPossesId: number
  nome: string
  preco: number
}

export interface ExtratoInicioDetalhe {
  propId: number
  nome: string
  casas: number
  iptu: number
  manutencao: number
}

// Renda passiva NÃO faz mais parte do extrato do Início — passou a ser
// paga por rodada (ver rodada.service.ts no servidor).
export interface ExtratoInicio {
  creditoInicio: number
  iptu: number
  manutencao: number
  liquido: number
  detalhes: ExtratoInicioDetalhe[]
}

export type EscolhaMovimento = "dado1" | "dado2" | "soma"

export interface OpcaoMovimento {
  tipo: EscolhaMovimento
  passos: number
  destino: number
  nomeCasa: string
  tipoCasa: string
  passaInicio: boolean
}

export interface RolarDadosResult {
  dado1: number
  dado2: number
  duplo: boolean
  foiPreso: boolean
  novaPosicao?: number
  passouInicio?: boolean
  extratoInicio?: ExtratoInicio | null
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
  // Escolha de Movimento (Mecânica 3)
  aguardandoEscolha?: boolean
  opcoes?: OpcaoMovimento[]
  escolha?: EscolhaMovimento
  passos?: number
  duploValido?: boolean
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

  escolherMovimento: (sessionId: number, escolha: EscolhaMovimento) =>
    api.post<RolarDadosResult>(`/turno/${sessionId}/escolher-movimento`, { escolha }),
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

export const escolherMovimentoApi = (sessionId: number, escolha: EscolhaMovimento) =>
  turnoApi.escolherMovimento(sessionId, escolha).then(res => res.data)
