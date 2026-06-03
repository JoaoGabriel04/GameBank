import api from './index'

export type PublicBanner = {
  id: number
  name: string
  css: string
  spriteId: string | null
  imagePublicId: string | null
  imageUpdatedAt: string | null
  available: boolean
}

export const getBannersApi = () =>
  api.get<PublicBanner[]>('/banners').then(res => res.data)
