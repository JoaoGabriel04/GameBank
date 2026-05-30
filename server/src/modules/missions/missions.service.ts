import { prisma } from "../../lib/prisma.js";

export class MissionsService {
  async getUserMissions(userId: number) {
    const allMissions = await prisma.mission.findMany({ where: { active: true } });
    const userMissions = await prisma.userMission.findMany({ where: { userId } });
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
    const missions = await prisma.mission.findMany({
      where: { active: true, metric },
    });

    for (const mission of missions) {
      const existing = await prisma.userMission.findUnique({
        where: { userId_missionId: { userId, missionId: mission.id } },
      });

      const newProgress = Math.min((existing?.progress ?? 0) + amount, mission.target);
      const wasCompleted = existing?.completed ?? false;
      const nowCompleted = newProgress >= mission.target && !wasCompleted;

      await prisma.userMission.upsert({
        where: { userId_missionId: { userId, missionId: mission.id } },
        create: { userId, missionId: mission.id, progress: newProgress, completed: nowCompleted, completedAt: nowCompleted ? new Date() : undefined },
        update: { progress: newProgress, completed: nowCompleted, completedAt: nowCompleted ? new Date() : existing?.completedAt },
      });

      if (nowCompleted) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { xp: true, level: true },
        });
        if (!user) continue;

        const newLevel = this.getLevelFromXp(user.xp + mission.xpReward);

        await prisma.user.update({
          where: { id: userId },
          data: {
            xp: { increment: mission.xpReward },
            coins: { increment: mission.coinReward },
            ...(newLevel > user.level ? { level: newLevel } : {}),
          },
        });
      }
    }
  }

  private getLevelFromXp(totalXp: number): number {
    let level = 1;
    while (true) {
      const xpNeeded = Math.floor(200 * Math.pow(1.04, level - 1));
      if (totalXp < xpNeeded) return level;
      totalXp -= xpNeeded;
      level++;
    }
  }
}
