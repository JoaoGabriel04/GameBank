import { create } from "zustand"
import { getProfileApi, updateProfileApi } from "@/services/api/profile"
import { getMissionsApi } from "@/services/api/missions"
import { getShopItemsApi } from "@/services/api/shop"
import { getRankingApi } from "@/services/api/ranking"
import { useAuthStore } from "@/stores/authStore"

interface ProfileData {
  id: number
  nome: string
  avatarUrl?: string | null
  avatarUpdatedAt?: string | null
  banner?: string | null
  level: number
  xp: number
  coins: number
  totalGames: number
  totalWins: number
  totalTop3: number
  title?: string | null
  badge?: string | null
  items: any[]
  missions: any[]
}

interface ProfileStore {
  profile: ProfileData | null
  missions: any[]
  shopItems: any[]
  ranking: any[]
  loading: Record<string, boolean>
  error: string | null
  
  loadProfile: () => Promise<void>
  loadMissions: () => Promise<void>
  loadShopItems: () => Promise<void>
  loadRanking: () => Promise<void>
  updateProfile: (formData: FormData) => Promise<void>
  clearProfile: () => void
  clearError: () => void
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  missions: [],
  shopItems: [],
  ranking: [],
  loading: { profile: false, missions: false, shop: false, ranking: false },
  error: null,

  loadProfile: async () => {
    set({ loading: { ...get().loading, profile: true }, error: null })
    try {
      const profile = await getProfileApi()
      set({ profile, loading: { ...get().loading, profile: false } })
    } catch (err: any) {
      set({ error: err?.response?.data?.message || "Erro ao carregar perfil", loading: { ...get().loading, profile: false } })
    }
  },

  loadMissions: async () => {
    set({ loading: { ...get().loading, missions: true }, error: null })
    try {
      const missions = await getMissionsApi()
      set({ missions, loading: { ...get().loading, missions: false } })
    } catch (err: any) {
      set({ error: err?.response?.data?.message || "Erro ao carregar missões", loading: { ...get().loading, missions: false } })
    }
  },

  loadShopItems: async () => {
    set({ loading: { ...get().loading, shop: true }, error: null })
    try {
      const shopItems = await getShopItemsApi()
      set({ shopItems, loading: { ...get().loading, shop: false } })
    } catch (err: any) {
      set({ error: err?.response?.data?.message || "Erro ao carregar loja", loading: { ...get().loading, shop: false } })
    }
  },

  loadRanking: async () => {
    set({ loading: { ...get().loading, ranking: true }, error: null })
    try {
      const ranking = await getRankingApi()
      set({ ranking, loading: { ...get().loading, ranking: false } })
    } catch (err: any) {
      set({ error: err?.response?.data?.message || "Erro ao carregar ranking", loading: { ...get().loading, ranking: false } })
    }
  },

  updateProfile: async (formData: FormData) => {
    const result = await updateProfileApi(formData)
    const current = get().profile
    if (current) {
      set({ profile: { ...current, nome: result.nome, avatarUrl: result.avatarUrl, avatarUpdatedAt: result.avatarUpdatedAt, banner: result.banner } })
    }
    const authUser = useAuthStore.getState().user
    if (authUser) {
      useAuthStore.getState().updateUser({
        ...authUser,
        nome: result.nome,
        avatarUrl: result.avatarUrl,
        avatarUpdatedAt: result.avatarUpdatedAt,
        banner: result.banner,
      })
    }
  },

  clearProfile: () => set({ profile: null }),

  clearError: () => set({ error: null }),
}))
