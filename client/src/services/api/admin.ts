import api from "./index";

export type ShopItemType = "title" | "badge" | "banner" | "frame";

export interface AdminShopItem {
  id: number;
  name: string;
  description: string;
  price: number;
  type: ShopItemType;
  value: string | null;
  icon: string | null;
  raridade: string | null;
  imageUrl: string | null;
  available: boolean;
  animated: boolean;
  fragmentavel?: boolean;
  fragmentosTotal?: number | null;
  fragmentosIcone?: string | null;
  ownerCount: number;
  bannerId?: number | null;
  frameId?: number | null;
  badgeId?: number | null;
  badge?: { imageUrl: string | null } | null;
}

export interface AdminUser {
  id: number;
  nome: string;
  email: string;
  level: number;
  xp: number;
  coins: number;
  diamonds: number;
  isAdmin: boolean;
  avatarUrl: string | null;
  avatarUpdatedAt: string | null;
  totalGames: number;
  totalWins: number;
  createdAt: string;
  banned?: boolean;
  bannedAt?: string | null;
  banReason?: string | null;
}

export interface AdminSession {
  id: number;
  nome: string | null;
  modo: string;
  status: string;
  maxJogadores: number;
  saldoInicial: number;
  dataInicio: string;
  ownerId: number | null;
  protegida: boolean;
  jogadoresCount: number;
}

export interface AdminSessionDetail extends AdminSession {
  jogadores: SessionPlayer[];
}

export interface SessionPlayer {
  id: number;
  nome: string;
  cor: string;
  saldo: number;
  cartaPrisao: boolean;
  desistiu: boolean;
  userId: number | null;
  user: { nome: string; avatarUrl: string | null; avatarUpdatedAt: string | null } | null;
}

export interface AdminDashboard {
  totalUsers: number;
  totalSessions: number;
  totalFinished: number;
  totalItems: number;
  recentUsers: { id: number; nome: string; email: string; avatarUrl: string | null; avatarUpdatedAt: string | null; createdAt: string }[];
  recentSessions: { id: number; nome: string | null; status: string; modo: string; maxJogadores: number; dataInicio: string; jogadores: { id: number }[]; saldoTotal: number; duracao: number }[];
  recentGames: { id: number; sessionId: number; userId: number; position: number; patrimony: number; xpEarned: number; coinsEarned: number; createdAt: string; user: { nome: string } }[];
  deltaUsers: number | null;
  deltaSessions: number | null;
  activeUsersToday: number;
  weeklyRetention: number | null;
  userGrowth30d: number[];
  sessions30d: number[];
}

export type ItemInput = Omit<AdminShopItem, "id" | "ownerCount">;

export interface Card {
  id: number;
  tipo: string;
  texto: string;
  efeito: string;
  valor: number;
  ativo: boolean;
}

export interface Banner {
  id: number;
  nome: string;
  css: string;
  animated: boolean;
  imagePublicId?: string | null;
  imageUpdatedAt?: string | null;
  disponibilidade: boolean;
}

export interface Badge {
  id: number;
  nome: string;
  imageUrl: string | null;
  imagePublicId: string | null;
  disponibilidade: boolean;
}

export interface Frame {
  id: number;
  nome: string;
  tipo: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  css?: string | null;
  animated: boolean;
  disponibilidade: boolean;
  frameScale?: number;
}

export type CardInput = Omit<Card, "id">;
export type BannerInput = Omit<Banner, "id" | "imagePublicId" | "imageUpdatedAt">;
export type FrameInput = Omit<Frame, "id" | "imageUrl" | "imagePublicId">;

export interface AuditEntry {
  id: number;
  ts: string;
  actorId: number | null;
  actorNome: string | null;
  actorEmail: string | null;
  action: string;
  target: string | null;
  metadata: Record<string, unknown> | null;
  severity: "info" | "success" | "warn" | "danger";
}

export interface AdminChatMessage {
  id: number;
  sessionId: number;
  playerId: number;
  texto: string;
  createdAt: string;
  player: { nome: string; cor: string };
}

export interface AuditListOpts {
  userId?: number;
  action?: string;
  severity?: "info" | "success" | "warn" | "danger";
  limit?: number;
  offset?: number;
}

export const adminApi = {
  // ShopItems
  listItems: () => api.get<AdminShopItem[]>("/admin/shop/items").then((r) => r.data),
  createItem: (data: ItemInput) => api.post<AdminShopItem>("/admin/shop/items", data).then((r) => r.data),
  updateItem: (id: number, data: Partial<ItemInput>) =>
    api.patch<AdminShopItem>(`/admin/shop/items/${id}`, data).then((r) => r.data),
  toggleItem: (id: number) =>
    api.patch<AdminShopItem>(`/admin/shop/items/${id}/toggle`).then((r) => r.data),
  deleteItem: (id: number) => api.delete(`/admin/shop/items/${id}`),

  // Dashboard
  getDashboard: () => api.get<AdminDashboard>("/admin/dashboard").then((r) => r.data),

  // Sessions
  listSessions: () => api.get<AdminSession[]>("/admin/sessions").then((r) => r.data),
  getSessionDetail: (id: number) => api.get<AdminSessionDetail>(`/admin/sessions/${id}`).then((r) => r.data),
  getSessionChat: (id: number) => api.get<AdminChatMessage[]>(`/admin/sessions/${id}/chat`).then((r) => r.data),
  endSession: (id: number) => api.post<AdminSession>(`/admin/sessions/${id}/end`).then((r) => r.data),
  adjustPlayerBalance: (sessionId: number, playerId: number, delta: number) =>
    api.patch<SessionPlayer>(`/admin/sessions/${sessionId}/players/${playerId}/balance`, { delta }).then((r) => r.data),

  // Users
  listUsers: () => api.get<AdminUser[]>("/admin/users").then((r) => r.data),
  adjustCoins: (userId: number, delta: number) =>
    api.patch<{ id: number; nome: string; coins: number }>(`/admin/users/${userId}/coins`, { delta }).then((r) => r.data),
  adjustDiamonds: (userId: number, delta: number) =>
    api.patch<{ id: number; nome: string; diamonds: number }>(`/admin/users/${userId}/diamonds`, { delta }).then((r) => r.data),
  adjustXp: (userId: number, delta: number) =>
    api.patch<{ id: number; nome: string; xp: number; level: number }>(`/admin/users/${userId}/xp`, { delta }).then((r) => r.data),
  setLevel: (userId: number, level: number) =>
    api.patch<{ id: number; nome: string; xp: number; level: number }>(`/admin/users/${userId}/level`, { level }).then((r) => r.data),
  banUser: (userId: number, reason?: string) =>
    api.post<{ id: number; nome: string; email: string; banned: boolean; bannedAt: string | null; banReason: string | null }>(`/admin/users/${userId}/ban`, { reason }).then((r) => r.data),
  unbanUser: (userId: number) =>
    api.post<{ id: number; nome: string; email: string; banned: boolean; bannedAt: string | null; banReason: string | null }>(`/admin/users/${userId}/unban`).then((r) => r.data),
  setUserAdmin: (userId: number, isAdmin: boolean) =>
    api.patch<{ id: number; nome: string; email: string; isAdmin: boolean }>(`/admin/users/${userId}/admin`, { isAdmin }).then((r) => r.data),
  deleteUser: (userId: number) => api.delete(`/admin/users/${userId}`),

  // Cards
  listCards: () => api.get<Card[]>("/admin/cards").then((r) => r.data),
  createCard: (data: CardInput) => api.post<Card>("/admin/cards", data).then((r) => r.data),
  updateCard: (id: number, data: Partial<CardInput>) =>
    api.patch<Card>(`/admin/cards/${id}`, data).then((r) => r.data),
  deleteCard: (id: number) => api.delete(`/admin/cards/${id}`),

  // GameSettings
  getSettings: () => api.get<Record<string, unknown>>("/admin/settings").then((r) => r.data),
  updateSettings: (data: Record<string, unknown>) =>
    api.patch<Record<string, unknown>>("/admin/settings", data).then((r) => r.data),

  // Banners
  listBanners: () => api.get<Banner[]>("/admin/banners").then((r) => r.data),
  createBanner: (data: BannerInput) => api.post<Banner>("/admin/banners", data).then((r) => r.data),
  updateBanner: (id: number, data: Partial<BannerInput>) =>
    api.patch<Banner>(`/admin/banners/${id}`, data).then((r) => r.data),
  deleteBanner: (id: number) => api.delete(`/admin/banners/${id}`),
  uploadBannerImage: (id: number, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return api.post<Banner>(`/admin/banners/${id}/image`, form).then((r) => r.data);
  },

  // Frames
  listFrames: () => api.get<Frame[]>("/admin/frames").then((r) => r.data),
  createFrame: (data: FrameInput) => api.post<Frame>("/admin/frames", data).then((r) => r.data),
  updateFrame: (id: number, data: Partial<FrameInput>) =>
    api.patch<Frame>(`/admin/frames/${id}`, data).then((r) => r.data),
  deleteFrame: (id: number) => api.delete(`/admin/frames/${id}`),
  uploadFrameImage: (id: number, file: File) => {
    const form = new FormData();
    form.append("image", file);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    return api.post<Frame>(`/admin/frames/${id}/image`, form, {
      signal: controller.signal,
    }).then((r) => { clearTimeout(timeout); return r.data; }).catch((e) => {
      clearTimeout(timeout);
      if (e.name === "AbortError") throw new Error("Upload excedeu o tempo limite (60s)");
      throw e;
    });
  },

  // Badges
  listBadges: () => api.get<Badge[]>("/admin/badges").then((r) => r.data),
  createBadge: (data: { nome: string; disponibilidade?: boolean }) =>
    api.post<Badge>("/admin/badges", data).then((r) => r.data),
  updateBadge: (id: number, data: Partial<{ nome: string; disponibilidade: boolean }>) =>
    api.patch<Badge>(`/admin/badges/${id}`, data).then((r) => r.data),
  deleteBadge: (id: number) => api.delete(`/admin/badges/${id}`),
  uploadBadgeImage: (id: number, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return api.post<{ imageUrl: string; imagePublicId: string }>(`/admin/badges/${id}/image`, form).then((r) => r.data);
  },

  // Audit
  listAudit: (opts: AuditListOpts = {}) => {
    const params = new URLSearchParams();
    if (opts.userId !== undefined) params.set("userId", String(opts.userId));
    if (opts.action) params.set("action", opts.action);
    if (opts.severity) params.set("severity", opts.severity);
    if (opts.limit !== undefined) params.set("limit", String(opts.limit));
    if (opts.offset !== undefined) params.set("offset", String(opts.offset));
    const qs = params.toString();
    return api.get<AuditEntry[]>(`/admin/audit${qs ? `?${qs}` : ""}`).then((r) => r.data);
  },

  notifyUsers: (userIds: number[], titulo: string, corpo: string) =>
    api.post<{ sent: number }>("/admin/users/notify", { userIds, titulo, corpo }).then((r) => r.data),
};
