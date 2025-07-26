import { useState, useEffect, useCallback } from 'react'
import type { TemporalEmotionAnalysis } from '../lib/ai/temporal/EmotionTemporalAnalyzer'

type AnalysisType =
  | 'full'
  | 'trends'
  | 'critical'
  | 'progression'
  | 'transitions'
  | 'relationships'

type TemporalAnalysisOptions = {
  includePatterns?: boolean
  timeWindow?: number
  emotionTypes?: string[]
  analysisType?: AnalysisType
}

type TemporalAnalysisResult = {
  data: TemporalEmotionAnalysis | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Custom hook for fetching temporal emotion analysis data
 *
 * @param sessionId ID of the session to analyze
 * @param options Analysis options
 * @returns Temporal analysis data, loading state, and error state
 */
export function useTemporalEmotionAnalysis(
  sessionId: string,
  options: TemporalAnalysisOptions = {},
): TemporalAnalysisResult {
  const [data, setData] = useState<TemporalEmotionAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  // Default options
  const {
    includePatterns = false,
    timeWindow = 90,
    emotionTypes = [],
    analysisType = 'full',
  } = options

  const fetchAnalysis = useCallback(async () => {
    if (!sessionId) {
      setError(new Error('Session ID is required'))
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Build query parameters
      const queryParams = new URLSearchParams()
      queryParams.append('includePatterns', includePatterns ? 'true' : 'false')
      queryParams.append('timeWindow', timeWindow.toString())
      queryParams.append('analysisType', analysisType)

      if (emotionTypes.length > 0) {
        queryParams.append('emotionTypes', emotionTypes.join(','))
      }

      // Make API request
      const response = await fetch(
        `/api/sessions/${sessionId}/temporal-emotions?${queryParams.toString()}`,
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API request failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Unknown error')
      }

      setData(result.data)
      setIsLoading(false)
    } catch (error) {
      console.error('Error fetching temporal emotion analysis:', error)
      setError(error instanceof Error ? error : new Error('Unknown error'))
      setIsLoading(false)
    }
  }, [sessionId, includePatterns, timeWindow, emotionTypes, analysisType])

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchAnalysis()
  }, [fetchAnalysis])

  return {
    data,
    isLoading,
    error,
    refetch: fetchAnalysis,
  }
}

/**
 * Custom hook for fetching client emotion progression data
 *
 * @param clientId ID of the client to analyze
 * @param timeWindow Time window in days (default: 90)
 * @returns Progression data, loading state, and error state
 */
export function useEmotionProgression(
  clientId: string,
  timeWindow = 90,
): {
  progression: TemporalEmotionAnalysis['progression'] | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
} {
  const [progression, setProgression] = useState<
    TemporalEmotionAnalysis['progression'] | null
  >(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchProgression = useCallback(async () => {
    if (!clientId) {
      setError(new Error('Client ID is required'))
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Build query parameters
      const queryParams = new URLSearchParams()
      queryParams.append('timeWindow', timeWindow.toString())
      queryParams.append('analysisType', 'progression')

      // Use a dummy session ID (the API will use the client ID from the auth token)
      const response = await fetch(
        `/api/sessions/client-temporal-emotions?${queryParams.toString()}`,
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API request failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Unknown error')
      }

      setProgression(result.data.progression)
      setIsLoading(false)
    } catch (error) {
      console.error('Error fetching emotion progression:', error)
      setError(error instanceof Error ? error : new Error('Unknown error'))
      setIsLoading(false)
    }
  }, [clientId, timeWindow])

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchProgression()
  }, [fetchProgression])

  return {
    progression,
    isLoading,
    error,
    refetch: fetchProgression,
  }
}

/**
 * Custom hook for fetching emotion pattern data
 *
 * @param clientId ID of the client to analyze
 * @param timeWindow Time window in days (default: 90)
 * @returns Pattern data, loading state, and error state
 */
export function useEmotionPatterns(
  clientId: string,
  timeWindow = 90,
): {
  patterns: TemporalEmotionAnalysis['patterns'] | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
} {
  const [patterns, setPatterns] = useState<
    TemporalEmotionAnalysis['patterns'] | null
  >(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchPatterns = useCallback(async () => {
    if (!clientId) {
      setError(new Error('Client ID is required'))
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Build query parameters
      const queryParams = new URLSearchParams()
      queryParams.append('timeWindow', timeWindow.toString())
      queryParams.append('analysisType', 'full')
      queryParams.append('includePatterns', 'true')

      // Use a dummy session ID (the API will use the client ID from the auth token)
      const response = await fetch(
        `/api/sessions/client-temporal-emotions?${queryParams.toString()}`,
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API request failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Unknown error')
      }

      setPatterns(result.data.patterns)
      setIsLoading(false)
    } catch (error) {
      console.error('Error fetching emotion patterns:', error)
      setError(error instanceof Error ? error : new Error('Unknown error'))
      setIsLoading(false)
    }
  }, [clientId, timeWindow])

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchPatterns()
  }, [fetchPatterns])

  return {
    patterns,
    isLoading,
    error,
    refetch: fetchPatterns,
  }
}
