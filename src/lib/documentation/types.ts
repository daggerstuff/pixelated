/**
 * Shared types for the documentation system to avoid circular dependencies
 */

// Production-grade types
export interface TreatmentGoal {
  description: string
  progress: number
  notes: string
}

export interface TreatmentProgress {
  goals: TreatmentGoal[]
  overallAssessment: string
}

export interface TherapeuticTechnique {
  name: string
  description: string
  effectiveness: number
}

export interface EmotionalPattern {
  pattern: string
  significance: string
}

export interface OutcomePrediction {
  technique: string
  predictedEfficacy: number
  confidence: number
  rationale: string
}

export interface SessionDocumentation {
  readonly sessionId: string
  readonly clientId: string
  readonly therapistId: string
  readonly startTime: Date
  readonly endTime?: Date | undefined
  readonly notes: string
  readonly interventions: readonly string[]
  readonly outcomes: readonly string[]
  readonly nextSteps: readonly string[]
  readonly riskAssessment: RiskAssessment
  readonly metadata: Partial<SessionMetadata>
  // Additional properties used in SessionDocumentation component
  readonly summary?: string
  readonly keyInsights?: readonly string[]
  readonly therapeuticTechniques?: readonly TherapeuticTechnique[]
  readonly treatmentProgress?: TreatmentProgress
  readonly emotionalPatterns?: readonly EmotionalPattern[]
  readonly clientStrengths?: readonly string[]
  readonly emergentIssues?: readonly string[]
  readonly recommendedFollowUp?: readonly string[]
  readonly nextSessionPlan?: string
  readonly outcomePredictions?: readonly OutcomePrediction[]
  version?: number
  lastModified?: Date
}

export interface RiskAssessment {
  readonly level: 'low' | 'moderate' | 'high' | 'critical'
  readonly factors: readonly string[]
  readonly recommendations: readonly string[]
  readonly requiresImmediateAttention: boolean
}

export interface SessionMetadata {
  readonly version: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly createdBy: string
  readonly sessionType: 'individual' | 'group' | 'family' | 'couples'
  readonly duration: number // in minutes
  readonly modality: 'in-person' | 'telehealth' | 'hybrid'
}

export interface DocumentationGenerationOptions {
  readonly includeRiskAssessment: boolean
  readonly includeInterventions: boolean
  readonly includeOutcomes: boolean
  readonly includeNextSteps: boolean
  readonly format: 'clinical' | 'progress' | 'summary'
  readonly template?: string
}

export interface DocumentationValidationResult {
  readonly isValid: boolean
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
  readonly completeness: number // 0-1 scale
}

/**
 * Interface for EHR export options
 */
export interface EHRExportOptions {
  /**
   * The format to export the documentation in
   */
  format: 'fhir' | 'ccda' | 'pdf'

  /**
   * The patient ID in the EHR system
   */
  patientId: string

  /**
   * The provider ID in the EHR system
   */
  providerId: string

  /**
   * Additional metadata to include in the export
   */
  metadata?: Record<string, unknown>

  /**
   * Whether to include sensitive information
   */
  includeSensitiveInfo?: boolean
}

/**
 * Represents a simplified FHIR DocumentReference resource.
 * @see http://hl7.org/fhir/documentreference.html
 */
export interface FHIRDocumentReference {
  resourceType: 'DocumentReference'
  id?: string
  status: 'current' | 'superseded' | 'entered-in-error'
  docStatus?: 'preliminary' | 'final' | 'amended' | 'entered-in-error'
  type?: {
    coding?: Array<{
      system?: string
      code?: string
      display?: string
    }>
  }
  subject?: {
    reference: string // e.g., Patient/123
  }
  date?: string // ISO 8601
  author?: Array<{
    reference: string // e.g., Practitioner/456
  }>
  custodian?: {
    reference: string // e.g., Organization/1
  }
  content: Array<{
    attachment: {
      contentType: string
      data: string // Base64 encoded
      title?: string
      creation?: string // ISO 8601
    }
  }>
}

/**
 * Interface for EHR export result
 */
export interface EHRExportResult {
  /**
   * Whether the export was successful
   */
  success: boolean

  /**
   * The exported data (format depends on the export format)
   */
  data?: FHIRDocumentReference | Record<string, unknown>

  /**
   * Any errors that occurred during export
   */
  errors?: string[]

  /**
   * The export format used
   */
  format: 'fhir' | 'ccda' | 'pdf'

  /**
   * Metadata about the export
   */
  metadata: {
    exportedAt: Date
    exportedBy: string
    patientId: string
    providerId: string
  }
}
