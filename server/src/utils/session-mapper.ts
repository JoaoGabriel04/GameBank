import { prisma } from "../lib/prisma.js";
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
    trophies?: number;
    user_items?: any;
  } | null;
}>(players: T[]): Promise<any[]> {
  // Cosméticos de todos os jogadores numa única busca no catálogo (antes:
  // 1 query de usuário + 4 de catálogo POR jogador, a cada broadcast). Usa
  // o user_items que a query da sessão já trouxe; só busca à parte (numa
  // query só) para chamadores que não o selecionaram.
  const users = players.map((p) => p.user).filter((u): u is NonNullable<typeof u> => !!u?.id);
  const semItens = users.filter((u) => u.user_items === undefined).map((u) => u.id);
  const itensBuscados = semItens.length > 0
    ? new Map((await prisma.user.findMany({ where: { id: { in: semItens } }, select: { id: true, user_items: true } }))
      .map((u) => [u.id, u.user_items]))
    : new Map<number, unknown>();
  const itemsByUserId = await shopRepository.resolveUserItemsEmLote(
    users.map((u) => ({ id: u.id, user_items: u.user_items !== undefined ? u.user_items : itensBuscados.get(u.id) }))
  );

  return players.map((player) => {
    const { user, ...rest } = player as any;
    const items = user ? itemsByUserId.get(user.id) ?? [] : [];
    const bannerItem = items.find((i: any) => i.equipped && i.type === "banner");
    const bannerAnimated = bannerItem?.animated ?? false;
    const bannerRaridade = bannerItem?.raridade ?? null;
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
    const titleRaridade = titleItem?.raridade ?? null;
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
      bannerRaridade,
      frame: frameItem?.value ?? null,
      frameType: frameItem?.frameTipo ?? null,
      frameAnimated: frameItem?.frameAnimated ?? frameItem?.animated ?? false,
      frameScale: frameItem?.frameScale ?? 145,
      badge: parsedBadge?.badge || null,
      badgeImageUrl,
      title,
      titleAnimated,
      titleRaridade,
      level: user?.level ?? null,
      trophies: user?.trophies ?? 0,
    };
  });
}

export async function mapSessionWithAvatars<T extends { jogadores: any[] }>(session: T) {
  return {
    ...session,
    jogadores: await mapSessionPlayers(session.jogadores),
  };
}
