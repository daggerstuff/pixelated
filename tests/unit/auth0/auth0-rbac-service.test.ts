import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as auth0RbacService from '../../../src/lib/auth/auth0-rbac-service'

// Mock the auth0 module
vi.mock('auth0', () => {
  return {
    ManagementClient: vi.fn().mockImplementation(() => {
      return {
        getRoles: vi.fn(),
        getPermissions: vi.fn(),
        createRole: vi.fn(),
        createPermission: vi.fn(),
        assignRolestoUser: vi.fn(),
        removeRolesFromUser: vi.fn(),
        getUserRoles: vi.fn(),
        addPermissionsInRole: vi.fn()
      }
    })
  }
})

// Mock security logging
vi.mock('../../../src/lib/security/index', () => {
  return {
    logSecurityEvent: vi.fn(),
    SecurityEventType: {
      ROLE_ASSIGNED: 'ROLE_ASSIGNED',
      ROLE_REMOVED: 'ROLE_REMOVED'
    }
  }
})

// Mock MCP integration
vi.mock('../../../src/lib/mcp/phase6-integration', () => {
  return {
    updatePhase6AuthenticationProgress: vi.fn()
  }
})

describe('Auth0 RBAC Service', () => {
  beforeEach(() => {
    // Set environment variables
    process.env.AUTH0_DOMAIN = 'test-domain.auth0.com'
    process.env.AUTH0_MANAGEMENT_CLIENT_ID = 'test-management-client-id'
    process.env.AUTH0_MANAGEMENT_CLIENT_SECRET = 'test-management-client-secret'

    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up environment variables
    delete process.env.AUTH0_DOMAIN
    delete process.env.AUTH0_MANAGEMENT_CLIENT_ID
    delete process.env.AUTH0_MANAGEMENT_CLIENT_SECRET
  })

  describe('Role Definitions', () => {
    it('should have correct role definitions', () => {
      expect(auth0RbacService.AUTH0_ROLE_DEFINITIONS).toBeDefined()
      expect(Object.keys(auth0RbacService.AUTH0_ROLE_DEFINITIONS)).toHaveLength(6)

      // Check admin role
      const adminRole = auth0RbacService.AUTH0_ROLE_DEFINITIONS.admin
      expect(adminRole.name).toBe('admin')
      expect(adminRole.displayName).toBe('Administrator')
      expect(adminRole.hierarchyLevel).toBe(100)
      expect(adminRole.permissions).toEqual(['*'])
      expect(adminRole.isAssignable).toBe(false)

      // Check therapist role
      const therapistRole = auth0RbacService.AUTH0_ROLE_DEFINITIONS.therapist
      expect(therapistRole.name).toBe('therapist')
      expect(therapistRole.displayName).toBe('Mental Health Professional')
      expect(therapistRole.hierarchyLevel).toBe(80)
      expect(therapistRole.permissions).toContain('read:patients')
      expect(therapistRole.isAssignable).toBe(true)
      expect(therapistRole.requiresApproval).toBe(true)

      // Check patient role
      const patientRole = auth0RbacService.AUTH0_ROLE_DEFINITIONS.patient
      expect(patientRole.name).toBe('patient')
      expect(patientRole.displayName).toBe('Patient')
      expect(patientRole.hierarchyLevel).toBe(40)
      expect(patientRole.permissions).toContain('read:own_profile')
      expect(patientRole.isAssignable).toBe(true)
      expect(patientRole.requiresApproval).toBe(false)
    })
  })

  describe('Permission Definitions', () => {
    it('should have correct permission definitions', () => {
      expect(auth0RbacService.AUTH0_PERMISSION_DEFINITIONS).toBeDefined()

      // Check a specific permission
      const readPatientsPerm = auth0RbacService.AUTH0_PERMISSION_DEFINITIONS['read:patients']
      expect(readPatientsPerm).toBeDefined()
      expect(readPatientsPerm.name).toBe('read:patients')
      expect(readPatientsPerm.description).toBe('View patient medical records and profiles')
      expect(readPatientsPerm.category).toBe('patient_data')
      expect(readPatientsPerm.auditRequired).toBe(true)

      // Check a permission that requires MFA
      const writeUsersPerm = auth0RbacService.AUTH0_PERMISSION_DEFINITIONS['write:users']
      expect(writeUsersPerm.requiresMFA).toBe(true)
      expect(writeUsersPerm.auditRequired).toBe(true)
    })
  })

  describe('Role Hierarchy', () => {
    it('should have correct role hierarchy', () => {
      expect(auth0RbacService.AUTH0_ROLE_HIERARCHY).toEqual([
        'guest',
        'patient',
        'support',
        'researcher',
        'therapist',
        'admin'
      ])
    })
  })

  describe('assignRoleToUser', () => {
    it('should successfully assign a role to a user', async () => {
      const auth0Module = require('auth0')
      const mockManagementClient = auth0Module.ManagementClient.mock.results[0].value

      // Mock role lookup
      mockManagementClient.getRoles.mockResolvedValue([{
        id: 'role-id-123',
        name: 'therapist'
      }])

      // Mock role assignment
      mockManagementClient.assignRolestoUser.mockResolvedValue({})

      await auth0RbacService.assignRoleToUser('auth0|user123', 'therapist')

      expect(mockManagementClient.getRoles).toHaveBeenCalledWith({ name_filter: 'therapist' })
      expect(mockManagementClient.assignRolestoUser).toHaveBeenCalledWith(
        { id: 'auth0|user123' },
        { roles: ['role-id-123'] }
      )
    })

    it('should throw error when role is not found', async () => {
      const auth0Module = require('auth0')
      const mockManagementClient = auth0Module.ManagementClient.mock.results[0].value

      // Mock role lookup returning empty array
      mockManagementClient.getRoles.mockResolvedValue([])

      await expect(auth0RbacService.assignRoleToUser('auth0|user123', 'nonexistent-role'))
        .rejects.toThrow('Role nonexistent-role not found')
    })

    it('should handle assignment errors', async () => {
      const auth0Module = require('auth0')
      const mockManagementClient = auth0Module.ManagementClient.mock.results[0].value

      // Mock role lookup
      mockManagementClient.getRoles.mockResolvedValue([{
        id: 'role-id-123',
        name: 'therapist'
      }])

      // Mock assignment failure
      mockManagementClient.assignRolestoUser.mockRejectedValue(new Error('Assignment failed'))

      await expect(auth0RbacService.assignRoleToUser('auth0|user123', 'therapist'))
        .rejects.toThrow('Assignment failed')
    })
  })

  describe('removeRoleFromUser', () => {
    it('should successfully remove a role from a user', async () => {
      const auth0Module = require('auth0')
      const mockManagementClient = auth0Module.ManagementClient.mock.results[0].value

      // Mock role lookup
      mockManagementClient.getRoles.mockResolvedValue([{
        id: 'role-id-123',
        name: 'therapist'
      }])

      // Mock role removal
      mockManagementClient.removeRolesFromUser.mockResolvedValue({})

      await auth0RbacService.removeRoleFromUser('auth0|user123', 'therapist')

      expect(mockManagementClient.getRoles).toHaveBeenCalledWith({ name_filter: 'therapist' })
      expect(mockManagementClient.removeRolesFromUser).toHaveBeenCalledWith(
        { id: 'auth0|user123' },
        { roles: ['role-id-123'] }
      )
    })

    it('should throw error when role is not found', async () => {
      const auth0Module = require('auth0')
      const mockManagementClient = auth0Module.ManagementClient.mock.results[0].value

      // Mock role lookup returning empty array
      mockManagementClient.getRoles.mockResolvedValue([])

      await expect(auth0RbacService.removeRoleFromUser('auth0|user123', 'nonexistent-role'))
        .rejects.toThrow('Role nonexistent-role not found')
    })
  })

  describe('getUserRoles', () => {
    it('should successfully retrieve user roles', async () => {
      const auth0Module = require('auth0')
      const mockManagementClient = auth0Module.ManagementClient.mock.results[0].value

      // Mock user roles
      mockManagementClient.getUserRoles.mockResolvedValue([
        { name: 'therapist' },
        { name: 'researcher' }
      ])

      const roles = await auth0RbacService.getUserRoles('auth0|user123')

      expect(roles).toEqual(['therapist', 'researcher'])
      expect(mockManagementClient.getUserRoles).toHaveBeenCalledWith({ id: 'auth0|user123' })
    })

    it('should return empty array when getUserRoles fails', async () => {
      const auth0Module = require('auth0')
      const mockManagementClient = auth0Module.ManagementClient.mock.results[0].value

      // Mock failure
      mockManagementClient.getUserRoles.mockRejectedValue(new Error('Failed to get roles'))

      const roles = await auth0RbacService.getUserRoles('auth0|user123')

      expect(roles).toEqual([])
    })
  })

  describe('userHasRole', () => {
    it('should return true when user has the specified role', async () => {
      // Mock getUserRoles to return roles including 'therapist'
      vi.spyOn(auth0RbacService, 'getUserRoles').mockResolvedValue(['patient', 'therapist'])

      const hasRole = await auth0RbacService.userHasRole('auth0|user123', 'therapist')

      expect(hasRole).toBe(true)
    })

    it('should return false when user does not have the specified role', async () => {
      // Mock getUserRoles to return roles not including 'admin'
      vi.spyOn(auth0RbacService, 'getUserRoles').mockResolvedValue(['patient', 'therapist'])

      const hasRole = await auth0RbacService.userHasRole('auth0|user123', 'admin')

      expect(hasRole).toBe(false)
    })
  })

  describe('userHasPermission', () => {
    it('should return true for admin user with any permission', async () => {
      // Mock getUserRoles to return admin role
      vi.spyOn(auth0RbacService, 'getUserRoles').mockResolvedValue(['admin'])

      const hasPermission = await auth0RbacService.userHasPermission('auth0|user123', 'read:patients')

      expect(hasPermission).toBe(true)
    })

    it('should return true when user role has the specific permission', async () => {
      // Mock getUserRoles to return therapist role
      vi.spyOn(auth0RbacService, 'getUserRoles').mockResolvedValue(['therapist'])

      const hasPermission = await auth0RbacService.userHasPermission('auth0|user123', 'read:patients')

      expect(hasPermission).toBe(true) // therapists have read:patients permission
    })

    it('should return false when user role does not have the specific permission', async () => {
      // Mock getUserRoles to return patient role
      vi.spyOn(auth0RbacService, 'getUserRoles').mockResolvedValue(['patient'])

      const hasPermission = await auth0RbacService.userHasPermission('auth0|user123', 'manage:roles')

      expect(hasPermission).toBe(false) // patients don't have manage:roles permission
    })

    it('should return false when permission check fails', async () => {
      // Mock getUserRoles to throw an error
      vi.spyOn(auth0RbacService, 'getUserRoles').mockRejectedValue(new Error('Failed to get roles'))

      const hasPermission = await auth0RbacService.userHasPermission('auth0|user123', 'read:patients')

      expect(hasPermission).toBe(false)
    })
  })

  describe('getUserPermissions', () => {
    it('should return all permissions for admin user', async () => {
      // Mock getUserRoles to return admin role
      vi.spyOn(auth0RbacService, 'getUserRoles').mockResolvedValue(['admin'])

      const permissions = await auth0RbacService.getUserPermissions('auth0|user123')

      // Admin should have all permissions
      expect(permissions).toContain('read:patients')
      expect(permissions).toContain('manage:roles')
      expect(permissions.length).toBeGreaterThan(20) // Should have many permissions
    })

    it('should return specific permissions for non-admin user', async () => {
      // Mock getUserRoles to return therapist role
      vi.spyOn(auth0RbacService, 'getUserRoles').mockResolvedValue(['therapist'])

      const permissions = await auth0RbacService.getUserPermissions('auth0|user123')

      // Therapist should have specific permissions
      expect(permissions).toContain('read:patients')
      expect(permissions).toContain('write:patient_notes')
      expect(permissions).not.toContain('manage:roles') // Should not have admin permissions
    })

    it('should return empty array when permission retrieval fails', async () => {
      // Mock getUserRoles to throw an error
      vi.spyOn(auth0RbacService, 'getUserRoles').mockRejectedValue(new Error('Failed to get roles'))

      const permissions = await auth0RbacService.getUserPermissions('auth0|user123')

      expect(permissions).toEqual([])
    })
  })

  describe('roleHasPermission', () => {
    it('should return true for admin role with any permission', () => {
      const hasPermission = auth0RbacService.roleHasPermission('admin', 'read:patients')
      expect(hasPermission).toBe(true)
    })

    it('should return true when role has the specific permission', () => {
      const hasPermission = auth0RbacService.roleHasPermission('therapist', 'read:patients')
      expect(hasPermission).toBe(true)
    })

    it('should return false when role does not have the specific permission', () => {
      const hasPermission = auth0RbacService.roleHasPermission('patient', 'manage:roles')
      expect(hasPermission).toBe(false)
    })

    it('should return false for non-existent role', () => {
      const hasPermission = auth0RbacService.roleHasPermission('nonexistent' as any, 'read:patients')
      expect(hasPermission).toBe(false)
    })
  })

  describe('hasRequiredRole', () => {
    it('should return true when user role has equal or higher hierarchy level', () => {
      const hasRequired = auth0RbacService.hasRequiredRole('admin', 'therapist')
      expect(hasRequired).toBe(true) // admin (100) >= therapist (80)
    })

    it('should return false when user role has lower hierarchy level', () => {
      const hasRequired = auth0RbacService.hasRequiredRole('patient', 'therapist')
      expect(hasRequired).toBe(false) // patient (40) < therapist (80)
    })

    it('should return false for non-existent roles', () => {
      const hasRequired = auth0RbacService.hasRequiredRole('nonexistent' as any, 'therapist')
      expect(hasRequired).toBe(false)
    })
  })

  describe('getRolePermissions', () => {
    it('should return all permissions for admin role', () => {
      const permissions = auth0RbacService.getRolePermissions('admin')
      expect(permissions).toContain('read:patients')
      expect(permissions).toContain('manage:roles')
      expect(permissions.length).toBeGreaterThan(20)
    })

    it('should return specific permissions for non-admin role', () => {
      const permissions = auth0RbacService.getRolePermissions('therapist')
      expect(permissions).toContain('read:patients')
      expect(permissions).toContain('write:patient_notes')
      expect(permissions).not.toContain('manage:roles')
    })

    it('should return empty array for non-existent role', () => {
      const permissions = auth0RbacService.getRolePermissions('nonexistent' as any)
      expect(permissions).toEqual([])
    })
  })

  describe('requiresMFA', () => {
    it('should return true for permissions that require MFA', () => {
      const requiresMfa = auth0RbacService.requiresMFA('write:users')
      expect(requiresMfa).toBe(true)
    })

    it('should return false for permissions that do not require MFA', () => {
      const requiresMfa = auth0RbacService.requiresMFA('read:public_content')
      expect(requiresMfa).toBe(false)
    })

    it('should return false for non-existent permission', () => {
      const requiresMfa = auth0RbacService.requiresMFA('nonexistent-permission')
      expect(requiresMfa).toBe(false)
    })
  })

  describe('requiresAudit', () => {
    it('should return true for permissions that require audit', () => {
      const requiresAudit = auth0RbacService.requiresAudit('read:patients')
      expect(requiresAudit).toBe(true)
    })

    it('should return false for permissions that do not require audit', () => {
      // This would need a permission that doesn't require audit, but most do
      // We'll test with a non-existent permission
      const requiresAudit = auth0RbacService.requiresAudit('nonexistent-permission')
      expect(requiresAudit).toBe(false)
    })
  })

  describe('getRoleByHierarchy', () => {
    it('should return correct role for hierarchy level', () => {
      const role = auth0RbacService.getRoleByHierarchy(100)
      expect(role).toBe('admin')

      const therapistRole = auth0RbacService.getRoleByHierarchy(80)
      expect(therapistRole).toBe('therapist')
    })

    it('should return null for non-existent hierarchy level', () => {
      const role = auth0RbacService.getRoleByHierarchy(999)
      expect(role).toBeNull()
    })
  })

  describe('canAssignRole', () => {
    it('should return true when assigner can assign target role', () => {
      // Admin can assign therapist role
      const canAssign = auth0RbacService.canAssignRole('admin', 'therapist')
      expect(canAssign).toBe(true)
    })

    it('should return false when assigner cannot assign target role', () => {
      // Therapist cannot assign admin role
      const canAssign = auth0RbacService.canAssignRole('therapist', 'admin')
      expect(canAssign).toBe(false)
    })

    it('should return false when target role is not assignable', () => {
      // Admin role is not assignable
      const canAssign = auth0RbacService.canAssignRole('admin', 'admin')
      expect(canAssign).toBe(false)
    })

    it('should return false for non-existent roles', () => {
      const canAssign = auth0RbacService.canAssignRole('nonexistent' as any, 'therapist')
      expect(canAssign).toBe(false)
    })
  })

  describe('getAssignableRoles', () => {
    it('should return correct assignable roles for admin', () => {
      const assignableRoles = auth0RbacService.getAssignableRoles('admin')
      // Admin should be able to assign all roles except admin itself
      expect(assignableRoles).toContain('therapist')
      expect(assignableRoles).toContain('patient')
      expect(assignableRoles).toContain('researcher')
      expect(assignableRoles).toContain('support')
      expect(assignableRoles).toContain('guest')
      expect(assignableRoles).not.toContain('admin')
    })

    it('should return correct assignable roles for therapist', () => {
      const assignableRoles = auth0RbacService.getAssignableRoles('therapist')
      // Therapist should be able to assign lower-level roles
      expect(assignableRoles).toContain('patient')
      expect(assignableRoles).toContain('guest')
      expect(assignableRoles).not.toContain('therapist')
      expect(assignableRoles).not.toContain('admin')
    })

    it('should return empty array for non-existent role', () => {
      const assignableRoles = auth0RbacService.getAssignableRoles('nonexistent' as any)
      expect(assignableRoles).toEqual([])
    })
  })

  describe('validateRoleTransition', () => {
    it('should validate valid role transition', () => {
      const transition = auth0RbacService.validateRoleTransition('therapist', 'admin')

      expect(transition.fromRole).toBe('therapist')
      expect(transition.toRole).toBe('admin')
      expect(transition.requiresApproval).toBe(false) // Admin doesn't require approval
      expect(transition.requiresMFA).toBe(true) // Upgrading requires MFA
      expect(transition.auditRequired).toBe(true)
    })

    it('should validate role transition that requires approval', () => {
      const transition = auth0RbacService.validateRoleTransition('support', 'therapist')

      expect(transition.fromRole).toBe('support')
      expect(transition.toRole).toBe('therapist')
      expect(transition.requiresApproval).toBe(true) // Therapist requires approval
      expect(transition.requiresMFA).toBe(true) // Upgrading requires MFA
      expect(transition.auditRequired).toBe(true)
    })

    it('should throw error for same role transition', () => {
      expect(() => auth0RbacService.validateRoleTransition('therapist', 'therapist'))
        .toThrow('Cannot transition to same role')
    })

    it('should throw error for invalid roles', () => {
      expect(() => auth0RbacService.validateRoleTransition('nonexistent' as any, 'therapist'))
        .toThrow('Invalid role specified')
    })
  })
})