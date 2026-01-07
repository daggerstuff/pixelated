/**
 * Bias Detection Engine - Main Exports
 *
 * Refactored modular implementation for better maintainability.
 */

// Main engine
export { BiasDetectionEngine } from './BiasDetectionEngine'

// Core modules
export { PythonBiasDetectionBridge } from './python-bridge'
export { BiasMetricsCollector } from './metrics-collector'
// Bias Detection Alert System
export { BiasAlertSystem } from './alerts-system'

// Type exports - explicitly handle duplicates
export type {
  BiasDetectionConfig,
  TherapeuticSession,
  SessionContent,
  ParticipantDemographics,
  BiasAnalysisResult,
  AlertLevel,
  BiasDetectionEvent,
  BiasMetricsConfig,
  BiasAlertConfig,
  BiasReportConfig,
  BiasExplanationConfig,
  BiasDashboardData,
  DashboardRecommendation,
  BiasAlert,
  BiasDashboardSummary,
  ModelPerformanceMetrics,
} from './types'

// Re-export interfaces (avoiding PerformanceMetrics duplicate)
export type {
  PythonSessionData,
  PythonAnalysisResult,
  LayerMetrics,
  LayerResult,
  MetricData,
  ReportGenerationOptions,
  TimeRange,
  MetricsBatchRequest,
  MetricsBatchResponse,
  DashboardOptions,
  DashboardMetrics,
  AlertData,
  NotificationData,
  SystemNotificationData,
  AlertRegistration,
  AlertResponse,
  AlertAcknowledgment,
  AlertEscalation,
  AlertStatistics,
  FallbackAnalysisResult,
  SystemPerformanceMetrics,
} from './bias-detection-interfaces'


// Utilities
export * from './utils'

// Services
export { getAuditLogger } from './audit'
export { getCacheManager } from './cache'
export { performanceMonitor } from './performance-monitor'

// Serverless helpers
export * from './serverless-handlers'

// Default export
export { BiasDetectionEngine as default } from './BiasDetectionEngine'
