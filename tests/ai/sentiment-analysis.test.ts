import type { AIService } from '../../lib/ai/models/types'
import { SentimentAnalysisService } from '../../lib/ai/services/sentiment-analysis'

// Mock AI service with type assertion to handle incompatible interfaces
const mockAIService = {
  generateCompletion: vi.fn(),
  createChatCompletion: vi.fn(),
  createStreamingChatCompletion: vi.fn(),
  getModelInfo: vi.fn(),
  createChatCompletionWithTracking: vi.fn(),
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
} as unknown as AIService

describe('sentimentAnalysisService', () => {
  let sentimentService: SentimentAnalysisService

  beforeEach(() => {
    vi.resetAllMocks()
    sentimentService = new SentimentAnalysisService({
      aiService: mockAIService,
      model: 'test-model',
    })
  })

  describe('analyzeSentiment', () => {
    it('should analyze sentiment correctly for positive text', async () => {
      // Mock the AI service response
      ;(
        mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        content: JSON.stringify({
          sentiment: 'positive',
          score: 0.85,
          explanation: 'The text expresses happiness and gratitude.',
        }),
        model: 'test-model',
        provider: 'openai',
        id: 'mock-id',
        created: Date.now(),
        choices: [{ message: { role: 'assistant', content: 'mock content' } }],
        usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 },
      })

      const result = await sentimentService.analyzeSentiment(
        'I am feeling great today! Thank you for your help.',
      )

      // Verify the result
      expect(result).toEqual({
        sentiment: 'positive',
        score: 0.85,
        explanation: 'The text expresses happiness and gratitude.',
        model: 'test-model',
        processingTime: expect.any(Number),
      })

      // Verify the AI service was called with correct parameters
      expect(mockAIService.createChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining(
              'I am feeling great today! Thank you for your help.',
            ),
          }),
        ]),
        expect.objectContaining({ model: 'test-model' }),
      )
    })

    it('should analyze sentiment correctly for negative text', async () => {
      // Mock the AI service response
      ;(
        mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        content: JSON.stringify({
          sentiment: 'negative',
          score: 0.75,
          explanation: 'The text expresses frustration and disappointment.',
        }),
        model: 'test-model',
        provider: 'openai',
        id: 'mock-id',
        created: Date.now(),
        choices: [{ message: { role: 'assistant', content: 'mock content' } }],
        usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 },
      })

      const result = await sentimentService.analyzeSentiment(
        'I am really frustrated with this situation. Nothing is working.',
      )

      // Verify the result
      expect(result).toEqual({
        sentiment: 'negative',
        score: 0.75,
        explanation: 'The text expresses frustration and disappointment.',
        model: 'test-model',
        processingTime: expect.any(Number),
      })
    })

    it('should analyze sentiment correctly for neutral text', async () => {
      // Mock the AI service response
      ;(
        mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        content: JSON.stringify({
          sentiment: 'neutral',
          score: 0.1,
          explanation: "The text is factual and doesn't express emotion.",
        }),
        model: 'test-model',
        provider: 'openai',
        id: 'mock-id',
        created: Date.now(),
        choices: [{ message: { role: 'assistant', content: 'mock content' } }],
        usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 },
      })

      const result = await sentimentService.analyzeSentiment(
        'The sky is blue. The temperature is 72 degrees.',
      )

      // Verify the result
      expect(result).toEqual({
        sentiment: 'neutral',
        score: 0.1,
        explanation: "The text is factual and doesn't express emotion.",
        model: 'test-model',
        processingTime: expect.any(Number),
      })
    })

    it('should handle invalid JSON responses', async () => {
      // Mock the AI service response with invalid JSON
      ;(
        mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        content: 'Not a valid JSON response',
        model: 'test-model',
        provider: 'openai',
        id: 'mock-id',
        created: Date.now(),
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Not a valid JSON response',
            },
          },
        ],
        usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 },
      })

      await expect(
        sentimentService.analyzeSentiment('Test text'),
      ).rejects.toThrow()
    })

    it('should handle AI service errors', async () => {
      // Mock the AI service to throw an error
      ;(
        mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error('AI service error'))

      await expect(
        sentimentService.analyzeSentiment('Test text'),
      ).rejects.toThrow('AI service error')
    })
  })

  describe('analyzeBatch', () => {
    it('should analyze multiple texts in parallel', async () => {
      // Mock the AI service response for multiple calls
      ;(mockAIService.createChatCompletion as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          content: JSON.stringify({
            sentiment: 'positive',
            score: 0.85,
            explanation: 'Positive text',
          }),
          model: 'test-model',
          provider: 'openai',
          id: 'mock-id',
          created: Date.now(),
          choices: [
            { message: { role: 'assistant', content: 'mock content' } },
          ],
          usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 },
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            sentiment: 'negative',
            score: 0.75,
            explanation: 'Negative text',
          }),
          model: 'test-model',
          provider: 'openai',
          id: 'mock-id',
          created: Date.now(),
          choices: [
            { message: { role: 'assistant', content: 'mock content' } },
          ],
          usage: { totalTokens: 100, promptTokens: 50, completionTokens: 50 },
        })

      const results = await sentimentService.analyzeBatch([
        'I am happy',
        'I am sad',
      ])

      // Verify the results
      expect(results).toHaveLength(2)
      expect(results[0].label).toBe('positive')
      expect(results[1].label).toBe('negative')

      // Verify the AI service was called twice
      expect(mockAIService.createChatCompletion).toHaveBeenCalledTimes(2)
    })

    it('should handle errors in batch processing', async () => {
      // Mock the AI service to succeed for first call and fail for second
      ;(mockAIService.createChatCompletion as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          content: JSON.stringify({
            sentiment: 'positive',
            score: 0.85,
            explanation: 'Positive text',
          }),
          model: 'test-model',
          usage: {
            total_tokens: 100,
            prompt_tokens: 50,
            completion_tokens: 50,
          },
        })
        .mockRejectedValueOnce(new Error('AI service error'))

      await expect(
        sentimentService.analyzeBatch(['I am happy', 'I am sad']),
      ).rejects.toThrow()
    })
  })

  describe('constructor', () => {
    it('should use default model if not provided', () => {
      const service = new SentimentAnalysisService({
        aiService: {
          ...mockAIService,
          createChatCompletion: async (messages, options) => {
            // Ensure all messages have the required name property
            const messagesWithName = messages.map((msg) => ({
              ...msg,
              name: msg.name || '', // Add default empty name if missing
            }))
            return {
              ...(await mockAIService.createChatCompletion(
                messagesWithName,
                options,
              )),
              provider: 'openai', // Add required provider property
            }
          },
        },
      })

      // Use a non-public method to test the model
      expect(
        (service as unknown as { config: { model: string } }).config.model,
      ).toBe('gpt-4o')
    })

    it('should use custom system prompt if provided', () => {
      const customPrompt = 'Custom system prompt'
      const service = new SentimentAnalysisService({
        aiService: {
          ...mockAIService,
          createChatCompletion: async (messages, options) => {
            const messagesWithName = messages.map((msg) => ({
              ...msg,
              name: msg.name || '',
            }))
            return {
              ...(await mockAIService.createChatCompletion(
                messagesWithName,
                options,
              )),
              provider: 'openai', // Add required provider property
            }
          },
        },
        defaultPrompt: customPrompt,
      })

      expect(
        (service as unknown as { config: { defaultPrompt: string } }).config
          .defaultPrompt,
      ).toBe(customPrompt)
    })
  })
})
