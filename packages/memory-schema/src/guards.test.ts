import { describe, it, expect } from 'vitest'

import { isStanceShift, isSynthesisResult } from './guards'

/**
 * Canonical valid StanceShift for use across positive cases.
 *
 * Note: this deliberately uses values inside the [0, 1] range for
 * `confidence` because the Zod schema constrains it; the structural guard
 * is more permissive (it does not enforce the constraint — see below).
 */
const validStanceShift = {
  attribute: 'openness',
  oldValue: 0.3,
  newValue: 0.7,
  delta: 0.4,
  evidenceIds: ['mem-1', 'mem-2'],
  confidence: 0.85,
}

/** Canonical valid SynthesisResult for use across positive cases. */
const validSynthesisResult = {
  mergedIds: ['mem-1', 'mem-2', 'mem-3'],
  newMemoryId: 'mem-new',
  stanceShifts: [validStanceShift],
  compressionRatio: 1.5,
}

// ---------------------------------------------------------------------------
// isStanceShift
// ---------------------------------------------------------------------------

describe('isStanceShift', () => {
  describe('positive cases', () => {
    it('returns true for a fully-valid shift', () => {
      expect(isStanceShift(validStanceShift)).toBe(true)
    })

    it('returns true for a shift with an empty evidenceIds array', () => {
      expect(isStanceShift({ ...validStanceShift, evidenceIds: [] })).toBe(true)
    })

    it('returns true for a shift with zero delta (no change)', () => {
      expect(
        isStanceShift({
          ...validStanceShift,
          oldValue: 0.5,
          newValue: 0.5,
          delta: 0,
        }),
      ).toBe(true)
    })

    it('returns true for a shift with a negative delta', () => {
      expect(
        isStanceShift({
          ...validStanceShift,
          oldValue: 0.8,
          newValue: 0.2,
          delta: -0.6,
        }),
      ).toBe(true)
    })

    it('returns true for a shift with confidence at the lower boundary (0)', () => {
      expect(isStanceShift({ ...validStanceShift, confidence: 0 })).toBe(true)
    })

    it('returns true for a shift with confidence at the upper boundary (1)', () => {
      expect(isStanceShift({ ...validStanceShift, confidence: 1 })).toBe(true)
    })

    it('returns true for a shift with confidence outside [0, 1] (structural guard only)', () => {
      // The Zod schema (StanceShiftSchema) constrains confidence to [0, 1],
      // but the structural guard is intentionally more permissive — it only
      // checks shape, not value ranges. This is by design.
      expect(isStanceShift({ ...validStanceShift, confidence: 1.5 })).toBe(true)
      expect(isStanceShift({ ...validStanceShift, confidence: -0.1 })).toBe(
        true,
      )
    })

    it('returns true for a shift with a unicode attribute name', () => {
      expect(
        isStanceShift({ ...validStanceShift, attribute: 'öffenhéit' }),
      ).toBe(true)
    })
  })

  describe('negative cases', () => {
    it('returns false for null', () => {
      expect(isStanceShift(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isStanceShift(undefined)).toBe(false)
    })

    it('returns false for primitive strings', () => {
      expect(isStanceShift('a shift')).toBe(false)
    })

    it('returns false for primitive numbers', () => {
      expect(isStanceShift(42)).toBe(false)
    })

    it('returns false for primitive booleans', () => {
      expect(isStanceShift(true)).toBe(false)
    })

    it('returns false for an empty object', () => {
      expect(isStanceShift({})).toBe(false)
    })

    it('returns false when attribute is missing', () => {
      const { attribute: _a, ...rest } = validStanceShift
      expect(isStanceShift(rest)).toBe(false)
    })

    it('returns false when attribute is the wrong type (number)', () => {
      expect(isStanceShift({ ...validStanceShift, attribute: 123 })).toBe(false)
    })

    it('returns false when attribute is null', () => {
      expect(isStanceShift({ ...validStanceShift, attribute: null })).toBe(
        false,
      )
    })

    it('returns false when oldValue is missing', () => {
      const { oldValue: _o, ...rest } = validStanceShift
      expect(isStanceShift(rest)).toBe(false)
    })

    it('returns false when oldValue is a string', () => {
      expect(isStanceShift({ ...validStanceShift, oldValue: '0.3' })).toBe(
        false,
      )
    })

    it('returns false when newValue is missing', () => {
      const { newValue: _n, ...rest } = validStanceShift
      expect(isStanceShift(rest)).toBe(false)
    })

    it('returns false when newValue is null', () => {
      expect(isStanceShift({ ...validStanceShift, newValue: null })).toBe(false)
    })

    it('returns false when delta is missing', () => {
      const { delta: _d, ...rest } = validStanceShift
      expect(isStanceShift(rest)).toBe(false)
    })

    it('returns false when delta is a boolean', () => {
      expect(isStanceShift({ ...validStanceShift, delta: true })).toBe(false)
    })

    it('returns false when evidenceIds is not an array (string)', () => {
      expect(isStanceShift({ ...validStanceShift, evidenceIds: 'mem-1' })).toBe(
        false,
      )
    })

    it('returns false when evidenceIds is null', () => {
      expect(isStanceShift({ ...validStanceShift, evidenceIds: null })).toBe(
        false,
      )
    })

    it('returns false when evidenceIds is undefined (omitted)', () => {
      expect(
        isStanceShift({ ...validStanceShift, evidenceIds: undefined }),
      ).toBe(false)
    })

    it('returns false when evidenceIds contains a non-string element', () => {
      expect(
        isStanceShift({ ...validStanceShift, evidenceIds: ['mem-1', 42] }),
      ).toBe(false)
    })

    it('returns false when evidenceIds contains a null element', () => {
      expect(
        isStanceShift({ ...validStanceShift, evidenceIds: ['mem-1', null] }),
      ).toBe(false)
    })

    it('returns false when confidence is missing', () => {
      const { confidence: _c, ...rest } = validStanceShift
      expect(isStanceShift(rest)).toBe(false)
    })

    it('returns false when confidence is a string', () => {
      expect(isStanceShift({ ...validStanceShift, confidence: '0.85' })).toBe(
        false,
      )
    })
  })
})

// ---------------------------------------------------------------------------
// isSynthesisResult
// ---------------------------------------------------------------------------

describe('isSynthesisResult', () => {
  describe('positive cases', () => {
    it('returns true for a fully-valid result', () => {
      expect(isSynthesisResult(validSynthesisResult)).toBe(true)
    })

    it('returns true for a result with empty mergedIds and empty stanceShifts', () => {
      expect(
        isSynthesisResult({
          mergedIds: [],
          newMemoryId: 'mem-new',
          stanceShifts: [],
          compressionRatio: 1,
        }),
      ).toBe(true)
    })

    it('returns true for a result with multiple valid stance shifts', () => {
      expect(
        isSynthesisResult({
          ...validSynthesisResult,
          stanceShifts: [
            validStanceShift,
            { ...validStanceShift, attribute: 'defensiveness' },
          ],
        }),
      ).toBe(true)
    })

    it('returns true for a result with compressionRatio at 0', () => {
      expect(
        isSynthesisResult({ ...validSynthesisResult, compressionRatio: 0 }),
      ).toBe(true)
    })

    it('returns true for a result with compressionRatio at 1', () => {
      expect(
        isSynthesisResult({ ...validSynthesisResult, compressionRatio: 1 }),
      ).toBe(true)
    })

    it('returns true for a result with compressionRatio > 1 (typical case)', () => {
      expect(
        isSynthesisResult({ ...validSynthesisResult, compressionRatio: 5 }),
      ).toBe(true)
    })

    it('returns true for a result with compressionRatio outside [0, 1] (structural guard only)', () => {
      // Same intentional permissiveness as isStanceShift for confidence.
      // The Zod schema constrains compressionRatio to [0, 1]; the guard does not.
      expect(
        isSynthesisResult({ ...validSynthesisResult, compressionRatio: 99 }),
      ).toBe(true)
    })
  })

  describe('negative cases', () => {
    it('returns false for null', () => {
      expect(isSynthesisResult(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isSynthesisResult(undefined)).toBe(false)
    })

    it('returns false for an empty object', () => {
      expect(isSynthesisResult({})).toBe(false)
    })

    it('returns false when mergedIds is not an array (string)', () => {
      expect(
        isSynthesisResult({ ...validSynthesisResult, mergedIds: 'mem-1' }),
      ).toBe(false)
    })

    it('returns false when mergedIds is null', () => {
      expect(
        isSynthesisResult({ ...validSynthesisResult, mergedIds: null }),
      ).toBe(false)
    })

    it('returns false when mergedIds is undefined (omitted)', () => {
      expect(
        isSynthesisResult({ ...validSynthesisResult, mergedIds: undefined }),
      ).toBe(false)
    })

    it('returns false when mergedIds contains a non-string element', () => {
      expect(
        isSynthesisResult({ ...validSynthesisResult, mergedIds: [1, 2, 3] }),
      ).toBe(false)
    })

    it('returns false when mergedIds contains a null element', () => {
      expect(
        isSynthesisResult({
          ...validSynthesisResult,
          mergedIds: ['mem-1', null],
        }),
      ).toBe(false)
    })

    it('returns false when newMemoryId is missing', () => {
      const { newMemoryId: _m, ...rest } = validSynthesisResult
      expect(isSynthesisResult(rest)).toBe(false)
    })

    it('returns false when newMemoryId is the wrong type (number)', () => {
      expect(
        isSynthesisResult({ ...validSynthesisResult, newMemoryId: 42 }),
      ).toBe(false)
    })

    it('returns true when newMemoryId is a non-null string of length 0 (structural guard only)', () => {
      // The structural guard does not enforce non-empty strings. This
      // documents the behavior explicitly so future readers know it's
      // intentional (use Zod's SynthesisResultSchema for value validation).
      expect(
        isSynthesisResult({ ...validSynthesisResult, newMemoryId: '' }),
      ).toBe(true)
    })

    it('returns false when stanceShifts is not an array (string)', () => {
      expect(
        isSynthesisResult({ ...validSynthesisResult, stanceShifts: 'invalid' }),
      ).toBe(false)
    })

    it('returns false when stanceShifts is null', () => {
      expect(
        isSynthesisResult({ ...validSynthesisResult, stanceShifts: null }),
      ).toBe(false)
    })

    it('returns false when stanceShifts contains an invalid shift (missing fields)', () => {
      // Delegates to isStanceShift — a shift with only `attribute` set should
      // be rejected by the inner guard, propagating the rejection here.
      expect(
        isSynthesisResult({
          ...validSynthesisResult,
          stanceShifts: [validStanceShift, { attribute: 'openness' }],
        }),
      ).toBe(false)
    })

    it('returns false when stanceShifts contains a shift with wrong field types', () => {
      expect(
        isSynthesisResult({
          ...validSynthesisResult,
          stanceShifts: [
            validStanceShift,
            { ...validStanceShift, confidence: '0.5' },
          ],
        }),
      ).toBe(false)
    })

    it('returns false when compressionRatio is missing', () => {
      const { compressionRatio: _c, ...rest } = validSynthesisResult
      expect(isSynthesisResult(rest)).toBe(false)
    })

    it('returns false when compressionRatio is the wrong type (string)', () => {
      expect(
        isSynthesisResult({ ...validSynthesisResult, compressionRatio: '1.5' }),
      ).toBe(false)
    })
  })
})
