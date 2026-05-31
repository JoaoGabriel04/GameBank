import useSWR from 'swr'
import { GameSession } from '@/types/game'
import { sessionsApi } from '@/services/api/sessions'

export function useSession(sessionId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<GameSession>(
    sessionId ? `session:${sessionId}` : null,
    () => sessionId ? sessionsApi.load(sessionId).then(res => res.data) : Promise.resolve(null as unknown as GameSession),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )

  return {
    session: data,
    isLoading,
    isError: error,
    mutate,
  }
}