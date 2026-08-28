import { describe, it, expect } from 'vitest'

import {
  CLINICAL_ROLE_DEFINITIONS,
  EHR_PERMISSION_DEFINITIONS,
  resolveRolePermissions,
  roleHasPermission,
  getRolePermissions,
  getPermissionCategory,
  permissionRequiresAudit,
  permissionRequiresMFA,
} from './role-permissions'
import {
  CLINICAL_ROLES,
  EHR_PERMISSIONS,
  isClinicalRole,
  isEHRPermission,
  type ClinicalRole,
  type EHRPermission,
} from './types'

describe('ClinicalRole type guards', () => {
  it('isClinicalRole returns true for valid roles', () => {
    for (const role of CLINICAL_ROLES) {
      expect(isClinicalRole(role)).toBe(true)
    }
  })

  it('isClinicalRole returns false for invalid strings', () => {
    expect(isClinicalRole('doctor')).toBe(false)
    expect(isClinicalRole('')).toBe(false)
    expect(isClinicalRole('admin')).toBe(false)
  })

  it('has exactly 14 clinical roles', () => {
    expect(CLINICAL_ROLES).toHaveLength(14)
  })
})

describe('EHRPermission type guards', () => {
  it('isEHRPermission returns true for valid permissions', () => {
    for (const perm of EHR_PERMISSIONS) {
      expect(isEHRPermission(perm)).toBe(true)
    }
  })

  it('isEHRPermission returns false for invalid strings', () => {
    expect(isEHRPermission('delete_patient')).toBe(false)
    expect(isEHRPermission('')).toBe(false)
  })

  it('has exactly 25 EHR permissions', () => {
    expect(EHR_PERMISSIONS).toHaveLength(25)
  })
})

describe('EHR_PERMISSION_DEFINITIONS', () => {
  it('every permission has a definition', () => {
    for (const perm of EHR_PERMISSIONS) {
      expect(EHR_PERMISSION_DEFINITIONS[perm]).toBeDefined()
      expect(EHR_PERMISSION_DEFINITIONS[perm].name).toBe(perm)
    }
  })

  it('auditRequired is true for clinical data permissions', () => {
    const clinicalPerms: EHRPermission[] = [
      'read_patient',
      'write_encounter',
      'write_medication',
      'sign_clinical_note',
      'break_glass',
    ]
    for (const perm of clinicalPerms) {
      expect(permissionRequiresAudit(perm)).toBe(true)
    }
  })

  it('requiresMFA is true for write operations', () => {
    expect(permissionRequiresMFA('write_patient')).toBe(true)
    expect(permissionRequiresMFA('sign_clinical_note')).toBe(true)
    expect(permissionRequiresMFA('break_glass')).toBe(true)
  })

  it('requiresMFA is false for read operations', () => {
    expect(permissionRequiresMFA('read_patient')).toBe(false)
    expect(permissionRequiresMFA('read_encounter')).toBe(false)
    expect(permissionRequiresMFA('read_schedule')).toBe(false)
  })

  it('getPermissionCategory returns correct category', () => {
    expect(getPermissionCategory('read_patient')).toBe('patient_data')
    expect(getPermissionCategory('read_encounter')).toBe('clinical_data')
    expect(getPermissionCategory('sign_clinical_note')).toBe('clinical_notes')
    expect(getPermissionCategory('manage_schedule')).toBe('scheduling')
    expect(getPermissionCategory('submit_claim')).toBe('billing')
    expect(getPermissionCategory('break_glass')).toBe('emergency')
    expect(getPermissionCategory('audit_access')).toBe('administration')
  })
})

describe('CLINICAL_ROLE_DEFINITIONS', () => {
  it('every role has a definition', () => {
    for (const role of CLINICAL_ROLES) {
      expect(CLINICAL_ROLE_DEFINITIONS[role]).toBeDefined()
      expect(CLINICAL_ROLE_DEFINITIONS[role].name).toBe(role)
    }
  })

  it('physician has sign_clinical_note permission', () => {
    expect(CLINICAL_ROLE_DEFINITIONS.physician.permissions).toContain(
      'sign_clinical_note',
    )
  })

  it('frontDesk does NOT have read_encounter permission', () => {
    expect(CLINICAL_ROLE_DEFINITIONS.frontDesk.permissions).not.toContain(
      'read_encounter',
    )
  })

  it('systemAdmin has all 25 permissions directly or via inheritance', () => {
    const perms = resolveRolePermissions('systemAdmin')
    for (const perm of EHR_PERMISSIONS) {
      expect(perms.has(perm)).toBe(true)
    }
  })

  it('systemAdmin has the highest hierarchy level', () => {
    expect(CLINICAL_ROLE_DEFINITIONS.systemAdmin.hierarchyLevel).toBe(100)
  })

  it('frontDesk has the lowest hierarchy level', () => {
    expect(CLINICAL_ROLE_DEFINITIONS.frontDesk.hierarchyLevel).toBe(30)
  })
})

describe('resolveRolePermissions (inheritance)', () => {
  it('physician inherits nurse permissions', () => {
    const physicianPerms = resolveRolePermissions('physician')
    // Nurse has write_medication directly; physician should inherit it
    expect(physicianPerms.has('write_medication')).toBe(true)
  })

  it('physician inherits medicalAssistant permissions transitively', () => {
    const physicianPerms = resolveRolePermissions('physician')
    // medicalAssistant has manage_schedule; physician -> nurse -> medicalAssistant
    expect(physicianPerms.has('manage_schedule')).toBe(true)
  })

  it('physician inherits frontDesk permissions transitively', () => {
    const physicianPerms = resolveRolePermissions('physician')
    // frontDesk has write_patient directly; physician -> nurse -> medicalAssistant -> frontDesk
    expect(physicianPerms.has('write_patient')).toBe(true)
  })

  it('nurse inherits medicalAssistant permissions', () => {
    const nursePerms = resolveRolePermissions('nurse')
    // medicalAssistant has read_condition; nurse doesn't have it directly
    expect(nursePerms.has('read_condition')).toBe(true)
  })

  it('nurse inherits frontDesk permissions via medicalAssistant', () => {
    const nursePerms = resolveRolePermissions('nurse')
    expect(nursePerms.has('manage_schedule')).toBe(true)
  })

  it('therapist inherits nurse permissions', () => {
    const therapistPerms = resolveRolePermissions('therapist')
    // nurse has write_encounter; therapist inherits it
    expect(therapistPerms.has('write_encounter')).toBe(true)
  })

  it('therapist inherits frontDesk permissions transitively', () => {
    const therapistPerms = resolveRolePermissions('therapist')
    // therapist -> nurse -> medicalAssistant -> frontDesk
    expect(therapistPerms.has('read_schedule')).toBe(true)
  })

  it('supervisor inherits therapist and has cosign_clinical_note', () => {
    const supervisorPerms = resolveRolePermissions('supervisor')
    expect(supervisorPerms.has('cosign_clinical_note')).toBe(true)
    expect(supervisorPerms.has('sign_clinical_note')).toBe(true)
    expect(supervisorPerms.has('read_clinical_note')).toBe(true)
    expect(supervisorPerms.has('read_patient')).toBe(true)
    expect(supervisorPerms.has('audit_access')).toBe(true)
    // Regression (Sentry 16291190/0): supervisor must NOT transitively gain
    // medication/procedure write authority via the therapist -> nurse chain.
    expect(supervisorPerms.has('write_medication')).toBe(false)
    expect(supervisorPerms.has('write_procedure')).toBe(false)
  })

  it('systemAdmin inherits physician permissions', () => {
    const adminPerms = resolveRolePermissions('systemAdmin')
    expect(adminPerms.has('sign_clinical_note')).toBe(true)
  })

  it('systemAdmin inherits pharmacist permissions', () => {
    const adminPerms = resolveRolePermissions('systemAdmin')
    expect(adminPerms.has('write_medication')).toBe(true)
  })

  it('systemAdmin inherits complianceOfficer permissions', () => {
    const adminPerms = resolveRolePermissions('systemAdmin')
    expect(adminPerms.has('audit_access')).toBe(true)
  })

  it('systemAdmin inherits healthInformationManager permissions', () => {
    const adminPerms = resolveRolePermissions('systemAdmin')
    expect(adminPerms.has('export_phi')).toBe(true)
  })

  it('pharmacist does NOT inherit from nurse (no inherits array)', () => {
    const pharmacistPerms = resolveRolePermissions('pharmacist')
    // pharmacist doesn't inherit from anyone
    expect(pharmacistPerms.has('write_encounter')).toBe(false)
  })

  it('complianceOfficer does NOT have write permissions', () => {
    const coPerms = resolveRolePermissions('complianceOfficer')
    expect(coPerms.has('write_patient')).toBe(false)
    expect(coPerms.has('write_encounter')).toBe(false)
    expect(coPerms.has('write_medication')).toBe(false)
  })

  it('complianceOfficer has audit_access', () => {
    const coPerms = resolveRolePermissions('complianceOfficer')
    expect(coPerms.has('audit_access')).toBe(true)
  })

  it('billingSpecialist has submit_claim but not adjudicate_claim', () => {
    const bsPerms = resolveRolePermissions('billingSpecialist')
    expect(bsPerms.has('submit_claim')).toBe(true)
    expect(bsPerms.has('adjudicate_claim')).toBe(false)
  })

  it('frontDesk has only basic permissions', () => {
    const fdPerms = resolveRolePermissions('frontDesk')
    expect(fdPerms.has('read_patient')).toBe(true)
    expect(fdPerms.has('write_patient')).toBe(true)
    expect(fdPerms.has('read_schedule')).toBe(true)
    expect(fdPerms.has('manage_schedule')).toBe(true)
    expect(fdPerms.size).toBe(4)
  })

  it('returns deduplicated permissions', () => {
    // physician has write_patient directly AND inherits it from frontDesk
    const physicianPerms = resolveRolePermissions('physician')
    const asArray = Array.from(physicianPerms)
    const unique = new Set(asArray)
    expect(asArray.length).toBe(unique.size)
  })
})

describe('roleHasPermission', () => {
  it('returns true for direct permissions', () => {
    expect(roleHasPermission('physician', 'sign_clinical_note')).toBe(true)
    expect(roleHasPermission('frontDesk', 'manage_schedule')).toBe(true)
  })

  it('returns true for inherited permissions', () => {
    expect(roleHasPermission('physician', 'write_medication')).toBe(true)
    expect(roleHasPermission('nurse', 'manage_schedule')).toBe(true)
  })

  it('returns false for missing permissions', () => {
    expect(roleHasPermission('frontDesk', 'read_encounter')).toBe(false)
    expect(roleHasPermission('billingSpecialist', 'write_condition')).toBe(
      false,
    )
  })

  it('returns false for break_glass when role lacks it', () => {
    expect(roleHasPermission('frontDesk', 'break_glass')).toBe(false)
    expect(roleHasPermission('billingSpecialist', 'break_glass')).toBe(false)
  })

  it('returns true for break_glass when role has it', () => {
    expect(roleHasPermission('physician', 'break_glass')).toBe(true)
    expect(roleHasPermission('nurse', 'break_glass')).toBe(true)
    expect(roleHasPermission('systemAdmin', 'break_glass')).toBe(true)
  })
})

describe('getRolePermissions', () => {
  it('returns sorted array of permissions', () => {
    const perms = getRolePermissions('frontDesk')
    expect(perms).toEqual(
      [
        'manage_schedule',
        'read_patient',
        'read_schedule',
        'write_patient',
      ].sort(),
    )
  })

  it('returns all permissions for systemAdmin', () => {
    const perms = getRolePermissions('systemAdmin')
    expect(perms.length).toBe(EHR_PERMISSIONS.length)
  })
})

describe('Cycle safety in inheritance', () => {
  it('resolveRolePermissions does not infinite-loop on valid definitions', () => {
    // All roles should resolve without hanging — if there were a cycle,
    // this test would timeout
    for (const role of CLINICAL_ROLES) {
      const perms = resolveRolePermissions(role)
      expect(perms.size).toBeGreaterThan(0)
    }
  })
})
