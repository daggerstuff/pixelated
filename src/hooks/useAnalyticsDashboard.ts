/**
 * Analytics Dashboard Hook
 * 
 * Production-grade React hook for fetching and managing analytics dashboard data
 * with caching, error handling, and automatic refresh capabilities.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import type {
  AnalyticsChartData,
  AnalyticsError,
  AnalyticsFilters,
} from '@/types/analytics'

const logger = createBuildSafeLogger('use-analytics-dashboard')

interface UseAnalyticsDashboardOptions {
  refreshInterval?: number
  retryAttempts?: number
  enableAutoRefresh?: boolean
}

interface UseAnalyticsDashboardResult {
  data: AnalyticsChartData | null
  isLoading: boolean
  error: AnalyticsError | null
  refetch: () => Promise<void>
  clearError: () => void
}

const DEFAULT_OPTIONS: Required<UseAnalyticsDashboardOptions> = {
  refreshInterval: 300000, // 5 minutes
  retryAttempts: 3,
  enableAutoRefresh: true,
}

/**
 * Custom hook for managing analytics dashboard data with production-grade features
 */
export function useAnalyticsDashboard(
  filters: AnalyticsFilters,
  options: UseAnalyticsDashboardOptions = {}
): UseAnalyticsDashboardResult {
  const config = { ...DEFAULT_OPTIONS, ...options }
  
  // State management
  const [data, setData] = useState<AnalyticsChartData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<AnalyticsError | null>(null)
  
  // Refs for cleanup and retry logic
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * Fetch analytics data from API with retry logic
   */
  const fetchAnalyticsData = useCallback(async (
    currentFilters: AnalyticsFilters,
    retryCount = 0
  ): Promise<AnalyticsChartData> => {
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController()
    
    try {
      logger.info('Fetching analytics data', { filters: currentFilters, retryCount })
      
      const response = await fetch('/api/analytics/dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(currentFilters),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const analyticsData = await response.json()
      
      // Validate response structure
      if (!analyticsData.sessionMetrics || !analyticsData.skillProgress || !analyticsData.summaryStats) {
        throw new Error('Invalid analytics data structure received')
      }

      logger.info('Analytics data fetched successfully')
      return analyticsData
      
    } catch (fetchError) {
      // Handle abort - don't retry
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw fetchError
      }

      // Handle network/server errors with retry logic
      if (retryCount < config.retryAttempts) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000) // Exponential backoff
        
        logger.warn(`Fetch failed, retrying in ${retryDelay}ms`, { 
          error: fetchError, 
          retryCount: retryCount + 1 
        })
        
        return new Promise((resolve, reject) => {
          retryTimeoutRef.current = setTimeout(async () => {
            try {
              const result = await fetchAnalyticsData(currentFilters, retryCount + 1)
              resolve(result)
            } catch (retryError) {
              reject(retryError)
            }
          }, retryDelay)
        })
      }

      // Max retries exceeded
      throw fetchError
    }
  }, [config.retryAttempts])

  /**
   * Load analytics data with error handling
   */
  const loadData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true)
      }
      setError(null)
      
      const analyticsData = await fetchAnalyticsData(filters)
      setData(analyticsData)
      
    } catch (loadError) {
      // Don't set error if request was aborted (component unmounted)
      if (loadError instanceof Error && loadError.name === 'AbortError') {
        return
      }

      const analyticsError: AnalyticsError = {
        code: 'FETCH_ERROR',
        message: loadError instanceof Error ? loadError.message : 'Unknown error occurred',
        details: loadError,
      }
      
      setError(analyticsError)
      logger.error('Failed to load analytics data', { error: analyticsError })
      
    } finally {
      if (showLoading) {
        setIsLoading(false)
      }
    }
  }, [filters, fetchAnalyticsData])

  /**
   * Manual refetch function
   */
  const refetch = useCallback(async () => {
    await loadData(true)
  }, [loadData])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Setup auto-refresh interval
   */
  useEffect(() => {
    if (!config.enableAutoRefresh) {
      return
    }

    const setupAutoRefresh = () => {
      refreshIntervalRef.current = setInterval(() => {
        if (!document.hidden) { // Only refresh when tab is visible
          loadData(false) // Don't show loading for background refresh
        }
      }, config.refreshInterval)
    }

    // Setup initial auto-refresh
    setupAutoRefresh()

    // Handle visibility change to pause/resume auto-refresh
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current)
        }
      } else {
        setupAutoRefresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [config.enableAutoRefresh, config.refreshInterval, loadData])

  /**
   * Load data when filters change
   */
  useEffect(() => {
    loadData(true)
  }, [loadData])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      // Clear timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [])

  return {
    data,
    isLoading,
    error,
    refetch,
    clearError,
  }
}
