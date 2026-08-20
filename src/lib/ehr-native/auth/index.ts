/**
 * EHR-Native Auth Barrel
 *
 * Re-exports all types, role-permission utilities, and the RBAC service
 * from the EHR-native authorization module.
 */

// Types
export type {
  ClinicalRole,
  EHRPermission,
  EHRPermissionCategory,
  EHRPermissionDefinition,
  ClinicalRoleDefinition,
  EHRPermissionCheckResult,
  BreakGlassParams,
  BreakGlassResult,
} from './types'

export {
  CLINICAL_ROLES,
  EHR_PERMISSIONS,
  isClinicalRole,
  isEHRPermission,
} from './types'

// Role-permission matrix
export {
  EHR_PERMISSION_DEFINITIONS,
  CLINICAL_ROLE_DEFINITIONS,
  resolveRolePermissions,
  roleHasPermission,
  getPermissionCategory,
  permissionRequiresAudit,
  permissionRequiresMFA,
  getRolePermissions,
} from './role-permissions'

// RBAC service
export {
  verifyPatientConsent,
  checkPermission,
  activateBreakGlass,
  checkPermissionWithBreakGlass,
  logEHRAccess,
} from './ehr-rbac'
