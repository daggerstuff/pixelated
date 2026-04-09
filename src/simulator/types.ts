// Simulator types for load testing and simulation

export interface SimulationConfig {
  mode: 'load_test' | 'stress_test' | 'soak_test'
  userCount: number
  duration: number
  rampUp: number
}

export interface BreachDetails {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  affectedUsers: string[]
  affectedData: string[]
  detectionMethod: string
  remediation: string
}

export interface NotificationResponse {
  totalNotifications: number
  deliveredNotifications: number
  notificationStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
}

export interface LoadTestMetrics {
  breachCreationErrors: number
  notificationsSent: number
  averageProcessingTime: number
  successRate: number
}
