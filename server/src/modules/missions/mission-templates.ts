export interface MissionTemplate {
  nameTemplate: string
  description: string
  metric: string
  targetOptions: number[]
  xpBase: number
  coinBase: number
  fixedReward?: boolean
}

export const DAILY_TEMPLATES: MissionTemplate[] = [
  {
    nameTemplate: "Jogador do Dia",
    description: "Jogue partidas hoje",
    metric: "games_played",
    targetOptions: [1, 2, 3],
    xpBase: 30,
    coinBase: 20,
  },
  {
    nameTemplate: "Vencedor do Dia",
    description: "Vença uma partida hoje",
    metric: "wins",
    targetOptions: [1],
    xpBase: 60,
    coinBase: 40,
  },
  {
    nameTemplate: "Pódio Diário",
    description: "Chegue ao top 3 hoje",
    metric: "top3",
    targetOptions: [1, 2],
    xpBase: 40,
    coinBase: 25,
  },
  {
    nameTemplate: "Corretor do Dia",
    description: "Compre propriedades hoje",
    metric: "properties_bought",
    targetOptions: [1, 2, 3],
    xpBase: 20,
    coinBase: 15,
  },
  {
    nameTemplate: "Construtor do Dia",
    description: "Construa casas hoje",
    metric: "houses_built",
    targetOptions: [1, 2],
    xpBase: 25,
    coinBase: 18,
  },
  {
    nameTemplate: "Rentista do Dia",
    description: "Receba aluguéis hoje (R$)",
    metric: "rent_earned",
    targetOptions: [500, 1000, 2000],
    xpBase: 40,
    coinBase: 25,
    fixedReward: true,
  },
]

export const WEEKLY_TEMPLATES: MissionTemplate[] = [
  {
    nameTemplate: "Maratonista",
    description: "Jogue partidas esta semana",
    metric: "games_played",
    targetOptions: [5, 7, 10],
    xpBase: 25,
    coinBase: 18,
  },
  {
    nameTemplate: "Campeão da Semana",
    description: "Vença partidas esta semana",
    metric: "wins",
    targetOptions: [3, 5, 7],
    xpBase: 50,
    coinBase: 35,
  },
  {
    nameTemplate: "Pódio Semanal",
    description: "Chegue ao top 3 esta semana",
    metric: "top3",
    targetOptions: [3, 5, 8],
    xpBase: 35,
    coinBase: 22,
  },
  {
    nameTemplate: "Magnata Imobiliário",
    description: "Compre propriedades esta semana",
    metric: "properties_bought",
    targetOptions: [5, 8, 12],
    xpBase: 18,
    coinBase: 12,
  },
  {
    nameTemplate: "Empreiteiro",
    description: "Construa casas esta semana",
    metric: "houses_built",
    targetOptions: [3, 5, 8],
    xpBase: 22,
    coinBase: 15,
  },
  {
    nameTemplate: "Rentista",
    description: "Receba aluguéis esta semana (R$)",
    metric: "rent_earned",
    targetOptions: [2000, 5000, 10000],
    xpBase: 80,
    coinBase: 50,
    fixedReward: true,
  },
]

export const DAILY_COUNT = 4
export const WEEKLY_COUNT = 6
