/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import { lockScroll, unlockScroll, toggleFadeEffect } from './misc'

describe('misc utils', () => {
  beforeEach(() => {
    document.body.style.cssText = ''
    document.body.innerHTML = ''
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
  })

  afterEach(() => vi.restoreAllMocks())

  describe('scroll lock', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })
      Object.defineProperty(document.body, 'clientWidth', {
        writable: true,
        configurable: true,
        value: 1000,
      })
    })

    it('lockScroll/unlockScroll should toggle overflow and paddingRight', () => {
      lockScroll()
      expect(document.body.style.overflow).toBe('hidden')
      expect(document.body.style.paddingRight).toBe('24px')
      unlockScroll()
      expect(document.body.style.overflow).toBe('')
      expect(document.body.style.paddingRight).toBe('')
    })
  })

  describe('toggleFadeEffect', () => {
    it('should show element and add fade-in class', () => {
      const el = document.createElement('div')
      el.id = 'test-el'
      el.classList.add('hidden')
      document.body.appendChild(el)
      toggleFadeEffect('test-el', true, 'hidden')
      expect(el.classList.contains('hidden')).toBe(false)
      expect(el.classList.contains('fade-in')).toBe(true)
    })
  })
})
