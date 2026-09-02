import { test, expect, describe, beforeEach } from 'vitest'

import {
  CrisisDetector,
  crisisDetector,
} from '../../../apps/web/src/lib/memory/gates/crisis-detector'
import type { CrisisTier } from '../../../apps/web/src/lib/memory/gates/crisis-detector'

describe('CrisisDetector', () => {
  let detector: CrisisDetector

  beforeEach(() => {
    detector = new CrisisDetector()
  })

  test('clean content passes through without detection', () => {
    const text = 'I had a good therapy session today.'
    const result = detector.detect(text)

    expect(result.crisisFlag).toBe(false)
    expect(result.tier).toBe('none')
    expect(result.evidenceSpans).toHaveLength(0)
    expect(result.confidence).toBe(0)
  })

  test('self-harm keyword triggers detection', () => {
    const text = 'I want to hurt myself.'
    const result = detector.detect(text)

    expect(result.crisisFlag).toBe(true)
    expect(result.tier).not.toBe('none')
    expect(result.evidenceSpans.length).toBeGreaterThan(0)
  })

  test('suicide keyword triggers critical detection', () => {
    const text = 'I want to commit suicide tonight.'
    const result = detector.detect(text)

    expect(result.crisisFlag).toBe(true)
    expect(result.tier).toBe('critical')
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  test('negation suppresses false positive', () => {
    const text = 'I do not want to hurt myself.'
    const result = detector.detect(text)

    expect(result.crisisFlag).toBe(false)
  })

  test('temporal context suppresses false positive', () => {
    const text = 'I used to want to kill myself but not anymore.'
    const result = detector.detect(text)

    expect(result.crisisFlag).toBe(false)
  })

  test('evaluate returns gate evaluation for clean content', () => {
    const text = 'I am feeling better today.'
    const evaluation = detector.evaluate(text)

    expect(evaluation.gate).toBe('gate1_crisis')
    expect(evaluation.decision).toBe('pass')
    expect(evaluation.confidence).toBe(0)
  })
  test('evaluate returns block for crisis content', () => {
    const text = 'I want to kill myself.'
    const evaluation = detector.evaluate(text)
    expect(evaluation.gate).toBe('gate1_crisis')
    expect(evaluation.decision).toBe('block')
    expect(evaluation.confidence).toBeLessThan(1.0)
  })
  test('multiple crisis keywords increase confidence', () => {
    const text = 'I want to kill myself and end my life tonight.'
    const result = detector.detect(text)

    expect(result.crisisFlag).toBe(true)
    expect(result.confidence).toBeGreaterThan(0.7)
  })

  test('moderate tier keywords detected', () => {
    const text = 'I feel hopeless and worthless.'
    const result = detector.detect(text)

    expect(result.crisisFlag).toBe(true)
    expect(['moderate', 'high', 'critical']).toContain(result.tier)
  })

  test('high tier keywords detected', () => {
    const text = 'I have a plan to end it all.'
    const result = detector.detect(text)

    expect(result.crisisFlag).toBe(true)
    expect(['high', 'critical']).toContain(result.tier)
  })

  test('singleton instance works', () => {
    expect(crisisDetector).toBeInstanceOf(CrisisDetector)
    const result = crisisDetector.detect('I want to hurt myself')
    expect(result.crisisFlag).toBe(true)
  })
})
