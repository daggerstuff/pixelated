import { describe, it, expect } from 'vitest'

import { checkPermission, UserPermissions } from './rbac'

describe('checkPermission', () => {
  it('should return true when user has the exact permission', () => {
    const user: UserPermissions = {
      userId: 'user-1',
      roles: ['user'],
      permissions: [
        { resource: 'article', action: 'read' },
        { resource: 'profile', action: 'update' },
      ],
    }
    expect(checkPermission(user, 'article', 'read')).toBe(true)
  })

  it('should return false when user has the resource but wrong action', () => {
    const user: UserPermissions = {
      userId: 'user-1',
      roles: ['user'],
      permissions: [{ resource: 'article', action: 'read' }],
    }
    expect(checkPermission(user, 'article', 'update')).toBe(false)
  })

  it('should return false when user has the action but wrong resource', () => {
    const user: UserPermissions = {
      userId: 'user-1',
      roles: ['user'],
      permissions: [{ resource: 'article', action: 'read' }],
    }
    expect(checkPermission(user, 'profile', 'read')).toBe(false)
  })

  it('should return false when user has no permissions', () => {
    const user: UserPermissions = {
      userId: 'user-1',
      roles: ['user'],
      permissions: [],
    }
    expect(checkPermission(user, 'article', 'read')).toBe(false)
  })

  it('should handle undefined action or resource gracefully if passed (testing string equality)', () => {
    const user: UserPermissions = {
      userId: 'user-1',
      roles: ['user'],
      permissions: [{ resource: 'article', action: 'read' }],
    }
    // Technically typescript would prevent passing undefined unless we use any/as string
    expect(checkPermission(user, undefined as unknown as string, 'read')).toBe(
      false,
    )
    expect(
      checkPermission(user, 'article', undefined as unknown as string),
    ).toBe(false)
  })
})
