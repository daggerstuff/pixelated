/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { toggleFadeEffect } from './animation'

describe('toggleFadeEffect', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="test-el" class="hidden"></div>'
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('handles missing element gracefully', () => {
    expect(() => toggleFadeEffect('non-existent', true, 'hidden')).not.toThrow()
  })

  it('removes hidden class and adds fade-in when visible is true', () => {
    toggleFadeEffect('test-el', true, 'hidden')
    const el = document.getElementById('test-el')
    expect(el?.classList.contains('hidden')).toBe(false)
    expect(el?.classList.contains('fade-in')).toBe(true)
  })
})
