import { useState, useEffect, useMemo } from 'react'

// Types
export type EmotionDimensions = {
  valence: number // Positive/negative dimension (0-10)
  arousal: number // Energy/activation level (0-10)
  dominance: number // Feeling of control (0-10)
}

export type EmotionDataPoint = EmotionDimensions & {
  timestamp: string
  label?: string
  notes?: string
}

export type EmotionSummary = {
  averageValence: number
  averageArousal: number
  averageDominance: number
  varianceValence: number
  varianceArousal: number
  varianceDominance: number
  peaks: Array<{
    dimension: keyof EmotionDimensions
    value: number
    timestamp: string
  }>
}

/**
 * Retrieves emotion tracking data for a specific session
 *
 * In a real implementation, this would call your API endpoints
 * to get the data. This is a placeholder implementation.
 */
export async function fetchSessionEmotionData(
  sessionId: string,
  options?: {
    timeRange?: [Date, Date]
    limit?: number
  },
): Promise<EmotionDataPoint[]> {
  try {
    const url = new URL(
      `/api/sessions/${sessionId}/emotions`,
      window.location.origin,
    )
    if (options?.timeRange) {
      url.searchParams.append('start', options.timeRange[0].toISOString())
      url.searchParams.append('end', options.timeRange[1].toISOString())
    }
    if (options?.limit) {
      url.searchParams.append('limit', options.limit.toString())
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text() // Get the error message from the server
      throw new Error(
        `Failed to fetch emotion data: ${response.status} - ${errorText}`,
      )
    }
    return await response.json()
  } catch (error: unknown) {
    console.error('Error fetching emotion data:', error)
    return []
  }
}

/**
 * Calculates summary statistics for emotion data
 */
export function calculateEmotionSummary(
  data: EmotionDataPoint[],
): EmotionSummary {
  if (data.length === 0) {
    return {
      averageValence: 0,
      averageArousal: 0,
      averageDominance: 0,
      varianceValence: 0,
      varianceArousal: 0,
      varianceDominance: 0,
      peaks: [],
    }
  }

  // Calculate averages
  const sum = data.reduce(
    (acc, point) => ({
      valence: acc.valence + point.valence,
      arousal: acc.arousal + point.arousal,
      dominance: acc.dominance + point.dominance,
    }),
    { valence: 0, arousal: 0, dominance: 0 },
  )

  const averageValence = sum.valence / data.length
  const averageArousal = sum.arousal / data.length
  const averageDominance = sum.dominance / data.length

  // Calculate variances
  const squaredDiffs = data.reduce(
    (acc, point) => ({
      valence: acc.valence + Math.pow(point.valence - averageValence, 2),
      arousal: acc.arousal + Math.pow(point.arousal - averageArousal, 2),
      dominance:
        acc.dominance + Math.pow(point.dominance - averageDominance, 2),
    }),
    { valence: 0, arousal: 0, dominance: 0 },
  )

  const varianceValence = squaredDiffs.valence / data.length
  const varianceArousal = squaredDiffs.arousal / data.length
  const varianceDominance = squaredDiffs.dominance / data.length

  // Find peaks (points that are at least 1.5 standard deviations above the mean)
  const peaks: Array<{
    dimension: keyof EmotionDimensions
    value: number
    timestamp: string
  }> = []

  const stdValence = Math.sqrt(varianceValence)
  const stdArousal = Math.sqrt(varianceArousal)
  const stdDominance = Math.sqrt(varianceDominance)

  data.forEach((point) => {
    if (point.valence > averageValence + 1.5 * stdValence) {
      peaks.push({
        dimension: 'valence',
        value: point.valence,
        timestamp: point.timestamp,
      })
    }
    if (point.arousal > averageArousal + 1.5 * stdArousal) {
      peaks.push({
        dimension: 'arousal',
        value: point.arousal,
        timestamp: point.timestamp,
      })
    }
    if (point.dominance > averageDominance + 1.5 * stdDominance) {
      peaks.push({
        dimension: 'dominance',
        value: point.dominance,
        timestamp: point.timestamp,
      })
    }
  })

  return {
    averageValence,
    averageArousal,
    averageDominance,
    varianceValence,
    varianceArousal,
    varianceDominance,
    peaks,
  }
}

/**
 * Custom hook that returns emotion data for a session with additional processing
 * This is a placeholder that would integrate with your state management
 */
export type UseSessionEmotionsReturn = {
  data: EmotionDataPoint[]
  isLoading: boolean
  summary: EmotionSummary
}

export function useSessionEmotions(
  sessionId: string,
): UseSessionEmotionsReturn {
  // This would ideally use your existing data fetching patterns
  // For example, if using a data fetching library:
  // const data = useQuery(['sessions', sessionId, 'emotions'], () => fetchSessionEmotionData(sessionId));

  // For now, we'll just return a mock implementation
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [data, setData] = useState<EmotionDataPoint[]>([])

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const emotionData = await fetchSessionEmotionData(sessionId)
        if (isMounted) {
          setData(emotionData)
          setIsLoading(false)
        }
      } catch (error: unknown) {
        console.error('Error loading emotion data:', error)
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [sessionId])

  const summary = useMemo(() => calculateEmotionSummary(data), [data])

  return {
    data,
    isLoading,
    summary,
  }
}
