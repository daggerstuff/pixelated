/**
 * EHR Native — Consent Service (F1.4)
 *
 * Business-logic layer over ConsentRepository.
 * Integrates with the SQL function `ehr_patient_has_consent` and
 * state-specific consent rules (state-rules module).
 *
 * Phase 3: delegates state-rule evaluation to StateConsentRulesEngine,
 * which reads versioned, legally-approved rules from PostgreSQL (cached
 * in Redis) and falls back to Phase 1 in-memory defaults when no versioned
 * rule exists.
 *
 * @see ./state-rules/engine.ts (Phase 3 runtime evaluator)
 * @see ./state-rules/index.ts (Phase 1 in-memory fallback)
 */

import { query } from '@/lib/db'
import type { ConsentLevel } from '@/lib/research/types/research-types'

import type { Consent } from '../types/consent'
import {
  ConsentRepository,
  type ConsentRow,
  type CreateConsentInput,
} from './repository'
import { type StateConsentRules } from './state-rules'
import {
  stateConsentRulesEngine,
  type PatientConsentContext,
} from './state-rules/engine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsentVerificationResult {
  /** Whether consent is sufficient for the requested operation. */
  readonly verified: boolean
  /** The effective consent level of the patient. */
  readonly consentLevel: ConsentLevel
  /** Whether the consent has expired. */
  readonly expired: boolean
  /** State rules applied during verification (if stateCode was provided). */
  readonly stateRules?: StateConsentRules
  /** Reason for the verification outcome. */
  readonly reason: string
}

export interface CreateConsentOptions {
  tenantId: string
  patientId: string
  consentLevel: ConsentLevel
  scope?: string
  category?: string
  periodStart?: string
  periodEnd?: string
  fhirResource: Consent
}

// ---------------------------------------------------------------------------
// Consent Service
// ---------------------------------------------------------------------------

export class ConsentService {
  private readonly repository: ConsentRepository

  constructor(repository?: ConsentRepository) {
    this.repository = repository ?? new ConsentRepository()
  }

  /**
   * Verify whether a patient has sufficient consent for a given operation.
   *
   * Uses the SQL function `ehr_patient_has_consent` for the baseline check,
   * then applies state-specific rules (if `stateCode` is provided) that can
   * elevate but not lower the required consent level.
   *
   * @param patientId - UUID of the patient
   * @param tenantId - UUID of the tenant
   * @param minimumLevel - Minimum consent level required
   * @param stateCode - Optional U.S. state code for state-specific rules
   * @param treatmentCategory - Optional treatment category for state rules validation
   */
  async verifyConsent(
    patientId: string,
    tenantId: string,
    minimumLevel: ConsentLevel,
    stateCode?: string,
    treatmentCategory?: string,
  ): Promise<ConsentVerificationResult> {
    // Phase 1: delegate baseline check to SQL function (returns boolean)
    const sqlResult = await query<{ ehr_patient_has_consent: boolean }>(
      `SELECT ehr_patient_has_consent($1, $2, $3)`,
      [patientId, tenantId, minimumLevel],
    )
    const hasConsent = Boolean(sqlResult.rows[0]?.['ehr_patient_has_consent'])

    // Get consent level from the active consent record
    const activeConsent = await this.repository.getActiveByPatient(
      patientId,
      tenantId,
    )
    const dbConsentLevel = (activeConsent?.consent_level ??
      'none') as ConsentLevel
    const expired = this.isConsentExpired(activeConsent)

    // Apply state rules via Phase 3 engine (falls back to Phase 1 in-memory)
    let stateRules: StateConsentRules | undefined
    let stateRulesPass = true

    if (stateCode) {
      const context: PatientConsentContext = {
        stateCode,
        treatmentCategory,
        tenantId,
        patientId,
      }

      const engineResult = await stateConsentRulesEngine.evaluateConsent(
        dbConsentLevel,
        minimumLevel,
        context,
      )
      stateRules = engineResult.stateRules
      stateRulesPass = engineResult.verified
    }

    const verified = hasConsent && !expired && stateRulesPass

    return {
      verified,
      consentLevel: dbConsentLevel,
      expired,
      stateRules,
      reason: this.buildReason(verified, hasConsent, expired, stateRulesPass),
    }
  }

  /**
   * Get the effective consent level for a patient.
   * Returns 'none' if no active consent exists.
   */
  async getEffectiveConsentLevel(
    patientId: string,
    tenantId: string,
  ): Promise<ConsentLevel> {
    const activeConsent = await this.repository.getActiveByPatient(
      patientId,
      tenantId,
    )
    if (!activeConsent || this.isConsentExpired(activeConsent)) {
      return 'none'
    }
    return activeConsent.consent_level as ConsentLevel
  }

  /**
   * Create a new consent record.
   */
  async createConsent(options: CreateConsentOptions): Promise<ConsentRow> {
    const input: CreateConsentInput = {
      tenantId: options.tenantId,
      patientId: options.patientId,
      consentLevel: options.consentLevel,
      scope: options.scope,
      category: options.category,
      periodStart: options.periodStart,
      periodEnd: options.periodEnd,
      fhirResource: options.fhirResource,
    }
    return this.repository.create(input)
  }

  /**
   * Revoke (mark inactive) a consent record.
   */
  async revokeConsent(
    consentId: string,
    tenantId: string,
  ): Promise<ConsentRow | null> {
    return this.repository.revoke(consentId, tenantId)
  }

  /**
   * Get the active consent record for a patient.
   */
  async getActiveConsent(
    patientId: string,
    tenantId: string,
  ): Promise<ConsentRow | null> {
    return this.repository.getActiveByPatient(patientId, tenantId)
  }

  /**
   * Check if a consent record has expired based on period_end.
   */
  private isConsentExpired(consent: ConsentRow | null): boolean {
    if (!consent) return true
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Check period_start — consent not yet in effect
    if (consent.period_start) {
      const periodStart = new Date(consent.period_start)
      if (periodStart > today) return true
    }
    // Check period_end — consent has expired
    if (!consent.period_end) return false
    const periodEnd = new Date(consent.period_end)
    return periodEnd < today
  }

  /**
   * Build a human-readable reason string for the verification result.
   */
  private buildReason(
    verified: boolean,
    hasConsent: boolean,
    expired: boolean,
    stateRulesPass: boolean,
  ): string {
    if (verified) return 'Consent verified'
    if (!hasConsent) return 'No active consent record found'
    if (expired) return 'Consent has expired'
    if (!stateRulesPass) return 'State-specific consent requirements not met'
    return 'Consent verification failed'
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

export const consentService = new ConsentService()
