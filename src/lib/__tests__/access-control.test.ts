import { describe, it, expect, vi } from 'vitest'

// Mock dependencies that cause resolution errors
vi.mock('../audit', () => ({
  createAuditLog: vi.fn(),
  AuditEventType: { ACCESS: 'ACCESS' }
}))

vi.mock('../auth', () => ({
  getCurrentUser: vi.fn(),
  hasRole: vi.fn()
}))

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
  })

  it('handles gracefully when an invalid role is provided', () => {
    const invalidRole = 'guest' as unknown as Role
    expect(roleHasPermission(invalidRole, 'read:conversations')).toBe(false)
  })
})