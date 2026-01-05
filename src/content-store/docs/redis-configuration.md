---
title: 'Redis Configuration'
description: 'Detailed guide to configuring Redis for Pixelated Healths caching and queue system'
pubDate: 2025-03-25
share: true
toc: true
lastModDate: 2025-03-25
tags: ['redis', 'configuration', 'caching']
author: 'Pixelated Team'
---

## Redis Configuration Guide

### Overview

This guide provides detailed information about configuring the Redis service for optimal
performance and reliability in the Pixelated application.

### Basic Configuration

1. Set up environment variables in your `.env` file:
   ```bash
   REDIS_URL=redis://localhost:6379
   REDIS_KEY_PREFIX=pixelated
   ```

2. Create a configuration object:

   ```typescript

   const config: RedisServiceConfig = {
     url: process.env.REDIS_URL,
     keyPrefix: process.env.REDIS_KEY_PREFIX,
   }
   ```

3. Initialize the service:

   ```typescript

   const redis = new RedisService(config)
   await redis.connect()
   ```


## Configuration Options

### Connection Settings

| Option           | Description                | Default   | Recommended |
| ---------------- | -------------------------- | --------- | ----------- |
| `url`            | Redis connection URL       | Required  | -           |
| `keyPrefix`      | Prefix for all keys        | undefined | `"app:"`    |
| `maxRetries`     | Maximum retry attempts     | 3         | 3-5         |
| `retryDelay`     | Delay between retries (ms) | 1000      | 1000-5000   |
| `connectTimeout` | Connection timeout (ms)    | 5000      | 5000-10000  |

### Connection Pool Settings

| Option                | Description                | Default | Recommended |
| --------------------- | -------------------------- | ------- | ----------- |
| `maxConnections`      | Maximum connections        | 10      | 10-50       |
| `minConnections`      | Minimum connections        | 2       | 2-5         |
| `healthCheckInterval` | Health check interval (ms) | 30000   | 30000-60000 |

## Environment-Specific Configurations

### Development

```typescript
const devConfig: RedisServiceConfig = {
  url: 'redis://localhost:6379',
  keyPrefix: 'dev:',
  maxRetries: 3,
  retryDelay: 1000,
  connectTimeout: 5000,
  maxConnections: 10,
  minConnections: 2,
  healthCheckInterval: 30000,
}
```

### Production

```typescript
const prodConfig: RedisServiceConfig = {
  url: process.env.REDIS_URL,
  keyPrefix: 'prod:',
  maxRetries: 5,
  retryDelay: 2000,
  connectTimeout: 10000,
  maxConnections: 50,
  minConnections: 5,
  healthCheckInterval: 30000,
}
```

### Testing

```typescript
const testConfig: RedisServiceConfig = {
  url: 'redis://localhost:6379',
  keyPrefix: 'test:',
  maxRetries: 1,
  retryDelay: 100,
  connectTimeout: 1000,
  maxConnections: 5,
  minConnections: 1,
  healthCheckInterval: 5000,
}
```

## Performance Tuning

### Connection Pool Sizing

The connection pool size should be configured based on your application's needs:

```typescript
const config: RedisServiceConfig = {
  // ... other options
  maxConnections: Math.max(10, Math.ceil(os.cpus().length * 2)),
  minConnections: Math.max(2, Math.ceil(os.cpus().length / 2)),
}
```

### Health Check Configuration

Adjust health check frequency based on your reliability requirements:

```typescript
const config: RedisServiceConfig = {
  // ... other options
  healthCheckInterval:
    process.env.NODE_ENV === 'production'
      ? 30000 // 30 seconds in production
      : 60000, // 1 minute in development
}
```
