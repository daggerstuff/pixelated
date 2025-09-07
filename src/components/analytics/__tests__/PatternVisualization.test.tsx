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
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-01-31'),
    significance: 0.75,
    confidence: 0.8,
    description: 'Increasing anxiety levels',
    indicators: ['stress', 'work'],
  },
]

const mockCrossSessionPatterns: CrossSessionPattern[] = [
  {
    id: 'pattern1',
    type: 'avoidance',
    sessions: ['session1', 'session2'],
    description: 'Topic avoidance',
    confidence: 0.7,
  },
]

const mockRiskCorrelations: RiskCorrelation[] = [
  {
    id: 'risk1',
    riskFactor: 'sleep disruption',
    correlatedFactors: [
      { factor: 'anxiety', strength: 0.8 },
      { factor: 'irritability', strength: 0.6 },
    ],
    confidence: 0.9,
    significance: 'high',
    severityScore: 0.85,
    description: 'Immediate action recommended',
  },
]

describe('PatternVisualization', () => {
  it('renders correctly with no data', () => {
    render(
      <PatternVisualization
        trends={[]}
        crossSessionPatterns={[]}
        riskCorrelations={[]}
      />,
    )

    expect(screen.getByText('Trend Patterns')).toBeInTheDocument()
    expect(screen.getByText('No trends found')).toBeInTheDocument()
    expect(screen.getByText('Cross-Session Patterns')).toBeInTheDocument()
    expect(screen.getByText('No cross-session patterns found')).toBeInTheDocument()
    expect(screen.getByText('Risk Correlations')).toBeInTheDocument()
    expect(screen.getByText('No risk correlations found')).toBeInTheDocument()
  })

  it('renders all sections with data', () => {
    render(
      <PatternVisualization
        trends={mockTrends}
        onPatternSelect={handlePatternSelect}
      />,
    )

    // Check trend
    expect(screen.getByText('Increasing anxiety levels')).toBeInTheDocument()

    // Check cross-session pattern
    expect(screen.getByText('Topic avoidance')).toBeInTheDocument()

    // Check risk correlation
    expect(screen.getByText('Immediate action recommended')).toBeInTheDocument()
  })

  it('calls onPatternSelect when a trend is clicked', () => {
    const handlePatternSelect = vi.fn()
    render(
      <PatternVisualization
        trends={mockTrends}
        onPatternSelect={handlePatternSelect}
      />,
    )

    const trendItem = screen.getByText('Increasing anxiety levels')
    trendItem.click()

    expect(handlePatternSelect).toHaveBeenCalledTimes(1)
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

    const patternItem = screen.getByText('Topic avoidance')
    patternItem.click()

    expect(handlePatternSelect).toHaveBeenCalledTimes(1)
    expect(handlePatternSelect).toHaveBeenCalledWith(mockPatterns[0])
  })

  it('calls onPatternSelect when a risk correlation is clicked', () => {
    const handlePatternSelect = vi.fn()
    render(
      <PatternVisualization
        riskCorrelations={mockRiskCorrelations}
        onPatternSelect={handlePatternSelect}
      />,
    )

    const riskItem = screen.getByText('Immediate action recommended')
    riskItem.click()

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
