import type { AIMessage } from '../../lib/ai/models/types.ts'
// Import AIService type to make sure our mock is compatible
import type { AIService } from '../../lib/ai/models/types.ts'

import { InterventionAnalysisService } from '../../lib/ai/services/intervention-analysis.ts'

// Define types for mocked responses
interface AIServiceResponse {
  content: string
  model: string
  usage: {
    total_tokens: number
    prompt_tokens: number
    completion_tokens: number
  }
  id: string
  provider: string
  created: number
}

interface InterventionRequest {
  conversation: AIMessage[]
  interventionMessage: string
  userResponse: string
}

// Define mock interface for AIService with correct return types
interface MockedAIService extends AIService {
  createChatCompletion: ReturnType<typeof vi.fn>
  createStreamingChatCompletion: ReturnType<typeof vi.fn>
  getModelInfo: ReturnType<typeof vi.fn>
  createChatCompletionWithTracking: ReturnType<typeof vi.fn>
  generateCompletion: ReturnType<typeof vi.fn>
  createChatStream: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}

// Create a simplified mock of the AIService
const mockAIService = {
  createChatCompletion: vi.fn(),
  createStreamingChatCompletion: vi.fn(),
  getModelInfo: vi.fn(),
  createChatCompletionWithTracking: vi.fn(),
  generateCompletion: vi.fn(),
  createChatStream: vi.fn().mockReturnValue(
    new ReadableStream({
      start(controller) {
        controller.enqueue({
          id: 'test-id',
          model: 'test-model',
          choices: [
            {
              message: {
                role: 'assistant' as const,
                content: 'test content',
              },
              finishReason: 'stop',
            },
          ],
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
        })
        controller.close()
      },
    }),
  ),
  dispose: vi.fn(),
} as unknown as MockedAIService

describe('interventionAnalysisService', () => {
  let interventionService: InterventionAnalysisService

  beforeEach(() => {
    vi.resetAllMocks()
    interventionService = new InterventionAnalysisService({
      aiService: mockAIService,
      model: 'test-model',
    })
  })

  describe('analyzeIntervention', () => {
    it('should analyze intervention effectiveness correctly', async () => {
      // Mock the AI service response with proper typing
      const mockResponse: AIServiceResponse = {
        content: JSON.stringify({
          effectiveness_score: 8,
          user_receptiveness: 'high',
          emotional_impact: 'positive',
          key_insights: [
            'The intervention was well-timed',
            'The user responded positively to validation',
          ],
          improvement_suggestions: [
            'Could provide more specific coping strategies',
          ],
        }),
        model: 'test-model',
        usage: { total_tokens: 150, prompt_tokens: 120, completion_tokens: 30 },
        id: 'test-id-123',
        provider: 'test-provider',
        created: Date.now(),
      }

      vi.mocked(mockAIService.createChatCompletion).mockResolvedValue(
        mockResponse,
      )

      // Create test conversation
      const conversation: AIMessage[] = [
        {
          role: 'user',
          content: "I've been feeling really anxious lately.",
          name: 'user',
        },
        {
          role: 'assistant',
          content:
            'I understand that anxiety can be challenging. What specific situations trigger your anxiety?',
          name: 'assistant',
        },
      ]

      const interventionMessage =
        "It sounds like you're experiencing some significant anxiety. Have you considered trying mindfulness techniques to help manage these feelings?"

      const userResponse =
        "That's a good idea. I've heard about mindfulness but haven't really tried it consistently. Do you have any specific exercises you would recommend?"

      const result = await interventionService.analyzeIntervention(
        conversation,
        interventionMessage,
        userResponse,
      )

      // Define expected result type
      interface ExpectedResult {
        effectiveness_score: number
        user_receptiveness: string
        emotional_impact: string
        key_insights: string[]
        improvement_suggestions: string[]
        model: string
        processingTime: number
      }

      // Verify the result with proper typing
      expect(result).toEqual({
        effectiveness_score: 8,
        user_receptiveness: 'high',
        emotional_impact: 'positive',
        key_insights: [
          'The intervention was well-timed',
          'The user responded positively to validation',
        ],
        improvement_suggestions: [
          'Could provide more specific coping strategies',
        ],
        model: 'test-model',
        processingTime: expect.any(Number),
      } as ExpectedResult)

      // Verify the AI service was called with correct parameters
      expect(mockAIService.createChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('analyze the effectiveness'),
          }),
        ]),
        expect.objectContaining({ model: 'test-model' }),
      )
    })

    it('should handle custom analysis prompt', async () => {
      // Mock the AI service response with proper typing
      const mockResponse: AIServiceResponse = {
        content: JSON.stringify({
          effectiveness_score: 7,
          user_receptiveness: 'medium',
          emotional_impact: 'neutral',
          key_insights: ['Custom analysis insight'],
          improvement_suggestions: ['Custom improvement suggestion'],
        }),
        model: 'test-model',
        usage: { total_tokens: 150, prompt_tokens: 120, completion_tokens: 30 },
        id: 'test-id-456',
        provider: 'test-provider',
        created: Date.now(),
      }

      vi.mocked(mockAIService.createChatCompletion).mockResolvedValue(
        mockResponse,
      )

      // Create test conversation
      const conversation: AIMessage[] = [
        { role: 'user', content: 'Test message', name: 'user' },
      ]

      const interventionMessage = 'Test intervention'

      const userResponse = 'Test response'

      const customPrompt =
        'Focus on analyzing the therapeutic alliance in this intervention.'

      await interventionService.analyzeIntervention(
        conversation,
        interventionMessage,
        userResponse,
        { customPrompt },
      )

      // Verify the AI service was called with custom prompt
      expect(mockAIService.createChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining(customPrompt),
          }),
        ]),
        expect.any(Object),
      )
    })

    it('should handle invalid JSON responses', async () => {
      // Mock the AI service response with invalid JSON
      const mockResponse: AIServiceResponse = {
        content: 'Not a valid JSON response',
        model: 'test-model',
        usage: { total_tokens: 150, prompt_tokens: 120, completion_tokens: 30 },
        id: 'test-id-789',
        provider: 'test-provider',
        created: Date.now(),
      }

      vi.mocked(mockAIService.createChatCompletion).mockResolvedValue(
        mockResponse,
      )

      // Create test conversation
      const conversation: AIMessage[] = [
        { role: 'user', content: 'Test message', name: 'user' },
      ]

      const interventionMessage = 'Test intervention'

      const userResponse = 'Test response'

      await expect(
        interventionService.analyzeIntervention(
          conversation,
          interventionMessage,
          userResponse,
        ),
      ).rejects.toThrow()
    })

    it('should handle AI service errors', async () => {
      // Mock the AI service to throw an error
      vi.mocked(mockAIService.createChatCompletion).mockRejectedValue(
        new Error('AI service error'),
      )

      // Create test conversation
      const conversation: AIMessage[] = [
        { role: 'user', content: 'Test message', name: 'user' },
      ]

      const interventionMessage = 'Test intervention'

      const userResponse = 'Test response'

      await expect(
        interventionService.analyzeIntervention(
          conversation,
          interventionMessage,
          userResponse,
        ),
      ).rejects.toThrow('AI service error')
    })
  })

  describe('analyzeBatch', () => {
    it('should analyze multiple interventions in parallel', async () => {
      // Mock the AI service response for multiple calls
      const mockResponse1: AIServiceResponse = {
        content: JSON.stringify({
          effectiveness_score: 8,
          user_receptiveness: 'high',
          emotional_impact: 'positive',
          key_insights: ['First insight'],
          improvement_suggestions: ['First suggestion'],
        }),
        model: 'test-model',
        usage: {
          total_tokens: 150,
          prompt_tokens: 120,
          completion_tokens: 30,
        },
        id: 'test-id-001',
        provider: 'test-provider',
        created: Date.now(),
      }

      const mockResponse2: AIServiceResponse = {
        content: JSON.stringify({
          effectiveness_score: 6,
          user_receptiveness: 'medium',
          emotional_impact: 'neutral',
          key_insights: ['Second insight'],
          improvement_suggestions: ['Second suggestion'],
        }),
        model: 'test-model',
        usage: {
          total_tokens: 150,
          prompt_tokens: 120,
          completion_tokens: 30,
        },
        id: 'test-id-002',
        provider: 'test-provider',
        created: Date.now(),
      }

      vi.mocked(mockAIService.createChatCompletion)
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2)

      // Create test interventions with proper typing
      const interventions: InterventionRequest[] = [
        {
          conversation: [
            { role: 'user', content: 'First conversation', name: 'user' },
          ] as AIMessage[],
          interventionMessage: 'First intervention',
          userResponse: 'First response',
        },
        {
          conversation: [
            { role: 'user', content: 'Second conversation', name: 'user' },
          ] as AIMessage[],
          interventionMessage: 'Second intervention',
          userResponse: 'Second response',
        },
      ]

      const results = await interventionService.analyzeBatch(interventions)

      // Verify the results
      expect(results).toHaveLength(2)
      expect(results[0].score).toBe(8)
      expect(results[1].score).toBe(6)

      // Verify the AI service was called twice
      expect(mockAIService.createChatCompletion).toHaveBeenCalledTimes(2)
    })

    it('should handle errors in batch processing', async () => {
      // Mock the AI service to succeed for first call and fail for second
      const mockResponse: AIServiceResponse = {
        content: JSON.stringify({
          effectiveness_score: 8,
          user_receptiveness: 'high',
          emotional_impact: 'positive',
          key_insights: ['First insight'],
          improvement_suggestions: ['First suggestion'],
        }),
        model: 'test-model',
        usage: {
          total_tokens: 150,
          prompt_tokens: 120,
          completion_tokens: 30,
        },
        id: 'test-id-003',
        provider: 'test-provider',
        created: Date.now(),
      }

      vi.mocked(mockAIService.createChatCompletion)
        .mockResolvedValueOnce(mockResponse)
        .mockRejectedValueOnce(new Error('AI service error'))

      // Create test interventions with proper typing
      const interventions: InterventionRequest[] = [
        {
          conversation: [
            { role: 'user', content: 'First conversation', name: 'user' },
          ] as AIMessage[],
          interventionMessage: 'First intervention',
          userResponse: 'First response',
        },
        {
          conversation: [
            { role: 'user', content: 'Second conversation', name: 'user' },
          ] as AIMessage[],
          interventionMessage: 'Second intervention',
          userResponse: 'Second response',
        },
      ]

      await expect(
        interventionService.analyzeBatch(interventions),
      ).rejects.toThrow()
    })
  })
  describe('constructor', () => {
    it('should use default model if not provided', () => {
      const service = new InterventionAnalysisService({
        aiService: mockAIService,
      })

      // Use property access for testing private fields
      interface ServiceConfig {
        config: { model: string }
      }
      expect((service as unknown as ServiceConfig).config.model).toBe('gpt-4o')
    })

    it('should use custom system prompt if provided', () => {
      const customPrompt = 'Custom system prompt'
      const service = new InterventionAnalysisService({
        aiService: mockAIService,
        systemPrompt: customPrompt,
      })

      interface ServiceConfigWithPrompt {
        config: { systemPrompt: string }
      }
      expect(
        (service as unknown as ServiceConfigWithPrompt).config.systemPrompt,
      ).toBe(customPrompt)
    })
  })
})
