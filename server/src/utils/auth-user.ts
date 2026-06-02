export type AuthUserPayload = {
  id: number;
  email: string;
  nome: string;
  avatarUrl: string | null;
  avatarUpdatedAt: string | null;
  banner: string | null;
  spriteId: string | null;
  profileComplete: boolean;
  isAdmin: boolean;
};

export function toAuthUserPayload(user: {
  id: number;
  email: string;
  nome: string;
  avatarUrl: string | null;
  avatarUpdatedAt: Date | null;
  banner?: string | null;
  spriteId?: string | null;
  profileComplete: boolean;
  isAdmin?: boolean;
}): AuthUserPayload {
  return {
    id: user.id,
    email: user.email,
    nome: user.nome,
    avatarUrl: user.avatarUrl,
    avatarUpdatedAt: user.avatarUpdatedAt?.toISOString() ?? null,
    banner: user.banner ?? null,
    spriteId: user.spriteId ?? null,
    profileComplete: user.profileComplete,
    isAdmin: user.isAdmin ?? false,
  };
}
