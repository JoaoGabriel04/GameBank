export type AuthUserPayload = {
  id: number;
  email: string;
  nome: string;
  avatarUrl: string | null;
  avatarUpdatedAt: string | null;
  banner: string | null;
  profileComplete: boolean;
  isAdmin: boolean;
  coins: number;
  diamonds: number;
};

export function toAuthUserPayload(user: {
  id: number;
  email: string;
  nome: string;
  avatarUrl: string | null;
  avatarUpdatedAt: Date | null;
  banner?: string | null;
  profileComplete: boolean;
  isAdmin?: boolean;
  coins?: number;
  diamonds?: number;
}): AuthUserPayload {
  return {
    id: user.id,
    email: user.email,
    nome: user.nome,
    avatarUrl: user.avatarUrl,
    avatarUpdatedAt: user.avatarUpdatedAt?.toISOString() ?? null,
    banner: user.banner ?? null,
    profileComplete: user.profileComplete,
    isAdmin: user.isAdmin ?? false,
    coins: user.coins ?? 0,
    diamonds: user.diamonds ?? 0,
  };
}
