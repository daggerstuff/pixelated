/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { AstroCookies } from 'astro'

vi.mock('../audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AuditEventType: { ACCESS: 'access' },
}))

vi.mock('../auth', () => ({
  getCurrentUser: vi.fn(),
  hasRole: vi.fn(),
}))

import { createAuditLog } from '../audit'
import { getCurrentUser, hasRole } from '../auth'
import {
  roleHasPermission,
  hasPermission,
  isAdmin,
  isStaffOrAdmin,
  requirePermission,
  ROLES,
  type Permission,
  type Role,
} from '../access-control'

const mockGetCurrentUser = vi.mocked(getCurrentUser)
const mockHasRole = vi.mocked(hasRole)
const mockCreateAuditLog = vi.mocked(createAuditLog)

const fakeCookies = {} as AstroCookies

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { location: path } })
}

describe('access-control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('roleHasPermission', () => {
    it('grants USER base permissions', () => {
      expect(roleHasPermission(ROLES.USER, 'read:conversations')).toBe(true)
      expect(roleHasPermission(ROLES.USER, 'create:messages')).toBe(true)
      expect(roleHasPermission(ROLES.USER, 'update:settings')).toBe(true)
    })

    it('grants STAFF extended permissions', () => {
      expect(roleHasPermission(ROLES.STAFF, 'list:users')).toBe(true)
      expect(roleHasPermission(ROLES.STAFF, 'read:admin')).toBe(true)
    })

    it('grants ADMIN all permissions', () => {
      expect(roleHasPermission(ROLES.ADMIN, 'manage:admin')).toBe(true)
      expect(roleHasPermission(ROLES.ADMIN, 'delete:messages')).toBe(true)
      expect(roleHasPermission(ROLES.ADMIN, 'delete:users')).toBe(true)
    })

    it('denies USER admin and destructive permissions', () => {
      expect(roleHasPermission(ROLES.USER, 'manage:admin')).toBe(false)
      expect(roleHasPermission(ROLES.USER, 'delete:users')).toBe(false)
      expect(roleHasPermission(ROLES.USER, 'delete:messages')).toBe(false)
      expect(roleHasPermission(ROLES.USER, 'list:users')).toBe(false)
    })

    it('denies STAFF admin management', () => {
      expect(roleHasPermission(ROLES.STAFF, 'manage:admin')).toBe(false)
      expect(roleHasPermission(ROLES.STAFF, 'delete:users')).toBe(false)
    })

    it('returns false for invalid role', () => {
      expect(
        roleHasPermission('guest' as unknown as Role, 'read:conversations'),
      ).toBe(false)
    })
  })

  describe('hasPermission', () => {
    it('returns false when no user is signed in', async () => {
      mockGetCurrentUser.mockResolvedValue(null)
      const result = await hasPermission(fakeCookies, 'read:conversations')
      expect(result).toBe(false)
      expect(mockCreateAuditLog).not.toHaveBeenCalled()
    })

    it('returns true when user has permission', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'u1',
        role: ROLES.USER,
      } as never)
      const result = await hasPermission(fakeCookies, 'read:conversations')
      expect(result).toBe(true)
    })

    it('returns false when user lacks permission', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'u1',
        role: ROLES.USER,
      } as never)
      const result = await hasPermission(fakeCookies, 'delete:users')
      expect(result).toBe(false)
    })

    it('logs audit for sensitive permission checks (granted)', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'u1',
        role: ROLES.ADMIN,
      } as never)
      await hasPermission(fakeCookies, 'manage:admin')
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        'access',
        'permission_check',
        'u1',
        'access_control',
        { permission: 'manage:admin', granted: true },
      )
    })

    it('logs audit for sensitive permission checks (denied)', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'u1',
        role: ROLES.USER,
      } as never)
      await hasPermission(fakeCookies, 'delete:users')
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        'access',
        'permission_check',
        'u1',
        'access_control',
        { permission: 'delete:users', granted: false },
      )
    })

    it('logs audit for admin-resource permission checks', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'u1',
        role: ROLES.STAFF,
      } as never)
      await hasPermission(fakeCookies, 'read:admin')
      expect(mockCreateAuditLog).toHaveBeenCalled()
    })

    it('does NOT log audit for non-sensitive permission checks', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'u1',
        role: ROLES.USER,
      } as never)
      await hasPermission(fakeCookies, 'read:conversations')
      expect(mockCreateAuditLog).not.toHaveBeenCalled()
    })
  })

  describe('isAdmin', () => {
    it('returns true when user is admin', async () => {
      mockHasRole.mockResolvedValue(true)
      expect(await isAdmin(fakeCookies)).toBe(true)
      expect(mockHasRole).toHaveBeenCalledWith(fakeCookies, ROLES.ADMIN)
    })

    it('returns false when user is not admin', async () => {
      mockHasRole.mockResolvedValue(false)
      expect(await isAdmin(fakeCookies)).toBe(false)
    })
  })

  describe('isStaffOrAdmin', () => {
    it('returns false when no user is signed in', async () => {
      mockGetCurrentUser.mockResolvedValue(null)
      expect(await isStaffOrAdmin(fakeCookies)).toBe(false)
    })

    it('returns true for STAFF role', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'u1',
        role: ROLES.STAFF,
      } as never)
      expect(await isStaffOrAdmin(fakeCookies)).toBe(true)
    })

    it('returns true for ADMIN role', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'u1',
        role: ROLES.ADMIN,
      } as never)
      expect(await isStaffOrAdmin(fakeCookies)).toBe(true)
    })

    it('returns false for USER role', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'u1',
        role: ROLES.USER,
      } as never)
      expect(await isStaffOrAdmin(fakeCookies)).toBe(false)
    })
  })

  describe('requirePermission middleware', () => {
    it('redirects to signin when no user is signed in', async () => {
      mockGetCurrentUser.mockResolvedValue(null)
      const middleware = requirePermission('read:conversations')
      const result = await middleware({
        cookies: fakeCookies,
        redirect: fakeRedirect,
      })
      expect(result).toBeInstanceOf(Response)
      expect(result!.headers.get('location')).toContain('/signin')
    })

    it('redirects to dashboard when user lacks permission', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'u1',
        role: ROLES.USER,
      } as never)
      const middleware = requirePermission('delete:users')
      const result = await middleware({
        cookies: fakeCookies,
        redirect: fakeRedirect,
      })
      expect(result).toBeInstanceOf(Response)
      expect(result!.headers.get('location')).toContain('/dashboard')
    })

    it('returns null when user has permission', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'u1',
        role: ROLES.ADMIN,
      } as never)
      const middleware = requirePermission('manage:admin')
      const result = await middleware({
        cookies: fakeCookies,
        redirect: fakeRedirect,
      })
      expect(result).toBeNull()
    })

    it('always logs audit for permission checks', async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: 'u1',
        role: ROLES.ADMIN,
      } as never)
      const middleware = requirePermission('read:conversations')
      await middleware({ cookies: fakeCookies, redirect: fakeRedirect })
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        'access',
        'permission_check',
        'u1',
        'access_control',
        { permission: 'read:conversations', granted: true },
      )
    })
  })

  describe('Role and Permission type contracts', () => {
    it('ROLES contains expected values', () => {
      expect(ROLES.USER).toBe('user')
      expect(ROLES.STAFF).toBe('staff')
      expect(ROLES.ADMIN).toBe('admin')
    })

    it('Permission template literal type covers all action:resource combos', () => {
      const permissions: Permission[] = [
        'create:conversations',
        'read:conversations',
        'update:conversations',
        'delete:conversations',
        'list:conversations',
        'create:messages',
        'read:messages',
        'update:messages',
        'delete:messages',
        'read:users',
        'update:users',
        'delete:users',
        'list:users',
        'read:settings',
        'update:settings',
        'read:admin',
        'manage:admin',
      ]
      expect(permissions).toHaveLength(17)
    })
  })
})
