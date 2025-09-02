import { render, screen, fireEvent } from '@testing-library/react'
import { PatternVisualization } from '../PatternVisualizationReact'
import type {
  TrendPattern,
  CrossSessionPattern,
  RiskCorrelation,
} from '@/lib/fhe/pattern-recognition'

const mockTrends: TrendPattern[] = [
  {
    type: 'anxiety',
    startTime: new Date('2023-01-01'),
    endTime: new Date('2023-01-31'),
    significance: 0.75,
    confidence: 0.8,
    description: 'Increasing anxiety levels',
    relatedFactors: ['stress', 'work'],
    recommendations: ['relaxation techniques'],
  },
]

const mockCrossSessionPatterns: CrossSessionPattern[] = [
  {
    type: 'avoidance',
    sessions: ['session1', 'session2'],
    pattern: 'Topic avoidance',
    frequency: 0.6,
    confidence: 0.7,
    impact: 'moderate',
    recommendations: ['direct questioning'],
  },
]

const mockRiskCorrelations: RiskCorrelation[] = [
  {
    primaryFactor: 'sleep disruption',
    correlatedFactors: [
      { factor: 'anxiety', correlation: 0.8, confidence: 0.9 },
      { factor: 'irritability', correlation: 0.6, confidence: 0.7 },
    ],

    timeFrame: {
      start: new Date('2023-01-01'),
      end: new Date('2023-01-31'),
    },
    severity: 'high',
    actionRequired: true,
  },
]

describe('PatternVisualization', () => {
  it('renders loading state', () => {
    render(
      <PatternVisualization
        trends={[]}
        crossSessionPatterns={[]}
        riskCorrelations={[]}
        isLoading={true}
      />,
    )

    // Check that main content is NOT present when loading (skeleton is shown)
    expect(screen.queryByText('Long-term Trends')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Emotional Trends Over Time'),
    ).not.toBeInTheDocument()
  })

  it('renders trends tab correctly', () => {
    render(
      <PatternVisualization
        trends={mockTrends}
        onPatternSelect={handlePatternSelect}
      />,
    )

    // Check tab is present
    expect(screen.getByText('Long-term Trends')).toBeInTheDocument()

    // Check heading
    expect(screen.getByText('Emotional Trends Over Time')).toBeInTheDocument()

    // Charts should be present (mocked)
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart-container')).toBeInTheDocument()
  })

  it('renders risk correlations tab correctly', async () => {
    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockRiskCorrelations}
      />,
    )

    // Click on the risks tab
    const risksTab = screen.getByText('Risk Correlations')
    risksTab.click()

    // Wait for the content to appear
    await waitFor(
      () => {
        // Check heading is visible
        expect(screen.getByText('Risk Factor Correlations')).toBeInTheDocument()

        // Check risk item is present
        expect(screen.getByText('sleep disruption')).toBeInTheDocument()
        expect(screen.getByText('high')).toBeInTheDocument()

        // Check correlated factors
        expect(screen.getByText('anxiety')).toBeInTheDocument()
        expect(screen.getByText('irritability')).toBeInTheDocument()

        // Check warning
        expect(
          screen.getByText(/Immediate action recommended/i),
        ).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  })

  it('calls onPatternSelect when a pattern is clicked', async () => {
    const handlePatternSelect = vi.fn()

    render(
      <PatternVisualization
        trends={mockTrends}
        crossSessionPatterns={mockPatterns}
        riskCorrelations={mockRiskCorrelations}
        onPatternSelect={handlePatternSelect}
      />,
    )

    // Click on the risks tab
    const risksTab = screen.getByText('Risk Correlations')
    risksTab.click()

    // Wait for the risk item to appear and then click it
    await waitFor(
      () => {
        const riskItemText = screen.getByText('sleep disruption')
        expect(riskItemText).toBeInTheDocument() // Ensure text is found first
        const riskItem = riskItemText.closest('div') // Find parent after text appears
        expect(riskItem).toBeInTheDocument()
        if (riskItem) {
          riskItem.click()
        }
      },
      { timeout: 3000 },
    )

    // Assertions after the click
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
