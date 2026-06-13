/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

import { formatDate, isValidDate, getStartOf } from './formatDate'

describe('isValidDate', () => {
  it('validates edge cases like leap years, out-of-bounds, and empty inputs', () => {
    // Valid dates
    expect(isValidDate('2023-05-15')).toBe(true)
    expect(isValidDate('2024-02-29')).toBe(true) // Leap year

    // Invalid calendar dates
    expect(isValidDate('2023-02-29')).toBe(false) // Not a leap year
    expect(isValidDate('2023-13-01')).toBe(false) // Invalid month
    expect(isValidDate('2023-04-31')).toBe(false) // Invalid day for month

    // Empty or malformed inputs
    expect(isValidDate('')).toBe(false)
    expect(isValidDate('   ')).toBe(false)
    expect(isValidDate('not-a-date')).toBe(false)
    expect(isValidDate(null as unknown as string)).toBe(false)
  })

  it('handles object input', () => {
    expect(isValidDate({} as unknown as string)).toBe(false)
  })
})

describe('formatDate', () => {
  describe('relative formatting', () => {
    beforeAll(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2023-05-15T10:00:00Z'))
    })

    afterAll(() => {
      vi.useRealTimers()
    })

    it('formats "just now" correctly', () => {
      const date = new Date('2023-05-15T09:59:30Z')
      expect(formatDate(date.toISOString(), { relative: true })).toBe(
        'just now',
      )
    })

    it('formats "5 minutes ago" correctly', () => {
      const date = new Date('2023-05-15T09:55:00Z')
      expect(formatDate(date.toISOString(), { relative: true })).toBe(
        '5 minutes ago',
      )
    })

    it('formats "1 hour ago" correctly', () => {
      const date = new Date('2023-05-15T09:00:00Z')
      expect(formatDate(date.toISOString(), { relative: true })).toBe(
        '1 hour ago',
      )
    })

    it('formats "1 day ago" correctly', () => {
      const date = new Date('2023-05-14T10:00:00Z')
      expect(formatDate(date.toISOString(), { relative: true })).toBe(
        '1 day ago',
      )
    })

    it('formats "3 days ago" correctly', () => {
      const date = new Date('2023-05-12T10:00:00Z')
      expect(formatDate(date.toISOString(), { relative: true })).toBe(
        '3 days ago',
      )
    })

    it('formats "1 week ago" correctly', () => {
      const date = new Date('2023-05-08T10:00:00Z')
      expect(formatDate(date.toISOString(), { relative: true })).toBe(
        '1 week ago',
      )
    })

    it('formats "2 weeks ago" correctly', () => {
      const date = new Date('2023-05-01T10:00:00Z')
      expect(formatDate(date.toISOString(), { relative: true })).toBe(
        '2 weeks ago',
      )
    })

    it('formats "1 month ago" correctly', () => {
      const date = new Date('2023-04-15T10:00:00Z')
      expect(formatDate(date.toISOString(), { relative: true })).toBe(
        '1 month ago',
      )
    })

    it('formats "1 year ago" correctly', () => {
      const date = new Date('2022-05-15T10:00:00Z')
      expect(formatDate(date.toISOString(), { relative: true })).toBe(
        '1 year ago',
      )
    })
  })

  describe('absolute formatting', () => {
    it('formats date correctly', () => {
      const date = new Date('2023-05-15T10:00:00Z')
      expect(formatDate(date.toISOString())).toBe('May 15, 2023')
    })
  })

  describe('error handling', () => {
    it('throws an error for invalid date strings', () => {
      expect(() => formatDate('not-a-date')).toThrow(
        'Failed to format date: Error: Invalid date string',
      )
    })
  })
})

describe('getStartOf', () => {
  it('gets the start of the day correctly', () => {
    const date = new Date(2023, 4, 15, 15, 30, 45, 123) // May 15, 2023 local time
    const startOfDay = getStartOf(date, 'day')
    expect(startOfDay.getHours()).toBe(0)
    expect(startOfDay.getMinutes()).toBe(0)
    expect(startOfDay.getSeconds()).toBe(0)
    expect(startOfDay.getMilliseconds()).toBe(0)
    expect(startOfDay.getDate()).toBe(15)
  })

  it('gets the start of the week correctly', () => {
    const date = new Date(2023, 4, 17, 15, 30, 45, 123) // May 17, 2023 is a Wednesday
    const startOfWeek = getStartOf(date, 'week')
    expect(startOfWeek.getDay()).toBe(0) // Sunday
    expect(startOfWeek.getDate()).toBe(14) // May 14, 2023
    expect(startOfWeek.getHours()).toBe(0)
  })

  it('gets the start of the month correctly', () => {
    const date = new Date(2023, 4, 15, 15, 30, 45, 123) // May 15, 2023 local time
    const startOfMonth = getStartOf(date, 'month')
    expect(startOfMonth.getDate()).toBe(1)
    expect(startOfMonth.getMonth()).toBe(4) // May is index 4
    expect(startOfMonth.getHours()).toBe(0)
  })

  it('gets the start of the year correctly', () => {
    const date = new Date(2023, 4, 15, 15, 30, 45, 123) // May 15, 2023 local time
    const startOfYear = getStartOf(date, 'year')
    expect(startOfYear.getDate()).toBe(1)
    expect(startOfYear.getMonth()).toBe(0) // January
    expect(startOfYear.getFullYear()).toBe(2023)
    expect(startOfYear.getHours()).toBe(0)
  })
})
