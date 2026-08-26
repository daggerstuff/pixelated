import { describe, it, expect } from 'vitest'

import { getBrowser, getOS, isMobileDevice } from './device'

describe('device', () => {
  describe('getBrowser', () => {
    it('should detect Chrome', () => {
      expect(
        getBrowser(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ),
      ).toBe('Chrome')
    })

    it('should fallback to Other', () => {
      expect(getBrowser('Unknown/1.0')).toBe('Other')
    })
  })

  describe('getOS', () => {
    it('should detect macOS', () => {
      expect(
        getOS(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
        ),
      ).toBe('macOS')
    })

    it('should detect iOS', () => {
      expect(
        getOS(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        ),
      ).toBe('iOS')
    })

    it('should fallback to Other', () => {
      expect(getOS('Unknown/1.0')).toBe('Other')
    })
  })

  describe('isMobileDevice', () => {
    it('should detect iPhone', () => {
      expect(
        isMobileDevice(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        ),
      ).toBe(true)
    })

    it('should handle non-mobile devices', () => {
      expect(
        isMobileDevice(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ),
      ).toBe(false)
    })
  })
})
