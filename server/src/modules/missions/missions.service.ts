import { missionsRepository } from "./missions.repository.js";
import { getLevelFromXp } from "../../utils/level.js";
import { AppError } from "../../middleware/error-handler.middleware.js";

export class MissionsService {
  async getUserMissions(userId: number) {
    const allMissions = await missionsRepository.findActiveMissions();
    const userMissions = await missionsRepository.findUserMissions(userId);
    const progressMap = new Map(userMissions.map((m) => [m.missionId, m]));

    return allMissions.map((mission) => {
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
        progress: progress?.progress ?? 0,
        completed: progress?.completed ?? false,
        claimed: progress?.claimed ?? false,
      };
    });
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

    return {
      xpEarned: userMission.mission.xpReward,
      coinsEarned: userMission.mission.coinReward,
      newXp: user.xp + userMission.mission.xpReward,
      newCoins: user.coins + userMission.mission.coinReward,
      newLevel: newLevel > user.level ? newLevel : user.level,
    };
  }

}
