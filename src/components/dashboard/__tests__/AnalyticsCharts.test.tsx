import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AnalyticsCharts } from '../AnalyticsCharts'

vi.mock('@/hooks/useAnalyticsDashboard', () => ({
  useAnalyticsDashboard: vi.fn(() => ({
    data: {
      summaryStats: [],
      sessionMetrics: [],
      skillProgress: [],
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

describe('AnalyticsCharts', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        sessionMetrics: {},
        skillProgress: {},
        summaryStats: {},
      }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders analytics charts heading', async () => {
    render(<AnalyticsCharts />)
    expect(await screen.findByText(/Analytics Overview/i)).toBeInTheDocument()
  })

  it('exposes labeled group and correct aria-pressed states in TimeRangeSelector', () => {
    render(<AnalyticsCharts />)

    // Verify the labeled group
    const group = screen.getByRole('group', { name: /Time range selection/i })
    expect(group).toBeInTheDocument()

    // Verify aria-pressed on active (default '7d' which is 'Last 7 days') vs inactive
    const activeBtn = screen.getByRole('button', { name: /Last 7 days/i })
    const inactiveBtn = screen.getByRole('button', { name: /Last 30 days/i })

    expect(activeBtn).toHaveAttribute('aria-pressed', 'true')
    expect(inactiveBtn).toHaveAttribute('aria-pressed', 'false')
  })
})
