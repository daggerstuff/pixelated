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
  it('renders all pattern sections and their content', () => {
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockCorrelations}
      />,
    )

    // Check for section titles
    expect(screen.getByText('Trend Patterns')).toBeInTheDocument()
    expect(screen.getByText('Cross-Session Patterns')).toBeInTheDocument()
    expect(screen.getByText('Risk Correlations')).toBeInTheDocument()

    // Check for trend patterns
    expect(screen.getByText('Increasing anxiety trend')).toBeInTheDocument()
    expect(screen.getByText('Decreasing depression trend')).toBeInTheDocument()

    // Check for cross-session patterns
    expect(
      screen.getByText('Recurring pattern across sessions'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Oscillating pattern across sessions'),
    ).toBeInTheDocument()

    // Check for risk correlations
    expect(screen.getByText('Sleep disruption')).toBeInTheDocument()
    expect(screen.getByText('Social withdrawal')).toBeInTheDocument()
  })

  it('calls onPatternSelect when a trend pattern is clicked', () => {
    const handlePatternSelect = vi.fn()
    render(
      <PatternVisualization
        trends={mockTrends}
        onPatternSelect={handlePatternSelect}
      />,
    )

    fireEvent.click(screen.getByText('Increasing anxiety trend'))
    expect(handlePatternSelect).toHaveBeenCalledWith(mockTrends[0])
  })

  it('calls onPatternSelect when a cross-session pattern is clicked', () => {
    const handlePatternSelect = vi.fn()
    render(
      <PatternVisualization
        crossSessionPatterns={mockPatterns}
        onPatternSelect={handlePatternSelect}
      />,
    )

    fireEvent.click(screen.getByText('Recurring pattern across sessions'))
    expect(handlePatternSelect).toHaveBeenCalledWith(mockPatterns[0])
  })

  it('calls onPatternSelect when a risk correlation is clicked', () => {
    const handlePatternSelect = vi.fn()
    render(
      <PatternVisualization
        riskCorrelations={mockCorrelations}
        onPatternSelect={handlePatternSelect}
      />,
    )

    fireEvent.click(screen.getByText('Sleep disruption'))
    expect(handlePatternSelect).toHaveBeenCalledWith(mockCorrelations[0])
  })
})
