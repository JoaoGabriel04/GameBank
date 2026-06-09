import { prisma } from "../../lib/prisma.js";

export interface UserItemRef {
  item_id: number;
  equipped: boolean;
  acquiredAt: string;
}

export function parseUserItems(raw: unknown): UserItemRef[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw as UserItemRef[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as UserItemRef[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export const shopRepository = {
  findAvailableItems: () =>
    prisma.shopItem.findMany({
      where: { available: true },
      include: { banner: true, frame: true },
    }),

  findShopItem: (itemId: number) =>
    prisma.shopItem.findUnique({
      where: { id: itemId },
      include: { banner: true, frame: true },
    }),

  findUser: (userId: number) =>
    prisma.user.findUnique({ where: { id: userId } }),

  /**
   * Joins user_items refs with ShopItem data.
   */
  resolveUserItems: async (userId: number) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return [];

    const refs = parseUserItems(user.user_items);
    if (refs.length === 0) return [];

    const shopItems = await prisma.shopItem.findMany({
      where: { id: { in: refs.map((r) => r.item_id) } },
      include: { banner: true, frame: true },
    });
    const itemMap = new Map(shopItems.map((si) => [si.id, si]));

    return refs
      .map((ref) => {
        const shopItem = itemMap.get(ref.item_id);
        if (!shopItem) return null;
        const frame = shopItem.frame;
        return {
          id: shopItem.id,
          name: shopItem.name,
          description: shopItem.description,
          icon: shopItem.icon,
          value: frame?.tipo === "image" ? (frame.imageUrl ?? shopItem.value) : (frame?.css ?? shopItem.value),
          type: shopItem.type,
          imageUrl: shopItem.imageUrl ?? null,
          rarity: shopItem.rarity ?? null,
          animated: shopItem.animated,
          equipped: ref.equipped,
          frameId: shopItem.frameId ?? null,
          frameTipo: shopItem.type === "frame" ? (frame?.tipo ?? null) : null,
          frameAnimated: shopItem.type === "frame" ? (frame?.animated ?? false) : null,
          frameScale: shopItem.type === "frame" ? (frame?.scale ?? 145) : null,
        };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);
  },

  saveUserItems: (userId: number, refs: UserItemRef[]) =>
    prisma.user.update({
      where: { id: userId },
      data: { user_items: refs as any },
    }),

  setUserBanner: (userId: number, banner: string | null) =>
    prisma.user.update({ where: { id: userId }, data: { banner } }),

  syncUserBanner: async (userId: number) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const refs = parseUserItems(user.user_items);
    const equippedBanner = refs.find((r) => r.equipped);

    if (!equippedBanner) {
      return prisma.user.update({
        where: { id: userId },
        data: { banner: null },
      });
    }

    const shopItem = await prisma.shopItem.findUnique({
      where: { id: equippedBanner.item_id },
      include: { banner: true },
    });

    const banner = equippedBanner.item_id === 0 ? null : (shopItem?.value ?? null);

    return prisma.user.update({
      where: { id: userId },
      data: { banner },
    });
  },
};
