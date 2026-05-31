import { prisma } from "../../lib/prisma.js";

export const missionsRepository = {
  findActiveMissions: () =>
    prisma.mission.findMany({ where: { active: true } }),

  findUserMissions: (userId: number) =>
    prisma.userMission.findMany({ where: { userId } }),

  findActiveMissionsByMetric: (metric: string) =>
    prisma.mission.findMany({ where: { active: true, metric } }),

  findUserMission: (userId: number, missionId: number) =>
    prisma.userMission.findUnique({
      where: { userId_missionId: { userId, missionId } },
    }),

  upsertUserMission: (
    userId: number,
    missionId: number,
    progress: number,
    completed: boolean,
    completedAt: Date | undefined,
    previousCompletedAt: Date | null | undefined
  ) =>
    prisma.userMission.upsert({
      where: { userId_missionId: { userId, missionId } },
      create: { userId, missionId, progress, completed, completedAt },
      update: {
        progress,
        completed,
        completedAt: completedAt ?? previousCompletedAt ?? undefined,
      },
    }),

  findUserForReward: (userId: number) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, level: true },
    }),

  rewardUser: (userId: number, xpReward: number, coinReward: number, newLevel?: number) =>
    prisma.user.update({
      where: { id: userId },
      data: {
        xp: { increment: xpReward },
        coins: { increment: coinReward },
        ...(newLevel !== undefined ? { level: newLevel } : {}),
      },
    }),
};
