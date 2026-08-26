export { PiiRedactor, piiRedactor } from './pii-redactor'
export type { PiiRedactionResult, PiiGateEvaluation } from './pii-redactor'

export { CrisisDetector, crisisDetector } from './crisis-detector'
export type { CrisisDetectionResult, CrisisTier } from './crisis-detector'

export { TraumaFilter, traumaFilter } from './trauma-filter'
export type { TraumaFilterResult, TraumaSeverity } from './trauma-filter'

export { ConsentGate, consentGate } from './consent-gate'
export type {
  ConsentRecord,
  ConsentAuditEntry,
  ConsentGateResult,
  ConsentGateValue,
} from './consent-gate'
