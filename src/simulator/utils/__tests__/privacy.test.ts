import { describe, it, expect } from 'vitest'
import { createEphemeralSessionId, createPrivacyHash } from '../privacy'

describe('privacy utilities', () => {
  describe('createEphemeralSessionId', () => {
    it('generates a unique string starting with sim_', () => {
      const id1 = createEphemeralSessionId()
      const id2 = createEphemeralSessionId()

      expect(id1).toMatch(/^sim_[a-z0-9]+_[a-z0-9]+$/)
      expect(id1).not.toBe(id2)
    })
  })

  describe('createPrivacyHash', () => {
    it('generates consistent hashes for the same input', () => {
      expect(createPrivacyHash('test-123')).toBe(createPrivacyHash('test-123'))
    })

    it('handles empty string properly', () => {
      expect(createPrivacyHash('')).toBe('hash_0')
    })
  })
})
