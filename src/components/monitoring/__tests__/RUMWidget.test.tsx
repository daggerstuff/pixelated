import React from 'react'
import { render, screen, act } from '@testing-library/react'
import RUMWidget from '../RUMWidget'
import * as hooks from '../../../lib/monitoring/hooks'

// Mock the hooks
vi.mock('../../../lib/monitoring/hooks', () => ({
  useRUMData: vi.fn(),
  getPerformanceIndicator: vi.fn(),
}))

describe('RUMWidget', () => {
  beforeEach(() => {
    // Default mock implementation
    vi.mocked(hooks.useRUMData).mockReturnValue({
      loadingPerformance: {
        ttfb: 120,
        fcp: 850,
        lcp: 2200,
        speedIndex: 1600,
      },
      interactivityMetrics: {
        fid: 80,
        tbt: 180,
        tti: 3500,
      },
      visualStability: {
        cls: 0.09,
      },
      isLoading: false,
      lastUpdated: new Date(),
      refreshData: vi.fn(),
    })

    vi.mocked(hooks.getPerformanceIndicator).mockReturnValue('good')
  })

  it('renders in full mode with all metrics', () => {
    render(<RUMWidget />)

    // Check title
    expect(screen.getByText('Real User Monitoring')).toBeInTheDocument()

    // Check category headings
    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(screen.getByText('Interactivity')).toBeInTheDocument()
    expect(screen.getByText('Stability')).toBeInTheDocument()

    // Check specific metrics
    expect(screen.getByText('TTFB:')).toBeInTheDocument()
    expect(screen.getByText('FCP:')).toBeInTheDocument()
    expect(screen.getByText('LCP:')).toBeInTheDocument()
    expect(screen.getByText('FID:')).toBeInTheDocument()
    expect(screen.getByText('TBT:')).toBeInTheDocument()
    expect(screen.getByText('CLS:')).toBeInTheDocument()

    // Check refresh button
    expect(screen.getByText('Refresh')).toBeInTheDocument()
  })

  it('renders in compact mode with fewer metrics', () => {
    render(<RUMWidget compact={true} />)

    // Check title
    expect(screen.getByText('Real User Metrics')).toBeInTheDocument()

    // Check that only key metrics are shown
    expect(screen.getByText('LCP:')).toBeInTheDocument()
    expect(screen.getByText('CLS:')).toBeInTheDocument()
    expect(screen.getByText('FID:')).toBeInTheDocument()

    // These should not be in compact mode
    expect(screen.queryByText('TTFB:')).not.toBeInTheDocument()
    expect(screen.queryByText('FCP:')).not.toBeInTheDocument()
    expect(screen.queryByText('TBT:')).not.toBeInTheDocument()
  })

  it('shows loading state', () => {
    vi.mocked(hooks.useRUMData).mockReturnValue({
      loadingPerformance: {},
      interactivityMetrics: {},
      visualStability: {},
      isLoading: true,
      lastUpdated: null,
      refreshData: vi.fn(),
    })

    render(<RUMWidget />)

    expect(screen.getByText('Loading metrics...')).toBeInTheDocument()
  })

  it('shows loading state in compact mode', () => {
    vi.mocked(hooks.useRUMData).mockReturnValue({
      loadingPerformance: {},
      interactivityMetrics: {},
      visualStability: {},
      isLoading: true,
      lastUpdated: null,
      refreshData: vi.fn(),
    })

    render(<RUMWidget compact={true} />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('hides title when showTitle is false', () => {
    render(<RUMWidget showTitle={false} />)

    expect(screen.queryByText('Real User Monitoring')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<RUMWidget className="test-class" />)

    expect(
      container.querySelector('.rum-widget.test-class'),
    ).toBeInTheDocument()
  })

  it('calls refreshData when refresh button is clicked', async () => {
    const mockRefreshData = vi.fn()
    vi.mocked(hooks.useRUMData).mockReturnValue({
      loadingPerformance: { ttfb: 120, fcp: 850, lcp: 2200 },
      interactivityMetrics: { fid: 80, tbt: 180 },
      visualStability: { cls: 0.09 },
      isLoading: false,
      lastUpdated: new Date(),
      refreshData: mockRefreshData,
    })

    render(<RUMWidget />)

    // Click the refresh button
    const refreshButton = screen.getByText('Refresh')
    await act(async () => {
      refreshButton.click()
    })

    // Verify refreshData was called
    expect(mockRefreshData).toHaveBeenCalledTimes(1)
  })
})
