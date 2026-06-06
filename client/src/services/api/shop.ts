import api from './index'

export const shopApi = {
  items: () => api.get<any[]>('/shop/items'),
  buy: (itemId: number) => api.post<any>(`/shop/buy/${itemId}`),
  sell: (itemId: number) => api.post<any>(`/shop/sell/${itemId}`),
  equip: (itemId: number) => api.post<any>(`/shop/equip/${itemId}`),
}

export const getShopItemsApi = () => shopApi.items().then(res => res.data)
export const buyShopItemApi = (itemId: number) => shopApi.buy(itemId).then(res => res.data)
export const sellShopItemApi = (itemId: number) => shopApi.sell(itemId).then(res => res.data)
export const equipShopItemApi = (itemId: number) => shopApi.equip(itemId).then(res => res.data)
export const syncBannerApi = () => api.post<{ message: string }>('/shop/sync-banner').then(res => res.data)
export const buyDiamondsApi = (packId: string) => api.post<{ message: string }>('/shop/diamonds-buy', { packId }).then(res => res.data)
export const buyCoinsWithDiamondsApi = (packId: string) => api.post<{ message: string }>('/shop/coins-buy', { packId }).then(res => res.data)
