export type Raridade = "COMUM" | "INCOMUM" | "RARO" | "EPICO" | "LENDARIO"

export interface ProbabilidadeRaridade {
  raridade: Raridade
  peso: number
}

export interface BauConfigEntry {
  tipo: string
  nome: string
  descricao: string
  precoCoins: number | null
  precoDiamonds: number | null
  fragmentosMin: number
  fragmentosMax: number
  itensMin: number
  itensMax: number
  coinsMin: number
  coinsMax: number
  probabilidadesRaridade: ProbabilidadeRaridade[]
}

export const FRAGMENTOS_PESO: Record<Raridade, number> = {
  COMUM:    40,
  INCOMUM:  30,
  RARO:     20,
  EPICO:     7,
  LENDARIO:  3,
}

export const XP_BONUS: Record<string, { min: number; max: number }> = {
  comum:    { min: 500,  max: 1000 },
  premium:  { min: 1500, max: 3000 },
  lendario: { min: 3000, max: 5000 },
}

export const BAU_CONFIG: Record<string, BauConfigEntry> = {
  comum: {
    tipo:          "comum",
    nome:          "Baú Comum",
    descricao:     "Fragmentos de itens e Coins garantidos",
    precoCoins:    500,
    precoDiamonds: null,
    fragmentosMin: 20,
    fragmentosMax: 30,
    itensMin:      3,
    itensMax:      5,
    coinsMin:      100,
    coinsMax:      300,
    probabilidadesRaridade: [
      { raridade: "COMUM",    peso: 60 },
      { raridade: "INCOMUM",  peso: 30 },
      { raridade: "RARO",     peso:  5 },
      { raridade: "EPICO",    peso:  4 },
      { raridade: "LENDARIO", peso:  1 },
    ],
  },
  premium: {
    tipo:          "premium",
    nome:          "Baú Premium",
    descricao:     "Mais fragmentos, melhores chances",
    precoCoins:    null,
    precoDiamonds: 150,
    fragmentosMin: 30,
    fragmentosMax: 50,
    itensMin:      7,
    itensMax:      10,
    coinsMin:      400,
    coinsMax:      800,
    probabilidadesRaridade: [
      { raridade: "COMUM",    peso: 40 },
      { raridade: "INCOMUM",  peso: 30 },
      { raridade: "RARO",     peso: 15 },
      { raridade: "EPICO",    peso: 10 },
      { raridade: "LENDARIO", peso:  5 },
    ],
  },
  lendario: {
    tipo:          "lendario",
    nome:          "Baú Lendário",
    descricao:     "As maiores chances de itens épicos e lendários",
    precoCoins:    null,
    precoDiamonds: 300,
    fragmentosMin: 80,
    fragmentosMax: 120,
    itensMin:      10,
    itensMax:      12,
    coinsMin:      1500,
    coinsMax:      3000,
    probabilidadesRaridade: [
      { raridade: "COMUM",    peso: 20 },
      { raridade: "INCOMUM",  peso: 25 },
      { raridade: "RARO",     peso: 25 },
      { raridade: "EPICO",    peso: 20 },
      { raridade: "LENDARIO", peso: 10 },
    ],
  },
}

export type TipoBau = keyof typeof BAU_CONFIG

export const BAU_TEMPO_ESCOLTA: Record<string, number> = {
  comum:    10,
  premium:  180,
  lendario: 1440,
}

export const MAX_BAUS_PARTIDA_POR_DIA = 4
