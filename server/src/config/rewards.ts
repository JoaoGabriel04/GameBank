// Configuração centralizada de recompensas de partida + proteções anti-farm.
// Para rebalancear o sistema, edite apenas este arquivo.

export const REWARD_CONFIG = {
  // Recompensa base por posição final. Estrutura: { coins, xp }.
  byPosition: {
    1: { coins: 500, xp: 400 },
    2: { coins: 350, xp: 200 },
    3: { coins: 200, xp: 100 },
  } as Record<number, { coins: number; xp: number }>,

  // Recompensa para 4º lugar em diante
  default: { coins: 100, xp: 50 },

  // Bônus por duração da partida — incentiva partidas mais longas e legítimas.
  // Avaliado de cima para baixo: usa o primeiro tier cujo minMinutes for atingido.
  durationBonus: [
    { minMinutes: 60, multiplier: 1.5, label: "Partida longa" },
    { minMinutes: 30, multiplier: 1.2, label: "Partida normal" },
    { minMinutes: 10, multiplier: 1.0, label: "Partida curta" },
  ],

  // Proteções anti-farm.
  antiFarm: {
    // Duração mínima (min) para receber qualquer recompensa.
    minDurationMinutes: 5,

    // Cooldown (min) entre partidas recompensadas, por usuário.
    cooldownMinutes: 20,

    // Score mínimo de atividade para recompensa completa.
    minActivityScore: 3,

    // Multiplicador aplicado quando a atividade é baixa (conta laranja/AFK).
    // 0 = sem recompensa se AFK.
    lowActivityMultiplier: 0.0,

    // Cap diário de coins ganhos via partidas.
    dailyCapCoins: 600,

    // Cap diário de XP ganho via partidas.
    dailyCapXp: 500,
  },
} as const;
