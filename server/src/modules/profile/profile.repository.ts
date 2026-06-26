import { prisma } from "../../lib/prisma.js";

export const profileRepository = {
  findWithItemsAndMissions: (userId: number) =>
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        missions: { include: { mission: true } },
      },
    }),

  updateLevel: (userId: number, level: number) =>
    prisma.user.update({ where: { id: userId }, data: { level } }),

  findGameResults: (userId: number, limit: number) =>
    prisma.gameResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        bauAdquirido: {
          select: { id: true, bau: { select: { tipo: true } } },
          take: 1,
        },
      },
    }),

  clearHistory: (userId: number) =>
    prisma.gameResult.deleteMany({ where: { userId } }),

  findUser: (userId: number) =>
    prisma.user.findUnique({ where: { id: userId } }),

  update: (userId: number, data: Record<string, unknown>) =>
    prisma.user.update({ where: { id: userId }, data }),
};
