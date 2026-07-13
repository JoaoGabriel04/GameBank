// Percentuais calibrados por simulação contra a economia real do jogo
// (saldo inicial R$ 25.000, propriedades R$ 600-4.000).
// AJUSTÁVEIS: revisar após 3-5 partidas reais.

/** IPTU: % do custo_compra.
 *  Cobrado ao PASSAR PELO INÍCIO (junto com o crédito de R$ 2.000). */
export const IPTU_PCT = 0.25;

/** Manutenção: % do custo_casa, por casa construída.
 *  Cobrada POR RODADA (junto com a renda passiva), não por volta. */
export const MANUTENCAO_PCT = 0.12;

/** Renda passiva: % do aluguel atual (considerando nº de casas).
 *  Creditada POR RODADA (não por volta). */
export const RENDA_PASSIVA_PCT = 0.35;

/** Hotel conta como 5 casas para efeito de manutenção. */
export const HOTEL_EQUIVALE_CASAS = 5;

/** Leilão Cego: lance mínimo, % do preço de tabela da propriedade. */
export const LEILAO_LANCE_MINIMO_PCT = 0.50;

/** Leilão Cego: tempo para dar o lance (ms). */
export const LEILAO_TIMEOUT_MS = 30_000;

/** Limite de crédito: % do valor das propriedades não hipotecadas. */
export const EMPRESTIMO_LIMITE_PCT = 0.50;

/** Juros compostos por rodada. */
export const EMPRESTIMO_JUROS_PCT = 0.10;
