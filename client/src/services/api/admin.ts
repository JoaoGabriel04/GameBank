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

export type ItemInput = Omit<AdminShopItem, "id" | "ownerCount">;

export const adminApi = {
  // ShopItems
  listItems: () => api.get<AdminShopItem[]>("/admin/shop/items").then((r) => r.data),
  createItem: (data: ItemInput) => api.post<AdminShopItem>("/admin/shop/items", data).then((r) => r.data),
  updateItem: (id: number, data: Partial<ItemInput>) =>
    api.patch<AdminShopItem>(`/admin/shop/items/${id}`, data).then((r) => r.data),
  toggleItem: (id: number) =>
    api.patch<AdminShopItem>(`/admin/shop/items/${id}/toggle`).then((r) => r.data),
  deleteItem: (id: number) => api.delete(`/admin/shop/items/${id}`),

  // Users
  listUsers: () => api.get<AdminUser[]>("/admin/users").then((r) => r.data),
  adjustCoins: (userId: number, delta: number) =>
    api.patch<{ id: number; nome: string; coins: number }>(`/admin/users/${userId}/coins`, { delta }).then((r) => r.data),
};
