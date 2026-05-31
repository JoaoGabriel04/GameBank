import { prisma } from "../../lib/prisma.js";

export const adminRepository = {
  // ShopItems
  findAllItems: () =>
    prisma.shopItem.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { userItems: true } } },
    }),

  findItemById: (id: number) =>
    prisma.shopItem.findUnique({ where: { id } }),

  createItem: (data: {
    name: string;
    description: string;
    price: number;
    type: string;
    value?: string | null;
    icon?: string | null;
    available: boolean;
  }) => prisma.shopItem.create({ data }),

  updateItem: (id: number, data: Partial<{
    name: string;
    description: string;
    price: number;
    type: string;
    value: string | null;
    icon: string | null;
    available: boolean;
  }>) => prisma.shopItem.update({ where: { id }, data }),

  deleteItem: (id: number) =>
    prisma.shopItem.delete({ where: { id } }),

  // Sessions
  findAllSessions: () =>
    prisma.session.findMany({
      where: { status: { in: ["Esperando", "Em Andamento"] } },
      select: {
        id: true,
        nome: true,
        modo: true,
        status: true,
        maxJogadores: true,
        saldoInicial: true,
        dataInicio: true,
        ownerId: true,
        senha: true,
        _count: { select: { jogadores: true } },
      },
      orderBy: { id: "desc" },
    }),

  // Missions
  findAllMissions: () =>
    prisma.mission.findMany({ orderBy: { id: "asc" } }),

  findMissionById: (id: number) =>
    prisma.mission.findUnique({ where: { id } }),

  createMission: (data: {
    name: string;
    description: string;
    metric: string;
    target: number;
    xpReward: number;
    coinReward: number;
    perGame: boolean;
    active: boolean;
  }) => prisma.mission.create({ data }),

  updateMission: (id: number, data: Partial<{
    name: string;
    description: string;
    metric: string;
    target: number;
    xpReward: number;
    coinReward: number;
    perGame: boolean;
    active: boolean;
  }>) => prisma.mission.update({ where: { id }, data }),

  deleteMission: (id: number) =>
    prisma.mission.delete({ where: { id } }),

  // Users
  findAllUsers: () =>
    prisma.user.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        nome: true,
        email: true,
        level: true,
        xp: true,
        coins: true,
        isAdmin: true,
        avatarUrl: true,
        avatarUpdatedAt: true,
        totalGames: true,
        totalWins: true,
        createdAt: true,
      },
    }),

  updateUserCoins: (id: number, delta: number) =>
    prisma.user.update({
      where: { id },
      data: { coins: { increment: delta } },
      select: { id: true, nome: true, coins: true },
    }),
};
