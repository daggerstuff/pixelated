// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { UserRole } from '@/lib/auth/roles'

// Mock createEHRRLSContext
vi.mock('@/lib/ehr-native/api', () => ({
  createEHRRLSContext: vi.fn((userId: string, role: string, tenantId: string, breakGlass = false) => ({
    tenantId,
    userId,
    role,
    breakGlass,
  })),
}))

const { requirePortalClient, resolvePortalPatientId, PORTAL_CLIENT_ROLE } =
  await import('@/lib/ehr-native/auth/portal-guard')

describe('portal-guard', () => {
  const userId = 'patient-uuid-1234'
  const tenantId = 'tenant-uuid-5678'

  describe('requirePortalClient', () => {
    it('allows patient role', () => {
      const result = requirePortalClient('patient', userId, tenantId)
      expect(result.allowed).toBe(true)
      if (result.allowed) {
        expect(result.rlsContext.userId).toBe(userId)
        expect(result.rlsContext.tenantId).toBe(tenantId)
        expect(result.rlsContext.role).toBe('patient')
        expect(result.rlsContext.breakGlass).toBe(false)
      }
    })

    it('allows admin role', () => {
      const result = requirePortalClient('admin', userId, tenantId)
      expect(result.allowed).toBe(true)
      if (result.allowed) {
        expect(result.rlsContext.role).toBe('admin')
      }
    })

    it('denies therapist role with 403', async () => {
      const result = requirePortalClient('therapist', userId, tenantId)
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.response.status).toBe(403)
        const body = await result.response.json()
        expect(body.error.code).toBe('forbidden')
        expect(body.error.message).toContain('ehr:client')
      }
    })

    it('denies researcher role with 403', async () => {
      const result = requirePortalClient('researcher', userId, tenantId)
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.response.status).toBe(403)
      }
    })

    it('denies support role with 403', async () => {
      const result = requirePortalClient('support', userId, tenantId)
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.response.status).toBe(403)
      }
    })

    it('denies guest role with 403', async () => {
      const result = requirePortalClient('guest', userId, tenantId)
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.response.status).toBe(403)
      }
    })

    it('denies with descriptive error message for wrong roles', async () => {
      const result = requirePortalClient('therapist', userId, tenantId)
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        const body = await result.response.json()
        expect(body.error.message).toContain('not authorized')
      }
    })

    it('sets Content-Type to application/json on denial', () => {
      const result = requirePortalClient('therapist', userId, tenantId)
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.response.headers.get('Content-Type')).toBe('application/json')
      }
    })

    it('exports PORTAL_CLIENT_ROLE constant', () => {
      expect(PORTAL_CLIENT_ROLE).toBe('ehr:client')
    })
  })

  describe('resolvePortalPatientId', () => {
    it('returns the user ID as patient ID', () => {
      expect(resolvePortalPatientId(userId)).toBe(userId)
    })

    it('returns same ID for different user IDs', () => {
      expect(resolvePortalPatientId('user-aaa')).toBe('user-aaa')
      expect(resolvePortalPatientId('user-bbb')).toBe('user-bbb')
    })
  })

  describe('all UserRole values', () => {
    const roles: UserRole[] = ['admin', 'therapist', 'patient', 'researcher', 'support', 'guest']
    const allowedRoles: UserRole[] = ['patient', 'admin']

    for (const role of roles) {
      it(`${role} role → ${allowedRoles.includes(role) ? 'allowed' : 'denied'}`, () => {
        const result = requirePortalClient(role, userId, tenantId)
        expect(result.allowed).toBe(allowedRoles.includes(role))
      })
    }
  })
})
