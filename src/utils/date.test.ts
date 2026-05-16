import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { formatDate, getRelativeTime } from './date'

describe('date utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-03-15T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('formatDate formats a date string correctly', () => {
    const formatted = formatDate('2024-03-15T00:00:00.000Z')
    expect(typeof formatted).toBe('string')
    expect(formatted).toMatch(/2024/)
  })

  describe('getRelativeTime', () => {
    it('returns correct relative time strings based on duration', () => {
      // 0 days (Today)
      expect(getRelativeTime('2024-03-15T10:00:00.000Z')).toBe('Today')
      // 1 day (Yesterday)
      expect(getRelativeTime('2024-03-14T10:00:00.000Z')).toBe('Yesterday')
      // Under 7 days (days ago)
      expect(getRelativeTime('2024-03-11T10:00:00.000Z')).toBe('4 days ago')
      // Exactly 7 days (1 week ago)
      expect(getRelativeTime('2024-03-08T10:00:00.000Z')).toBe('1 week ago')
      // Under 30 days (weeks ago)
      expect(getRelativeTime('2024-03-01T10:00:00.000Z')).toBe('2 weeks ago')
      // Exactly 30 days (1 month ago)
      expect(getRelativeTime('2024-02-14T10:00:00.000Z')).toBe('1 month ago')
      // Under 365 days (months ago)
      expect(getRelativeTime('2023-12-15T10:00:00.000Z')).toBe('3 months ago')
      // Exactly 365 days (1 year ago)
      expect(getRelativeTime('2023-03-16T10:00:00.000Z')).toBe('1 year ago')
      // Over 365 days (years ago)
      expect(getRelativeTime('2022-03-15T10:00:00.000Z')).toBe('2 years ago')
    })
  })
})
