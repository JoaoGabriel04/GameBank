import { prisma } from "../../lib/prisma.js";

export const shopRepository = {
  findAvailableItems: () =>
    prisma.shopItem.findMany({ where: { available: true } }),

  findShopItem: (itemId: number) =>
    prisma.shopItem.findUnique({ where: { id: itemId } }),

  findUser: (userId: number) =>
    prisma.user.findUnique({ where: { id: userId } }),

  findUserItem: (userId: number, itemId: number) =>
    prisma.userItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
    }),

  findUserItemWithType: (userId: number, itemId: number) =>
    prisma.userItem.findUnique({
      where: { userId_itemId: { userId, itemId } },
      include: { item: true },
    }),

  purchaseItem: (userId: number, itemId: number, price: number) =>
    prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { coins: { decrement: price } },
      });
      await tx.userItem.create({ data: { userId, itemId } });
    }),

  toggleEquip: (userId: number, itemId: number, itemType: string, currentEquipped: boolean) =>
    prisma.$transaction(async (tx) => {
      await tx.userItem.updateMany({
        where: { userId, item: { type: itemType }, equipped: true },
        data: { equipped: false },
      });
      await tx.userItem.update({
        where: { userId_itemId: { userId, itemId } },
        data: { equipped: !currentEquipped },
      });
    }),
};
