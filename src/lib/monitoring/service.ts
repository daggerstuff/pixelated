import type { MonitoringConfig } from './config'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { getMonitoringConfig } from './config'

const logger = createBuildSafeLogger('default')

// Define extended Performance interface to include memory property
interface ExtendedPerformance extends Performance {
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

// Helper function to convert unknown error to a structured format
function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: (error as Error)?.name,
      message: String(error),
      stack: (error as Error)?.stack,
    }
  }
  return { unknownError: error }
}

export class MonitoringService {
  private static instance: MonitoringService
  private config: MonitoringConfig
  private initialized: boolean = false

  private constructor() {
    this.config = getMonitoringConfig()
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService()
    }
    return MonitoringService.instance
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('MonitoringService already initialized')
      return
    }

    try {
      logger.info('Initializing monitoring service...')

      // Initialize Grafana Cloud Frontend Observability
      await this.initializeRUM()

      // Initialize performance metrics collection
      if (this.config.metrics.enablePerformanceMetrics) {
        await this.initializePerformanceMetrics()
      }

      // Initialize alerting
      if (this.config.alerts.enableAlerts) {
        await this.initializeAlerts()
      }

      this.initialized = true
      logger.info('Monitoring service initialized successfully')
    } catch (error: unknown) {
      logger.error(
        'Failed to initialize monitoring service',
        formatError(error),
      )
      throw error
    }
  }

  private async initializeRUM(): Promise<void> {
    if (!this.config.grafana.enableRUM) {
      logger.info('RUM is disabled, skipping initialization')
      return
    }

    try {
      const { apiKey, rumApplicationName, rumSamplingRate } =
        this.config.grafana

      // Initialize Grafana Faro Web SDK
      const script = document.createElement('script')
      script.src =
        'https://cdn.jsdelivr.net/npm/@grafana/faro-web-sdk@latest/dist/bundle/faro-web-sdk.js'
      script.async = true
      script.onload = () => {
        // @ts-expect-error - Faro is loaded globally
        window.faro.init({
          url: this.config.grafana.url,
          apiKey,
          app: {
            name: rumApplicationName,
            version: process.env['APP_VERSION'] || '1.0.0',
            environment: process.env['NODE_ENV'] || 'production',
          },
          instrumentations: ['errors', 'webVitals', 'fetch', 'history'],
          samplingRate: rumSamplingRate,
        })
      }
      document.head.appendChild(script)

      logger.info('RUM initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize RUM', formatError(error))
      throw error
    }
  }

  private async initializePerformanceMetrics(): Promise<void> {
    try {
      // Initialize performance observers
      this.initializePerformanceObservers()

      // Set up periodic metric collection
      setInterval(() => {
        this.collectPerformanceMetrics()
      }, 60000) // Collect metrics every minute

      logger.info('Performance metrics initialized successfully')
    } catch (error: unknown) {
      logger.error(
        'Failed to initialize performance metrics',
        formatError(error),
      )
      throw error
    }
  }

  private initializePerformanceObservers() {
    // Performance Observer for Core Web Vitals
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        const lastEntry = entries[entries.length - 1]
        this.reportWebVital('LCP', lastEntry)
      }).observe({ entryTypes: ['largest-contentful-paint'] })

      // First Input Delay
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        entries.forEach((entry) => {
          this.reportWebVital('FID', entry)
        })
      }).observe({ entryTypes: ['first-input'] })

      // Cumulative Layout Shift
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        entries.forEach((entry) => {
          this.reportWebVital('CLS', entry)
        })
      }).observe({ entryTypes: ['layout-shift'] })
    }
  }

  private reportWebVital(metric: string, entry: PerformanceEntry): void {
    // @ts-expect-error - Faro is loaded globally
    if (window.faro) {
      // @ts-expect-error - Faro is loaded globally
      window.faro.api.pushMeasurement(metric, {
        value: entry.startTime,
        unit: 'ms',
      })
    }
  }

  private collectPerformanceMetrics() {
    const metrics = {
      timestamp: Date.now(),
      memory: (performance as ExtendedPerformance).memory?.usedJSHeapSize || 0,
      navigation: performance.getEntriesByType('navigation')[0],
      resources: performance.getEntriesByType('resource'),
    }

    // @ts-expect-error - Faro is loaded globally
    if (window.faro) {
      // @ts-expect-error - Faro is loaded globally
      window.faro.api.pushMeasurement('performance', {
        value: metrics,
      })
    }

    // Check for performance issues
    this.checkPerformanceThresholds(metrics)
  }

  private checkPerformanceThresholds(metrics: {
    timestamp: number
    memory: number
    navigation: PerformanceEntry | undefined
    resources: PerformanceEntry[]
  }): void {
    const { slowRequestThreshold } = this.config.metrics

    // Check navigation timing
    if (
      metrics.navigation &&
      metrics.navigation.duration > slowRequestThreshold
    ) {
      this.triggerAlert('performance', {
        message: `Slow page load detected: ${metrics.navigation.duration}ms`,
        level: 'warning',
      })
    }

    // Check resource timing
    metrics.resources.forEach((resource: PerformanceResourceTiming) => {
      if (resource.duration > slowRequestThreshold) {
        this.triggerAlert('performance', {
          message: `Slow resource load detected: ${resource.name} (${resource.duration}ms)`,
          level: 'warning',
        })
      }
    })
  }

  private async initializeAlerts(): Promise<void> {
    try {
      // Set up alert handlers
      this.setupAlertHandlers()

      logger.info('Alerts initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize alerts', formatError(error))
      throw error
    }
  }

  private setupAlertHandlers() {
    window.addEventListener('error', (event) => {
      this.triggerAlert('error', {
        message: event.message,
        error: event.error,
        level: 'error',
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      this.triggerAlert('error', {
        message: 'Unhandled Promise Rejection',
        error: event.reason,
        level: 'error',
      })
    })
  }

  private async triggerAlert(
    type: string,
    data: {
      message: string
      error?: unknown
      level: string
    },
  ): Promise<void> {
    if (!this.config.alerts.enableAlerts) {
      return
    }

    try {
      // Send to Grafana
      // @ts-expect-error - Faro is loaded globally
      if (window.faro) {
        // @ts-expect-error - Faro is loaded globally
        window.faro.api.pushError(new Error(data.message), {
          type,
          level: data.level,
          context: data,
        })
      }

      // Send to Slack if configured
      if (this.config.alerts.slackWebhookUrl) {
        await fetch(this.config.alerts.slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `*${type.toUpperCase()} ALERT*\n${data.message}`,
            attachments: [
              {
                color: data.level === 'error' ? 'danger' : 'warning',
                fields: [
                  {
                    title: 'Level',
                    value: data.level,
                    short: true,
                  },
                  {
                    title: 'Timestamp',
                    value: new Date().toISOString(),
                    short: true,
                  },
                ],
              },
            ],
          }),
        })
      }

      // Send email if configured
      if (this.config.alerts.emailRecipients?.length) {
        // Implement email sending logic here
      }
    } catch (error: unknown) {
      logger.error('Failed to trigger alert', formatError(error))
    }
  }
}
