// Core AI Types
export * from './types/CognitiveModel'
export * from './types/TherapeuticGoals'
export * from './models/types'

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

// Mental Health AI
export type { AIMessage } from './types'
export type { CrisisDetectionResult } from './crisis/types'

// Re-export common AI utilities
import { createBuildSafeLogger } from '../logging/build-safe-logger'
export const aiLogger = createBuildSafeLogger('ai')

// Default configurations
export const AI_CONFIG = {
  defaultModel: 'gpt-4',
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

class MockAIService implements AIService {
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

// Default AI service instance
let aiServiceInstance: AIService | null = null

/**
 * Get the default AI service instance
 */
export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new MockAIService()
  }
  return aiServiceInstance
}

/**
 * Initialize AI services
 */
export async function initializeAI(): Promise<void> {
  const service = getAIService()
  await service.initialize()
}
