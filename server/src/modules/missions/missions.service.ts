import { missionsRepository } from "./missions.repository.js";
import { getLevelFromXp } from "../../utils/level.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { gerarMissoesParaUsuario } from "./mission-generator.service.js";
import { prisma } from "../../lib/prisma.js";

export class MissionsService {
  async getUserMissions(userId: number) {
    // Geração lazy: cria missões diárias/semanais se necessário
    await gerarMissoesParaUsuario(userId);

    const now = new Date();

    // Missões permanentes
    const allMissions = await missionsRepository.findActiveMissions();
    const permanentMissions = allMissions.filter((m) => (m as { tipo?: string }).tipo === "permanent" || !(m as { tipo?: string }).tipo);
    const userMissions = await missionsRepository.findUserMissions(userId);
    const progressMap = new Map(userMissions.map((m) => [m.missionId, m]));

    const permanentResult = permanentMissions.map((mission) => {
      const progress = progressMap.get(mission.id);
      return {
        id: mission.id,
        name: mission.name,
        description: mission.description,
        metric: mission.metric,
        target: mission.target,
        perGame: mission.perGame,
        xpReward: mission.xpReward,
        coinReward: mission.coinReward,
        tipo: "permanent" as const,
        expiresAt: null,
        progress: progress?.progress ?? 0,
        completed: progress?.completed ?? false,
        claimed: progress?.claimed ?? false,
      };
    });

    // Missões diárias/semanais (não expiradas)
    const timedUserMissions = await prisma.userMission.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: { gt: now } },
          { expiresAt: null },
        ],
        mission: { tipo: { in: ["daily", "weekly"] } },
      },
      include: { mission: true },
    });

    const timedResult = timedUserMissions.map((um) => ({
      id: um.mission.id,
      userMissionId: um.id,
      name: um.mission.name,
      description: um.mission.description,
      metric: um.mission.metric,
      target: um.mission.target,
      perGame: um.mission.perGame,
      xpReward: um.mission.xpReward,
      coinReward: um.mission.coinReward,
      tipo: um.mission.tipo as "daily" | "weekly",
      expiresAt: um.expiresAt,
      progress: um.progress,
      completed: um.completed,
      claimed: um.claimed,
    }));

    return [...timedResult, ...permanentResult];
  }

  async track(userId: number, metric: string, amount: number, sessionId?: number) {
    const missions = await missionsRepository.findActiveMissionsByMetric(metric);

    for (const mission of missions) {
      const existing = await missionsRepository.findUserMission(userId, mission.id);

      const newProgress = Math.min((existing?.progress ?? 0) + amount, mission.target);
      const wasCompleted = existing?.completed ?? false;
      const nowCompleted = newProgress >= mission.target && !wasCompleted;

      await missionsRepository.upsertUserMission(
        userId,
        mission.id,
        newProgress,
        nowCompleted,
        nowCompleted ? new Date() : undefined,
        existing?.completedAt
      );
    }
  }

  async claimMission(userId: number, missionId: number) {
    const userMission = await missionsRepository.findUserMissionForClaim(userId, missionId);

    if (!userMission) {
      throw new AppError(404, "Missão não encontrada");
    }

    if (!userMission.completed) {
      throw new AppError(400, "Missão ainda não foi concluída");
    }

    if (userMission.claimed) {
      throw new AppError(409, "Recompensa já foi resgatada");
    }

    const user = await missionsRepository.findUserForReward(userId);
    if (!user) {
      throw new AppError(404, "Usuário não encontrado");
    }

    const newLevel = getLevelFromXp(user.xp + userMission.mission.xpReward);
    const tipo = userMission.mission.tipo;

    if (tipo === "daily" || tipo === "weekly") {
      await prisma.$transaction(async (tx) => {
        await tx.userMission.delete({ where: { id: userMission.id } });
        await tx.user.update({
          where: { id: userId },
          data: {
            xp: { increment: userMission.mission.xpReward },
            coins: { increment: userMission.mission.coinReward },
            ...(newLevel > user.level ? { level: newLevel } : {}),
          },
        });
        await tx.mission.delete({ where: { id: missionId } });
      });
    } else {
      try {
        await missionsRepository.claimMission(
          userId,
          missionId,
          userMission.mission.xpReward,
          userMission.mission.coinReward,
          newLevel > user.level ? newLevel : undefined
        );
      } catch (err) {
        if (err instanceof Error && err.message === "Mission already claimed") {
          throw new AppError(409, "Recompensa já foi resgatada");
        }
        throw err;
      }
    }

    return {
      xpEarned: userMission.mission.xpReward,
      coinsEarned: userMission.mission.coinReward,
      newXp: user.xp + userMission.mission.xpReward,
      newCoins: user.coins + userMission.mission.coinReward,
      newLevel: newLevel > user.level ? newLevel : user.level,
      tipo,
    };
  }

}
