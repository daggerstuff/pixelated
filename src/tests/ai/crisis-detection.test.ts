import type { AIService } from '../../lib/ai/models/types.ts'
import { CrisisDetectionService } from '../../lib/ai/services/crisis-detection'

// Define types for mocked responses
interface AIServiceResponse {
  content: string
  model: string
  usage: {
    total_tokens: number
    prompt_tokens: number
    completion_tokens: number
  }
  id?: string
  provider?: string
  created?: number
  choices?: [
    {
      message: {
        role: string
        content: string
      }
      finishReason?: string
    },
  ]
}

// Create a minimal mock that satisfies the AIService interface used by CrisisDetectionService
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
} as unknown as AIService

vi.mock('@/lib/ai/services/openai', () => ({
  default: {
    chat: vi.fn().mockImplementation(async (messages: string | any[]) => {
      const text = messages[messages.length - 1].content

      if (text.includes('high-risk')) {
        return {
          content: JSON.stringify({
            isCrisis: true,
            confidence: 0.95,
            category: 'self-harm',
            severity: 'high',
            recommendedAction: 'Immediate intervention required',
          }),
        }
      }

      if (text.includes('medium-risk')) {
        return {
          content: JSON.stringify({
            isCrisis: true,
            confidence: 0.75,
            category: 'psychological_distress',
            severity: 'medium',
            recommendedAction: 'Schedule follow-up within 24 hours',
          }),
        }
      }

      if (text.includes('low-risk')) {
        return {
          content: JSON.stringify({
            isCrisis: true,
            confidence: 0.6,
            category: 'anxiety',
            severity: 'low',
            recommendedAction: 'Monitor and provide coping strategies',
          }),
        }
      }

      if (text === 'Not a valid JSON') {
        return { content: 'Not a valid JSON' }
      }

      if (text.includes('error')) {
        throw new Error('AI service error')
      }

      return {
        content: JSON.stringify({
          isCrisis: false,
          confidence: 0.9,
          category: 'none',
          severity: 'none',
          recommendedAction: 'Continue regular support',
        }),
      }
    }),
  },
}))

describe('crisisDetectionService', () => {
  let crisisService: CrisisDetectionService

  beforeEach(() => {
    vi.resetAllMocks()
    crisisService = new CrisisDetectionService({
      aiService: mockAIService,
      model: 'test-model',
    })
  })

  describe('detectCrisis', () => {
    it('should detect high-risk crisis correctly', async () => {
      // Mock the AI service response for high-risk crisis
      ;(
        mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        content: JSON.stringify({
          isCrisis: true,
          severity: 'high',
          category: 'suicidal_ideation',
          confidence: 0.92,
          recommendedAction:
            'The text contains explicit statements about self-harm and suicide.',
        }),
        model: 'test-model',
        usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 },
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                isCrisis: true,
                severity: 'high',
                category: 'suicidal_ideation',
                confidence: 0.92,
                recommendedAction:
                  'The text contains explicit statements about self-harm and suicide.',
              }),
            },
          },
        ],
      } as AIServiceResponse)

      const result = await crisisService.detectCrisis(
        "I can't take it anymore. I'm thinking of ending it all tonight.",
      )

      // Verify the result
      expect(result).toEqual({
        isCrisis: true,
        severity: 'high',
        category: 'suicidal_ideation',
        confidence: 0.92,
        recommendedAction:
          'The text contains explicit statements about self-harm and suicide.',
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
              "I can't take it anymore. I'm thinking of ending it all tonight.",
            ),
            sensitivityLevel: 'high',
          }),
        ]),
        expect.objectContaining({ model: 'test-model' }),
      )
    })

    it('should detect medium-risk crisis correctly', async () => {
      // Mock the AI service response for medium-risk crisis
      ;(
        mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        content: JSON.stringify({
          isCrisis: true,
          severity: 'medium',
          category: 'self_harm',
          confidence: 0.78,
          recommendedAction:
            'The text mentions self-harm but without immediate intent.',
        }),
        model: 'test-model',
        usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 },
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                isCrisis: true,
                severity: 'medium',
                category: 'self_harm',
                confidence: 0.78,
                recommendedAction:
                  'The text mentions self-harm but without immediate intent.',
              }),
            },
          },
        ],
      } as AIServiceResponse)

      const result = await crisisService.detectCrisis(
        'Sometimes I think about hurting myself when I feel overwhelmed.',
      )

      // Verify the result
      expect(result).toEqual({
        isCrisis: true,
        severity: 'medium',
        category: 'self_harm',
        confidence: 0.78,
        recommendedAction:
          'The text mentions self-harm but without immediate intent.',
        model: 'test-model',
        processingTime: expect.any(Number),
      })
    })

    it('should detect low-risk crisis correctly', async () => {
      // Mock the AI service response for low-risk crisis
      ;(
        mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        content: JSON.stringify({
          isCrisis: true,
          severity: 'low',
          category: 'depression',
          confidence: 0.65,
          recommendedAction:
            'The text indicates depressive symptoms but no immediate danger.',
        }),
        model: 'test-model',
        usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 },
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                isCrisis: true,
                severity: 'low',
                category: 'depression',
                confidence: 0.65,
                recommendedAction:
                  'The text indicates depressive symptoms but no immediate danger.',
              }),
            },
          },
        ],
      } as AIServiceResponse)

      const result = await crisisService.detectCrisis(
        "I've been feeling really down lately. Nothing seems to matter.",
      )

      // Verify the result
      expect(result).toEqual({
        isCrisis: true,
        severity: 'low',
        category: 'depression',
        confidence: 0.65,
        recommendedAction:
          'The text indicates depressive symptoms but no immediate danger.',
        model: 'test-model',
        processingTime: expect.any(Number),
      })
    })

    it('should correctly identify non-crisis text', async () => {
      // Mock the AI service response for non-crisis
      ;(
        mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        content: JSON.stringify({
          isCrisis: false,
          severity: 'none',
          category: null,
          confidence: 0.95,
          recommendedAction:
            'The text does not contain any indicators of crisis or self-harm.',
        }),
        model: 'test-model',
        usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 },
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                isCrisis: false,
                severity: 'none',
                category: null,
                confidence: 0.95,
                recommendedAction:
                  'The text does not contain any indicators of crisis or self-harm.',
              }),
            },
          },
        ],
      } as AIServiceResponse)

      const result = await crisisService.detectCrisis(
        'I had a good day today. The weather was nice and I enjoyed my walk.',
      )

      // Verify the result
      expect(result).toEqual({
        isCrisis: false,
        severity: 'none',
        category: null,
        confidence: 0.95,
        recommendedAction:
          'The text does not contain any indicators of crisis or self-harm.',
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
        usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 },
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Not a valid JSON response',
            },
          },
        ],
      } as AIServiceResponse)

      await expect(crisisService.detectCrisis('Test text')).rejects.toThrow()
    })

    it('should handle AI service errors', async () => {
      // Mock the AI service to throw an error
      ;(
        mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error('AI service error'))

      await expect(crisisService.detectCrisis('Test text')).rejects.toThrow(
        'AI service error',
      )
    })

    it('should respect sensitivity level', async () => {
      // Mock the AI service response
      ;(
        mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        content: JSON.stringify({
          isCrisis: true,
          severity: 'medium',
          category: 'anxiety',
          confidence: 0.75,
          recommendedAction: 'The text indicates anxiety symptoms.',
        }),
        model: 'test-model',
        usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 },
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                isCrisis: true,
                severity: 'medium',
                category: 'anxiety',
                confidence: 0.75,
                recommendedAction: 'The text indicates anxiety symptoms.',
              }),
            },
          },
        ],
      } as AIServiceResponse)

      // Test with high sensitivity
      await crisisService.detectCrisis(
        "I'm feeling really anxious about everything.",
        { sensitivityLevel: 'high' },
      )

      // Verify the AI service was called with sensitivity parameter
      expect(mockAIService.createChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('high sensitivity'),
          }),
          expect.objectContaining({ role: 'user' }),
        ]),
        expect.objectContaining({ model: 'test-model' }),
      )

      // Reset mocks
      vi.resetAllMocks()
      ;(
        mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        content: JSON.stringify({
          isCrisis: false,
          severity: 'none',
          category: null,
          confidence: 0.75,
          recommendedAction:
            "The text indicates anxiety symptoms but doesn't meet low sensitivity threshold.",
        }),
        model: 'test-model',
        usage: { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50 },
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                isCrisis: false,
                severity: 'none',
                category: null,
                confidence: 0.75,
                recommendedAction:
                  "The text indicates anxiety symptoms but doesn't meet low sensitivity threshold.",
              }),
            },
          },
        ],
      } as AIServiceResponse)

      // Test with low sensitivity
      await crisisService.detectCrisis(
        "I'm feeling really anxious about everything.",
        { sensitivityLevel: 'low' },
      )

      // Verify the AI service was called with sensitivity parameter
      expect(mockAIService.createChatCompletion).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('low sensitivity'),
          }),
          expect.objectContaining({ role: 'user' }),
        ]),
        expect.objectContaining({ model: 'test-model' }),
      )
    })
  })

  describe('detectBatch', () => {
    it('should analyze multiple texts in parallel', async () => {
      // Mock the AI service response for multiple calls
      ;(mockAIService.createChatCompletion as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          content: JSON.stringify({
            isCrisis: true,
            severity: 'high',
            category: 'suicidal_ideation',
            confidence: 0.92,
            recommendedAction: 'High risk text',
          }),
          model: 'test-model',
          usage: {
            total_tokens: 100,
            prompt_tokens: 50,
            completion_tokens: 50,
          },
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  isCrisis: true,
                  severity: 'high',
                  category: 'suicidal_ideation',
                  confidence: 0.92,
                  recommendedAction: 'High risk text',
                }),
              },
            },
          ],
        } as AIServiceResponse)
        .mockResolvedValueOnce({
          content: JSON.stringify({
            isCrisis: false,
            severity: 'none',
            category: null,
            confidence: 0.95,
            recommendedAction: 'No risk text',
          }),
          model: 'test-model',
          usage: {
            total_tokens: 100,
            prompt_tokens: 50,
            completion_tokens: 50,
          },
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  isCrisis: false,
                  severity: 'none',
                  category: null,
                  confidence: 0.95,
                  recommendedAction: 'No risk text',
                }),
              },
            },
          ],
        } as AIServiceResponse)

      const results = await crisisService.detectBatch([
        "I can't take it anymore",
        'I had a good day today',
      ])

      // Verify the results
      expect(results).toHaveLength(2)
      expect(results[0].isCrisis).toBe(true)
      expect(results[0].severity).toBe('high')
      expect(results[1].isCrisis).toBe(false)
      expect(results[1].severity).toBe('none')

      // Verify the AI service was called twice
      expect(mockAIService.createChatCompletion).toHaveBeenCalledTimes(2)
    })

    it('should handle errors in batch processing', async () => {
      // Mock the AI service to succeed for first call and fail for second
      ;(mockAIService.createChatCompletion as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          content: JSON.stringify({
            isCrisis: true,
            severity: 'high',
            category: 'suicidal_ideation',
            confidence: 0.92,
            recommendedAction: 'High risk text',
          }),
          model: 'test-model',
          usage: {
            total_tokens: 100,
            prompt_tokens: 50,
            completion_tokens: 50,
          },
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  isCrisis: true,
                  severity: 'high',
                  category: 'suicidal_ideation',
                  confidence: 0.92,
                  recommendedAction: 'High risk text',
                }),
              },
            },
          ],
        } as AIServiceResponse)
        .mockRejectedValueOnce(new Error('AI service error'))

      await expect(
        crisisService.detectBatch([
          "I can't take it anymore",
          'I had a good day today',
        ]),
      ).rejects.toThrow()
    })
  })

  describe('constructor', () => {
    it('should use default model if not provided', () => {
      const service = new CrisisDetectionService({
        aiService: mockAIService,
      })

      // Use a non-public method to test the model
      expect(
        (service as unknown as { config: { model: string } }).config.model,
      ).toBe('gpt-4o')
    })

    it('should use custom system prompt if provided', () => {
      const customPrompt = 'Custom system prompt'
      const service = new CrisisDetectionService({
        aiService: mockAIService,
        defaultPrompt: customPrompt,
      })

      expect(
        (service as unknown as { config: { defaultPrompt: string } }).config
          .defaultPrompt,
      ).toBe(customPrompt)
    })
  })
})
