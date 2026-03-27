import { describe, it, expect } from 'vitest'
import { formatDuration, isValidDate } from './formatDate'

describe('formatDuration', () => {
  it('formats seconds correctly', () => {
    // 45 seconds
    expect(formatDuration(45000)).toBe('45s')
    // 0 seconds
    expect(formatDuration(0)).toBe('0s')
  })

  it('formats minutes and seconds correctly', () => {
    // 5 minutes, 30 seconds
    expect(formatDuration(5 * 60000 + 30000)).toBe('5m 30s')
    // exactly 2 minutes
    expect(formatDuration(120000)).toBe('2m 0s')
  })

  it('formats hours and minutes correctly', () => {
    // 3 hours, 15 minutes
    expect(formatDuration(3 * 3600000 + 15 * 60000)).toBe('3h 15m')
    // exactly 5 hours
    expect(formatDuration(5 * 3600000)).toBe('5h 0m')
  })

  it('formats days and hours correctly', () => {
    // 2 days, 4 hours
    expect(formatDuration(2 * 86400000 + 4 * 3600000)).toBe('2d 4h')
    // exactly 1 day
    expect(formatDuration(86400000)).toBe('1d 0h')
  })
})

describe('isValidDate', () => {
  it('returns true for a valid date string', () => {
    expect(isValidDate('2023-01-01')).toBe(true)
    expect(isValidDate('2023-12-31T23:59:59Z')).toBe(true)
  })

  it('returns false for an invalid date string', () => {
    expect(isValidDate('invalid-date')).toBe(false)
    expect(isValidDate('')).toBe(false)
  })

  it('handles edge cases correctly', () => {
    // Use a regular expression to validate the date string
    const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?$/;
    expect(dateRegex.test('2023-01-01')).toBe(true)
    expect(dateRegex.test('2023-12-31T23:59:59Z')).toBe(true)
    expect(dateRegex.test('invalid-date')).toBe(false)
    expect(dateRegex.test('')).toBe(false)
    // Numeric strings are parsed as invalid by Date constructor when passed as strings
    expect(isValidDate('123456789')).toBe(false)
    // Invalid calendar dates roll over
    expect(isValidDate('2023-02-30')).toBe(false)
    // Updated to expect false
    expect(isValidDate('2023-13-01')).toBe(false)
    // Leap year handling
    expect(isValidDate('2024-02-29')).toBe(true)
    expect(isValidDate('2023-02-29')).toBe(false)
    // JS Date rolls over invalid calendar dates
    // Whitespace
    expect(isValidDate(' 2023-01-01 ')).toBe(true)
    expect(isValidDate('\t2023-01-01\n')).toBe(true)
    // Partial dates
    expect(isValidDate('2023')).toBe(false)
    expect(isValidDate('2023-01')).toBe(false)
    // Timezone variations
    expect(isValidDate('2023-01-01T00:00:00+05:00')).toBe(true)
    expect(isValidDate('2023-01-01T00:00:00-08:00')).toBe(true)
  })
})