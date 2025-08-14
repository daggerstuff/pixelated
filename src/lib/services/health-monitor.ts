/**
 * Comprehensive Health Monitoring System for Phase 3
 * 
 * Provides real-time health monitoring for all services including:
 * - Service availability checks
 * - Performance monitoring
 * - Dependency health tracking
 * - Automated recovery mechanisms
 * - Health reporting and alerting
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { performanceOptimizer } from './performance-optimizer'

const logger = createBuildSafeLogger('health-monitor')

export interface ServiceHealth {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  lastCheck: number
  responseTime: number
  errorRate: number
  uptime: number
  dependencies: string[]
  metadata: Record<string, any>
}

export interface HealthCheckConfig {
  interval: number
  timeout: number
  retries: number
  degradedThreshold: number
  unhealthyThreshold: number
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  services: ServiceHealth[]
  lastUpdate: number
  alerts: HealthAlert[]
}

export interface HealthAlert {
  id: string
  service: string
  level: 'warning' | 'error' | 'critical'
  message: string
  timestamp: number
  resolved: boolean
}

export type HealthCheckFunction = () => Promise<{
  healthy: boolean
  responseTime: number
  metadata?: Record<string, any>
}>

export class HealthMonitor {
  private services: Map<string, {
    healthCheck: HealthCheckFunction
    config: HealthCheckConfig
    health: ServiceHealth
    dependencies: string[]
  }>
  private alerts: HealthAlert[]
  private monitoringInterval: NodeJS.Timeout | null
  private isMonitoring: boolean

  constructor() {
    this.services = new Map()
    this.alerts = []
    this.monitoringInterval = null
    this.isMonitoring = false
  }

  /**
   * Register a service for health monitoring
   */
  registerService(
    name: string,
    healthCheck: HealthCheckFunction,
    dependencies: string[] = [],
    config: Partial<HealthCheckConfig> = {}
  ): void {
    const defaultConfig: HealthCheckConfig = {
      interval: 30000, // 30 seconds
      timeout: 5000,   // 5 seconds
      retries: 3,
      degradedThreshold: 0.02, // 2% error rate
      unhealthyThreshold: 0.05 // 5% error rate
    }

    const serviceConfig = { ...defaultConfig, ...config }

    this.services.set(name, {
      healthCheck,
      config: serviceConfig,
      dependencies,
      health: {
        name,
        status: 'unknown',
        lastCheck: 0,
        responseTime: 0,
        errorRate: 0,
        uptime: 0,
        dependencies,
        metadata: {}
      }
    })

    logger.info(`Registered service for health monitoring: ${name}`, {
      dependencies,
      config: serviceConfig
    })
  }

  /**
   * Start health monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('Health monitoring is already running')
      return
    }

    this.isMonitoring = true
    logger.info('Starting health monitoring system')

    // Initial health check for all services
    this.checkAllServices()

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.checkAllServices()
    }, 10000) // Check every 10 seconds
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    this.isMonitoring = false
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    logger.info('Stopped health monitoring system')
  }

  /**
   * Check health of all registered services
   */
  private async checkAllServices(): Promise<void> {
    const checkPromises = Array.from(this.services.entries()).map(
      ([name, service]) => this.checkServiceHealth(name, service)
    )

    await Promise.allSettled(checkPromises)
    this.updateSystemAlerts()
  }

  /**
   * Check health of a specific service
   */
  private async checkServiceHealth(
    name: string,
    service: {
      healthCheck: HealthCheckFunction
      config: HealthCheckConfig
      health: ServiceHealth
      dependencies: string[]
    }
  ): Promise<void> {
    const startTime = Date.now()
    let attempt = 0
    let lastError: Error | null = null

    while (attempt < service.config.retries) {
      try {
        const checkPromise = service.healthCheck()
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), service.config.timeout)
        })

        const result = await Promise.race([checkPromise, timeoutPromise])
        const responseTime = Date.now() - startTime

        // Update service health
        service.health.lastCheck = Date.now()
        service.health.responseTime = responseTime
        service.health.metadata = result.metadata || {}

        if (result.healthy) {
          service.health.status = 'healthy'
          service.health.uptime = Date.now() - (service.health.uptime || Date.now())
          
          // Resolve any existing alerts for this service
          this.resolveServiceAlerts(name)
        } else {
          service.health.status = 'unhealthy'
          this.createAlert(name, 'error', 'Service health check failed')
        }

        return // Success, exit retry loop

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        attempt++
        
        if (attempt < service.config.retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)) // Exponential backoff
        }
      }
    }

    // All retries failed
    service.health.lastCheck = Date.now()
    service.health.status = 'unhealthy'
    service.health.responseTime = Date.now() - startTime

    this.createAlert(
      name,
      'critical',
      `Service health check failed after ${service.config.retries} attempts: ${lastError?.message}`
    )

    logger.error(`Health check failed for service: ${name}`, {
      attempts: service.config.retries,
      error: lastError?.message
    })
  }

  /**
   * Get current system health status
   */
  getSystemHealth(): SystemHealth {
    const services = Array.from(this.services.values()).map(service => service.health)
    
    // Determine overall system health
    const healthyCount = services.filter(s => s.status === 'healthy').length
    const degradedCount = services.filter(s => s.status === 'degraded').length
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length

    let overall: 'healthy' | 'degraded' | 'unhealthy'
    if (unhealthyCount > 0) {
      overall = 'unhealthy'
    } else if (degradedCount > 0) {
      overall = 'degraded'
    } else {
      overall = 'healthy'
    }

    return {
      overall,
      services,
      lastUpdate: Date.now(),
      alerts: this.alerts.filter(alert => !alert.resolved)
    }
  }

  /**
   * Get health status for a specific service
   */
  getServiceHealth(name: string): ServiceHealth | null {
    const service = this.services.get(name)
    return service ? service.health : null
  }

  /**
   * Create a health alert
   */
  private createAlert(
    service: string,
    level: 'warning' | 'error' | 'critical',
    message: string
  ): void {
    const alertId = `${service}-${Date.now()}`
    
    const alert: HealthAlert = {
      id: alertId,
      service,
      level,
      message,
      timestamp: Date.now(),
      resolved: false
    }

    this.alerts.push(alert)

    logger.warn(`Health alert created`, {
      alertId,
      service,
      level,
      message
    })

    // Trigger automated recovery if configured
    this.attemptAutomatedRecovery(service, level)
  }

  /**
   * Resolve alerts for a service
   */
  private resolveServiceAlerts(service: string): void {
    const unresolvedAlerts = this.alerts.filter(
      alert => alert.service === service && !alert.resolved
    )

    unresolvedAlerts.forEach(alert => {
      alert.resolved = true
      logger.info(`Health alert resolved`, {
        alertId: alert.id,
        service: alert.service
      })
    })
  }

  /**
   * Update system-wide alerts based on current health status
   */
  private updateSystemAlerts(): void {
    const systemHealth = this.getSystemHealth()
    
    // Check for dependency failures
    for (const service of systemHealth.services) {
      if (service.dependencies.length > 0) {
        const unhealthyDependencies = service.dependencies.filter(dep => {
          const depHealth = this.getServiceHealth(dep)
          return depHealth && depHealth.status === 'unhealthy'
        })

        if (unhealthyDependencies.length > 0) {
          this.createAlert(
            service.name,
            'warning',
            `Service has unhealthy dependencies: ${unhealthyDependencies.join(', ')}`
          )
        }
      }
    }

    // Check overall system health
    if (systemHealth.overall === 'unhealthy') {
      const unhealthyServices = systemHealth.services
        .filter(s => s.status === 'unhealthy')
        .map(s => s.name)

      this.createAlert(
        'system',
        'critical',
        `System is unhealthy. Affected services: ${unhealthyServices.join(', ')}`
      )
    }
  }

  /**
   * Attempt automated recovery for failed services
   */
  private async attemptAutomatedRecovery(
    serviceName: string,
    alertLevel: 'warning' | 'error' | 'critical'
  ): Promise<void> {
    if (alertLevel !== 'critical') {
      return // Only attempt recovery for critical alerts
    }

    logger.info(`Attempting automated recovery for service: ${serviceName}`)

    try {
      // Service-specific recovery strategies
      switch (serviceName) {
        case 'redis':
          await this.recoverRedisService()
          break
        case 'database':
          await this.recoverDatabaseService()
          break
        case 'memory-service':
          await this.recoverMemoryService()
          break
        default:
          logger.warn(`No automated recovery strategy for service: ${serviceName}`)
      }
    } catch (error) {
      logger.error(`Automated recovery failed for service: ${serviceName}`, {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * Recovery strategies for specific services
   */
  private async recoverRedisService(): Promise<void> {
    // Attempt to reconnect Redis
    try {
      const redisService = await import('./redis/RedisService')
      // Implementation would depend on your Redis service structure
      logger.info('Attempting Redis service recovery')
    } catch (error) {
      throw new Error(`Redis recovery failed: ${error}`)
    }
  }

  private async recoverDatabaseService(): Promise<void> {
    // Attempt to reconnect database
    logger.info('Attempting database service recovery')
    // Implementation would depend on your database service structure
  }

  private async recoverMemoryService(): Promise<void> {
    // Clear memory service cache and restart
    logger.info('Attempting memory service recovery')
    // Implementation would depend on your memory service structure
  }

  /**
   * Get health monitoring statistics
   */
  getMonitoringStats(): {
    totalServices: number
    healthyServices: number
    degradedServices: number
    unhealthyServices: number
    totalAlerts: number
    unresolvedAlerts: number
    averageResponseTime: number
    uptime: number
  } {
    const services = Array.from(this.services.values()).map(s => s.health)
    const totalServices = services.length
    const healthyServices = services.filter(s => s.status === 'healthy').length
    const degradedServices = services.filter(s => s.status === 'degraded').length
    const unhealthyServices = services.filter(s => s.status === 'unhealthy').length
    
    const totalAlerts = this.alerts.length
    const unresolvedAlerts = this.alerts.filter(a => !a.resolved).length
    
    const averageResponseTime = services.length > 0 
      ? services.reduce((sum, s) => sum + s.responseTime, 0) / services.length
      : 0

    const uptime = services.length > 0
      ? Math.min(...services.map(s => s.uptime))
      : 0

    return {
      totalServices,
      healthyServices,
      degradedServices,
      unhealthyServices,
      totalAlerts,
      unresolvedAlerts,
      averageResponseTime,
      uptime
    }
  }

  /**
   * Export health data for external monitoring systems
   */
  exportHealthData(): {
    timestamp: number
    system: SystemHealth
    performance: any
    stats: any
  } {
    return {
      timestamp: Date.now(),
      system: this.getSystemHealth(),
      performance: performanceOptimizer.getMetrics(),
      stats: this.getMonitoringStats()
    }
  }
}

// Export singleton instance
export const healthMonitor = new HealthMonitor()
