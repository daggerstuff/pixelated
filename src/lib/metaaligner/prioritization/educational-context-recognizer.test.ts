import { describe, it, expect, vi, beforeEach } from 'vitest'
/**
 * Unit tests for Educational Context Recognition System
 */

import {
  EducationalContextRecognizer,
  createEducationalContextRecognizer,
  getDefaultEducationalRecognizerConfig,
  EducationalType,
  TopicArea,
  ResourceType,
} from './educational-context-recognizer'
import type {
  EducationalRecognizerConfig,
  EducationalContextResult,
} from './educational-context-recognizer'
import type { AIService } from '../../ai/models/types'

// Mock dependencies
const mockAIService: AIService = {
  getModelInfo: vi.fn(),
  createChatCompletion: vi.fn(),
  createChatStream: vi.fn(),
}

describe('EducationalContextRecognizer', () => {
  let recognizer: EducationalContextRecognizer
  let config: EducationalRecognizerConfig

  beforeEach(() => {
    vi.clearAllMocks()

    config = {
      aiService: mockAIService,
      model: 'gpt-4',
      includeResourceRecommendations: true,
      adaptToUserLevel: true,
      enableTopicMapping: true,
    }

    recognizer = new EducationalContextRecognizer(config)
  })

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(recognizer).toBeDefined()
    })

    it('should use default values for optional config properties', () => {
      const minimalConfig = { aiService: mockAIService }
      const minimalRecognizer = new EducationalContextRecognizer(minimalConfig)
      expect(minimalRecognizer).toBeDefined()
    })
  })

  describe('recognizeEducationalContext', () => {
    describe('pattern-based recognition', () => {
      it('should recognize definition questions', async () => {
        const queries = [
          'What is depression?',
          'Define anxiety disorder',
          'What are the meaning of PTSD symptoms?',
          'Tell me about bipolar disorder',
        ]

        for (const query of queries) {
          const result = await recognizer.recognizeEducationalContext(query)
          if (!result.isEducational) {
            // Log actual result for debugging
            // eslint-disable-next-line no-console
            console.log('DEBUG FAIL: Definition question result:', result)
          }
          expect(result.isEducational).toBe(true)
          expect(result.educationalType).toBe(EducationalType.DEFINITION)
          expect(result.confidence).toBeGreaterThan(0.5)
        }
      })

      it('should recognize explanation questions', async () => {
        const queries = [
          'How does therapy work?',
          'Why do antidepressants take time to work?',
          'How can meditation help with anxiety?',
          'Explain how CBT works',
        ]

        for (const query of queries) {
          const result = await recognizer.recognizeEducationalContext(query)
          if (!result.isEducational) {
            // Log actual result for debugging
            // eslint-disable-next-line no-console
            console.log('DEBUG FAIL: Explanation question result:', result)
          }
          expect(result.isEducational).toBe(true)
          expect(result.educationalType).toBe(EducationalType.EXPLANATION)
          expect(result.confidence).toBeGreaterThan(0.5)
        }
      })

      it('should recognize comparison questions', async () => {
        const queries = [
          "What's the difference between anxiety and panic attacks?",
          'Compare CBT vs DBT',
          'Depression versus sadness',
          'Which is better: medication or therapy?',
        ]

        for (const query of queries) {
          const result = await recognizer.recognizeEducationalContext(query)
          if (!result.isEducational) {
            // Log actual result for debugging
            // eslint-disable-next-line no-console
            console.log('DEBUG FAIL: Comparison question result:', result)
          }
          expect(result.isEducational).toBe(true)
          expect(result.educationalType).toBe(EducationalType.COMPARISON)
          expect(result.confidence).toBeGreaterThan(0.5)
        }
      })

      it('should recognize symptom questions', async () => {
        const queries = [
          'What are the symptoms of depression?',
          'Signs of anxiety disorder',
          'How do I know if I have PTSD?',
          'Warning signs of bipolar disorder',
        ]

        for (const query of queries) {
          const result = await recognizer.recognizeEducationalContext(query)
          if (!result.isEducational) {
            // Log actual result for debugging
            // eslint-disable-next-line no-console
            console.log('DEBUG FAIL: Symptom question result:', result)
          }
          expect(result.isEducational).toBe(true)
          expect(result.educationalType).toBe(EducationalType.SYMPTOMS)
          expect(result.confidence).toBeGreaterThan(0.5)
        }
      })

      it('should identify topic areas correctly', async () => {
        const topicTests = [
          { query: 'What is depression?', expectedTopic: TopicArea.DEPRESSION },
          {
            query: 'How does anxiety affect the brain?',
            expectedTopic: TopicArea.ANXIETY,
          },
          { query: 'What is CBT therapy?', expectedTopic: TopicArea.THERAPY },
          {
            query: 'How do antidepressants work?',
            expectedTopic: TopicArea.MEDICATION,
          },
        ]

        for (const test of topicTests) {
          const result = await recognizer.recognizeEducationalContext(
            test.query,
          )
          if (result.topicArea !== test.expectedTopic) {
            // Log actual topic area for debugging
            // eslint-disable-next-line no-console
            console.log('DEBUG FAIL: Topic mapping result:', {
              query: test.query,
              actual: result.topicArea,
              expected: test.expectedTopic,
              result,
            })
          }
          expect(result.topicArea).toBe(test.expectedTopic)
        }
      })
    })

    describe('AI-powered analysis', () => {
      it('should use AI for detailed analysis when pattern confidence is high', async () => {
        const aiResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isEducational: true,
                  confidence: 0.95,
                  educationalType: 'definition',
                  complexity: 'basic',
                  topicArea: 'depression',
                  learningObjectives: [
                    'Understand what depression is',
                    'Learn basic symptoms',
                  ],
                  recommendedResources: ['educational_videos', 'infographics'],
                  priorKnowledgeRequired: [],
                  metadata: {
                    conceptualDepth: 0.3,
                    practicalApplications: [
                      'self-awareness',
                      'recognition in others',
                    ],
                    relatedTopics: ['anxiety', 'mood disorders'],
                    ageAppropriateness: 'all',
                  },
                }),
              },
            },
          ],
        }

          ; (
            mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
          ).mockResolvedValue(aiResponse)

        // First test the pattern manually to debug
        const testPattern =
          /\b(?:what is|what are|define|definition of|meaning of)\b/i
        const testQuery = 'what is depression?'
        const manualTest = testPattern.test(testQuery)
        console.log('Manual pattern test:', {
          testQuery,
          pattern: testPattern.toString(),
          matches: manualTest,
        })

        const result = await recognizer.recognizeEducationalContext(
          'What is depression?',
        )

        // First check if the pattern-based recognition is working
        if (!result.isEducational) {
          throw new Error(
            `Pattern recognition failed. Manual test: ${manualTest}. Result: ${JSON.stringify(result)}`,
          )
        }

        expect(result.isEducational).toBe(true)
        expect(result.confidence).toBeGreaterThan(0.8)
        expect(result.educationalType).toBe(EducationalType.DEFINITION)
        expect(result.topicArea).toBe(TopicArea.DEPRESSION)
        expect(result.learningObjectives).toHaveLength(2)
        expect(result.recommendedResources).toContain(
          ResourceType.EDUCATIONAL_VIDEOS,
        )
        expect(mockAIService.createChatCompletion).toHaveBeenCalled()
      })

      it('should skip AI analysis for low-confidence pattern matches', async () => {
        vi.clearAllMocks() // ensure clean slate before assertion

        const result =
          await recognizer.recognizeEducationalContext('Hello there')

        expect(result.isEducational).toBe(false)
        expect(result.confidence).toBeLessThan(0.3)
        expect(mockAIService.createChatCompletion).not.toHaveBeenCalled()
      })

      it('should include user profile context in AI analysis', async () => {
        const userProfile = {
          educationLevel: 'graduate' as const,
          priorMentalHealthKnowledge: 'intermediate' as const,
          preferredLearningStyle: 'visual' as const,
        }

        const aiResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isEducational: true,
                  confidence: 0.9,
                  educationalType: 'explanation',
                  complexity: 'advanced',
                  topicArea: 'therapy',
                  learningObjectives: ['Understand therapeutic mechanisms'],
                  recommendedResources: [
                    'scientific_articles',
                    'interactive_tools',
                  ],
                  priorKnowledgeRequired: ['basic psychology concepts'],
                  metadata: {
                    conceptualDepth: 0.8,
                    practicalApplications: ['clinical practice'],
                    relatedTopics: ['neuroscience', 'psychology'],
                  },
                }),
              },
            },
          ],
        }

          ; (
            mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
          ).mockResolvedValue(aiResponse)

        const result = await recognizer.recognizeEducationalContext(
          'How does cognitive behavioral therapy work at the neurological level?',
          userProfile,
        )

        expect(result.complexity).toBe('advanced')
        expect(result.recommendedResources).toContain(
          ResourceType.SCIENTIFIC_ARTICLES,
        )

        // Verify that user context was passed to AI
        const callArgs = (
          mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
        ).mock.calls[0]
        const systemMessage = callArgs?.[0]?.[0]?.content
        expect(systemMessage).toContain('Education Level: graduate')
        expect(systemMessage).toContain(
          'Prior Mental Health Knowledge: intermediate',
        )
      })

      it('should include conversation history in analysis', async () => {
        const conversationHistory = [
          "I've been learning about mental health",
          'Previously asked about anxiety',
          'Now I want to understand more',
        ]

        const aiResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isEducational: true,
                  confidence: 0.85,
                  educationalType: 'explanation',
                  complexity: 'intermediate',
                  topicArea: 'anxiety',
                  learningObjectives: ['Build on previous anxiety knowledge'],
                  recommendedResources: ['educational_videos'],
                  priorKnowledgeRequired: ['basic anxiety concepts'],
                  metadata: {
                    conceptualDepth: 0.6,
                    practicalApplications: [],
                    relatedTopics: ['panic disorders'],
                  },
                }),
              },
            },
          ],
        }

          ; (
            mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
          ).mockResolvedValue(aiResponse)

        await recognizer.recognizeEducationalContext(
          'How do panic attacks relate to anxiety?',
          undefined,
          conversationHistory,
        )

        const callArgs = (
          mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
        ).mock.calls[0]
        const userMessage = callArgs?.[0]?.[1]?.content
        expect(userMessage).toContain('Previous context:')
        expect(userMessage).toContain('Now I want to understand more')
      })
    })

    describe('complexity determination', () => {
      it('should determine basic complexity for simple queries', async () => {
        const result = await recognizer.recognizeEducationalContext(
          'What is depression?',
        )
        expect(result.complexity).toBe('basic')
      })

      it('should determine advanced complexity for research queries', async () => {
        const aiResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isEducational: true,
                  confidence: 0.9,
                  educationalType: 'research',
                  complexity: 'advanced',
                  topicArea: 'depression',
                  learningObjectives: [],
                  recommendedResources: [],
                  priorKnowledgeRequired: [],
                  metadata: {
                    conceptualDepth: 0.9,
                    practicalApplications: [],
                    relatedTopics: [],
                  },
                }),
              },
            },
          ],
        }

          ; (
            mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
          ).mockResolvedValue(aiResponse)

        const result = await recognizer.recognizeEducationalContext(
          'What does the latest neurobiology research say about depression mechanisms?',
        )

        expect(result.complexity).toBe('advanced')
      })
    })

    describe('user adaptation', () => {
      it('should adapt complexity based on user profile', async () => {
        const basicUserProfile = {
          educationLevel: 'high_school' as const,
          priorMentalHealthKnowledge: 'none' as const,
        }

        const aiResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isEducational: true,
                  confidence: 0.8,
                  educationalType: 'definition',
                  complexity: 'advanced', // AI suggests advanced
                  topicArea: 'depression',
                  learningObjectives: [],
                  recommendedResources: ['educational_videos'],
                  priorKnowledgeRequired: [],
                  metadata: {
                    conceptualDepth: 0.5,
                    practicalApplications: [],
                    relatedTopics: [],
                  },
                }),
              },
            },
          ],
        }

          ; (
            mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
          ).mockResolvedValue(aiResponse)

        const result = await recognizer.recognizeEducationalContext(
          'What is depression?',
          basicUserProfile,
        )

        // Should adapt advanced to intermediate for basic user
        expect(result.complexity).toBe('intermediate')
      })

      it('should adapt resources based on learning style', async () => {
        const visualLearnerProfile = {
          preferredLearningStyle: 'visual' as const,
        }

        const aiResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isEducational: true,
                  confidence: 0.8,
                  educationalType: 'definition',
                  complexity: 'basic',
                  topicArea: 'anxiety',
                  learningObjectives: [],
                  recommendedResources: ['books', 'podcasts'],
                  priorKnowledgeRequired: [],
                  metadata: {
                    conceptualDepth: 0.5,
                    practicalApplications: [],
                    relatedTopics: [],
                  },
                }),
              },
            },
          ],
        }

          ; (
            mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
          ).mockResolvedValue(aiResponse)

        const result = await recognizer.recognizeEducationalContext(
          'What is anxiety?',
          visualLearnerProfile,
        )

        // Should include visual resources for visual learner
        expect(result.recommendedResources).toContain(ResourceType.INFOGRAPHICS)
        expect(result.recommendedResources).toContain(
          ResourceType.EDUCATIONAL_VIDEOS,
        )
      })
    })

    describe('error handling', () => {
      it('should handle AI service errors gracefully', async () => {
        ; (
          mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
        ).mockRejectedValue(new Error('AI service error'))

        const result = await recognizer.recognizeEducationalContext(
          'What is depression?',
        )

        // Should fall back to pattern-based result
        expect(result).toBeDefined()
        expect(result.educationalType).toBe(EducationalType.DEFINITION)
        expect(result.topicArea).toBe(TopicArea.DEPRESSION)
      })

      it('should handle malformed AI responses', async () => {
        const malformedResponse = {
          choices: [
            {
              message: {
                content: 'This is not valid JSON',
              },
            },
          ],
        }

          ; (
            mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
          ).mockResolvedValue(malformedResponse)

        const result = await recognizer.recognizeEducationalContext(
          'What is depression?',
        )

        expect(result.isEducational).toBe(false)
        expect(result.confidence).toBe(0.1)
      })
    })

    describe('validation', () => {
      it('should validate and normalize educational types', async () => {
        const aiResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isEducational: true,
                  confidence: 0.8,
                  educationalType: 'invalid_type',
                  complexity: 'basic',
                  topicArea: 'depression',
                  learningObjectives: [],
                  recommendedResources: [],
                  priorKnowledgeRequired: [],
                  metadata: {
                    conceptualDepth: 0.5,
                    practicalApplications: [],
                    relatedTopics: [],
                  },
                }),
              },
            },
          ],
        }

          ; (
            mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
          ).mockResolvedValue(aiResponse)

        const result = await recognizer.recognizeEducationalContext(
          'What is depression?',
        )

        expect(result.educationalType).toBe(EducationalType.DEFINITION)
      })

      it('should clamp confidence values to valid range', async () => {
        const aiResponse = {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isEducational: true,
                  confidence: 1.5, // Invalid - too high
                  educationalType: 'definition',
                  complexity: 'basic',
                  topicArea: 'depression',
                  learningObjectives: [],
                  recommendedResources: [],
                  priorKnowledgeRequired: [],
                  metadata: {
                    conceptualDepth: 0.5,
                    practicalApplications: [],
                    relatedTopics: [],
                  },
                }),
              },
            },
          ],
        }

          ; (
            mockAIService.createChatCompletion as ReturnType<typeof vi.fn>
          ).mockResolvedValue(aiResponse)

        const result = await recognizer.recognizeEducationalContext(
          'What is depression?',
        )

        expect(result.confidence).toBeLessThanOrEqual(1.0)
      })
    })
  })

  describe('recognizeBatch', () => {
    it('should process multiple queries', async () => {
      const queries = [
        { query: 'What is depression?' },
        { query: 'How does therapy work?' },
        { query: 'What are anxiety symptoms?' },
      ]

      const aiResponses = [
        { educationalType: 'definition', topicArea: 'depression' },
        { educationalType: 'explanation', topicArea: 'therapy' },
        { educationalType: 'symptoms', topicArea: 'anxiety' },
      ].map((ctx) => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                isEducational: true,
                confidence: 0.8,
                ...ctx,
                complexity: 'basic',
                learningObjectives: [],
                recommendedResources: [],
                priorKnowledgeRequired: [],
                metadata: {
                  conceptualDepth: 0.5,
                  practicalApplications: [],
                  relatedTopics: [],
                },
              }),
            },
          },
        ],
      }))

        ; (mockAIService.createChatCompletion as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce(aiResponses[0])
          .mockResolvedValueOnce(aiResponses[1])
          .mockResolvedValueOnce(aiResponses[2])

      const results = await recognizer.recognizeBatch(queries)

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results).toHaveLength(3)
      expect(results[0]?.educationalType).toBe(EducationalType.DEFINITION)
      expect(results[1]?.educationalType).toBe(EducationalType.EXPLANATION)
      expect(results[2]?.educationalType).toBe(EducationalType.SYMPTOMS)
    })
  })

  describe('generateLearningPathway', () => {
    it('should generate appropriate learning pathway', () => {
      const result: EducationalContextResult = {
        isEducational: true,
        confidence: 0.8,
        educationalType: EducationalType.DEFINITION,
        complexity: 'basic',
        topicArea: TopicArea.DEPRESSION,
        learningObjectives: ['Understand depression'],
        recommendedResources: [ResourceType.EDUCATIONAL_VIDEOS],
        priorKnowledgeRequired: [],
        metadata: {
          conceptualDepth: 0.3,
          practicalApplications: [],
          relatedTopics: ['anxiety', 'mood disorders'],
        },
      }

      const pathway = recognizer.generateLearningPathway(result)

      expect(pathway.currentTopic).toContain('definition')
      expect(pathway.currentTopic).toContain('depression')
      expect(pathway.nextSteps).toContain('Learn about symptoms')
      expect(pathway.estimatedTimeToComplete).toBe('15-30 minutes')
      expect(pathway.relatedConcepts).toEqual(['anxiety', 'mood disorders'])
    })
  })
})

describe('createEducationalContextRecognizer', () => {
  it('should create a recognizer instance', () => {
    const config: EducationalRecognizerConfig = {
      aiService: mockAIService,
      model: 'gpt-4',
    }

    const recognizer = createEducationalContextRecognizer(config)
    expect(recognizer).toBeInstanceOf(EducationalContextRecognizer)
  })
})

describe('getDefaultEducationalRecognizerConfig', () => {
  it('should return default configuration', () => {
    const config = getDefaultEducationalRecognizerConfig(mockAIService)

    expect(config.aiService).toBe(mockAIService)
    expect(config.model).toBe('gpt-4')
    expect(config.includeResourceRecommendations).toBe(true)
    expect(config.adaptToUserLevel).toBe(true)
    expect(config.enableTopicMapping).toBe(true)
  })
})
