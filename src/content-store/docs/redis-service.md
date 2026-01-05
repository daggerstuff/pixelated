---
title: 'Redis Service'
description: 'Core Redis service implementation details and usage examples'
pubDate: 2025-03-25
share: true
toc: true
lastModDate: 2025-03-25
tags: ['redis', 'service', 'implementation']
author: 'Pixelated Team'
---

## Redis Service Documentation

### Overview

The Redis service provides a robust, type-safe interface for interacting with Redis
in the Pixelated application. It includes connection pooling, automatic reconnection,
health monitoring, and comprehensive error handling.

### Installation

```bash
pnpm add ioredis
```

### Configuration

The Redis service can be configured using the `RedisServiceConfig` interface:

```typescript
interface RedisServiceConfig {
  url: string // Redis connection URL
  keyPrefix?: string // Prefix for all keys
  maxRetries?: number // Maximum number of retries for operations
  retryDelay?: number // Retry delay in milliseconds
  connectTimeout?: number // Connection timeout in milliseconds
  maxConnections?: number // Maximum number of connections in the pool
  minConnections?: number // Minimum number of connections to keep in the pool
  healthCheckInterval?: number // Health check interval in milliseconds
}
```

### Default Configuration

```typescript
const defaultConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  connectTimeout: 5000,
  maxConnections: 10,
  minConnections: 2,
  healthCheckInterval: 30000,
}
```

### Basic Usage

#### Initialization

```typescript

const redis = new RedisService({
  url: 'redis://localhost:6379',
})

await redis.connect()
```

#### Key-Value Operations

```typescript
// Set a value
await redis.set('user:123', JSON.stringify({ name: 'John' }))

// Set with TTL (1 hour)
await redis.set('session:123', 'session-data', 3600000)

// Get a value
const user = JSON.parse(await redis.get('user:123'))

// Delete a key
await redis.del('user:123')

// Check if a key exists
const exists = await redis.exists('user:123')

// Get TTL in milliseconds
const ttl = await redis.ttl('session:123')
```

#### Set Operations

```typescript
// Add to a set
await redis.sadd('users:active', 'user:123')

// Remove from a set
await redis.srem('users:active', 'user:123')

// Get all set members
const activeUsers = await redis.smembers('users:active')
```

#### Counter Operations

```typescript
// Increment a counter
const newValue = await redis.incr('visits:counter')
```

#### Health Checks

```typescript
// Check Redis health
const isHealthy = await redis.isHealthy()

// Get connection pool statistics
const stats = await redis.getPoolStats()
```

### Error Handling

The service uses a custom `RedisServiceError` class with specific error codes:

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

Example error handling:

```typescript
try {
  await redis.set('key', 'value')
} catch (error) {
  if (error instanceof RedisServiceError) {
    switch (error.code) {
      case RedisErrorCode.CONNECTION_FAILED:
        // Handle connection failure
        break
      case RedisErrorCode.OPERATION_FAILED:
        // Handle operation failure
        break
      // ... handle other error codes
    }
  }
}
```

### Best Practices

1. Connection Management
   - Always call `connect()` before using the service
   - Call `disconnect()` when shutting down the application
   - Use the health check mechanism to monitor connection status

2. Error Handling
   - Catch and handle `RedisServiceError` specifically
   - Log errors with appropriate context
   - Implement retry logic for transient failures

3. Performance Optimization
   - Use appropriate TTLs for cached data
   - Batch operations when possible
   - Monitor connection pool statistics

4. Security
   - Use environment variables for Redis URL
   - Implement proper access controls
   - Sanitize data before storage

### Environment Variables

Required environment variables:

```bash
REDIS_URL=redis://localhost:6379
```

Optional environment variables:

```bash
REDIS_KEY_PREFIX="pixelated:"
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=1000
REDIS_CONNECT_TIMEOUT=5000
REDIS_MAX_CONNECTIONS=10
REDIS_MIN_CONNECTIONS=2
REDIS_HEALTH_CHECK_INTERVAL=30000
```

## Integration with Other Services

### Cache Invalidation

```typescript

const redis = new RedisService({ url: process.env.REDIS_URL })
const cacheInvalidation = new CacheInvalidationService(redis)
```

### Analytics Service

```typescript

const redis = new RedisService({ url: process.env.REDIS_URL })
const analytics = new AnalyticsService(redis)
```

### Pattern Recognition Service

```typescript

const redis = new RedisService({ url: process.env.REDIS_URL })
const patternRecognition = new PatternRecognitionService(redis)
```

## Testing

The service includes comprehensive test suites:

1. Unit Tests

   ```bash
   pnpm test src/lib/services/redis/__tests__/RedisService.test.ts
   ```

2. Integration Tests

   ```bash
   pnpm test src/lib/services/redis/__tests__/RedisService.integration.test.ts
   ```

3. Performance Tests
   ```bash
   pnpm test src/lib/services/redis/__tests__/RedisService.perf.test.ts
   ```

## Monitoring and Metrics

The service provides built-in monitoring capabilities through the `getPoolStats()` method:

```typescript
const stats = await redis.getPoolStats()
console.log({
  totalConnections: stats.totalConnections,
  activeConnections: stats.activeConnections,
  idleConnections: stats.idleConnections,
  waitingClients: stats.waitingClients,
})
```

## Troubleshooting

Common issues and solutions:

1. Connection Failures
   - Check Redis URL configuration
   - Verify network connectivity
   - Check Redis server status
   - Review connection pool settings

2. Performance Issues
   - Monitor connection pool statistics
   - Check for connection leaks
   - Review operation patterns
   - Consider Redis configuration

3. Memory Issues
   - Implement proper TTLs
   - Monitor Redis memory usage
   - Review key patterns and data size
   - Consider Redis persistence settings
