import { describe, expect, it } from 'vitest'
import {
  parsePagination,
} from './_shared'

describe('Memory API Shared Utilities', () => {
  describe('parsePagination', () => {
    it('should correctly parse standard valid pagination params', () => {
      const url = new URL('http://localhost?limit=25&offset=50')
      const result = parsePagination(url)
      expect(result).toEqual({ limit: 25, offset: 50 })
    })

    it('should default limit to 10 and offset to 0 when params are missing', () => {
      const url = new URL('http://localhost')
      const result = parsePagination(url)
      expect(result).toEqual({ limit: 10, offset: 0 })
    })

    it('should cap limit at 100', () => {
      const url = new URL('http://localhost?limit=500')
      const result = parsePagination(url)
      expect(result.limit).toBe(100)
    })

    it('should fall back to defaults for invalid params', () => {
      const url = new URL('http://localhost?limit=abc&offset=-5')
      const result = parsePagination(url)
      expect(result.limit).toBe(10) // default
      expect(result.offset).toBe(0) // default, negative defaults to 0
    })
  })
})
