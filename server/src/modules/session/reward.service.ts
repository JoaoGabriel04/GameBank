import { REWARD_CONFIG } from "../../config/rewards.js";
import { prisma } from "../../lib/prisma.js";

interface RewardInput {
  userId: number;
  playerId: number; // SessionPlayer.id — usado para medir atividade na partida
  sessionId: number;
  position: number;
  patrimony: number;
  sessionStartedAt: Date;
}

export interface RewardResult {
  coins: number;
  xp: number;
  activityScore: number;
  multiplier: number;
  penaltyReason: string | null;
  breakdown: string[]; // para debug/auditoria
}

export async function calcularRecompensa(input: RewardInput): Promise<RewardResult> {
  const { userId, playerId, sessionId, position, sessionStartedAt } = input;
  const cfg = REWARD_CONFIG;
  const breakdown: string[] = [];
  let penaltyReason: string | null = null;

  // 1. Posição tem recompensa?
  const baseReward = cfg.byPosition[position];
  if (!baseReward) {
    return {
      coins: 0,
      xp: 0,
      activityScore: 0,
      multiplier: 0,
      penaltyReason: "Posição sem recompensa",
      breakdown: ["Posição fora do top 3"],
    };
  }
  breakdown.push(`Base: ${baseReward.coins} coins, ${baseReward.xp} XP (${position}º lugar)`);

  // 2. Duração da partida
  const agora = new Date();
  const duracaoMinutos = Math.floor((agora.getTime() - sessionStartedAt.getTime()) / 1000 / 60);

  // 3. Duração mínima
  if (duracaoMinutos < cfg.antiFarm.minDurationMinutes) {
    return {
      coins: 0,
      xp: 0,
      activityScore: 0,
      multiplier: 0,
      penaltyReason: `Partida muito curta (${duracaoMinutos}min < ${cfg.antiFarm.minDurationMinutes}min)`,
      breakdown: [`Partida encerrada em ${duracaoMinutos} minutos — abaixo do mínimo`],
    };
  }

  // 4. Score de atividade
  const activityScore = await calcularAtividade(playerId, sessionId);
  breakdown.push(`Atividade: ${activityScore} pontos`);

  // 5. Atividade mínima
  const lowActivity = activityScore < cfg.antiFarm.minActivityScore;
  if (lowActivity) {
    penaltyReason = `Atividade insuficiente (score: ${activityScore})`;
    const penaltyMultiplier: number = cfg.antiFarm.lowActivityMultiplier;
    breakdown.push(`Penalidade por baixa atividade: multiplicador ${penaltyMultiplier}`);
    if (penaltyMultiplier === 0) {
      return { coins: 0, xp: 0, activityScore, multiplier: 0, penaltyReason, breakdown };
    }
  }

  // 6. Cooldown desde a última partida recompensada
  const ultimaRecompensa = await prisma.gameResult.findFirst({
    where: { userId, coinsEarned: { gt: 0 } },
    orderBy: { createdAt: "desc" },
  });
  if (ultimaRecompensa) {
    const minutosDesdeUltima = (agora.getTime() - ultimaRecompensa.createdAt.getTime()) / 1000 / 60;
    if (minutosDesdeUltima < cfg.antiFarm.cooldownMinutes) {
      const minutosRestantes = Math.ceil(cfg.antiFarm.cooldownMinutes - minutosDesdeUltima);
      return {
        coins: 0,
        xp: 0,
        activityScore,
        multiplier: 0,
        penaltyReason: `Cooldown ativo (${minutosRestantes}min restantes)`,
        breakdown: [`Última recompensa há ${Math.floor(minutosDesdeUltima)}min`],
      };
    }
  }

  // 7. Multiplicador por duração
  let durationMultiplier = 1.0;
  for (const tier of cfg.durationBonus) {
    if (duracaoMinutos >= tier.minMinutes) {
      durationMultiplier = tier.multiplier;
      breakdown.push(`Bônus de duração: ×${tier.multiplier} (${tier.label} — ${duracaoMinutos}min)`);
      break;
    }
  }

  // 8. Cap diário acumulado
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const acumuladoHoje = await prisma.gameResult.aggregate({
    where: { userId, createdAt: { gte: inicioDia }, coinsEarned: { gt: 0 } },
    _sum: { coinsEarned: true, xpEarned: true },
  });
  const coinsHoje = acumuladoHoje._sum.coinsEarned ?? 0;
  const xpHoje = acumuladoHoje._sum.xpEarned ?? 0;

  // 9. Recompensa final
  const multiplier = durationMultiplier * (lowActivity ? cfg.antiFarm.lowActivityMultiplier : 1.0);

  let coinsFinais = Math.floor(baseReward.coins * multiplier);
  let xpFinais = Math.floor(baseReward.xp * multiplier);

  // Aplicar cap diário
  coinsFinais = Math.max(0, Math.min(coinsFinais, cfg.antiFarm.dailyCapCoins - coinsHoje));
  xpFinais = Math.max(0, Math.min(xpFinais, cfg.antiFarm.dailyCapXp - xpHoje));

  if (coinsHoje >= cfg.antiFarm.dailyCapCoins) {
    penaltyReason = "Cap diário de coins atingido";
    breakdown.push("Cap diário atingido — coins zerados");
    coinsFinais = 0;
  }

  breakdown.push(`Final: ${coinsFinais} coins, ${xpFinais} XP`);

  return { coins: coinsFinais, xp: xpFinais, activityScore, multiplier, penaltyReason, breakdown };
}

/**
 * Score de participação do jogador na partida.
 * Adaptado ao schema real do GameBank — a atividade é medida por SessionPlayer
 * (playerId), não por User, pois propriedades/negociações/dívidas referenciam
 * o jogador dentro da sessão.
 *
 * Pesos: negociar (×3) > comprar propriedade (×2) > endividar-se (×1).
 * As leituras devem ocorrer ANTES da deleção da sessão na finalização.
 */
async function calcularAtividade(playerId: number, sessionId: number): Promise<number> {
  const [propriedades, negociacoes, dividas] = await Promise.all([
    // Propriedades possuídas pelo jogador na sessão
    prisma.sessionPosses.count({ where: { sessionId, playerId } }).catch(() => 0),

    // Negociações propostas ou recebidas pelo jogador
    prisma.negotiation
      .count({
        where: { sessionId, OR: [{ fromPlayerId: playerId }, { toPlayerId: playerId }] },
      })
      .catch(() => 0),

    // Dívidas em que o jogador esteve envolvido (proxy de transações bancárias)
    prisma.debt.count({ where: { sessionId, playerId } }).catch(() => 0),
  ]);

  return dividas + propriedades * 2 + negociacoes * 3;
}
