---
title: 'Redis Migration'
description: 'Guide for migrating Redis data and configurations'
pubDate: 2025-03-25
share: true
toc: true
lastModDate: 2025-03-25
tags: ['redis', 'migration', 'data-transfer']
author: 'Pixelated Team'
---

## Redis Migration Guide

## Overview

This guide provides step-by-step instructions for migrating existing services to use the
new Redis service implementation. The migration process is designed to be incremental
and safe, allowing for gradual adoption of the new service while
maintaining system stability.

## Migration Steps

1. Update Dependencies
   ```bash
   pnpm add ioredis
   ```

2. Configure Environment Variables

   ```bash
   # .env
   REDIS_URL=redis://localhost:6379
   REDIS_KEY_PREFIX="gradiant:"
   REDIS_MAX_RETRIES=3
   REDIS_RETRY_DELAY=1000
   REDIS_CONNECT_TIMEOUT=5000
   REDIS_MAX_CONNECTIONS=10
   REDIS_MIN_CONNECTIONS=2
   REDIS_HEALTH_CHECK_INTERVAL=30000
   ```

3. Initialize the Redis Service

   ```typescript

   const redis = new RedisService({
     url: process.env.REDIS_URL,
     keyPrefix: process.env.REDIS_KEY_PREFIX,
   })

   await redis.connect()
   ```


## Service-Specific Migration Guides

### Cache Invalidation Service

1. Update Import Statements
   ```typescript
   // Before

// After

````

2. Update Service Constructor

```typescript
// Before
  private readonly redis: ReturnType<typeof createClient>

  constructor() {
    this.redis = createClient()
  }
}

// After
  constructor(private readonly redis: RedisService) {}
}
````

3. Update Cache Operations

   ```typescript
   // Before
   async invalidateKey(key: string): Promise<void> {
     await this.redis.del(key)
   }

   // After
   async invalidateKey(key: string): Promise<void> {
     try {
       await this.redis.del(key)
     } catch (error) {
       if (error instanceof RedisServiceError) {
         logger.error('Cache invalidation failed:', error)
         throw error
       }
     }
   }
   ```

4. Update Service Registration

   ```typescript
   // Before
   const cacheInvalidation = new CacheInvalidationService()

   // After
   const redis = new RedisService({
     url: process.env.REDIS_URL,
     keyPrefix: 'cache:',
   })
   const cacheInvalidation = new CacheInvalidationService(redis)
   ```


### Analytics Service

1. Update Import Statements
   ```typescript
   // Before

// After

````

2. Update Service Constructor

```typescript
// Before
  private readonly redis: Redis

  constructor() {
    this.redis = new Redis()
  }
}

// After
  constructor(private readonly redis: RedisService) {}
}
````

3. Update Event Tracking

   ```typescript
   // Before
   async trackEvent(event: AnalyticsEvent): Promise<void> {
     await this.redis.lpush('events', JSON.stringify(event))
   }

   // After
   async trackEvent(event: AnalyticsEvent): Promise<void> {
     try {
       const key = `events:${event.type}:${Date.now()}`
       await this.redis.set(key, JSON.stringify(event), 86400000) // 24h TTL
     } catch (error) {
       if (error instanceof RedisServiceError) {
         logger.error('Event tracking failed:', error)
         throw error
       }
     }
   }
   ```

4. Update Service Registration

   ```typescript
   // Before
   const analytics = new AnalyticsService()

   // After
   const redis = new RedisService({
     url: process.env.REDIS_URL,
     keyPrefix: 'analytics:',
   })
   const analytics = new AnalyticsService(redis)
   ```


### Pattern Recognition Service

1. Update Import Statements
   ```typescript
   // Before

// After

````

2. Update Service Constructor

```typescript
// Before
  private readonly redis: RedisClient

  constructor() {
    this.redis = new RedisClient()
  }
}

// After
  constructor(private readonly redis: RedisService) {}
}
````

3. Update Pattern Storage

   ```typescript
   // Before
   async storePattern(pattern: Pattern): Promise<void> {
     await this.redis.set(
       `pattern:${pattern.id}`,
       JSON.stringify(pattern)
     )
   }

   // After
   async storePattern(pattern: Pattern): Promise<void> {
     try {
       await this.redis.set(
         `pattern:${pattern.id}`,
         JSON.stringify(pattern),
         3600000 // 1h TTL
       )
     } catch (error) {
       if (error instanceof RedisServiceError) {
         logger.error('Pattern storage failed:', error)
         throw error
       }
     }
   }
   ```

4. Update Service Registration

   ```typescript
   // Before
   const patternRecognition = new PatternRecognitionService()

   // After
   const redis = new RedisService({
     url: process.env.REDIS_URL,
     keyPrefix: 'patterns:',
   })
   const patternRecognition = new PatternRecognitionService(redis)
   ```


### Notification Service

1. Update Import Statements
   ```typescript
   // Before

// After

````

2. Update Service Constructor

```typescript
// Before
  private readonly redis: Redis

  constructor() {
    this.redis = new Redis()
  }
}

// After
  constructor(private readonly redis: RedisService) {}
}
````

3. Update Notification Storage

   ```typescript
   // Before
   async storeNotification(notification: Notification): Promise<void> {
     await this.redis.set(
       `notification:${notification.id}`,
       JSON.stringify(notification)
     )
   }

   // After
   async storeNotification(notification: Notification): Promise<void> {
     try {
       await this.redis.set(
         `notification:${notification.id}`,
         JSON.stringify(notification),
         3600000 // 1h TTL
       )
     } catch (error) {
       if (error instanceof RedisServiceError) {
         logger.error('Notification storage failed:', error)
         throw error
       }
     }
   }
   ```

4. Update Service Registration

   ```typescript
   // Before
   const notification = new NotificationService()

   // After
   const redis = new RedisService({
     url: process.env.REDIS_URL,
     keyPrefix: 'notifications:',
   })
   const notification = new NotificationService(redis)
   ```


## Advanced Migration Patterns

1. Update Import Statements
   ```typescript
   // Before

// After

````

2. Update Server Constructor

```typescript
// Before
  private readonly redis: Redis

  constructor() {
    this.redis = new Redis()
  }
}

// After
  constructor(private readonly redis: RedisService) {}
}
````

3. Update Session Management

   ```typescript
   // Before
   async storeSession(sessionId: string, data: SessionData): Promise<void> {
     await this.redis.set(
       `session:${sessionId}`,
       JSON.stringify(data)
     )
   }

   // After
   async storeSession(sessionId: string, data: SessionData): Promise<void> {
     try {
       await this.redis.set(
         `session:${sessionId}`,
         JSON.stringify(data),
         1800000 // 30m TTL
       )
     } catch (error) {
       if (error instanceof RedisServiceError) {
         logger.error('Session storage failed:', error)
         throw error
       }
     }
   }
   ```

4. Update Server Initialization

   ```typescript
   // Before
   const wsServer = new WebSocketServer()

   // After
   const redis = new RedisService({
     url: process.env.REDIS_URL,
     keyPrefix: 'ws:',
   })
   const wsServer = new WebSocketServer(redis)
   ```


## Testing the Migration

### Unit Tests

```typescript
describe('Service Migration', () => {
  let redis: RedisService

  beforeEach(() => {
    redis = new RedisService({
      url: 'redis://localhost:6379',
      keyPrefix: 'test:',
    })
  })

  afterEach(async () => {
    await redis.disconnect()
  })

  describe('CacheInvalidationService', () => {
    it('should work with new Redis service', async () => {
      const service = new CacheInvalidationService(redis)
      await service.invalidateKey('test-key')
      expect(await redis.exists('test-key')).toBe(false)
    })
  })

  describe('AnalyticsService', () => {
    it('should track events with new Redis service', async () => {
      const service = new AnalyticsService(redis)
      await service.trackEvent({ type: 'test', data: {} })
      // Verify event storage
    })
  })
})
```

### Integration Tests

```typescript
describe('Service Integration', () => {
  let redis: RedisService
  let analytics: AnalyticsService
  let patternRecognition: PatternRecognitionService

  beforeAll(async () => {
    redis = new RedisService({
      url: process.env.REDIS_URL,
      keyPrefix: 'integration:',
    })
    await redis.connect()

    analytics = new AnalyticsService(redis)
    patternRecognition = new PatternRecognitionService(redis)
  })

  afterAll(async () => {
    await redis.disconnect()
  })

  it('should work together with shared Redis service', async () => {
    // Test interaction between services
    await analytics.trackEvent({ type: 'pattern_detected', data: {} })
    await patternRecognition.processLatestEvents()
    // Verify results
  })
})
```

## Rollback Procedures

If issues are encountered during migration:

1. Keep Old Implementation

   ```typescript
   class CacheInvalidationService {
     private readonly redis: RedisService | ReturnType<typeof createClient>

     constructor(redis?: RedisService) {
       this.redis = redis || createClient()
     }

     async invalidateKey(key: string): Promise<void> {
       if (this.redis instanceof RedisService) {
         // New implementation
         await this.redis.del(key)
       } else {
         // Old implementation
         await this.redis.del(key)
       }
     }
   }
   ```

2. Feature Flags

   ```typescript
   const USE_NEW_REDIS = process.env.USE_NEW_REDIS === 'true'

   const redis = USE_NEW_REDIS ? new RedisService(config) : createClient()
   ```

3. Gradual Rollout
   ```typescript
   const shouldUseNewRedis = (userId: string): boolean => {
     const percentage = process.env.NEW_REDIS_ROLLOUT_PERCENTAGE || '0'
     const hash = createHash('md5').update(userId).digest('hex')
     const userPercentile = (parseInt(hash.substring(0, 2), 16) / 255) * 100
     return userPercentile <= parseInt(percentage, 10)
   }
   ```

## Best Practices

1. Dependency Injection
   - Pass Redis service instance to other services
   - Use interface for better testing
   - Configure service per use case

2. Error Handling
   - Use RedisServiceError for type safety
   - Implement proper logging
   - Add retry logic where appropriate

3. Performance
   - Use appropriate TTLs
   - Implement caching strategies
   - Monitor connection pool

4. Testing
   - Write comprehensive tests
   - Use test containers
   - Implement proper cleanup

## Monitoring Migration

1. Error Tracking

   ```typescript
   const errorMetrics = new RedisErrorMetrics(redis)
   ```

2. Performance Monitoring

   ```typescript
   const stats = await redis.getPoolStats()
   ```

3. Usage Metrics
   ```typescript
   logger.info('Redis operation completed', {
     operation: 'set',
     duration: Date.now() - start,
     service: 'CacheInvalidation',
   })
   ```
