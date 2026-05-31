"use client";

import { create } from "zustand";
import { adminApi, type AdminShopItem, type AdminUser, type AdminSession, type AdminMission, type ItemInput, type MissionInput } from "@/services/api/admin";

interface AdminStore {
  items: AdminShopItem[];
  users: AdminUser[];
  sessions: AdminSession[];
  missions: AdminMission[];
  loadingItems: boolean;
  loadingUsers: boolean;
  loadingSessions: boolean;
  loadingMissions: boolean;

  loadItems: () => Promise<void>;
  loadUsers: () => Promise<void>;
  loadSessions: () => Promise<void>;
  loadMissions: () => Promise<void>;
  createItem: (data: ItemInput) => Promise<AdminShopItem>;
  updateItem: (id: number, data: Partial<ItemInput>) => Promise<AdminShopItem>;
  toggleItem: (id: number) => Promise<void>;
  deleteItem: (id: number) => Promise<void>;
  adjustCoins: (userId: number, delta: number) => Promise<void>;
  createMission: (data: MissionInput) => Promise<AdminMission>;
  updateMission: (id: number, data: Partial<MissionInput>) => Promise<AdminMission>;
  deleteMission: (id: number) => Promise<void>;
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  items: [],
  users: [],
  sessions: [],
  missions: [],
  loadingItems: false,
  loadingUsers: false,
  loadingSessions: false,
  loadingMissions: false,

  loadItems: async () => {
    set({ loadingItems: true });
    try {
      const items = await adminApi.listItems();
      set({ items });
    } finally {
      set({ loadingItems: false });
    }
  },

  loadUsers: async () => {
    set({ loadingUsers: true });
    try {
      const users = await adminApi.listUsers();
      set({ users });
    } finally {
      set({ loadingUsers: false });
    }
  },

  createItem: async (data) => {
    const item = await adminApi.createItem(data);
    set({ items: [...get().items, item] });
    return item;
  },

  updateItem: async (id, data) => {
    const updated = await adminApi.updateItem(id, data);
    set({ items: get().items.map((i) => (i.id === id ? updated : i)) });
    return updated;
  },

  toggleItem: async (id) => {
    // Otimista: inverte localmente antes da resposta do servidor
    set({ items: get().items.map((i) => (i.id === id ? { ...i, available: !i.available } : i)) });
    try {
      const updated = await adminApi.toggleItem(id);
      set({ items: get().items.map((i) => (i.id === id ? updated : i)) });
    } catch {
      // Reverte em caso de erro
      set({ items: get().items.map((i) => (i.id === id ? { ...i, available: !i.available } : i)) });
      throw new Error("Falha ao alternar disponibilidade.");
    }
  },

  deleteItem: async (id) => {
    await adminApi.deleteItem(id);
    set({ items: get().items.filter((i) => i.id !== id) });
  },

  adjustCoins: async (userId, delta) => {
    const result = await adminApi.adjustCoins(userId, delta);
    set({ users: get().users.map((u) => (u.id === userId ? { ...u, coins: result.coins } : u)) });
  },

  loadSessions: async () => {
    set({ loadingSessions: true });
    try {
      set({ sessions: await adminApi.listSessions() });
    } finally {
      set({ loadingSessions: false });
    }
  },

  loadMissions: async () => {
    set({ loadingMissions: true });
    try {
      set({ missions: await adminApi.listMissions() });
    } finally {
      set({ loadingMissions: false });
    }
  },

  createMission: async (data) => {
    const mission = await adminApi.createMission(data);
    set({ missions: [...get().missions, mission] });
    return mission;
  },

  updateMission: async (id, data) => {
    const updated = await adminApi.updateMission(id, data);
    set({ missions: get().missions.map((m) => (m.id === id ? updated : m)) });
    return updated;
  },

  deleteMission: async (id) => {
    await adminApi.deleteMission(id);
    set({ missions: get().missions.filter((m) => m.id !== id) });
  },
}));
