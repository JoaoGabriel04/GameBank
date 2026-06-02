import api from './index'
import type { UserMission, ClaimResult } from '@/types/shop'

export const missionsApi = {
  list: () => api.get<UserMission[]>('/missions'),
  claim: (missionId: number) => api.post<ClaimResult>(`/missions/${missionId}/claim`),
}

export const getMissionsApi = () => missionsApi.list().then(res => res.data)
export const claimMissionApi = (missionId: number) => missionsApi.claim(missionId).then(res => res.data)
