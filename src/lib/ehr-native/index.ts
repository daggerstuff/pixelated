/**
 * EHR Native Module — barrel export
 *
 * In-house EHR module add-on for Pixelated Empathy.
 * Provides clinical charting, scheduling, claims tracking, consent management,
 * and telehealth integration as a native module (not an external EHR integration).
 *
 * @see docs/plans/ehr-module-build-plan.md
 * @see docs/adr/ADR-002-fhir-r4-canonical.md
 */

// Type system (F1.0)
export type {} from './types'

// Consent engine (F1.4)
export {
  ConsentRepository,
  ConsentService,
  consentService,
  DEFAULT_STATE_RULES,
  getStateRules,
  registerStateRules,
  clearStateRules,
  requiresHigherConsent,
  type ConsentRow,
  type CreateConsentInput,
  type UpdateConsentInput,
  type ConsentVerificationResult,
  type CreateConsentOptions,
  type StateConsentRules,
} from './consent'
