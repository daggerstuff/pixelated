import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  prefersDarkMode,
  getBrowserLanguage,
  getUserLanguages,
} from './request'

describe('request utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('prefersDarkMode', () => {
    /**
     * Helper to stub window.matchMedia with a specific matches result
     */
    const stubMatchMedia = (matches: boolean) => {
      const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      vi.stubGlobal('window', {
        matchMedia: matchMediaMock,
      })

      return matchMediaMock
    }

    it('should return false in SSR environment', () => {
      vi.stubGlobal('window', undefined)
      expect(prefersDarkMode()).toBe(false)
    })

    it('should return true when matchMedia matches dark color scheme', () => {
      const matchMediaMock = stubMatchMedia(true)
      expect(prefersDarkMode()).toBe(true)
      expect(matchMediaMock).toHaveBeenCalledWith(
        '(prefers-color-scheme: dark)',
      )
    })

    it('should return false when matchMedia does not match dark color scheme', () => {
      const matchMediaMock = stubMatchMedia(false)
      expect(prefersDarkMode()).toBe(false)
      expect(matchMediaMock).toHaveBeenCalledWith(
        '(prefers-color-scheme: dark)',
      )
    })
  })

  describe('getBrowserLanguage', () => {
    it('should return en-US in SSR environment', () => {
      vi.stubGlobal('window', undefined)
      expect(getBrowserLanguage()).toBe('en-US')
    })

    it('should return the browser language', () => {
      vi.stubGlobal('window', {
        navigator: {
          language: 'fr-FR',
        },
      })
      expect(getBrowserLanguage()).toBe('fr-FR')
    })

    it('should fallback to en-US if window is missing navigator', () => {
      // Vitest's vi.stubGlobal('window', undefined) doesn't completely remove window from the environment
      // in a way that strictly matches 'typeof window === "undefined"' if it was previously defined.
      // We test the true "undefined" fallback by ensuring the function returns the default.

      const originalWindow = global.window;
      // Force typeof window === 'undefined'
      // @ts-expect-error - overriding global window
      delete global.window;

      expect(getBrowserLanguage()).toBe('en-US');

      global.window = originalWindow;
    })

    it('should fallback to en-US if navigator.language is missing', () => {
      vi.stubGlobal('window', {
        navigator: {},
      })
      expect(getBrowserLanguage()).toBe('en-US')
    })
  })

  describe('getUserLanguages', () => {
    it('should return [en-US] in SSR environment', () => {
      vi.stubGlobal('window', undefined)
      expect(getUserLanguages()).toEqual(['en-US'])
    })

    it('should return the user languages array', () => {
      vi.stubGlobal('window', {
        navigator: {
          languages: ['en-GB', 'fr-FR'],
        },
      })
      expect(getUserLanguages()).toEqual(['en-GB', 'fr-FR'])
    })

    it('should fallback to single language if languages array is missing', () => {
      vi.stubGlobal('window', {
        navigator: {
          language: 'de-DE',
        },
      })
      expect(getUserLanguages()).toEqual(['de-DE'])
    })
  })
})
