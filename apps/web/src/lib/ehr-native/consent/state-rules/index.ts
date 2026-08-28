/**
 * EHR Native — Consent State Rules (F1.4 + F3.3)
 *
 * Phase 1: in-memory default ruleset (DEFAULT_STATE_RULES) + override hook.
 * Used as the fallback when no Phase 3 versioned rule exists.
 *
 * Phase 3: per-state rules with legal sign-off, stored as versioned JSONB
 * in PostgreSQL (ehr_state_consent_rules) with Redis caching.
 * See ./engine.ts for the runtime evaluator and ./repository.ts for persistence.
 */

import type { ConsentLevel } from '@/lib/research/types/research-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Consent rules for a U.S. state jurisdiction.
 *
 * Each field represents a regulatory constraint that the ConsentService applies
 * on top of the baseline `ehr_patient_has_consent` SQL function check.
 */
export interface StateConsentRules {
  /** Minimum consent level required for general treatment. */
  readonly minimumConsentLevel: ConsentLevel
  /** Optional elevated consent level that overrides the minimum for specific operations. */
  readonly overrideConsentLevel?: ConsentLevel
  /** Whether mental health treatment requires separate/explicit consent. */
  readonly requiresMentalHealthConsent: boolean
  /** Whether substance use disorder treatment requires separate/explicit consent. */
  readonly requiresSUDConsent: boolean
  /** Whether minors need parental consent. */
  readonly requiresMinorParentalConsent: boolean
  /** The age at which a patient is considered an adult for consent purposes. */
  readonly ageOfMajority: number
  /** Optional callback for custom state-specific validation logic. */
  readonly validateConsent?: (
    patientId: string,
    consentLevel: ConsentLevel,
    treatmentCategory?: string,
  ) => boolean
}

// ---------------------------------------------------------------------------
// Consent level ordering (mirrors the SQL function ehr_patient_has_consent)
// ---------------------------------------------------------------------------

export const CONSENT_ORDER: Record<ConsentLevel, number> = {
  none: 0,
  minimal: 1,
  limited: 2,
  full: 3,
}

/**
 * Check if a consent level meets or exceeds a required minimum.
 * Uses the same ranking as the `ehr_patient_has_consent` SQL function.
 */
export function requiresHigherConsent(
  actual: ConsentLevel,
  required: ConsentLevel,
): boolean {
  return CONSENT_ORDER[actual] >= CONSENT_ORDER[required]
}

// ---------------------------------------------------------------------------
// Default ruleset (most conservative common denominator)
// ---------------------------------------------------------------------------

export const DEFAULT_STATE_RULES: StateConsentRules = {
  minimumConsentLevel: 'minimal',
  requiresMentalHealthConsent: true,
  requiresSUDConsent: true,
  requiresMinorParentalConsent: true,
  ageOfMajority: 18,
}

// ---------------------------------------------------------------------------
// State rules registry
// ---------------------------------------------------------------------------

const stateRulesRegistry = new Map<string, StateConsentRules>()

/**
 * Get the consent rules for a given state code.
 * Falls back to DEFAULT_STATE_RULES if no override is registered.
 *
 * @param stateCode - U.S. state code (e.g., 'CA', 'NY'). Case-insensitive.
 * @returns The state-specific rules or the default ruleset.
 */
export function getStateRules(stateCode?: string): StateConsentRules {
  if (!stateCode) {
    return DEFAULT_STATE_RULES
  }
  const normalized = stateCode.toUpperCase()
  return stateRulesRegistry.get(normalized) ?? DEFAULT_STATE_RULES
}

/**
 * Register state-specific consent rules, overriding the default ruleset.
 *
 * @param stateCode - U.S. state code (e.g., 'CA', 'NY'). Case-insensitive.
 * @param rules - The state-specific rules to register.
 */
export function registerStateRules(
  stateCode: string,
  rules: StateConsentRules,
): void {
  const normalized = stateCode.toUpperCase()
  stateRulesRegistry.set(normalized, rules)
}

/**
 * Clear all registered state rules, reverting to the default ruleset.
 * Primarily used for testing.
 */
export function clearStateRules(): void {
  stateRulesRegistry.clear()
}
