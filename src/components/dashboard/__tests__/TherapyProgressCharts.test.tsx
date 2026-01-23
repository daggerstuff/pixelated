import { render, screen, within } from '@testing-library/react'
import TherapyProgressCharts from '../TherapyProgressCharts'
import type { TherapistAnalyticsChartData } from '@/types/analytics'
import { describe, expect, it } from 'vitest'

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

  it('renders all chart components with data', () => {
    render(<TherapyProgressCharts data={mockData} />)

    expect(screen.getByText('Session Progress Timeline')).toBeInTheDocument()
    expect(screen.getByText('Skill Development Radar')).toBeInTheDocument()
    expect(screen.getByText('Session Comparison')).toBeInTheDocument()
    expect(screen.getByText('Skill Practice Timeline')).toBeInTheDocument()
  })

  it('renders session progress timeline with correct data', () => {
    render(<TherapyProgressCharts data={mockData} />)

    const timelineChart = screen
      .getByText('Session Progress Timeline')
      .parentElement!

    // Check that session dates are displayed
    expect(within(timelineChart).getByText('Jan 1')).toBeInTheDocument()
    expect(within(timelineChart).getByText('Jan 2')).toBeInTheDocument()

    // Check progress percentages
    expect(within(timelineChart).getByText('75%')).toBeInTheDocument()
    expect(within(timelineChart).getByText('85%')).toBeInTheDocument()
  })

  it('renders skill development radar chart', () => {
    render(<TherapyProgressCharts data={mockData} />)

    const radarChart = screen
      .getByText('Skill Development Radar')
      .parentElement!

    // Check that skills are displayed
    expect(within(radarChart).getByText('Active Listening')).toBeInTheDocument()
    expect(within(radarChart).getByText('Empathy')).toBeInTheDocument()
  })

  it('renders session comparison with trend data', () => {
    render(<TherapyProgressCharts data={mockData} />)

    const comparisonChart = screen
      .getByText('Session Comparison')
      .parentElement!

    // Check trend indicator
    expect(within(comparisonChart).getByText('↗ Improving')).toBeInTheDocument()

    // Check session IDs
    expect(within(comparisonChart).getByText('session-2')).toBeInTheDocument()
    expect(within(comparisonChart).getByText('session-1')).toBeInTheDocument()
  })

  it('renders skill improvement timeline', () => {
    render(<TherapyProgressCharts data={mockData} />)

    const timelineChart = screen
      .getByText('Skill Practice Timeline')
      .parentElement!

    // Check that skills are displayed in timeline
    expect(within(timelineChart).getByText('Active Listening')).toBeInTheDocument()
    expect(within(timelineChart).getByText('Empathy')).toBeInTheDocument()

    // Check skill scores
    expect(within(timelineChart).getByText('85%')).toBeInTheDocument()
    expect(within(timelineChart).getByText('78%')).toBeInTheDocument()
  })

  it('handles empty session metrics gracefully', () => {
    const emptyData = { ...mockData, sessionMetrics: [] }
    render(<TherapyProgressCharts data={emptyData} />)

    expect(screen.getByText('No session data available')).toBeInTheDocument()
  })

  it('handles empty skill progress data gracefully', () => {
    const emptyData = { ...mockData, skillProgress: [] }
    render(<TherapyProgressCharts data={emptyData} />)

    expect(screen.getByText('No skill data available')).toBeInTheDocument()
  })

  it('handles missing comparative data gracefully', () => {
    const noComparisonData = { ...mockData, comparativeData: undefined }
    render(<TherapyProgressCharts data={noComparisonData} />)

    expect(
      screen.getByText('Not enough session data for comparison'),
    ).toBeInTheDocument()
  })

  it('handles missing previous session in comparison', () => {
    const noPreviousSession = {
      ...mockData,
      comparativeData: {
        ...mockData.comparativeData!,
        previousSession: undefined,
      },
    }
    render(<TherapyProgressCharts data={noPreviousSession} />)

    expect(
      screen.getByText('Previous session data not available'),
    ).toBeInTheDocument()
  })

  it('applies correct styling classes', () => {
    render(<TherapyProgressCharts data={mockData} />)

    const container = screen.getByLabelText('Therapy Progress Charts')
    expect(container).toHaveClass('space-y-6')

    // Check grid layout for comparison charts
    const comparisonGrid = screen
      .getByText('Session Comparison')
      .closest('div')?.parentElement
    expect(comparisonGrid).toHaveClass(
      'grid',
      'grid-cols-1',
      'md:grid-cols-2',
      'gap-6',
    )
  })

  it('renders with custom className', () => {
    render(
      <TherapyProgressCharts data={mockData} className="custom-chart-class" />,
    )

    const container = screen.getByLabelText('Therapy Progress Charts')
    expect(container).toHaveClass('custom-chart-class')
  })

  it('displays correct trend indicators for skills', () => {
    render(<TherapyProgressCharts data={mockData} />)

    // Check trend indicators
    expect(screen.getByText('↗')).toBeInTheDocument() // Active Listening (up)
    expect(screen.getByText('→')).toBeInTheDocument() // Empathy (stable)
  })

  it('renders skill practice counts', () => {
    render(<TherapyProgressCharts data={mockData} />)

    // Check session practice counts
    expect(screen.getByText('5 sessions')).toBeInTheDocument() // Active Listening
    expect(screen.getByText('4 sessions')).toBeInTheDocument() // Empathy
  })

  it('handles single session in timeline', () => {
    const singleSessionData: TherapistAnalyticsChartData = {
      ...mockData,
      sessionMetrics: [mockData.sessionMetrics[0]].filter(Boolean) as any,
    }
    render(<TherapyProgressCharts data={singleSessionData} />)

    const timelineChart = screen.getByText('Session Progress Timeline').parentElement!
    expect(within(timelineChart).getByText('Jan 1')).toBeInTheDocument()
  })

  it('sorts skills by sessions practiced in timeline', () => {
    const unsortedSkills = [
      {
        skill: 'Low Practice',
        skillId: 'low-practice',
        score: 60,
        trend: 'stable' as const,
        category: 'therapeutic' as const,
        sessionsPracticed: 2,
        averageImprovement: 5,
      },
      {
        skill: 'High Practice',
        skillId: 'high-practice',
        score: 80,
        trend: 'up' as const,
        category: 'therapeutic' as const,
        sessionsPracticed: 10,
        averageImprovement: 15,
      },
    ]

    const sortedData = { ...mockData, skillProgress: unsortedSkills }
    render(<TherapyProgressCharts data={sortedData} />)

    // High Practice should appear first due to more sessions
    const skillItems = screen.getAllByText(/High Practice|Low Practice/)
    expect(skillItems[0]).toHaveTextContent('High Practice')
  })
})
