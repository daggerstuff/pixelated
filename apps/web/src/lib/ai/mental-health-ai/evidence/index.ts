/**
 * Evidence Module Exports
 *
 * This module provides comprehensive evidence extraction capabilities
 * for mental health analysis using the MentalHealthAI system.
 */

export { EvidenceExtractor } from './EvidenceExtractor'
export {
  EvidenceService,
  createEvidenceService,
  evidenceToStringArray,
} from './EvidenceService'

export type {
  EvidenceItem,
  EvidenceExtractionConfig,
  EvidenceExtractionResult,
} from './EvidenceExtractor'

export type { EvidenceServiceConfig } from './EvidenceService'
