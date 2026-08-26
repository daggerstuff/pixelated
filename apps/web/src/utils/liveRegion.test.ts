/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { announceStatus } from './liveRegion'

describe('liveRegion utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    delete window.LiveRegionSystem
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('announceStatus', () => {
    it('uses window.LiveRegionSystem if available', () => {
      window.LiveRegionSystem = {
        announceStatus: vi.fn(),
        announceAlert: vi.fn(),
        log: vi.fn(),
        announceProgress: vi.fn(),
      }

      announceStatus('Test status', 1000)
      expect(window.LiveRegionSystem.announceStatus).toHaveBeenCalledWith(
        'Test status',
        1000,
      )
    })

    it('uses ID-based element if available', () => {
      const el = document.createElement('div')
      el.id = 'status-live-region'
      document.body.appendChild(el)

      announceStatus('Test status via ID', 2000)
      expect(el.textContent).toBe('Test status via ID')

      vi.advanceTimersByTime(2000)
      expect(el.textContent).toBe('')
    })

    it('falls back to creating a temporary announcer', () => {
      announceStatus('Fallback status')

      const announcer = document.querySelector('.sr-only')
      expect(announcer).not.toBeNull()
      expect(announcer?.getAttribute('aria-live')).toBe('polite')

      vi.advanceTimersByTime(50)
      expect(announcer?.textContent).toBe('Fallback status')

      vi.advanceTimersByTime(5100)
      expect(document.querySelector('.sr-only')).toBeNull()
    })
  })
})
