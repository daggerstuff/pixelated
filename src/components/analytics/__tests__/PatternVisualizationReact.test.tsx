import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { PatternVisualization } from '../PatternVisualizationReact'
import type {
  TrendPattern,
  CrossSessionPattern,
  RiskCorrelation,
} from '@/lib/fhe/pattern-recognition'

// Mock data
const mockTrends: TrendPattern[] = [
  {
    id: 'trend-1',
    type: 'increasing',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-01-15'),
    confidence: 0.85,
    indicators: ['anxiety', 'stress'],
    description: 'Increasing anxiety trend',
  },
  {
    id: 'trend-2',
    type: 'decreasing',
    startDate: new Date('2025-02-01'),
    endDate: new Date('2025-02-15'),
    confidence: 0.75,
    indicators: ['depression'],
    description: 'Decreasing depression trend',
    significance: 0.6,
  },
]

const mockPatterns: CrossSessionPattern[] = [
  {
    id: 'pattern-1',
    type: 'recurring',
    sessions: ['session-1', 'session-2'],
    confidence: 0.9,
    description: 'Recurring pattern across sessions',
    significance: 0.9,
  },
  {
    id: 'pattern-2',
    type: 'oscillating',
    sessions: ['session-3', 'session-4'],
    confidence: 0.8,
    description: 'Oscillating pattern across sessions',
    significance: 0.6,
  },
]

const mockCorrelations: RiskCorrelation[] = [
  {
    id: 'risk-1',
    riskFactor: 'Sleep disruption',
    confidence: 0.95,
    correlatedFactors: [
      { factor: 'Anxiety', strength: 0.8 },
      { factor: 'Irritability', strength: 0.7 },
    ],
    significance: 'High risk factor',
    severityScore: 0.85,
  },
  {
    id: 'risk-2',
    riskFactor: 'Social withdrawal',
    confidence: 0.6,
    correlatedFactors: [{ factor: 'Depression', strength: 0.5 }],
    significance: 'Medium risk factor',
    severityScore: 0.5,
  },
]

// Mock the recharts components to avoid rendering issues in tests
vi.mock('recharts', () => {
  const OriginalModule = vi.importActual('recharts')
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),

    LineChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="line-chart">{children}</div>
    ),

    AreaChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="area-chart">{children}</div>
    ),

    Line: () => <div data-testid="line" />,
    Area: () => <div data-testid="area" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,

    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    Tooltip: () => <div data-testid="tooltip" />,
    ReferenceLine: () => <div data-testid="reference-line" />,

    ReferenceArea: () => <div data-testid="reference-area" />,
  }
})

describe('PatternVisualization', () => {
  it('renders the component with tabs', () => {
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockCorrelations}
      />,
    )

    expect(screen.getByText('Long-term Trends')).toBeInTheDocument()
    expect(screen.getByText('Session Patterns')).toBeInTheDocument()
    expect(screen.getByText('Risk Correlations')).toBeInTheDocument()
  })

  it('shows filter controls when filter button is clicked', () => {
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockCorrelations}
      />,
    )

    // Filter button should be visible
    const filterButton = screen.getByText('Filter')
    expect(filterButton).toBeInTheDocument()

    // Click the filter button
    fireEvent.click(filterButton)

    // Filter controls should now be visible
    expect(screen.getByText('Filter Options')).toBeInTheDocument()
  })

  it('filters trends by date range', () => {
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockCorrelations}
      />,
    )

    // Open filter controls
    fireEvent.click(screen.getByText('Filter'))

    // Set date range
    const startDateInput = screen.getByLabelText('Start Date')
    const endDateInput = screen.getByLabelText('End Date')

    fireEvent.change(startDateInput, { target: { value: '2025-02-01' } })
    fireEvent.change(endDateInput, { target: { value: '2025-02-28' } })

    // Apply filter
    fireEvent.click(screen.getByText('Apply Filters'))

    // Only the second trend should be visible (from February)
    expect(
      screen.queryByText('Increasing anxiety trend'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Decreasing depression trend')).toBeInTheDocument()
  })

  it('filters patterns by type', () => {
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockCorrelations}
      />,
    )

    // Switch to patterns tab
    fireEvent.click(screen.getByText('Session Patterns'))

    // Open filter controls
    fireEvent.click(screen.getByText('Filter'))

    // Select pattern type
    const patternTypeSelect = screen.getByLabelText('Pattern Type')
    fireEvent.change(patternTypeSelect, { target: { value: 'recurring' } })

    // Apply filter
    fireEvent.click(screen.getByText('Apply Filters'))

    // Only recurring patterns should be visible
    expect(
      screen.getByText('Recurring pattern across sessions'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Oscillating pattern across sessions'),
    ).not.toBeInTheDocument()
  })

  it('filters risk correlations by confidence level', () => {
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockCorrelations}
      />,
    )

    // Switch to risks tab
    fireEvent.click(screen.getByText('Risk Correlations'))

    // Open filter controls
    fireEvent.click(screen.getByText('Filter'))

    // Set minimum confidence
    const confidenceInput = screen.getByLabelText('Min Confidence')
    fireEvent.change(confidenceInput, { target: { value: '0.9' } })

    // Apply filter
    fireEvent.click(screen.getByText('Apply Filters'))

    // Only high confidence risks should be visible
    expect(screen.getByText('Sleep disruption')).toBeInTheDocument()
    expect(screen.queryByText('Social withdrawal')).not.toBeInTheDocument()
  })

  it('resets filters when reset button is clicked', () => {
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockCorrelations}
      />,
    )

    // Open filter controls
    fireEvent.click(screen.getByText('Filter'))

    // Set some filters
    const startDateInput = screen.getByLabelText('Start Date')
    fireEvent.change(startDateInput, { target: { value: '2025-02-01' } })

    // Apply filter
    fireEvent.click(screen.getByText('Apply Filters'))

    // Reset filters
    fireEvent.click(screen.getByText('Reset'))

    // All trends should be visible again
    expect(screen.getByText('Increasing anxiety trend')).toBeInTheDocument()
    expect(screen.getByText('Decreasing depression trend')).toBeInTheDocument()
  })
})
