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
