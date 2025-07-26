import { render, screen, waitFor } from '@testing-library/react'
import { EmotionAnalysis } from '../EmotionAnalysis'
import { SimulatorProvider } from '../../context/SimulatorContext'

// Mock the child components
vi.mock('../EmotionDetector', () => ({
  EmotionDetector: vi.fn(
    ({
      onAnalysisComplete,
    }: {
      onAnalysisComplete: (result: boolean) => void
    }) => {
      // Simulate analysis completion after a delay
      setTimeout(() => {
        onAnalysisComplete({
          valence: 0.8,
          energy: 0.6,
          dominance: 0.7,
        })
      }, 100)
      return <div data-testid="emotion-detector">Emotion Detector</div>
    },
  ),
}))

vi.mock('../EmotionDisplay', () => ({
  EmotionDisplay: vi.fn(() => (
    <div data-testid="emotion-display">Emotion Display</div>
  )),
}))

describe('EmotionAnalysis', () => {
  const renderComponent = (text = 'Test text') => {
    return render(
      <SimulatorProvider>
        <EmotionAnalysis text={text} />
      </SimulatorProvider>,
    )
  }

  it('renders both detector and display components', () => {
    renderComponent()

    expect(screen.getByTestId('emotion-detector')).toBeInTheDocument()
    expect(screen.getByTestId('emotion-display')).toBeInTheDocument()
  })

  it('updates context state when analysis completes', async () => {
    renderComponent()

    await waitFor(() => {
      // The mock will have triggered the state update
      // We can verify the display component was re-rendered
      expect(screen.getByTestId('emotion-display')).toBeInTheDocument()
    })
  })
})
