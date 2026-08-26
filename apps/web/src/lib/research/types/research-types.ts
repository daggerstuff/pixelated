/**
 * Research Platform Type Definitions
 * HIPAA-compliant research data types and interfaces
 */

// Core research data types
export interface ResearchDataPoint {
  id: string
  clientId: string
  sessionId: string
  timestamp: Date
  emotionScores: {
    happiness?: number
    sadness?: number
    anger?: number
    fear?: number
    surprise?: number
    disgust?: number
    neutral?: number
  }
  techniqueEffectiveness: {
    [technique: string]: number
  }
  sessionDuration: number
  age?: string
  gender?: string
  location?: string
  therapeuticApproach?: string
  outcomeScore?: number
  metadata?: Record<string, unknown>
}

// Anonymized metrics interface
export interface AnonymizedMetrics {
  aggregateEmotionScores: {
    [emotion: string]: {
      mean: number
      median: number
      stdDev: number
      count: number
    }
  }
  techniqueEffectiveness: {
    [technique: string]: {
      mean: number
      median: number
      stdDev: number
      count: number
      confidenceInterval: [number, number]
    }
  }
  demographicBreakdown: {
    [demographic: string]: {
      count: number
      percentage: number
    }
  }
  temporalTrends: {
    [period: string]: {
      emotionTrends: Record<
        string,
        {
          mean: number
          trend: 'increasing' | 'decreasing' | 'stable'
          slope: number
        }
      >
      techniqueTrends: Record<
        string,
        {
          mean: number
          trend: 'increasing' | 'decreasing' | 'stable'
          slope: number
        }
      >
    }
  }
  privacyMetrics: {
    kAnonymity: number
    differentialPrivacyEpsilon: number
    reidentificationRisk: number
  }
}

// Consent management types
export type ConsentLevel = 'none' | 'minimal' | 'limited' | 'full'

export interface ResearchConsent {
  aggregateAnalytics?: boolean
  anonymizedResearch?: boolean
  techniqueEffectiveness?: boolean
  outcomePrediction?: boolean
  patternDiscovery?: boolean
  predictiveModeling?: boolean
}

export interface ConsentRecord {
  clientId: string
  currentLevel: ConsentLevel
  consentHistory: Array<{
    level: ConsentLevel
    timestamp: string
    reason?: string
    ipAddress?: string
    userAgent?: string
    consentFormVersion?: string
  }>
  lastUpdated: string
  expirationDate: string
  withdrawalRequested: boolean
  withdrawalDate: string | null
  dataPurged: boolean
}

// Query system types
export interface ResearchQuery {
  id: string
  type:
    | 'sql'
    | 'pattern-discovery'
    | 'longitudinal-analysis'
    | 'cohort-comparison'
    | 'aggregate-analysis'
  sql?: string
  parameters: Record<string, unknown>
  description: string
  context?: string
  expectedOutput?: string
  requiresApproval: boolean
  anonymizationLevel: 'none' | 'low' | 'medium' | 'high'
  createdAt: string
  createdBy: string
  approvedBy?: string
  approvedAt?: string
}

export interface QueryResult {
  queryId: string
  status: 'success' | 'error' | 'pending-approval'
  data: unknown
  error?: string
  metadata?: {
    executionTime?: number
    resultSize?: number
    complexityScore?: number
    cacheHit?: boolean
    anonymizationMetrics?: Record<string, number>
    anonymizationAudit?: {
      kAnonymity: number
      differentialPrivacyEpsilon: number
      noiseLevel: number
      suppressionRate: number
    }
  }
}

export interface QueryApproval {
  id: string
  queryId: string
  requesterId: string
  approverId: string | null
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: string
  reviewedAt: string | null
  comments: string | null
  restrictions: string[]
}

// HIPAA compliance types
export interface EncryptedDataLake {
  dataType: string
  encryptionAlgorithm: string
  keyId: string
  encryptedData: string
  metadata: {
    createdAt: string
    updatedAt: string
    size: number
    checksum: string
  }
}

export interface AccessControlMatrix {
  roles: {
    [role: string]: {
      permissions: string[]
      restrictions: string[]
    }
  }
}

export interface AuditLog {
  action: string
  userId: string
  dataType?: string
  clientIds?: string[]
  timestamp: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

// Pattern discovery types
export interface PatternDiscoveryResult {
  patternType: 'correlation' | 'trend' | 'anomaly' | 'cluster'
  patterns: Array<{
    id: string
    description: string
    confidence: number
    statisticalSignificance: number
    supportingData: Record<string, unknown>
    visualization?: {
      type: 'scatter' | 'line' | 'heatmap' | 'bar' | 'boxplot'
      data: Record<string, unknown>[]
      config: Record<string, unknown>
    }
  }>
  metadata: {
    totalRecords: number
    processingTime: number
    significanceThreshold: number
  }
}

export interface CorrelationPattern {
  variables: [string, string]
  correlation: number
  pValue: number
  sampleSize: number
  confidenceInterval: [number, number]
}

export interface TrendPattern {
  metric: string
  direction: 'increasing' | 'decreasing' | 'stable'
  slope: number
  rSquared: number
  timeRange: { start: Date; end: Date }
}

export interface AnomalyPattern {
  metric: string
  value: number
  zScore: number
  expectedRange: [number, number]
  severity: 'low' | 'medium' | 'high'
}

export interface ClusterPattern {
  clusterId: string
  centroid: Record<string, number>
  members: string[]
  size: number
  characteristics: Record<
    string,
    {
      mean: number
      stdDev: number
      distribution: Record<string, number>
    }
  >
}

// Evidence generation types
export interface EvidenceReport {
  id: string
  title: string
  hypothesis: string
  methodology: string
  findings: Array<{
    metric: string
    value: number
    confidence: number
    statisticalTest: string
    pValue: number
    effectSize: number
  }>
  conclusions: string[]
  limitations: string[]
  recommendations: string[]
  references: string[]
  generatedAt: string
  generatedBy: string
}

export interface StatisticalTest {
  testType: 't-test' | 'chi-square' | 'anova' | 'correlation' | 'regression'
  variables: string[]
  nullHypothesis: string
  alternativeHypothesis: string
  alpha: number
  results: {
    testStatistic: number
    pValue: number
    effectSize: number
    confidenceInterval: [number, number]
    conclusion: string
  }
}

// Research collaboration types
export interface ResearchCollaboration {
  id: string
  title: string
  description: string
  participants: Array<{
    institution: string
    researcher: string
    role: string
    permissions: string[]
  }>
  dataSharingAgreement: {
    anonymizationLevel: string
    retentionPeriod: number
    permittedUses: string[]
    restrictions: string[]
  }
  status: 'proposed' | 'active' | 'completed' | 'cancelled'
  createdAt: string
  updatedAt: string
}

// Export/import types
export interface DataExport {
  id: string
  format: 'csv' | 'json' | 'xlsx' | 'rds'
  anonymizationLevel: string
  filters: {
    dateRange?: DateRange
    demographics?: DemographicFilter
    metrics?: MetricFilter
    techniques?: string[]
    outcomeRange?: [number, number]
  }
  includes: string[]
  excludes: string[]
  generatedAt: string
  fileSize: number
  checksum: string
  downloadUrl?: string
  expiresAt: string
}

// API response types
export interface ResearchAPIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  metadata?: {
    timestamp: string
    requestId: string
    processingTime: number
  }
}

// Configuration types
export interface ResearchPlatformConfig {
  anonymization: {
    kAnonymity: number
    differentialPrivacyEpsilon: number
    noiseInjection: boolean
    temporalObfuscation: boolean
  }
  consent: {
    defaultLevel: ConsentLevel
    expirationDays: number
    withdrawalGracePeriodHours: number
  }
  queryEngine: {
    maxComplexity: number
    maxResultSize: number
    approvalRequired: boolean
    cacheEnabled: boolean
  }
  hipaa: {
    encryptionAlgorithm: string
    keyRotationDays: number
    auditRetentionDays: number
  }
}

// Validation types
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  recommendations: string[]
}

export interface PrivacyValidation extends ValidationResult {
  kValue: number
  reidentificationRisk: number
  uniquenessScore: number
}

export interface SecurityValidation extends ValidationResult {
  encryptionStatus: 'valid' | 'invalid' | 'partial'
  accessControlStatus: 'valid' | 'invalid' | 'partial'
  auditTrailStatus: 'valid' | 'invalid' | 'partial'
}

// Monitoring types
export interface SystemMetrics {
  timestamp: string
  activeQueries: number
  cacheHitRate: number
  averageQueryTime: number
  errorRate: number
  dataVolume: {
    totalRecords: number
    anonymizedRecords: number
    encryptedRecords: number
  }
  consentMetrics: {
    totalClients: number
    activeConsents: number
    consentLevels: Record<ConsentLevel, number>
  }
}

export interface Alert {
  id: string
  type: 'security' | 'privacy' | 'performance' | 'compliance'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  details: Record<string, unknown>
  timestamp: string
  acknowledged: boolean
  resolved: boolean
}

// Utility types
export type DateRange = {
  start: Date
  end: Date
}

export type DemographicFilter = {
  ageGroups?: string[]
  genders?: string[]
  locations?: string[]
  therapeuticApproaches?: string[]
}

export type MetricFilter = {
  emotionTypes?: string[]
  techniqueTypes?: string[]
  outcomeRanges?: Array<[number, number]>
  sessionDurationRanges?: Array<[number, number]>
}

// Error types
export class ResearchPlatformError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ResearchPlatformError'
  }
}

export class ConsentError extends ResearchPlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONSENT_ERROR', details)
  }
}

export class PrivacyError extends ResearchPlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PRIVACY_ERROR', details)
  }
}

export class SecurityError extends ResearchPlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SECURITY_ERROR', details)
  }
}

export class ValidationError extends ResearchPlatformError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details)
  }
}
