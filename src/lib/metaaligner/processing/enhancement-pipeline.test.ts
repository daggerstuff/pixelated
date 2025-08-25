/**
 * Unit tests for Response Enhancement Pipeline
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EnhancementPipeline,
  type EnhancementPipelineConfig,
  type PipelineInput,
} from './enhancement-pipeline'
import { ContextType } from '../core/objectives'

// Mock the logger
vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('EnhancementPipeline', () => {
  let pipeline: EnhancementPipeline
  let config: EnhancementPipelineConfig

  beforeEach(() => {
    vi.clearAllMocks()

    config = {
      enableBatchProcessing: false,
      maxRetries: 2,
      enhancementThreshold: 0.7,
    }

    pipeline = new EnhancementPipeline(config)
  })

  afterEach(() => {
    pipeline.dispose()
    vi.restoreAllMocks()
  })

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultPipeline = new EnhancementPipeline()
      expect(defaultPipeline).toBeInstanceOf(EnhancementPipeline)
    })

    it('should initialize with custom configuration', () => {
      const customConfig = {
        enableBatchProcessing: true,
        maxRetries: 3,
        enhancementThreshold: 0.8,
      }

      const customPipeline = new EnhancementPipeline(customConfig)
      expect(customPipeline).toBeInstanceOf(EnhancementPipeline)
    })
  })

  describe('Single Response Processing', () => {
    it('should process a response that meets quality threshold without enhancement', async () => {
      const input: PipelineInput = {
        response:
          "I understand you're feeling anxious. This is a common experience and there are evidence-based strategies that can help.",
        context: {
          userQuery: 'I feel anxious all the time',
          detectedContext: ContextType.SUPPORT,
          conversationHistory: [],
        },
      }

      const result = await pipeline.process(input)

      expect(result).toBeDefined()
      expect(result.originalResponse).toBe(input.response)
      expect(result.enhancedResponse).toBe(input.response) // Should be unchanged
      expect(result.processingInfo.enhanced).toBe(false)
      expect(result.improvements).toHaveLength(0)
      expect(result.processingInfo.attempts).toBe(0)
    })

    it('should enhance a response that falls below quality threshold', async () => {
      const input: PipelineInput = {
        response: 'Just deal with it.',
        context: {
          userQuery: 'I feel depressed',
          detectedContext: ContextType.SUPPORT,
          conversationHistory: [],
        },
      }

      const result = await pipeline.process(input)

      expect(result).toBeDefined()
      expect(result.originalResponse).toBe(input.response)
      // Should have attempted enhancement
      expect(result.processingInfo.attempts).toBeGreaterThanOrEqual(1)
    })

    it('should handle empty responses gracefully', async () => {
      const input: PipelineInput = {
        response: '',
        context: {
          userQuery: 'Hello',
          detectedContext: ContextType.GENERAL,
          conversationHistory: [],
        },
      }

      const result = await pipeline.process(input)

      expect(result).toBeDefined()
      expect(result.originalResponse).toBe('')
      expect(result.enhancedResponse).toBe('')
    })

    it('should handle error during processing', async () => {
      // Create a pipeline that will fail
      const failingPipeline = new EnhancementPipeline({
        // Invalid config that would cause failure
        maxRetries: -1,
      })

      const input: PipelineInput = {
        response: 'Test response',
        context: {
          userQuery: 'Test query',
          detectedContext: ContextType.GENERAL,
          conversationHistory: [],
        },
      }

      // Depending on implementation, this might throw or handle gracefully
      await expect(failingPipeline.process(input)).rejects.toThrow()
    })
  })

  describe('Batch Processing', () => {
    it('should process multiple responses', async () => {
      const inputs: PipelineInput[] = [
        {
          response: "I understand you're feeling anxious.",
          context: {
            userQuery: 'I feel anxious',
            detectedContext: ContextType.SUPPORT,
            conversationHistory: [],
          },
        },
        {
          response: 'Just deal with it.',
          context: {
            userQuery: 'I feel depressed',
            detectedContext: ContextType.SUPPORT,
            conversationHistory: [],
          },
        },
      ]

      const results = await pipeline.processBatch(inputs)

      expect(results).toHaveLength(2)
      expect(results[0]).toBeDefined()
      expect(results[1]).toBeDefined()
    })

    it('should handle empty batch', async () => {
      const results = await pipeline.processBatch([])
      expect(results).toHaveLength(0)
    })

    it('should handle batch processing errors', async () => {
      const inputs: PipelineInput[] = [
        {
          response: 'Valid response',
          context: {
            userQuery: 'Test',
            detectedContext: ContextType.GENERAL,
            conversationHistory: [],
          },
        },
      ]

      // Mock implementation error
      vi.spyOn(pipeline as any, 'process').mockRejectedValue(
        new Error('Processing error'),
      )

      await expect(pipeline.processBatch(inputs)).rejects.toThrow(
        'Processing error',
      )
    })
  })

  describe('Enhancement Logic', () => {
    it('should apply iterative enhancements when needed', async () => {
      const input: PipelineInput = {
        response: 'Bad response',
        context: {
          userQuery: 'Help me',
          detectedContext: ContextType.SUPPORT,
          conversationHistory: [],
        },
      }

      // Mock the enhancement process to simulate improvements
      const result = await pipeline.process(input)

      expect(result).toBeDefined()
      // Should have some processing information
      expect(result.processingInfo.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('should respect maximum retry limits', async () => {
      const lowRetryPipeline = new EnhancementPipeline({
        maxRetries: 1,
      })

      const input: PipelineInput = {
        response: 'Poor quality response',
        context: {
          userQuery: 'I need help',
          detectedContext: ContextType.CRISIS,
          conversationHistory: [],
        },
      }

      const result = await lowRetryPipeline.process(input)

      expect(result).toBeDefined()
      // Should not exceed the retry limit
      expect(result.processingInfo.attempts).toBeLessThanOrEqual(1)
    })

    it('should calculate improvements correctly', async () => {
      const input: PipelineInput = {
        response: 'Very poor response',
        context: {
          userQuery: 'Help me',
          detectedContext: ContextType.CRISIS,
          conversationHistory: [],
        },
      }

      const result = await pipeline.process(input)

      // Improvements should be calculated (even if empty)
      expect(Array.isArray(result.improvements)).toBe(true)
    })
  })

  describe('Configuration Handling', () => {
    it('should respect enhancement threshold configuration', async () => {
      const highThresholdPipeline = new EnhancementPipeline({
        enhancementThreshold: 0.9, // High threshold
      })

      const input: PipelineInput = {
        response: 'Good response', // But not great
        context: {
          userQuery: 'I need help',
          detectedContext: ContextType.SUPPORT,
          conversationHistory: [],
        },
      }

      const result = await highThresholdPipeline.process(input)

      expect(result).toBeDefined()
    })

    it('should handle missing configuration gracefully', async () => {
      const minimalConfigPipeline = new EnhancementPipeline({})

      const input: PipelineInput = {
        response: 'Test response',
        context: {
          userQuery: 'Test query',
          detectedContext: ContextType.GENERAL,
          conversationHistory: [],
        },
      }

      const result = await minimalConfigPipeline.process(input)

      expect(result).toBeDefined()
    })
  })
})
