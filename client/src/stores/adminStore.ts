"use client";

import { create } from "zustand";
import {
  adminApi,
  type AdminShopItem,
  type AdminUser,
  type AdminSession,
  type AdminMission,
  type ItemInput,
  type MissionInput,
  type AdminSessionDetail,
  type AdminDashboard,
  type Card,
  type CardInput,
  type Banner,
  type BannerInput,
  type Frame,
  type FrameInput,
  type AuditEntry,
  type AuditListOpts,
} from "@/services/api/admin";

interface AdminStore {
  items: AdminShopItem[];
  users: AdminUser[];
  sessions: AdminSession[];
  sessionDetails: Record<number, AdminSessionDetail>;
  missions: AdminMission[];
  cards: Card[];
  banners: Banner[];
  audit: AuditEntry[];
  settings: Record<string, unknown>;
  dashboard: AdminDashboard | null;

  loadingItems: boolean;
  loadingUsers: boolean;
  loadingSessions: boolean;
  loadingMissions: boolean;
  loadingCards: boolean;
  loadingBanners: boolean;
  frames: Frame[];
  loadingFrames: boolean;
  loadingAudit: boolean;
  loadingSettings: boolean;
  loadingDashboard: boolean;

  loadItems: () => Promise<void>;
  loadUsers: () => Promise<void>;
  loadSessions: () => Promise<void>;
  loadDashboard: () => Promise<void>;
  loadSessionDetail: (id: number) => Promise<AdminSessionDetail>;
  endSession: (id: number) => Promise<void>;
  adjustPlayerBalance: (sessionId: number, playerId: number, delta: number) => Promise<void>;
  loadMissions: () => Promise<void>;
  loadCards: () => Promise<void>;
  loadBanners: () => Promise<void>;
  loadAudit: (opts?: AuditListOpts) => Promise<void>;
  loadFrames: () => Promise<void>;
  createFrame: (data: FrameInput) => Promise<Frame>;
  updateFrame: (id: number, data: Partial<FrameInput>) => Promise<Frame>;
  deleteFrame: (id: number) => Promise<void>;
  uploadFrameImage: (id: number, file: File) => Promise<Frame>;
  loadSettings: () => Promise<void>;
  saveSettings: (data: Record<string, unknown>) => Promise<void>;

  createItem: (data: ItemInput) => Promise<AdminShopItem>;
  updateItem: (id: number, data: Partial<ItemInput>) => Promise<AdminShopItem>;
  toggleItem: (id: number) => Promise<void>;
  deleteItem: (id: number) => Promise<void>;
  adjustCoins: (userId: number, delta: number) => Promise<void>;
  adjustDiamonds: (userId: number, delta: number) => Promise<void>;
  adjustXp: (userId: number, delta: number) => Promise<void>;
  setLevel: (userId: number, level: number) => Promise<void>;
  banUser: (userId: number, reason?: string) => Promise<void>;
  unbanUser: (userId: number) => Promise<void>;
  setUserAdmin: (userId: number, isAdmin: boolean) => Promise<void>;
  deleteUser: (userId: number) => Promise<void>;
  createMission: (data: MissionInput) => Promise<AdminMission>;
  updateMission: (id: number, data: Partial<MissionInput>) => Promise<AdminMission>;
  toggleMission: (id: number) => Promise<void>;
  deleteMission: (id: number) => Promise<void>;

  createCard: (data: CardInput) => Promise<Card>;
  updateCard: (id: number, data: Partial<CardInput>) => Promise<Card>;
  deleteCard: (id: number) => Promise<void>;

  createBanner: (data: BannerInput) => Promise<Banner>;
  updateBanner: (id: number, data: Partial<BannerInput>) => Promise<Banner>;
  deleteBanner: (id: number) => Promise<void>;
  uploadBannerImage: (id: number, file: File) => Promise<Banner>;
  uploadBadgeImage: (id: number, file: File) => Promise<{ imageUrl: string; imagePublicId: string }>;
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  items: [],
  users: [],
  sessions: [],
  sessionDetails: {},
  missions: [],
  cards: [],
  banners: [],
  audit: [],
  settings: {},
  dashboard: null,
  frames: [],

  loadingItems: false,
  loadingUsers: false,
  loadingSessions: false,
  loadingMissions: false,
  loadingCards: false,
  loadingBanners: false,
  loadingFrames: false,
  loadingAudit: false,
  loadingSettings: false,
  loadingDashboard: false,

  loadItems: async () => {
    set({ loadingItems: true });
    try {
      set({ items: await adminApi.listItems() });
    } finally {
      set({ loadingItems: false });
    }
  },

  loadUsers: async () => {
    set({ loadingUsers: true });
    try {
      set({ users: await adminApi.listUsers() });
    } finally {
      set({ loadingUsers: false });
    }
  },

  loadSessions: async () => {
    set({ loadingSessions: true });
    try {
      set({ sessions: await adminApi.listSessions() });
    } finally {
      set({ loadingSessions: false });
    }
  },

  loadDashboard: async () => {
    set({ loadingDashboard: true });
    try {
      set({ dashboard: await adminApi.getDashboard() });
    } finally {
      set({ loadingDashboard: false });
    }
  },

  loadSessionDetail: async (id) => {
    const detail = await adminApi.getSessionDetail(id);
    set({ sessionDetails: { ...get().sessionDetails, [id]: detail } });
    return detail;
  },

  endSession: async (id) => {
    await adminApi.endSession(id);
    set({ sessions: get().sessions.filter((s) => s.id !== id) });
    set({ sessionDetails: Object.fromEntries(Object.entries(get().sessionDetails).filter(([k]) => Number(k) !== id)) });
  },

  adjustPlayerBalance: async (sessionId, playerId, delta) => {
    const updated = await adminApi.adjustPlayerBalance(sessionId, playerId, delta);
    const detail = get().sessionDetails[sessionId];
    if (detail) {
      set({
        sessionDetails: {
          ...get().sessionDetails,
          [sessionId]: {
            ...detail,
            jogadores: detail.jogadores.map((p) => (p.id === playerId ? updated : p)),
          },
        },
      });
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

  loadCards: async () => {
    set({ loadingCards: true });
    try {
      set({ cards: await adminApi.listCards() });
    } finally {
      set({ loadingCards: false });
    }
  },

  loadBanners: async () => {
    set({ loadingBanners: true });
    try {
      set({ banners: await adminApi.listBanners() });
    } finally {
      set({ loadingBanners: false });
    }
  },

  loadFrames: async () => {
    set({ loadingFrames: true });
    try {
      set({ frames: await adminApi.listFrames() });
    } finally {
      set({ loadingFrames: false });
    }
  },

  createFrame: async (data) => {
    const frame = await adminApi.createFrame(data);
    set((s) => ({ frames: [...s.frames, frame] }));
    return frame;
  },

  updateFrame: async (id, data) => {
    const updated = await adminApi.updateFrame(id, data);
    set((s) => ({ frames: s.frames.map((f) => (f.id === id ? updated : f)) }));
    return updated;
  },

  deleteFrame: async (id) => {
    await adminApi.deleteFrame(id);
    set((s) => ({ frames: s.frames.filter((f) => f.id !== id) }));
  },

  uploadFrameImage: async (id, file) => {
    const updated = await adminApi.uploadFrameImage(id, file);
    set((s) => ({ frames: s.frames.map((f) => (f.id === id ? updated : f)) }));
    return updated;
  },

  loadAudit: async (opts) => {
    set({ loadingAudit: true });
    try {
      set({ audit: await adminApi.listAudit(opts) });
    } finally {
      set({ loadingAudit: false });
    }
  },

  loadSettings: async () => {
    set({ loadingSettings: true });
    try {
      set({ settings: await adminApi.getSettings() });
    } finally {
      set({ loadingSettings: false });
    }
  },

  saveSettings: async (data) => {
    set({ settings: await adminApi.updateSettings(data) });
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
    set({
      items: get().items.map((i) => (i.id === id ? { ...i, available: !i.available } : i)),
    });
    try {
      const updated = await adminApi.toggleItem(id);
      set({ items: get().items.map((i) => (i.id === id ? updated : i)) });
    } catch {
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

  adjustDiamonds: async (userId, delta) => {
    const result = await adminApi.adjustDiamonds(userId, delta);
    set({ users: get().users.map((u) => (u.id === userId ? { ...u, diamonds: result.diamonds } : u)) });
  },

  adjustXp: async (userId, delta) => {
    const result = await adminApi.adjustXp(userId, delta);
    set({ users: get().users.map((u) => (u.id === userId ? { ...u, xp: result.xp, level: result.level } : u)) });
  },

  setLevel: async (userId, level) => {
    const result = await adminApi.setLevel(userId, level);
    set({ users: get().users.map((u) => (u.id === userId ? { ...u, level: result.level } : u)) });
  },

  banUser: async (userId, reason) => {
    await adminApi.banUser(userId, reason);
    set({
      users: get().users.map((u) =>
        u.id === userId ? { ...u, banned: true, bannedAt: new Date().toISOString(), banReason: reason ?? null } : u
      ),
    });
  },

  unbanUser: async (userId) => {
    await adminApi.unbanUser(userId);
    set({
      users: get().users.map((u) =>
        u.id === userId ? { ...u, banned: false, bannedAt: null, banReason: null } : u
      ),
    });
  },

  setUserAdmin: async (userId, isAdmin) => {
    await adminApi.setUserAdmin(userId, isAdmin);
    set({
      users: get().users.map((u) => (u.id === userId ? { ...u, isAdmin } : u)),
    });
  },

  deleteUser: async (userId) => {
    await adminApi.deleteUser(userId);
    set({ users: get().users.filter((u) => u.id !== userId) });
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

  toggleMission: async (id) => {
    const result = await adminApi.toggleMission(id);
    set({ missions: get().missions.map((m) => (m.id === id ? { ...m, active: result.active } : m)) });
  },

  deleteMission: async (id) => {
    await adminApi.deleteMission(id);
    set({ missions: get().missions.filter((m) => m.id !== id) });
  },

  createCard: async (data) => {
    const card = await adminApi.createCard(data);
    set({ cards: [...get().cards, card] });
    return card;
  },

  updateCard: async (id, data) => {
    const updated = await adminApi.updateCard(id, data);
    set({ cards: get().cards.map((c) => (c.id === id ? updated : c)) });
    return updated;
  },

  deleteCard: async (id) => {
    await adminApi.deleteCard(id);
    set({ cards: get().cards.filter((c) => c.id !== id) });
  },

  createBanner: async (data) => {
    const banner = await adminApi.createBanner(data);
    set({ banners: [...get().banners, banner] });
    return banner;
  },

  updateBanner: async (id, data) => {
    const updated = await adminApi.updateBanner(id, data);
    set({ banners: get().banners.map((b) => (b.id === id ? updated : b)) });
    return updated;
  },

  deleteBanner: async (id) => {
    await adminApi.deleteBanner(id);
    set({ banners: get().banners.filter((b) => b.id !== id) });
  },

  uploadBannerImage: async (id, file) => {
    const updated = await adminApi.uploadBannerImage(id, file);
    set({ banners: get().banners.map((b) => (b.id === id ? updated : b)) });
    return updated;
  },

  uploadBadgeImage: async (id, file) => {
    const result = await adminApi.uploadBadgeImage(id, file);
    return result;
  },
}));
