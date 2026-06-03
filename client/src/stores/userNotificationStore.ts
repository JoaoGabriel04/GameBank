"use client";

import { create } from "zustand";
import { notificationsApi, type UserNotification } from "@/services/api/notifications";

interface UserNotificationStore {
  notifications: UserNotification[];
  unreadCount: number;
  loading: boolean;
  load: () => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const useUserNotificationStore = create<UserNotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const notifications = await notificationsApi.getMyNotifications();
      set({
        notifications,
        unreadCount: notifications.filter((n) => !n.lida).length,
      });
    } catch {
      // silently fail — user may not be logged in
    } finally {
      set({ loading: false });
    }
  },

  markAllRead: async () => {
    await notificationsApi.markAllRead();
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, lida: true })),
      unreadCount: 0,
    }));
  },
}));
