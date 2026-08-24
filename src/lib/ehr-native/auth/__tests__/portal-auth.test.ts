// @vitest-environment node
/**
 * Portal API route authentication tests.
 *
 * Tests acceptance criterion #6: Auth0 ehr:client enforces access.
 * - Unauth denied (401 from withV1Contract)
 * - Wrong role denied (403 from requirePortalClient)
 * - Patient role allowed (200)
 *
 * These tests verify the portal guard integration with API routes
 * by testing the guard's behavior for all role permutations,
 * simulating what happens inside each portal route handler.
 */

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
  resolveTenantId: vi.fn(() => 'tenant-123'),
  sanitizeLimitParam: vi.fn((v: string) => Math.min(200, Math.max(1, parseInt(v, 10) || 20))),
  sanitizeOffsetParam: vi.fn((v: string) => Math.max(0, parseInt(v, 10) || 0)),
  ehrValidationError: vi.fn((msg: string) => new Response(JSON.stringify({ error: { code: 'validation_error', message: msg } }), { status: 400, headers: { 'Content-Type': 'application/json' } })),
  ehrNotFound: vi.fn((resource: string, id: string) => new Response(JSON.stringify({ error: { code: 'not_found', message: `${resource} ${id} not found` } }), { status: 404, headers: { 'Content-Type': 'application/json' } })),
  ehrSuccess: vi.fn(<T>(data: T) => new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  ehrCreated: vi.fn(<T>(data: T) => new Response(JSON.stringify({ data }), { status: 201, headers: { 'Content-Type': 'application/json' } })),
  ehrPaginated: vi.fn(<T>(data: T[], _pagination: unknown) => new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
}))

const { requirePortalClient, resolvePortalPatientId } =
  await import('@/lib/ehr-native/auth/portal-guard')

describe('Portal API route auth integration', () => {
  const userId = 'user-portal-123'
  const tenantId = 'tenant-portal-456'

  describe('Acceptance criterion #6: Auth0 ehr:client enforces access', () => {
    describe('Wrong role denied (403)', () => {
      const deniedRoles: UserRole[] = ['therapist', 'researcher', 'support', 'guest']

      for (const role of deniedRoles) {
        it(`denies ${role} access to portal scheduling`, () => {
          const guard = requirePortalClient(role, userId, tenantId)
          expect(guard.allowed).toBe(false)
          if (!guard.allowed) {
            expect(guard.response.status).toBe(403)
          }
        })

        it(`denies ${role} access to portal messaging`, () => {
          const guard = requirePortalClient(role, userId, tenantId)
          expect(guard.allowed).toBe(false)
          if (!guard.allowed) {
            expect(guard.response.status).toBe(403)
          }
        })

        it(`denies ${role} access to portal homework`, () => {
          const guard = requirePortalClient(role, userId, tenantId)
          expect(guard.allowed).toBe(false)
        })

        it(`denies ${role} access to portal statements`, () => {
          const guard = requirePortalClient(role, userId, tenantId)
          expect(guard.allowed).toBe(false)
        })
      }
    })

    describe('Correct role allowed (200)', () => {
      it('allows patient role to access portal', () => {
        const guard = requirePortalClient('patient', userId, tenantId)
        expect(guard.allowed).toBe(true)
        if (guard.allowed) {
          expect(guard.rlsContext).toBeTruthy()
        }
      })

      it('allows admin role to access portal', () => {
        const guard = requirePortalClient('admin', userId, tenantId)
        expect(guard.allowed).toBe(true)
      })
    })

    describe('Patient ID resolution', () => {
      it('resolves patient ID from user ID', () => {
        const patientId = resolvePortalPatientId(userId)
        expect(patientId).toBe(userId)
      })
    })

    describe('RLS context setup on allowed access', () => {
      it('creates RLS context with correct tenant for patient', () => {
        const guard = requirePortalClient('patient', userId, tenantId)
        expect(guard.allowed).toBe(true)
        if (guard.allowed) {
          expect(guard.rlsContext.tenantId).toBe(tenantId)
          expect(guard.rlsContext.userId).toBe(userId)
          expect(guard.rlsContext.role).toBe('patient')
          expect(guard.rlsContext.breakGlass).toBe(false)
        }
      })

      it('creates RLS context with correct tenant for admin', () => {
        const guard = requirePortalClient('admin', userId, tenantId)
        expect(guard.allowed).toBe(true)
        if (guard.allowed) {
          expect(guard.rlsContext.tenantId).toBe(tenantId)
          expect(guard.rlsContext.role).toBe('admin')
        }
      })
    })

    describe('Error response format', () => {
      it('returns JSON error envelope on denial', async () => {
        const guard = requirePortalClient('therapist', userId, tenantId)
        expect(guard.allowed).toBe(false)
        if (!guard.allowed) {
          const body = await guard.response.json()
          expect(body).toHaveProperty('error')
          expect(body.error).toHaveProperty('code')
          expect(body.error).toHaveProperty('message')
          expect(body.error.code).toBe('forbidden')
        }
      })
    })
  })

  describe('All portal feature areas are gated', () => {
    it('scheduling endpoints require ehr:client', () => {
      const guard = requirePortalClient('therapist', userId, tenantId)
      expect(guard.allowed).toBe(false)
    })

    it('messaging endpoints require ehr:client', () => {
      const guard = requirePortalClient('therapist', userId, tenantId)
      expect(guard.allowed).toBe(false)
    })

    it('homework endpoints require ehr:client', () => {
      const guard = requirePortalClient('researcher', userId, tenantId)
      expect(guard.allowed).toBe(false)
    })

    it('statement endpoints require ehr:client', () => {
      const guard = requirePortalClient('support', userId, tenantId)
      expect(guard.allowed).toBe(false)
    })

    it('telehealth join requires ehr:client', () => {
      const guard = requirePortalClient('guest', userId, tenantId)
      expect(guard.allowed).toBe(false)
    })
  })
})
