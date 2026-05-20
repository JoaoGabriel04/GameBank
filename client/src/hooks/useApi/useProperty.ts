import useSWR from 'swr'
import { Propriedade } from '@/types/game'
import { propertiesApi } from '@/services/api/properties'

export function useProperty(propertyId: number | null) {
  const { data, error, isLoading } = useSWR<Propriedade | null>(
    propertyId ? `property:${propertyId}` : null,
    () => propertyId ? propertiesApi.getById(propertyId).then(res => res.data) : Promise.resolve(null),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  return {
    property: data,
    isLoading,
    isError: error,
  }
}