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
      create: { userId, missionId, progress, completed, completedAt, claimed: false },
      update: {
        progress,
        completed,
        completedAt: completedAt ?? previousCompletedAt ?? undefined,
      },
    }),

  findUserMissionForClaim: (userId: number, missionId: number) =>
    prisma.userMission.findUnique({
      where: { userId_missionId: { userId, missionId } },
      include: {
        mission: { select: { xpReward: true, coinReward: true, tipo: true } },
      },
    }),

  claimMission: (
    userId: number,
    missionId: number,
    xpReward: number,
    coinReward: number,
    newLevel?: number
  ) =>
    prisma.$transaction(async (tx) => {
      const updated = await tx.userMission.updateMany({
        where: { userId, missionId, claimed: false },
        data: { claimed: true, claimedAt: new Date() },
      });

      if (updated.count === 0) {
        throw new Error("Mission already claimed");
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          xp: { increment: xpReward },
          coins: { increment: coinReward },
          ...(newLevel !== undefined ? { level: newLevel } : {}),
        },
      });
    }),

  findUserForReward: (userId: number) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, level: true, coins: true },
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
