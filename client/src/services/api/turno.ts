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
}

// Renda passiva E manutenção NÃO fazem mais parte do extrato do Início —
// passaram a ser por rodada (ver rodada.service.ts no servidor). Só o
// IPTU continua ligado à passagem pelo Início.
export interface ExtratoInicio {
  creditoInicio: number
  iptu: number
  liquido: number
  detalhes: ExtratoInicioDetalhe[]
}

export type EscolhaMovimento = "dado1" | "dado2" | "soma"

export interface RolarDadosResult {
  // Escolha às cegas (Mecânica 3): dado1/dado2 vêm ausentes na resposta de
  // rolar-dados (o jogador ainda não escolheu) e só aparecem na resposta
  // de escolher-movimento, depois que a escolha já foi travada no servidor.
  dado1?: number
  dado2?: number
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
  escolha?: EscolhaMovimento
  passos?: number
  duploValido?: boolean
  // Crédito de Visão: quantos créditos restam para ver os dados antes de
  // escolher. Ausente/undefined = sem crédito disponível (escolha às cegas).
  // Quando > 0, dado1/dado2 são revelados na resposta de rolarDados.
  creditosRestantes?: number
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

  revelarDados: (sessionId: number) =>
    api.post<{ dado1: number; dado2: number; creditosRestantes: number }>(`/turno/${sessionId}/revelar-dados`),
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

export const revelarDadosApi = (sessionId: number) =>
  turnoApi.revelarDados(sessionId).then(res => res.data)
