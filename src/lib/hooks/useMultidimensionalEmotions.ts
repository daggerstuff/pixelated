import { useState, useEffect, useCallback } from 'react'
import type { DimensionalEmotionMap } from '@/lib/ai/emotions/dimensionalTypes'
import type { MultidimensionalPattern } from '@/lib/ai/temporal/types'

interface UseMultidimensionalEmotionsOptions {
  clientId?: string
  sessionId?: string
  timeRange?: number // Time range in days
  dataPoints?: number // Number of data points to fetch
}

interface UseMultidimensionalEmotionsResult {
  dimensionalMaps: DimensionalEmotionMap[]
  patterns: MultidimensionalPattern[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * React hook for fetching and using multidimensional emotion data
 *
 * @param options The options for fetching data (clientId or sessionId)
 * @returns The multidimensional emotion maps, patterns, loading state, and error
 */
export function useMultidimensionalEmotions(
  options: UseMultidimensionalEmotionsOptions,
): UseMultidimensionalEmotionsResult {
  const [dimensionalMaps, setDimensionalMaps] = useState<
    DimensionalEmotionMap[]
  >([])
  const [patterns, setPatterns] = useState<MultidimensionalPattern[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)
  const { clientId, sessionId, timeRange = 30, dataPoints = 100 } = options

  // Helper to fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Validate options
      if (!clientId && !sessionId) {
        throw new Error('Either clientId or sessionId is required')
      }

      // Construct base URL with query parameters
      const baseParams = new URLSearchParams()
      if (clientId) {
        baseParams.append('clientId', clientId)
      }
      if (sessionId) {
        baseParams.append('sessionId', sessionId)
      }
      baseParams.append('timeRange', timeRange.toString())
      baseParams.append('dataPoints', dataPoints.toString())

      // Fetch the emotion maps
      const mapsParams = new URLSearchParams(baseParams)
      mapsParams.append('type', 'map')
      const mapsResponse = await fetch(
        `/api/emotions/multidimensional-map?${mapsParams.toString()}`,
      )

      if (!mapsResponse.ok) {
        const errorData = await mapsResponse.json().catch(() => ({}))
        throw new Error(
          `Failed to fetch dimensional maps: ${mapsResponse.statusText} - ${
            errorData.message || 'Unknown error'
          }`,
        )
      }

      const mapsData = await mapsResponse.json()
      setDimensionalMaps(mapsData)

      // Fetch the patterns
      const patternsParams = new URLSearchParams(baseParams)
      patternsParams.append('type', 'patterns')
      const patternsResponse = await fetch(
        `/api/emotions/multidimensional-map?${patternsParams.toString()}`,
      )

      if (!patternsResponse.ok) {
        const errorData = await patternsResponse.json().catch(() => ({}))
        throw new Error(
          `Failed to fetch patterns: ${patternsResponse.statusText} - ${
            errorData.message || 'Unknown error'
          }`,
        )
      }

      const patternsData = await patternsResponse.json()
      setPatterns(patternsData)
    } catch (err: unknown) {
      const errorObj =
        err instanceof Error ? err : new Error('An unknown error occurred')
      setError(errorObj)
      console.error('Error fetching multidimensional emotions:', err)
    } finally {
      setIsLoading(false)
    }
  }, [clientId, sessionId, timeRange, dataPoints])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    dimensionalMaps,
    patterns,
    isLoading,
    error,
    refetch: fetchData,
  }
}
