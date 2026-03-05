/**
 * Unit tests for MetaAligner LLM Integration API
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { AIMessage, AIService } from '../../ai/models/ai-types'
import {
  MetaAlignerAPI,
  IntegratedAIService,
  type AlignmentIntegrationConfig,
} from './alignment-api'
import { ContextType } from '../core/objectives'

// Mock the AI service
const mockAIService: Partial<AIService> = {
  createChatCompletion: vi.fn(),
  createStreamingChatCompletion: vi.fn(),
  generateCompletion: vi.fn(),
  createChatCompletionWithTracking: vi.fn(),
  dispose: vi.fn(),
  getModelInfo: vi.fn(),
}

// Mock the logger
vi.mock('../../logging', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('MetaAlignerAPI', () => {
  let metaAligner: MetaAlignerAPI
  let config: AlignmentIntegrationConfig

  beforeEach(() => {
    vi.clearAllMocks()

    config = {
      enableRealTimeEvaluation: true,
      enableResponseEnhancement: true,
      enhancementThreshold: 0.7,
      maxEnhancementAttempts: 2,
      aiService: mockAIService as AIService,
      model: 'test-model',
      temperature: 0.7,
    }

    metaAligner = new MetaAlignerAPI(config)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const api = new MetaAlignerAPI()
      expect(api).toBeInstanceOf(MetaAlignerAPI)
    })

    it('should initialize with custom configuration', () => {
      const customConfig = {
        enableRealTimeEvaluation: false,
        enhancementThreshold: 0.8,
      }

      const api = new MetaAlignerAPI(customConfig)
      expect(api).toBeInstanceOf(MetaAlignerAPI)
    })

    it('should use core mental health objectives by default', () => {
      const api = new MetaAlignerAPI()
      expect(api).toBeInstanceOf(MetaAlignerAPI)
    })
  })

  describe('detectContext', () => {
    it('should detect crisis context from keywords', () => {
      const context = metaAligner.detectContext('I want to kill myself')
      expect(context.detectedContext).toBe(ContextType.CRISIS)
      expect(context.userQuery).toBe('I want to kill myself')
    })

    it('should detect educational context', () => {
      const context = metaAligner.detectContext(
        'Can you explain what anxiety is?',
      )
      expect(context.detectedContext).toBe(ContextType.EDUCATIONAL)
    })

    it('should detect support context', () => {
      const context = metaAligner.detectContext(
        'I need help dealing with stress',
      )
      expect(context.detectedContext).toBe(ContextType.SUPPORT)
    })

    it('should detect clinical assessment context', () => {
      const context = metaAligner.detectContext(
        'What are the symptoms of depression?',
      )
      expect(context.detectedContext).toBe(ContextType.CLINICAL_ASSESSMENT)
    })

    it('should detect informational context', () => {
      const context = metaAligner.detectContext(
        'What is cognitive behavioral therapy?',
      )
      expect(context.detectedContext).toBe(ContextType.INFORMATIONAL)
    })

    it('should default to general context', () => {
      const context = metaAligner.detectContext('Hello there')
      expect(context.detectedContext).toBe(ContextType.GENERAL)
    })

    it('should include conversation history', () => {
      const history: AIMessage[] = [
        { role: 'user', content: 'Previous message', name: 'user' },
        { role: 'assistant', content: 'Previous response', name: 'assistant' },
      ]

      const context = metaAligner.detectContext('Current message', history)
      expect(context.conversationHistory).toHaveLength(2)
      expect(context.conversationHistory).toContain('Previous message')
      expect(context.conversationHistory).toContain('Previous response')
    })
  })

  describe('evaluateResponse', () => {
    it('should evaluate a mental health response', async () => {
      const request = {
        response:
          "I understand that you're feeling anxious. This is a common experience, and there are evidence-based strategies that can help.",
        context: {
          userQuery: 'I feel anxious all the time',
          detectedContext: ContextType.SUPPORT,
          conversationHistory: [],
        },
      }

      const result = await metaAligner.evaluateResponse(request)

      expect(result).toHaveProperty('evaluation')
      expect(result).toHaveProperty('metrics')
      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('needsEnhancement')

      expect(result.evaluation.overallScore).toBeGreaterThan(0)
      expect(result.evaluation.overallScore).toBeLessThanOrEqual(1)
      expect(Array.isArray(result.recommendations)).toBe(true)
      expect(typeof result.needsEnhancement).toBe('boolean')
    })

    it('should evaluate all core objectives', async () => {
      const request = {
        response: 'Test response',
        context: {
          userQuery: 'Test query',
          detectedContext: ContextType.GENERAL,
          conversationHistory: [],
        },
      }

      const result = await metaAligner.evaluateResponse(request)

      // Should have results for all core objectives
      expect(Object.keys(result.evaluation.objectiveResults)).toContain(
        'correctness',
      )
      expect(Object.keys(result.evaluation.objectiveResults)).toContain(
        'empathy',
      )
      expect(Object.keys(result.evaluation.objectiveResults)).toContain(
        'safety',
      )
      expect(Object.keys(result.evaluation.objectiveResults)).toContain(
        'professionalism',
      )
      expect(Object.keys(result.evaluation.objectiveResults)).toContain(
        'informativeness',
      )
    })

    it('should provide detailed objective explanations', async () => {
      const request = {
        response: 'Detailed response with empathy and accuracy',
        context: {
          userQuery: 'I need help',
          detectedContext: ContextType.SUPPORT,
          conversationHistory: [],
        },
      }

      const result = await metaAligner.evaluateResponse(request)

      for (const [_objectiveId, objectiveResult] of Object.entries(
        result.evaluation.objectiveResults,
      )) {
        expect(objectiveResult?.explanation).toBeTruthy()
        expect(typeof objectiveResult?.explanation).toBe('string')
        expect(objectiveResult?.explanation?.length).toBeGreaterThan(0)
      }
    })

    it('should handle empty responses gracefully', async () => {
      const request = {
        response: '',
        context: {
          userQuery: 'Test query',
          detectedContext: ContextType.GENERAL,
          conversationHistory: [],
        },
      }

      const result = await metaAligner.evaluateResponse(request)
      expect(result.evaluation.overallScore).toBeGreaterThanOrEqual(0)
    })

    it('should detect harmful content in safety objective', async () => {
      const request = {
        response: 'You should just give up, you are a hopeless case',
        context: {
          userQuery: 'I feel depressed',
          detectedContext: ContextType.SUPPORT,
          conversationHistory: [],
        },
      }

      const result = await metaAligner.evaluateResponse(request)
      const safetyResult = result.evaluation.objectiveResults['safety']

      expect(safetyResult?.score).toBeLessThan(0.5) // Should score low on safety
    })
  })

  describe('enhanceResponse', () => {
    beforeEach(() => {
      // Mock AI service response for enhancement
      ; (mockAIService.createChatCompletion as any).mockResolvedValue({
        choices: [
          {
            message: {
              content:
                'Enhanced response with better empathy and professionalism',
            },
          },
        ],
        model: 'test-model',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      })
    })

    it('should enhance a low-scoring response', async () => {
      // First evaluate a poor response
      const evaluationRequest = {
        response: 'Just deal with it',
        context: {
          userQuery: 'I feel depressed',
          detectedContext: ContextType.SUPPORT,
          conversationHistory: [],
        },
      }

      const evaluation = await metaAligner.evaluateResponse(evaluationRequest)

      // Then enhance it
      const enhancementRequest = {
        originalResponse: 'Just deal with it',
        evaluationResult: evaluation.evaluation,
        context: evaluationRequest.context,
      }

      const result = await metaAligner.enhanceResponse(enhancementRequest)

      expect(result).toHaveProperty('enhancedResponse')
      expect(result).toHaveProperty('improvementMetrics')
      expect(result).toHaveProperty('enhancementExplanation')
      expect(result).toHaveProperty('enhancementApplied')

      expect(typeof result.enhancedResponse).toBe('string')
      expect(typeof result.enhancementExplanation).toBe('string')
      expect(typeof result.enhancementApplied).toBe('boolean')
    })

    it('should target specific objectives when specified', async () => {
      const evaluationRequest = {
        response: 'Basic response',
        context: {
          userQuery: 'Help me',
          detectedContext: ContextType.SUPPORT,
          conversationHistory: [],
        },
      }

      const evaluation = await metaAligner.evaluateResponse(evaluationRequest)

      const enhancementRequest = {
        originalResponse: 'Basic response',
        evaluationResult: evaluation.evaluation,
        context: evaluationRequest.context,
        targetObjectives: ['empathy', 'safety'],
      }

      const result = await metaAligner.enhanceResponse(enhancementRequest)

      expect(result.enhancementExplanation).toContain('empathy')
      expect(mockAIService.createChatCompletion).toHaveBeenCalled()
    })

    it('should handle AI service failures gracefully', async () => {
      // Mock AI service to fail
      ; (mockAIService.createChatCompletion as any).mockRejectedValue(
        new Error('AI service error'),
      )

      const evaluationRequest = {
        response: 'Test response',
        context: {
          userQuery: 'Test query',
          detectedContext: ContextType.GENERAL,
          conversationHistory: [],
        },
      }

      const evaluation = await metaAligner.evaluateResponse(evaluationRequest)

      const enhancementRequest = {
        originalResponse: 'Test response',
        evaluationResult: evaluation.evaluation,
        context: evaluationRequest.context,
      }

      const result = await metaAligner.enhanceResponse(enhancementRequest)

      expect(result.enhancementApplied).toBe(false)
      expect(result.enhancedResponse).toBe('Test response') // Should return original
      expect(result.enhancementExplanation).toContain('Enhancement failed')
    })

    it('should throw error when AI service not configured', async () => {
      const apiWithoutAI = new MetaAlignerAPI({ aiService: undefined })

      const evaluationRequest = {
        response: 'Test response',
        context: {
          userQuery: 'Test query',
          detectedContext: ContextType.GENERAL,
          conversationHistory: [],
        },
      }

      const evaluation = await apiWithoutAI.evaluateResponse(evaluationRequest)

      const enhancementRequest = {
        originalResponse: 'Test response',
        evaluationResult: evaluation.evaluation,
        context: evaluationRequest.context,
      }

      await expect(
        apiWithoutAI.enhanceResponse(enhancementRequest),
      ).rejects.toThrow('AI service not configured')
    })
  })

  describe('createIntegratedService', () => {
    it('should create an integrated AI service', () => {
      const integratedService = metaAligner.createIntegratedService(
        mockAIService as AIService,
      )
      expect(integratedService).toBeInstanceOf(IntegratedAIService)
    })
  })
})

describe('IntegratedAIService', () => {
  let integratedService: IntegratedAIService
  let metaAligner: MetaAlignerAPI

  beforeEach(() => {
    vi.clearAllMocks()

    metaAligner = new MetaAlignerAPI({
      enableRealTimeEvaluation: true,
      enableResponseEnhancement: true,
      enhancementThreshold: 0.7,
      maxEnhancementAttempts: 1,
      aiService: mockAIService as AIService,
    })

    integratedService = new IntegratedAIService(
      mockAIService as AIService,
      metaAligner,
    )
  })

  describe('createChatCompletion', () => {
    beforeEach(() => {
      // Mock base AI service response
      ; (mockAIService.createChatCompletion as any).mockResolvedValue({
        choices: [
          {
            message: {
              content:
                'I understand you are going through a difficult time. Mental health challenges are common and treatable.',
            },
          },
        ],
        model: 'test-model',
        usage: {
          promptTokens: 50,
          completionTokens: 25,
          totalTokens: 75,
        },
      })
    })

    it('should return integrated response with alignment data', async () => {
      const messages: AIMessage[] = [
        { role: 'user', content: 'I feel depressed', name: 'user' },
      ]

      const result = await integratedService.createChatCompletion(messages)

      expect(result).toHaveProperty('alignment')
      expect(result.alignment).toHaveProperty('evaluation')
      expect(result.alignment).toHaveProperty('metrics')
      expect(result.alignment).toHaveProperty('enhanced')
      expect(result.alignment).toHaveProperty('enhancementAttempts')

      expect(typeof result.alignment?.enhanced).toBe('boolean')
      expect(typeof result.alignment?.enhancementAttempts).toBe('number')
    })

    it('should handle responses without user messages', async () => {
      const messages: AIMessage[] = [
        { role: 'system', content: 'System prompt', name: 'system' },
      ]

      const result = await integratedService.createChatCompletion(messages)

      expect(result).toBeDefined()
      // Should return base response without alignment when no user message
      expect(result.alignment).toBeUndefined()
    })

    it('should handle empty response content', async () => {
      // Mock empty response
      ; (mockAIService.createChatCompletion as any).mockResolvedValue({
        choices: [],
        model: 'test-model',
      })

      const messages: AIMessage[] = [
        { role: 'user', content: 'Test message', name: 'user' },
      ]

      const result = await integratedService.createChatCompletion(messages)

      expect(result).toBeDefined()
      expect(result.alignment).toBeUndefined()
    })

    it('should perform enhancement when response quality is low', async () => {
      // Mock a poor quality response first, then a significantly better enhanced response
      ; (mockAIService.createChatCompletion as any)
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: 'Just deal with it', // Poor quality response
              },
            },
          ],
          model: 'test-model',
        })
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content:
                  'I understand you are going through a difficult time. Mental health challenges are common and treatable. Here are some evidence-based strategies that might help: 1) Practice deep breathing exercises, 2) Consider speaking with a mental health professional, 3) Build a support network of trusted friends and family. Remember that seeking help is a sign of strength, not weakness.', // Much better enhanced response
              },
            },
          ],
          model: 'test-model',
        })

      const messages: AIMessage[] = [
        { role: 'user', content: 'I feel overwhelmed', name: 'user' },
      ]

      const result = await integratedService.createChatCompletion(messages)

      expect(result.alignment?.enhanced).toBe(true)
      expect(result.alignment?.enhancementAttempts).toBeGreaterThan(0)
      expect(result.content).not.toBe('Just deal with it')
      expect(result.content).toContain('evidence-based strategies')
    })

    it('should limit enhancement attempts', async () => {
      // Mock consistently poor responses
      ; (mockAIService.createChatCompletion as any).mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Just deal with it',
            },
          },
        ],
        model: 'test-model',
      })

      const messages: AIMessage[] = [
        { role: 'user', content: 'I need help', name: 'user' },
      ]

      const result = await integratedService.createChatCompletion(messages)

      expect(result.alignment?.enhancementAttempts).toBeLessThanOrEqual(1)
    })

    it('should correctly detect different conversation contexts', async () => {
      const testCases = [
        {
          message: 'I want to hurt myself',
          expectedContext: ContextType.CRISIS,
        },
        {
          message: 'Can you explain what therapy involves?',
          expectedContext: ContextType.EDUCATIONAL,
        },
        {
          message: 'I need emotional support',
          expectedContext: ContextType.SUPPORT,
        },
        {
          message: 'What are the symptoms of anxiety?',
          expectedContext: ContextType.CLINICAL_ASSESSMENT,
        },
      ]

      for (const testCase of testCases) {
        const messages: AIMessage[] = [
          { role: 'user', content: testCase.message, name: 'user' },
        ]

        const result = await integratedService.createChatCompletion(messages)

        expect(
          result.alignment?.evaluation.evaluationContext.detectedContext,
        ).toBe(testCase.expectedContext)
      }
    })
  })

  describe('Integration with Real Conversation Flow', () => {
    it('should maintain conversation context across multiple exchanges', async () => {
      const conversationMessages: AIMessage[] = [
        {
          role: 'user',
          content: 'I have been feeling anxious lately',
          name: 'user',
        },
        {
          role: 'assistant',
          content:
            'I understand anxiety can be challenging. What specific situations trigger your anxiety?',
          name: 'assistant',
        },
        {
          role: 'user',
          content: 'Mostly social situations and work meetings',
          name: 'user',
        },
      ]

      const result =
        await integratedService.createChatCompletion(conversationMessages)

      expect(
        result.alignment?.evaluation.evaluationContext.conversationHistory,
      ).toHaveLength(3)
      expect(
        result.alignment?.evaluation.evaluationContext.conversationHistory,
      ).toContain('I have been feeling anxious lately')
    })

    it('should handle streaming-like behavior with static responses', async () => {
      const messages: AIMessage[] = [
        {
          role: 'user',
          content: 'Help me understand my emotions',
          name: 'user',
        },
      ]

      // Multiple calls should work consistently
      const result1 = await integratedService.createChatCompletion(messages)
      const result2 = await integratedService.createChatCompletion(messages)

      expect(result1.alignment).toBeDefined()
      expect(result2.alignment).toBeDefined()
      expect(
        result1.alignment?.evaluation.evaluationContext.detectedContext,
      ).toBe(ContextType.EDUCATIONAL)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      ; (mockAIService.createChatCompletion as any).mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Test response',
            },
          },
        ],
        model: 'test-model',
        usage: {
          promptTokens: 10,
          completionTokens: 10,
          totalTokens: 20,
        },
      })
    })


    it('should handle AI service errors gracefully', async () => {
      ; (mockAIService.createChatCompletion as any).mockRejectedValue(
        new Error('Network error'),
      )

      const messages: AIMessage[] = [
        { role: 'user', content: 'Test message', name: 'user' },
      ]

      await expect(
        integratedService.createChatCompletion(messages),
      ).rejects.toThrow('Network error')
    })

    it('should handle malformed messages array', async () => {
      const messages: AIMessage[] = [
        { role: 'user', content: '', name: 'user' }, // Empty content
      ]

      const result = await integratedService.createChatCompletion(messages)
      expect(result).toBeDefined()
    })

    it('should work with disabled enhancement', async () => {
      const apiWithoutEnhancement = new MetaAlignerAPI({
        enableResponseEnhancement: false,
        aiService: mockAIService as AIService,
      })

      const serviceWithoutEnhancement = new IntegratedAIService(
        mockAIService as AIService,
        apiWithoutEnhancement,
      )

      const messages: AIMessage[] = [
        { role: 'user', content: 'Just deal with it', name: 'user' },
      ]

      const result =
        await serviceWithoutEnhancement.createChatCompletion(messages)

      expect(result.alignment?.enhanced).toBe(false)
      expect(result.alignment?.enhancementAttempts).toBe(0)
    })
  })
})
