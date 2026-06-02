/** Enriquece jogadores com avatar do User vinculado (sem expor relação aninhada). */
export function mapSessionPlayers<T extends {
  user?: {
    avatarUrl: string | null;
    avatarUpdatedAt: Date | null;
    banner?: string | null;
    items?: any;
  } | null;
}>(players: T[]) {
  return players.map((player) => {
    const { user, ...rest } = player as T & {
      user?: {
        avatarUrl: string | null;
        avatarUpdatedAt: Date | null;
        banner?: string | null;
        items?: any;
      } | null;
    };
    const items = (user?.items ?? []) as Array<{ equipped: boolean; type: string; value: string | null }>;
    const badgeItem = items.find((i) => i.equipped && i.type === "badge");
    const badgeValue = badgeItem?.value;
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
    };
  });
}

export function mapSessionWithAvatars<T extends { jogadores: Parameters<typeof mapSessionPlayers>[0] }>(session: T) {
  return {
    ...session,
    jogadores: mapSessionPlayers(session.jogadores),
  };
}
