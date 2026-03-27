import { describe, it, expect } from 'vitest'
import { createEphemeralSessionId, createPrivacyHash, generateConsentForm } from './privacy'

describe('privacy utilities', () => {
  describe('createEphemeralSessionId', () => {
    it('should generate a valid session ID with sim_ prefix', () => {
      const sessionId = createEphemeralSessionId()
      expect(sessionId).toMatch(/^sim_[a-z0-9]+_[a-z0-9]+$/)
    })

    it('should generate unique IDs', () => {
      const id1 = createEphemeralSessionId()
      const id2 = createEphemeralSessionId()
      expect(id1).not.toBe(id2)
    })
  })

  describe('createPrivacyHash', () => {
    it('should generate consistent hashes for the same input', () => {
      expect(createPrivacyHash('test')).toBe(createPrivacyHash('test'))
    })
  })

  describe('generateConsentForm', () => {
    it('should return healthcare consent text when true is passed', () => {
      const result = generateConsentForm(true)
      expect(result.consentText).toContain('metrics about my practice sessions')
    })
  })
})
