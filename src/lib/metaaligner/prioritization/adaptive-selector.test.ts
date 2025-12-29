import { describe, expect, vi, test, beforeEach } from 'vitest'
/**
 * Unit tests for Adaptive Objective Selector
 */

import {
  AdaptiveSelector,
  type AdaptiveSelectorConfig,
} from './adaptive-selector'
import {
  ContextType,
  CORE_MENTAL_HEALTH_OBJECTIVES,
  UserProfile,
} from '../core/objectives' // Import UserProfile
import type { AIService } from '../../ai/models/types'
import type { CrisisDetectionService } from '../../ai/services/crisis-detection'
// Import WeightingStrategy

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
const mockCrisisDetectionService = {
  detectCrisis: mockDetectCrisis,
  detectBatch: vi.fn(),
} as unknown as CrisisDetectionService

// Mock ContextDetector and ObjectiveWeightingEngine entirely for focused testing if needed,
// or allow them to run with their own mocks (like mockAIService for ContextDetector).
// For now, we'll let them use their actual implementations with mocked dependencies.

describe('AdaptiveSelector', () => {
  let adaptiveSelector: AdaptiveSelector
  let config: AdaptiveSelectorConfig

  beforeEach(() => {
    vi.clearAllMocks()

    config = {
      aiService: mockAIService,
      contextDetectorConfig: {
        crisisDetectionService: mockCrisisDetectionService,
        enableCrisisIntegration: true,
      },
    }
    adaptiveSelector = new AdaptiveSelector(config)
  })

  test('should select objectives based on GENERAL context by default', async () => {
    mockDetectCrisis.mockResolvedValue({
      isCrisis: false,
      confidence: 0.1,
      category: 'general',
      riskLevel: 'low',
      urgency: 'low',
      detectedTerms: [],
      suggestedActions: [],
      timestamp: '',
      content: '',
    })
    const aiResponseGeneral = {
      id: 'gen-completion',
      created: Date.now(),
      model: 'test-model',
      provider: 'test',
      choices: [
        {
          message: {
            role: 'assistant' as const,
            content: JSON.stringify({
              detectedContext: ContextType.GENERAL,
              confidence: 0.9,
              contextualIndicators: [],
              needsSpecialHandling: false,
              urgency: 'low',
              metadata: {},
            }),
          },
          finishReason: 'stop' as const,
        },
      ],
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      content: JSON.stringify({
        detectedContext: ContextType.GENERAL,
        confidence: 0.9,
        contextualIndicators: [],
        needsSpecialHandling: false,
        urgency: 'low',
        metadata: {},
      }),
    }
    vi.mocked(mockAIService.createChatCompletion).mockResolvedValue(
      aiResponseGeneral,
    )

    const result = await adaptiveSelector.selectObjectives(
      'Hello, how are you?',
    )

    expect(result.contextDetectionResult.detectedContext).toBe(
      ContextType.GENERAL,
    )
    expect(result.selectedObjectives.length).toBe(
      CORE_MENTAL_HEALTH_OBJECTIVES.length,
    ) // All objectives included

    // Check if weights roughly match default distribution for GENERAL context
    // In this setup, GENERAL uses default objective weights

    result.selectedObjectives.forEach((so) => {
      const coreObjective = CORE_MENTAL_HEALTH_OBJECTIVES.find(
        (co) => co.id === so.objective.id,
      )
      expect(coreObjective).toBeDefined()
      // For GENERAL, weights should be proportional to their base definition if not overridden
      // The actual check depends on how getContextualObjectiveWeights for GENERAL is implemented
      // For now, we check if the weight is present and positive.
      expect(so.weight).toBeGreaterThanOrEqual(0)
    })
    const sumOfWeights = result.selectedObjectives.reduce(
      (sum, so) => sum + so.weight,
      0,
    )
    expect(sumOfWeights).toBeCloseTo(1.0, 5)
  })

  test('should prioritize SAFETY objective in CRISIS context', async () => {
    mockDetectCrisis.mockResolvedValue({
      isCrisis: true,
      confidence: 0.95,
      category: 'self-harm',
      riskLevel: 'high',
      urgency: 'immediate',
      detectedTerms: ['hurt myself'],
      suggestedActions: ['call_emergency'],
      timestamp: '',
      content: 'I want to hurt myself',
    })
    // AI completion won't be called if crisis is detected first by CrisisDetectionService

    const result = await adaptiveSelector.selectObjectives(
      'I want to hurt myself',
    )

    expect(result.contextDetectionResult.detectedContext).toBe(
      ContextType.CRISIS,
    )
    const safetyObjective = result.selectedObjectives.find(
      (so) => so.objective.id === 'safety',
    )
    expect(safetyObjective).toBeDefined()
    // Based on CONTEXT_OBJECTIVE_PROFILES, safety in crisis is 0.6 (then normalized)
    // We expect it to be the highest or significantly higher
    let highestWeight = 0
    result.selectedObjectives.forEach((so) => {
      if (so.weight > highestWeight) {
        highestWeight = so.weight
      }
    })
    expect(safetyObjective!.weight).toBe(highestWeight)
    expect(safetyObjective!.weight).toBeGreaterThan(
      0.5 / result.selectedObjectives.length,
    ) // Check it's substantially weighted after normalization

    const sumOfWeights = result.selectedObjectives.reduce(
      (sum, so) => sum + so.weight,
      0,
    )
    expect(sumOfWeights).toBeCloseTo(1.0, 5)
  })

  test('should prioritize INFORMATIVENESS and CORRECTNESS in EDUCATIONAL context', async () => {
    mockDetectCrisis.mockResolvedValue({
      isCrisis: false,
      confidence: 0.1,
      category: 'general',
      riskLevel: 'low',
      urgency: 'low',
      detectedTerms: [],
      suggestedActions: [],
      timestamp: '',
      content: '',
    })
    const aiResponseEducational = {
      id: 'edu-completion',
      created: Date.now(),
      model: 'test-model',
      provider: 'test',
      choices: [
        {
          message: {
            role: 'assistant' as const,
            content: JSON.stringify({
              detectedContext: ContextType.EDUCATIONAL,
              confidence: 0.9,
              contextualIndicators: [],
              needsSpecialHandling: false,
              urgency: 'low',
              metadata: {},
            }),
          },
          finishReason: 'stop' as const,
        },
      ],
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      content: JSON.stringify({
        detectedContext: ContextType.EDUCATIONAL,
        confidence: 0.9,
        contextualIndicators: [],
        needsSpecialHandling: false,
        urgency: 'low',
        metadata: {},
      }),
    }
    vi.mocked(mockAIService.createChatCompletion).mockResolvedValue(
      aiResponseEducational,
    )

    const result = await adaptiveSelector.selectObjectives(
      'What is cognitive behavioral therapy?',
    )

    expect(result.contextDetectionResult.detectedContext).toBe(
      ContextType.EDUCATIONAL,
    )
    const informativenessObjective = result.selectedObjectives.find(
      (so) => so.objective.id === 'informativeness',
    )
    const correctnessObjective = result.selectedObjectives.find(
      (so) => so.objective.id === 'correctness',
    )

    expect(informativenessObjective).toBeDefined()
    expect(correctnessObjective).toBeDefined()

    // Check these are among the highest weighted
    const otherObjectivesMaxWeight = result.selectedObjectives
      .filter(
        (so) =>
          so.objective.id !== 'informativeness' &&
          so.objective.id !== 'correctness',
      )
      .reduce((max, so) => Math.max(max, so.weight), 0)

    expect(informativenessObjective!.weight).toBeGreaterThan(
      otherObjectivesMaxWeight,
    )
    expect(correctnessObjective!.weight).toBeGreaterThan(
      otherObjectivesMaxWeight,
    )

    const sumOfWeights = result.selectedObjectives.reduce(
      (sum, so) => sum + so.weight,
      0,
    )
    expect(sumOfWeights).toBeCloseTo(1.0, 5)
  })

  test('should log context transitions via ContextDetector', async () => {
    const loggerSpy = vi.spyOn(global.console, 'info') // Or your actual logger instance

    // First call: GENERAL
    mockDetectCrisis.mockResolvedValue({
      isCrisis: false,
      confidence: 0.1,
      category: 'general',
      riskLevel: 'low',
      urgency: 'low',
      detectedTerms: [],
      suggestedActions: [],
      timestamp: '',
      content: '',
    })
    const aiResponseGeneral = {
      id: 'gen-completion',
      created: Date.now(),
      model: 'test-model',
      provider: 'test',
      choices: [
        {
          message: {
            role: 'assistant' as const,
            content: JSON.stringify({
              detectedContext: ContextType.GENERAL,
              confidence: 0.9,
              contextualIndicators: [],
              needsSpecialHandling: false,
              urgency: 'low',
              metadata: {},
            }),
          },
          finishReason: 'stop' as const,
        },
      ],
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      content: JSON.stringify({
        detectedContext: ContextType.GENERAL,
        confidence: 0.9,
        contextualIndicators: [],
        needsSpecialHandling: false,
        urgency: 'low',
        metadata: {},
      }),
    }
    vi.mocked(mockAIService.createChatCompletion).mockResolvedValue(
      aiResponseGeneral,
    )
    await adaptiveSelector.selectObjectives('Hello')

    // Second call: EDUCATIONAL (should trigger transition log)
    const aiResponseEducational = {
      id: 'edu-completion',
      created: Date.now(),
      model: 'test-model',
      provider: 'test',
      choices: [
        {
          message: {
            role: 'assistant' as const,
            content: JSON.stringify({
              detectedContext: ContextType.EDUCATIONAL,
              confidence: 0.9,
              contextualIndicators: [],
              needsSpecialHandling: false,
              urgency: 'low',
              metadata: {},
            }),
          },
          finishReason: 'stop' as const,
        },
      ],
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      content: JSON.stringify({
        detectedContext: ContextType.EDUCATIONAL,
        confidence: 0.9,
        contextualIndicators: [],
        needsSpecialHandling: false,
        urgency: 'low',
        metadata: {},
      }),
    }
    vi.mocked(mockAIService.createChatCompletion).mockResolvedValue(
      aiResponseEducational,
    )
    const result = await adaptiveSelector.selectObjectives(
      'Tell me about mindfulness',
    )

    expect(result.contextDetectionResult.metadata.transition).toBeDefined()
    expect(result.contextDetectionResult.metadata.transition?.from).toBe(
      ContextType.GENERAL,
    )
    expect(result.contextDetectionResult.metadata.transition?.to).toBe(
      ContextType.EDUCATIONAL,
    )

    loggerSpy.mockRestore()
  })

  test('should fallback to default weights if context detection fails', async () => {
    vi.mocked(mockAIService.createChatCompletion).mockRejectedValue(
      new Error('AI service failed'),
    )
    mockDetectCrisis.mockResolvedValue({
      isCrisis: false,
      confidence: 0.1,
      category: 'general',
      riskLevel: 'low',
      urgency: 'low',
      detectedTerms: [],
      suggestedActions: [],
      timestamp: '',
      content: '',
    })

    const result = await adaptiveSelector.selectObjectives(
      'A problematic input',
    )

    expect(result.contextDetectionResult.detectedContext).toBe(
      ContextType.GENERAL,
    )
    expect(result.contextDetectionResult.metadata.error).toBeDefined()
    expect(result.selectedObjectives.length).toBe(
      CORE_MENTAL_HEALTH_OBJECTIVES.length,
    )

    // Verify weights are default weights
    let totalDefaultWeight = 0
    const defaultWeights: Record<string, number> =
      CORE_MENTAL_HEALTH_OBJECTIVES.reduce(
        (acc, obj) => {
          acc[obj.id] = obj.weight
          totalDefaultWeight += obj.weight
          return acc
        },
        {} as Record<string, number>,
      )

    // Normalize if they don't sum to 1 (they should)
    if (Math.abs(totalDefaultWeight - 1.0) > 0.001 && totalDefaultWeight > 0) {
      for (const id in defaultWeights) {
        defaultWeights[id] /= totalDefaultWeight
      }
    }

    result.selectedObjectives.forEach((so) => {
      expect(so.weight).toBeCloseTo(defaultWeights[so.objective.id]!, 5)
    })
  })

  test('should handle user profile with preferences', async () => {
    mockDetectCrisis.mockResolvedValue({
      isCrisis: false,
      confidence: 0.1,
      category: 'general',
      riskLevel: 'low',
      urgency: 'low',
      detectedTerms: [],
      suggestedActions: [],
      timestamp: '',
      content: '',
    })
    const aiResponse = {
      id: 'completion',
      created: Date.now(),
      model: 'test-model',
      provider: 'test',
      choices: [
        {
          message: {
            role: 'assistant' as const,
            content: JSON.stringify({
              detectedContext: ContextType.GENERAL,
              confidence: 0.9,
              contextualIndicators: [],
              needsSpecialHandling: false,
              urgency: 'low',
              metadata: {},
            }),
          },
          finishReason: 'stop' as const,
        },
      ],
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      content: JSON.stringify({
        detectedContext: ContextType.GENERAL,
        confidence: 0.9,
        contextualIndicators: [],
        needsSpecialHandling: false,
        urgency: 'low',
        metadata: {},
      }),
    }
    vi.mocked(mockAIService.createChatCompletion).mockResolvedValue(aiResponse)

    const userProfile: UserProfile = {
      preferences: {
        objectiveWeightAdjustments: { empathy: 1.5 },
        preferredObjectives: [
          { objectiveId: 'correctness', preferenceStrength: 0.8 },
        ],
      },
    }

    const result = await adaptiveSelector.selectObjectives(
      'Test message',
      [],
      'test-session',
      userProfile,
    )

    expect(result.selectedObjectives.length).toBeGreaterThan(0)
    const sumOfWeights = result.selectedObjectives.reduce(
      (sum, so) => sum + so.weight,
      0,
    )
    expect(sumOfWeights).toBeCloseTo(1.0, 5)
  })
})
