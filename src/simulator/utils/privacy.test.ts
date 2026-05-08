/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

<<<<<<< HEAD
import {
  getUserConsentPreference,
  setUserConsentPreference,
  createPrivacyHash,
} from './privacy'
=======
import { getUserConsentPreference, setUserConsentPreference, createPrivacyHash, createEphemeralSessionId } from './privacy'
>>>>>>> 81f2fd0dc (🧪 QA: Add test for createEphemeralSessionId edge case)

describe('privacy utilities', () => {
  describe('createEphemeralSessionId', () => {
    it('returns a correctly formatted ephemeral session ID', () => {
      const id = createEphemeralSessionId()
      expect(id.startsWith('sim_')).toBe(true)
      const parts = id.split('_')
      expect(parts.length).toBe(3)
      expect(parts[1]?.length).toBeGreaterThan(0)
      expect(parts[2]?.length).toBeGreaterThan(0)
      // Check that the segments contain only alphanumeric characters (base36)
      expect(/^[0-9a-z]+$/.test(parts[1] as string)).toBe(true)
      expect(/^[0-9a-z]+$/.test(parts[2] as string)).toBe(true)
    })
  })

  describe('createPrivacyHash', () => {
    it('returns consistent hash for same input', () => {
      expect(createPrivacyHash('hello')).toBe(createPrivacyHash('hello'))
    })

    it('returns different hash for different inputs', () => {
      expect(createPrivacyHash('hello')).not.toBe(createPrivacyHash('world'))
    })

    it('handles empty string gracefully', () => {
      expect(createPrivacyHash('')).toBeTruthy()
    })
  })

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getUserConsentPreference', () => {
    it('returns true when localStorage has "true"', () => {
      // Use spyOn for cleaner testing closer to the runtime environment (Review suggestion)
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('true')
      expect(getUserConsentPreference()).toBe(true)
    })

    it('returns false when localStorage has "false"', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('false')
      expect(getUserConsentPreference()).toBe(false)
    })

    it('returns false when localStorage is empty', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
      expect(getUserConsentPreference()).toBe(false)
    })
  })

  describe('setUserConsentPreference', () => {
    it('stores the preference correctly', () => {
      const setSpy = vi.spyOn(Storage.prototype, 'setItem')
      setUserConsentPreference(true)
      expect(setSpy).toHaveBeenCalledWith('simulator_metrics_consent', 'true')

      setUserConsentPreference(false)
      expect(setSpy).toHaveBeenCalledWith('simulator_metrics_consent', 'false')
    })
  })
})
