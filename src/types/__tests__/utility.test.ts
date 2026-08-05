import { describe, it, expect } from 'vitest'

import { assertDefined, assertType, createTypePredicate } from '../utility'

describe('Utility Types and Assertion Helpers', () => {
  describe('assertDefined', () => {
    it('should not throw for defined values', () => {
      expect(() => assertDefined('string')).not.toThrow()
      expect(() => assertDefined(0)).not.toThrow()
      expect(() => assertDefined(false)).not.toThrow()
      expect(() => assertDefined({})).not.toThrow()
      expect(() => assertDefined([])).not.toThrow()
    })

    it('should throw for null', () => {
      expect(() => assertDefined(null)).toThrow('Value is null or undefined')
    })

    it('should throw for undefined', () => {
      expect(() => assertDefined(undefined)).toThrow(
        'Value is null or undefined',
      )
    })

    it('should throw with custom message', () => {
      expect(() => assertDefined(null, 'Custom error')).toThrow('Custom error')
    })
  })

  describe('assertType', () => {
    it('should not throw when predicate returns true', () => {
      const isString = (val: unknown): val is string => typeof val === 'string'
      expect(() => assertType('hello', isString)).not.toThrow()
    })

    it('should throw when predicate returns false', () => {
      const isString = (val: unknown): val is string => typeof val === 'string'
      expect(() => assertType(123, isString)).toThrow('Type assertion failed')
    })
  })

  describe('createTypePredicate', () => {
    it('should return a function that returns the same boolean as the predicate', () => {
      const isEven = (val: unknown) => typeof val === 'number' && val % 2 === 0
      const predicate = createTypePredicate(isEven)

      expect(predicate(2)).toBe(true)
      expect(predicate(3)).toBe(false)
      expect(predicate('2')).toBe(false)
    })
  })
})
