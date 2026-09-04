import type { ConsentLevel } from '@/lib/research/types/research-types'
import type { EHRPermission } from './types'

/**
 * Permissions that bypass consent checks.
 *
 * These are administrative or emergency operations that must be allowed
 * regardless of patient consent status (though break_glass itself requires
 * its own audit trail).
 */
const CONSENT_BYPASS_PERMISSIONS: ReadonlySet<EHRPermission> = new Set([
  'break_glass',
  'audit_access',
  'manage_consent',
  'manage_schedule',
  'read_schedule',
])

/**
 * Minimum consent level required for clinical data permissions.
 *
 * Most clinical read/write operations require at least `'minimal'` consent.
 * Export operations require `'full'` consent (unless break-glass is used).
 */
export const MINIMUM_CONSENT: Record<EHRPermission, ConsentLevel> = {
  read_patient: 'minimal',
  write_patient: 'minimal',
  read_encounter: 'minimal',
  write_encounter: 'minimal',
  read_observation: 'minimal',
  write_observation: 'minimal',
  read_condition: 'minimal',
  write_condition: 'minimal',
  read_medication: 'minimal',
  write_medication: 'minimal',
  read_procedure: 'minimal',
  write_procedure: 'minimal',
  read_clinical_note: 'minimal',
  write_clinical_note: 'limited',
  sign_clinical_note: 'limited',
  cosign_clinical_note: 'limited',
  read_schedule: 'none',
  manage_schedule: 'none',
  read_claim: 'minimal',
  submit_claim: 'minimal',
  adjudicate_claim: 'minimal',
  manage_consent: 'none',
  break_glass: 'none',
  export_phi: 'full',
  audit_access: 'none',
}

/**
 * Consent level ordering for comparison.
 */
const CONSENT_ORDER: Record<ConsentLevel, number> = {
  none: 0,
  minimal: 1,
  limited: 2,
  full: 3,
}

/**
 * Check if a consent level meets or exceeds a required minimum.
 */
export function consentSatisfies(
  actual: ConsentLevel,
  required: ConsentLevel,
): boolean {
  return CONSENT_ORDER[actual] >= CONSENT_ORDER[required]
}

/**
 * Check if a permission requires consent verification (not bypassed).
 */
export function requiresConsentCheck(permission: EHRPermission): boolean {
  return !CONSENT_BYPASS_PERMISSIONS.has(permission)
}
