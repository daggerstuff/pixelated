import { useState, useEffect } from 'react'

interface RawEmotionDataItem {
  timestamp?: string | number
  dimensions?: {
    valence?: number
    arousal?: number
    dominance?: number
  }
  valence?: number
  arousal?: number
  dominance?: number
  dominantEmotion?: string
}

interface EmotionDataPoint {
  timestamp: string
  valence: number
  arousal: number
  dominance: number
  label?: string
}

export interface SessionAnalytics {
  emotionData: EmotionDataPoint[]
  isLoading: boolean
  error: string | null
  // Future extensibility: additional analytics fields
}

/**
 * Pluggable hook to retrieve session analytics (emotions, future modules).
 * All requests are async, side-effect driven, non-blocking to the UI layer.
 * Optionally add/decorate analytics here.
 */
export function useSessionAnalytics(sessionId: string, clientId?: string): SessionAnalytics {
  const [emotionData, setEmotionData] = useState<EmotionDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    if (!sessionId) {
      return
    }

    setIsLoading(true)
    setError(null)

    // Async analytics retrieval (side effect, never blocking render)
    const fetchAllAnalytics = async () => {
      try {
        const url = new URL(
          '/api/emotions/session-analysis',
          window.location.origin
        )
        url.searchParams.append('sessionId', sessionId)

        const response = await fetch(url.toString())
        if (!response.ok) {
          throw new Error(`Error fetching emotion data: ${response.statusText}`)
        }

        const data = await response.json()
        const formattedData = Array.isArray(data)
          ? data.map((item: RawEmotionDataItem) => {
              const baseData = {
                timestamp: toIsoString(item.timestamp),
                valence:
                  item.dimensions?.valence != null && typeof item.dimensions.valence === 'number'
                    ? item.dimensions.valence
                    : typeof item.valence === 'number'
                      ? item.valence
                      : 0,
                arousal:
                  item.dimensions?.arousal != null && typeof item.dimensions.arousal === 'number'
                    ? item.dimensions.arousal
                    : typeof item.arousal === 'number'
                      ? item.arousal
                      : 0,
                dominance:
                  item.dimensions?.dominance != null && typeof item.dimensions.dominance === 'number'
                    ? item.dimensions.dominance
                    : typeof item.dominance === 'number'
                      ? item.dominance
                      : 0,
              }
              return item.dominantEmotion
                ? { ...baseData, label: `${item.dominantEmotion}` }
                : baseData
            })
          : []

        if (isMounted) {
          setEmotionData(formattedData)
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(
            err instanceof Error ? (err as Error)?.message || String(err) : 'An unknown error occurred'
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchAllAnalytics()
    return () => {
      isMounted = false
    }
  }, [sessionId, clientId])

  return {
    emotionData,
    isLoading,
    error
  }
}

  // Helper to safely convert timestamp to ISO string
  function toIsoString(ts?: string | number): string {
    if (ts == null) {
      return ''
    }
    const d = new Date(ts)
    return Number.isNaN(d.getTime()) ? '' : d.toISOString()
  }
