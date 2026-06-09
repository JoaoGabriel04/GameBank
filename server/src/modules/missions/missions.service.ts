import { missionsRepository } from "./missions.repository.js";
import { addXp } from "../../utils/level.js";
import { AppError } from "../../middleware/error-handler.middleware.js";
import { gerarMissoesParaUsuario } from "./mission-generator.service.js";
import { prisma } from "../../lib/prisma.js";

export class MissionsService {
  async getUserMissions(userId: number) {
    // Geração lazy: cria missões diárias/semanais se necessário
    await gerarMissoesParaUsuario(userId);

    const now = new Date();

    // Missões diárias/semanais (não expiradas)
    const timedUserMissions = await prisma.userMission.findMany({
      where: {
        userId,
        expiresAt: { gt: now },
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
      xpReward: um.mission.xpReward,
      coinReward: um.mission.coinReward,
      tipo: um.mission.tipo as "daily" | "weekly",
      expiresAt: um.expiresAt,
      progress: um.progress,
      completed: um.completed,
      claimed: um.claimed,
    }));

    return timedResult;
  }

  async track(userId: number, metric: string, amount: number, sessionId?: number) {
    // Find user's own missions with this metric (all missions are per-user)
    const userMissions = await missionsRepository.findUserMissionsByMetric(userId, metric);

    for (const um of userMissions) {
      if (um.claimed) continue;

      const newProgress = Math.min(um.progress + amount, um.mission.target);
      const wasCompleted = um.completed;
      const nowCompleted = newProgress >= um.mission.target && !wasCompleted;

      await missionsRepository.upsertUserMission(
        userId,
        um.missionId,
        newProgress,
        nowCompleted,
        nowCompleted ? new Date() : undefined,
        um.completedAt
      );
    }
  }

  async claimAllMissions(userId: number) {
    const userMissions = await missionsRepository.findCompletedUserMissions(userId);
    if (userMissions.length === 0) {
      throw new AppError(404, "Nenhuma missão concluída para resgatar");
    }

    const user = await missionsRepository.findUserForReward(userId);
    if (!user) {
      throw new AppError(404, "Usuário não encontrado");
    }

    let totalXpEarned = 0;
    let totalCoins = 0;
    let { xp: currentXp, level: currentLevel } = { xp: user.xp, level: user.level };

    const deleteUserMissionIds: number[] = [];
    const deleteMissionIds: number[] = [];

    for (const um of userMissions) {
      totalXpEarned += um.mission.xpReward;
      const result = addXp(currentXp, currentLevel, um.mission.xpReward);
      currentXp = result.xp;
      currentLevel = result.level;
      totalCoins += um.mission.coinReward;

      deleteUserMissionIds.push(um.id);
      deleteMissionIds.push(um.mission.id);
    }

    await prisma.$transaction(async (tx) => {
      if (deleteUserMissionIds.length > 0) {
        await tx.userMission.deleteMany({ where: { id: { in: deleteUserMissionIds } } });
      }
      if (deleteMissionIds.length > 0) {
        const orphaned = await tx.mission.findMany({
          where: { id: { in: deleteMissionIds }, userMissions: { none: {} } },
          select: { id: true },
        });
        if (orphaned.length > 0) {
          await tx.mission.deleteMany({ where: { id: { in: orphaned.map((m) => m.id) } } });
        }
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          xp: currentXp,
          level: currentLevel,
          coins: { increment: totalCoins },
        },
      });
    });

    return {
      xpEarned: totalXpEarned,
      coinsEarned: totalCoins,
      newXp: currentXp,
      newCoins: user.coins + totalCoins,
      newLevel: currentLevel,
      claimedCount: userMissions.length,
    };
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

    const { xp: newXp, level: newLevel } = addXp(user.xp, user.level, userMission.mission.xpReward);
    const tipo = userMission.mission.tipo;

    await prisma.$transaction(async (tx) => {
      await tx.userMission.delete({ where: { id: userMission.id } });
      await tx.user.update({
        where: { id: userId },
        data: {
          xp: newXp,
          level: newLevel,
          coins: { increment: userMission.mission.coinReward },
        },
      });
      const remaining = await tx.userMission.count({ where: { missionId } });
      if (remaining === 0) {
        await tx.mission.delete({ where: { id: missionId } });
      }
    });

    return {
      xpEarned: userMission.mission.xpReward,
      coinsEarned: userMission.mission.coinReward,
      newXp,
      newCoins: user.coins + userMission.mission.coinReward,
      newLevel,
      tipo,
    };
  }

}
