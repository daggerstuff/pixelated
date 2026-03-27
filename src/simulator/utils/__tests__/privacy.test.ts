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

        expect(id1).toMatch(/^sim_[^_]+_[^_]+$/)
        expect(id2).toMatch(/^sim_[^_]+_[^_]+$/)
        expect(id1).not.toBe(id2)
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
      const h1 = createPrivacyHash('')
      const h2 = createPrivacyHash('')

      expect(h1).toBe(h2)
      expect(h1).toMatch(/^hash_/)
    })
  })
})
