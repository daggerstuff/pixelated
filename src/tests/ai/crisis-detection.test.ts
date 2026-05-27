import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest'

import type {
  CrisisDetectionOptions,
  CrisisDetectionResult,
} from '../../lib/ai/crisis/types'
import type { AICompletion, AIModelInfo, AIService } from '../../lib/ai/models/ai-types'
import type { AnomalyDetector } from '../../lib/ai/services/crisis-detection'
import {
  CrisisDetectionService,
  MentalHealthAnomalyDetector,
  createAnomalyDetector,
  resolveAnomalyDetectorKind,
} from '../../lib/ai/services/crisis-detection'

// Mock the logger first
vi.mock('../../lib/logging/build-safe-logger', () => ({
  createBuildSafeLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

describe('crisisDetectionService', () => {
  const mockAIService: AIService = {
    createChatCompletion: async () => {
      throw new Error('Chat completion mock not initialized')
    },
    createStreamingChatCompletion: async () => {
      const asyncGenerator: AsyncGenerator<never, void, void> = (async function* () {})()
      return asyncGenerator
    },
    getModelInfo(model: string): AIModelInfo {
      return {
        id: model,
        name: model,
        provider: 'test',
        capabilities: [],
        contextWindow: 2048,
        maxTokens: 2048,
      }
    },
    dispose: vi.fn(),
  }

  let crisisService: MentalHealthAnomalyDetector
  let createChatCompletionSpy: MockInstance<AIService['createChatCompletion']>

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    createChatCompletionSpy = vi.spyOn(mockAIService, 'createChatCompletion')
    crisisService = new MentalHealthAnomalyDetector({
      aiService: mockAIService,
      sensitivityLevel: 'high' as const,
    })
  })

  describe('anomaly detector abstraction', () => {
    it('uses the mental health detector through the domain-agnostic detect API', async () => {
      const detector: AnomalyDetector = new MentalHealthAnomalyDetector({
        aiService: mockAIService,
        sensitivityLevel: 'high' as const,
      })

      createChatCompletionSpy.mockRejectedValue(new Error('AI service error'))

      const result = await detector.detect('I want to end my life', {
        sensitivityLevel: 'high',
        userId: 'user123',
        source: 'test',
      })

      expect(result.isCrisis).toBe(true)
      expect(result.category).toBe('suicide_risk')
    })

    it('keeps CrisisDetectionService as a backwards-compatible alias', () => {
      expect(CrisisDetectionService).toBe(MentalHealthAnomalyDetector)
    })

    it('selects the configured anomaly detector strategy', () => {
      expect(resolveAnomalyDetectorKind()).toBe('mental_health')
      expect(resolveAnomalyDetectorKind('mental_health')).toBe('mental_health')

      const detector = createAnomalyDetector({
        detector: 'mental_health',
        aiService: mockAIService,
        sensitivityLevel: 'medium' as const,
      })

      expect(detector).toBeInstanceOf(MentalHealthAnomalyDetector)
    })

    it('reads detector strategy from deployment configuration', () => {
      const previousDetector = process.env['ANOMALY_DETECTOR']
      process.env['ANOMALY_DETECTOR'] = 'mental-health'

      try {
        expect(resolveAnomalyDetectorKind()).toBe('mental_health')
      } finally {
        if (previousDetector === undefined) {
          delete process.env['ANOMALY_DETECTOR']
        } else {
          process.env['ANOMALY_DETECTOR'] = previousDetector
        }
      }
    })

    it('rejects unsupported detector strategies', () => {
      expect(() => resolveAnomalyDetectorKind('payments')).toThrow(
        'Unsupported anomaly detector strategy',
      )
    })

    it('honors per-call sensitivity overrides through detect', async () => {
      const detector = new MentalHealthAnomalyDetector({
        aiService: mockAIService,
        sensitivityLevel: 'low' as const,
      })
      createChatCompletionSpy.mockRejectedValue(new Error('AI service error'))

      const result = await detector.detect('I feel hopeless', {
        sensitivityLevel: 'high',
        userId: 'user123',
        source: 'test',
      })

      expect(result.isCrisis).toBe(true)
      expect(result.confidence).toBe(0.48)
    })
  })

  describe('detectCrisis', () => {
    it('should detect high-risk crisis correctly', async () => {
      const text = 'I want to kill myself right now'
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'high',
        userId: 'user123',
        source: 'test',
      }

      createChatCompletionSpy.mockResolvedValue({
        content: JSON.stringify({
          score: 0.9,
          category: 'suicide_risk',
          severity: 'critical',
          indicators: ['kill myself', 'right now'],
          recommendations: ['Contact emergency services'],
        }),
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        model: 'test-model',
        id: 'test-id',
        created: Date.now(),
        choices: [],
        provider: 'test',
      } as AICompletion)

      const result: CrisisDetectionResult = await crisisService.detectCrisis(
        text,
        options,
      )

      expect(result.isCrisis).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.8)
      expect(result.category).toBe('suicide_risk')
      expect(result.riskLevel).toBe('critical')
    })

    it('should detect medium-risk crisis correctly', async () => {
      const text = 'I feel so hopeless and worthless'
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'medium',
        userId: 'user123',
        source: 'test',
      }

      createChatCompletionSpy.mockResolvedValue({
        content: JSON.stringify({
          score: 0.6,
          category: 'severe_depression',
          severity: 'high',
          indicators: ['hopeless', 'worthless'],
          recommendations: ['Professional counseling recommended'],
        }),
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        model: 'test-model',
        id: 'test-id',
        created: Date.now(),
        choices: [],
        provider: 'test',
      } as AICompletion)

      const result = await crisisService.detectCrisis(text, options)

      expect(result.isCrisis).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.category).toBe('severe_depression')
      expect(result.riskLevel).toBe('high')
    })

    it('should correctly identify non-crisis text', async () => {
      const text = 'I had a great day at work today'
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'medium',
        userId: 'user123',
        source: 'test',
      }

      // No AI call should be made for non-crisis text (keyword score < 0.3)
      const result = await crisisService.detectCrisis(text, options)

      expect(result.isCrisis).toBe(false)
      expect(result.confidence).toBeLessThan(0.3)
      expect(result.riskLevel).toBe('low')
      expect(createChatCompletionSpy).not.toHaveBeenCalled()
    })

    it('should handle invalid JSON responses', async () => {
      const text = 'I want to hurt myself'
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'high',
        userId: 'user123',
        source: 'test',
      }

      createChatCompletionSpy.mockResolvedValue({
        content: 'invalid json response',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        model: 'test-model',
        id: 'test-id',
        created: Date.now(),
        choices: [],
        provider: 'test',
      } as AICompletion)

      const result = await crisisService.detectCrisis(text, options)

      // Should still work with keyword analysis fallback
      expect(result.isCrisis).toBe(true) // 'hurt myself' should trigger crisis
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should handle AI service errors gracefully', async () => {
      const text = 'I want to end my life'
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'high',
        userId: 'user123',
        source: 'test',
      }

      createChatCompletionSpy.mockRejectedValue(
        new Error('AI service error'),
      )

      const result = await crisisService.detectCrisis(text, options)

      // Should not throw error, should return result based on keyword analysis
      expect(result).toBeDefined()
      expect(result.isCrisis).toBe(true) // 'end my life' should trigger crisis
      expect(result.confidence).toBeGreaterThan(0)
    })
  })

  describe('detectBatch', () => {
    it('should analyze multiple texts in parallel', async () => {
      const texts = [
        'I want to kill myself',
        'I had a good day',
        'I feel hopeless',
      ]
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'medium',
        userId: 'user123',
        source: 'test',
      }

      createChatCompletionSpy.mockResolvedValue({
        content: JSON.stringify({
          score: 0.8,
          category: 'suicide_risk',
          severity: 'critical',
          indicators: ['kill myself'],
          recommendations: ['Immediate intervention'],
        }),
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        model: 'test-model',
        id: 'test-id',
        created: Date.now(),
        choices: [],
        provider: 'test',
      } as AICompletion)

      const results = await crisisService.detectBatch(texts, options)

      expect(results).toHaveLength(3)
      expect(results[0]?.isCrisis).toBe(true) // 'kill myself' should be crisis
      expect(results[1]?.isCrisis).toBe(false) // 'good day' should not be crisis
    })

    it('should handle errors in batch processing', async () => {
      const texts = ['test text']
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'medium',
        userId: 'user123',
        source: 'test',
      }

      // Mock the detectCrisis method to throw an error
      const detectCrisisSpy = vi
        .spyOn(crisisService, 'detectCrisis')
        .mockRejectedValue(new Error('Detection failed'))

      await expect(crisisService.detectBatch(texts, options)).rejects.toThrow(
        'Batch crisis detection failed',
      )

      // Restore original method
      detectCrisisSpy.mockRestore()
    })
  })

  describe('constructor', () => {
    it('should create service with valid configuration', () => {
      const service = new MentalHealthAnomalyDetector({
        aiService: mockAIService,
        sensitivityLevel: 'medium' as const,
      })

      expect(service).toBeDefined()
    })

    it('should accept custom configuration', () => {
      const customPrompt = 'Custom crisis detection prompt'
      const service = new MentalHealthAnomalyDetector({
        aiService: mockAIService,
        sensitivityLevel: 'medium' as const,
        defaultPrompt: customPrompt,
      })

      expect(service).toBeDefined()
    })
  })
})
