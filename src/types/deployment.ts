// Deployment types for multi-region deployments

export interface DeploymentConfig {
  regions: string[]
  primaryRegion: string
  failoverStrategy: 'automatic' | 'manual'
  healthCheckInterval: number
  dnsTTL: number
}

export interface RegionStatus {
  region: string
  healthy: boolean
  lastCheck: Date
  latency: number
  activeConnections: number
}

export interface FailoverEvent {
  id: string
  fromRegion: string
  toRegion: string
  triggeredAt: Date
  completedAt?: Date
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  reason: string
}

export interface ServiceDiscoveryEntry {
  serviceName: string
  instances: ServiceInstance[]
  lastUpdated: Date
  ttl: number
}

export interface ServiceInstance {
  id: string
  host: string
  port: number
  region: string
  healthy: boolean
  registeredAt: Date
}
