/**
 * Tests for EHR Native Outcomes Service (F2.4)
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'

import {
  scorePHQ9,
  scoreGAD7,
  scoreOQ45,
  getSeverity,
  detectSignificantChange,
  buildQuestionnaireResponse,
  extractAnswerValue,
  MAX_SCORES,
  LOINC_CODES,
  OQ45_REVERSE_SCORED,
  type ResponseItem,
} from '@/lib/ehr-native/services/outcomes.service'
import type { QuestionnaireResponse } from '@/lib/ehr-native/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePHQ9Responses(values: number[]): Record<string, number> {
  const responses: Record<string, number> = {}
  for (let i = 0; i < 9; i++) {
    responses[`phq9-${String(i + 1).padStart(2, '0')}`] = values[i] ?? 0
  }
  return responses
}

function makeGAD7Responses(values: number[]): Record<string, number> {
  const responses: Record<string, number> = {}
  for (let i = 0; i < 7; i++) {
    responses[`gad7-${String(i + 1).padStart(2, '0')}`] = values[i] ?? 0
  }
  return responses
}

function makeOQ45Responses(values: number[]): Record<string, number> {
  const responses: Record<string, number> = {}
  for (let i = 0; i < 45; i++) {
    responses[`oq45-${String(i + 1).padStart(2, '0')}`] = values[i] ?? 0
  }
  return responses
}

function buildPHQ9(values: number[]): QuestionnaireResponse {
  return buildQuestionnaireResponse({
    patientId: 'test-patient',
    measureType: 'phq-9',
    responses: makePHQ9Responses(values),
  })
}

function buildGAD7(values: number[]): QuestionnaireResponse {
  return buildQuestionnaireResponse({
    patientId: 'test-patient',
    measureType: 'gad-7',
    responses: makeGAD7Responses(values),
  })
}

function buildOQ45(values: number[]): QuestionnaireResponse {
  return buildQuestionnaireResponse({
    patientId: 'test-patient',
    measureType: 'oq-45',
    responses: makeOQ45Responses(values),
  })
}

// ---------------------------------------------------------------------------
// PHQ-9 Scoring
// ---------------------------------------------------------------------------

describe('scorePHQ9', () => {
  it('scores all zeros correctly', () => {
    const response = buildPHQ9([0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(scorePHQ9(response)).toBe(0)
  })

  it('scores all threes correctly (max score 27)', () => {
    const response = buildPHQ9([3, 3, 3, 3, 3, 3, 3, 3, 3])
    expect(scorePHQ9(response)).toBe(27)
  })

  it('scores a mixed response correctly', () => {
    const response = buildPHQ9([0, 1, 2, 3, 0, 1, 2, 3, 0])
    expect(scorePHQ9(response)).toBe(12)
  })

  it('throws if wrong number of items', () => {
    const response = buildQuestionnaireResponse({
      patientId: 'test-patient',
      measureType: 'phq-9',
      responses: { 'phq9-01': 0 },
    })
    expect(() => scorePHQ9(response)).toThrow()
  })

  it('throws if a value is out of range', () => {
    const responses: Record<string, number> = {}
    for (let i = 1; i <= 9; i++) {
      responses[`phq9-${String(i).padStart(2, '0')}`] = 4
    }
    const response = buildQuestionnaireResponse({
      patientId: 'test-patient',
      measureType: 'phq-9',
      responses,
    })
    expect(() => scorePHQ9(response)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// GAD-7 Scoring
// ---------------------------------------------------------------------------

describe('scoreGAD7', () => {
  it('scores all zeros correctly', () => {
    const response = buildGAD7([0, 0, 0, 0, 0, 0, 0])
    expect(scoreGAD7(response)).toBe(0)
  })

  it('scores all threes correctly (max score 21)', () => {
    const response = buildGAD7([3, 3, 3, 3, 3, 3, 3])
    expect(scoreGAD7(response)).toBe(21)
  })

  it('scores a mixed response correctly', () => {
    const response = buildGAD7([0, 1, 2, 3, 0, 1, 2])
    expect(scoreGAD7(response)).toBe(9)
  })

  it('throws if wrong number of items', () => {
    const response = buildQuestionnaireResponse({
      patientId: 'test-patient',
      measureType: 'gad-7',
      responses: { 'gad7-01': 0, 'gad7-02': 1 },
    })
    expect(() => scoreGAD7(response)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// OQ-45 Scoring (with reverse-scored items)
// ---------------------------------------------------------------------------

describe('scoreOQ45', () => {
  it('scores all zeros correctly (reverse items become 4)', () => {
    const response = buildOQ45(new Array(45).fill(0))
    // Reverse-scored items (24 items) contribute 4 each (4-0=4) = 96
    // Non-reverse items (21 items) contribute 0
    expect(scoreOQ45(response)).toBe(96)
  })

  it('scores all fours correctly (reverse items become 0)', () => {
    const response = buildOQ45(new Array(45).fill(4))
    // Non-reverse items (21 items) contribute 4 each = 84
    // Reverse-scored items (24 items) contribute 0 each (4-4=0)
    expect(scoreOQ45(response)).toBe(84)
  })

  it('scores all twos correctly', () => {
    const response = buildOQ45(new Array(45).fill(2))
    // All items contribute 2 (reverse: 4-2=2, non-reverse: 2)
    expect(scoreOQ45(response)).toBe(90)
  })

  it('throws if wrong number of items', () => {
    const response = buildQuestionnaireResponse({
      patientId: 'test-patient',
      measureType: 'oq-45',
      responses: { 'oq45-01': 0 },
    })
    expect(() => scoreOQ45(response)).toThrow()
  })

  it('throws if a value is out of range', () => {
    const responses: Record<string, number> = {}
    for (let i = 1; i <= 45; i++) {
      responses[`oq45-${String(i).padStart(2, '0')}`] = 5
    }
    const response = buildQuestionnaireResponse({
      patientId: 'test-patient',
      measureType: 'oq-45',
      responses,
    })
    expect(() => scoreOQ45(response)).toThrow()
  })

  it('correctly identifies all 24 reverse-scored items', () => {
    expect(OQ45_REVERSE_SCORED.size).toBe(24)
    expect(OQ45_REVERSE_SCORED.has('oq45-01')).toBe(true)
    expect(OQ45_REVERSE_SCORED.has('oq45-45')).toBe(true)
    expect(OQ45_REVERSE_SCORED.has('oq45-02')).toBe(false)
    expect(OQ45_REVERSE_SCORED.has('oq45-03')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getSeverity
// ---------------------------------------------------------------------------

describe('getSeverity', () => {
  it('returns correct PHQ-9 severity levels', () => {
    expect(getSeverity('phq-9', 0)).toBe('minimal')
    expect(getSeverity('phq-9', 4)).toBe('minimal')
    expect(getSeverity('phq-9', 5)).toBe('mild')
    expect(getSeverity('phq-9', 9)).toBe('mild')
    expect(getSeverity('phq-9', 10)).toBe('moderate')
    expect(getSeverity('phq-9', 14)).toBe('moderate')
    expect(getSeverity('phq-9', 15)).toBe('moderately-severe')
    expect(getSeverity('phq-9', 19)).toBe('moderately-severe')
    expect(getSeverity('phq-9', 20)).toBe('severe')
    expect(getSeverity('phq-9', 27)).toBe('severe')
  })

  it('returns correct GAD-7 severity levels', () => {
    expect(getSeverity('gad-7', 0)).toBe('minimal')
    expect(getSeverity('gad-7', 4)).toBe('minimal')
    expect(getSeverity('gad-7', 5)).toBe('mild')
    expect(getSeverity('gad-7', 9)).toBe('mild')
    expect(getSeverity('gad-7', 10)).toBe('moderate')
    expect(getSeverity('gad-7', 14)).toBe('moderate')
    expect(getSeverity('gad-7', 15)).toBe('severe')
    expect(getSeverity('gad-7', 21)).toBe('severe')
  })

  it('returns correct OQ-45 severity levels', () => {
    expect(getSeverity('oq-45', 0)).toBe('minimal')
    expect(getSeverity('oq-45', 63)).toBe('minimal')
    expect(getSeverity('oq-45', 64)).toBe('mild')
    expect(getSeverity('oq-45', 79)).toBe('mild')
    expect(getSeverity('oq-45', 80)).toBe('moderate')
    expect(getSeverity('oq-45', 99)).toBe('moderate')
    expect(getSeverity('oq-45', 100)).toBe('moderately-severe')
    expect(getSeverity('oq-45', 139)).toBe('moderately-severe')
    expect(getSeverity('oq-45', 140)).toBe('severe')
    expect(getSeverity('oq-45', 180)).toBe('severe')
  })
})

// ---------------------------------------------------------------------------
// detectSignificantChange
// ---------------------------------------------------------------------------

describe('detectSignificantChange', () => {
  it('detects PHQ-9 deterioration (increase > 4)', () => {
    const result = detectSignificantChange('phq-9', 15, 10)
    expect(result.alertFlag).toBe(true)
    expect(result.alertReason).toContain('deterioration')
    expect(result.changeFromPrevious).toBe(5)
  })

  it('does not flag PHQ-9 change at threshold (increase = 4)', () => {
    const result = detectSignificantChange('phq-9', 14, 10)
    expect(result.alertFlag).toBe(false)
  })

  it('does not flag PHQ-9 small change', () => {
    const result = detectSignificantChange('phq-9', 12, 10)
    expect(result.alertFlag).toBe(false)
  })

  it('detects GAD-7 deterioration', () => {
    const result = detectSignificantChange('gad-7', 15, 10)
    expect(result.alertFlag).toBe(true)
    expect(result.alertReason).toContain('deterioration')
  })

  it('detects OQ-45 deterioration (increase > 14)', () => {
    const result = detectSignificantChange('oq-45', 80, 65)
    expect(result.alertFlag).toBe(true)
    expect(result.alertReason).toContain('deterioration')
  })

  it('detects OQ-45 improvement (decrease > 14)', () => {
    const result = detectSignificantChange('oq-45', 60, 80)
    expect(result.alertFlag).toBe(true)
    expect(result.alertReason).toContain('improvement')
  })

  it('does not flag OQ-45 change at threshold', () => {
    const result = detectSignificantChange('oq-45', 79, 65)
    expect(result.alertFlag).toBe(false)
  })

  it('returns no alert when no previous score (null)', () => {
    const result = detectSignificantChange('phq-9', 10, null)
    expect(result.alertFlag).toBe(false)
    expect(result.changeFromPrevious).toBeNull()
  })

  it('returns no alert when no change', () => {
    const result = detectSignificantChange('phq-9', 10, 10)
    expect(result.alertFlag).toBe(false)
    expect(result.changeFromPrevious).toBe(0)
  })

  it('does not flag PHQ-9/GAD-7 improvement', () => {
    const result = detectSignificantChange('gad-7', 5, 15)
    expect(result.alertFlag).toBe(false)
    expect(result.changeFromPrevious).toBe(-10)
  })
})

// ---------------------------------------------------------------------------
// buildQuestionnaireResponse
// ---------------------------------------------------------------------------

describe('buildQuestionnaireResponse', () => {
  it('builds a valid PHQ-9 QuestionnaireResponse', () => {
    const responses = makePHQ9Responses([2, 2, 2, 2, 2, 2, 2, 2, 2])
    const result = buildQuestionnaireResponse({
      patientId: 'patient-123',
      measureType: 'phq-9',
      responses,
    })

    expect(result.resourceType).toBe('QuestionnaireResponse')
    expect(result.status).toBe('completed')
    expect(result.subject).toEqual({ reference: 'Patient/patient-123' })
    expect(result.questionnaire).toContain('phq-9')
    expect(result.item).toHaveLength(9)
    // Verify structure by scoring (implicitly tests item shape)
    expect(scorePHQ9(result)).toBe(18)
  })

  it('builds a valid GAD-7 QuestionnaireResponse', () => {
    const responses = makeGAD7Responses([1, 1, 1, 1, 1, 1, 1])
    const result = buildQuestionnaireResponse({
      patientId: 'patient-456',
      measureType: 'gad-7',
      responses,
    })

    expect(result.resourceType).toBe('QuestionnaireResponse')
    expect(result.item).toHaveLength(7)
    expect(scoreGAD7(result)).toBe(7)
  })

  it('builds a valid OQ-45 QuestionnaireResponse', () => {
    const responses = makeOQ45Responses(new Array(45).fill(3))
    const result = buildQuestionnaireResponse({
      patientId: 'patient-789',
      measureType: 'oq-45',
      responses,
    })

    expect(result.resourceType).toBe('QuestionnaireResponse')
    expect(result.item).toHaveLength(45)
    // Verify structure by scoring
    expect(scoreOQ45(result)).toBe(87)
  })

  it('uses authored date when provided', () => {
    const responses = makePHQ9Responses([0, 0, 0, 0, 0, 0, 0, 0, 0])
    const result = buildQuestionnaireResponse({
      patientId: 'p1',
      measureType: 'phq-9',
      responses,
      authored: '2025-01-15T10:00:00Z',
    })
    expect(result.authored).toBe('2025-01-15T10:00:00Z')
  })

  it('sets authored to current time when not provided', () => {
    const responses = makePHQ9Responses([0, 0, 0, 0, 0, 0, 0, 0, 0])
    const result = buildQuestionnaireResponse({
      patientId: 'p1',
      measureType: 'phq-9',
      responses,
    })
    expect(result.authored).toBeDefined()
    expect(new Date(result.authored ?? '').getTime()).toBeLessThanOrEqual(Date.now())
  })
})

// ---------------------------------------------------------------------------
// extractAnswerValue
// ---------------------------------------------------------------------------

describe('extractAnswerValue', () => {
  it('extracts valueInteger from item', () => {
    const item: ResponseItem = { linkId: 'test-01', answer: [{ valueInteger: 3 }] }
    expect(extractAnswerValue(item)).toBe(3)
  })

  it('extracts valueDecimal from item', () => {
    const item: ResponseItem = { linkId: 'test-02', answer: [{ valueDecimal: 2.5 }] }
    expect(extractAnswerValue(item)).toBe(2.5)
  })

  it('throws for item without answer', () => {
    const item: ResponseItem = { linkId: 'test-03' }
    expect(() => extractAnswerValue(item)).toThrow()
  })

  it('throws for item with non-numeric answer', () => {
    const item: ResponseItem = { linkId: 'test-04', answer: [{ valueString: 'text' }] }
    expect(() => extractAnswerValue(item)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('Constants', () => {
  it('has correct MAX_SCORES', () => {
    expect(MAX_SCORES['phq-9']).toBe(27)
    expect(MAX_SCORES['gad-7']).toBe(21)
    expect(MAX_SCORES['oq-45']).toBe(180)
  })

  it('has correct LOINC_CODES', () => {
    expect(LOINC_CODES['phq-9']).toBe('89204-2')
    expect(LOINC_CODES['gad-7']).toBe('70274-6')
    expect(LOINC_CODES['oq-45']).toBe('75325-1')
  })
})
