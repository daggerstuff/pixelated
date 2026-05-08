/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  checkBrowserCompatibility,
  createEphemeralSessionId,
  createPrivacyHash,
} from '../privacy'

describe('privacy utils', () => {
  describe('createEphemeralSessionId', () => {
    it('should generate a valid session ID', () => {
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
    it('should generate a consistent hash for the same input', () => {
      const hash1 = createPrivacyHash('test_input')
      const hash2 = createPrivacyHash('test_input')
      expect(hash1).toBe(hash2)
    })

    it('should handle empty strings', () => {
      const hash = createPrivacyHash('')
      expect(hash).toMatch(/^hash_[a-z0-9]+$/)
    })
  })

  describe('checkBrowserCompatibility', () => {
    afterEach(() => {
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    })

    it('should accurately report compatibility issues when missing WebRTC', () => {
      // Mock missing getUserMedia using vi.stubGlobal
      vi.stubGlobal('navigator', {
        ...navigator,
        mediaDevices: { getUserMedia: undefined }
      });

      const result = checkBrowserCompatibility();
      expect(result.compatible).toBe(false);
      expect(result.missingFeatures).toContain('WebRTC/getUserMedia');
    })
  })
})
