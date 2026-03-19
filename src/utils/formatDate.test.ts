import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { formatDuration, formatDate } from './formatDate'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2023-01-01T12:00:00Z'))
  process.env.TZ = 'UTC'
})

afterEach(() => {
  vi.useRealTimers()
})

describe('formatDate', () => {
  it('throws an error for an invalid date string', () => {
    expect(() => formatDate('invalid-date')).toThrow(
      'Failed to format date: Error: Invalid date string',
    )
  })

  it('formats custom date string correctly', () => {
    expect(
      formatDate('2023-01-01T12:00:00Z', { formatString: 'YYYY-MM-DD' }),
    ).toBe('2023-01-01')
  })

  it('formats relative date correctly', () => {
    // 1 minute ago
    expect(
      formatDate('2023-01-01T11:59:00Z', { relative: true }),
    ).toBe('1 minute ago')
  })
})

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