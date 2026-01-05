import { RedisService } from './RedisService'
import type {
  RedisServiceConfig,
  IRedisService,
  RedisErrorCode,
  RedisServiceError,
} from './types'
import { getEnv } from '@/lib/utils/env'

// Export the main service class and types
export { RedisService }
export type {
  RedisServiceConfig,
  IRedisService,
  RedisErrorCode,
  RedisServiceError,
}

// Environment variable resolution logic using utility function
const redisUrl =
  getEnv('UPSTASH_REDIS_REST_URL') ||
  getEnv('REDIS_URL') ||
  'redis://localhost:6379'
const redisPrefix = getEnv('REDIS_PREFIX') || ''

const config: RedisServiceConfig = {
  url: redisUrl,
  keyPrefix: redisPrefix,
  maxRetries: 3, // Add other default config values if needed
  retryDelay: 1000,
  connectTimeout: 5000,
  // Add other necessary config fields from RedisServiceConfig
}

// Export a configured singleton instance
export const redis = new RedisService(config)

// Optionally, connect the singleton immediately if desired
// (consider application lifecycle implications)
// redis.connect().catch(error => {
//   console.error("Failed to connect singleton redis instance:", error);
// });
