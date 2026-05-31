import api from "./index";

export interface AdminShopItem {
  id: number;
  name: string;
  description: string;
  price: number;
  type: "title" | "badge" | "color";
  value: string | null;
  icon: string | null;
  available: boolean;
  ownerCount: number;
}

export interface AdminUser {
  id: number;
  nome: string;
  email: string;
  level: number;
  xp: number;
  coins: number;
  isAdmin: boolean;
  avatarUrl: string | null;
  avatarUpdatedAt: string | null;
  totalGames: number;
  totalWins: number;
  createdAt: string;
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

export interface AdminMission {
  id: number;
  name: string;
  description: string;
  metric: string;
  target: number;
  xpReward: number;
  coinReward: number;
  perGame: boolean;
  active: boolean;
}

export interface AdminDashboard {
  totalUsers: number;
  totalSessions: number;
  totalFinished: number;
  totalItems: number;
  recentUsers: { id: number; nome: string; email: string; avatarUrl: string | null; avatarUpdatedAt: string | null; createdAt: string }[];
  recentSessions: { id: number; nome: string | null; status: string; maxJogadores: number; dataInicio: string; jogadores: { id: number }[] }[];
  recentGames: { id: number; sessionId: number; userId: number; position: number; patrimony: number; xpEarned: number; coinsEarned: number; createdAt: string; user: { nome: string } }[];
}

export type ItemInput = Omit<AdminShopItem, "id" | "ownerCount">;
export type MissionInput = Omit<AdminMission, "id">;

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

  // Missions
  listMissions: () => api.get<AdminMission[]>("/admin/missions").then((r) => r.data),
  createMission: (data: MissionInput) => api.post<AdminMission>("/admin/missions", data).then((r) => r.data),
  updateMission: (id: number, data: Partial<MissionInput>) =>
    api.patch<AdminMission>(`/admin/missions/${id}`, data).then((r) => r.data),
  deleteMission: (id: number) => api.delete(`/admin/missions/${id}`),

  // Users
  listUsers: () => api.get<AdminUser[]>("/admin/users").then((r) => r.data),
  adjustCoins: (userId: number, delta: number) =>
    api.patch<{ id: number; nome: string; coins: number }>(`/admin/users/${userId}/coins`, { delta }).then((r) => r.data),
};
