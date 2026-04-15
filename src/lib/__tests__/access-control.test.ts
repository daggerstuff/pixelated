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

  it('handles gracefully when an invalid role is provided', () => {
    // We intentionally bypass type checks for this test case
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-type-assertion
    const invalidRole = 'guest' as any as Role
    expect(roleHasPermission(invalidRole, 'read:conversations')).toBe(false)
  })
})
