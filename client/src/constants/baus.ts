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

export const BAU_CONFIG: Record<string, BauConfigEntry> = {
  comum: {
    tipo:          "comum",
    nome:          "Baú Comum",
    descricao:     "Fragmentos de itens e Coins garantidos",
    precoCoins:    1000,
    precoDiamonds: null,
    fragmentosMin: 20,
    fragmentosMax: 30,
    itensMin:      3,
    itensMax:      5,
    coinsMin:      50,
    coinsMax:      200,
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
    precoDiamonds: 100,
    fragmentosMin: 30,
    fragmentosMax: 50,
    itensMin:      7,
    itensMax:      10,
    coinsMin:      800,
    coinsMax:      1500,
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
    precoDiamonds: 250,
    fragmentosMin: 80,
    fragmentosMax: 120,
    itensMin:      10,
    itensMax:      12,
    coinsMin:      3000,
    coinsMax:      5000,
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

