import { describe, it, expect, vi } from 'vitest'
import { createEphemeralSessionId, createPrivacyHash } from '../privacy'

describe('privacy utilities', () => {
  describe('createEphemeralSessionId', () => {
    it('generates a unique string starting with sim_', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'))
      const randomSpy = vi.spyOn(Math, 'random')
      randomSpy.mockReturnValueOnce(0.123456).mockReturnValueOnce(0.654321)
      try {
        const id1 = createEphemeralSessionId()
        const id2 = createEphemeralSessionId()
        expect(id1).toMatch(/^sim_[a-z0-9]+_[a-z0-9]+$/)
        expect(id1).not.toBe(id2)
        // Assert expected segments or exact IDs
        expect(id1).toBe('sim_20200101000000_123456')
        expect(id2).toBe('sim_20200101000000_654321')
      } finally {
        randomSpy.mockRestore()
        vi.useRealTimers()
      }
    })
  })

  describe('createPrivacyHash', () => {
    it('generates consistent hashes for the same input', () => {
      expect(createPrivacyHash('test-123')).toBe(createPrivacyHash('test-123'))
    })
    it('handles empty string deterministically', () => {
      expect(createPrivacyHash('')).toBe('hash_0')
    })
  })
})