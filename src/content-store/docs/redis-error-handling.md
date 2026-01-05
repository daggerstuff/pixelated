---
title: 'Redis Error Handling'
description: 'Guide for handling Redis errors and exceptions'
pubDate: 2025-03-25
share: true
toc: true
lastModDate: 2025-03-25
tags: ['redis', 'error-handling', 'exceptions']
author: 'Pixelated Team'
---

# Redis Error Handling Guide

## Overview

This guide provides comprehensive information about handling errors in the Redis service implementation. It covers error types, handling strategies, and best practices for maintaining a robust Redis integration.

## Error Types

### RedisServiceError

The service uses a custom `RedisServiceError` class that extends the standard `Error` class:

```typescript
class RedisServiceError extends Error {
  constructor(
    public code: RedisErrorCode,
    message: string,
    public cause?: unknown,
  ) {
    super(message)
    this.name = 'RedisServiceError'
  }
}
```

### Error Codes

```typescript
enum RedisErrorCode {
  CONNECTION_FAILED = 'REDIS_CONNECTION_FAILED',
  OPERATION_FAILED = 'REDIS_OPERATION_FAILED',
  INVALID_CONFIG = 'REDIS_INVALID_CONFIG',
  CONNECTION_CLOSED = 'REDIS_CONNECTION_CLOSED',
  POOL_EXHAUSTED = 'REDIS_POOL_EXHAUSTED',
  HEALTH_CHECK_FAILED = 'REDIS_HEALTH_CHECK_FAILED',
}
```

## Error Handling Patterns

### Basic Error Handling

```typescript
try {
  await redis.set('key', 'value')
} catch (error) {
  if (error instanceof RedisServiceError) {
    switch (error.code) {
      case RedisErrorCode.CONNECTION_FAILED:
        logger.error('Redis connection failed:', error)
        // Handle connection failure
        break
      case RedisErrorCode.OPERATION_FAILED:
        logger.error('Redis operation failed:', error)
        // Handle operation failure
        break
      default:
        logger.error('Unexpected Redis error:', error)
      // Handle unknown error
    }
  } else {
    logger.error('Unknown error:', error)
    throw error
  }
}
```

### Retry Pattern

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000,
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      if (error instanceof RedisServiceError) {
        switch (error.code) {
          case RedisErrorCode.CONNECTION_FAILED:
          case RedisErrorCode.OPERATION_FAILED:
            // Retryable errors
            if (attempt < maxRetries) {
              logger.warn(`Retry attempt ${attempt} of ${maxRetries}`)
              await new Promise((resolve) =>
                setTimeout(resolve, delay * attempt),
              )
              continue
            }
            break
          default:
            // Non-retryable errors
            throw error
        }
      }
      throw error
    }
  }

  throw lastError
}

// Usage
const value = await withRetry(() => redis.get('key'))
```

### Circuit Breaker Pattern

```typescript
class RedisCircuitBreaker {
  private failures = 0
  private lastFailure: number | null = null
  private readonly threshold = 5
  private readonly resetTimeout = 60000 // 1 minute

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new RedisServiceError(
        RedisErrorCode.CIRCUIT_OPEN,
        'Circuit breaker is open',
      )
    }

    try {
      const result = await operation()
      this.reset()
      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  private isOpen(): boolean {
    if (this.failures >= this.threshold) {
      const now = Date.now()
      if (this.lastFailure && now - this.lastFailure < this.resetTimeout) {
        return true
      }
      this.reset()
    }
    return false
  }

  private recordFailure(): void {
    this.failures++
    this.lastFailure = Date.now()
  }

  private reset(): void {
    this.failures = 0
    this.lastFailure = null
  }
}

// Usage
const circuitBreaker = new RedisCircuitBreaker()
const value = await circuitBreaker.execute(() => redis.get('key'))
```

### Fallback Pattern

```typescript
class RedisFallback<T> {
  constructor(
    private readonly redis: RedisService,
    private readonly fallbackStore: Map<string, T> = new Map(),
  ) {}

  async getWithFallback(
    key: string,
    fallbackValue: T,
    ttlMs?: number,
  ): Promise<T> {
    try {
      const value = await this.redis.get(key)
      if (value !== null) {
        return JSON.parse(value)
      }
    } catch (error) {
      logger.warn('Redis get failed, using fallback:', error)
    }

    // Use fallback store
    if (!this.fallbackStore.has(key)) {
      this.fallbackStore.set(key, fallbackValue)
      // Attempt to update Redis in background
      this.updateRedis(key, fallbackValue, ttlMs).catch((error) => {
        logger.error('Failed to update Redis with fallback value:', error)
      })
    }

    return this.fallbackStore.get(key) as T
  }

  private async updateRedis(
    key: string,
    value: T,
    ttlMs?: number,
  ): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), ttlMs)
    } catch (error) {
      logger.error('Failed to update Redis:', error)
    }
  }
}

// Usage
const fallback = new RedisFallback<UserPreferences>(redis)
const prefs = await fallback.getWithFallback('user:123:prefs', defaultPrefs)
```

## Error Recovery Strategies

### Automatic Reconnection

```typescript
class RedisReconnectionManager {
  private reconnectTimeout: NodeJS.Timeout | null = null
  private readonly maxReconnectDelay = 30000 // 30 seconds

  constructor(private readonly redis: RedisService) {
    this.setupConnectionMonitoring()
  }

  private setupConnectionMonitoring(): void {
    // Monitor health checks
    setInterval(async () => {
      try {
        await this.redis.isHealthy()
      } catch (error) {
        this.handleConnectionFailure()
      }
    }, 5000)
  }

  private async handleConnectionFailure(): Promise<void> {
    if (this.reconnectTimeout) {
      return // Already attempting to reconnect
    }

    let attempt = 0
    const reconnect = async () => {
      try {
        await this.redis.connect()
        this.clearReconnectTimeout()
      } catch (error) {
        attempt++
        const delay = Math.min(
          1000 * Math.pow(2, attempt),
          this.maxReconnectDelay,
        )
        this.reconnectTimeout = setTimeout(reconnect, delay)
      }
    }

    await reconnect()
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
  }
}

// Usage
const reconnectionManager = new RedisReconnectionManager(redis)
```

### Connection Pool Management

```typescript
class RedisPoolManager {
  private readonly minPoolSize: number
  private readonly maxPoolSize: number
  private readonly checkInterval: number

  constructor(
    private readonly redis: RedisService,
    options = {
      minPoolSize: 5,
      maxPoolSize: 50,
      checkInterval: 30000,
    },
  ) {
    this.minPoolSize = options.minPoolSize
    this.maxPoolSize = options.maxPoolSize
    this.checkInterval = options.checkInterval
    this.startMonitoring()
  }

  private async startMonitoring(): Promise<void> {
    setInterval(async () => {
      try {
        const stats = await this.redis.getPoolStats()
        await this.adjustPool(stats)
      } catch (error) {
        logger.error('Pool monitoring error:', error)
      }
    }, this.checkInterval)
  }

  private async adjustPool(stats: {
    totalConnections: number
    activeConnections: number
    idleConnections: number
    waitingClients: number
  }): Promise<void> {
    if (stats.totalConnections < this.minPoolSize) {
      logger.warn('Pool size below minimum, increasing connections')
      // Implementation to increase pool size
    } else if (
      stats.totalConnections > this.maxPoolSize &&
      stats.idleConnections > this.minPoolSize
    ) {
      logger.warn('Pool size above maximum, decreasing connections')
      // Implementation to decrease pool size
    }
  }
}

// Usage
const poolManager = new RedisPoolManager(redis)
```

## Error Monitoring and Logging

### Error Metrics Collection

```typescript
class RedisErrorMetrics {
  private errors: Map<RedisErrorCode, number> = new Map()
  private readonly flushInterval: number

  constructor(
    private readonly redis: RedisService,
    options = { flushInterval: 60000 },
  ) {
    this.flushInterval = options.flushInterval
    this.startMetricsCollection()
  }

  recordError(error: RedisServiceError): void {
    const count = (this.errors.get(error.code) || 0) + 1
    this.errors.set(error.code, count)
  }

  private async startMetricsCollection(): Promise<void> {
    setInterval(async () => {
      try {
        await this.flushMetrics()
      } catch (error) {
        logger.error('Error flushing metrics:', error)
      }
    }, this.flushInterval)
  }

  private async flushMetrics(): Promise<void> {
    const timestamp = Date.now()
    const metrics = Array.from(this.errors.entries()).map(([code, count]) => ({
      code,
      count,
      timestamp,
    }))

    if (metrics.length > 0) {
      await this.redis.set(
        `metrics:errors:${timestamp}`,
        JSON.stringify(metrics),
        86400000, // 24 hours TTL
      )
    }

    this.errors.clear()
  }
}

// Usage
const errorMetrics = new RedisErrorMetrics(redis)
```

### Structured Logging

```typescript
class RedisLogger {
  constructor(
    private readonly service: string,
    private readonly environment: string,
  ) {}

  logError(error: RedisServiceError, context: Record<string, unknown>): void {
    logger.error({
      service: this.service,
      environment: this.environment,
      errorCode: error.code,
      message: error.message,
      cause: error.cause,
      context,
      timestamp: new Date().toISOString(),
    })
  }

  logWarning(message: string, context: Record<string, unknown>): void {
    logger.warn({
      service: this.service,
      environment: this.environment,
      message,
      context,
      timestamp: new Date().toISOString(),
    })
  }
}

// Usage
const redisLogger = new RedisLogger('redis', process.env.NODE_ENV)
```

## Best Practices

1. Error Classification
   - Categorize errors by severity and type
   - Implement appropriate handling strategies
   - Use custom error codes for better tracking

2. Retry Strategies
   - Implement exponential backoff
   - Set maximum retry attempts
   - Consider circuit breaker pattern

3. Monitoring and Alerting
   - Track error rates and patterns
   - Set up alerts for critical errors
   - Monitor connection pool health

4. Recovery Procedures
   - Implement automatic reconnection
   - Manage connection pools effectively
   - Use fallback mechanisms

5. Logging and Debugging
   - Use structured logging
   - Include relevant context
   - Maintain error metrics

## Testing Error Handling

```typescript
describe('Redis Error Handling', () => {
  let redis: RedisService
  let errorMetrics: RedisErrorMetrics

  beforeEach(() => {
    redis = new RedisService(testConfig)
    errorMetrics = new RedisErrorMetrics(redis)
  })

  it('should handle connection failures', async () => {
    // Test connection failure handling
    const invalidConfig = { ...testConfig, url: 'redis://invalid:6379' }
    const invalidRedis = new RedisService(invalidConfig)

    await expect(invalidRedis.connect()).rejects.toThrow(RedisServiceError)
  })

  it('should implement retry logic', async () => {
    // Test retry logic
    const value = await withRetry(() => redis.get('test-key'))
    expect(value).toBeNull()
  })

  it('should use circuit breaker', async () => {
    // Test circuit breaker
    const breaker = new RedisCircuitBreaker()

    // Simulate multiple failures
    for (let i = 0; i < 6; i++) {
      try {
        await breaker.execute(() => {
          throw new RedisServiceError(
            RedisErrorCode.OPERATION_FAILED,
            'Test failure',
          )
        })
      } catch (error) {
        // Expected
      }
    }

    // Circuit should be open
    await expect(
      breaker.execute(() => Promise.resolve('test')),
    ).rejects.toThrow('Circuit breaker is open')
  })

  it('should use fallback mechanism', async () => {
    // Test fallback
    const fallback = new RedisFallback<string>(redis)
    const result = await fallback.getWithFallback(
      'missing-key',
      'default-value',
    )
    expect(result).toBe('default-value')
  })
})
```
