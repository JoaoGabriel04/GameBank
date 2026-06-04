import { prisma } from "../../lib/prisma.js";

export interface UserItemSnapshot {
  id: number;
  name: string;
  description: string;
  type: 'title' | 'badge' | 'banner';
  value: string | null;
  icon: string | null;
  spriteId?: string | null;
  rarity?: string | null;
  imageUrl?: string | null;
  equipped: boolean;
  acquiredAt: string;
}

/**
 * Reads `User.items` (Prisma Json column) and normalizes it to UserItemSnapshot[].
 * Defends against legacy double-stringified data and any non-array payload.
 */
export function parseUserItems(raw: unknown): UserItemSnapshot[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as UserItemSnapshot[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as UserItemSnapshot[]) : [];
    } catch {
      return [];
    }
  }
  return [];
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
      u ? parseUserItems(u.items) : null
    ),

  saveUserItems: (userId: number, items: UserItemSnapshot[]) =>
    prisma.user.update({
      where: { id: userId },
      data: { items: items as any }
    }),

  setUserBannerAndSprite: (userId: number, banner: string | null, spriteId: string | null) =>
    prisma.user.update({ where: { id: userId }, data: { banner, spriteId } }),

  syncUserBanner: async (userId: number) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const items = parseUserItems(user.items);
    const equippedBanner = items.find(i => i.equipped && i.type === 'banner');

    const banner = equippedBanner?.id === 0 ? null : (equippedBanner?.value ?? null);
    const spriteId = equippedBanner?.spriteId ?? null;

    return prisma.user.update({
      where: { id: userId },
      data: { banner, spriteId }
    });
  },
  // Legacy functions removed:
  // - findUserItem (no longer needed, work with items array)
  // - findUserItemWithType (no longer needed, work with items array)
  // - purchaseItem (now handled in service with saveUserItems)
  // - toggleEquip (now handled in service with saveUserItems)
  // - setUserBanner (combined into setUserBannerAndSprite)
  // - setUserSprite (combined into setUserBannerAndSprite)
};
