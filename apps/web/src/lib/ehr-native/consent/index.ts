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

// Phase 3: Versioned state consent rules with legal sign-off
export {
  StateConsentRulesRepository,
  stateConsentRulesRepository,
  type StateConsentRuleRow,
  type StateRuleAuditRow,
  type ActorContext,
} from './state-rules/repository'

export {
  StateConsentRulesCache,
  stateConsentRulesCache,
} from './state-rules/cache'

export {
  StateConsentRulesEngine,
  stateConsentRulesEngine,
  type PatientConsentContext,
  type ConsentEngineResult,
} from './state-rules/engine'

export {
  StateRuleConfigSchema,
  type StateRuleConfig,
  type CreateStateRuleInput,
  type UpdateStateRuleInput,
  validateStateRuleConfig,
  safeValidateStateRuleConfig,
} from './state-rules/schemas'
