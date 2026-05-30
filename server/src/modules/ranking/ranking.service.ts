import { prisma } from "../../lib/prisma.js";

export class RankingService {
  async getGlobalRanking(limit = 100) {
    const users = await prisma.user.findMany({
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
      },
    });

    return users.map((user, index) => ({
      position: index + 1,
      ...user,
    }));
  }
}
