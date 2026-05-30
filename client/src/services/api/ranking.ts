import api from './index'

export const rankingApi = {
  global: () => api.get<any[]>('/ranking'),
}

export const getRankingApi = () => rankingApi.global().then(res => res.data)
