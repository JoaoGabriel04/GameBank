import api from './index'

export const profileApi = {
  me: () => api.get<any>('/profile/me'),
  history: () => api.get<any[]>('/profile/history'),
}

export const getProfileApi = () => profileApi.me().then(res => res.data)
export const getProfileHistoryApi = () => profileApi.history().then(res => res.data)

export const updateProfileApi = (formData: FormData) =>
  api.patch<{ id: number; nome: string; avatarUrl: string | null; avatarUpdatedAt: string | null; banner: string | null; spriteId: string | null }>(
    '/profile/me',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ).then(res => res.data)
