export interface ShopItem {
  id: number
  name: string
  description: string
  price: number
  /** Generic icon field. For banners, use bannerId+banner.spriteId instead.
   * For badges, this may contain badge preset ID. */
  icon?: string | null
  type: 'title' | 'badge' | 'banner'
  value?: string | null
  rarity?: string | null
  available: boolean
  bannerId?: number | null
}

export interface UserItem {
  id: number
  name: string
  description: string
  type: 'title' | 'badge' | 'banner'
  value?: string | null
  icon?: string | null 
  spriteId?: string | null
  rarity?: string | null
  equipped: boolean
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
  perGame?: boolean
}

export interface ClaimResult {
  xpEarned: number
  coinsEarned: number
  newXp: number
  newCoins: number
  newLevel: number
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
  badge?: string | null
  avatarUrl?: string | null
  avatarUpdatedAt?: string | null
  banner?: string | null
  spriteId?: string | null
}
