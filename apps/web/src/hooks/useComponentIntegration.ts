import { useState, useEffect, useCallback, useRef } from 'react'

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { componentIntegrationService } from '@/lib/services/ComponentIntegrationService'

const logger = createBuildSafeLogger('component-integration-hooks')

// Hook for fetching chart data from the component integration backend
export interface UseChartDataParams {
  type: 'line' | 'bar' | 'pie' | 'scatter'
  category?: 'progress' | 'emotions' | 'sessions' | 'outcomes'
  timeRange?: number
  clientId?: string
  sessionId?: string
  dataPoints?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useChartData(params: UseChartDataParams) {
  const [chartData, setChartData] = useState<Record<string, unknown> | null>(
    null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const data = await componentIntegrationService.getChartData({
          type: params.type,
          category: params.category,
          timeRange: params.timeRange,
          clientId: params.clientId,
          sessionId: params.sessionId,
          dataPoints: params.dataPoints,
        })
        if (signal?.aborted) return
        setChartData(data)
      } catch (err: unknown) {
        if (signal?.aborted) return
        const message =
          err instanceof Error ? err.message : 'Failed to load chart data'
        logger.error('Chart data fetch failed', {
          error: err,
          params,
        })
        setError(message)
        setChartData(null)
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [
      params.type,
      params.category,
      params.timeRange,
      params.clientId,
      params.sessionId,
      params.dataPoints,
    ],
  )

  useEffect(() => {
    const controller = new AbortController()
    abortControllerRef.current = controller
    void fetchData(controller.signal)

    if (
      params.autoRefresh &&
      params.refreshInterval &&
      params.refreshInterval > 0
    ) {
      const id = setInterval(() => {
        const ctrl = new AbortController()
        abortControllerRef.current = ctrl
        void fetchData(ctrl.signal)
      }, params.refreshInterval)
      return () => {
        clearInterval(id)
        controller.abort()
      }
    }
    return () => {
      controller.abort()
    }
  }, [
    fetchData,
    params.autoRefresh,
    params.refreshInterval,
    params.type,
    params.category,
    params.timeRange,
    params.clientId,
    params.sessionId,
    params.dataPoints,
  ])

  return {
    chartData,
    loading,
    error,
    refresh: () => {
      const controller = new AbortController()
      abortControllerRef.current = controller
      void fetchData(controller.signal)
    },
  }
}

// Hook for service health monitoring
export function useServiceHealth(checkInterval: number = 60000) {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const checkHealth = useCallback(async () => {
    setLoading(true)
    try {
      const healthData = await componentIntegrationService.getServiceHealth()
      setHealth(healthData)
    } catch (error: unknown) {
      logger.error('Health check failed', { error })
      setHealth({
        overall: 'error',
        services: [],
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void checkHealth()
    if (checkInterval > 0) {
      intervalRef.current = setInterval(checkHealth, checkInterval)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [checkHealth, checkInterval])

  return {
    health,
    loading,
    checkHealth,
    isHealthy: health?.['overall'] === 'operational', // Update the condition to check for 'operational'
    isDegraded: health?.['overall'] === 'degraded',
    hasError: health?.['overall'] === 'error',
  }
}
