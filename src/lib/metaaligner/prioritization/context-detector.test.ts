import { describe, it, expect, vi, beforeEach } from 'vitest'
/**
 * Unit tests for Context Detection System
 */

import {
  ContextDetector,
  type ContextDetectorConfig,
  type ContextDetectionResult,
} from './context-detector'
import { ContextType } from '../core/objectives'
import type { AIService } from '../../ai/models/types'
import type { CrisisDetectionService } from '../../ai/services/crisis-detection'

// Mock dependencies
const mockAIService: AIService = {
  getModelInfo: vi.fn().mockReturnValue({
    id: 'test-model',
    name: 'Test Model',
    provider: 'test',
    capabilities: [],
    contextWindow: 4096,
    maxTokens: 2048,
  }),
  createChatCompletion: vi.fn(),
  createStreamingChatCompletion: vi.fn(),
  dispose: vi.fn(),
}

const mockDetectCrisis = vi.fn()
const mockDetectBatch = vi.fn()

const mockCrisisDetectionService = {
  detectCrisis: mockDetectCrisis,
  detectBatch: mockDetectBatch,
} as unknown as CrisisDetectionService

describe('ContextDetector', () => {
  let contextDetector: ContextDetector
  let config: ContextDetectorConfig

  beforeEach(() => {
    vi.clearAllMocks()

    config = {
      aiService: mockAIService,
      crisisDetectionService: mockCrisisDetectionService,
      model: 'gpt-4',
      enableCrisisIntegration: true,
    }

    contextDetector = new ContextDetector(config)
  })

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(contextDetector).toBeDefined()
    })

    it('should use default model when not specified', () => {
      const configWithoutModel = { ...config }
      delete configWithoutModel.model

      const detector = new ContextDetector(configWithoutModel)
      expect(detector).toBeDefined()
    })

    it('should disable crisis integration when specified', async () => {
      const configWithoutCrisis = {
        ...config,
        enableCrisisIntegration: false,
      }

      const detector = new ContextDetector(configWithoutCrisis)
      expect(detector).toBeDefined()

      // Mock AI response for general context detection
      const aiResponse = {
        id: 'test-completion',
        created: Date.now(),
        model: 'test-model',
        choices: [
          {
            message: {
              role: 'assistant' as const,
              content: JSON.stringify({
                detectedContext: 'general',
                confidence: 0.5,
                contextualIndicators: [],
                needsSpecialHandling: false,
                urgency: 'low',
                metadata: {},
              }),
            },
            finishReason: 'stop' as const,
          },
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        provider: 'test',
      }

      vi.mocked(mockAIService.createChatCompletion).mockResolvedValue(
        aiResponse,
      )

      // Test that crisis detection service is not called when integration is disabled
      const result = await detector.detectContext('I need help with something')

      expect(result.detectedContext).toBe(ContextType.GENERAL)
      expect(mockDetectCrisis).not.toHaveBeenCalled()
      expect(result.metadata['crisisAnalysis']).toBeUndefined()
    })
  })

  describe('detectContext', () => {
    describe('crisis detection integration', () => {
      it('should return crisis context when crisis is detected', async () => {
        const crisisResult: CrisisDetectionResult = {
          isCrisis: true,
          confidence: 0.9,
          category: 'self-harm',
          riskLevel: 'high',
          urgency: 'immediate',
          detectedTerms: ['hurt myself'],
          suggestedActions: ['immediate-intervention'],
          timestamp: new Date().toISOString(),
          content: 'I want to hurt myself',
        }

        mockDetectCrisis.mockResolvedValue(crisisResult)

        const result = await contextDetector.detectContext(
          'I want to hurt myself',
          [],
          'user123',
        )

        expect(result.detectedContext).toBe(ContextType.CRISIS)
        expect(result.confidence).toBe(0.9)
        expect(result.needsSpecialHandling).toBe(true)
        expect(result.urgency).toBe('critical')
        expect(result.contextualIndicators).toHaveLength(1)
        expect(result.contextualIndicators[0]?.type).toBe('crisis_detection')
        expect(mockDetectCrisis).toHaveBeenCalledWith('I want to hurt myself', {
          sensitivityLevel: 'medium',
          userId: 'user123',
          source: 'context-detection',
        })
      })

      it('should proceed with general detection when no crisis is detected', async () => {
        const crisisResult: CrisisDetectionResult = {
          isCrisis: false,
          confidence: 0.2,
          category: 'general_concern',
          riskLevel: 'low',
          urgency: 'low',
          detectedTerms: [],
          suggestedActions: [],
          timestamp: new Date().toISOString(),
          content: 'What is anxiety?',
        }

        const aiResponse = {
          id: 'test-completion',
          created: Date.now(),
          model: 'test-model',
          choices: [
            {
              message: {
                role: 'assistant' as const,
                content: JSON.stringify({
                  detectedContext: 'educational',
                  confidence: 0.8,
                  contextualIndicators: [
                    {
                      type: 'question_pattern',
                      description: 'Educational question detected',
                      confidence: 0.8,
                    },
                  ],
                  needsSpecialHandling: false,
                  urgency: 'low',
                  metadata: {},
                }),
              },
              finishReason: 'stop' as const,
            },
          ],
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
          provider: 'test',
        }

        mockDetectCrisis.mockResolvedValue(crisisResult)
        vi.mocked(mockAIService.createChatCompletion).mockResolvedValue(
          aiResponse,
        )

        const result = await contextDetector.detectContext('What is anxiety?')

        expect(result.detectedContext).toBe(ContextType.EDUCATIONAL)
        expect(result.confidence).toBe(0.8)
        expect(result.metadata['crisisAnalysis']).toBeDefined()
        expect(
          (result.metadata['crisisAnalysis'] as CrisisDetectionResult)
            ?.confidence,
        ).toBe(0.2)
      })
    })

    describe('context classification', () => {
      it('should detect educational context', async () => {
        const aiResponse = {
          id: 'test-completion',
          created: Date.now(),
          model: 'test-model',
          choices: [
            {
              message: {
                role: 'assistant' as const,
                content: JSON.stringify({
                  detectedContext: 'educational',
                  confidence: 0.85,
                  contextualIndicators: [
                    {
                      type: 'question_pattern',
                      description: 'Educational question about mental health',
                      confidence: 0.8,
                    },
                  ],
                  needsSpecialHandling: false,
                  urgency: 'low',
                  metadata: { topic: 'anxiety' },
                }),
              },
              finishReason: 'stop' as const,
            },
          ],
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
          provider: 'test',
        }

        const crisisResult: CrisisDetectionResult = {
          isCrisis: false,
          confidence: 0.1,
          category: 'general_concern',
          riskLevel: 'low',
          urgency: 'low',
          detectedTerms: [],
          suggestedActions: [],
          timestamp: new Date().toISOString(),
          content: 'What are the symptoms of anxiety?',
        }

        mockDetectCrisis.mockResolvedValue(crisisResult)
        vi.mocked(mockAIService.createChatCompletion).mockResolvedValue(
          aiResponse,
        )

        const result = await contextDetector.detectContext(
          'What are the symptoms of anxiety?',
        )

        expect(result.detectedContext).toBe(ContextType.EDUCATIONAL)
        expect(result.confidence).toBe(0.85)
        expect(result.urgency).toBe('low')
      })

      it('should detect clinical assessment context by pattern - basic diagnosis queries', async () => {
        const clinicalQueries = [
          'Can you diagnose depression for me?',
          'Do I need a clinical assessment for anxiety?',
          'I want an official diagnosis for ADHD.',
          'What is my diagnosis based on these symptoms?',
        ]
        for (const q of clinicalQueries) {
          mockDetectCrisis.mockResolvedValue({
            isCrisis: false,
            confidence: 0.05,
            category: 'general_concern',
            riskLevel: 'low',
            urgency: 'low',
            detectedTerms: [],
            suggestedActions: [],
            timestamp: new Date().toISOString(),
            content: q,
          })
          const result = await contextDetector.detectContext(q)
          expect(result.detectedContext).toBe(ContextType.CLINICAL_ASSESSMENT)
          expect(result.confidence).toBeGreaterThanOrEqual(0.8)
          expect(result.contextualIndicators?.[0]?.type).toMatch(
            /clinical_assessment/i,
          )
        }
      })

      it('should detect clinical assessment context - PHQ-9 and assessment tools', async () => {
        const phqQueries = [
          'How do I score my PHQ-9 questionnaire?',
          'Can you interpret my GAD-7 results?',
          'What does my BDI score mean?',
          'Help me calculate my PCL-5 assessment',
          'Scoring the Beck Depression Inventory',
        ]
        for (const q of phqQueries) {
          mockDetectCrisis.mockResolvedValue({
            isCrisis: false,
            confidence: 0.05,
            category: 'general_concern',
            riskLevel: 'low',
            urgency: 'low',
            detectedTerms: [],
            suggestedActions: [],
            timestamp: new Date().toISOString(),
            content: q,
          })
          const result = await contextDetector.detectContext(q)
          expect(result.detectedContext).toBe(ContextType.CLINICAL_ASSESSMENT)
          expect(result.confidence).toBeGreaterThanOrEqual(0.8)
          expect(result.needsSpecialHandling).toBe(true)
          expect(result.urgency).toBe('medium')
        }
      })

      it('should detect clinical assessment context - DSM-5 and clinical criteria', async () => {
        const dsmQueries = [
          'Do I meet the DSM-5 criteria for major depression?',
          'What are the ICD-10 diagnostic criteria?',
          'Am I meeting the requirements for PTSD diagnosis?',
          'DSM-IV criteria for bipolar disorder',
        ]
        for (const q of dsmQueries) {
          mockDetectCrisis.mockResolvedValue({
            isCrisis: false,
            confidence: 0.05,
            category: 'general_concern',
            riskLevel: 'low',
            urgency: 'low',
            detectedTerms: [],
            suggestedActions: [],
            timestamp: new Date().toISOString(),
            content: q,
          })
          const result = await contextDetector.detectContext(q)
          expect(result.detectedContext).toBe(ContextType.CLINICAL_ASSESSMENT)
          expect(result.confidence).toBeGreaterThanOrEqual(0.8)
        }
      })

      it('should detect clinical assessment context - risk assessment language', async () => {
        const riskQueries = [
          'Need a risk assessment for suicide',
          'What is the severity level of my depression?',
          'Self-harm risk evaluation needed',
          'Safety assessment for current symptoms',
        ]
        for (const q of riskQueries) {
          mockDetectCrisis.mockResolvedValue({
            isCrisis: false,
            confidence: 0.05,
            category: 'general_concern',
            riskLevel: 'low',
            urgency: 'low',
            detectedTerms: [],
            suggestedActions: [],
            timestamp: new Date().toISOString(),
            content: q,
          })
          const result = await contextDetector.detectContext(q)
          expect(result.detectedContext).toBe(ContextType.CLINICAL_ASSESSMENT)
          expect(result.confidence).toBeGreaterThanOrEqual(0.8)
        }
      })

      it('should NOT detect clinical assessment for negative cases', async () => {
        const nonClinicalQueries = [
          'What is depression?', // Educational
          'How do I cope with anxiety?', // Support/Educational
          'Tell me about therapy options', // Educational
          'I feel sad today', // Support
          'Where can I find a therapist?', // Informational
        ]
        for (const q of nonClinicalQueries) {
          mockDetectCrisis.mockResolvedValue({
            isCrisis: false,
            confidence: 0.05,
            category: 'general_concern',
            riskLevel: 'low',
            urgency: 'low',
            detectedTerms: [],
            suggestedActions: [],
            timestamp: new Date().toISOString(),
            content: q,
          })
          const result = await contextDetector.detectContext(q)
          expect(result.detectedContext).not.toBe(ContextType.CLINICAL_ASSESSMENT)
        }
      })

      it('should handle ambiguous clinical assessment cases', async () => {
        const ambiguousQueries = [
          'I think I might need to see a doctor', // Could be clinical or informational
          'Should I get evaluated?', // Vague
          'My symptoms are getting worse', // Support/General
        ]
        for (const q of ambiguousQueries) {
          mockDetectCrisis.mockResolvedValue({
            isCrisis: false,
            confidence: 0.05,
            category: 'general_concern',
            riskLevel: 'low',
            urgency: 'low',
            detectedTerms: [],
            suggestedActions: [],
            timestamp: new Date().toISOString(),
            content: q,
          })
          const result = await contextDetector.detectContext(q)
          // Ambiguous cases may or may not be clinical - just ensure we get a valid context
          expect(result.detectedContext).toBeDefined()
          expect(result.confidence).toBeGreaterThan(0)
        }
      })

      it('should meet confidence threshold >= 0.8 for clinical assessment', async () => {
        const query = 'I need a psychiatric evaluation for bipolar disorder'
        mockDetectCrisis.mockResolvedValue({
          isCrisis: false,
          confidence: 0.05,
          category: 'general_concern',
          riskLevel: 'low',
          urgency: 'low',
          detectedTerms: [],
          suggestedActions: [],
          timestamp: new Date().toISOString(),
          content: query,
        })
        const result = await contextDetector.detectContext(query)
        expect(result.detectedContext).toBe(ContextType.CLINICAL_ASSESSMENT)
        expect(result.confidence).toBeGreaterThanOrEqual(0.8)
        expect(result.confidence).toBeLessThanOrEqual(1.0)
      })

      it('should short-circuit to crisis handler when crisis signals present', async () => {
        const crisisQuery = 'I want to kill myself and need a diagnosis'
        mockDetectCrisis.mockResolvedValue({
          isCrisis: true,
          confidence: 0.95,
          category: 'suicide',
          riskLevel: 'high',
          urgency: 'immediate',
          detectedTerms: ['kill myself'],
          suggestedActions: ['immediate_intervention'],
          timestamp: new Date().toISOString(),
          content: crisisQuery,
        })
        const result = await contextDetector.detectContext(crisisQuery)
        // Crisis should override clinical assessment
        expect(result.detectedContext).toBe(ContextType.CRISIS)
        expect(result.confidence).toBeGreaterThan(0.9)
        expect(result.urgency).toBe('critical')
        expect(result.needsSpecialHandling).toBe(true)
      })

      it('should not log PII in clinical assessment detection', async () => {
        const queryWithPII = 'Can you diagnose John Smith, SSN 123-45-6789, for depression?'
        mockDetectCrisis.mockResolvedValue({
          isCrisis: false,
          confidence: 0.05,
          category: 'general_concern',
          riskLevel: 'low',
          urgency: 'low',
          detectedTerms: [],
          suggestedActions: [],
          timestamp: new Date().toISOString(),
          content: queryWithPII,
        })
        
        // Spy on logger to ensure no PII is logged
        const loggerSpy = vi.spyOn(console, 'log')
        const result = await contextDetector.detectContext(queryWithPII)
        
        expect(result.detectedContext).toBe(ContextType.CLINICAL_ASSESSMENT)
        
        // Check that no logged messages contain PII
        const logCalls = loggerSpy.mock.calls
        for (const call of logCalls) {
          const logMessage = JSON.stringify(call)
          expect(logMessage).not.toContain('John Smith')
          expect(logMessage).not.toContain('123-45-6789')
        }
        
        loggerSpy.mockRestore()
      })

      it('should detect informational context by pattern', async () => {
        const informationalQueries = [
          'Where can I find support group resources?',
          'What number to call for crisis counseling?',
          'How do I sign up for mental health services?',
          'Info on affordable counseling options.',
          'What are the hours of operation for the hotline?',
        ]
        for (const q of informationalQueries) {
          mockDetectCrisis.mockResolvedValue({
            isCrisis: false,
            confidence: 0.05,
            category: 'general_concern',
            riskLevel: 'low',
            urgency: 'low',
            detectedTerms: [],
            suggestedActions: [],
            timestamp: new Date().toISOString(),
            content: q,
          })
          const result = await contextDetector.detectContext(q)
          expect(result.detectedContext).toBe(ContextType.INFORMATIONAL)
          expect(result.confidence).toBeGreaterThanOrEqual(0.8)
          expect(result.contextualIndicators?.[0]?.type).toMatch(
            /informational/i,
          )
        }
      })
    })

    describe('error handling', () => {
      it('should handle AI service errors gracefully', async () => {
        mockDetectCrisis.mockResolvedValue({
          isCrisis: false,
          confidence: 0.1,
          category: 'general_concern',
          riskLevel: 'low',
          urgency: 'low',
          detectedTerms: [],
          suggestedActions: [],
          timestamp: new Date().toISOString(),
          content: 'Test message',
        })
        vi.mocked(mockAIService.createChatCompletion).mockRejectedValue(
          new Error('AI service error'),
        )

        const result = await contextDetector.detectContext('Test message')

        expect(result.detectedContext).toBe(ContextType.GENERAL)
        expect(result.confidence).toBe(0.1)
        expect(result.urgency).toBe('low')
        expect(result.metadata['error']).toBe('AI service error')
      })

      it('should handle malformed AI responses', async () => {
        const malformedResponse = {
          id: 'test-completion',
          created: Date.now(),
          model: 'test-model',
          choices: [
            {
              message: {
                role: 'assistant' as const,
                content: 'This is not valid JSON',
              },
              finishReason: 'stop' as const,
            },
          ],
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
          provider: 'test',
        }

        mockDetectCrisis.mockResolvedValue({
          isCrisis: false,
          confidence: 0.1,
          category: 'general_concern',
          riskLevel: 'low',
          urgency: 'low',
          detectedTerms: [],
          suggestedActions: [],
          timestamp: new Date().toISOString(),
          content: 'Test message',
        })
        vi.mocked(mockAIService.createChatCompletion).mockResolvedValue(
          malformedResponse,
        )

        const result = await contextDetector.detectContext('Test message')

        expect(result.detectedContext).toBe(ContextType.GENERAL)
        expect(result.confidence).toBe(0.3)
      })
    })
  })

  describe('detectContextBatch', () => {
    it('should process multiple inputs', async () => {
      const inputs = [
        { text: 'What is anxiety?', userId: 'user1' },
        { text: 'I need help coping', userId: 'user2' },
      ]

      const crisisResult: CrisisDetectionResult = {
        isCrisis: false,
        confidence: 0.1,
        category: 'general_concern',
        riskLevel: 'low',
        urgency: 'low',
        detectedTerms: [],
        suggestedActions: [],
        timestamp: new Date().toISOString(),
        content: 'batch processing',
      }

      mockDetectCrisis.mockResolvedValue(crisisResult)

      const aiResponses = [
        { detectedContext: 'educational', confidence: 0.8 },
        { detectedContext: 'support', confidence: 0.7 },
      ].map((ctx) => ({
        id: 'test-completion',
        created: Date.now(),
        model: 'test-model',
        choices: [
          {
            message: {
              role: 'assistant' as const,
              content: JSON.stringify({
                ...ctx,
                contextualIndicators: [],
                needsSpecialHandling: false,
                urgency: 'low',
                metadata: {},
              }),
            },
            finishReason: 'stop' as const,
          },
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        provider: 'test',
      }))

      vi.mocked(mockAIService.createChatCompletion)
        .mockResolvedValueOnce(aiResponses[0]!)
        .mockResolvedValueOnce(aiResponses[1]!)

      const results = await contextDetector.detectContextBatch(inputs)

      expect(results).toHaveLength(2)
      expect(results[0]?.detectedContext).toBe(ContextType.EDUCATIONAL)
      expect(results[1]?.detectedContext).toBe(ContextType.SUPPORT)
    })
  })

  describe('createAlignmentContext', () => {
    it('should create properly structured alignment context', () => {
      const userQuery = 'I need help with anxiety'
      const detectionResult: ContextDetectionResult = {
        detectedContext: ContextType.SUPPORT,
        confidence: 0.8,
        contextualIndicators: [],
        needsSpecialHandling: false,
        urgency: 'medium',
        metadata: {},
      }

      const alignmentContext = contextDetector.createAlignmentContext(
        userQuery,
        detectionResult,
      )

      expect(alignmentContext.userQuery).toBe(userQuery)
      expect(alignmentContext.detectedContext).toBe(ContextType.SUPPORT)
      expect(alignmentContext.sessionMetadata?.['confidence']).toBe(0.8)
      expect(alignmentContext.sessionMetadata?.['urgency']).toBe('medium')
      expect(alignmentContext.sessionMetadata?.['needsSpecialHandling']).toBe(
        false,
      )
    })
  })
})
