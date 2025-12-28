/**
 * Shared types for evidence extraction to avoid circular dependencies
 */

/**
 * Represents a single piece of evidence extracted from text
 */
export interface EvidenceItem {
  /**
   * The type of evidence (e.g., 'symptom', 'behavior', 'mood', 'thought')
   */
  type: string

  /**
   * The actual evidence text or description
   */
  content: string

  /**
   * Confidence score (0-1) indicating how confident we are in this evidence
   */
  confidence: number

  /**
   * The source text from which this evidence was extracted
   */
  source: string

  /**
   * Additional context or metadata about this evidence
   */
  context?: Record<string, unknown>

  /**
   * Timestamp when this evidence was extracted
   */
  extractedAt: Date

  /**
   * Clinical relevance score (0-1)
   */
  clinicalRelevance?: number

  /**
   * Severity indicator if applicable
   */
  severity?: 'low' | 'moderate' | 'high' | 'critical'
}

/**
 * Configuration for evidence extraction
 */
export interface EvidenceExtractionConfig {
  /**
   * Maximum number of evidence items to extract
   */
  maxItems?: number

  /**
   * Minimum confidence threshold for including evidence
   */
  minConfidence?: number

  /**
   * Types of evidence to focus on
   */
  focusTypes?: string[]

  /**
   * Whether to include contextual information
   */
  includeContext?: boolean

  /**
   * Clinical focus areas
   */
  clinicalFocus?: string[]
}

/**
 * Result of evidence extraction process
 */
export interface EvidenceExtractionResult {
  /**
   * Array of extracted evidence items
   */
  evidence: EvidenceItem[]

  /**
   * Overall confidence in the extraction
   */
  overallConfidence: number

  /**
   * Summary of the extraction process
   */
  summary: string

  /**
   * Any warnings or issues encountered
   */
  warnings?: string[]

  /**
   * Metadata about the extraction
   */
  metadata: {
    extractedAt: Date
    processingTime: number
    sourceLength: number
    model: string
  }
}
