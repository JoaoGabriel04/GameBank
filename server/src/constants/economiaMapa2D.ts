// Constantes econômicas do GameBank 2D (tipoJogo=mapa2d), Fatia 1.
// Domínio separado de economia.ts (Modo Tabuleiro) — valores e fórmulas
// diferentes, calibrados por simulação (ver GAMEBANK_2D_GDD.md).

export const SALDO_INICIAL_MAPA2D = 1000;
export const CUSTO_POR_SLOT = 120;
export const RENDA_BASE_REF = 50; // aluguel de referência região "Popular equivalente"
export const MANUTENCAO_PCT_N1 = 0.12;

export const MULT_CONSTRUCAO: Record<string, number> = {
  casa: 1.0,
  sobrado: 1.6,
  comercio: 1.8,
  apartamento: 2.5,
  centro_comercial: 3.2,
  hotel: 3.0,
  corporativo: 4.0,
};

export const SLOTS_CONSTRUCAO: Record<string, number> = {
  casa: 1,
  sobrado: 2,
  comercio: 2,
  apartamento: 3,
  centro_comercial: 4,
  hotel: 4,
  corporativo: 6,
};

// Imposto progressivo (faixas validadas no GDD Seção 6)
export const FAIXAS_IMPOSTO = [
  { min: 0, max: 1_500, aliquota: 0.01 },
  { min: 1_500, max: 5_000, aliquota: 0.02 },
  { min: 5_000, max: 15_000, aliquota: 0.035 },
  { min: 15_000, max: Infinity, aliquota: 0.055 },
];
export const IPTU_PCT = 0.03;

export const MESES_TOTAIS = 24;
export const RODADA_DURACAO_MS = 5 * 60 * 1000; // 5 minutos
export const MESES_GRACA_FALENCIA = 2; // 2 meses de graça, 3º mês devendo = falência

// Curva de ocupação (validada por simulação — GDD Seção 5)
export const OCUPACAO_LIMIAR_INFERIOR = 0.9; // abaixo disso, ocupação = 100%
export const OCUPACAO_PROB_MINIMA = 0.05;

export function sensibilidadeRegiao(categoria: "comum" | "mediana" | "rica"): number {
  return { comum: 0.15, mediana: 0.3, rica: 0.5 }[categoria];
}

// ── Fatia 2 — Níveis de propriedade (curva validada no GDD Seção 4) ────────
export const NIVEL_MAX: Record<string, number> = {
  casa: 3, sobrado: 3, comercio: 3, apartamento: 5,
  centro_comercial: 4, hotel: 5, corporativo: 5,
};
export const ALUGUEL_GANHO_POR_NIVEL = 0.55;
export const CUSTO_UPGRADE_MULT = 1.8;

/** Manutenção cresce mais rápido em regiões ricas — inquilino mais exigente. */
export function manutencaoGanhoPorNivel(multiplicadorRegiao: number): number {
  return 0.55 + 0.10 * multiplicadorRegiao;
}

// ── Fatia 2 — Empréstimos (EmprestimoMapa) ──────────────────────────────────
export const EMPRESTIMO_MAPA2D_LIMITE_PCT = 0.50;   // 50% do patrimônio livre
export const EMPRESTIMO_MAPA2D_JUROS_PCT = 0.10;    // 10% compostos por mês

// ── Fatia 2 — Reputação (índice de confiança pública, GDD Seção 5) ─────────
export const REPUTACAO_MIN = 0.0;
export const REPUTACAO_MAX = 5.0;
export const REPUTACAO_LIMIAR_VITORIA = 4.0;

export const REPUTACAO_GANHO_PRECO_JUSTO = 0.05;      // por mês, se aluguelPedido <= recomendado
export const REPUTACAO_PERDA_PRECO_ABUSIVO = 0.10;    // por mês, se acima da tolerância da região
export const REPUTACAO_PERDA_VACANCIA_NEGLIGENTE = 0.05; // por mês, se vago por preço não competitivo
export const REPUTACAO_PERDA_ATRASO = 0.15;           // por mês em Devendo
export const REPUTACAO_PERDA_FALENCIA = 1.0;          // penalidade única, no momento da falência

// [A DEFINIR — proposto no GDD, pendente de simulação de partida completa]
export const REPUTACAO_AJUSTE_OCUPACAO_POR_PONTO = 0.10; // ajuste na sensibilidade de ocupação por ponto de reputação acima/abaixo de 3.0
export const LIMIAR_DESEMPATE_REPUTACAO_PCT = 0.12; // % do patrimônio do líder abaixo do qual a Reputação decide o desempate
