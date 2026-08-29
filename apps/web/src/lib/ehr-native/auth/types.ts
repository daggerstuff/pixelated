/**
 * EHR-Native RBAC Types
 *
 * Clinical role and permission definitions for the EHR-specific
 * authorization system. This module extends (not replaces) the existing
 * platform RBAC in `src/lib/auth/` with clinical-domain permissions.
 */

/**
 * Clinical roles recognized by the EHR RBAC system.
 *
 * These are EHR-specific and orthogonal to the platform-level `UserRole`
 * defined in `src/lib/auth/roles.ts`. A user may hold both a platform role
 * (e.g. `'therapist'`) and a clinical role (e.g. `'physician'`); the EHR
 * service uses the clinical role for clinical permission decisions.
 */
export type ClinicalRole =
  | 'physician'
  | 'nurse'
  | 'pharmacist'
  | 'medicalAssistant'
  | 'technician'
  | 'therapist'
  | 'supervisor'
  | 'socialWorker'
  | 'careCoordinator'
  | 'frontDesk'
  | 'billingSpecialist'
  | 'complianceOfficer'
  | 'healthInformationManager'
  | 'systemAdmin'

/**
 * Runtime list of all clinical roles — useful for iteration and validation.
 */
const CLINICAL_ROLES: readonly ClinicalRole[] = [
  'physician',
  'nurse',
  'pharmacist',
  'medicalAssistant',
  'technician',
  'therapist',
  'supervisor',
  'socialWorker',
  'careCoordinator',
  'frontDesk',
  'billingSpecialist',
  'complianceOfficer',
  'healthInformationManager',
  'systemAdmin',
] as const

/**
 * EHR-specific permissions governing access to clinical resources.
 *
 * Naming convention: `<verb>_<resource>` where verb is read/write/sign/etc.
 * and resource is the FHIR-inspired clinical entity.
 */
export type EHRPermission =
  | 'read_patient'
  | 'write_patient'
  | 'read_encounter'
  | 'write_encounter'
  | 'read_observation'
  | 'write_observation'
  | 'read_condition'
  | 'write_condition'
  | 'read_medication'
  | 'write_medication'
  | 'read_procedure'
  | 'write_procedure'
  | 'read_clinical_note'
  | 'write_clinical_note'
  | 'sign_clinical_note'
  | 'cosign_clinical_note'
  | 'read_schedule'
  | 'manage_schedule'
  | 'read_claim'
  | 'submit_claim'
  | 'adjudicate_claim'
  | 'manage_consent'
  | 'break_glass'
  | 'export_phi'
  | 'audit_access'

/**
 * Runtime list of all EHR permissions.
 */
const EHR_PERMISSIONS: readonly EHRPermission[] = [
  'read_patient',
  'write_patient',
  'read_encounter',
  'write_encounter',
  'read_observation',
  'write_observation',
  'read_condition',
  'write_condition',
  'read_medication',
  'write_medication',
  'read_procedure',
  'write_procedure',
  'read_clinical_note',
  'write_clinical_note',
  'sign_clinical_note',
  'cosign_clinical_note',
  'read_schedule',
  'manage_schedule',
  'read_claim',
  'submit_claim',
  'adjudicate_claim',
  'manage_consent',
  'break_glass',
  'export_phi',
  'audit_access',
] as const

/**
 * Functional category of a permission, used for audit and UI grouping.
 */
export type EHRPermissionCategory =
  | 'patient_data'
  | 'clinical_data'
  | 'clinical_notes'
  | 'scheduling'
  | 'billing'
  | 'consent'
  | 'emergency'
  | 'administration'

/**
 * Metadata describing a single EHR permission.
 */
export interface EHRPermissionDefinition {
  readonly name: EHRPermission
  readonly description: string
  readonly category: EHRPermissionCategory
  /** Whether exercising this permission must be recorded in the audit trail. */
  readonly auditRequired: boolean
  /** Whether the permission requires MFA before being exercised. */
  readonly requiresMFA: boolean
}

/**
 * Metadata describing a clinical role.
 */
export interface ClinicalRoleDefinition {
  readonly name: ClinicalRole
  readonly displayName: string
  readonly description: string
  /**
   * Hierarchy level — higher means more authority. NOT used to compute
   * permission inheritance. Permission inheritance is defined explicitly
   * via the `inherits` arrays in `CLINICAL_ROLE_DEFINITIONS` and implemented
   * in `role-permissions.ts`. `hierarchyLevel` is for secondary concerns
   * such as sorting, display ordering, or UI grouping.
   */
  readonly hierarchyLevel: number
  /** Permissions explicitly granted to this role. */
  readonly permissions: readonly EHRPermission[]
  /** Roles whose permissions this role inherits. */
  readonly inherits: readonly ClinicalRole[]
}

/**
 * Result of a permission check.
 */
export interface EHRPermissionCheckResult {
  readonly granted: boolean
  readonly permission: EHRPermission
  readonly role: ClinicalRole
  readonly reason: string
  /** Whether the check involved a break-glass override. */
  readonly breakGlassActivated: boolean
  /** Whether patient consent was verified (null if not applicable). */
  readonly consentVerified: boolean | null
}

/**
 * Parameters for a break-glass access request.
 */
export interface BreakGlassParams {
  readonly userId: string
  readonly role: ClinicalRole
  readonly patientId: string
  readonly permission: EHRPermission
  readonly reason: string
  /** Optional organization context. */
  readonly organizationId?: string
}

/**
 * Result of a break-glass access attempt.
 */
export interface BreakGlassResult {
  readonly granted: boolean
  readonly reason: string
  /** Unique ID of the audit log entry created for this break-glass event. */
  readonly auditLogId: string
}

/**
 * A type guard checking that a string is a valid `ClinicalRole`.
 */
function isClinicalRole(value: string): value is ClinicalRole {
  return (CLINICAL_ROLES as readonly string[]).includes(value)
}

/**
 * A type guard checking that a string is a valid `EHRPermission`.
 */
function isEHRPermission(value: string): value is EHRPermission {
  return (EHR_PERMISSIONS as readonly string[]).includes(value)
}
