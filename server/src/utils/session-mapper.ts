/** Enriquece jogadores com avatar do User vinculado (sem expor relação aninhada). */
export function mapSessionPlayers<T extends {
  user?: { avatarUrl: string | null; avatarUpdatedAt: Date | null; banner?: string | null } | null;
}>(players: T[]) {
  return players.map((player) => {
    const { user, ...rest } = player as T & { user?: { avatarUrl: string | null; avatarUpdatedAt: Date | null; banner?: string | null } | null };
    return {
      ...rest,
      avatarUrl: user?.avatarUrl ?? null,
      avatarUpdatedAt: user?.avatarUpdatedAt?.toISOString?.() ?? null,
      banner: user?.banner ?? null,
    };
  });
}

export function mapSessionWithAvatars<T extends { jogadores: Parameters<typeof mapSessionPlayers>[0] }>(session: T) {
  return {
    ...session,
    jogadores: mapSessionPlayers(session.jogadores),
  };
}
