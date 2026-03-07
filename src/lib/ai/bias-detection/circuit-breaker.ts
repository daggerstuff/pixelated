/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by monitoring service health and failing fast
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('CircuitBreaker')

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerConfig {
  failureThreshold: number // Number of failures before opening
  recoveryTimeout: number // Time to wait before trying again (ms)
  monitoringPeriod: number // Time window for failure counting (ms)
  successThreshold: number // Successes needed to close from half-open
  volumeThreshold: number // Minimum requests before considering failure rate
  failureRateThreshold?: number // Failure rate threshold for opening circuit
}

export interface CircuitBreakerStats {
  state: CircuitState
  failureCount: number
  successCount: number
  totalRequests: number
  lastFailureTime?: Date
  lastSuccessTime?: Date
  stateChangedAt: Date
  failureRate: number
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private successCount = 0
  private totalRequests = 0
  private lastFailureTime?: Date
  private lastSuccessTime?: Date
  private stateChangedAt = new Date()
  private requestWindow: Array<{ timestamp: Date; success: boolean }> = []
  private config: CircuitBreakerConfig

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      successThreshold: 3,
      volumeThreshold: 10,
      failureRateThreshold: 0.5,
      ...config,
    }

    // Clean up old requests periodically
    setInterval(() => this.cleanupRequestWindow(), 30000)
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN'
        this.stateChangedAt = new Date()
        logger.info('Circuit breaker moved to HALF_OPEN state')
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable')
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error: unknown) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    this.successCount++
    this.totalRequests++
    this.lastSuccessTime = new Date()

    this.requestWindow.push({
      timestamp: new Date(),
      success: true,
    })

    if (this.state === 'HALF_OPEN') {
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'CLOSED'
        this.stateChangedAt = new Date()
        this.resetCounts()
        logger.info('Circuit breaker CLOSED - service recovered')
      }
    } else if (this.state === 'CLOSED') {
      // In CLOSED state, we rely on the request window for failure tracking
    }

    logger.debug('Circuit breaker recorded success', {
      state: this.state,
      successCount: this.successCount,
      failureCount: this.failureCount,
    })
  }

  private onFailure() {
    this.failureCount++
    this.totalRequests++
    this.lastFailureTime = new Date()

    this.requestWindow.push({
      timestamp: new Date(),
      success: false,
    })

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open state opens the circuit
      this.state = 'OPEN'
      this.stateChangedAt = new Date()
      logger.warn('Circuit breaker OPENED from HALF_OPEN due to failure')
    } else if (this.state === 'CLOSED') {
      const recentRequests = this.getRecentRequests()
      const recentFailures = recentRequests.filter((r) => !r.success).length
      const failureRate =
        recentRequests.length > 0 ? recentFailures / recentRequests.length : 0

      if (
        recentRequests.length >= this.config.volumeThreshold &&
        recentFailures >= this.config.failureThreshold &&
        failureRate > (this.config.failureRateThreshold ?? 0.5)
      ) {
        this.state = 'OPEN'
        this.stateChangedAt = new Date()
        logger.warn('Circuit breaker OPENED due to failure threshold', {
          recentFailures,
          totalRecentRequests: recentRequests.length,
          failureRate,
          threshold: this.config.failureThreshold,
        })
      }
    }

    logger.debug('Circuit breaker recorded failure', {
      state: this.state,
      successCount: this.successCount,
      failureCount: this.failureCount,
    })
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return true
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime()
    return timeSinceLastFailure >= this.config.recoveryTimeout
  }

  private getRecentRequests(): Array<{ timestamp: Date; success: boolean }> {
    const cutoff = new Date(Date.now() - this.config.monitoringPeriod)
    return this.requestWindow.filter((req) => req.timestamp >= cutoff)
  }

  private cleanupRequestWindow() {
    const cutoff = new Date(Date.now() - this.config.monitoringPeriod)
    this.requestWindow = this.requestWindow.filter(
      (req) => req.timestamp >= cutoff,
    )
  }

  private resetCounts() {
    this.failureCount = 0
    this.successCount = 0
    this.requestWindow = []
  }

  getStats(): CircuitBreakerStats {
    const recentRequests = this.getRecentRequests()
    const recentFailures = recentRequests.filter((r) => !r.success).length
    const failureRate =
      recentRequests.length > 0 ? recentFailures / recentRequests.length : 0

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangedAt: this.stateChangedAt,
      failureRate,
    }
  }

  // Force state changes for testing or manual intervention
  forceOpen() {
    this.state = 'OPEN'
    this.stateChangedAt = new Date()
    logger.warn('Circuit breaker manually forced OPEN')
  }

  forceClose() {
    this.state = 'CLOSED'
    this.stateChangedAt = new Date()
    this.resetCounts()
    logger.info('Circuit breaker manually forced CLOSED')
  }

  forceHalfOpen() {
    this.state = 'HALF_OPEN'
    this.stateChangedAt = new Date()
    this.successCount = 0
    logger.info('Circuit breaker manually forced HALF_OPEN')
  }
}
