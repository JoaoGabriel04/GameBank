import api from './index'

export const rankingApi = {
  global: () => api.get<unknown[]>('/ranking'),
}

export const getRankingApi = () => rankingApi.global().then(res => res.data)
