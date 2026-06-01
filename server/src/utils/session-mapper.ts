/** Enriquece jogadores com avatar do User vinculado (sem expor relação aninhada). */
export function mapSessionPlayers<T extends {
  user?: {
    avatarUrl: string | null;
    avatarUpdatedAt: Date | null;
    banner?: string | null;
    items?: Array<{ equipped: boolean; item: { type: string; value: string | null } }>;
  } | null;
}>(players: T[]) {
  return players.map((player) => {
    const { user, ...rest } = player as T & {
      user?: {
        avatarUrl: string | null;
        avatarUpdatedAt: Date | null;
        banner?: string | null;
        items?: Array<{ equipped: boolean; item: { type: string; value: string | null } }>;
      } | null;
    };
    const badgeItem = user?.items?.find((i) => i.equipped && i.item.type === "badge");
    const badgeValue = badgeItem?.item?.value;
    const parsedBadge = badgeValue ? JSON.parse(badgeValue) : null;
    return {
      ...rest,
      avatarUrl: user?.avatarUrl ?? null,
      avatarUpdatedAt: user?.avatarUpdatedAt?.toISOString?.() ?? null,
      banner: user?.banner ?? null,
      badge: parsedBadge?.badge || null,
    };
  });
}

export function mapSessionWithAvatars<T extends { jogadores: Parameters<typeof mapSessionPlayers>[0] }>(session: T) {
  return {
    ...session,
    jogadores: mapSessionPlayers(session.jogadores),
  };
}
