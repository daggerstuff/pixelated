/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TherapistAnalyticsChartData } from '@/types/analytics'

vi.mock('recharts', () => {
  const MockChart = ({
    children,
    ...props
  }: {
    children?: React.ReactNode
  }) => (
    <div data-testid='mock-chart' {...props}>
      {children}
    </div>
  )
  return {
    ResponsiveContainer: MockChart,
    LineChart: MockChart,
    BarChart: MockChart,
    AreaChart: MockChart,
    PieChart: MockChart,
    RadarChart: MockChart,
    ScatterChart: MockChart,
    ComposedChart: MockChart,
    Line: () => <div data-testid='mock-line' />,
    Bar: () => <div data-testid='mock-bar' />,
    Area: () => <div data-testid='mock-area' />,
    Pie: () => <div data-testid='mock-pie' />,
    Radar: () => <div data-testid='mock-radar' />,
    Scatter: () => <div data-testid='mock-scatter' />,
    XAxis: () => <div data-testid='mock-xaxis' />,
    YAxis: () => <div data-testid='mock-yaxis' />,
    ZAxis: () => <div data-testid='mock-zaxis' />,
    CartesianGrid: () => <div data-testid='mock-grid' />,
    Tooltip: () => <div data-testid='mock-tooltip' />,
    Legend: () => <div data-testid='mock-legend' />,
    Cell: () => <div data-testid='mock-cell' />,
    ReferenceLine: () => <div data-testid='mock-refline' />,
    ReferenceArea: () => <div data-testid='mock-refarea' />,
    LabelList: () => <div data-testid='mock-labellist' />,
  }
})

vi.mock('../../hooks/useAnalyticsDashboard', () => ({
  useAnalyticsDashboard: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}))

import TherapyProgressCharts from '../TherapyProgressCharts'

describe('TherapyProgressCharts', () => {
  const mockData: TherapistAnalyticsChartData = {
    sessionMetrics: [
      {
        date: '2025-01-01T12:00:00Z',
        sessions: 1,
        therapistSessions: 1,
        averageSessionProgress: 75,
        sessionId: 'session-1',
        therapistId: 'therapist-1',
        milestonesAchieved: 3,
        averageResponseTime: 2.5,
      },
      {
        date: '2025-01-02T12:00:00Z',
        sessions: 1,
        therapistSessions: 1,
        averageSessionProgress: 85,
        sessionId: 'session-2',
        therapistId: 'therapist-1',
        milestonesAchieved: 4,
        averageResponseTime: 2.1,
      },
    ],
    skillProgress: [
      {
        skill: 'Active Listening',
        skillId: 'active-listening',
        score: 85,
        trend: 'up',
        category: 'therapeutic',
        sessionsPracticed: 5,
        averageImprovement: 12,
      },
      {
        skill: 'Empathy',
        skillId: 'empathy',
        score: 78,
        trend: 'stable',
        category: 'therapeutic',
        sessionsPracticed: 4,
        averageImprovement: 8,
      },
    ],
    summaryStats: [
      {
        value: 2,
        label: 'Total Sessions',
        therapistId: 'therapist-1',
        trend: { value: 2, direction: 'up', period: 'recent' },
        color: 'blue',
      },
      {
        value: 80,
        label: 'Avg Progress',
        therapistId: 'therapist-1',
        trend: { value: 10, direction: 'up', period: 'recent' },
        color: 'green',
      },
    ],
    progressSnapshots: [
      { timestamp: '2025-01-01T10:00:00Z', value: 25 },
      { timestamp: '2025-01-01T10:30:00Z', value: 50 },
      { timestamp: '2025-01-01T11:00:00Z', value: 75 },
      { timestamp: '2025-01-01T11:30:00Z', value: 100 },
    ],
    comparativeData: {
      currentSession: {
        date: '2025-01-02T12:00:00Z',
        sessions: 1,
        therapistSessions: 1,
        averageSessionProgress: 85,
        sessionId: 'session-2',
        therapistId: 'therapist-1',
        milestonesAchieved: 4,
        averageResponseTime: 2.1,
      },
      previousSession: {
        date: '2025-01-01T12:00:00Z',
        sessions: 1,
        therapistSessions: 1,
        averageSessionProgress: 75,
        sessionId: 'session-1',
        therapistId: 'therapist-1',
        milestonesAchieved: 3,
        averageResponseTime: 2.5,
      },
      trend: 'improving',
    },
  }

  beforeEach(() => {
    vi.resetModules()
  })

  it('renders AnalyticsCharts when data is provided', () => {
    render(<TherapyProgressCharts data={mockData} />)
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('renders chart container with therapy-progress-charts class', () => {
    render(<TherapyProgressCharts data={mockData} />)
    const container = screen
      .getByTestId('mock-chart')
      .closest('.therapy-progress-charts')
    expect(container).toBeInTheDocument()
  })

  it('shows fallback message when data is null', () => {
    render(<TherapyProgressCharts data={null} />)
    expect(
      screen.getByText('No therapy progress data available'),
    ).toBeInTheDocument()
  })

  it('renders with empty session metrics', () => {
    const emptyData = { ...mockData, sessionMetrics: [] }
    render(<TherapyProgressCharts data={emptyData} />)
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('renders with empty skill progress', () => {
    const emptyData = { ...mockData, skillProgress: [] }
    render(<TherapyProgressCharts data={emptyData} />)
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('renders with empty summary stats', () => {
    const emptyData = { ...mockData, summaryStats: [] }
    render(<TherapyProgressCharts data={emptyData} />)
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('renders with empty progress snapshots', () => {
    const emptyData = { ...mockData, progressSnapshots: [] }
    render(<TherapyProgressCharts data={emptyData} />)
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('renders without comparative data', () => {
    const noComparisonData = { ...mockData, comparativeData: undefined }
    render(<TherapyProgressCharts data={noComparisonData} />)
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('renders with single session metric', () => {
    const singleData = {
      ...mockData,
      sessionMetrics: [mockData.sessionMetrics[0]],
    }
    render(<TherapyProgressCharts data={singleData} />)
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('renders with single skill', () => {
    const singleData = {
      ...mockData,
      skillProgress: [mockData.skillProgress[0]],
    }
    render(<TherapyProgressCharts data={singleData} />)
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('renders with improving trend data', () => {
    const improvingData = {
      ...mockData,
      comparativeData: {
        ...mockData.comparativeData!,
        trend: 'improving' as const,
      },
    }
    render(<TherapyProgressCharts data={improvingData} />)
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('renders with declining trend data', () => {
    const decliningData = {
      ...mockData,
      comparativeData: {
        ...mockData.comparativeData!,
        trend: 'declining' as const,
      },
    }
    render(<TherapyProgressCharts data={decliningData} />)
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('renders with stable trend data', () => {
    const stableData = {
      ...mockData,
      comparativeData: {
        ...mockData.comparativeData!,
        trend: 'stable' as const,
      },
    }
    render(<TherapyProgressCharts data={stableData} />)
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('renders with multiple session metrics', () => {
    const multiData = {
      ...mockData,
      sessionMetrics: [
        ...mockData.sessionMetrics,
        {
          date: '2025-01-03T12:00:00Z',
          sessions: 2,
          therapistSessions: 2,
          averageSessionProgress: 90,
          sessionId: 'session-3',
          therapistId: 'therapist-1',
          milestonesAchieved: 5,
          averageResponseTime: 1.8,
        },
      ],
    }
    render(<TherapyProgressCharts data={multiData} />)
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument()
  })

  it('renders without data prop (undefined)', () => {
    render(<TherapyProgressCharts data={undefined as never} />)
    expect(
      screen.getByText('No therapy progress data available'),
    ).toBeInTheDocument()
  })
})
