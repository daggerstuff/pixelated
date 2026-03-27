import { describe, it, expect } from 'vitest'
import { getYear, isSameYear, isDiffMonth, isValidDate } from './datetime'

describe('datetime utils', () => {
  it('getYear returns the correct year', () => {
    expect(getYear('2024-03-15T12:00:00.000Z')).toBe(2024)
    expect(getYear(new Date('2023-12-01T12:00:00.000Z'))).toBe(2023)
  })

  it('isSameYear checks if two dates are in the same year', () => {
    expect(isSameYear('2024-06-15', '2024-12-15')).toBe(true)
    expect(isSameYear('2023-06-15', '2024-06-15')).toBe(false)
    expect(isSameYear('2024-05-15', undefined)).toBe(undefined)
  })

  it('isDiffMonth checks if two dates are in different months', () => {
    expect(isDiffMonth('2024-03-15', '2024-04-15')).toBe(true)
    expect(isDiffMonth('2024-03-15', '2024-03-20')).toBe(false)
    expect(isDiffMonth('2024-03-15')).toBe(false)
  })

  it('isValidDate validates Date objects correctly', () => {
    expect(isValidDate(new Date('2024-03-15T12:00:00.000Z'))).toBe(true)
    expect(isValidDate(new Date('invalid'))).toBe(false)
    expect(isValidDate('2024-03-15T12:00:00.000Z')).toBe(false)
    expect(isValidDate(null)).toBe(false)
  })
})