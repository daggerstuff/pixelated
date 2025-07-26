import { renderHook } from '@testing-library/react'
import { useEmotionDetection } from '../useEmotionDetection'

// Mock the useAIService hook
const mockGetAIResponse = vi.fn()
vi.mock('../useAIService', () => ({
  useAIService: () => ({
    getAIResponse: mockGetAIResponse,
  }),
}))

describe('useEmotionDetection', () => {
  const mockAIResponse = {
    primaryEmotion: 'joy',
    secondaryEmotions: ['excitement', 'contentment'],
    intensity: 0.8,
    confidence: 0.9,
  }

  const mockStreamResponse = new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(JSON.stringify(mockAIResponse)),
      )
      controller.close()
    },
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should detect emotions from text content', async () => {
    mockGetAIResponse.mockResolvedValue({
      content: JSON.stringify(mockAIResponse),
    })

    const { result } = renderHook(() => useEmotionDetection())
    const analysis = await result.current.detectEmotions(
      'I am feeling really happy today!',
    )

    expect(analysis).toEqual({
      primaryEmotion: 'joy',
      secondaryEmotions: ['excitement', 'contentment'],
      intensity: 0.8,
      confidence: 0.9,
    })
  })

  it('should handle streaming responses', async () => {
    mockGetAIResponse.mockResolvedValue(mockStreamResponse)

    const { result } = renderHook(() => useEmotionDetection())
    const analysis = await result.current.detectEmotions(
      'I am feeling really happy today!',
    )

    expect(analysis).toEqual({
      primaryEmotion: 'joy',
      secondaryEmotions: ['excitement', 'contentment'],
      intensity: 0.8,
      confidence: 0.9,
    })
  })

  it('should return default values on error', async () => {
    mockGetAIResponse.mockRejectedValue(new Error('API Error'))

    const { result } = renderHook(() => useEmotionDetection())
    const analysis = await result.current.detectEmotions('Test message')

    expect(analysis).toEqual({
      primaryEmotion: 'neutral',
      secondaryEmotions: [],
      intensity: 0.5,
      confidence: 0.5,
    })
  })

  it('should handle malformed JSON responses', async () => {
    mockGetAIResponse.mockResolvedValue({ content: 'invalid json' })

    const { result } = renderHook(() => useEmotionDetection())
    const analysis = await result.current.detectEmotions('Test message')

    expect(analysis).toEqual({
      primaryEmotion: 'neutral',
      secondaryEmotions: [],
      intensity: 0.5,
      confidence: 0.5,
    })
  })
})
