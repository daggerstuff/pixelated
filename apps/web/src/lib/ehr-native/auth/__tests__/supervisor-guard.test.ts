// @vitest-environment node
import { describe, it, expect } from 'vitest'

import {
  isSupervisorRole,
  requireSupervisorRole,
  SUPERVISOR_ROLE,
  SUPERVISOR_ALLOWED_ROLES,
} from '../supervisor-guard'

describe('supervisor-guard', () => {
  describe('isSupervisorRole', () => {
    it('returns true for ehr:supervisor', () => {
      expect(isSupervisorRole('ehr:supervisor')).toBe(true)
    })

    it('returns true for supervisor', () => {
      expect(isSupervisorRole('supervisor')).toBe(true)
    })

    it('returns true for admin, systemAdmin, physician', () => {
      expect(isSupervisorRole('admin')).toBe(true)
      expect(isSupervisorRole('systemAdmin')).toBe(true)
      expect(isSupervisorRole('physician')).toBe(true)
    })

    it('returns false for unauthorized roles', () => {
      expect(isSupervisorRole('patient')).toBe(false)
      expect(isSupervisorRole('ehr:client')).toBe(false)
      expect(isSupervisorRole('ehr:biller')).toBe(false)
      expect(isSupervisorRole('frontDesk')).toBe(false)
      expect(isSupervisorRole('guest')).toBe(false)
    })
  })

  describe('requireSupervisorRole', () => {
    it('allows authorized supervisor roles with RLS context', () => {
      const outcome = requireSupervisorRole(
        'ehr:supervisor',
        'user-sup-1',
        'tenant-001',
      )
      expect(outcome.allowed).toBe(true)
      if (outcome.allowed) {
        expect(outcome.rlsContext.userId).toBe('user-sup-1')
        expect(outcome.rlsContext.role).toBe('ehr:supervisor')
        expect(outcome.rlsContext.tenantId).toBe('tenant-001')
      }
    })

    it('denies unauthorized roles with 403 response', async () => {
      const outcome = requireSupervisorRole(
        'therapist',
        'user-002',
        'tenant-001',
      )
      expect(outcome.allowed).toBe(false)
      if (!outcome.allowed) {
        expect(outcome.response.status).toBe(403)
        const body = await outcome.response.json()
        expect(body.error.code).toBe('forbidden')
        expect(body.error.message).toContain('ehr:supervisor')
      }
    })
  })

  describe('constants', () => {
    it('exports SUPERVISOR_ROLE as ehr:supervisor', () => {
      expect(SUPERVISOR_ROLE).toBe('ehr:supervisor')
    })

    it('includes all required roles in SUPERVISOR_ALLOWED_ROLES', () => {
      expect(SUPERVISOR_ALLOWED_ROLES.has('ehr:supervisor')).toBe(true)
      expect(SUPERVISOR_ALLOWED_ROLES.has('supervisor')).toBe(true)
      expect(SUPERVISOR_ALLOWED_ROLES.has('admin')).toBe(true)
    })
  })
})
