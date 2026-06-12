import mongodb from '@/lib/db/mongoClient'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import {
  EvidencePoint,
  EvidenceSeverity,
  UpstreamDomain,
} from './reprioritization_engine'

const logger = createBuildSafeLogger('evidence-collector')

// Configuration interface
interface EvidenceCollectorConfig {
  /** Number of days to look back for evidence collection (default: 7) */
  collectionWindowDays: number
  /** Minimum confidence threshold for including evidence (default: 0.5) */
  minConfidence: number
  /** Whether to include resolved crisis events (default: false) */
  includeResolved: boolean
}

/**
 * Default configuration for the EvidenceCollector
 */
const DEFAULT_CONFIG: EvidenceCollectorConfig = {
  collectionWindowDays: 7,
  minConfidence: 0.5,
  includeResolved: false,
}

/**
 * EvidenceCollector collects evidence data from the Pixelated platform DB
 * for the reprioritization engine (PIX-1921 / Workstream E).
 */
export class EvidenceCollector {
  private readonly config: EvidenceCollectorConfig

  constructor(config: Partial<EvidenceCollectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Collect clinical alerts (crisis events) from the database.
   * These are automatically tagged with EvidenceSeverity.CRITICAL.
   */
  async collectClinicalAlerts(): Promise<EvidencePoint[]> {
    try {
      logger.info('Collecting clinical alerts', {
        windowDays: this.config.collectionWindowDays,
        minConfidence: this.config.minConfidence,
        includeResolved: this.config.includeResolved,
      })

      const db = await mongodb.connect()
      const cutoffDate = new Date()
      cutoffDate.setDate(
        cutoffDate.getDate() - this.config.collectionWindowDays,
      )

      // Build query for crisis session flags
      const query: Record<string, unknown> = {
        flagged_at: { $gte: cutoffDate.toISOString() },
        confidence: { $gte: this.config.minConfidence },
      }

      // Exclude resolved/dismissed if not configured to include them
      if (!this.config.includeResolved) {
        query['status'] = { $nin: ['resolved', 'dismissed'] }
      }

      // Query the crisis_session_flags collection
      const crisisFlags = await db
        .collection('crisis_session_flags')
        .find(query)
        .sort({ flagged_at: -1 })
        .toArray()

      // Convert crisis flags to EvidencePoint objects
      const evidencePoints: EvidencePoint[] = crisisFlags.map((flag: any) => {
        // Map crisis flag fields to EvidencePoint fields
        const patternId = `crisis-${flag.crisis_id ?? 'unknown'}-${flag.user_id}`
        const patternType = 'crisis_event'
        const description = flag.reason ?? 'Crisis event detected'
        const domain: UpstreamDomain = UpstreamDomain.PRIVACY // Crisis events relate to privacy/safety
        const severity: EvidenceSeverity = EvidenceSeverity.CRITICAL // Always critical for crisis events
        const frequency = Math.min(flag.confidence, 1.0) // Use confidence as frequency proxy
        const confidence = flag.confidence
        const rootCauseHypothesis =
          flag.detected_risks?.length > 0
            ? `Detected risks: ${flag.detected_risks.join(', ')}`
            : 'Unspecified crisis risk'
        const metricsImpacted = ['user_safety', 'session_integrity']
        const timestamp = flag.flagged_at ?? new Date().toISOString()

        return {
          patternId,
          patternType,
          description,
          domain,
          severity,
          frequency,
          confidence,
          rootCauseHypothesis,
          metricsImpacted,
          timestamp,
        }
      })

      logger.info('Clinical alerts collected successfully', {
        count: evidencePoints.length,
      })

      return evidencePoints
    } catch (error) {
      logger.error('Failed to collect clinical alerts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Return empty array on error - no hard failures as per requirements
      return []
    }
  }

  /**
   * Collect interaction frequency data from the database.
   *
   * NOTE: The schema for interaction frequency data could not be confidently
   * determined from existing codebase. This implementation returns an empty
   * array and logs a warning. Schema needs to be confirmed.
   */
  async collectInteractionFrequency(): Promise<EvidencePoint[]> {
    logger.warn(
      'Interaction frequency collection not implemented - schema needs to be confirmed',
      {
        collectionWindowDays: this.config.collectionWindowDays,
      },
    )
    // Return empty array as per requirements when data source schema is unclear
    return []
  }

  /**
   * Collect failure rates data from the database.
   *
   * NOTE: The schema for failure rates data could not be confidently
   * determined from existing codebase. This implementation returns an empty
   * array and logs a warning. Schema needs to be confirmed.
   */
  async collectFailureRates(): Promise<EvidencePoint[]> {
    logger.warn(
      'Failure rates collection not implemented - schema needs to be confirmed',
      {
        collectionWindowDays: this.config.collectionWindowDays,
      },
    )
    // Return empty array as per requirements when data source schema is unclear
    return []
  }

  /**
   * Collect all types of evidence and return them as a single array.
   */
  async collectAll(): Promise<EvidencePoint[]> {
    logger.info('Collecting all evidence types')

    try {
      // Collect all evidence types in parallel
      const [clinicalAlerts, interactionFrequency, failureRates] =
        await Promise.all([
          this.collectClinicalAlerts(),
          this.collectInteractionFrequency(),
          this.collectFailureRates(),
        ])

      // Combine all evidence points
      const allEvidence = [
        ...clinicalAlerts,
        ...interactionFrequency,
        ...failureRates,
      ]

      logger.info('All evidence collected successfully', {
        clinicalAlerts: clinicalAlerts.length,
        interactionFrequency: interactionFrequency.length,
        failureRates: failureRates.length,
        total: allEvidence.length,
      })

      return allEvidence
    } catch (error) {
      logger.error('Failed to collect all evidence', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Return empty array on error - no hard failures
      return []
    }
  }
}

/**
 * Factory function to create an EvidenceCollector with default configuration
 */
export function createEvidenceCollector(
  config: Partial<EvidenceCollectorConfig> = {},
): EvidenceCollector {
  return new EvidenceCollector(config)
}
