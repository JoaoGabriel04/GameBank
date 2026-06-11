export type Raridade = "COMUM" | "INCOMUM" | "RARO" | "EPICO" | "LENDARIO"

export interface ShopItem {
  id: number
  name: string
  description: string
  price: number
  /** Generic icon field. For banners, use bannerId+banner.spriteId instead. */
  icon?: string | null
  type: 'title' | 'badge' | 'banner' | 'frame'
  value?: string | null
  raridade?: Raridade
  imageUrl?: string | null
  available: boolean
  animated?: boolean
  fragmentavel?: boolean
  fragmentosTotal?: number | null
  fragmentosIcone?: string | null
  bannerId?: number | null
  frameId?: number | null
}

export interface UserItem {
  id: number
  name: string
  description: string
  type: 'title' | 'badge' | 'banner' | 'frame'
  value?: string | null
  icon?: string | null 
  spriteId?: string | null
  raridade?: Raridade
  imageUrl?: string | null
  animated?: boolean
  equipped: boolean
  frameId?: number | null
}

export interface UserFragment {
  id: number
  userId: number
  itemId: number
  quantidade: number
  item?: ShopItem
}

export interface GameResult {
  id: number
  sessionId: number
  userId: number
  position: number
  patrimony: number
  xpEarned: number
  coinsEarned: number
  createdAt: string
}

export interface UserMission {
  id: number
  name: string
  description: string
  metric: string
  target: number
  progress: number
  completed: boolean
  claimed: boolean
  claimedAt?: string | null
  xpReward: number
  coinReward: number
  tipo?: "daily" | "weekly"
  expiresAt?: string | null
}

export interface ClaimResult {
  xpEarned: number
  coinsEarned: number
  newXp: number
  newCoins: number
  newLevel: number
  tipo: "daily" | "weekly"
}

export interface ClaimAllResult {
  xpEarned: number
  coinsEarned: number
  newXp: number
  newCoins: number
  newLevel: number
  claimedCount: number
}

export interface RankingUser {
  position: number
  id: number
  nome: string
  level: number
  xp: number
  coins: number
  totalGames: number
  totalWins: number
  totalTop3: number
  title?: string | null
  titleAnimated?: boolean
  titleRaridade?: string | null
  badge?: string | null
  badgeImageUrl?: string | null
  avatarUrl?: string | null
  avatarUpdatedAt?: string | null
  banner?: string | null
  bannerAnimated?: boolean
  spriteId?: string | null
  frame?: string | null
  frameType?: "image" | "gradient" | null
  frameAnimated?: boolean
  frameScale?: number
}
