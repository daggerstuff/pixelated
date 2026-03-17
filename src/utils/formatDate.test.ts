import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatDuration, formatDate } from './formatDate'

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


describe('formatDate relative', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats "just now" for < 60 seconds', () => {
    const d = new Date('2025-01-01T11:59:30Z')
    expect(formatDate(d.toISOString(), { relative: true })).toBe('just now')
  })

  it('formats minutes ago', () => {
    const d1 = new Date('2025-01-01T11:59:00Z')
    expect(formatDate(d1.toISOString(), { relative: true })).toBe('1 minute ago')
    const d5 = new Date('2025-01-01T11:55:00Z')
    expect(formatDate(d5.toISOString(), { relative: true })).toBe('5 minutes ago')
  })

  it('formats hours ago', () => {
    const d1 = new Date('2025-01-01T11:00:00Z')
    expect(formatDate(d1.toISOString(), { relative: true })).toBe('1 hour ago')
    const d3 = new Date('2025-01-01T09:00:00Z')
    expect(formatDate(d3.toISOString(), { relative: true })).toBe('3 hours ago')
  })

  it('formats days ago', () => {
    const d1 = new Date('2024-12-31T12:00:00Z')
    expect(formatDate(d1.toISOString(), { relative: true })).toBe('1 day ago')
    const d5 = new Date('2024-12-27T12:00:00Z')
    expect(formatDate(d5.toISOString(), { relative: true })).toBe('5 days ago')
  })

  it('formats months ago', () => {
    const d1 = new Date('2024-11-20T12:00:00Z')
    expect(formatDate(d1.toISOString(), { relative: true })).toBe('1 month ago')
    const d4 = new Date('2024-08-01T12:00:00Z')
    expect(formatDate(d4.toISOString(), { relative: true })).toBe('5 months ago')
  })

  it('formats years ago', () => {
    const d1 = new Date('2024-01-01T12:00:00Z')
    expect(formatDate(d1.toISOString(), { relative: true })).toBe('1 year ago')
    const d3 = new Date('2022-01-01T12:00:00Z')
    expect(formatDate(d3.toISOString(), { relative: true })).toBe('3 years ago')
  })
})
