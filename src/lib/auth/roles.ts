/**
 * Role-Based Access Control (RBAC) System - Phase 7 Multi-Role Authentication
 * Defines the 6-role permission matrix for the Pixelated mental health platform
 */

export type UserRole =
  | 'admin'
  | 'therapist'
  | 'patient'
  | 'researcher'
  | 'support'
  | 'guest'

export interface RoleDefinition {
  name: UserRole
  displayName: string
  description: string
  hierarchyLevel: number
  permissions: string[]
  restrictions: string[]
  isAssignable: boolean
  requiresApproval: boolean
}

export interface Permission {
  name: string
  description: string
  category: PermissionCategory
  requiresMFA?: boolean
  auditRequired: boolean
}

export type PermissionCategory =
  | 'user_management'
  | 'patient_data'
  | 'therapy_sessions'
  | 'research_data'
  | 'system_admin'
  | 'content_management'
  | 'analytics'
  | 'security'

/**
 * 6-Role Permission Matrix for Mental Health Platform
 */
export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  admin: {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Full system access with administrative privileges',
    hierarchyLevel: 100,
    permissions: ['*'], // All permissions
    restrictions: [],
    isAssignable: false, // Only through secure admin creation process
    requiresApproval: false,
  },

  therapist: {
    name: 'therapist',
    displayName: 'Mental Health Professional',
    description:
      'Licensed mental health professionals providing therapy services',
    hierarchyLevel: 80,
    permissions: [
      'read:patients',
      'write:patient_notes',
      'read:patient_assessments',
      'write:therapy_sessions',
      'read:therapy_analytics',
      'manage:patient_appointments',
      'access:therapeutic_tools',
      'read:ai_recommendations',
      'write:session_notes',
      'read:patient_history',
      'manage:therapy_goals',
      'access:crisis_intervention_tools',
    ],
    restrictions: [
      'cannot_delete_patient_data',
      'cannot_access_admin_functions',
      'cannot_view_other_therapist_sessions',
      'limited_to_assigned_patients',
    ],
    isAssignable: true,
    requiresApproval: true,
  },

  patient: {
    name: 'patient',
    displayName: 'Patient',
    description:
      'Individuals receiving mental health support and therapy services',
    hierarchyLevel: 40,
    permissions: [
      'read:own_profile',
      'write:own_profile',
      'read:own_sessions',
      'write:own_notes',
      'read:own_assessments',
      'access:therapeutic_resources',
      'book:appointments',
      'read:assigned_therapist',
      'access:self_help_tools',
      'read:personalized_content',
      'write:feedback',
      'access:crisis_support',
    ],
    restrictions: [
      'cannot_access_other_patient_data',
      'cannot_view_therapist_notes',
      'cannot_access_admin_functions',
      'cannot_view_system_analytics',
    ],
    isAssignable: true,
    requiresApproval: false,
  },

  researcher: {
    name: 'researcher',
    displayName: 'Researcher',
    description: 'Authorized researchers conducting mental health studies',
    hierarchyLevel: 60,
    permissions: [
      'read:anonymized_data',
      'read:research_analytics',
      'export:research_data',
      'access:research_tools',
      'read:study_participants',
      'write:research_notes',
      'manage:research_projects',
      'access:statistical_tools',
      'read:aggregated_insights',
    ],
    restrictions: [
      'cannot_access_identifiable_patient_data',
      'cannot_modify_patient_records',
      'cannot_access_individual_therapy_sessions',
      'data_access_limited_to_approved_studies',
    ],
    isAssignable: true,
    requiresApproval: true,
  },

  support: {
    name: 'support',
    displayName: 'Support Staff',
    description: 'Technical and administrative support personnel',
    hierarchyLevel: 50,
    permissions: [
      'read:user_profiles',
      'write:user_support_notes',
      'access:support_tools',
      'manage:tickets',
      'read:system_logs',
      'access:basic_analytics',
      'manage:announcements',
      'read:platform_metrics',
      'access:help_resources',
    ],
    restrictions: [
      'cannot_access_patient_therapy_data',
      'cannot_modify_user_roles',
      'cannot_access_sensitive_patient_information',
      'cannot_perform_administrative_functions',
    ],
    isAssignable: true,
    requiresApproval: true,
  },

  guest: {
    name: 'guest',
    displayName: 'Guest',
    description: 'Unauthenticated or limited access users',
    hierarchyLevel: 20,
    permissions: [
      'read:public_content',
      'access:basic_resources',
      'read:general_information',
      'access:crisis_hotline',
      'read:educational_materials',
    ],
    restrictions: [
      'cannot_access_personalized_content',
      'cannot_book_appointments',
      'cannot_view_therapist_profiles',
      'cannot_access_patient_portal',
      'session_limited_to_30_minutes',
    ],
    isAssignable: false, // Default role for unauthenticated users
    requiresApproval: false,
  },
}

/**
 * Detailed permission definitions with security requirements
 */
export const PERMISSION_DEFINITIONS: Record<string, Permission> = {
  // User Management Permissions
  'read:users': {
    name: 'read:users',
    description: 'View user account information',
    category: 'user_management',
    auditRequired: true,
  },
  'write:users': {
    name: 'write:users',
    description: 'Modify user account information',
    category: 'user_management',
    requiresMFA: true,
    auditRequired: true,
  },
  'delete:users': {
    name: 'delete:users',
    description: 'Delete user accounts',
    category: 'user_management',
    requiresMFA: true,
    auditRequired: true,
  },

  // Patient Data Permissions
  'read:patients': {
    name: 'read:patients',
    description: 'View patient medical records and profiles',
    category: 'patient_data',
    auditRequired: true,
  },
  'write:patient_notes': {
    name: 'write:patient_notes',
    description: 'Add clinical notes to patient records',
    category: 'patient_data',
    requiresMFA: true,
    auditRequired: true,
  },
  'read:patient_assessments': {
    name: 'read:patient_assessments',
    description: 'View patient psychological assessments',
    category: 'patient_data',
    auditRequired: true,
  },

  // Therapy Session Permissions
  'write:therapy_sessions': {
    name: 'write:therapy_sessions',
    description: 'Conduct and document therapy sessions',
    category: 'therapy_sessions',
    requiresMFA: true,
    auditRequired: true,
  },
  'read:therapy_analytics': {
    name: 'read:therapy_analytics',
    description: 'View therapy session analytics and insights',
    category: 'therapy_sessions',
    auditRequired: true,
  },

  // Research Data Permissions
  'read:anonymized_data': {
    name: 'read:anonymized_data',
    description: 'Access anonymized research datasets',
    category: 'research_data',
    auditRequired: true,
  },
  'export:research_data': {
    name: 'export:research_data',
    description: 'Export research data for analysis',
    category: 'research_data',
    requiresMFA: true,
    auditRequired: true,
  },

  // System Administration Permissions
  'manage:roles': {
    name: 'manage:roles',
    description: 'Assign and modify user roles',
    category: 'system_admin',
    requiresMFA: true,
    auditRequired: true,
  },
  'access:system_logs': {
    name: 'access:system_logs',
    description: 'View system logs and audit trails',
    category: 'system_admin',
    auditRequired: true,
  },

  // Content Management Permissions
  'manage:announcements': {
    name: 'manage:announcements',
    description: 'Create and manage platform announcements',
    category: 'content_management',
    auditRequired: true,
  },

  // Analytics Permissions
  'read:analytics': {
    name: 'read:analytics',
    description: 'View platform analytics and metrics',
    category: 'analytics',
    auditRequired: true,
  },
  'read:research_analytics': {
    name: 'read:research_analytics',
    description: 'View research-specific analytics',
    category: 'analytics',
    auditRequired: true,
  },

  // Security Permissions
  'manage:security_settings': {
    name: 'manage:security_settings',
    description: 'Configure security settings and policies',
    category: 'security',
    requiresMFA: true,
    auditRequired: true,
  },
}

/**
 * Role hierarchy for permission inheritance
 */
export const ROLE_HIERARCHY: UserRole[] = [
  'guest',
  'patient',
  'support',
  'researcher',
  'therapist',
  'admin',
]

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  const roleDef = ROLE_DEFINITIONS[role]
  if (!roleDef) return false

  // Admin has all permissions
  if (roleDef.permissions.includes('*')) return true

  return roleDef.permissions.includes(permission)
}

/**
 * Check if a role has required hierarchy level
 */
export function hasRequiredRole(
  userRole: UserRole,
  requiredRole: UserRole,
): boolean {
  const userRoleDef = ROLE_DEFINITIONS[userRole]
  const requiredRoleDef = ROLE_DEFINITIONS[requiredRole]

  if (!userRoleDef || !requiredRoleDef) return false

  return userRoleDef.hierarchyLevel >= requiredRoleDef.hierarchyLevel
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): string[] {
  const roleDef = ROLE_DEFINITIONS[role]
  if (!roleDef) return []

  if (roleDef.permissions.includes('*')) {
    // Return all available permissions for admin
    return Object.keys(PERMISSION_DEFINITIONS)
  }

  return [...roleDef.permissions]
}

/**
 * Check if permission requires MFA
 */
export function requiresMFA(permission: string): boolean {
  const permDef = PERMISSION_DEFINITIONS[permission]
  return permDef?.requiresMFA || false
}

/**
 * Check if permission requires audit logging
 */
export function requiresAudit(permission: string): boolean {
  const permDef = PERMISSION_DEFINITIONS[permission]
  return permDef?.auditRequired || false
}

/**
 * Get role by hierarchy level
 */
export function getRoleByHierarchy(level: number): UserRole | null {
  for (const [role, def] of Object.entries(ROLE_DEFINITIONS)) {
    if (def.hierarchyLevel === level) {
      return role as UserRole
    }
  }
  return null
}

/**
 * Validate role assignment
 */
export function canAssignRole(
  assignerRole: UserRole,
  targetRole: UserRole,
): boolean {
  const assignerDef = ROLE_DEFINITIONS[assignerRole]
  const targetDef = ROLE_DEFINITIONS[targetRole]

  if (!assignerDef || !targetDef) return false

  // Cannot assign roles higher than your own
  if (targetDef.hierarchyLevel >= assignerDef.hierarchyLevel) return false

  // Target role must be assignable
  if (!targetDef.isAssignable) return false

  return true
}

/**
 * Get assignable roles for a given role
 */
export function getAssignableRoles(role: UserRole): UserRole[] {
  const roleDef = ROLE_DEFINITIONS[role]
  if (!roleDef) return []

  return ROLE_HIERARCHY.filter((targetRole) => canAssignRole(role, targetRole))
}

/**
 * Role transition validation
 */
export interface RoleTransition {
  fromRole: UserRole
  toRole: UserRole
  requiresApproval: boolean
  requiresMFA: boolean
  auditRequired: boolean
}

export function validateRoleTransition(
  fromRole: UserRole,
  toRole: UserRole,
): RoleTransition {
  const fromDef = ROLE_DEFINITIONS[fromRole]
  const toDef = ROLE_DEFINITIONS[toRole]

  if (!fromDef || !toDef) {
    throw new Error('Invalid role specified')
  }

  // Cannot transition to same role
  if (fromRole === toRole) {
    throw new Error('Cannot transition to same role')
  }

  // Check if target role requires approval
  const requiresApproval = toDef.requiresApproval

  // MFA required for sensitive role transitions
  const requiresMFA =
    toDef.hierarchyLevel > fromDef.hierarchyLevel ||
    toDef.permissions.includes('manage:roles') ||
    toDef.permissions.includes('*')

  // All role transitions require audit logging
  const auditRequired = true

  return {
    fromRole,
    toRole,
    requiresApproval,
    requiresMFA,
    auditRequired,
  }
}
