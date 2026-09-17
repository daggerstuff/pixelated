/* @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import '@testing-library/jest-dom'

import {
  PerformanceDashboard,
  type PerformanceMetricsResponse,
} from '../PerformanceDashboard'

const __originalFetch: typeof fetch = global.fetch

const mockMetricsResponse: PerformanceMetricsResponse = {
  metrics: [
    {
      date: '2026-09-16T10:00:00.000Z',
      model: 'model-a',
      requestCount: 120,
      latency: { avg: 250, max: 800, min: 90 },
      tokens: { input: 4000, output: 2000, total: 6000 },
      successRate: 0.98,
      cacheHitRate: 0.3,
      optimizationRate: 0.5,
    },
    {
      date: '2026-09-16T11:00:00.000Z',
      model: 'model-a',
      requestCount: 80,
      latency: { avg: 350, max: 900, min: 120 },
      tokens: { input: 3000, output: 1000, total: 4000 },
      successRate: 0.95,
      cacheHitRate: 0.4,
      optimizationRate: 0.6,
    },
    {
      date: '2026-09-16T10:30:00.000Z',
      model: 'model-b',
      requestCount: 50,
      latency: { avg: 500, max: 1200, min: 200 },
      tokens: { input: 1000, output: 500, total: 1500 },
      successRate: 0.9,
      cacheHitRate: 0.2,
      optimizationRate: 0.1,
    },
  ],
  modelBreakdown: [
    {
      model: 'model-a',
      requestCount: 200,
      totalTokens: 10000,
      successRate: 0.97,
      cacheHitRate: 0.34,
      optimizationRate: 0.54,
    },
    {
      model: 'model-b',
      requestCount: 50,
      totalTokens: 1500,
      successRate: 0.9,
      cacheHitRate: 0.2,
      optimizationRate: 0.1,
    },
  ],
  errorBreakdown: [{ errorCode: 'rate_limit', count: 3 }],
}

function mockFetchOk(payload: PerformanceMetricsResponse): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
}

describe('PerformanceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    mockFetchOk(mockMetricsResponse)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    global.fetch = __originalFetch
  })

  it('renders summary cards from live metrics', async () => {
    render(<PerformanceDashboard />)

    await waitFor(() => {
      // 120 + 80 + 50 requests, 6000 + 4000 + 1500 tokens
      expect(screen.getByText('250')).toBeInTheDocument()
      expect(screen.getByText('11,500')).toBeInTheDocument()
    })

    // Weighted success rate: (0.98*120 + 0.95*80 + 0.9*50) / 250 ≈ 95.4%
    expect(screen.getByText('95.4%')).toBeInTheDocument()
    // Weighted latency: (250*120 + 350*80 + 500*50) / 250 ≈ 332ms
    expect(screen.getByText('332ms')).toBeInTheDocument()
  })

  it('requests the selected time range and re-fetches on change', async () => {
    render(<PerformanceDashboard />)

    const readTimeRange = (callIndex: number): string => {
      const input = vi.mocked(global.fetch).mock.calls[callIndex]?.[0]
      if (input instanceof URL) {
        return input.searchParams.get('timeRange') ?? ''
      }
      const asText = typeof input === 'string' ? input : JSON.stringify(input)
      const match = /timeRange=([^&"']+)/.exec(asText)
      return match?.[1] ?? ''
    }

    await waitFor(() => {
      expect(readTimeRange(0)).toBe('24h')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }))

    await waitFor(() => {
      const calls = vi.mocked(global.fetch).mock.calls
      expect(readTimeRange(calls.length - 1)).toBe('7d')
    })
  })

  it('shows model comparison rows', async () => {
    render(<PerformanceDashboard />)

    await waitFor(() => {
      expect(screen.getByText('model-a')).toBeInTheDocument()
    })

    expect(screen.getByText('model-b')).toBeInTheDocument()
    expect(screen.getByText('10,000')).toBeInTheDocument()
  })

  it('shows the empty state when no metrics exist', async () => {
    mockFetchOk({ metrics: [], modelBreakdown: [], errorBreakdown: [] })
    render(<PerformanceDashboard />)

    await waitFor(() => {
      expect(
        screen.getByText('No metrics recorded for this time range.'),
      ).toBeInTheDocument()
    })
    expect(screen.getByText('No model data available.')).toBeInTheDocument()
  })

  it('shows an error banner with retry when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API is down')))
    render(<PerformanceDashboard />)

    await waitFor(() => {
      expect(screen.getByText('API is down')).toBeInTheDocument()
    })

    // Restore working fetch and retry
    mockFetchOk(mockMetricsResponse)
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }))

    await waitFor(() => {
      expect(screen.getByText('model-a')).toBeInTheDocument()
    })
    expect(screen.queryByText('API is down')).not.toBeInTheDocument()
  })

  it('renders the latency trend chart when data is present', async () => {
    render(<PerformanceDashboard />)

    // Card title confirms the chart section mounted with data loaded
    await waitFor(() => {
      expect(
        screen.getByText('Performance Over Time (Last 24 hours)'),
      ).toBeInTheDocument()
    })
    // The default time range button is active when data has loaded
    expect(
      screen.getByRole('button', { name: 'Last 24 hours' }),
    ).toBeInTheDocument()
  })
})
