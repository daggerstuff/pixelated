import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getUserConsentPreference, setUserConsentPreference } from './privacy'

describe('privacy utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getUserConsentPreference', () => {
    it('returns true when localStorage has "true"', () => {
      // Use spyOn for cleaner testing closer to the runtime environment (Review suggestion)
      vi.spyOn(window.localStorage, 'getItem').mockReturnValue('true')
      expect(getUserConsentPreference()).toBe(true)
    })

    it('returns false when localStorage has "false"', () => {
      vi.spyOn(window.localStorage, 'getItem').mockReturnValue('false')
      expect(getUserConsentPreference()).toBe(false)
    })

    it('returns false when localStorage is empty', () => {
      vi.spyOn(window.localStorage, 'getItem').mockReturnValue(null)
      expect(getUserConsentPreference()).toBe(false)
    })
  })

  describe('setUserConsentPreference', () => {
    it('stores the preference correctly', () => {
      const setSpy = vi.spyOn(window.localStorage, 'setItem')
      setUserConsentPreference(true)
      expect(setSpy).toHaveBeenCalledWith('simulator_metrics_consent', 'true')
      
      setUserConsentPreference(false)
      expect(setSpy).toHaveBeenCalledWith('simulator_metrics_consent', 'false')
    })
  })
})
