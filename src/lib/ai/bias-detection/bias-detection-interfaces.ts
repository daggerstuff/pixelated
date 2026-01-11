/**
 * Bias Detection Engine - Interface Definitions
 *
 * Consolidated type definitions and interfaces for the bias detection system.
 * Extracted from BiasDetectionEngine.ts for better maintainability.
 */

// Re-export all types from the main types file
export * from './types'
import type { AlertLevel, BiasAnalysisResult, BiasAlert } from './types'

// Additional interfaces specific to the engine implementation

// Enhanced type definitions for Python service responses
export interface LayerMetrics {
  linguistic_bias?: {
    gender_bias_score?: number
    racial_bias_score?: number
    age_bias_score?: number
    cultural_bias_score?: number
    overall_bias_score?: number
  }
  fairness?: {
    demographic_parity?: number
    equalized_odds?: number
    equal_opportunity?: number
    calibration?: number
    individual_fairness?: number
    counterfactual_fairness?: number
  }
  interaction_patterns?: {
    pattern_consistency?: number
  }
  outcome_fairness?: {
    bias_score?: number
  }
  performance_disparities?: {
    bias_score?: number
  }
}

export interface LayerResult {
  bias_score: number
  metrics: LayerMetrics
  detected_biases: string[]
  recommendations: string[]
  layer: string
}

// Python service bridge interfaces
export interface PythonSessionData {
  session_id: string
  participant_demographics: import('./types').ParticipantDemographics
  training_scenario: Record<string, unknown>
  content: import('./types').SessionContent
  ai_responses: import('./types').AIResponse[]
  expected_outcomes: import('./types').ExpectedOutcome[]
  transcripts: import('./types').SessionTranscript[]
  metadata: Record<string, unknown>
}

export interface PythonAnalysisResult {
  overall_bias_score: number
  confidence: number
  alert_level: AlertLevel
  layer_results: {
    preprocessing?: LayerResult
    model_level?: LayerResult
    interactive?: LayerResult
    evaluation?: LayerResult
  }
  recommendations: string[]
  timestamp: string
  session_id: string
}

export interface PythonHealthResponse {
  status: string
  message?: string
  timestamp: string
}

export interface MetricData {
  timestamp: string
  session_id: string
  overall_bias_score: number
  alert_level: AlertLevel
  confidence: number
  layer_scores: Record<string, unknown>
  demographic_groups: string[]
  processing_time_ms: number
}

export interface ReportGenerationOptions {
  format?: string
  includeRawData?: boolean
  includeTrends?: boolean
  includeRecommendations?: boolean
}

export interface TimeRange {
  start?: string
  end?: string
  duration?: string
}

// Additional interfaces for type safety
export interface MetricsBatchRequest {
  metrics: MetricData[]
}

export interface MetricsBatchResponse {
  success: boolean
  processed: number
  errors?: string[]
}

export interface DashboardOptions {
  time_range?: string
  include_details?: boolean
  aggregation_type?: string
}

export interface DashboardMetrics {
  overall_stats: {
    total_sessions: number
    average_bias_score: number
    alert_distribution: Record<AlertLevel, number>
  }
  trend_data: Array<{
    timestamp: string
    bias_score: number
    session_count: number
  }>
  recent_alerts: Array<{
    id: string
    level: AlertLevel
    message: string
    timestamp: string
  }>
  recentAnalyses?: BiasAnalysisResult[]
  alerts?: BiasAlert[]
  // Additional properties found in the code
  summary?: {
    total_sessions: number
    average_bias_score: number
    alert_distribution: Record<string, number>
    total_sessions_analyzed?: number
    high_risk_sessions?: number
    critical_alerts?: number
  }
  trends?: {
    daily_bias_scores?: number[]
    alert_counts?: number[]
  }
  demographic_breakdown?: Record<string, unknown>
  performance_metrics?: SystemPerformanceMetrics
  recommendations?: string[]
  cache_performance?: {
    hit_rate: number
  }
  system_metrics?: {
    cpu_usage: number
  }
  demographics?: {
    bias_by_age_group?: Record<string, unknown>
    bias_by_gender?: Record<string, unknown>
  }
}

export interface SystemPerformanceMetrics {
  response_times?: {
    average: number
    p95: number
    p99: number
  }
  throughput?: {
    requests_per_second: number
    sessions_per_hour: number
  }
  error_rates?: {
    total_errors: number
    error_percentage: number
  }
  resource_usage?: {
    cpu_percent: number
    memory_mb: number
  }
  // Additional properties found in the code
  average_response_time?: number
  requests_per_second?: number
  error_rate?: number
  uptime_seconds?: number
  health_status?: string
}

export interface AlertData {
  sessionId: string
  alertLevel: AlertLevel
  message: string
  timestamp: string
}

export interface NotificationData {
  message: string
  recipients: string[]
  severity: AlertLevel
  metadata?: Record<string, unknown>
}

export interface SystemNotificationData extends NotificationData {
  system_component: string
  error_details?: Record<string, unknown>
}

export interface AlertRegistration {
  system_id: string
  callback_url?: string
  alert_levels: AlertLevel[]
  enabled: boolean
}

export interface AlertResponse {
  success: boolean
  alert_id?: string
  message?: string
}

export interface AlertAcknowledgment {
  alert_id: string
  acknowledged_by: string
  timestamp?: string
}

export interface AlertEscalation {
  alert_id: string
  escalation_level: number
  escalated_to: string[]
  reason: string
}

export interface AlertStatistics {
  total_alerts: number
  alerts_by_level: Record<AlertLevel, number>
  average_response_time: number
  escalation_rate: number
}

export interface FallbackAnalysisResult {
  overall_bias_score: number
  confidence: number
  alert_level: AlertLevel
  layer_results: Record<string, LayerResult>
  recommendations: string[]
  timestamp: string
  session_id: string
  fallback_mode: boolean
  service_error: string
}
