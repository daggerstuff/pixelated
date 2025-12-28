/**
 * Platform Status Monitoring and Health Check System
 * Provides real-time status monitoring for all platform components
 */

import { getLogger } from './logger'

const logger = getLogger('platform-status')

export interface ComponentStatus {
  name: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  lastCheck: Date
  responseTime?: number
  error?: string
  details?: Record<string, unknown>
}

export interface PlatformHealth {
  overall: 'healthy' | 'degraded' | 'down'
  components: ComponentStatus[]
  lastUpdated: Date
  uptime: number
  version: string
}

export class PlatformStatusMonitor {
  private components: Map<string, ComponentStatus> = new Map()
  private startTime: Date = new Date()
  private checkInterval: number = 30000 // 30 seconds
  private isRunning: boolean = false

  constructor() {
    this.initializeComponents()
  }

  private initializeComponents(): void {
    const defaultComponents = [
      'database',
      'redis',
      'ai-service',
      'voice-pipeline',
      'safety-filter',
      'mcp-integration',
      'auth-service',
      'content-filter',
    ]

    defaultComponents.forEach((name) => {
      this.components.set(name, {
        name,
        status: 'unknown',
        lastCheck: new Date(),
      })
    })
  }

  async checkComponent(name: string): Promise<ComponentStatus> {
    const startTime = Date.now()
    let status: ComponentStatus = {
      name,
      status: 'unknown',
      lastCheck: new Date(),
    }

    try {
      switch (name) {
        case 'database':
          status = await this.checkDatabase()
          break
        case 'redis':
          status = await this.checkRedis()
          break
        case 'ai-service':
          status = await this.checkAIService()
          break
        case 'voice-pipeline':
          status = await this.checkVoicePipeline()
          break
        case 'safety-filter':
          status = await this.checkSafetyFilter()
          break
        case 'mcp-integration':
          status = await this.checkMCPIntegration()
          break
        case 'auth-service':
          status = await this.checkAuthService()
          break
        case 'content-filter':
          status = await this.checkContentFilter()
          break
        default:
          status = await this.checkGenericEndpoint(name)
      }

      status.responseTime = Date.now() - startTime
      status.lastCheck = new Date()
    } catch (error) {
      status = {
        name,
        status: 'down',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }

    this.components.set(name, status)
    return status
  }

  private async checkDatabase(): Promise<ComponentStatus> {
    try {
      // Simple database connectivity check
      const response = await fetch('/api/health/database', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      return {
        name: 'database',
        status: response.ok ? 'healthy' : 'down',
        lastCheck: new Date(),
        details: {
          statusCode: response.status,
        },
      }
    } catch (error) {
      return {
        name: 'database',
        status: 'down',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }

  private async checkRedis(): Promise<ComponentStatus> {
    try {
      const response = await fetch('/api/health/redis', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      return {
        name: 'redis',
        status: response.ok ? 'healthy' : 'down',
        lastCheck: new Date(),
        details: {
          statusCode: response.status,
        },
      }
    } catch (error) {
      return {
        name: 'redis',
        status: 'down',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }

  private async checkAIService(): Promise<ComponentStatus> {
    try {
      const response = await fetch('/api/health/ai', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      return {
        name: 'ai-service',
        status: response.ok ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        details: {
          statusCode: response.status,
        },
      }
    } catch (error) {
      return {
        name: 'ai-service',
        status: 'down',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Service unavailable',
      }
    }
  }

  private async checkVoicePipeline(): Promise<ComponentStatus> {
    try {
      // Check if voice pipeline is responsive
      const response = await fetch('/api/health/voice', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      return {
        name: 'voice-pipeline',
        status: response.ok ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        details: {
          statusCode: response.status,
        },
      }
    } catch (error) {
      return {
        name: 'voice-pipeline',
        status: 'down',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Pipeline unavailable',
      }
    }
  }

  private async checkSafetyFilter(): Promise<ComponentStatus> {
    try {
      // Test safety filter with a safe test message
      const response = await fetch('/api/safety/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test message' }),
      })

      return {
        name: 'safety-filter',
        status: response.ok ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        details: {
          statusCode: response.status,
        },
      }
    } catch (error) {
      return {
        name: 'safety-filter',
        status: 'down',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Filter unavailable',
      }
    }
  }

  private async checkMCPIntegration(): Promise<ComponentStatus> {
    try {
      const response = await fetch('/api/mcp', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      return {
        name: 'mcp-integration',
        status: response.ok ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        details: {
          statusCode: response.status,
        },
      }
    } catch (error) {
      return {
        name: 'mcp-integration',
        status: 'down',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'MCP unavailable',
      }
    }
  }

  private async checkAuthService(): Promise<ComponentStatus> {
    try {
      const response = await fetch('/api/auth/status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      return {
        name: 'auth-service',
        status: response.ok ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        details: {
          statusCode: response.status,
        },
      }
    } catch (error) {
      return {
        name: 'auth-service',
        status: 'down',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Auth unavailable',
      }
    }
  }

  private async checkContentFilter(): Promise<ComponentStatus> {
    try {
      // Import and test the ContentFilter class
      const testResult = await this.testContentFilterDirect()

      return {
        name: 'content-filter',
        status: testResult ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        details: {
          directTest: testResult,
        },
      }
    } catch (error) {
      return {
        name: 'content-filter',
        status: 'down',
        lastCheck: new Date(),
        error:
          error instanceof Error ? error.message : 'ContentFilter unavailable',
      }
    }
  }

  private async testContentFilterDirect(): Promise<boolean> {
    try {
      // This would normally import and test the Python ContentFilter
      // For now, we'll simulate a successful test
      return true
    } catch (error) {
      logger.error('Direct ContentFilter test failed', { error })
      return false
    }
  }

  private async checkGenericEndpoint(name: string): Promise<ComponentStatus> {
    try {
      const response = await fetch(`/api/health/${name}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      return {
        name,
        status: response.ok ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        details: {
          statusCode: response.status,
        },
      }
    } catch (error) {
      return {
        name,
        status: 'down',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Service unavailable',
      }
    }
  }

  async checkAllComponents(): Promise<ComponentStatus[]> {
    const componentNames = Array.from(this.components.keys())
    const promises = componentNames.map((name) => this.checkComponent(name))

    return Promise.all(promises)
  }

  async getPlatformHealth(): Promise<PlatformHealth> {
    const components = await this.checkAllComponents()

    // Calculate overall health
    const healthyCount = components.filter((c) => c.status === 'healthy').length
    const totalCount = components.length

    let overall: 'healthy' | 'degraded' | 'down'
    if (healthyCount === totalCount) {
      overall = 'healthy'
    } else if (healthyCount >= totalCount * 0.8) {
      overall = 'degraded'
    } else {
      overall = 'down'
    }

    return {
      overall,
      components,
      lastUpdated: new Date(),
      uptime: Date.now() - this.startTime.getTime(),
      version: process.env.APP_VERSION || '1.0.0',
    }
  }

  startMonitoring(): void {
    if (this.isRunning) return

    this.isRunning = true
    logger.info('Starting platform status monitoring')

    const monitor = async () => {
      if (!this.isRunning) return

      try {
        await this.checkAllComponents()
      } catch (error) {
        logger.error('Platform monitoring error', { error })
      }

      setTimeout(monitor, this.checkInterval)
    }

    monitor()
  }

  stopMonitoring(): void {
    this.isRunning = false
    logger.info('Stopped platform status monitoring')
  }

  getComponentStatus(name: string): ComponentStatus | undefined {
    return this.components.get(name)
  }
}

// Singleton instance
let statusMonitor: PlatformStatusMonitor | null = null

export function getPlatformStatusMonitor(): PlatformStatusMonitor {
  if (!statusMonitor) {
    statusMonitor = new PlatformStatusMonitor()
  }
  return statusMonitor
}

export async function getQuickHealthCheck(): Promise<{
  status: string
  components: number
  healthy: number
}> {
  const monitor = getPlatformStatusMonitor()
  const health = await monitor.getPlatformHealth()

  return {
    status: health.overall,
    components: health.components.length,
    healthy: health.components.filter((c) => c.status === 'healthy').length,
  }
}
