import api from './index'
import type { Raridade, ShopItem } from '@/types/shop'

export interface CatalogoItem {
  id: number
  name: string
  type: string
  value: string | null
  icon: string | null
  raridade: Raridade
  fragmentosTotal: number | null
  fragmentosIcone: string | null
  imageUrl: string | null
  animated: boolean
  fragmentosAtuais: number
}

export const shopApi = {
  items: () => api.get<ShopItem[]>('/shop/items'),
  buy: (itemId: number) => api.post<{ message: string }>(`/shop/buy/${itemId}`),
  sell: (itemId: number) => api.post<{ message: string }>(`/shop/sell/${itemId}`),
  equip: (itemId: number) => api.post<{ message: string }>(`/shop/equip/${itemId}`),
}

export const getShopItemsApi = () => shopApi.items().then(res => res.data)
export const buyShopItemApi = (itemId: number) => shopApi.buy(itemId).then(res => res.data)
export const sellShopItemApi = (itemId: number) => shopApi.sell(itemId).then(res => res.data)
export const equipShopItemApi = (itemId: number) => shopApi.equip(itemId).then(res => res.data)
export const syncBannerApi = () => api.post<{ message: string }>('/shop/sync-banner').then(res => res.data)
export const buyDiamondsApi = (packId: string) => api.post<{ message: string }>('/shop/diamonds-buy', { packId }).then(res => res.data)
export const buyCoinsWithDiamondsApi = (packId: string) => api.post<{ message: string }>('/shop/coins-buy', { packId }).then(res => res.data)
export const buyItemWithDiamondsApi = (itemId: number) => api.post<{ message: string; item: Record<string, unknown> }>(`/shop/buy-diamonds/${itemId}`).then(res => res.data)

export interface DiamondPackage {
  id: number
  name: string
  description: string
  diamonds: number
  bonusPct: number
  priceInCents: number
}

export interface DiamondPurchaseHistory {
  id: string
  diamondsGranted: number
  amountPaidCents: number
  paymentMethod: string | null
  createdAt: string
  package: { name: string }
}

export const getDiamondPackagesApi = () =>
  api.get<DiamondPackage[]>('/diamonds/packages').then(res => res.data)

export const startDiamondCheckoutApi = (packageId: number) =>
  api.post<{ checkoutUrl: string; sandboxUrl: string }>('/diamonds/checkout', { packageId }).then(res => res.data)

export const getDiamondHistoryApi = () =>
  api.get<DiamondPurchaseHistory[]>('/diamonds/history').then(res => res.data)

export const getDiamondBalanceApi = () =>
  api.get<{ diamonds: number }>('/diamonds/balance').then(res => res.data)

export const getCatalogoApi = () =>
  api.get<CatalogoItem[]>('/shop/catalogo').then(res => res.data)
