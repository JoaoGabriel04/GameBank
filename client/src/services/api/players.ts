import api from './index'
import { Player, PlayerColor } from '@/types/game'

export const playersApi = {
  getById: (playerId: number) =>
    api.get<Player>(`/user/getById/${playerId}`),
  
  edit: (playerId: number, nome: string, cor: PlayerColor) =>
    api.put(`/user/editPlayer/${playerId}`, { nome, cor }),
  
  remove: (playerId: number) =>
    api.delete(`/user/removePlayer/${playerId}`),
}

// Funções helper para compatibilidade
export const getPlayerByIdApi = (playerId: number): Promise<Player> =>
  playersApi.getById(playerId).then(res => res.data)

export const editPlayerApi = (playerId: number, nome: string, cor: PlayerColor) =>
  playersApi.edit(playerId, nome, cor).then(res => res.data)

export const removePlayerApi = (playerId: number) =>
  playersApi.remove(playerId).then(res => res.data)