import api from './index'

export const shopApi = {
  items: () => api.get<any[]>('/shop/items'),
  buy: (itemId: number) => api.post<any>(`/shop/buy/${itemId}`),
  equip: (itemId: number) => api.post<any>(`/shop/equip/${itemId}`),
}

export const getShopItemsApi = () => shopApi.items().then(res => res.data)
export const buyShopItemApi = (itemId: number) => shopApi.buy(itemId).then(res => res.data)
export const equipShopItemApi = (itemId: number) => shopApi.equip(itemId).then(res => res.data)
