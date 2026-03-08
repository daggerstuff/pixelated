/**
 * Phase 3: Comprehensive Service Integration Testing & Performance Optimization
 *
 * This module provides comprehensive testing of cross-service communication,
 * performance benchmarking, and production readiness validation.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { MemoryService } from '../memory'
import { fheService } from '../fhe'
import { EncryptionMode } from '../fhe/types'
import { BiasDetectionEngine } from '../ai/bias-detection/index'
import { MultidimensionalEmotionMapper } from '../ai/emotions/MultidimensionalEmotionMapper'
import { AnalyticsService } from './analytics/AnalyticsService'
import { RedisService } from './redis/RedisService'
import { NotificationService } from './notification/NotificationService'
import { ContactService } from './contact/ContactService'
import { EmailService } from './email/EmailService'

const logger = createBuildSafeLogger('phase3-integration-test')

export interface Phase3TestResult {
  success: boolean
  phase: 'Phase 3: Service Integration & Performance'
  results: {
    serviceHealth: boolean
    crossServiceCommunication: boolean
    performanceBenchmarks: boolean
    errorRecovery: boolean
    concurrencyHandling: boolean
    memoryManagement: boolean
    productionReadiness: boolean
  }
  performance: {
    totalTime: number
    serviceTimings: Record<string, number>
    throughputMetrics: Record<string, number>
    memoryUsage: Record<string, number>
  }
  errors: string[]
  recommendations: string[]
}

export class Phase3IntegrationTester {
  private memoryService: MemoryService
  private biasEngine: BiasDetectionEngine
  private emotionMapper: MultidimensionalEmotionMapper
  private analyticsService: AnalyticsService
  private redisService: RedisService
  private notificationService: NotificationService
  private contactService: ContactService
  private emailService: EmailService

  constructor() {
    this.memoryService = new MemoryService()
    this.biasEngine = new BiasDetectionEngine()
    this.emotionMapper = new MultidimensionalEmotionMapper()
    this.analyticsService = new AnalyticsService()
    this.redisService = new RedisService({
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
      retryAttempts: 3,
      retryDelay: 1000,
    })
    this.notificationService = new NotificationService()
    this.contactService = new ContactService()
    this.emailService = new EmailService()
  }

  async runPhase3IntegrationTest(): Promise<Phase3TestResult> {
    const startTime = Date.now()
    const errors: string[] = []
    const recommendations: string[] = []
    const serviceTimings: Record<string, number> = {}
    const throughputMetrics: Record<string, number> = {}
    const memoryUsage: Record<string, number> = {}

    const results = {
      serviceHealth: false,
      crossServiceCommunication: false,
      performanceBenchmarks: false,
      errorRecovery: false,
      concurrencyHandling: false,
      memoryManagement: false,
      productionReadiness: false,
    }

    logger.info('Starting Phase 3: Service Integration & Performance Testing')

    try {
      // 1. Service Health Checks
      const healthStart = Date.now()
      results.serviceHealth = await this.testServiceHealth()
      serviceTimings.serviceHealth = Date.now() - healthStart

      // 2. Cross-Service Communication
      const commStart = Date.now()
      results.crossServiceCommunication =
        await this.testCrossServiceCommunication()
      serviceTimings.crossServiceCommunication = Date.now() - commStart

      // 3. Performance Benchmarks
      const perfStart = Date.now()
      const perfResults = await this.testPerformanceBenchmarks()
      results.performanceBenchmarks = perfResults.success
      throughputMetrics.apiRequests = perfResults.apiThroughput
      throughputMetrics.dataProcessing = perfResults.dataProcessingRate
      serviceTimings.performanceBenchmarks = Date.now() - perfStart

      // 4. Error Recovery
      const errorStart = Date.now()
      results.errorRecovery = await this.testErrorRecovery()
      serviceTimings.errorRecovery = Date.now() - errorStart

      // 5. Concurrency Handling
      const concurrencyStart = Date.now()
      const concurrencyResults = await this.testConcurrencyHandling()
      results.concurrencyHandling = concurrencyResults.success
      throughputMetrics.concurrentOperations =
        concurrencyResults.operationsPerSecond
      serviceTimings.concurrencyHandling = Date.now() - concurrencyStart

      // 6. Memory Management
      const memoryStart = Date.now()
      const memoryResults = await this.testMemoryManagement()
      results.memoryManagement = memoryResults.success
      memoryUsage.baseline = memoryResults.baselineMemory
      memoryUsage.peak = memoryResults.peakMemory
      memoryUsage.afterCleanup = memoryResults.afterCleanupMemory
      serviceTimings.memoryManagement = Date.now() - memoryStart

      // 7. Production Readiness
      const prodStart = Date.now()
      const prodResults = await this.testProductionReadiness()
      results.productionReadiness = prodResults.success
      recommendations.push(...prodResults.recommendations)
      serviceTimings.productionReadiness = Date.now() - prodStart
    } catch (error: unknown) {
      errors.push(
        `Phase 3 integration test failed: ${error instanceof Error ? String(error) : String(error)}`,
      )
    }

    const totalTime = Date.now() - startTime
    const success =
      Object.values(results).every((result) => result === true) &&
      errors.length === 0

    // Generate performance recommendations
    if (serviceTimings.crossServiceCommunication > 5000) {
      recommendations.push(
        'Cross-service communication is slow (>5s). Consider optimizing API calls or adding caching.',
      )
    }
    if (throughputMetrics.apiRequests < 100) {
      recommendations.push(
        'API throughput is low (<100 req/s). Consider connection pooling and request optimization.',
      )
    }
    if (memoryUsage.peak > memoryUsage.baseline * 3) {
      recommendations.push(
        'Memory usage spikes significantly. Implement better memory management and garbage collection.',
      )
    }

    logger.info('Phase 3 integration test completed', {
      success,
      totalTime,
      results,
      errorCount: errors.length,
      recommendationCount: recommendations.length,
    })

    return {
      success,
      phase: 'Phase 3: Service Integration & Performance',
      results,
      performance: {
        totalTime,
        serviceTimings,
        throughputMetrics,
        memoryUsage,
      },
      errors,
      recommendations,
    }
  }

  private async testServiceHealth(): Promise<boolean> {
    try {
      logger.info('Testing service health...')

      // Test core services
      const healthChecks = await Promise.allSettled([
        this.memoryService.healthCheck?.() || Promise.resolve(true),
        this.redisService.isHealthy(),
        this.analyticsService.healthCheck?.() || Promise.resolve(true),
        this.notificationService.healthCheck?.() || Promise.resolve(true),
        this.contactService.healthCheck?.() || Promise.resolve(true),
        this.emailService.healthCheck?.() || Promise.resolve(true),
      ])

      const healthResults = healthChecks.map((result) =>
        result.status === 'fulfilled' ? result.value : false,
      )

      const allHealthy = healthResults.every((result) => result === true)

      if (!allHealthy) {
        logger.warn('Some services are unhealthy', { healthResults })
      }

      return allHealthy
    } catch (error: unknown) {
      logger.error('Service health check failed:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return false
    }
  }

  private async testCrossServiceCommunication(): Promise<boolean> {
    try {
      logger.info('Testing cross-service communication...')

      const userId = 'phase3-test-user-' + Date.now()
      const sessionText =
        'I have been feeling overwhelmed with work stress and anxiety lately'

      // 1. Emotion Analysis
      const emotionResult = await (
        this.emotionMapper as unknown as {
          analyzeText?: (
            text: string,
            opts: Record<string, unknown>,
          ) => Promise<unknown>
        }
      )?.analyzeText?.(sessionText, {
        depth: 'detailed',
        sessionId: 'phase3-cross-test',
      })

      // 2. Store emotion analysis in memory
      const emotionMemory = await this.memoryService.createMemory(
        JSON.stringify(emotionResult),
        {
          userId,
          tags: ['emotion-analysis', 'phase3-test'],
          metadata: {
            sessionId: 'phase3-cross-test',
            analysisType: 'emotion',
            timestamp: Date.now(),
          },
        },
      )

      // 3. Bias detection analysis
      const biasResult = await this.biasEngine.analyzeSession({
        messages: [{ content: sessionText, role: 'user' }],
        sessionId: 'phase3-cross-test',
        timestamp: Date.now(),
      })

      // 4. Store bias analysis
      const biasMemory = await this.memoryService.createMemory(
        JSON.stringify(biasResult),
        {
          userId,
          tags: ['bias-analysis', 'phase3-test'],
          metadata: {
            sessionId: 'phase3-cross-test',
            analysisType: 'bias',
            timestamp: Date.now(),
          },
        },
      )

      // 5. Track analytics event
      await this.analyticsService.trackEvent({
        event: 'cross_service_test',
        userId,
        sessionId: 'phase3-cross-test',
        timestamp: Date.now(),
        metadata: {
          emotionPrimary: emotionResult['primary'],
          biasScore: biasResult['biasScore'],
        },
      })

      // 6. Send notification if high bias detected
      if (biasResult['biasScore'] > 0.7) {
        await this.notificationService.sendNotification({
          type: 'bias_alert',
          userId,
          title: 'High Bias Detected',
          message: `Bias score: ${biasResult['biasScore']}`,
          priority: 'high',
        })
      }

      // 7. Encrypt sensitive data
      await fheService.initialize({
        mode: EncryptionMode.STANDARD,
        securityLevel: 'medium',
      })
      const encryptedData = await fheService.encrypt(
        JSON.stringify({
          emotion: emotionResult,
          bias: biasResult,
        }),
      )

      // Verify all operations succeeded
      return (
        emotionMemory['id'] !== undefined &&
        biasMemory['id'] !== undefined &&
        emotionResult['primary'] !== undefined &&
        biasResult['biasScore'] !== undefined &&
        encryptedData !== sessionText
      )
    } catch (error: unknown) {
      logger.error('Cross-service communication test failed:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return false
    }
  }

  private async testPerformanceBenchmarks(): Promise<{
    success: boolean
    apiThroughput: number
    dataProcessingRate: number
  }> {
    try {
      logger.info('Running performance benchmarks...')

      // API Throughput Test
      const apiStartTime = Date.now()
      const apiOperations = []

      for (let i = 0; i < 100; i++) {
        ;(apiOperations as unknown[]).push(
          this.memoryService.createMemory(`Performance test ${i}`, {
            userId: `perf-user-${i}`,
            tags: ['performance-test'],
            metadata: { testRun: Date.now() },
          }),
        )
      }

      await Promise.all(apiOperations)
      const apiDuration = Date.now() - apiStartTime
      const apiThroughput = Math.round((100 * 1000) / apiDuration) // operations per second

      // Data Processing Rate Test
      const dataStartTime = Date.now()
      const dataOperations = []

      for (let i = 0; i < 50; i++) {
        ;(dataOperations as unknown[]).push(
          (
            this.emotionMapper as unknown as {
              analyzeText: (
                text: string,
                opts: Record<string, unknown>,
              ) => Promise<unknown>
            }
          )['analyzeText'](`Test message ${i} with various emotional content`, {
            depth: 'basic',
            sessionId: `perf-session-${i}`,
          }),
        )
      }

      await Promise.all(dataOperations)
      const dataDuration = Date.now() - dataStartTime
      const dataProcessingRate = Math.round((50 * 1000) / dataDuration) // analyses per second

      const success = apiThroughput > 10 && dataProcessingRate > 5 // Minimum acceptable thresholds

      logger.info('Performance benchmarks completed', {
        apiThroughput,
        dataProcessingRate,
        success,
      })

      return {
        success,
        apiThroughput,
        dataProcessingRate,
      }
    } catch (error: unknown) {
      logger.error('Performance benchmark test failed:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return {
        success: false,
        apiThroughput: 0,
        dataProcessingRate: 0,
      }
    }
  }

  private async testErrorRecovery(): Promise<boolean> {
    try {
      logger.info('Testing error recovery...')

      // Test service recovery after simulated failures
      let recoverySuccess = true

      // Test memory service recovery
      try {
        await this.memoryService.createMemory('', { userId: '', tags: [] }) // Invalid data
      } catch {
        // Expected error - test if service can continue after error
        const recovery = await this.memoryService.createMemory(
          'Recovery test',
          {
            userId: 'recovery-user',
            tags: ['recovery-test'],
            metadata: { test: 'error-recovery' },
          },
        )
        if (!recovery?.['id']) {
          recoverySuccess = false
        }
      }

      // Test Redis connection recovery
      try {
        await this.redisService.disconnect()
        await this.redisService.connect()
        const testValue = await this.redisService.set(
          'recovery-test',
          'success',
          1000,
        )
        if (testValue === undefined || testValue === null) {
          recoverySuccess = false
        }
      } catch {
        recoverySuccess = false
      }

      return recoverySuccess
    } catch (error: unknown) {
      logger.error('Error recovery test failed:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return false
    }
  }

  private async testConcurrencyHandling(): Promise<{
    success: boolean
    operationsPerSecond: number
  }> {
    try {
      logger.info('Testing concurrency handling...')

      const startTime = Date.now()
      const concurrentOperations = []

      // Create 50 concurrent operations across different services
      for (let i = 0; i < 50; i++) {
        ;(concurrentOperations as unknown[]).push(
          Promise.all([
            this.memoryService.createMemory(`Concurrent test ${i}`, {
              userId: `concurrent-user-${i}`,
              tags: ['concurrency-test'],
              metadata: { index: i },
            }),
            this.analyticsService.trackEvent({
              type: 'concurrency_test' as unknown as string,
              userId: `concurrent-user-${i}`,
              timestamp: Date.now(),
              metadata: { index: i },
            }),
            this.redisService.set(`concurrent-key-${i}`, `value-${i}`, 5000),
          ]),
        )
      }

      const results = await Promise.allSettled(concurrentOperations)
      const successfulOperations = results.filter(
        (result) => result['status'] === 'fulfilled',
      ).length
      const duration = Date.now() - startTime
      const operationsPerSecond = Math.round(
        (successfulOperations * 1000) / duration,
      )

      const success = successfulOperations >= 45 && operationsPerSecond > 20 // 90% success rate minimum

      logger.info('Concurrency test completed', {
        successfulOperations,
        totalOperations: 50,
        operationsPerSecond,
        success,
      })

      return {
        success,
        operationsPerSecond,
      }
    } catch (error: unknown) {
      logger.error('Concurrency handling test failed:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return {
        success: false,
        operationsPerSecond: 0,
      }
    }
  }

  private async testMemoryManagement(): Promise<{
    success: boolean
    baselineMemory: number
    peakMemory: number
    afterCleanupMemory: number
  }> {
    try {
      logger.info('Testing memory management...')

      const getMemoryUsage = () => {
        if (typeof process !== 'undefined' && process?.['memoryUsage']) {
          return process['memoryUsage']()['heapUsed'] / 1024 / 1024 // MB
        }
        return 0
      }

      const baselineMemory = getMemoryUsage()

      // Create memory-intensive operations
      const memoryOperations = []
      for (let i = 0; i < 100; i++) {
        ;(memoryOperations as unknown[]).push(
          (
            this.emotionMapper as unknown as {
              analyzeText: (
                text: string,
                opts: Record<string, unknown>,
              ) => Promise<unknown>
            }
          )['analyzeText'](
            `Memory test ${i} with extensive emotional analysis content that should consume significant memory during processing`,
            {
              depth: 'detailed',
              sessionId: `memory-test-${i}`,
            },
          ),
        )
      }

      await Promise.all(memoryOperations)
      const peakMemory = getMemoryUsage()

      // Force garbage collection if available
      if (global?.['gc']) {
        global['gc']()
      }

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const afterCleanupMemory = getMemoryUsage()

      const memoryIncrease = peakMemory - baselineMemory
      const memoryRecovered = peakMemory - afterCleanupMemory
      const recoveryRate = memoryRecovered / memoryIncrease

      const success = memoryIncrease < 500 && recoveryRate > 0.5 // Less than 500MB increase, >50% recovery

      logger.info('Memory management test completed', {
        baselineMemory: Math.round(baselineMemory),
        peakMemory: Math.round(peakMemory),
        afterCleanupMemory: Math.round(afterCleanupMemory),
        memoryIncrease: Math.round(memoryIncrease),
        recoveryRate: Math.round(recoveryRate * 100),
        success,
      })

      return {
        success,
        baselineMemory: Math.round(baselineMemory),
        peakMemory: Math.round(peakMemory),
        afterCleanupMemory: Math.round(afterCleanupMemory),
      }
    } catch (error: unknown) {
      logger.error('Memory management test failed:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return {
        success: false,
        baselineMemory: 0,
        peakMemory: 0,
        afterCleanupMemory: 0,
      }
    }
  }

  private async testProductionReadiness(): Promise<{
    success: boolean
    recommendations: string[]
  }> {
    try {
      logger.info('Testing production readiness...')

      const recommendations: string[] = []
      let readinessScore = 0
      const maxScore = 10

      // Check environment configuration
      if (process.env['NODE_ENV'] === 'production') {
        readinessScore += 1
      } else {
        recommendations.push(
          'Set NODE_ENV=production for production deployment',
        )
      }

      // Check Redis configuration
      if (process.env['REDIS_HOST'] && process.env['REDIS_PORT']) {
        readinessScore += 1
      } else {
        recommendations.push('Configure Redis connection parameters')
      }

      // Check logging configuration
      if (process.env['LOG_LEVEL']) {
        readinessScore += 1
      } else {
        recommendations.push('Configure LOG_LEVEL for production logging')
      }

      // Check security configurations
      if (process.env['JWT_SECRET'] && process.env['ENCRYPTION_KEY']) {
        readinessScore += 2
      } else {
        recommendations.push(
          'Configure JWT_SECRET and ENCRYPTION_KEY for security',
        )
      }

      // Check database configuration
      if (process.env['DATABASE_URL'] || process.env['MONGODB_URI']) {
        readinessScore += 1
      } else {
        recommendations.push('Configure database connection')
      }

      // Check monitoring configuration
      if (process.env['MONITORING_ENABLED']) {
        readinessScore += 1
      } else {
        recommendations.push('Enable monitoring for production')
      }

      // Check error tracking
      if (process.env['SENTRY_DSN'] || process.env['ERROR_TRACKING_URL']) {
        readinessScore += 1
      } else {
        recommendations.push('Configure error tracking service')
      }

      // Check rate limiting
      if (process.env['RATE_LIMIT_ENABLED']) {
        readinessScore += 1
      } else {
        recommendations.push('Enable rate limiting for production')
      }

      // Check CORS configuration
      if (process.env['CORS_ORIGIN']) {
        readinessScore += 1
      } else {
        recommendations.push('Configure CORS for production')
      }

      const success = readinessScore >= 7 // 70% readiness threshold

      logger.info('Production readiness test completed', {
        readinessScore,
        maxScore,
        success,
        recommendationCount: recommendations.length,
      })

      return {
        success,
        recommendations,
      }
    } catch (error: unknown) {
      logger.error('Production readiness test failed:', {
        error: error instanceof Error ? String(error) : String(error),
      })
      return {
        success: false,
        recommendations: [
          'Production readiness test failed - check system configuration',
        ],
      }
    }
  }
}

// Export singleton instance for testing
export const phase3IntegrationTester = new Phase3IntegrationTester()
