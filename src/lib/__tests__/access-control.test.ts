import { describe, it, expect } from 'vitest'
import { roleHasPermission, ROLES, type Role } from '../access-control'

describe('roleHasPermission', () => {
  it('correctly identifies when a role has a specific permission', () => {
    expect(roleHasPermission(ROLES.USER, 'read:conversations')).toBe(true)
    expect(roleHasPermission(ROLES.ADMIN, 'manage:admin')).toBe(true)
  })

  it('correctly identifies when a role lacks a specific permission', () => {
    expect(roleHasPermission(ROLES.USER, 'delete:users')).toBe(false)
    expect(roleHasPermission(ROLES.STAFF, 'manage:admin')).toBe(false)
  })

  it('treats higher roles as inheriting lower-role permissions', () => {
    // ADMIN should inherit USER permissions
    expect(roleHasPermission(ROLES.ADMIN, 'read:conversations')).toBe(true)
    // STAFF should also inherit USER permissions
    expect(roleHasPermission(ROLES.STAFF, 'read:conversations')).toBe(true)
    // Explicitly verify ADMIN inherits USER's permissions (hierarchy proof)
    expect(roleHasPermission(ROLES.ADMIN, 'read:conversations')).toBe(roleHasPermission(ROLES.USER, 'read:conversations'))
  })

  it('handles gracefully when an invalid role is provided', () => {
    const invalidRole = 'guest' as unknown as Role
    expect(roleHasPermission(invalidRole, 'read:conversations')).toBe(false)
  })
})