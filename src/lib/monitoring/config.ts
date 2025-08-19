import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('default')

export interface MonitoringConfig {
  grafana: {
    url: string
    apiKey: string
    orgId: string
    enableRUM: boolean
    rumApplicationName: string
    rumSamplingRate: number
  }
  metrics: {
    enablePerformanceMetrics: boolean
    slowRequestThreshold: number
    errorRateThreshold: number
    resourceUtilizationThreshold: number
  }
  alerts: {
    enableAlerts: boolean
    slackWebhookUrl?: string
    emailRecipients?: string[]
  }
}

const defaultConfig: MonitoringConfig = {
  grafana: {
    url: 'https://grafana.example.com',
    apiKey: '',
    orgId: '',
    enableRUM: true,
    rumApplicationName: 'astro-app',
    rumSamplingRate: 0.5, // 50% sampling
  },
  metrics: {
    enablePerformanceMetrics: true,
    slowRequestThreshold: 500, // ms
    errorRateThreshold: 0.01, // 1%
    resourceUtilizationThreshold: 0.8, // 80%
  },
  alerts: {
    enableAlerts: false,
    slackWebhookUrl: undefined,
    emailRecipients: [],
  },
}

export function getMonitoringConfig(): MonitoringConfig {
  try {
    return {
      ...defaultConfig,
      grafana: {
        ...defaultConfig.grafana,
        apiKey: process.env.GRAFANA_API_KEY || defaultConfig.grafana.apiKey,
        orgId: process.env.GRAFANA_ORG_ID || defaultConfig.grafana.orgId,
      },
    }
  } catch (error: unknown) {
    logger.error('Failed to load monitoring configuration', {
      error: error instanceof Error ? String(error) : String(error),
    })
    return defaultConfig
  }
}
