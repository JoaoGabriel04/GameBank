import { create } from "zustand";

interface AuthUser {
  id: number;
  email: string;
  nome: string;
  avatarUrl?: string | null;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  loading: true,

  setAuth: (token, user) => {
    localStorage.setItem("jwt_token", token);
    localStorage.setItem("jwt_user", JSON.stringify(user));
    set({ token, user, loading: false });
  },

  logout: () => {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("jwt_user");
    set({ token: null, user: null, loading: false });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem("jwt_token");
    const userStr = localStorage.getItem("jwt_user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ token, user, loading: false });
        return;
      } catch {}
    }
    set({ loading: false });
  },
}));
