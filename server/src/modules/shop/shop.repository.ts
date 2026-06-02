import { prisma } from "../../lib/prisma.js";

export interface UserItemSnapshot {
  id: number;
  name: string;
  description: string;
  type: 'title' | 'badge' | 'banner';
  value: string | null;
  icon: string | null;
  spriteId?: string | null;
  equipped: boolean;
  acquiredAt: string;
}

export const shopRepository = {
  findAvailableItems: () =>
    prisma.shopItem.findMany({ where: { available: true } }),

  findShopItem: (itemId: number) =>
    prisma.shopItem.findUnique({ where: { id: itemId }, include: { banner: true } }),

  findUser: (userId: number) =>
    prisma.user.findUnique({ where: { id: userId } }),

  findUserItems: (userId: number): Promise<UserItemSnapshot[] | null> =>
    prisma.user.findUnique({ where: { id: userId } }).then(u =>
      u ? ((u.items ?? []) as unknown as UserItemSnapshot[]) : null
    ),

  saveUserItems: (userId: number, items: UserItemSnapshot[]) =>
    prisma.user.update({
      where: { id: userId },
      data: { items: JSON.stringify(items) }
    }),

  setUserBannerAndSprite: (userId: number, banner: string | null, spriteId: string | null) =>
    prisma.user.update({ where: { id: userId }, data: { banner, spriteId } }),

  // Legacy functions removed:
  // - findUserItem (no longer needed, work with items array)
  // - findUserItemWithType (no longer needed, work with items array)
  // - purchaseItem (now handled in service with saveUserItems)
  // - toggleEquip (now handled in service with saveUserItems)
  // - setUserBanner (combined into setUserBannerAndSprite)
  // - setUserSprite (combined into setUserBannerAndSprite)
};
