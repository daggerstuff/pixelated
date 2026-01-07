import { renderHook } from '@testing-library/react'
import { usePatternDetection } from '../usePatternDetection'
import type { Message } from '@/types/chat'

// Mock the useAIService hook
const mockGetAIResponse = vi.fn()
vi.mock('../useAIService', () => ({
  useAIService: () => ({
    getAIResponse: mockGetAIResponse,
  }),
}))

describe('usePatternDetection', () => {
  const mockMessages: Message[] = [
    {
      role: 'user',
      content: 'I feel anxious every morning',
      name: '',
      timestamp: new Date(Date.now() - 1000).toISOString(),
    },
    {
      role: 'assistant',
      content:
        'I understand that must be difficult. Can you tell me more about your morning anxiety?',
      name: '',
      timestamp: new Date().toISOString(),
    },
  ]

  const mockPatternResponse = [
    {
      patternType: 'anxiety_pattern',
      description: 'Regular morning anxiety reported',
      frequency: 0.8,
      significance: 0.7,
      suggestedResponse: 'Explore morning routine and anxiety triggers',
      confidence: 0.9,
    },
  ]

  const mockStreamResponse = new ReadableStream({
    start(controller): void {
      controller.enqueue(
        new TextEncoder().encode(JSON.stringify(mockPatternResponse)),
      )
      controller.close()
    },
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should detect patterns from conversation history', async () => {
    mockGetAIResponse.mockResolvedValue({
      content: JSON.stringify(mockPatternResponse),
    })

    const { result } = renderHook(() => usePatternDetection())
    const patterns = await result.current.detectPatterns(mockMessages)

    expect(patterns).toEqual(mockPatternResponse)
  })

  it('should handle streaming responses', async () => {
    mockGetAIResponse.mockResolvedValue(mockStreamResponse)

    const { result } = renderHook(() => usePatternDetection())
    const patterns = await result.current.detectPatterns(mockMessages)

    expect(patterns).toEqual(mockPatternResponse)
  })

  it('should return error pattern on API failure', async () => {
    mockGetAIResponse.mockRejectedValue(new Error('API Error'))

    const { result } = renderHook(() => usePatternDetection())
    const patterns = await result.current.detectPatterns(mockMessages)

    expect(patterns).toEqual([
      {
        patternType: 'error',
        description: 'Unable to analyze patterns',
        frequency: 0,
        significance: 0,
        confidence: 0,
      },
    ])
  })

  it('should handle malformed JSON responses', async () => {
    mockGetAIResponse.mockResolvedValue({ content: 'invalid json' })

    const { result } = renderHook(() => usePatternDetection())
    const patterns = await result.current.detectPatterns(mockMessages)

    expect(patterns).toEqual([
      {
        patternType: 'error',
        description: 'Unable to analyze patterns',
        frequency: 0,
        significance: 0,
        confidence: 0,
      },
    ])
  })

  it('should handle empty message array', async () => {
    const { result } = renderHook(() => usePatternDetection())
    const patterns = await result.current.detectPatterns([])

    expect(patterns).toEqual([])
  })

  it('should handle non-array responses', async () => {
    mockGetAIResponse.mockResolvedValue({ content: JSON.stringify({}) })

    const { result } = renderHook(() => usePatternDetection())
    const patterns = await result.current.detectPatterns(mockMessages)

    expect(patterns).toEqual([])
  })
})
