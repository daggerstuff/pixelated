/**
 * Edge Computing Manager - Type Definitions
 *
 * Type definitions for edge computing node management across
 * 50+ global locations.
 */

export interface EdgeLocation {
  id: string
  name: string
  city: string
  country: string
  continent: string
  coordinates: {
    latitude: number
    longitude: number
  }
  provider: 'cloudflare' | 'aws' | 'azure' | 'gcp'
  region: string
  priority: number
  capacity: {
    cpu: number
    memory: string
    storage: string
  }
  network: {
    bandwidth: string
    latency: number
    cdn: boolean
  }
  aiModels: string[]
  cacheConfig: {
    size: string
    ttl: number
    strategies: string[]
  }
}

export interface EdgeDeploymentConfig {
  locations: EdgeLocation[]
  services: {
    threatDetection: boolean
    biasDetection: boolean
    cacheService: boolean
    apiGateway: boolean
    staticContent: boolean
  }
  aiModels: {
    threatDetection: string
    biasDetection: string
    behavioralAnalysis: string
  }
  cacheStrategies: string[]
  healthCheck: {
    interval: number
    timeout: number
    retries: number
  }
}

export interface EdgeNodeStatus {
  locationId: string
  status: 'healthy' | 'degraded' | 'failed' | 'deploying'
  lastHealthCheck: Date
  responseTime: number
  errorRate: number
  throughput: number
  activeConnections: number
  cacheHitRate: number
  aiModelStatus: {
    model: string
    loaded: boolean
    inferenceTime: number
    accuracy: number
  }[]
  metadata: Record<string, unknown>
}
