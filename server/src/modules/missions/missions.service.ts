import { missionsRepository } from "./missions.repository.js";
import { getLevelFromXp } from "../../utils/level.js";

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

      if (nowCompleted) {
        const user = await missionsRepository.findUserForReward(userId);
        if (!user) continue;

        const newLevel = getLevelFromXp(user.xp + mission.xpReward);
        await missionsRepository.rewardUser(
          userId,
          mission.xpReward,
          mission.coinReward,
          newLevel > user.level ? newLevel : undefined
        );
      }
    }
  }

}
