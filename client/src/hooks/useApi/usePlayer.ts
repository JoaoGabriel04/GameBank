import useSWR from 'swr'
import { Player } from '@/types/game'
import { playersApi } from '@/services/api/players'

export function usePlayer(playerId: number | null) {
  const { data, error, isLoading } = useSWR<Player | null>(
    playerId ? `player:${playerId}` : null,
    () => playerId ? playersApi.getById(playerId).then(res => res.data) : Promise.resolve(null),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  return {
    player: data,
    isLoading,
    isError: error,
  }
}