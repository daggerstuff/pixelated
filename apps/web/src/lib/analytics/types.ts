/**
 * Shared types for analytics to avoid circular dependencies
 */

/**
 * Severity levels for security breaches
 */
export enum BreachSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Represents a security breach incident
 */
export interface SecurityBreach {
  /**
   * Unique identifier for the breach
   */
  id: string

  /**
   * Timestamp when the breach occurred
   */
  timestamp: Date

  /**
   * Severity level of the breach
   */
  severity: BreachSeverity

  /**
   * Type of breach (e.g., 'data_access', 'unauthorized_login', 'system_intrusion')
   */
  type: string

  /**
   * Role of the breach (e.g., 'admin', 'user', 'system')
   */
  role?: string

  /**
   * Description of the breach
   */
  description: string

  /**
   * Affected systems or resources
   */
  affectedSystems: string[]

  /**
   * Number of records or users affected
   */
  affectedCount: number

  /**
   * Source IP address if applicable
   */
  sourceIp?: string

  /**
   * User agent if applicable
   */
  userAgent?: string

  /**
   * Additional metadata about the breach
   */
  metadata: Record<string, unknown>

  /**
   * Whether the breach has been resolved
   */
  resolved: boolean

  /**
   * Timestamp when the breach was resolved
   */
  resolvedAt?: Date

  /**
   * Actions taken to resolve the breach
   */
  resolutionActions?: string[]

  /**
   * Risk score calculated for this breach
   */
  riskScore?: number

  /**
   * Source of the breach
   */
  source?: string

  /**
   * Remediation steps for the breach
   */
  remediation?: string

  /**
   * Attack vector used in the breach
   */
  attackVector?: string

  /**
   * Types of data affected by the breach
   */
  dataTypes?: string[]

  /**
   * Time taken to detect the breach (in milliseconds)
   */
  detectionTime?: number

  /**
   * Time taken to respond to the breach (in milliseconds)
   */
  responseTime?: number

  /**
   * Number of user accounts specifically affected by the breach (subset of affectedCount)
   */
  affectedUsers?: number

  /**
   * Status of remediation efforts
   */
  remediationStatus?: 'pending' | 'in_progress' | 'completed'
}

/**
 * Risk assessment result
 */
export interface RiskAssessmentResult {
  /**
   * Overall risk score (0-100)
   */
  score: number

  /**
   * Risk level based on score
   */
  level: 'low' | 'medium' | 'high' | 'critical'

  /**
   * Factors contributing to the risk score
   */
  factors: RiskFactor[]

  /**
   * Recommended actions
   */
  recommendations: string[]

  /**
   * Confidence in the assessment (0-1)
   */
  confidence: number

  /**
   * Timestamp of the assessment
   */
  assessedAt: Date
}

/**
 * Individual risk factor
 */
export interface RiskFactor {
  /**
   * Name of the risk factor
   */
  name: string

  /**
   * Weight of this factor in the overall score
   */
  weight: number

  /**
   * Value of this factor
   */
  value: number

  /**
   * Description of why this factor contributes to risk
   */
  description: string
}

/**
 * Configuration for risk assessment
 */
export interface RiskAssessmentConfig {
  /**
   * Time window to consider for assessment (in hours)
   */
  timeWindow: number

  /**
   * Minimum severity level to include in assessment
   */
  minSeverity: BreachSeverity

  /**
   * Whether to include resolved breaches
   */
  includeResolved: boolean

  /**
   * Custom weights for different risk factors
   */
  customWeights?: Record<string, number>
}
