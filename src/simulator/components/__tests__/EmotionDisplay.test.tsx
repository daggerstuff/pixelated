import { render, screen } from '@testing-library/react'
import { EmotionDisplay } from '../EmotionDisplay'
import { SimulatorProvider } from '../../context/SimulatorContext'
import type { EmotionState } from '../../types'

const mockEmotionState: EmotionState = {
  valence: 0.75,
  energy: 0.6,
  dominance: 0.4,
}

const renderWithContext = (emotionState: EmotionState | null = null) => {
  return render(
    <SimulatorProvider initialState={{ emotionState }}>
      <EmotionDisplay />
    </SimulatorProvider>,
  )
}

describe('EmotionDisplay', () => {
  it('shows placeholder when no emotion data is available', () => {
    renderWithContext(null)
    expect(screen.getByText('No emotion data available')).toBeInTheDocument()
  })

  it('displays emotion analysis results when data is available', () => {
    renderWithContext(mockEmotionState)

    // Check heading
    expect(
      screen.getByRole('heading', { name: /emotion analysis results/i }),
    ).toBeInTheDocument()

    // Check dimension labels and values
    const labels = [
      'Valence (Positive/Negative)',
      'Energy (Active/Passive)',
      'Dominance (Strong/Weak)',
    ]

    const values = ['75%', '60%', '40%']

    labels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })

    values.forEach((value) => {
      expect(screen.getByText(value)).toBeInTheDocument()
    })
  })

  it('renders progress bars with correct widths', () => {
    renderWithContext(mockEmotionState)

    const progressBars = screen.getAllByTestId('emotion-progress-bar')
    expect(progressBars).toHaveLength(3)

    const expectedWidths = [75, 60, 40]
    progressBars.forEach((bar, index) => {
      expect(bar).toHaveStyle({ width: `${expectedWidths[index]}%` })
    })
  })
})
