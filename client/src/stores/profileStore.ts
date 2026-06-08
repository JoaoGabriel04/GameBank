import { create } from "zustand"
import { getProfileApi, updateProfileApi } from "@/services/api/profile"
import { getMissionsApi, claimMissionApi } from "@/services/api/missions"
import { getShopItemsApi } from "@/services/api/shop"
import { getRankingApi } from "@/services/api/ranking"
import { useAuthStore } from "@/stores/authStore"
import type { ShopItem, UserItem, UserMission, RankingUser, ClaimResult } from "@/types/shop"
import { apiErrMsg } from "@/lib/api-error"

interface ProfileData {
  id: number
  nome: string
  avatarUrl?: string | null
  avatarUpdatedAt?: string | null
  banner?: string | null
  bannerAnimated?: boolean
  level: number
  xp: number
  coins: number
  diamonds: number
  totalGames: number
  totalWins: number
  totalTop3: number
  title?: string | null
  titleAnimated?: boolean
  badge?: string | null
  badgeImageUrl?: string | null
  items: UserItem[]
  missions: UserMission[]
}

interface ProfileStore {
  profile: ProfileData | null
  missions: UserMission[]
  shopItems: ShopItem[]
  ranking: RankingUser[]
  loading: Record<string, boolean>
  error: string | null

  loadProfile: () => Promise<void>
  loadMissions: () => Promise<void>
  loadShopItems: () => Promise<void>
  loadRanking: () => Promise<void>
  updateProfile: (formData: FormData) => Promise<void>
  claimMission: (missionId: number) => Promise<ClaimResult>
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
      const authUser = useAuthStore.getState().user
      if (authUser) {
        useAuthStore.getState().updateUser({
          ...authUser,
          banner: profile.banner ?? null,
          badge: profile.badge ?? null,
          badgeImageUrl: profile.badgeImageUrl ?? null,
        })
      }
    } catch (err) {
      set({ error: apiErrMsg(err, "Erro ao carregar perfil"), loading: { ...get().loading, profile: false } })
    }
  },

  loadMissions: async () => {
    set({ loading: { ...get().loading, missions: true }, error: null })
    try {
      const missions = await getMissionsApi()
      set({ missions, loading: { ...get().loading, missions: false } })
    } catch (err) {
      set({ error: apiErrMsg(err, "Erro ao carregar missões"), loading: { ...get().loading, missions: false } })
    }
  },

  loadShopItems: async () => {
    set({ loading: { ...get().loading, shop: true }, error: null })
    try {
      const shopItems = await getShopItemsApi()
      set({ shopItems, loading: { ...get().loading, shop: false } })
    } catch (err) {
      set({ error: apiErrMsg(err, "Erro ao carregar loja"), loading: { ...get().loading, shop: false } })
    }
  },

  loadRanking: async () => {
    set({ loading: { ...get().loading, ranking: true }, error: null })
    try {
      const ranking = await getRankingApi()
      set({ ranking, loading: { ...get().loading, ranking: false } })
    } catch (err) {
      set({ error: apiErrMsg(err, "Erro ao carregar ranking"), loading: { ...get().loading, ranking: false } })
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

  claimMission: async (missionId: number) => {
    const result = await claimMissionApi(missionId)
    if (result.tipo === "daily" || result.tipo === "weekly") {
      set((state) => ({
        missions: state.missions.filter((m) => m.id !== missionId),
        profile: state.profile
          ? { ...state.profile, xp: result.newXp, coins: result.newCoins, level: result.newLevel }
          : null,
      }))
    } else {
      set((state) => ({
        missions: state.missions.map((m) =>
          m.id === missionId ? { ...m, claimed: true, claimedAt: new Date().toISOString() } : m
        ),
        profile: state.profile
          ? { ...state.profile, xp: result.newXp, coins: result.newCoins, level: result.newLevel }
          : null,
      }))
    }
    return result
  },

  clearProfile: () => set({ profile: null }),

  clearError: () => set({ error: null }),
}))
