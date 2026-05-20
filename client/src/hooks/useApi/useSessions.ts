import useSWR from 'swr'
import { GameSession } from '@/types/game'
import { sessionsApi } from '@/services/api/sessions'

export function useSessions() {
  const { data, error, isLoading, mutate } = useSWR<GameSession[]>(
    'sessions:all',
    () => sessionsApi.getAll().then(res => res.data),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  return {
    sessions: data ?? [],
    isLoading,
    isError: error,
    mutate,
  }
}