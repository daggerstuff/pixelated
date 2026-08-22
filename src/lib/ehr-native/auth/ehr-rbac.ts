/**
 * EHR RBAC Service
 *
 * Consent-aware permission checking with break-glass emergency access.
 * Integrates with the existing audit system (`src/lib/audit.ts`) and
 * consent system (`src/lib/research/services/ConsentManagementService`).
 */

import {
  AuditEventStatus,
  AuditEventType,
  createHIPAACompliantAuditLog,
} from '@/lib/audit'
import type { AuditDetails, AuditLogEntry } from '@/lib/audit'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { consentManagementService } from '@/lib/research/services/ConsentManagementService'
import type { ConsentLevel } from '@/lib/research/types/research-types'

import { roleHasPermission } from './role-permissions'
import type {
  BreakGlassParams,
  BreakGlassResult,
  ClinicalRole,
  EHRPermission,
  EHRPermissionCheckResult,
} from './types'

const logger = createBuildSafeLogger('ehr-rbac')

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
const MINIMUM_CONSENT: Record<EHRPermission, ConsentLevel> = {
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
function consentSatisfies(
  actual: ConsentLevel,
  required: ConsentLevel,
): boolean {
  return CONSENT_ORDER[actual] >= CONSENT_ORDER[required]
}

/**
 * Check if a permission requires consent verification (not bypassed).
 */
function requiresConsentCheck(permission: EHRPermission): boolean {
  return !CONSENT_BYPASS_PERMISSIONS.has(permission)
}

/**
 * Verify that a patient has sufficient consent for a given permission.
 *
 * Delegates to `ConsentManagementService.getConsentLevel()`. Returns `null`
 * when consent is not applicable (bypass permissions), `false` when consent
 * is missing/expired/withdrawn or insufficient, and `true` when consent is
 * active and meets the minimum level.
 *
 * @param patientId - The patient whose consent to verify.
 * @param permission - The permission being exercised.
 * @returns A consent verification result, or `null` if not applicable.
 */
export async function verifyPatientConsent(
  patientId: string,
  permission: EHRPermission,
): Promise<boolean | null> {
  if (!requiresConsentCheck(permission)) {
    return null
  }

  const consentLevel = await consentManagementService.getConsentLevel(patientId)
  if (consentLevel === null) {
    return false
  }

  const required = MINIMUM_CONSENT[permission]
  return consentSatisfies(consentLevel, required)
}

/**
 * Check whether a role has a permission, considering consent.
 *
 * This is the primary entry point for EHR authorization decisions. It:
 * 1. Checks if the role has the permission (including inheritance).
 * 2. If the permission touches patient data, verifies patient consent.
 * 3. Returns a detailed result explaining the decision.
 *
 * @param role - The clinical role of the requesting user.
 * @param permission - The permission being requested.
 * @param patientId - The patient whose data is being accessed (optional for non-patient operations).
 * @returns A detailed permission check result.
 */
export async function checkPermission(
  role: ClinicalRole,
  permission: EHRPermission,
  patientId?: string,
): Promise<EHRPermissionCheckResult> {
  // Step 1: Role-based permission check
  if (!roleHasPermission(role, permission)) {
    logger.debug('Permission denied by role check', {
      role,
      permission,
    })
    return {
      granted: false,
      permission,
      role,
      reason: `Role '${role}' does not have permission '${permission}'`,
      breakGlassActivated: false,
      consentVerified: null,
    }
  }

  // Step 2: Consent check (only if patient context is provided)
  let consentVerified: boolean | null = null

  if (patientId !== undefined) {
    consentVerified = await verifyPatientConsent(patientId, permission)

    if (consentVerified === false) {
      logger.debug('Permission denied by consent check', {
        role,
        permission,
        patientId,
      })
      return {
        granted: false,
        permission,
        role,
        reason:
          'Patient consent is missing, expired, withdrawn, or insufficient for this operation',
        breakGlassActivated: false,
        consentVerified: false,
      }
    }
  }

  // Permission granted
  return {
    granted: true,
    permission,
    role,
    reason: 'Permission granted',
    breakGlassActivated: false,
    consentVerified,
  }
}

/**
 * Activate break-glass access for emergency clinical data access.
 *
 * Break-glass bypasses consent restrictions for emergency clinical access
 * but:
 * - Requires the role to have the `break_glass` permission.
 * - Requires a documented reason.
 * - Creates a mandatory HIPAA audit log entry.
 * - Grants only the specific permission requested for the specific patient.
 *
 * @param params - Break-glass request parameters.
 * @returns Result indicating whether access was granted and the audit log ID.
 */
export async function activateBreakGlass(
  params: BreakGlassParams,
): Promise<BreakGlassResult> {
  const { userId, role, patientId, permission, reason, organizationId } = params

  // Validate that the role has break_glass permission
  if (!roleHasPermission(role, 'break_glass')) {
    logger.warn('Break-glass denied — role lacks break_glass permission', {
      userId,
      role,
      patientId,
      permission,
    })

    // Log the denied attempt
    const deniedLog = await createAuditEntry({
      userId,
      action: 'break_glass_denied',
      resource: 'ehr_break_glass',
      eventType: AuditEventType.SECURITY,
      status: AuditEventStatus.BLOCKED,
      userRole: role,
      patientId,
      organizationId,
      details: {
        requestedPermission: permission,
        reason,
        denialReason: 'Role does not have break_glass permission',
      },
    })

    return {
      granted: false,
      reason: `Role '${role}' does not have break_glass permission`,
      auditLogId: deniedLog.id,
    }
  }

  // Validate that the role has the requested permission
  // Break-glass overrides consent, not role-based access
  if (!roleHasPermission(role, permission)) {
    logger.warn('Break-glass denied — role lacks requested permission', {
      userId,
      role,
      patientId,
      permission,
    })

    const deniedLog = await createAuditEntry({
      userId,
      action: 'break_glass_denied',
      resource: 'ehr_break_glass',
      eventType: AuditEventType.SECURITY,
      status: AuditEventStatus.BLOCKED,
      userRole: role,
      patientId,
      organizationId,
      details: {
        requestedPermission: permission,
        reason,
        denialReason: 'Role does not have the requested permission',
      },
    })

    return {
      granted: false,
      reason: `Role '${role}' does not have the requested permission '${permission}'`,
      auditLogId: deniedLog.id,
    }
  }

  // Validate that a reason was provided
  if (!reason || reason.trim().length === 0) {
    logger.warn('Break-glass denied — no reason provided', {
      userId,
      role,
      patientId,
      permission,
    })

    const deniedLog = await createAuditEntry({
      userId,
      action: 'break_glass_denied',
      resource: 'ehr_break_glass',
      eventType: AuditEventType.SECURITY,
      status: AuditEventStatus.BLOCKED,
      userRole: role,
      patientId,
      organizationId,
      details: {
        requestedPermission: permission,
        denialReason: 'No clinical justification provided',
      },
    })

    return {
      granted: false,
      reason:
        'A clinical justification reason is required for break-glass access',
      auditLogId: deniedLog.id,
    }
  }

  // Grant break-glass access and log it
  const auditLog = await createAuditEntry({
    userId,
    action: 'break_glass_access',
    resource: 'ehr_break_glass',
    eventType: AuditEventType.ACCESS,
    status: AuditEventStatus.WARNING,
    userRole: role,
    patientId,
    organizationId,
    details: {
      requestedPermission: permission,
      reason,
      consentBypassed: true,
    },
    notes: `Break-glass: ${permission} for patient ${patientId}. Reason: ${reason}`,
  })

  logger.warn('Break-glass access granted', {
    userId,
    role,
    patientId,
    permission,
    auditLogId: auditLog.id,
  })

  return {
    granted: true,
    reason: 'Break-glass access granted with audit trail',
    auditLogId: auditLog.id,
  }
}

/**
 * Check permission with break-glass fallback.
 *
 * First attempts a normal consent-aware permission check. If denied due to
 * consent, and the caller provides break-glass params, attempts break-glass.
 *
 * @param role - The clinical role of the requesting user.
 * @param permission - The permission being requested.
 * @param patientId - The patient whose data is being accessed.
 * @param breakGlassParams - Optional parameters for break-glass fallback.
 * @returns A detailed permission check result, potentially with break-glass activated.
 */
export async function checkPermissionWithBreakGlass(
  role: ClinicalRole,
  permission: EHRPermission,
  patientId: string,
  breakGlassParams?: Omit<
    BreakGlassParams,
    'role' | 'patientId' | 'permission'
  >,
): Promise<EHRPermissionCheckResult> {
  const baseCheck = await checkPermission(role, permission, patientId)

  if (baseCheck.granted) {
    return baseCheck
  }

  // If denied due to consent and break-glass params provided, try break-glass
  if (
    breakGlassParams?.userId !== undefined &&
    baseCheck.consentVerified === false
  ) {
    const bgResult = await activateBreakGlass({
      userId: breakGlassParams.userId,
      role,
      patientId,
      permission,
      reason: breakGlassParams.reason,
      ...(breakGlassParams.organizationId !== undefined
        ? { organizationId: breakGlassParams.organizationId }
        : {}),
    })

    if (bgResult.granted) {
      return {
        granted: true,
        permission,
        role,
        reason: bgResult.reason,
        breakGlassActivated: true,
        consentVerified: false,
      }
    }
  }

  return baseCheck
}

/**
 * Log an access attempt to the HIPAA-compliant audit trail.
 *
 * This is the integration point with `src/lib/audit.ts`. Every permission
 * check that touches patient data should be logged here.
 *
 * @param params - Audit log parameters.
 * @returns The created audit log entry.
 */
export async function logEHRAccess(params: {
  userId: string
  action: string
  resource: string
  role: ClinicalRole
  permission: EHRPermission
  patientId?: string
  organizationId?: string
  granted: boolean
  reason?: string
}): Promise<AuditLogEntry> {
  const {
    userId,
    action,
    resource,
    role,
    permission,
    patientId,
    organizationId,
    granted,
    reason,
  } = params

  return createHIPAACompliantAuditLog({
    userId,
    action,
    resource,
    eventType: granted ? AuditEventType.ACCESS : AuditEventType.ACCESS_DENIED,
    status: granted ? AuditEventStatus.SUCCESS : AuditEventStatus.BLOCKED,
    userRole: role,
    ...(patientId !== undefined ? { patientId } : {}),
    ...(organizationId !== undefined ? { organizationId } : {}),
    details: {
      permission,
      ...(reason !== undefined ? { reason } : {}),
    },
  })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Create an audit log entry with conditional optional fields.
 * Uses conditional spread to satisfy `exactOptionalPropertyTypes`.
 */
async function createAuditEntry(params: {
  userId: string
  action: string
  resource: string
  eventType: AuditEventType
  status: AuditEventStatus
  userRole: ClinicalRole
  patientId: string
  organizationId?: string
  details: AuditDetails
  notes?: string
}): Promise<AuditLogEntry> {
  return createHIPAACompliantAuditLog({
    userId: params.userId,
    action: params.action,
    resource: params.resource,
    eventType: params.eventType,
    status: params.status,
    userRole: params.userRole,
    patientId: params.patientId,
    ...(params.organizationId !== undefined
      ? { organizationId: params.organizationId }
      : {}),
    details: params.details,
    ...(params.notes !== undefined ? { notes: params.notes } : {}),
  })
}
