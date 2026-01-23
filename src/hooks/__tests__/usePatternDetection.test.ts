import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePatternDetection } from '../usePatternDetection'
import { useAIService } from '../useAIService'
import type { Message } from '@/types/chat'

// Mock the useAIService hook
vi.mock('../useAIService', () => ({
  __esModule: true,
  useAIService: vi.fn(),
  default: vi.fn(),
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
    vi.mocked(useAIService).mockReturnValue({
      getAIResponse: vi.fn()
    })
  })

  it('should detect patterns from conversation history', async () => {
    const mockGetAIResponse = vi.fn().mockResolvedValue({
      content: JSON.stringify(mockPatternResponse),
    })
    vi.mocked(useAIService).mockReturnValue({
      getAIResponse: mockGetAIResponse,
    })

    const { result } = renderHook(() => usePatternDetection())
    const patterns = await result.current.detectPatterns(mockMessages)
    expect(patterns).toEqual(mockPatternResponse)
  })

  it('should handle streaming responses', async () => {
    const mockGetAIResponse = vi.fn().mockResolvedValue(mockStreamResponse)
    vi.mocked(useAIService).mockReturnValue({
      getAIResponse: mockGetAIResponse,
    })

    const { result } = renderHook(() => usePatternDetection())
    const patterns = await result.current.detectPatterns(mockMessages)

    expect(patterns).toEqual(mockPatternResponse)
  })

  it('should return error pattern on API failure', async () => {
    const mockGetAIResponse = vi.fn().mockRejectedValue(new Error('API Error'))
    vi.mocked(useAIService).mockReturnValue({
      getAIResponse: mockGetAIResponse,
    })

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
    const mockGetAIResponse = vi.fn().mockResolvedValue({ content: 'invalid json' })
    vi.mocked(useAIService).mockReturnValue({
      getAIResponse: mockGetAIResponse,
    })

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
    // No mock needed or verify default behavior
    vi.mocked(useAIService).mockReturnValue({
      getAIResponse: vi.fn(),
    })
    const { result } = renderHook(() => usePatternDetection())
    const patterns = await result.current.detectPatterns([])

    expect(patterns).toEqual([])
  })

  it('should handle non-array responses', async () => {
    const mockGetAIResponse = vi.fn().mockResolvedValue({ content: JSON.stringify({}) })
    vi.mocked(useAIService).mockReturnValue({
      getAIResponse: mockGetAIResponse,
    })

    const { result } = renderHook(() => usePatternDetection())
    const patterns = await result.current.detectPatterns(mockMessages)

    expect(patterns).toEqual([])
  })
})
