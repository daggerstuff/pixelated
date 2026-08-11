// Core AI Types
export * from './types/CognitiveModel'
export * from './types/TherapeuticGoals'
export * from './models/ai-types'

// Emotion Processing
export * from './emotions/EmotionSynthesizer'
export * from './emotions/EmotionContext'

// Performance & Computing
export * from './performance/EdgeComputing'

// Bias Detection
export * from './bias-detection/performance-monitor'

// Dataset Processing
export * from './datasets/prepare-fine-tuning'
export * from './datasets/merge-datasets'

// Web Scraping
export * from './services/jigsawstack-web-scraper'

// Mental Health AI
export type { AIMessage } from './types'
export type { CrisisDetectionResult } from './crisis/types'

// Re-export common AI utilities
import { createBuildSafeLogger } from '../logging/build-safe-logger'
export const aiLogger = createBuildSafeLogger('ai')

// Default configurations
export const AI_CONFIG = {
  defaultModel: 'minimaxai/minimax-m2.7',
  maxTokens: 2048,
  temperature: 0.7,
  timeout: 30000,
} as const

// AI Service Status
export interface AIServiceStatus {
  isAvailable: boolean
  activeModels: string[]
  performanceMetrics: {
    averageResponseTime: number
    successRate: number
    errorRate: number
  }
  lastHealthCheck: Date
}

// Main AI Service interface
export interface AIService {
  initialize(): Promise<void>
  getStatus(): Promise<AIServiceStatus>
  processText(text: string, options?: Record<string, unknown>): Promise<unknown>
  dispose(): Promise<void>
}

// Mock AI Service implementation
import crypto from 'crypto'

// Production AIService backed by the FineTuningOrchestrator (PIX-3937).
// MockAIService is retained and exported for tests / explicit dev overrides;
// the production default below resolves to `FineTuningAIService`.
import { FineTuningAIService } from './training/aiservice'

/**
 * Generates a cryptographically secure random float between 0 (inclusive) and 1 (exclusive).
 * Uses Node.js crypto.randomBytes for secure randomness.
 */
function secureRandomFloat(): number {
  const buf = crypto.randomBytes(4)
  const uint = buf.readUInt32BE(0)
  // Divide by 2^32 to ensure the result is in [0, 1)
  return uint / 2 ** 32
}

/**
 * In-process mock `AIService`. Useful for unit tests, local development
 * without backend credentials, and documenting the legacy mock shape. Callers
 * can opt-in via `createMockAIService()` or `setAIServiceForTesting(...)`.
 * The production default returned by `getAIService()` is the
 * `FineTuningAIService` — never this mock.
 */
export class MockAIService implements AIService {
  private initialized = false

  async initialize(): Promise<void> {
    this.initialized = true
  }

  async getStatus(): Promise<AIServiceStatus> {
    return {
      isAvailable: this.initialized,
      activeModels: ['mock-model-v1'],
      performanceMetrics: {
        averageResponseTime: 150,
        successRate: 0.95,
        errorRate: 0.05,
      },
      lastHealthCheck: new Date(),
    }
  }

  async processText(
    text: string,
    options?: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.initialized) {
      throw new Error('AI Service not initialized')
    }

    // Mock processing
    await new Promise((resolve) =>
      setTimeout(resolve, 100 + secureRandomFloat() * 200),
    )

    return {
      processed: true,
      input: text,
      options,
      result: `Processed: ${text.substring(0, 50)}...`,
      confidence: 0.85 + secureRandomFloat() * 0.15,
    }
  }

  async dispose(): Promise<void> {
    this.initialized = false
  }
}

/** Build a fresh `MockAIService` instance (test helper). */
export function createMockAIService(): AIService {
  return new MockAIService()
}

/**
 * Resolve the production singleton. Defaults to the orchestrator-backed
 * `FineTuningAIService` (PIX-3937). Tests can force the mock via
 * `setAIServiceForTesting(new MockAIService())` or by setting the
 * `PIX_AI_USE_MOCK=1` environment variable.
 */
let aiServiceInstance: AIService | null = null

function shouldUseMockByDefault(): boolean {
  if (process.env['PRODUCTION_AI_SERVICE'] === 'true') {
    return false;
  }
  if (process.env['PIX_AI_USE_MOCK'] === '1') {
    return true;
  }
  return process.env['NODE_ENV'] === 'test' || process.env['VITEST'] === 'true'
}

/**
 * Get the default AI service instance. Production callers always receive the
 * `FineTuningAIService` (built once and cached) so the underlying job store
 * and cost tracker are shared across the app.
 */
export function getAIService(): AIService {
  if (aiServiceInstance) return aiServiceInstance
  aiServiceInstance = shouldUseMockByDefault()
    ? new MockAIService()
    : new FineTuningAIService()
  return aiServiceInstance
}

/**
 * Replace the cached AI service. Intended for tests; production code should
 * never need to invoke this. Pass-through to reset by calling twice (once
 * with null is not supported: pass the desired replacement).
 */
export function setAIServiceForTesting(service: AIService): void {
  aiServiceInstance = service
}

/** Reset the cached service. Test-only helper. */
export function resetAIServiceForTesting(): void {
  aiServiceInstance = null
}

import { initArizeTracing } from './tracing/arize-setup'

/**
 * Initialize AI services
 */
export async function initializeAI(): Promise<void> {
  // Initialize Tracing
  initArizeTracing()

  const service = getAIService()
  await service.initialize()
}

