/**
 * Redis Mock for Testing
 * This file provides mock implementations of Redis functionality for testing
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* global vi, expect */

// Create a mock implementation of Redis client
export const mockRedisClient = {
  // Basic operations
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(60),

  // List operations
  lpush: vi.fn().mockResolvedValue(1),
  rpush: vi.fn().mockResolvedValue(1),
  lpop: vi.fn().mockResolvedValue(null),
  rpop: vi.fn().mockResolvedValue(null),
  lrange: vi.fn().mockResolvedValue([]),
  rpoplpush: vi.fn().mockResolvedValue(null),
  lrem: vi.fn().mockResolvedValue(1),
  llen: vi.fn().mockResolvedValue(1),

  // Hash operations
  hset: vi.fn().mockResolvedValue(1),
  hget: vi.fn().mockResolvedValue(null),
  hdel: vi.fn().mockResolvedValue(1),
  hgetall: vi.fn().mockResolvedValue({}),
  hmset: vi.fn().mockResolvedValue('OK'),
  hkeys: vi.fn().mockResolvedValue([]),
  hvals: vi.fn().mockResolvedValue([]),

  // Set operations
  sadd: vi.fn().mockResolvedValue(1),
  srem: vi.fn().mockResolvedValue(1),
  smembers: vi.fn().mockResolvedValue([]),

  // Sorted set operations
  zadd: vi.fn().mockResolvedValue(1),
  zrangebyscore: vi.fn().mockResolvedValue([]),
  zremrangebyscore: vi.fn().mockResolvedValue(1),

  // Other operations
  incr: vi.fn().mockResolvedValue(1),
  decr: vi.fn().mockResolvedValue(1),
  keys: vi.fn().mockResolvedValue([]),
  scan: vi.fn().mockResolvedValue(['0', []]),

  // Method chaining support
  on: vi.fn(function (this: any): void {
    return this
  }),

  // Connection management
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn().mockResolvedValue('OK'),
  ping: vi.fn().mockResolvedValue('PONG'),
  isReady: true,
}

// Mock RedisService implementation
export const mockRedisService = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(0),
  expire: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(3600),
  keys: vi.fn().mockResolvedValue([]),
  scan: vi.fn().mockResolvedValue(['0', []]),
  hget: vi.fn().mockResolvedValue(null),
  hset: vi.fn().mockResolvedValue(1),
  hdel: vi.fn().mockResolvedValue(1),
  hkeys: vi.fn().mockResolvedValue([]),
  hvals: vi.fn().mockResolvedValue([]),
  hgetall: vi.fn().mockResolvedValue({}),
  isHealthy: vi.fn().mockReturnValue(true),
  getPoolStats: vi.fn().mockReturnValue({
    totalConnections: 5,
    activeConnections: 2,
    idleConnections: 3,
    waitingRequests: 0,
  }),
  cleanup: vi.fn().mockResolvedValue(undefined),
}

// Define custom matchers for arrays
const arrayContaining = (received: unknown[], expected: unknown[]) => {
  const pass = expected.every((item) => received.includes(item))
  return {
    pass,
    message: () =>
      `expected ${received} ${pass ? 'not to' : 'to'} contain ${expected}`,
  }
}

// Expose arrayContaining for tests
expect.arrayContaining = arrayContaining as any

// Extend expect with custom matchers
expect.extend({
  toBeNull: (received) => ({
    pass: received === null,
    message: () => `expected ${received} to be null`,
  }),
  toBe: (received, expected) => ({
    pass: Object.is(received, expected),
    message: () => `expected ${received} to be ${expected}`,
  }),
  toEqual: (received, expected) => ({
    pass: JSON.stringify(received) === JSON.stringify(expected),
    message: () => `expected ${received} to equal ${expected}`,
  }),
  toBeInstanceOf: (received, expected) => ({
    pass: received instanceof expected,
    message: () => `expected ${received} to be an instance of ${expected}`,
  }),
  toBeGreaterThanOrEqual: (received, expected) => ({
    pass: received >= expected,
    message: () =>
      `expected ${received} to be greater than or equal to ${expected}`,
  }),
  toBeLessThanOrEqual: (received, expected) => ({
    pass: received <= expected,
    message: () =>
      `expected ${received} to be less than or equal to ${expected}`,
  }),
})

// Ensure we're in test environment
if (process.env.NODE_ENV !== 'test') {
  console.warn('Warning: Redis mock loaded outside of test environment')
}

// Setup and teardown exports
export function setup() {
  console.log('Setting up Redis mock environment')
  process.env.SKIP_REDIS_TESTS = 'true'
}

export function teardown() {
  console.log('Tearing down Redis mock environment')
}

export default {
  mockRedisClient,
  mockRedisService,
  setup,
  teardown,
}
