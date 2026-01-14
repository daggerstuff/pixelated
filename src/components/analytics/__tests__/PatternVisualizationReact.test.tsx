/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
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
vi.mock('recharts', async () => {
  const OriginalModule = await vi.importActual('recharts')
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

afterEach(cleanup)

describe('PatternVisualization', () => {
  it('renders the component with correct sections', () => {
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockCorrelations}
      />,
    )

    expect(screen.getByText('Trend Patterns')).toBeTruthy()
    expect(screen.getByText('Cross-Session Patterns')).toBeTruthy()
    expect(screen.getByText('Risk Correlations')).toBeTruthy()
  })

  it('renders pattern items', () => {
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockCorrelations}
      />,
    )

    expect(screen.getByText('Increasing anxiety trend')).toBeTruthy()
    expect(screen.getByText('Recurring pattern across sessions')).toBeTruthy()
    expect(screen.getByText('Sleep disruption')).toBeTruthy()
  })

  it('calls onPatternSelect when a trend is clicked', () => {
    const handleSelect = vi.fn()
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockCorrelations}
        onPatternSelect={handleSelect}
      />,
    )

    fireEvent.click(screen.getByText('Increasing anxiety trend'))
    expect(handleSelect).toHaveBeenCalledWith(mockTrends[0])
  })

  it('calls onPatternSelect when a cross-session pattern is clicked', () => {
    const handleSelect = vi.fn()
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockCorrelations}
        onPatternSelect={handleSelect}
      />,
    )

    fireEvent.click(screen.getByText('Recurring pattern across sessions'))
    expect(handleSelect).toHaveBeenCalledWith(mockPatterns[0])
  })

  it('calls onPatternSelect when a risk correlation is clicked', () => {
    const handleSelect = vi.fn()
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockCorrelations}
        onPatternSelect={handleSelect}
      />,
    )

    fireEvent.click(screen.getByText('Sleep disruption'))
    expect(handleSelect).toHaveBeenCalledWith(mockCorrelations[0])
  })

  it('hides controls text when showControls is false', () => {
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockCorrelations}
        showControls={false}
      />,
    )

    expect(screen.queryByText('Controls are visible.')).toBeNull()
  })
})
