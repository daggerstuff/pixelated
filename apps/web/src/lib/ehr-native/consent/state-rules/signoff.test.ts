/**
 * Tests for EHR Native attorney sign-off schemas and repository (G3.1 Legal Review Framework)
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest'

import {
  SignoffStatusSchema,
  AttorneySignoffSchema,
  CreateSignoffInputSchema,
  UpdateSignoffInputSchema,
  isValidSignoffTransition,
  getAllowedTransitions,
  validateSignoffTransition,
  SIGNOFF_ALLOWED_TRANSITIONS,
} from './signoff'
import { attorneySignoffRepository } from './signoff-repository'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const ATTORNEY_ID = '550e8400-e29b-41d4-a716-446655440000'
const STATE_CODE = 'CA'

const validCreateInput = {
  stateCode: STATE_CODE,
  attorneyId: ATTORNEY_ID,
  attorneyName: 'Jane Doe',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('G3.1 attorney sign-off schemas', () => {
  describe('SignoffStatusSchema', () => {
    it('accepts all valid statuses', () => {
      for (const s of [
        'pending',
        'in_review',
        'approved',
        'rejected',
        'withdrawn',
      ]) {
        expect(SignoffStatusSchema.parse(s)).toBe(s)
      }
    })

    it('rejects invalid status', () => {
      expect(() => SignoffStatusSchema.parse('draft')).toThrow()
      expect(() => SignoffStatusSchema.parse('active')).toThrow()
    })
  })

  describe('CreateSignoffInputSchema', () => {
    it('accepts minimal valid input', () => {
      const result = CreateSignoffInputSchema.parse(validCreateInput)
      expect(result.stateCode).toBe(STATE_CODE)
    })

    it('accepts optional fields', () => {
      const input = {
        ...validCreateInput,
        attorneyBarNumber: 'CA-12345',
        expiresAt: '2026-01-15',
        notes: 'Initial review',
      }
      expect(() => CreateSignoffInputSchema.parse(input)).not.toThrow()
    })

    it('rejects invalid state code', () => {
      expect(() =>
        CreateSignoffInputSchema.parse({
          ...validCreateInput,
          stateCode: 'XX',
        }),
      ).toThrow()
    })

    it('rejects invalid attorneyId (not uuid)', () => {
      expect(() =>
        CreateSignoffInputSchema.parse({
          ...validCreateInput,
          attorneyId: 'not-a-uuid',
        }),
      ).toThrow()
    })

    it('rejects empty attorneyName', () => {
      expect(() =>
        CreateSignoffInputSchema.parse({
          ...validCreateInput,
          attorneyName: '',
        }),
      ).toThrow()
    })

    it('rejects attorneyName over 200 chars', () => {
      expect(() =>
        CreateSignoffInputSchema.parse({
          ...validCreateInput,
          attorneyName: 'x'.repeat(201),
        }),
      ).toThrow()
    })

    it('rejects unknown extra fields (strict mode)', () => {
      expect(() =>
        CreateSignoffInputSchema.parse({ ...validCreateInput, extra: 'no' }),
      ).toThrow()
    })
  })

  describe('UpdateSignoffInputSchema', () => {
    it('accepts valid status update', () => {
      expect(() =>
        UpdateSignoffInputSchema.parse({ status: 'in_review' }),
      ).not.toThrow()
    })

    it('accepts notes with update', () => {
      expect(() =>
        UpdateSignoffInputSchema.parse({ status: 'approved', notes: 'LGTM' }),
      ).not.toThrow()
    })

    it('rejects invalid status', () => {
      expect(() =>
        UpdateSignoffInputSchema.parse({ status: 'draft' }),
      ).toThrow()
    })

    it('rejects unknown extra fields (strict mode)', () => {
      expect(() =>
        UpdateSignoffInputSchema.parse({ status: 'approved', extra: 'no' }),
      ).toThrow()
    })
  })

  describe('AttorneySignoffSchema', () => {
    it('accepts a fully populated sign-off', () => {
      const signoff = {
        signoffId: '550e8400-e29b-41d4-a716-446655440001',
        stateCode: STATE_CODE,
        attorneyId: ATTORNEY_ID,
        attorneyName: 'Jane Doe',
        attorneyBarNumber: 'CA-12345',
        status: 'approved',
        signedAt: '2025-01-15T10:00:00.000Z',
        expiresAt: '2026-01-15',
        notes: 'Approved after review',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-15T10:00:00.000Z',
      }
      expect(() => AttorneySignoffSchema.parse(signoff)).not.toThrow()
    })

    it('accepts minimal sign-off with nullable fields null', () => {
      const signoff = {
        signoffId: '550e8400-e29b-41d4-a716-446655440001',
        stateCode: STATE_CODE,
        attorneyId: ATTORNEY_ID,
        attorneyName: 'Jane Doe',
        status: 'pending',
        signedAt: null,
        expiresAt: null,
        notes: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      }
      expect(() => AttorneySignoffSchema.parse(signoff)).not.toThrow()
    })

    it('rejects unknown extra fields (strict mode)', () => {
      const signoff = {
        signoffId: '550e8400-e29b-41d4-a716-446655440001',
        stateCode: STATE_CODE,
        attorneyId: ATTORNEY_ID,
        attorneyName: 'Jane Doe',
        status: 'pending',
        signedAt: null,
        expiresAt: null,
        notes: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        extra: 'no',
      }
      expect(() => AttorneySignoffSchema.parse(signoff)).toThrow()
    })
  })
})

describe('G3.1 sign-off state machine', () => {
  describe('isValidSignoffTransition', () => {
    it('pending → in_review is valid', () => {
      expect(isValidSignoffTransition('pending', 'in_review')).toBe(true)
    })

    it('in_review → approved is valid', () => {
      expect(isValidSignoffTransition('in_review', 'approved')).toBe(true)
    })

    it('in_review → rejected is valid', () => {
      expect(isValidSignoffTransition('in_review', 'rejected')).toBe(true)
    })

    it('approved → withdrawn is valid', () => {
      expect(isValidSignoffTransition('approved', 'withdrawn')).toBe(true)
    })

    it('pending → approved is invalid (must go through in_review)', () => {
      expect(isValidSignoffTransition('pending', 'approved')).toBe(false)
    })

    it('rejected → approved is invalid (terminal)', () => {
      expect(isValidSignoffTransition('rejected', 'approved')).toBe(false)
    })

    it('withdrawn → pending is invalid (terminal)', () => {
      expect(isValidSignoffTransition('withdrawn', 'pending')).toBe(false)
    })

    it('pending → pending (self-transition) is invalid', () => {
      expect(isValidSignoffTransition('pending', 'pending')).toBe(false)
    })
  })

  describe('getAllowedTransitions', () => {
    it('pending allows only in_review', () => {
      expect(getAllowedTransitions('pending')).toEqual(['in_review'])
    })

    it('in_review allows approved and rejected', () => {
      const allowed = getAllowedTransitions('in_review').sort()
      expect(allowed).toEqual(['approved', 'rejected'])
    })

    it('approved allows only withdrawn', () => {
      expect(getAllowedTransitions('approved')).toEqual(['withdrawn'])
    })

    it('rejected allows nothing', () => {
      expect(getAllowedTransitions('rejected')).toEqual([])
    })

    it('withdrawn allows nothing', () => {
      expect(getAllowedTransitions('withdrawn')).toEqual([])
    })
  })

  describe('validateSignoffTransition', () => {
    it('does not throw for valid transition', () => {
      expect(() =>
        validateSignoffTransition('pending', 'in_review'),
      ).not.toThrow()
    })

    it('throws for invalid transition', () => {
      expect(() => validateSignoffTransition('pending', 'approved')).toThrow()
    })
  })

  it('SIGNOFF_ALLOWED_TRANSITIONS exports the full map', () => {
    expect(SIGNOFF_ALLOWED_TRANSITIONS).toBeDefined()
    expect(SIGNOFF_ALLOWED_TRANSITIONS.pending).toEqual(['in_review'])
    expect(SIGNOFF_ALLOWED_TRANSITIONS.in_review).toContain('approved')
    expect(SIGNOFF_ALLOWED_TRANSITIONS.in_review).toContain('rejected')
  })
})

describe('G3.1 AttorneySignoffRepository (in-memory)', () => {
  beforeEach(() => {
    attorneySignoffRepository.clear()
  })

  describe('create', () => {
    it('creates a sign-off with pending status', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      expect(s.status).toBe('pending')
      expect(s.stateCode).toBe(STATE_CODE)
      expect(s.attorneyId).toBe(ATTORNEY_ID)
      expect(s.attorneyName).toBe('Jane Doe')
      expect(s.signoffId).toBeDefined()
      expect(s.signedAt).toBeNull()
      expect(s.createdAt).toBeDefined()
      expect(s.updatedAt).toBeDefined()
    })

    it('generates a uuid signoffId', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      expect(s.signoffId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    })

    it('rejects invalid input', () => {
      expect(() =>
        attorneySignoffRepository.create({
          ...validCreateInput,
          stateCode: 'XX',
        }),
      ).toThrow()
    })
  })

  describe('getById', () => {
    it('returns the sign-off by id', () => {
      const created = attorneySignoffRepository.create(validCreateInput)
      const fetched = attorneySignoffRepository.getById(created.signoffId)
      expect(fetched).toBeDefined()
      expect(fetched?.signoffId).toBe(created.signoffId)
    })

    it('returns undefined for unknown id', () => {
      expect(
        attorneySignoffRepository.getById(
          '550e8400-e29b-41d4-a716-446655440099',
        ),
      ).toBeUndefined()
    })
  })

  describe('listByState', () => {
    it('returns sign-offs for a given state', () => {
      attorneySignoffRepository.create(validCreateInput)
      attorneySignoffRepository.create({
        ...validCreateInput,
        attorneyId: '550e8400-e29b-41d4-a716-446655440002',
      })
      const list = attorneySignoffRepository.listByState(STATE_CODE)
      expect(list).toHaveLength(2)
    })

    it('filters by status', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      attorneySignoffRepository.updateStatus(s.signoffId, 'in_review')
      const pending = attorneySignoffRepository.listByState(
        STATE_CODE,
        'pending',
      )
      const inReview = attorneySignoffRepository.listByState(
        STATE_CODE,
        'in_review',
      )
      expect(pending).toHaveLength(0)
      expect(inReview).toHaveLength(1)
    })

    it('returns empty for state with no sign-offs', () => {
      expect(attorneySignoffRepository.listByState('NY')).toHaveLength(0)
    })
  })

  describe('listByAttorney', () => {
    it('returns sign-offs for a given attorney', () => {
      attorneySignoffRepository.create(validCreateInput)
      attorneySignoffRepository.create({
        ...validCreateInput,
        stateCode: 'NY',
      })
      const list = attorneySignoffRepository.listByAttorney(ATTORNEY_ID)
      expect(list).toHaveLength(2)
    })
  })

  describe('listAll', () => {
    it('returns all sign-offs', () => {
      attorneySignoffRepository.create(validCreateInput)
      attorneySignoffRepository.create({
        ...validCreateInput,
        stateCode: 'NY',
        attorneyId: '550e8400-e29b-41d4-a716-446655440002',
      })
      expect(attorneySignoffRepository.listAll()).toHaveLength(2)
    })
  })

  describe('updateStatus', () => {
    it('transitions pending → in_review', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      const updated = attorneySignoffRepository.updateStatus(
        s.signoffId,
        'in_review',
      )
      expect(updated?.status).toBe('in_review')
    })

    it('sets signedAt when transitioning to approved', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      attorneySignoffRepository.updateStatus(s.signoffId, 'in_review')
      const approved = attorneySignoffRepository.updateStatus(
        s.signoffId,
        'approved',
      )
      expect(approved?.status).toBe('approved')
      expect(approved?.signedAt).toBeDefined()
    })

    it('sets signedAt when transitioning to rejected', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      attorneySignoffRepository.updateStatus(s.signoffId, 'in_review')
      const rejected = attorneySignoffRepository.updateStatus(
        s.signoffId,
        'rejected',
      )
      expect(rejected?.status).toBe('rejected')
      expect(rejected?.signedAt).toBeDefined()
    })

    it('throws on invalid transition', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      expect(() =>
        attorneySignoffRepository.updateStatus(s.signoffId, 'approved'),
      ).toThrow()
    })

    it('returns undefined for unknown id', () => {
      expect(
        attorneySignoffRepository.updateStatus(
          '550e8400-e29b-41d4-a716-446655440099',
          'in_review',
        ),
      ).toBeUndefined()
    })

    it('updates notes when provided', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      const updated = attorneySignoffRepository.updateStatus(
        s.signoffId,
        'in_review',
        'Reviewing now',
      )
      expect(updated?.notes).toBe('Reviewing now')
    })
  })

  describe('withdraw', () => {
    it('withdraws an approved sign-off', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      attorneySignoffRepository.updateStatus(s.signoffId, 'in_review')
      attorneySignoffRepository.updateStatus(s.signoffId, 'approved')
      const withdrawn = attorneySignoffRepository.withdraw(
        s.signoffId,
        'Revoked',
      )
      expect(withdrawn?.status).toBe('withdrawn')
      expect(withdrawn?.notes).toBe('Revoked')
    })

    it('throws when withdrawing a pending sign-off (must be approved first)', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      expect(() => attorneySignoffRepository.withdraw(s.signoffId)).toThrow()
    })
  })

  describe('size and clear', () => {
    it('size returns count', () => {
      attorneySignoffRepository.create(validCreateInput)
      expect(attorneySignoffRepository.size()).toBe(1)
    })

    it('clear empties the repository', () => {
      attorneySignoffRepository.create(validCreateInput)
      attorneySignoffRepository.clear()
      expect(attorneySignoffRepository.size()).toBe(0)
    })
  })
})
