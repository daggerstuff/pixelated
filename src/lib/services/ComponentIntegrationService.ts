import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('component-integration-service')

/**
 * Central service for managing component data integration
 * Provides a unified interface for all enterprise components to access backend data
 */
export class ComponentIntegrationService {
  private baseUrl: string
  private authHeaders: HeadersInit

  constructor(baseUrl: string = '', authToken?: string) {
    this.baseUrl = baseUrl
    this.authHeaders = {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    }
  }

  // Analytics Dashboard Integration
  async getChartData(params: {
    type: 'line' | 'bar' | 'pie' | 'scatter'
    category?: 'progress' | 'emotions' | 'sessions' | 'outcomes'
    timeRange?: number
    clientId?: string
    sessionId?: string
    dataPoints?: number
  }) {
    try {
      const queryParams = new URLSearchParams(params as Record<string, string>)
      const response = await fetch(
        `${this.baseUrl}/api/components/analytics/charts?${queryParams}`,
        {
          method: 'GET',
          headers: this.authHeaders,
        },
      )

      if (!response.ok) {
        throw new Error(`Analytics API error: ${response.status}`)
      }

      const data = await response.json()
      logger.info('Retrieved chart data', {
        type: params.type,
        category: params.category,
      })
      return data
    } catch (error) {
      logger.error('Error fetching chart data', { error, params })
      throw error
    }
  }

  // 3D Emotion Visualization Integration
  async get3DEmotionData(params: {
    clientId?: string
    sessionId?: string
    timeRange?: number
    maxPoints?: number
    includeTrajectory?: boolean
  }) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value))
        }
      })

      const response = await fetch(
        `${this.baseUrl}/api/components/emotions/3d-visualization?${queryParams}`,
        {
          method: 'GET',
          headers: this.authHeaders,
        },
      )

      if (!response.ok) {
        throw new Error(`3D Emotion API error: ${response.status}`)
      }

      const data = await response.json()
      logger.info('Retrieved 3D emotion data', {
        pointCount: data.emotionPoints?.length,
        sessionId: params.sessionId,
      })
      return data
    } catch (error) {
      logger.error('Error fetching 3D emotion data', { error, params })
      throw error
    }
  }

  async addEmotionPoint(emotionData: {
    emotion: string
    valence: number
    arousal: number
    dominance: number
    intensity?: number
    sessionId?: string
  }) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/components/emotions/3d-visualization`,
        {
          method: 'POST',
          headers: this.authHeaders,
          body: JSON.stringify(emotionData),
        },
      )

      if (!response.ok) {
        throw new Error(`Add emotion point API error: ${response.status}`)
      }

      const result = await response.json()
      logger.info('Added emotion point', { emotion: emotionData.emotion })
      return result
    } catch (error) {
      logger.error('Error adding emotion point', { error, emotionData })
      throw error
    }
  }

  // Treatment Plan Management Integration
  async getTreatmentPlans(
    params: {
      clientId?: string
      planId?: string
      status?: string
      includeMetrics?: boolean
    } = {},
  ) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value))
        }
      })

      const response = await fetch(
        `${this.baseUrl}/api/components/treatment-plans/enhanced?${queryParams}`,
        {
          method: 'GET',
          headers: this.authHeaders,
        },
      )

      if (!response.ok) {
        throw new Error(`Treatment plans API error: ${response.status}`)
      }

      const plans = await response.json()
      logger.info('Retrieved treatment plans', {
        planCount: plans.length,
        clientId: params.clientId,
      })
      return plans
    } catch (error) {
      logger.error('Error fetching treatment plans', { error, params })
      throw error
    }
  }

  async saveTreatmentPlan(planData: any) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/components/treatment-plans/enhanced`,
        {
          method: 'POST',
          headers: this.authHeaders,
          body: JSON.stringify(planData),
        },
      )

      if (!response.ok) {
        throw new Error(`Save treatment plan API error: ${response.status}`)
      }

      const result = await response.json()
      logger.info('Saved treatment plan', { planId: result.id })
      return result
    } catch (error) {
      logger.error('Error saving treatment plan', { error, planData })
      throw error
    }
  }

  async updateTreatmentPlan(updates: {
    planId: string
    goalId?: string
    milestoneId?: string
    updates: Record<string, any>
  }) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/components/treatment-plans/enhanced`,
        {
          method: 'PATCH',
          headers: this.authHeaders,
          body: JSON.stringify(updates),
        },
      )

      if (!response.ok) {
        throw new Error(`Update treatment plan API error: ${response.status}`)
      }

      const result = await response.json()
      logger.info('Updated treatment plan', { planId: updates.planId })
      return result
    } catch (error) {
      logger.error('Error updating treatment plan', { error, updates })
      throw error
    }
  }

  // Particle System Integration
  async getParticleSystem(
    params: {
      emotion?: string
      particleCount?: number
      intensity?: number
      sessionId?: string
      useSessionData?: boolean
      complexity?: 'low' | 'medium' | 'high'
    } = {},
  ) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value))
        }
      })

      const response = await fetch(
        `${this.baseUrl}/api/components/particles/emotion-system?${queryParams}`,
        {
          method: 'GET',
          headers: this.authHeaders,
        },
      )

      if (!response.ok) {
        throw new Error(`Particle system API error: ${response.status}`)
      }

      const data = await response.json()
      logger.info('Retrieved particle system', {
        particleCount: data.particles?.length,
        emotion: params.emotion,
      })
      return data
    } catch (error) {
      logger.error('Error fetching particle system', { error, params })
      throw error
    }
  }

  async updateParticleSystem(updates: {
    emotion: string
    intensity: number
    sessionId?: string
    particleUpdates?: any[]
  }) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/components/particles/emotion-system`,
        {
          method: 'POST',
          headers: this.authHeaders,
          body: JSON.stringify(updates),
        },
      )

      if (!response.ok) {
        throw new Error(`Update particle system API error: ${response.status}`)
      }

      const result = await response.json()
      logger.info('Updated particle system', { emotion: updates.emotion })
      return result
    } catch (error) {
      logger.error('Error updating particle system', { error, updates })
      throw error
    }
  }

  // UI Carousel Content Integration
  async getCarouselContent(
    params: {
      configId?: string
      category?: string
      audience?: string
      includeExpired?: boolean
    } = {},
  ) {
    try {
      const queryParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value))
        }
      })

      const response = await fetch(
        `${this.baseUrl}/api/components/ui/carousel-content?${queryParams}`,
        {
          method: 'GET',
          headers: this.authHeaders,
        },
      )

      if (!response.ok) {
        throw new Error(`Carousel content API error: ${response.status}`)
      }

      const data = await response.json()
      logger.info('Retrieved carousel content', {
        configCount: data.configurations?.length,
        audience: params.audience,
      })
      return data
    } catch (error) {
      logger.error('Error fetching carousel content', { error, params })
      throw error
    }
  }

  async saveCarouselConfiguration(
    configData: any,
    action: 'create' | 'update' = 'create',
  ) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/components/ui/carousel-content`,
        {
          method: 'POST',
          headers: this.authHeaders,
          body: JSON.stringify({ configuration: configData, action }),
        },
      )

      if (!response.ok) {
        throw new Error(`Save carousel config API error: ${response.status}`)
      }

      const result = await response.json()
      logger.info('Saved carousel configuration', {
        configId: result.configuration?.id,
      })
      return result
    } catch (error) {
      logger.error('Error saving carousel configuration', { error, configData })
      throw error
    }
  }

  // Cross-Component Integration Methods
  async getIntegratedDashboardData(
    params: {
      clientId?: string
      sessionId?: string
      timeRange?: number
      includeMetrics?: boolean
    } = {},
  ) {
    try {
      // Fetch data from multiple endpoints simultaneously
      const [chartData, emotionData, treatmentPlans, particleSystem] =
        await Promise.allSettled([
          this.getChartData({
            type: 'line',
            category: 'progress',
            clientId: params.clientId,
            sessionId: params.sessionId,
            timeRange: params.timeRange,
          }),
          this.get3DEmotionData({
            clientId: params.clientId,
            sessionId: params.sessionId,
            timeRange: params.timeRange,
            includeTrajectory: true,
          }),
          this.getTreatmentPlans({
            clientId: params.clientId,
            includeMetrics: params.includeMetrics,
          }),
          this.getParticleSystem({
            emotion: 'neutral',
            sessionId: params.sessionId,
            useSessionData: true,
          }),
        ])

      const dashboardData = {
        charts: chartData.status === 'fulfilled' ? chartData.value : null,
        emotions: emotionData.status === 'fulfilled' ? emotionData.value : null,
        treatmentPlans:
          treatmentPlans.status === 'fulfilled' ? treatmentPlans.value : null,
        particles:
          particleSystem.status === 'fulfilled' ? particleSystem.value : null,
        metadata: {
          timestamp: new Date().toISOString(),
          errors: [
            ...(chartData.status === 'rejected'
              ? [{ component: 'charts', error: chartData.reason }]
              : []),
            ...(emotionData.status === 'rejected'
              ? [{ component: 'emotions', error: emotionData.reason }]
              : []),
            ...(treatmentPlans.status === 'rejected'
              ? [{ component: 'treatmentPlans', error: treatmentPlans.reason }]
              : []),
            ...(particleSystem.status === 'rejected'
              ? [{ component: 'particles', error: particleSystem.reason }]
              : []),
          ],
        },
      }

      logger.info('Retrieved integrated dashboard data', {
        clientId: params.clientId,
        hasCharts: !!dashboardData.charts,
        hasEmotions: !!dashboardData.emotions,
        hasTreatmentPlans: !!dashboardData.treatmentPlans,
        hasParticles: !!dashboardData.particles,
        errorCount: dashboardData.metadata.errors.length,
      })

      return dashboardData
    } catch (error) {
      logger.error('Error fetching integrated dashboard data', {
        error,
        params,
      })
      throw error
    }
  }

  // Real-time Updates and WebSocket Integration
  async subscribeToRealTimeUpdates(params: {
    sessionId: string
    components: ('emotions' | 'particles' | 'charts' | 'treatment')[]
    onUpdate: (data: any) => void
    onError: (error: any) => void
  }) {
    try {
      // TODO: Implement WebSocket connection for real-time updates
      logger.info('Subscribing to real-time updates', {
        sessionId: params.sessionId,
        components: params.components,
      })

      // Mock implementation - replace with actual WebSocket
      const mockUpdates = setInterval(() => {
        if (params.components.includes('emotions')) {
          params.onUpdate({
            type: 'emotion',
            data: {
              emotion: 'joy',
              intensity: Math.random(),
              timestamp: new Date().toISOString(),
            },
          })
        }
      }, 5000)

      return () => clearInterval(mockUpdates)
    } catch (error) {
      logger.error('Error subscribing to real-time updates', { error, params })
      params.onError(error)
      throw error
    }
  }

  // Health Check and Service Status
  async getServiceHealth() {
    try {
      const endpoints = [
        '/api/components/analytics/charts',
        '/api/components/emotions/3d-visualization',
        '/api/components/treatment-plans/enhanced',
        '/api/components/particles/emotion-system',
        '/api/components/ui/carousel-content',
      ]

      const healthChecks = await Promise.allSettled(
        endpoints.map(async (endpoint) => {
          const response = await fetch(
            `${this.baseUrl}${endpoint}?healthCheck=true`,
            {
              method: 'HEAD',
              headers: this.authHeaders,
            },
          )
          return { endpoint, status: response.status, ok: response.ok }
        }),
      )

      const health = {
        overall: healthChecks.every(
          (check) => check.status === 'fulfilled' && check.value.ok,
        )
          ? 'healthy'
          : 'degraded',
        services: healthChecks.map((check) => ({
          endpoint:
            check.status === 'fulfilled' ? check.value.endpoint : 'unknown',
          status:
            check.status === 'fulfilled'
              ? check.value.ok
                ? 'healthy'
                : 'unhealthy'
              : 'error',
          error: check.status === 'rejected' ? check.reason : null,
        })),
        timestamp: new Date().toISOString(),
      }

      logger.info('Component integration health check', {
        overall: health.overall,
        healthyServices: health.services.filter((s) => s.status === 'healthy')
          .length,
        totalServices: health.services.length,
      })

      return health
    } catch (error) {
      logger.error('Error checking service health', { error })
      throw error
    }
  }
}

// Factory function for creating service instances
export function createComponentIntegrationService(
  authToken?: string,
): ComponentIntegrationService {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  return new ComponentIntegrationService(baseUrl, authToken)
}

// Export singleton instance for client-side use
export const componentIntegrationService = createComponentIntegrationService()
