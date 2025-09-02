import { render, screen, fireEvent } from '@testing-library/react'
import { PatternVisualization } from '../PatternVisualizationReact'
import type {
  TrendPattern,
  CrossSessionPattern,
  RiskCorrelation,
} from '@/lib/fhe/pattern-recognition'

const mockTrends: TrendPattern[] = [
  {
    id: 'trend1',
    type: 'anxiety',
    description: 'Increasing anxiety levels',
    confidence: 0.8,
    indicators: ['stress', 'work'],
    startDate: new Date('2023-01-01T00:00:00.000Z'),
    endDate: new Date('2023-01-31T00:00:00.000Z'),
    significance: 5,
  },
]

const mockCrossSessionPatterns: CrossSessionPattern[] = [
  {
    id: 'csp1',
    type: 'avoidance',
    description: 'Avoidance of trauma-related topics',
    confidence: 0.7,
    sessions: ['session1', 'session2'],
    significance: 7,
  },
]

const mockRiskCorrelations: RiskCorrelation[] = [
  {
    id: 'risk1',
    riskFactor: 'sleep disruption',
    description: 'Correlated with anxiety and irritability',
    confidence: 0.9,
    severityScore: 8,
    correlatedFactors: [
      { factor: 'anxiety', strength: 0.6 },
      { factor: 'irritability', strength: 0.4 },
    ],
    significance: 'high',
  },
]

describe('PatternVisualization', () => {
  it('renders all sections with correct titles and content', () => {
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockCrossSessionPatterns}
        riskCorrelations={mockRiskCorrelations}
      />,
    )

    // Check for section titles
    expect(screen.getByText('Trend Patterns')).toBeInTheDocument()
    expect(screen.getByText('Cross-Session Patterns')).toBeInTheDocument()
    expect(screen.getByText('Risk Correlations')).toBeInTheDocument()

    // Check for content from each section
    expect(screen.getByText('Increasing anxiety levels')).toBeInTheDocument()
    expect(screen.getByText('stress, work')).toBeInTheDocument()
    expect(screen.getByText('Avoidance of trauma-related topics')).toBeInTheDocument()
    expect(screen.getByText('sleep disruption')).toBeInTheDocument()
  })

  it('displays a message when no data is provided', () => {
    render(<PatternVisualization />)
    expect(screen.getByText('No trends found')).toBeInTheDocument()
    expect(screen.getByText('No cross-session patterns found')).toBeInTheDocument()
    expect(screen.getByText('No risk correlations found')).toBeInTheDocument()
  })

  it('calls onPatternSelect with the correct pattern when a trend is clicked', () => {
    const handlePatternSelect = vi.fn()
    render(
      <PatternVisualization
        trends={mockTrends}
        onPatternSelect={handlePatternSelect}
      />,
    )

    fireEvent.click(screen.getByText('Increasing anxiety levels'))
    expect(handlePatternSelect).toHaveBeenCalledTimes(1)
    expect(handlePatternSelect).toHaveBeenCalledWith(mockTrends[0])
  })

  it('calls onPatternSelect when a cross-session pattern is clicked', () => {
    const handlePatternSelect = vi.fn()
    render(
      <PatternVisualization
        crossSessionPatterns={mockCrossSessionPatterns}
        onPatternSelect={handlePatternSelect}
      />,
    )

    fireEvent.click(screen.getByText('Avoidance of trauma-related topics'))
    expect(handlePatternSelect).toHaveBeenCalledTimes(1)
    expect(handlePatternSelect).toHaveBeenCalledWith(mockCrossSessionPatterns[0])
  })

  it('calls onPatternSelect when a risk correlation is clicked', () => {
    const handlePatternSelect = vi.fn()
    render(
      <PatternVisualization
        riskCorrelations={mockRiskCorrelations}
        onPatternSelect={handlePatternSelect}
      />,
    )

    fireEvent.click(screen.getByText('sleep disruption'))
    expect(handlePatternSelect).toHaveBeenCalledTimes(1)
    expect(handlePatternSelect).toHaveBeenCalledWith(mockRiskCorrelations[0])
  })

  it('hides controls when showControls is false', () => {
    render(<PatternVisualization showControls={false} />)
    expect(
      screen.queryByRole('button', { name: 'Export Patterns' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Refresh Data' }),
    ).not.toBeInTheDocument()
  })
})
