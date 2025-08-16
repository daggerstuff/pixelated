import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  CrisisDetectionOptions,
  CrisisDetectionResult,
} from '../../lib/ai/crisis/types'
import type { AICompletion } from '../../lib/ai/models/ai-types'

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
  let CrisisDetectionService: any
  let crisisService: any
  
  const mockAIService = {
    createChatCompletion: vi.fn(),
    createStreamingChatCompletion: vi.fn(),
  }

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    // Dynamically import the service after mocks are set up
    const serviceModule = await import('../../lib/ai/services/crisis-detection')
    CrisisDetectionService = serviceModule.CrisisDetectionService
    
    crisisService = new CrisisDetectionService({
      aiService: mockAIService,
      sensitivityLevel: 'high' as const,
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

      mockAIService.createChatCompletion.mockResolvedValue({
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
        choices: []
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

      mockAIService.createChatCompletion.mockResolvedValue({
        content: JSON.stringify({ 
          score: 0.6, 
          category: 'severe_depression',
          severity: 'high',
          indicators: ['hopeless', 'worthless'],
          recommendations: ['Professional counseling recommended']
        }),
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        model: 'test-model',
        id: 'test-id',
        created: Date.now(),
        choices: []
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
      expect(mockAIService.createChatCompletion).not.toHaveBeenCalled()
    })

    it('should handle invalid JSON responses', async () => {
      const text = 'I want to hurt myself'
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'high',
        userId: 'user123',
        source: 'test',
      }

      mockAIService.createChatCompletion.mockResolvedValue({
        content: 'invalid json response',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        model: 'test-model',
        id: 'test-id',
        created: Date.now(),
        choices: []
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

      mockAIService.createChatCompletion.mockRejectedValue(new Error('AI service error'))

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
        'I feel hopeless'
      ]
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'medium',
        userId: 'user123',
        source: 'test',
      }

      mockAIService.createChatCompletion.mockResolvedValue({
        content: JSON.stringify({
          score: 0.8,
          category: 'suicide_risk',
          severity: 'critical',
          indicators: ['kill myself'],
          recommendations: ['Immediate intervention']
        }),
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        model: 'test-model',
        id: 'test-id',
        created: Date.now(),
        choices: []
      } as AICompletion)

      const results = await crisisService.detectBatch(texts, options)

      expect(results).toHaveLength(3)
      expect(results[0].isCrisis).toBe(true) // 'kill myself' should be crisis
      expect(results[1].isCrisis).toBe(false) // 'good day' should not be crisis
    })

    it('should handle errors in batch processing', async () => {
      const texts = ['test text']
      const options: CrisisDetectionOptions = {
        sensitivityLevel: 'medium',
        userId: 'user123',
        source: 'test',
      }

      // Mock the detectCrisis method to throw an error
      const originalDetectCrisis = crisisService.detectCrisis
      crisisService.detectCrisis = vi.fn().mockRejectedValue(new Error('Detection failed'))

      await expect(crisisService.detectBatch(texts, options)).rejects.toThrow('Batch crisis detection failed')

      // Restore original method
      crisisService.detectCrisis = originalDetectCrisis
    })
  })

  describe('constructor', () => {
    it('should create service with valid configuration', () => {
      const service = new CrisisDetectionService({
        aiService: mockAIService,
        sensitivityLevel: 'medium' as const,
      })
      
      expect(service).toBeDefined()
    })

    it('should accept custom configuration', () => {
      const customPrompt = 'Custom crisis detection prompt'
      const service = new CrisisDetectionService({
        aiService: mockAIService,
        sensitivityLevel: 'medium' as const,
        defaultPrompt: customPrompt,
      })
      
      expect(service).toBeDefined()
    })
  })
})
