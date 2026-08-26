import { describe, it, expect } from 'vitest'

import { parseAspectRatio, calculateAspectRatio } from './image-utils'

describe('image-utils', () => {
  describe('parseAspectRatio', () => {
    it('returns undefined for invalid formats', () => {
      expect(parseAspectRatio('invalid')).toBeUndefined()
      expect(parseAspectRatio('16:0')).toBeUndefined()
      expect(parseAspectRatio('')).toBeUndefined()
    })

    it('returns correctly parsed ratio for valid inputs', () => {
      expect(parseAspectRatio('16:9')).toBe(16 / 9)
      expect(parseAspectRatio('4:3')).toBe(4 / 3)
      expect(parseAspectRatio('1:1')).toBe(1)
    })
  })

  describe('calculateAspectRatio', () => {
    it('calculates ratio correctly', () => {
      expect(calculateAspectRatio(1920, 1080)).toBe(1920 / 1080)
    })
  })
})
