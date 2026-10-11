// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'

// Render a lightweight stand-in for the analytics dashboard so this test
// asserts EmotionProgressDemo's own contract (honest labeling) without
// pulling the full chart component's dependencies.
const mockDashboard = vi.fn(() => (
  <div data-testid="emotion-progress-dashboard" />
))
vi.mock('../../analytics/EmotionProgressDashboard', () => ({
  default: (props: Record<string, unknown>) => mockDashboard(props),
}))

import EmotionProgressDemo from '../EmotionProgressDemo'

import '@testing-library/jest-dom/vitest'

describe('EmotionProgressDemo', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('labels the figures as sample data, not real patient data', () => {
    render(<EmotionProgressDemo />)

    expect(screen.getByRole('note').textContent).toContain(
      'Sample data for demonstration only',
    )
    expect(screen.getByRole('note').textContent).toContain(
      'not real patient data',
    )
  })

  it('does not present error or loading states for fabricated fetches', () => {
    const { container } = render(<EmotionProgressDemo />)

    // The demo must not claim a live fetch failed or is pending; it renders
    // the dashboard directly with a static time range.
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(screen.queryByText(/Error/i)).toBeNull()
    expect(screen.queryByText(/No emotion progress data available/i)).toBeNull()
  })

  it('passes the static demo time range to the dashboard', () => {
    render(<EmotionProgressDemo />)

    expect(mockDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ timeRange: 'month' }),
    )
  })
})
