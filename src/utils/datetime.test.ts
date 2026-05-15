import { describe, it, expect } from 'vitest'
import { isValidDate, isDiffMonth, isSameYear } from './datetime'

describe('datetime utils', () => {
  describe('isValidDate', () => {
    it('returns true for a valid Date object', () => {
      expect(isValidDate(new Date())).toBe(true)
    })

    it('returns false for an invalid Date object', () => {
      expect(isValidDate(new Date('invalid'))).toBe(false)
    })

    it('returns false for non-Date types', () => {
      expect(isValidDate('2024-01-01')).toBe(false)
      expect(isValidDate(123456789)).toBe(false)
      expect(isValidDate(null)).toBe(false)
      expect(isValidDate(undefined)).toBe(false)
      expect(isValidDate({})).toBe(false)
    })
  })

  describe('isDiffMonth', () => {
    it('returns false if preTime is undefined', () => {
      expect(isDiffMonth('2024-03-15T12:00:00Z')).toBe(false)
    })

    it('returns false if months are the same', () => {
      expect(isDiffMonth('2024-03-15T12:00:00Z', '2024-03-01T12:00:00Z')).toBe(false)
    })

    it('returns true if months are different', () => {
      expect(isDiffMonth('2024-04-15T12:00:00Z', '2024-03-15T12:00:00Z')).toBe(true)
    })
  })

  describe('isSameYear', () => {
    it('returns true if years are the same', () => {
      expect(isSameYear('2024-03-15T12:00:00Z', '2024-11-01T12:00:00Z')).toBe(true)
    })

    it('returns false if years are different', () => {
      expect(isSameYear('2024-03-15T12:00:00Z', '2023-03-15T12:00:00Z')).toBe(false)
    })

    it('returns undefined if either argument is missing', () => {
      expect(isSameYear('2024-03-15T12:00:00Z', undefined)).toBe(undefined)
      expect(isSameYear(undefined, '2024-03-15T12:00:00Z')).toBe(undefined)
    })
  })
})
