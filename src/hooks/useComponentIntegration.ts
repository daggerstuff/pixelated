import { useState, useEffect, useCallback, useRef } from 'react'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { componentIntegrationService } from '@/lib/services/ComponentIntegrationService'

const logger = createBuildSafeLogger('component-integration-hooks')

// ... (rest of the code remains the same)

// Hook for service health monitoring
export function useServiceHealth(checkInterval: number = 60000) {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const checkHealth = useCallback(async () => {
    setLoading(true)
    try {
      const healthData = await componentIntegrationService.getServiceStatus()
      setHealth(healthData as unknown as Record<string, unknown>)
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