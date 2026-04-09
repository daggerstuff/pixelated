// Monitoring types

export interface HealthCheck {
  service: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: Date
  details: Record<string, unknown>
}

export interface Metric {
  name: string
  value: number
  timestamp: Date
  tags?: Record<string, string>
  type: 'gauge' | 'counter' | 'histogram'
}

export interface Alert {
  id: string
  name: string
  severity: 'info' | 'warning' | 'critical'
  status: 'firing' | 'pending' | 'resolved'
  triggeredAt: Date
  resolvedAt?: Date
  message: string
  labels: Record<string, string>
}

export interface LogEntry {
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error'
  service: string
  message: string
  context?: Record<string, unknown>
}
