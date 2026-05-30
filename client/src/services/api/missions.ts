import api from './index'

export const missionsApi = {
  list: () => api.get<any[]>('/missions'),
}

export const getMissionsApi = () => missionsApi.list().then(res => res.data)
