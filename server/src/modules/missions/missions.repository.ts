import { prisma } from "../../lib/prisma.js";

export const missionsRepository = {
  findUserMissions: (userId: number) =>
    prisma.userMission.findMany({ where: { userId } }),

  findUserMissionsByMetric: (userId: number, metric: string) =>
    prisma.userMission.findMany({
      where: { userId, mission: { metric } },
      include: { mission: true },
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

  findCompletedUserMissions: (userId: number) =>
    prisma.userMission.findMany({
      where: { userId, completed: true, claimed: false },
      include: {
        mission: { select: { id: true, xpReward: true, coinReward: true, tipo: true } },
      },
    }),

  findUserForReward: (userId: number) =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, level: true, coins: true },
    }),
};
