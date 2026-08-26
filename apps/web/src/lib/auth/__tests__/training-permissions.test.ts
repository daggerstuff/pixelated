/**
 * Training RBAC Permissions — PIX-3938
 *
 * Matrix snapshot test for the 8 training-specific permissions:
 *   manage:fine_tuning, start:training_jobs, read:training_jobs,
 *   cancel:training_jobs, manage:training_sessions, read:own_training_sessions,
 *   write:training_feedback, manage:training_data
 *
 * Each role's grant/revoke matrix must be verified:
 *   admin → full set (wildcard)
 *   researcher → start:training_jobs, read:training_jobs, manage:training_data
 *   therapist → read:own_training_sessions, write:training_feedback
 *   patient/support/guest → none
 *
 * Regression: existing (non-training) permissions remain unchanged.
 */

import { describe, it, expect } from 'vitest'

import {
  hasPermission,
  PERMISSION_DEFINITIONS,
  ROLE_DEFINITIONS,
} from '../roles'
import type { UserRole } from '../roles'

const TRAINING_PERMISSIONS = [
  'manage:fine_tuning',
  'start:training_jobs',
  'read:training_jobs',
  'cancel:training_jobs',
  'manage:training_sessions',
  'read:own_training_sessions',
  'write:training_feedback',
  'manage:training_data',
] as const

// ── Admin: wildcard grants everything ─────────────────────────────────

describe('admin — training permissions', () => {
  for (const perm of TRAINING_PERMISSIONS) {
    it(`has "${perm}" (via wildcard)`, () => {
      expect(hasPermission('admin', perm)).toBe(true)
    })
  }
})

// ── Researcher: start + read jobs, manage data ────────────────────────

describe('researcher — training permissions', () => {
  it('has "start:training_jobs"', () => {
    expect(hasPermission('researcher', 'start:training_jobs')).toBe(true)
  })
  it('has "read:training_jobs"', () => {
    expect(hasPermission('researcher', 'read:training_jobs')).toBe(true)
  })
  it('has "manage:training_data"', () => {
    expect(hasPermission('researcher', 'manage:training_data')).toBe(true)
  })

  it('is denied "manage:fine_tuning"', () => {
    expect(hasPermission('researcher', 'manage:fine_tuning')).toBe(false)
  })
  it('is denied "cancel:training_jobs"', () => {
    expect(hasPermission('researcher', 'cancel:training_jobs')).toBe(false)
  })
  it('is denied "manage:training_sessions"', () => {
    expect(hasPermission('researcher', 'manage:training_sessions')).toBe(false)
  })
  it('is denied "read:own_training_sessions"', () => {
    expect(hasPermission('researcher', 'read:own_training_sessions')).toBe(
      false,
    )
  })
  it('is denied "write:training_feedback"', () => {
    expect(hasPermission('researcher', 'write:training_feedback')).toBe(false)
  })
})

// ── Therapist: own sessions + feedback ────────────────────────────────

describe('therapist — training permissions', () => {
  it('has "read:own_training_sessions"', () => {
    expect(hasPermission('therapist', 'read:own_training_sessions')).toBe(true)
  })
  it('has "write:training_feedback"', () => {
    expect(hasPermission('therapist', 'write:training_feedback')).toBe(true)
  })

  const DENIED_THERAPIST = [
    'manage:fine_tuning',
    'start:training_jobs',
    'read:training_jobs',
    'cancel:training_jobs',
    'manage:training_sessions',
    'manage:training_data',
  ] as const
  for (const perm of DENIED_THERAPIST) {
    it(`is denied "${perm}"`, () => {
      expect(hasPermission('therapist', perm)).toBe(false)
    })
  }
})

// ── Patient / Support / Guest: no training access ─────────────────────

describe.each(['patient', 'support', 'guest'] as UserRole[])(
  '%s — no training permissions',
  (role) => {
    for (const perm of TRAINING_PERMISSIONS) {
      it(`is denied "${perm}"`, () => {
        expect(hasPermission(role, perm)).toBe(false)
      })
    }
  },
)

// ── Regression: existing permissions remain intact ────────────────────

describe('regression — existing permissions unchanged', () => {
  it('therapist still has "read:patients"', () => {
    expect(hasPermission('therapist', 'read:patients')).toBe(true)
  })
  it('admin still has "read:patient_assessments"', () => {
    expect(hasPermission('admin', 'read:patient_assessments')).toBe(true)
  })
  it('researcher still has "read:anonymized_data"', () => {
    expect(hasPermission('researcher', 'read:anonymized_data')).toBe(true)
  })
  it('patient still has "read:own_profile"', () => {
    expect(hasPermission('patient', 'read:own_profile')).toBe(true)
  })
})

// ── Permission definitions audit ──────────────────────────────────────

describe('PERMISSION_DEFINITIONS — training category entries', () => {
  for (const perm of TRAINING_PERMISSIONS) {
    it(`has entry for "${perm}"`, () => {
      const def = PERMISSION_DEFINITIONS[perm]
      expect(def).toBeDefined()
      expect(def.category).toBe('training')
      expect(def.auditRequired).toBe(true)
    })
  }
})
