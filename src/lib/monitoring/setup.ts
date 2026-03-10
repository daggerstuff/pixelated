import type { RedisService } from '@/lib/services/redis/RedisService'
import { EventEmitter } from 'node:events'
import { AnalyticsService } from '@/lib/analytics/service'

interface MonitoringConfig {
  enableWebVitals: boolean
  enableErrorTracking: boolean
  enableUsageAnalytics: boolean
  sampleRate: number
  errorRetentionDays: number
}

interface MetricQuery {
  duration: string
  filters?: Record<string, string>
}

interface Metric {
  name: string
  value: number
  timestamp: number
  labels?: Record<string, string>
}

export class MonitoringService extends EventEmitter {
  private redis: RedisService
  private analytics: AnalyticsService
  private config: MonitoringConfig
  private initialized: boolean = false
  private metrics: Metric[] = []

  constructor(redis: RedisService, config: Partial<MonitoringConfig> = {}) {
    super()
    this.redis = redis
    this.analytics = new AnalyticsService(redis)
    this.config = {
      enableWebVitals: true,
      enableErrorTracking: true,
      enableUsageAnalytics: true,
      sampleRate: 0.1, // 10% sampling
      errorRetentionDays: 30,
      ...config,
    }
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true
    }

    try {
      await this.analytics.initialize()

      if (this.config.enableWebVitals) {
        this.setupWebVitals()
      }

      if (this.config.enableErrorTracking) {
        this.setupErrorTracking()
      }

      if (this.config.enableUsageAnalytics) {
        this.setupUsageAnalytics()
      }

      this.initialized = true
      return true
    } catch (error: unknown) {
      this.emit('error', error)
      return false
    }
  }

  private setupWebVitals() {
    // Setup performance observers
    if (typeof window !== 'undefined') {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordMetric({
            name: entry.name,
            value: entry.startTime,
            timestamp: Date.now(),
          })
        })
      })

      observer.observe({
        entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'],
      })
    }
  }

  private setupErrorTracking() {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.recordMetric({
          name: 'error',
          value: 1,
          timestamp: Date.now(),
          labels: {
            message: event.message,
            filename: event.filename,
            lineno: String(event.lineno),
          },
        })
      })

      window.addEventListener('unhandledrejection', (event) => {
        this.recordMetric({
          name: 'unhandled_rejection',
          value: 1,
          timestamp: Date.now(),
          labels: {
            reason: String(event.reason),
          },
        })
      })
    }
  }

  private setupUsageAnalytics() {
    if (typeof window !== 'undefined') {
      // Track page views
      this.recordMetric({
        name: 'page_view',
        value: 1,
        timestamp: Date.now(),
        labels: {
          path: window.location.pathname,
        },
      })

      // Track user interactions
      document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement
        this.recordMetric({
          name: 'user_interaction',
          value: 1,
          timestamp: Date.now(),
          labels: {
            type: 'click',
            element: target.tagName.toLowerCase(),
            id: target.id || 'unknown',
          },
        })
      })
    }
  }

  private recordMetric(metric: Metric): void {
    this.metrics.push(metric)
    this.emit('metric', metric)
  }

  async getMetrics(name: string, query: MetricQuery): Promise<Metric[]> {
    const duration = this.parseDuration(query.duration)
    const cutoff = Date.now() - duration

    return this.metrics.filter(
      (metric) =>
        metric.name === name &&
        metric.timestamp >= cutoff &&
        this.matchFilters(metric, query.filters),
    )
  }

  private parseDuration(duration: string): number {
    const unit = duration.slice(-1)
    const value = Number.parseInt(duration.slice(0, -1))

    switch (unit) {
      case 's':
        return value * 1000
      case 'm':
        return value * 60 * 1000
      case 'h':
        return value * 60 * 60 * 1000
      case 'd':
        return value * 24 * 60 * 60 * 1000
      default:
        throw new Error(`Invalid duration unit: ${unit}`)
    }
  }

  private matchFilters(
    metric: Metric,
    filters?: Record<string, string>,
  ): boolean {
    if (!filters || !metric.labels) {
      return true
    }

    return Object.entries(filters).every(
      ([key, value]) => metric.labels![key] === value,
    )
  }

  async shutdown(): Promise<void> {
    await this.analytics.shutdown()
  }
}

// Export a singleton instance
let monitoringService: MonitoringService | null = null

export async function initializeMonitoring(
  redis: RedisService,
  config?: Partial<MonitoringConfig>,
): Promise<MonitoringService> {
  if (!monitoringService) {
    monitoringService = new MonitoringService(redis, config)
    await monitoringService.initialize()
  }
  return monitoringService
}

export function getMonitoringService(): MonitoringService {
  if (!monitoringService) {
    throw new Error('Monitoring service not initialized')
  }
  return monitoringService
}
