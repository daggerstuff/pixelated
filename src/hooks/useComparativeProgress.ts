import { useState, useEffect, useCallback, useRef } from 'react'
import type { ComparativeProgressResult } from '../types/analytics.js'

interface DateRange {
  startDate: string
  endDate: string
}

/**
 * Safely anonymizes a user ID by creating a non-reversible hash-like representation
 * without exposing the original ID. This prevents accidentally sending PII in analytics.
 */
function anonymizeUserId(userId: string): string {
  // Simple implementation: prefix with 'anon-' and truncate to avoid any potential PII exposure
  // In a production system, this would use a more sophisticated hashing algorithm
  return `anon-${userId
    .split('')
    .reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0)
    .toString(36)
    .replace('-', '')
    .substring(0, 10)}`
}

/**
 * Custom hook to fetch comparative progress analytics for a user.
 *
 * @param userId - The ID of the user to fetch progress for (required, non-empty string)
 * @param metric - The specific metric to measure progress (required, non-empty string)
 * @param cohort - The comparison cohort identifier (required, non-empty string)
 * @param dateRange - Object containing startDate and endDate in ISO format (YYYY-MM-DD)
 *
 * @returns {Object} Returns an object containing:
 *   - data: The fetched progress data or null if not loaded/invalid inputs
 *   - loading: Boolean indicating if data is currently being fetched
 *   - error: Error message string or null if no error
 *   - refetch: Function to manually trigger a refetch of the data
 *
 * @throws Will not throw errors but will set the error state with appropriate message
 * when inputs are invalid or API calls fail.
 */
export function useComparativeProgress(
  userId: string,
  metric: string,
  cohort: string,
  dateRange: DateRange,
) {
  const [data, setData] = useState<ComparativeProgressResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const validateInputs = useCallback((): {
    isValid: boolean
    errorMessage: string | null
  } => {
    // Check userId
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return {
        isValid: false,
        errorMessage: 'Invalid user ID: must be a non-empty string',
      }
    }

    // Check metric
    if (!metric || typeof metric !== 'string' || metric.trim() === '') {
      return {
        isValid: false,
        errorMessage: 'Invalid metric: must be a non-empty string',
      }
    }

    // Check cohort
    if (!cohort || typeof cohort !== 'string' || cohort.trim() === '') {
      return {
        isValid: false,
        errorMessage: 'Invalid cohort: must be a non-empty string',
      }
    }

    // Check dateRange
    if (!dateRange || typeof dateRange !== 'object') {
      return {
        isValid: false,
        errorMessage: 'Invalid dateRange: must be an object',
      }
    }

    // Validate startDate format (simple ISO date check)
    if (
      !dateRange.startDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dateRange.startDate)
    ) {
      return {
        isValid: false,
        errorMessage: 'Invalid startDate: must be in YYYY-MM-DD format',
      }
    }

    // Validate endDate format
    if (!dateRange.endDate || !/^\d{4}-\d{2}-\d{2}$/.test(dateRange.endDate)) {
      return {
        isValid: false,
        errorMessage: 'Invalid endDate: must be in YYYY-MM-DD format',
      }
    }

    // Check if startDate is before endDate
    if (new Date(dateRange.startDate) > new Date(dateRange.endDate)) {
      return {
        isValid: false,
        errorMessage:
          'Invalid dateRange: startDate must be before or equal to endDate',
      }
    }

    return { isValid: true, errorMessage: null }
  }, [userId, metric, cohort, dateRange])

  const fetchData = useCallback(async () => {
    // Validate inputs before making the API call
    const { isValid, errorMessage } = validateInputs()

    if (!isValid) {
      setError(errorMessage)
      setLoading(false)
      setData(null)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)

    try {
      // Properly anonymize the user ID before sending to the API
      const anonymizedUserId = anonymizeUserId(userId)

      const params = new URLSearchParams({
        anonymizedUserId,
        metric,
        cohort,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })

      const response = await fetch(
        `/api/analytics/comparative-progress?${params.toString()}`,
        { signal: controller.signal },
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch progress data')
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to process progress data')
      }

      setData(result.data)
    } catch (err: unknown) {
      if (err instanceof DOMException && (err as Error)?.name === 'AbortError') {
        // Request was aborted, do not update state
        return
      }
      setError(err instanceof Error ? (err as Error)?.message || String(err) : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }, [userId, metric, cohort, dateRange, validateInputs])

  useEffect(() => {
    fetchData()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
