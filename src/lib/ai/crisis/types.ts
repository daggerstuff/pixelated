export interface CrisisDetectionResult {
  isCrisis: boolean
  confidence: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  urgency: 'low' | 'medium' | 'high' | 'immediate'
  category: string
  content: string
  detectedTerms: string[]
  suggestedActions: string[]
  timestamp: string
}

export interface CrisisDetectionOptions {
  sensitivityLevel: 'low' | 'medium' | 'high'
  userId: string
  source: string
  metadata?: Record<string, unknown>
}

export interface AlertConfiguration {
  level: 'concern' | 'moderate' | 'severe' | 'emergency'
  name: string
  description: string
  thresholdScore: number
  triggerTerms: string[]
  autoEscalateAfterMs: number
  requiredActions: string[]
  responseTemplate: string
  escalationTimeMs: number
}

export interface CrisisEvent {
  id: string
  userId: string
  sessionId: string
  timestamp: string
  content: string
  confidence: number
  detectedRisks: string[]
  alertLevel: AlertConfiguration['level']
  handledBy?: string
  escalated: boolean
  resolved: boolean
  notes?: string
}

export interface CrisisProtocolConfig {
  alertConfigurations: AlertConfiguration[]
  staffChannels: Record<string, string[]>
  crisisEventRecorder: (eventData: Record<string, unknown>) => Promise<void>
  slackWebhookUrl?: string
  alertTimeoutMs?: number
}

export interface StaffNotification {
  level: AlertConfiguration['level']
  message: string
  timestamp: string
  userId: string
  channels: string[]
  urgent: boolean
}

export interface RiskAssessment {
  score: number
  category: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  indicators: string[]
  recommendations: string[]
}
