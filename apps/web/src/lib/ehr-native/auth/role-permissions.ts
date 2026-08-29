/**
 * EHR Role-Permission Matrix
 *
 * Defines the base permissions for each clinical role and implements
 * role-inheritance so that higher-level roles automatically gain the
 * permissions of roles they inherit from.
 */

import type {
  ClinicalRole,
  EHRPermission,
  EHRPermissionCategory,
  EHRPermissionDefinition,
  ClinicalRoleDefinition,
} from './types'

/**
 * Permission metadata — descriptions, categories, audit/MFA requirements.
 */
export const EHR_PERMISSION_DEFINITIONS: Record<
  EHRPermission,
  EHRPermissionDefinition
> = {
  read_patient: {
    name: 'read_patient',
    description: 'View patient demographic and contact information',
    category: 'patient_data',
    auditRequired: true,
    requiresMFA: false,
  },
  write_patient: {
    name: 'write_patient',
    description: 'Create or modify patient demographic information',
    category: 'patient_data',
    auditRequired: true,
    requiresMFA: true,
  },
  read_encounter: {
    name: 'read_encounter',
    description: 'View encounter/visit records',
    category: 'clinical_data',
    auditRequired: true,
    requiresMFA: false,
  },
  write_encounter: {
    name: 'write_encounter',
    description: 'Create or modify encounter records',
    category: 'clinical_data',
    auditRequired: true,
    requiresMFA: true,
  },
  read_observation: {
    name: 'read_observation',
    description: 'View clinical observations (vitals, lab results)',
    category: 'clinical_data',
    auditRequired: true,
    requiresMFA: false,
  },
  write_observation: {
    name: 'write_observation',
    description: 'Record clinical observations',
    category: 'clinical_data',
    auditRequired: true,
    requiresMFA: true,
  },
  read_condition: {
    name: 'read_condition',
    description: 'View patient conditions/diagnoses',
    category: 'clinical_data',
    auditRequired: true,
    requiresMFA: false,
  },
  write_condition: {
    name: 'write_condition',
    description: 'Create or modify patient conditions/diagnoses',
    category: 'clinical_data',
    auditRequired: true,
    requiresMFA: true,
  },
  read_medication: {
    name: 'read_medication',
    description: 'View medication orders and administration records',
    category: 'clinical_data',
    auditRequired: true,
    requiresMFA: false,
  },
  write_medication: {
    name: 'write_medication',
    description: 'Create or modify medication orders',
    category: 'clinical_data',
    auditRequired: true,
    requiresMFA: true,
  },
  read_procedure: {
    name: 'read_procedure',
    description: 'View procedure records',
    category: 'clinical_data',
    auditRequired: true,
    requiresMFA: false,
  },
  write_procedure: {
    name: 'write_procedure',
    description: 'Create or modify procedure records',
    category: 'clinical_data',
    auditRequired: true,
    requiresMFA: true,
  },
  read_clinical_note: {
    name: 'read_clinical_note',
    description: 'View clinical notes and documentation',
    category: 'clinical_notes',
    auditRequired: true,
    requiresMFA: false,
  },
  write_clinical_note: {
    name: 'write_clinical_note',
    description: 'Create or edit clinical notes',
    category: 'clinical_notes',
    auditRequired: true,
    requiresMFA: true,
  },
  sign_clinical_note: {
    name: 'sign_clinical_note',
    description: 'Sign and authenticate clinical notes',
    category: 'clinical_notes',
    auditRequired: true,
    requiresMFA: true,
  },
  cosign_clinical_note: {
    name: 'cosign_clinical_note',
    description: 'Co-sign clinical notes (e.g. for trainee supervision)',
    category: 'clinical_notes',
    auditRequired: true,
    requiresMFA: true,
  },
  read_schedule: {
    name: 'read_schedule',
    description: 'View appointment schedules',
    category: 'scheduling',
    auditRequired: false,
    requiresMFA: false,
  },
  manage_schedule: {
    name: 'manage_schedule',
    description: 'Create, modify, or cancel appointments',
    category: 'scheduling',
    auditRequired: true,
    requiresMFA: false,
  },
  read_claim: {
    name: 'read_claim',
    description: 'View insurance claims and billing records',
    category: 'billing',
    auditRequired: true,
    requiresMFA: false,
  },
  submit_claim: {
    name: 'submit_claim',
    description: 'Submit insurance claims',
    category: 'billing',
    auditRequired: true,
    requiresMFA: false,
  },
  adjudicate_claim: {
    name: 'adjudicate_claim',
    description: 'Review and adjudicate insurance claims',
    category: 'billing',
    auditRequired: true,
    requiresMFA: true,
  },
  manage_consent: {
    name: 'manage_consent',
    description: 'Manage patient consent records and preferences',
    category: 'consent',
    auditRequired: true,
    requiresMFA: true,
  },
  break_glass: {
    name: 'break_glass',
    description:
      'Emergency access to patient data that bypasses consent restrictions, with mandatory audit',
    category: 'emergency',
    auditRequired: true,
    requiresMFA: true,
  },
  export_phi: {
    name: 'export_phi',
    description: 'Export protected health information outside the system',
    category: 'administration',
    auditRequired: true,
    requiresMFA: true,
  },
  audit_access: {
    name: 'audit_access',
    description: 'Access and review audit logs and access trails',
    category: 'administration',
    auditRequired: true,
    requiresMFA: true,
  },
}

/**
 * Base role definitions with explicit permissions and inheritance.
 *
 * Inheritance is transitive: if A inherits from B and B inherits from C,
 * A gets C's permissions too. Cycle detection is enforced at lookup time.
 */
export const CLINICAL_ROLE_DEFINITIONS: Record<
  ClinicalRole,
  ClinicalRoleDefinition
> = {
  physician: {
    name: 'physician',
    displayName: 'Physician',
    description:
      'Licensed physician with full clinical data access and note-signing authority',
    hierarchyLevel: 90,
    permissions: [
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
      'manage_consent',
      'break_glass',
      'export_phi',
    ],
    inherits: ['nurse'],
  },
  nurse: {
    name: 'nurse',
    displayName: 'Nurse',
    description:
      'Registered nurse with clinical data access and note-writing authority',
    hierarchyLevel: 70,
    permissions: [
      'read_patient',
      'write_patient',
      'read_encounter',
      'write_encounter',
      'read_observation',
      'write_observation',
      'read_condition',
      'read_medication',
      'write_medication',
      'read_procedure',
      'write_procedure',
      'read_clinical_note',
      'write_clinical_note',
      'read_schedule',
      'manage_schedule',
      'break_glass',
    ],
    inherits: ['medicalAssistant'],
  },
  pharmacist: {
    name: 'pharmacist',
    displayName: 'Pharmacist',
    description:
      'Licensed pharmacist with medication management and read access to clinical data',
    hierarchyLevel: 75,
    permissions: [
      'read_patient',
      'read_encounter',
      'read_observation',
      'read_condition',
      'read_medication',
      'write_medication',
      'read_clinical_note',
      'write_clinical_note',
      'read_schedule',
      'break_glass',
    ],
    inherits: [],
  },
  medicalAssistant: {
    name: 'medicalAssistant',
    displayName: 'Medical Assistant',
    description:
      'Medical assistant with limited clinical data access and scheduling',
    hierarchyLevel: 50,
    permissions: [
      'read_patient',
      'write_patient',
      'read_encounter',
      'read_observation',
      'read_condition',
      'read_medication',
      'read_clinical_note',
      'read_schedule',
      'manage_schedule',
    ],
    inherits: ['frontDesk'],
  },
  technician: {
    name: 'technician',
    displayName: 'Technician',
    description:
      'Clinical technician with observation recording and procedure access',
    hierarchyLevel: 45,
    permissions: [
      'read_patient',
      'read_encounter',
      'read_observation',
      'write_observation',
      'read_procedure',
      'write_procedure',
      'read_clinical_note',
      'read_schedule',
    ],
    inherits: ['frontDesk'],
  },
  therapist: {
    name: 'therapist',
    displayName: 'Therapist',
    description:
      'Licensed therapist with clinical note authority and condition/encounter access',
    hierarchyLevel: 80,
    permissions: [
      'read_patient',
      'write_patient',
      'read_encounter',
      'write_encounter',
      'read_observation',
      'read_condition',
      'write_condition',
      'read_medication',
      'read_procedure',
      'read_clinical_note',
      'write_clinical_note',
      'sign_clinical_note',
      'read_schedule',
      'manage_schedule',
      'manage_consent',
      'break_glass',
    ],
    inherits: ['nurse'],
  },
  supervisor: {
    name: 'supervisor',
    displayName: 'Clinical Supervisor',
    description:
      'Clinical supervisor with oversight of clinicians, note co-signing, risk queue review, and performance metrics',
    hierarchyLevel: 85,
    permissions: [
      'read_patient',
      'write_patient',
      'read_encounter',
      'write_encounter',
      'read_observation',
      'write_observation',
      'read_condition',
      'write_condition',
      'read_medication',
      'read_procedure',
      'read_clinical_note',
      'write_clinical_note',
      'sign_clinical_note',
      'cosign_clinical_note',
      'read_schedule',
      'manage_schedule',
      'read_claim',
      'manage_consent',
      'break_glass',
      'audit_access',
    ],
    inherits: [],
  },
  socialWorker: {
    name: 'socialWorker',
    displayName: 'Social Worker',
    description:
      'Clinical social worker with patient data and note-writing access',
    hierarchyLevel: 60,
    permissions: [
      'read_patient',
      'write_patient',
      'read_encounter',
      'read_condition',
      'read_clinical_note',
      'write_clinical_note',
      'read_schedule',
      'break_glass',
    ],
    inherits: ['careCoordinator'],
  },
  careCoordinator: {
    name: 'careCoordinator',
    displayName: 'Care Coordinator',
    description: 'Care coordinator with patient and schedule management access',
    hierarchyLevel: 55,
    permissions: [
      'read_patient',
      'write_patient',
      'read_encounter',
      'read_condition',
      'read_clinical_note',
      'read_schedule',
      'manage_schedule',
    ],
    inherits: ['frontDesk'],
  },
  frontDesk: {
    name: 'frontDesk',
    displayName: 'Front Desk',
    description:
      'Front desk staff with scheduling and basic patient demographics access',
    hierarchyLevel: 30,
    permissions: [
      'read_patient',
      'write_patient',
      'read_schedule',
      'manage_schedule',
    ],
    inherits: [],
  },
  billingSpecialist: {
    name: 'billingSpecialist',
    displayName: 'Billing Specialist',
    description: 'Billing specialist with claim and financial record access',
    hierarchyLevel: 40,
    permissions: [
      'read_patient',
      'read_encounter',
      'read_claim',
      'submit_claim',
      'read_schedule',
    ],
    inherits: [],
  },
  complianceOfficer: {
    name: 'complianceOfficer',
    displayName: 'Compliance Officer',
    description:
      'Compliance officer with audit access and read-only clinical data access',
    hierarchyLevel: 85,
    permissions: [
      'read_patient',
      'read_encounter',
      'read_observation',
      'read_condition',
      'read_medication',
      'read_procedure',
      'read_clinical_note',
      'read_claim',
      'audit_access',
      'export_phi',
    ],
    inherits: [],
  },
  healthInformationManager: {
    name: 'healthInformationManager',
    displayName: 'Health Information Manager',
    description:
      'HIM professional with clinical data management and export authority',
    hierarchyLevel: 65,
    permissions: [
      'read_patient',
      'write_patient',
      'read_encounter',
      'read_observation',
      'read_condition',
      'read_medication',
      'read_procedure',
      'read_clinical_note',
      'write_clinical_note',
      'read_claim',
      'export_phi',
      'audit_access',
    ],
    inherits: [],
  },
  systemAdmin: {
    name: 'systemAdmin',
    displayName: 'System Administrator',
    description:
      'System administrator with full EHR configuration and audit access',
    hierarchyLevel: 100,
    permissions: [
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
    ],
    inherits: [
      'physician',
      'pharmacist',
      'complianceOfficer',
      'healthInformationManager',
    ],
  },
}

/**
 * Resolve the full set of permissions for a role, including inherited
 * permissions from parent roles. Cycle-safe via visited-set tracking.
 *
 * @param role - The clinical role to resolve permissions for.
 * @returns A deduplicated set of all permissions (direct + inherited).
 */
export function resolveRolePermissions(role: ClinicalRole): Set<EHRPermission> {
  const result = new Set<EHRPermission>()
  const visited = new Set<ClinicalRole>()

  function collect(r: ClinicalRole): void {
    if (visited.has(r)) return
    visited.add(r)

    const def = CLINICAL_ROLE_DEFINITIONS[r]
    if (!def) return

    for (const perm of def.permissions) {
      result.add(perm)
    }

    for (const parent of def.inherits) {
      collect(parent)
    }
  }

  collect(role)
  return result
}

/**
 * Check if a role has a specific permission, considering inheritance.
 *
 * @param role - The clinical role to check.
 * @param permission - The permission to check for.
 * @returns `true` if the role (directly or via inheritance) has the permission.
 */
export function roleHasPermission(
  role: ClinicalRole,
  permission: EHRPermission,
): boolean {
  return resolveRolePermissions(role).has(permission)
}

/**
 * Get the category for a given permission.
 */
export function getPermissionCategory(
  permission: EHRPermission,
): EHRPermissionCategory {
  return EHR_PERMISSION_DEFINITIONS[permission].category
}

/**
 * Check if a permission requires audit logging when exercised.
 */
export function permissionRequiresAudit(permission: EHRPermission): boolean {
  return EHR_PERMISSION_DEFINITIONS[permission].auditRequired
}

/**
 * Check if a permission requires MFA before being exercised.
 */
export function permissionRequiresMFA(permission: EHRPermission): boolean {
  return EHR_PERMISSION_DEFINITIONS[permission].requiresMFA
}

/**
 * Get all permissions for a role as a sorted array (convenience).
 */
export function getRolePermissions(role: ClinicalRole): EHRPermission[] {
  return Array.from(resolveRolePermissions(role)).sort()
}
