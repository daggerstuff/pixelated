import { test, expect, describe, beforeEach } from 'vitest'

import {
  TraumaFilter,
  traumaFilter,
} from '../../../apps/web/src/lib/memory/gates/trauma-filter'
import type { TraumaSeverity } from '../../../apps/web/src/lib/memory/gates/trauma-filter'

describe('TraumaFilter', () => {
  let filter: TraumaFilter

  beforeEach(() => {
    filter = new TraumaFilter()
  })

  test('clean content passes through without triggers', () => {
    const text = 'I had a good therapy session today.'
    const result = filter.filter(text)

    expect(result.triggered).toBe(false)
    expect(result.indicators).toHaveLength(0)
    expect(result.confidence).toBe(0)
    expect(result.severity).toBe('none')
    expect(result.contentWarning).toBeNull()
  })

  test('abuse keyword triggers detection', () => {
    const text = 'I experienced abuse as a child.'
    const result = filter.filter(text)

    expect(result.triggered).toBe(true)
    expect(result.indicators).toContain('abuse')
    expect(result.severity).not.toBe('none')
  })

  test('neglect keyword triggers detection', () => {
    const text = 'I was neglected by my parents.'
    const result = filter.filter(text)

    expect(result.triggered).toBe(true)
    expect(result.indicators).toContain('neglect')
  })

  test('PTSD keyword triggers detection', () => {
    const text = 'I have PTSD and get flashbacks.'
    const result = filter.filter(text)

    expect(result.triggered).toBe(true)
    expect(result.indicators).toContain('trauma')
  })

  test('grief keyword triggers detection', () => {
    const text = 'I am dealing with grief after the funeral.'
    const result = filter.filter(text)

    expect(result.triggered).toBe(true)
    expect(result.indicators).toContain('grief')
  })

  test('medical trauma keyword triggers detection', () => {
    const text = 'The surgery was a medical trauma for me.'
    const result = filter.filter(text)

    expect(result.triggered).toBe(true)
    expect(result.indicators).toContain('medical')
  })

  test('multiple categories increase severity', () => {
    const text = 'I experienced abuse and neglect and have PTSD.'
    const result = filter.filter(text)

    expect(result.triggered).toBe(true)
    expect(['high', 'medium']).toContain(result.severity)
  })

  test('user specific triggers are registered and detected', () => {
    const userId = 'user-123'
    filter.registerUserTriggers(userId, ['specific trigger phrase'])

    const text = 'This specific trigger phrase reminds me of something.'
    const result = filter.filter(text, userId)

    expect(result.triggered).toBe(true)
    expect(result.userSpecificMatches).toContain('specific trigger phrase')
  })

  test('user specific triggers only apply to that user', () => {
    const userId1 = 'user-1'
    const userId2 = 'user-2'
    filter.registerUserTriggers(userId1, ['my personal trigger'])

    const result1 = filter.filter(
      'This my personal trigger affects me',
      userId1,
    )
    const result2 = filter.filter(
      'This my personal trigger affects me',
      userId2,
    )

    expect(result1.userSpecificMatches).toContain('my personal trigger')
    expect(result2.userSpecificMatches).toHaveLength(0)
  })

  test('evaluate returns gate evaluation for clean content', () => {
    const text = 'I feel good about my progress.'
    const evaluation = filter.evaluate(text)

    expect(evaluation.gate).toBe('gate2_trauma')
    expect(evaluation.decision).toBe('pass')
    expect(evaluation.confidence).toBe(0)
  })

  test('evaluate returns escalate for high severity trauma', () => {
    const text =
      'I experienced severe abuse and neglect and have PTSD flashbacks daily.'
    const evaluation = filter.evaluate(text)

    expect(evaluation.gate).toBe('gate2_trauma')
    expect(evaluation.decision).toBe('escalate')
    expect(evaluation.confidence).toBeLessThan(1.0)
  })

  test('getContentWarning returns warning for medium severity', () => {
    const text = 'I experienced abuse and neglect.'
    const result = filter.filter(text)
    const warning = filter.getContentWarning(result)

    expect(warning).not.toBeNull()
    expect(warning).toContain('trauma')
  })

  test('getContentWarning returns null for low severity', () => {
    const text = 'I had a minor trauma.'
    const result = filter.filter(text)
    const warning = filter.getContentWarning(result)

    expect(warning).toBeNull()
  })

  test('singleton instance works', () => {
    expect(traumaFilter).toBeInstanceOf(TraumaFilter)
    const result = traumaFilter.filter('I experienced abuse')
    expect(result.triggered).toBe(true)
  })
})
