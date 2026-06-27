import { describe, expect, it } from 'vitest'

import { parseTuple } from './data'

describe('data utilities', () => {
  describe('parseTuple', () => {
    it('returns the number from a valid tuple', () => {
      expect(parseTuple([true, 42], 'test')).toBe(42)
      expect(parseTuple([false, 0], 'test')).toBe(0)
    })

    it('throws error for invalid tuple', () => {
      expect(() => parseTuple(undefined, 'test')).toThrow()
      expect(() => parseTuple([true] as any, 'test')).toThrow()
      expect(() => parseTuple(null as any, 'test')).toThrow()
    })
  })
})
