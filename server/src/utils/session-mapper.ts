import { shopRepository } from "../modules/shop/shop.repository.js";

/** Enriquece jogadores com avatar do User vinculado (sem expor relação aninhada). */
export async function mapSessionPlayers<T extends {
  user?: {
    id: number;
    avatarUrl: string | null;
    avatarUpdatedAt: Date | null;
    banner?: string | null;
    user_items?: any;
  } | null;
}>(players: T[]): Promise<any[]> {
  // Batch resolve items for all users
  const userItemsPromises = players
    .filter((p) => p.user?.id)
    .map(async (p) => {
      const items = await shopRepository.resolveUserItems(p.user!.id);
      return { userId: p.user!.id, items };
    });
  const resolved = await Promise.all(userItemsPromises);
  const itemsByUserId = new Map(resolved.map((r) => [r.userId, r.items]));

  return players.map((player) => {
    const { user, ...rest } = player as any;
    const items = user ? itemsByUserId.get(user.id) ?? [] : [];
    const badgeItem = items.find((i: any) => i.equipped && i.type === "badge");
    const badgeValue = badgeItem?.value;
    const badgeImageUrl = badgeItem?.imageUrl ?? null;
    let parsedBadge = null;
    if (badgeValue) {
      try {
        parsedBadge = JSON.parse(badgeValue);
      } catch {
        // Invalid JSON in badge value, skip parsing
      }
    }
    return {
      ...rest,
      avatarUrl: user?.avatarUrl ?? null,
      avatarUpdatedAt: user?.avatarUpdatedAt?.toISOString?.() ?? null,
      banner: user?.banner ?? null,
      badge: parsedBadge?.badge || null,
      badgeImageUrl,
    };
  });
}

export async function mapSessionWithAvatars<T extends { jogadores: any[] }>(session: T) {
  return {
    ...session,
    jogadores: await mapSessionPlayers(session.jogadores),
  };
}
