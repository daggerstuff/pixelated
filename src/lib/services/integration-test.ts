/**
 * Service Integration Test Suite
 * Tests cross-service communication and type safety
 */

import { MemoryService } from '../memory'
import { fheService } from '../fhe'
import { EncryptionMode } from '../fhe/types'
import { BiasDetectionEngine } from '../ai/bias-detection/index'
import { MultidimensionalEmotionMapper } from '../ai/emotions/MultidimensionalEmotionMapper'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('service-integration-test')

export interface ServiceIntegrationTestResult {
  success: boolean
  results: {
    memoryService: boolean
    fheService: boolean
    biasDetection: boolean
    emotionAnalysis: boolean
    crossServiceCommunication: boolean
  }
  errors: string[]
  performance: {
    totalTime: number
    serviceTimings: Record<string, number>
  }
}

export class ServiceIntegrationTester {
  private memoryService: MemoryService
  private biasEngine: BiasDetectionEngine
  private emotionMapper: MultidimensionalEmotionMapper

  constructor() {
    this.memoryService = new MemoryService()
    this.biasEngine = new BiasDetectionEngine()
    this.emotionMapper = new MultidimensionalEmotionMapper()
  }

  async runFullIntegrationTest(): Promise<ServiceIntegrationTestResult> {
    const startTime = Date.now()
    const errors: string[] = []
    const serviceTimings: Record<string, number> = {}

    const results = {
      memoryService: false,
      fheService: false,
      biasDetection: false,
      emotionAnalysis: false,
      crossServiceCommunication: false,
    }

    try {
      // Test Memory Service
      const memoryStart = Date.now()
      results.memoryService = await this.testMemoryService()
      serviceTimings.memoryService = Date.now() - memoryStart

      // Test FHE Service
      const fheStart = Date.now()
      results.fheService = await this.testFHEService()
      serviceTimings.fheService = Date.now() - fheStart

      // Test Bias Detection
      const biasStart = Date.now()
      results.biasDetection = await this.testBiasDetection()
      serviceTimings.biasDetection = Date.now() - biasStart

      // Test Emotion Analysis
      const emotionStart = Date.now()
      results.emotionAnalysis = await this.testEmotionAnalysis()
      serviceTimings.emotionAnalysis = Date.now() - emotionStart

      // Test Cross-Service Communication
      const crossStart = Date.now()
      results.crossServiceCommunication =
        await this.testCrossServiceCommunication()
      serviceTimings.crossServiceCommunication = Date.now() - crossStart
    } catch (error: unknown) {
      errors.push(
        `Integration test failed: ${error instanceof Error ? String(error) : String(error)}`,
      )
    }

    const totalTime = Date.now() - startTime
    const success =
      Object.values(results).every((result) => result === true) &&
      errors.length === 0

    logger.info('Service integration test completed', {
      success,
      results,
      totalTime,
      errorCount: errors.length,
    })

    return {
      success,
      results,
      errors,
      performance: {
        totalTime,
        serviceTimings,
      },
    }
  }

  private async testMemoryService(): Promise<boolean> {
    try {
      const userId = 'test-user-' + Date.now()

      // Test create
      const memory = await this.memoryService.createMemory(
        'Test memory content',
        {
          userId,
          tags: ['test'],
          metadata: { source: 'integration-test' },
        },
      )

      // Test list
      const memories = await this.memoryService.listMemories(userId, {
        limit: 10,
      })

      // Test update
      const updated = await this.memoryService.updateMemory(memory.id, userId, {
        content: 'Updated content',
        tags: ['test', 'updated'],
      })

      // Test search
      const searchResults = await this.memoryService.searchMemories(
        userId,
        'Updated',
      )

      // Test delete
      const deleted = await this.memoryService.deleteMemory(memory.id, userId)

      return (
        memory.id !== undefined &&
        memories.length > 0 &&
        updated !== null &&
        searchResults.length > 0 &&
        deleted === true
      )
    } catch (error: unknown) {
      logger.error('Memory service test failed:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return false
    }
  }

  private async testFHEService(): Promise<boolean> {
    try {
      // Initialize FHE service
      await fheService.initialize({
        mode: EncryptionMode.STANDARD,
        securityLevel: 'medium',
      })

      // Test encryption
      const testData = 'Sensitive therapy session data'
      const encrypted = await fheService.encrypt(testData)

      // Test decryption
      const decrypted = await fheService.decrypt(encrypted)

      // Test key rotation
      await fheService.rotateKeys()

      return encrypted !== testData && decrypted === testData
    } catch (error: unknown) {
      logger.error('FHE service test failed:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return false
    }
  }

  private async testBiasDetection(): Promise<boolean> {
    try {
      const sessionData = {
        messages: [
          { content: 'This is a test therapy session message', role: 'user' },
          { content: 'Thank you for sharing that with me', role: 'therapist' },
        ],
        sessionId: 'test-session-' + Date.now(),
        timestamp: Date.now(),
      }

      const result = await this.biasEngine.analyzeSession(sessionData)

      return (
        result.biasScore !== undefined &&
        result.alertLevel !== undefined &&
        typeof result.biasScore === 'number'
      )
    } catch (error: unknown) {
      logger.error('Bias detection test failed:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return false
    }
  }

  private async testEmotionAnalysis(): Promise<boolean> {
    try {
      const testText = 'I feel really anxious about my upcoming presentation'

      const result = await this.emotionMapper.analyzeText(testText, {
        depth: 'detailed',
        sessionId: 'test-emotion-session',
      })

      return (
        result.primary !== undefined &&
        result.confidence !== undefined &&
        result.dimensions !== undefined &&
        typeof result.confidence === 'number'
      )
    } catch (error: unknown) {
      logger.error('Emotion analysis test failed:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return false
    }
  }

  private async testCrossServiceCommunication(): Promise<boolean> {
    try {
      const userId = 'cross-test-user-' + Date.now()
      const sessionText =
        'I have been feeling overwhelmed lately with work stress'

      // 1. Analyze emotions
      const emotionResult = await this.emotionMapper.analyzeText(sessionText)

      // 2. Store analysis in memory
      const memory = await this.memoryService.createMemory(
        JSON.stringify(emotionResult),
        {
          userId,
          tags: ['emotion-analysis', 'therapy-session'],
          metadata: {
            sessionId: 'cross-test-session',
            analysisType: 'emotion',
            timestamp: Date.now(),
          },
        },
      )

      // 3. Encrypt sensitive data
      const encryptedAnalysis = await fheService.encrypt(
        JSON.stringify(emotionResult),
      )

      // 4. Run bias detection on session
      const biasResult = await this.biasEngine.analyzeSession({
        messages: [{ content: sessionText, role: 'user' }],
        sessionId: 'cross-test-session',
        timestamp: Date.now(),
      })

      // 5. Store bias analysis
      const biasMemory = await this.memoryService.createMemory(
        JSON.stringify(biasResult),
        {
          userId,
          tags: ['bias-analysis', 'therapy-session'],
          metadata: {
            sessionId: 'cross-test-session',
            analysisType: 'bias',
            timestamp: Date.now(),
          },
        },
      )

      // Verify all services worked together
      return (
        memory?.id !== undefined &&
        biasMemory?.id !== undefined &&
        encryptedAnalysis !== sessionText &&
        emotionResult?.primary !== undefined &&
        biasResult?.biasScore !== undefined
      )
    } catch (error: unknown) {
      logger.error('Cross-service communication test failed:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return false
    }
  }
}

// Export singleton instance for testing
export const serviceIntegrationTester = new ServiceIntegrationTester()
