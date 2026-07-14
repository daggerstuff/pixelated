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
  const paramsRef = useRef(params)
  paramsRef.current = params

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await componentIntegrationService.getChartData({
        type: paramsRef.current.type,
        category: paramsRef.current.category,
        timeRange: paramsRef.current.timeRange,
        clientId: paramsRef.current.clientId,
        sessionId: paramsRef.current.sessionId,
        dataPoints: paramsRef.current.dataPoints,
      })
      setChartData(data as unknown as Record<string, unknown>)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load chart data'
      logger.error('Chart data fetch failed', {
        error: err,
        params: paramsRef.current,
      })
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
    if (
      params.autoRefresh &&
      params.refreshInterval &&
      params.refreshInterval > 0
    ) {
      const id = setInterval(() => void fetchData(), params.refreshInterval)
      return () => clearInterval(id)
    }
    return undefined
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
    refresh: fetchData,
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

interface UseChartDataOptions {
  type?: string
  category?: string
  timeRange?: number
  clientId?: string
  sessionId?: string
  dataPoints?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseChartDataResult {
  chartData: unknown
  loading: boolean
  error: Error | null
  refresh: () => void
}

export function useChartData(_options: UseChartDataOptions): UseChartDataResult {
  const [chartData, setChartData] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(() => {
    setChartData(null)
    setLoading(false)
    setError(null)
  }, [])

  return {
    chartData,
    loading,
    error,
    refresh,
  }
}

