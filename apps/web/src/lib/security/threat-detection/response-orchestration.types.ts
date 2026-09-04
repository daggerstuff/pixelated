/**
 * Response orchestration types — shared interfaces for the orchestrator and
 * execution engines. Extracted from response-orchestration.ts.
 */

export interface ThreatResponse {
  responseId: string
  threatId: string
  responseType: 'block' | 'rate_limit' | 'alert' | 'investigate' | 'escalate'
  severity: 'low' | 'medium' | 'high' | 'critical'
  actions: ResponseAction[]
  confidence: number
  estimatedImpact: number
  executionTime: Date
  completedTime?: Date
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'rolled_back'
  metadata?: Record<string, unknown>
}

export interface ResponseAction {
  actionId: string
  actionType: string
  target: string
  parameters: Record<string, unknown>
  priority: number
  timeout: number
  rollbackStrategy?: string
  validationRules?: ValidationRule[]
  timestamp?: string | Date
  metadata?: Record<string, unknown>
}

export interface ValidationRule {
  ruleType: 'threshold' | 'pattern' | 'dependency'
  condition: string
  expectedValue: unknown
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'matches'
}

export interface OrchestrationConfig {
  maxConcurrentResponses: number
  responseTimeout: number
  retryAttempts: number
  escalationThresholds: Record<string, number>
  integrationEndpoints: IntegrationEndpoint[]
  notificationChannels: NotificationChannel[]
}

export interface IntegrationEndpoint {
  name: string
  type: 'webhook' | 'api' | 'message_queue' | 'database'
  url: string
  auth: {
    type: 'bearer' | 'api_key' | 'basic' | 'none'
    credentials: Record<string, string>
  }
  rateLimit: {
    requestsPerMinute: number
    burstLimit: number
  }
  retryPolicy: {
    attempts: number
    backoffMs: number
  }
}

export interface NotificationChannel {
  name: string
  type: 'email' | 'slack' | 'webhook' | 'sms'
  config: Record<string, unknown>
  priority: number
  enabled: boolean
}

export interface ThreatIntelligenceService {
  getThreat(threatId: string): Promise<unknown>
}

export interface RateLimitingService {
  applyRateLimit(userId: string, limit: number, windowMs: number): Promise<void>
}

export interface ResponseOrchestrationService {
  orchestrateResponse(
    threatId: string,
    threatData: unknown,
  ): Promise<ThreatResponse>
  executeResponse(response: ThreatResponse): Promise<boolean>
  rollbackResponse(responseId: string): Promise<boolean>
  validateAction(action: ResponseAction): Promise<boolean>
  escalateThreat(threatId: string, reason: string): Promise<ThreatResponse>
  integrateWithSystems(response: ThreatResponse): Promise<void>
  isHealthy(): Promise<boolean>
}

export interface ThreatAnalysis {
  threatId: string
  severity: ThreatResponse['severity']
  estimatedImpact: number
  confidence: number
  riskFactors: Record<string, unknown>
  recommendedActions: string[]
  patterns: string[]
  analysisTimestamp: Date
}

export interface ResponseStrategy {
  primaryType: ThreatResponse['responseType']
  escalationLevel: number
  requiresHumanReview: boolean
  autoExecute: boolean
  notificationPriority: number
}

export interface ExecutionResult {
  actionId: string
  success: boolean
  error?: string
  executionTime: number
  rollbackPossible: boolean
}

export interface MLAnalysis {
  riskScore: number
  confidence: number
  riskFactors: Record<string, unknown>
  recommendedActions: string[]
}

export interface ThreatPrediction {
  riskScore: number
  confidence: number
  riskLevel: number
}

export interface ThreatData {
  threatId: string
  source?: string
  timestamp?: string | Date
  riskFactors?: Record<string, any>
  anomalyScore?: number
  frequency?: number
  severity?: number | 'low' | 'medium' | 'high' | 'critical'
  impact?: number
  userRiskScore?: number
  ipRiskScore?: number
  behavioralDeviation?: number
  temporalAnomaly?: number
  geographicAnomaly?: number
  patternNovelty?: number
  userId?: string
  sourceIp?: string
  anomalyTypes?: string[]
  patternMatches?: string[]
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  metadata?: Record<string, unknown>
}
