import { prisma } from "../../lib/prisma.js";

export const rankingRepository = {
  findTopUsers: (limit: number) =>
    prisma.user.findMany({
      where: { totalGames: { gt: 0 } },
      orderBy: { xp: "desc" },
      take: limit,
      select: {
        id: true,
        nome: true,
        avatarUrl: true,
        avatarUpdatedAt: true,
        level: true,
        xp: true,
        totalGames: true,
        totalWins: true,
        totalTop3: true,
        banner: true,
        frame: true,
        frameType: true,
        frameAnimated: true,
        frameScale: true,
        user_items: true,
      },
    }),
};
