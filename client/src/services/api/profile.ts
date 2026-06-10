/* eslint-disable @typescript-eslint/no-explicit-any */
import api from './index'

export const profileApi = {
  me: () => api.get<any>('/profile/me'),
  history: () => api.get<any[]>('/profile/history'),
}

export const getProfileApi = () => profileApi.me().then(res => res.data)
export const getProfileHistoryApi = () => profileApi.history().then(res => res.data)
export const clearProfileHistoryApi = () => api.delete('/profile/history').then(res => res.data)

export const updateProfileApi = (formData: FormData) =>
  api.patch<{ id: number; nome: string; avatarUrl: string | null; avatarUpdatedAt: string | null; banner: string | null }>(
    '/profile/me',
    formData,
  ).then(res => res.data)
