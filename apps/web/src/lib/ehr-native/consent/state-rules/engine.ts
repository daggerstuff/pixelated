/**
 * EHR Native — State Consent Rules Engine (F3.3)
 *
 * Runtime consent evaluation engine that applies versioned state consent
 * rules against patient context. Replaces the Phase 1 in-memory registry
 * with a PostgreSQL + Redis-backed system.
 *
 * The engine evaluates:
 * - Minimum consent level (general + treatment-category overrides)
 * - Mental health consent requirements
 * - Substance use disorder consent requirements
 * - Minor parental consent requirements (with exception categories)
 * - Provider type restrictions
 * - Override consent levels
 *
 * @see docs/adr/ADR-007-consent-state-rules.md
 */

import type { ConsentLevel } from '@/lib/research/types/research-types'

import { stateConsentRulesCache } from './cache'
import {
  CONSENT_ORDER,
  DEFAULT_STATE_RULES,
  getStateRules,
  requiresHigherConsent,
  type StateConsentRules,
} from './index'
import type { StateRuleConfig } from './schemas'

// ---------------------------------------------------------------------------
// Patient context — what we know about the patient and treatment
// ---------------------------------------------------------------------------

export interface PatientConsentContext {
  /** Patient's state of residence (e.g., 'CA', 'NY'). */
  stateCode?: string
  /** Patient's age in years. */
  age?: number
  /** The treatment category being requested. */
  treatmentCategory?: string
  /** The provider type requesting treatment. */
  providerType?: string
  /** The patient's tenant ID. */
  tenantId?: string | null
  /** Patient UUID — passed to Phase 1 validateConsent callback. */
  patientId?: string
}

// ---------------------------------------------------------------------------
// Engine result
// ---------------------------------------------------------------------------

export interface ConsentEngineResult {
  /** Whether consent is verified under the state's rules. */
  verified: boolean
  /** The effective consent level after applying state rules. */
  consentLevel: ConsentLevel
  /** The state rules that were applied. */
  stateRules: StateConsentRules
  /** Human-readable reason for the verdict. */
  reason: string
  /** The state code used for evaluation. */
  evaluatedStateCode: string | null
  /** Whether the result came from a tenant-specific or global rule. */
  ruleSource: 'tenant' | 'global' | 'default'
}

// ---------------------------------------------------------------------------
// Treatment categories that have special consent requirements
// ---------------------------------------------------------------------------

export const SPECIAL_TREATMENT_CATEGORIES = {
  mentalHealth: 'mental_health',
  substanceUseDisorder: 'substance_use_disorder',
  reproductiveHealth: 'reproductive_health',
  sexualHealth: 'sexual_health',
  prenatalCare: 'prenatal_care',
} as const

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class StateConsentRulesEngine {
  /**
   * Evaluate consent against state rules for a given patient context.
   *
   * This is the main entry point for runtime consent evaluation.
   * It fetches the active state rule from cache (Redis → DB fallback),
   * applies it to the patient context, and returns a detailed result.
   *
   * @param actualConsentLevel - The patient's current consent level
   * @param requiredConsentLevel - The minimum consent level needed for the operation
   * @param context - Patient context (state, age, treatment category, provider type)
   * @returns Detailed consent evaluation result
   */
  async evaluateConsent(
    actualConsentLevel: ConsentLevel,
    requiredConsentLevel: ConsentLevel,
    context: PatientConsentContext,
  ): Promise<ConsentEngineResult> {
    // 1. Fetch state-specific rules from cache/DB
    const ruleRecord = await stateConsentRulesCache.getActiveRule(
      context.stateCode ?? '',
      context.tenantId,
    )

    let stateRules: StateConsentRules
    let ruleSource: 'tenant' | 'global' | 'default'
    let evaluatedStateCode: string | null

    if (!ruleRecord) {
      // No active rule — use Phase 1 in-memory registry as fallback
      stateRules = getStateRulesFallback(context.stateCode)
      ruleSource = 'default'
      evaluatedStateCode = context.stateCode ?? null
    } else {
      stateRules = this.configToRules(ruleRecord.ruleConfig)
      evaluatedStateCode = ruleRecord.stateCode
      ruleSource = ruleRecord.tenantId ? 'tenant' : 'global'
    }

    // 2. Determine the effective required consent level
    let effectiveRequired = requiredConsentLevel

    // Apply state minimum consent level (elevate if needed)
    if (
      requiresHigherConsent(stateRules.minimumConsentLevel, effectiveRequired)
    ) {
      effectiveRequired = stateRules.minimumConsentLevel
    }

    // Apply override consent level if present
    if (stateRules.overrideConsentLevel) {
      effectiveRequired = stateRules.overrideConsentLevel
    }

    // Apply treatment-category overrides
    if (context.treatmentCategory && ruleRecord) {
      const categoryOverride =
        ruleRecord.ruleConfig.treatmentCategoryOverrides?.[
          context.treatmentCategory
        ]
      if (categoryOverride) {
        if (
          requiresHigherConsent(
            categoryOverride.minimumConsentLevel,
            effectiveRequired,
          )
        ) {
          effectiveRequired = categoryOverride.minimumConsentLevel
        }
        if (categoryOverride.overrideConsentLevel) {
          effectiveRequired = categoryOverride.overrideConsentLevel
        }
      }
    }

    // Apply provider type restrictions
    if (context.providerType && ruleRecord) {
      const providerRestriction =
        ruleRecord.ruleConfig.providerTypeRestrictions?.[context.providerType]
      if (providerRestriction) {
        if (requiresHigherConsent(providerRestriction, effectiveRequired)) {
          effectiveRequired = providerRestriction
        }
      }
    }

    // 3. Check base consent level
    const hasConsent = requiresHigherConsent(
      actualConsentLevel,
      effectiveRequired,
    )

    if (!hasConsent) {
      return {
        verified: false,
        consentLevel: actualConsentLevel,
        stateRules,
        reason: this.buildReason(
          false,
          false,
          false,
          stateRules,
          effectiveRequired,
        ),
        evaluatedStateCode,
        ruleSource,
      }
    }

    // 4. Check treatment-specific consent requirements
    if (
      context.treatmentCategory === SPECIAL_TREATMENT_CATEGORIES.mentalHealth &&
      stateRules.requiresMentalHealthConsent &&
      !requiresHigherConsent(actualConsentLevel, 'limited')
    ) {
      return {
        verified: false,
        consentLevel: actualConsentLevel,
        stateRules,
        reason: `Mental health treatment requires limited consent or higher under ${evaluatedStateCode ?? 'default'} rules`,
        evaluatedStateCode,
        ruleSource,
      }
    }

    if (
      context.treatmentCategory ===
        SPECIAL_TREATMENT_CATEGORIES.substanceUseDisorder &&
      stateRules.requiresSUDConsent &&
      !requiresHigherConsent(actualConsentLevel, 'limited')
    ) {
      return {
        verified: false,
        consentLevel: actualConsentLevel,
        stateRules,
        reason: `Substance use disorder treatment requires limited consent or higher under ${evaluatedStateCode ?? 'default'} rules`,
        evaluatedStateCode,
        ruleSource,
      }
    }

    // 5. Check minor parental consent
    if (
      stateRules.requiresMinorParentalConsent &&
      context.age !== undefined &&
      context.age < stateRules.ageOfMajority
    ) {
      // Check if this treatment category is exempt for minors
      const minorExempt = this.isMinorExempt(
        context.treatmentCategory,
        ruleRecord?.ruleConfig,
      )
      if (!minorExempt) {
        return {
          verified: false,
          consentLevel: actualConsentLevel,
          stateRules,
          reason: `Patient is a minor (age ${context.age}) and parental consent is required under ${evaluatedStateCode ?? 'default'} rules`,
          evaluatedStateCode,
          ruleSource,
        }
      }
    }

    // 6. Apply custom validation callback if present (Phase 1 compatibility)
    if (stateRules.validateConsent) {
      const customResult = stateRules.validateConsent(
        context.patientId ?? '',
        actualConsentLevel,
        context.treatmentCategory,
      )
      if (!customResult) {
        return {
          verified: false,
          consentLevel: actualConsentLevel,
          stateRules,
          reason: `Custom state validation failed for ${evaluatedStateCode ?? 'default'}`,
          evaluatedStateCode,
          ruleSource,
        }
      }
    }

    // 7. All checks passed
    return {
      verified: true,
      consentLevel: actualConsentLevel,
      stateRules,
      reason: this.buildReason(
        true,
        true,
        false,
        stateRules,
        effectiveRequired,
      ),
      evaluatedStateCode,
      ruleSource,
    }
  }

  /**
   * Get the effective consent level required for a state + treatment context.
   * Useful for pre-checking requirements before requesting consent.
   */
  async getEffectiveRequiredLevel(
    requiredConsentLevel: ConsentLevel,
    context: PatientConsentContext,
  ): Promise<ConsentLevel> {
    const ruleRecord = await stateConsentRulesCache.getActiveRule(
      context.stateCode ?? '',
      context.tenantId,
    )

    let stateRules: StateConsentRules
    if (!ruleRecord) {
      stateRules = getStateRulesFallback(context.stateCode)
    } else {
      stateRules = this.configToRules(ruleRecord.ruleConfig)
    }

    let effectiveRequired = requiredConsentLevel

    if (
      requiresHigherConsent(stateRules.minimumConsentLevel, effectiveRequired)
    ) {
      effectiveRequired = stateRules.minimumConsentLevel
    }

    if (stateRules.overrideConsentLevel) {
      effectiveRequired = stateRules.overrideConsentLevel
    }

    if (context.treatmentCategory && ruleRecord) {
      const categoryOverride =
        ruleRecord.ruleConfig.treatmentCategoryOverrides?.[
          context.treatmentCategory
        ]
      if (categoryOverride) {
        if (
          requiresHigherConsent(
            categoryOverride.minimumConsentLevel,
            effectiveRequired,
          )
        ) {
          effectiveRequired = categoryOverride.minimumConsentLevel
        }
        if (categoryOverride.overrideConsentLevel) {
          effectiveRequired = categoryOverride.overrideConsentLevel
        }
      }
    }

    if (context.providerType && ruleRecord) {
      const providerRestriction =
        ruleRecord.ruleConfig.providerTypeRestrictions?.[context.providerType]
      if (
        providerRestriction &&
        requiresHigherConsent(providerRestriction, effectiveRequired)
      ) {
        effectiveRequired = providerRestriction
      }
    }

    return effectiveRequired
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Convert a StateRuleConfig (from DB) to StateConsentRules (runtime interface).
   * Preserves the Phase 1 interface for backward compatibility.
   */
  private configToRules(config: StateRuleConfig): StateConsentRules {
    return {
      minimumConsentLevel: config.minimumConsentLevel,
      overrideConsentLevel: config.overrideConsentLevel,
      requiresMentalHealthConsent: config.requiresMentalHealthConsent,
      requiresSUDConsent: config.requiresSUDConsent,
      requiresMinorParentalConsent: config.requiresMinorParentalConsent,
      ageOfMajority: config.ageOfMajority,
    }
  }

  /**
   * Check if a minor is exempt from parental consent for a treatment category.
   */
  private isMinorExempt(
    treatmentCategory?: string,
    config?: StateRuleConfig,
  ): boolean {
    if (!treatmentCategory || !config?.minorConsentCategories) {
      return false
    }
    return config.minorConsentCategories.some(
      (cat) => cat === treatmentCategory,
    )
  }

  /**
   * Build a human-readable reason string.
   */
  private buildReason(
    verified: boolean,
    hasConsent: boolean,
    expired: boolean,
    rules: StateConsentRules,
    requiredLevel: ConsentLevel,
  ): string {
    if (!hasConsent) {
      return `Insufficient consent: required ${requiredLevel}, state minimum ${rules.minimumConsentLevel}`
    }
    if (expired) {
      return 'Consent has expired'
    }
    if (verified) {
      return `Consent verified at ${requiredLevel} level`
    }
    return 'Consent not verified'
  }
}

// ---------------------------------------------------------------------------
// Fallback to Phase 1 in-memory registry
// ---------------------------------------------------------------------------

/**
 * Get state rules from the Phase 1 in-memory registry as a fallback.
 * This is used when no versioned rule is found in PostgreSQL.
 */
function getStateRulesFallback(stateCode?: string): StateConsentRules {
  // Dynamic import would be ideal, but we're in a sync context.
  // The Phase 1 registry is always available.
  if (stateCode) {
    const normalized = stateCode.toUpperCase()
    // Access the in-memory registry via the exported getStateRules function
    return getStateRulesFromPhase1(normalized)
  }
  return DEFAULT_STATE_RULES
}

/**
 * Helper to get rules from Phase 1 registry.
 * Separated to keep the fallback logic clean.
 */
function getStateRulesFromPhase1(stateCode: string): StateConsentRules {
  // Use the Phase 1 getStateRules which checks the in-memory registry
  return getStateRules(stateCode)
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const stateConsentRulesEngine = new StateConsentRulesEngine()
