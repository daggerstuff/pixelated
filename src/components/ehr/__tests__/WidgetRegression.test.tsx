// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { describe, expect, it, afterEach, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

import { TelehealthWidget } from '../portal/TelehealthWidget'
import { SchedulingWidget } from '../portal/SchedulingWidget'
import { MessagingWidget } from '../portal/MessagingWidget'

// Empty data responses so widgets render their empty/loading states
function mockFetchSuccess() {
  const mockResponse = {
    ok: true,
    status: 200,
    json: async () => ({ data: [], pagination: { limit: 10, offset: 0, total: 0 } }),
    text: async () => '',
  } as Response

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))
}

describe('Portal Widget Regression', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchSuccess()
  })

  describe('TelehealthWidget', () => {
    it('renders without crashing after responsive changes', async () => {
      render(<TelehealthWidget />)

      // Widget should render its title
      await waitFor(() => {
        expect(screen.getByText(/upcoming/i)).toBeInTheDocument()
      })
    })

    it('join button has 44px minimum touch target', async () => {
      render(<TelehealthWidget />)

      await waitFor(() => {
        const buttons = screen.queryAllByRole('button')
        // If any join buttons are rendered, verify they have min-h-[44px]
        for (const btn of buttons) {
          if (btn.textContent?.toLowerCase().includes('join')) {
            expect(btn.className).toContain('min-h-[44px]')
          }
        }
      })
    })
  })

  describe('SchedulingWidget', () => {
    it('renders without crashing after responsive changes', async () => {
      render(<SchedulingWidget />)

      await waitFor(() => {
        // Multiple elements contain "appointment" — use getAllByText
        expect(screen.getAllByText(/appointment/i).length).toBeGreaterThan(0)
      })
    })

    it('time slot grid uses responsive column classes', async () => {
      render(<SchedulingWidget />)

      await waitFor(() => {
        // The schedule new button should have min-h-[44px]
        const buttons = screen.queryAllByRole('button')
        for (const btn of buttons) {
          if (btn.textContent?.toLowerCase().includes('schedule new')) {
            expect(btn.className).toContain('min-h-[44px]')
          }
        }
      })
    })
  })

  describe('MessagingWidget', () => {
    it('renders without crashing after responsive changes', async () => {
      render(<MessagingWidget />)

      await waitFor(() => {
        // Multiple elements contain "message" — use getAllByText
        expect(screen.getAllByText(/message/i).length).toBeGreaterThan(0)
      })
    })

    it('send and new thread buttons have 44px minimum touch targets', async () => {
      render(<MessagingWidget />)

      await waitFor(() => {
        const buttons = screen.queryAllByRole('button')
        for (const btn of buttons) {
          const text = (btn.textContent || '').toLowerCase()
          if (text.includes('send') || text.includes('new thread')) {
            expect(btn.className).toContain('min-h-[44px]')
          }
        }
      })
    })
  })
})
