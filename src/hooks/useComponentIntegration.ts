import { useState, useEffect, useCallback, useRef } from 'react'
import { componentIntegrationService, type ComponentIntegrationService } from '@/lib/services/ComponentIntegrationService'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('component-integration-hooks')

// Base hook for handling async operations with loading states
export function useAsyncOperation<T>() {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(async (operation: () => Promise<T>) => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await operation()
      setData(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  return { data, loading, error, execute, reset }
}

// Hook for chart data integration
export function useChartData(params: {
  type: 'line' | 'bar' | 'pie' | 'scatter'
  category?: 'progress' | 'emotions' | 'sessions' | 'outcomes'
  timeRange?: number
  clientId?: string
  sessionId?: string
  dataPoints?: number
  autoRefresh?: boolean
  refreshInterval?: number
}) {
  const { data, loading, error, execute } = useAsyncOperation<any>()
  const intervalRef = useRef<NodeJS.Timeout>()

  const loadChartData = useCallback(() => {
    return execute(() => componentIntegrationService.getChartData(params))
  }, [execute, params])

  useEffect(() => {
    loadChartData()

    // Set up auto-refresh if enabled
    if (params.autoRefresh && params.refreshInterval) {
      intervalRef.current = setInterval(loadChartData, params.refreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [loadChartData, params.autoRefresh, params.refreshInterval])

  return {
    chartData: data,
    loading,
    error,
    refresh: loadChartData,
  }
}

// Hook for 3D emotion visualization
export function use3DEmotionData(params: {
  clientId?: string
  sessionId?: string
  timeRange?: number
  maxPoints?: number
  includeTrajectory?: boolean
  realTimeUpdates?: boolean
}) {
  const { data, loading, error, execute } = useAsyncOperation<any>()
  const [realTimeData, setRealTimeData] = useState<any[]>([])

  const load3DEmotionData = useCallback(() => {
    return execute(() => componentIntegrationService.get3DEmotionData(params))
  }, [execute, params])

  const addEmotionPoint = useCallback(async (emotionData: {
    emotion: string
    valence: number
    arousal: number
    dominance: number
    intensity?: number
    sessionId?: string
  }) => {
    try {
      const result = await componentIntegrationService.addEmotionPoint(emotionData)
      
      // Add to real-time data if tracking
      if (params.realTimeUpdates) {
        setRealTimeData(prev => [...prev, result.emotionPoint])
      }
      
      return result
    } catch (error) {
      logger.error('Error adding emotion point', { error, emotionData })
      throw error
    }
  }, [params.realTimeUpdates])

  useEffect(() => {
    load3DEmotionData()
  }, [load3DEmotionData])

  // Combine static and real-time data
  const combinedEmotionPoints = data?.emotionPoints 
    ? [...data.emotionPoints, ...realTimeData]
    : realTimeData

  return {
    emotionData: data ? { ...data, emotionPoints: combinedEmotionPoints } : null,
    loading,
    error,
    addEmotionPoint,
    refresh: load3DEmotionData,
    clearRealTimeData: () => setRealTimeData([]),
  }
}

// Hook for treatment plan management
export function useTreatmentPlans(params: {
  clientId?: string
  planId?: string
  status?: string
  includeMetrics?: boolean
  autoSave?: boolean
}) {
  const { data, loading, error, execute } = useAsyncOperation<any[]>()
  const [isDirty, setIsDirty] = useState(false)

  const loadTreatmentPlans = useCallback(() => {
    return execute(() => componentIntegrationService.getTreatmentPlans(params))
  }, [execute, params])

  const saveTreatmentPlan = useCallback(async (planData: any) => {
    try {
      const result = await componentIntegrationService.saveTreatmentPlan(planData)
      setIsDirty(false)
      
      // Refresh the plans list
      await loadTreatmentPlans()
      
      return result
    } catch (error) {
      logger.error('Error saving treatment plan', { error, planData })
      throw error
    }
  }, [loadTreatmentPlans])

  const updateTreatmentPlan = useCallback(async (updates: {
    planId: string
    goalId?: string
    milestoneId?: string
    updates: Record<string, any>
  }) => {
    try {
      const result = await componentIntegrationService.updateTreatmentPlan(updates)
      setIsDirty(false)
      
      // Refresh the plans list
      await loadTreatmentPlans()
      
      return result
    } catch (error) {
      logger.error('Error updating treatment plan', { error, updates })
      throw error
    }
  }, [loadTreatmentPlans])

  const markDirty = useCallback(() => {
    setIsDirty(true)
  }, [])

  useEffect(() => {
    loadTreatmentPlans()
  }, [loadTreatmentPlans])

  // Auto-save functionality
  useEffect(() => {
    if (params.autoSave && isDirty && data && data.length > 0) {
      const autoSaveTimer = setTimeout(() => {
        // Auto-save the first plan (assuming it's being edited)
        saveTreatmentPlan(data[0])
      }, 5000) // Auto-save after 5 seconds of inactivity

      return () => clearTimeout(autoSaveTimer)
    }
  }, [params.autoSave, isDirty, data, saveTreatmentPlan])

  return {
    treatmentPlans: data,
    loading,
    error,
    isDirty,
    saveTreatmentPlan,
    updateTreatmentPlan,
    markDirty,
    refresh: loadTreatmentPlans,
  }
}

// Hook for particle system integration
export function useParticleSystem(params: {
  emotion?: string
  particleCount?: number
  intensity?: number
  sessionId?: string
  useSessionData?: boolean
  complexity?: 'low' | 'medium' | 'high'
  realTimeUpdates?: boolean
}) {
  const { data, loading, error, execute } = useAsyncOperation<any>()
  const [currentEmotion, setCurrentEmotion] = useState(params.emotion || 'neutral')
  const [currentIntensity, setCurrentIntensity] = useState(params.intensity || 0.5)

  const loadParticleSystem = useCallback(() => {
    return execute(() => componentIntegrationService.getParticleSystem({
      ...params,
      emotion: currentEmotion,
      intensity: currentIntensity,
    }))
  }, [execute, params, currentEmotion, currentIntensity])

  const updateParticleSystem = useCallback(async (updates: {
    emotion?: string
    intensity?: number
    particleUpdates?: any[]
  }) => {
    try {
      if (updates.emotion) setCurrentEmotion(updates.emotion)
      if (updates.intensity !== undefined) setCurrentIntensity(updates.intensity)

      const result = await componentIntegrationService.updateParticleSystem({
        emotion: updates.emotion || currentEmotion,
        intensity: updates.intensity !== undefined ? updates.intensity : currentIntensity,
        sessionId: params.sessionId,
        particleUpdates: updates.particleUpdates,
      })

      // Reload particle system with new parameters
      await loadParticleSystem()
      
      return result
    } catch (error) {
      logger.error('Error updating particle system', { error, updates })
      throw error
    }
  }, [currentEmotion, currentIntensity, params.sessionId, loadParticleSystem])

  useEffect(() => {
    loadParticleSystem()
  }, [loadParticleSystem])

  return {
    particleSystem: data,
    loading,
    error,
    currentEmotion,
    currentIntensity,
    updateParticleSystem,
    refresh: loadParticleSystem,
  }
}

// Hook for carousel content management
export function useCarouselContent(params: {
  configId?: string
  category?: string
  audience?: string
  includeExpired?: boolean
}) {
  const { data, loading, error, execute } = useAsyncOperation<any>()

  const loadCarouselContent = useCallback(() => {
    return execute(() => componentIntegrationService.getCarouselContent(params))
  }, [execute, params])

  const saveCarouselConfiguration = useCallback(async (configData: any, action: 'create' | 'update' = 'create') => {
    try {
      const result = await componentIntegrationService.saveCarouselConfiguration(configData, action)
      
      // Refresh the content list
      await loadCarouselContent()
      
      return result
    } catch (error) {
      logger.error('Error saving carousel configuration', { error, configData })
      throw error
    }
  }, [loadCarouselContent])

  useEffect(() => {
    loadCarouselContent()
  }, [loadCarouselContent])

  return {
    carouselContent: data,
    loading,
    error,
    saveCarouselConfiguration,
    refresh: loadCarouselContent,
  }
}

// Hook for integrated dashboard data
export function useIntegratedDashboard(params: {
  clientId?: string
  sessionId?: string
  timeRange?: number
  includeMetrics?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}) {
  const { data, loading, error, execute } = useAsyncOperation<any>()
  const intervalRef = useRef<NodeJS.Timeout>()

  const loadDashboardData = useCallback(() => {
    return execute(() => componentIntegrationService.getIntegratedDashboardData(params))
  }, [execute, params])

  useEffect(() => {
    loadDashboardData()

    // Set up auto-refresh if enabled
    if (params.autoRefresh && params.refreshInterval) {
      intervalRef.current = setInterval(loadDashboardData, params.refreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [loadDashboardData, params.autoRefresh, params.refreshInterval])

  return {
    dashboardData: data,
    loading,
    error,
    refresh: loadDashboardData,
    hasErrors: data?.metadata?.errors?.length > 0,
    errors: data?.metadata?.errors || [],
  }
}

// Hook for real-time updates
export function useRealTimeUpdates(params: {
  sessionId: string
  components: ('emotions' | 'particles' | 'charts' | 'treatment')[]
  enabled?: boolean
}) {
  const [updates, setUpdates] = useState<any[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!params.enabled || !params.sessionId) return

    const handleUpdate = (data: any) => {
      setUpdates(prev => [...prev.slice(-99), data]) // Keep last 100 updates
    }

    const handleError = (error: any) => {
      setError(error instanceof Error ? error : new Error('Connection error'))
      setConnected(false)
    }

    // Subscribe to real-time updates
    componentIntegrationService
      .subscribeToRealTimeUpdates({
        sessionId: params.sessionId,
        components: params.components,
        onUpdate: handleUpdate,
        onError: handleError,
      })
      .then(unsubscribe => {
        unsubscribeRef.current = unsubscribe
        setConnected(true)
        setError(null)
      })
      .catch(handleError)

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      setConnected(false)
    }
  }, [params.enabled, params.sessionId, params.components])

  const clearUpdates = useCallback(() => {
    setUpdates([])
  }, [])

  return {
    updates,
    connected,
    error,
    clearUpdates,
  }
}

// Hook for service health monitoring
export function useServiceHealth(checkInterval: number = 60000) {
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout>()

  const checkHealth = useCallback(async () => {
    setLoading(true)
    try {
      const healthData = await componentIntegrationService.getServiceHealth()
      setHealth(healthData)
    } catch (error) {
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
    checkHealth()

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
    isHealthy: health?.overall === 'healthy',
    isDegraded: health?.overall === 'degraded',
    hasError: health?.overall === 'error',
  }
}