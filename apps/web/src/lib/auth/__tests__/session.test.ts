/** @vitest-environment node */

/**
 * PIX-215 PR3: Session shape + workspace-scoped RBAC tests.
 *
 * Covers:
 *  - getSessionFromToken populates workspaceId + roles from app_metadata
 *  - getSessionFromToken falls back to [role] when app_metadata.roles is absent
 *  - getSessionFromToken returns undefined workspaceId when absent
 *  - getUserRoles falls back to [user.role] when user.roles is empty/missing
 *  - hasWorkspaceRole: match, wrong workspace, wrong role
 *  - hasAnyWorkspaceRole: match, partial match, wrong workspace
 *  - hasWorkspaceAccess: match, no workspaceId, wrong workspace
 */

import { describe, expect, it } from 'vitest'

import {
  getSessionFromToken,
  getUserRoles,
  hasAnyWorkspaceRole,
  hasWorkspaceAccess,
  hasWorkspaceRole,
} from '../session'

function tokenWithPayload(
  overrides: Record<string, unknown> = {},
): Parameters<typeof getSessionFromToken>[0] {
  return {
    valid: true,
    userId: 'auth0|user-1',
    role: 'therapist',
    expiresAt: 1_700_000_000,
    payload: { ...overrides },
  }
}

describe('getSessionFromToken — Session shape extensions', () => {
  it('populates workspaceId from app_metadata.workspaceId', () => {
    const session = getSessionFromToken(
      tokenWithPayload({
        app_metadata: { workspaceId: 'ws-alpha' },
      }),
    )
    expect(session?.workspaceId).toBe('ws-alpha')
  })

  it('populates roles from app_metadata.roles', () => {
    const session = getSessionFromToken(
      tokenWithPayload({
        app_metadata: { roles: ['therapist', 'researcher'] },
      }),
    )
    expect(session?.user.roles).toEqual(['therapist', 'researcher'])
  })

  it('falls back to [role] when app_metadata.roles is absent', () => {
    const session = getSessionFromToken(
      tokenWithPayload({ app_metadata: { workspaceId: 'ws-alpha' } }),
    )
    expect(session?.user.roles).toEqual(['therapist'])
  })

  it('returns undefined workspaceId when app_metadata is absent', () => {
    const session = getSessionFromToken(tokenWithPayload())
    expect(session?.workspaceId).toBeUndefined()
  })

  it('returns null for an invalid token', () => {
    const result = getSessionFromToken({
      valid: false,
      error: 'expired',
      payload: {},
    })
    expect(result).toBeNull()
  })

  it('returns null when userId is missing', () => {
    const result = getSessionFromToken({
      valid: true,
      role: 'therapist',
      payload: {},
    })
    expect(result).toBeNull()
  })

  it('ignores non-array roles in app_metadata', () => {
    const session = getSessionFromToken(
      tokenWithPayload({ app_metadata: { roles: 'therapist' } }),
    )
    expect(session?.user.roles).toEqual(['therapist'])
  })

  it('filters non-string entries from roles array', () => {
    const session = getSessionFromToken(
      tokenWithPayload({
        app_metadata: { roles: ['therapist', 42, null, 'researcher'] },
      }),
    )
    expect(session?.user.roles).toEqual(['therapist', 'researcher'])
  })
})

describe('getUserRoles', () => {
  it('returns user.roles when present and non-empty', () => {
    expect(
      getUserRoles({
        user: { id: 'u1', role: 'therapist', roles: ['therapist', 'admin'] },
        expires: '2099-01-01T00:00:00.000Z',
      }),
    ).toEqual(['therapist', 'admin'])
  })

  it('falls back to [user.role] when user.roles is empty', () => {
    expect(
      getUserRoles({
        user: { id: 'u1', role: 'therapist', roles: [] },
        expires: '2099-01-01T00:00:00.000Z',
      }),
    ).toEqual(['therapist'])
  })

  it('falls back to [user.role] when user.roles is undefined', () => {
    expect(
      getUserRoles({
        user: { id: 'u1', role: 'patient' },
        expires: '2099-01-01T00:00:00.000Z',
      }),
    ).toEqual(['patient'])
  })
})

describe('hasWorkspaceRole', () => {
  const session = {
    user: {
      id: 'u1',
      role: 'therapist',
      roles: ['therapist', 'researcher'],
    },
    workspaceId: 'ws-alpha',
    expires: '2099-01-01T00:00:00.000Z',
  }

  it('returns true when workspace matches and role is in roles[]', () => {
    expect(hasWorkspaceRole(session, 'ws-alpha', 'therapist')).toBe(true)
  })

  it('returns true for second role in roles[]', () => {
    expect(hasWorkspaceRole(session, 'ws-alpha', 'researcher')).toBe(true)
  })

  it('returns false when workspace does not match', () => {
    expect(hasWorkspaceRole(session, 'ws-bravo', 'therapist')).toBe(false)
  })

  it('returns false when role is not in roles[]', () => {
    expect(hasWorkspaceRole(session, 'ws-alpha', 'admin')).toBe(false)
  })

  it('returns false when session has no workspaceId (system-level)', () => {
    const sysSession = {
      user: { id: 'u1', role: 'admin' },
      expires: '2099-01-01T00:00:00.000Z',
    }
    expect(hasWorkspaceRole(sysSession, 'ws-alpha', 'admin')).toBe(false)
  })
})

describe('hasAnyWorkspaceRole', () => {
  const session = {
    user: {
      id: 'u1',
      role: 'therapist',
      roles: ['therapist', 'researcher'],
    },
    workspaceId: 'ws-alpha',
    expires: '2099-01-01T00:00:00.000Z',
  }

  it('returns true when one of the required roles matches', () => {
    expect(
      hasAnyWorkspaceRole(session, 'ws-alpha', ['admin', 'therapist']),
    ).toBe(true)
  })

  it('returns false when none of the required roles match', () => {
    expect(hasAnyWorkspaceRole(session, 'ws-alpha', ['admin', 'owner'])).toBe(
      false,
    )
  })

  it('returns false when workspace does not match', () => {
    expect(hasAnyWorkspaceRole(session, 'ws-bravo', ['therapist'])).toBe(false)
  })

  it('returns false when requiredRoles is empty', () => {
    expect(hasAnyWorkspaceRole(session, 'ws-alpha', [])).toBe(false)
  })
})

describe('hasWorkspaceAccess', () => {
  it('returns true when workspace matches and user has roles', () => {
    expect(
      hasWorkspaceAccess(
        {
          user: { id: 'u1', role: 'therapist' },
          workspaceId: 'ws-alpha',
          expires: '2099-01-01T00:00:00.000Z',
        },
        'ws-alpha',
      ),
    ).toBe(true)
  })

  it('returns false when workspace does not match', () => {
    expect(
      hasWorkspaceAccess(
        {
          user: { id: 'u1', role: 'therapist' },
          workspaceId: 'ws-alpha',
          expires: '2099-01-01T00:00:00.000Z',
        },
        'ws-bravo',
      ),
    ).toBe(false)
  })

  it('returns false when session has no workspaceId', () => {
    expect(
      hasWorkspaceAccess(
        {
          user: { id: 'u1', role: 'admin' },
          expires: '2099-01-01T00:00:00.000Z',
        },
        'ws-alpha',
      ),
    ).toBe(false)
  })
})
