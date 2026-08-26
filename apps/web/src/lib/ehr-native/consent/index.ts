/**
 * EHR Native — Consent Engine (F1.4)
 *
 * Per-treatment-type consent records using FHIR Consent resource.
 * Provides ConsentRepository, ConsentService, and State Rules module.
 *
 * Phase 1: single configurable ruleset + per-state override hook
 * Phase 3: per-state rules with legal sign-off (versioned JSON config)
 *
 * @see docs/adr/ADR-007-consent-state-rules.md
 */

export {
  ConsentRepository,
  type ConsentRow,
  type CreateConsentInput,
  type UpdateConsentInput,
} from './repository'

export {
  ConsentService,
  consentService,
  type ConsentVerificationResult,
  type CreateConsentOptions,
} from './service'

export {
  DEFAULT_STATE_RULES,
  CONSENT_ORDER,
  getStateRules,
  registerStateRules,
  clearStateRules,
  requiresHigherConsent,
  type StateConsentRules,
} from './state-rules'
