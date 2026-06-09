import { shopRepository } from "../modules/shop/shop.repository.js";

/** Enriquece jogadores com avatar do User vinculado (sem expor relação aninhada). */
export async function mapSessionPlayers<T extends {
  user?: {
    id: number;
    avatarUrl: string | null;
    avatarUpdatedAt: Date | null;
    banner?: string | null;
    frame?: string | null;
    frameType?: string | null;
    frameAnimated?: boolean;
    frameScale?: number;
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
    const bannerItem = items.find((i: any) => i.equipped && i.type === "banner");
    const bannerAnimated = bannerItem?.animated ?? false;
    const badgeItem = items.find((i: any) => i.equipped && i.type === "badge");
    const badgeValue = badgeItem?.value;
    const badgeImageUrl = badgeItem?.imageUrl ?? null;
    let parsedBadge = null;
    if (badgeValue) {
      try {
        parsedBadge = JSON.parse(badgeValue);
      } catch {
        parsedBadge = { badge: badgeValue };
      }
    }
    const titleItem = items.find((i: any) => i.equipped && i.type === "title");
    const titleAnimated = titleItem?.animated ?? false;
    let title: string | null = null;
    if (titleItem?.value) {
      try {
        title = JSON.parse(titleItem.value)?.title ?? null;
      } catch {
        title = titleItem.value;
      }
    }
    const frameItem = items.find((i: any) => i.equipped && i.type === "frame");
    return {
      ...rest,
      avatarUrl: user?.avatarUrl ?? null,
      avatarUpdatedAt: user?.avatarUpdatedAt?.toISOString?.() ?? null,
      banner: user?.banner ?? null,
      bannerAnimated,
      frame: frameItem?.value ?? null,
      frameType: frameItem?.frameTipo ?? null,
      frameAnimated: frameItem?.frameAnimated ?? frameItem?.animated ?? false,
      frameScale: frameItem?.frameScale ?? 145,
      badge: parsedBadge?.badge || null,
      badgeImageUrl,
      title,
      titleAnimated,
      level: user?.level ?? null,
    };
  });
}

export async function mapSessionWithAvatars<T extends { jogadores: any[] }>(session: T) {
  return {
    ...session,
    jogadores: await mapSessionPlayers(session.jogadores),
  };
}
