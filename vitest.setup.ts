/**
 * This file is loaded before all tests across the entire project
 */
import '@testing-library/jest-dom/vitest'
import './src/test/setup-react19'

// MSW setup disabled due to import resolution issues with Vite
// Tests should run fine without MSW as they have comprehensive mocking

// Global test environment setup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()
})

// Mock environment variables for tests
vi.mock('astro:env/server', () => ({
  REDIS_URL:
    process.env['REDIS_URL'] ||
    'rediss://default:AS3JAAIjcDFlOGQ0YWIzOGYxYmU0MDU3YTlmZGFmYjI1NjQ1OGUwZHAxMA@neutral-ray-11721.upstash.io:6379',
  UPSTASH_REDIS_REST_URL:
    process.env['UPSTASH_REDIS_REST_URL'] ||
    'https://neutral-ray-11721.upstash.io',
  UPSTASH_REDIS_REST_TOKEN:
    process.env['UPSTASH_REDIS_REST_TOKEN'] ||
    'AS3JAAIjcDFlOGQ0YWIzOGYxYmU0MDU3YTlmZGFmYjI1NjQ1OGUwZHAxMA',
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env['DATABASE_URL'] || 'mongodb://localhost:27017/pixelated_test',
  MONGODB_URI:
    process.env['MONGODB_URI'] || 'mongodb://localhost:27017/pixelated_test',
}))

// Mock Redis service for tests that don't need real Redis
vi.mock('@/lib/services/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    flushall: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    subscribe: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(1),
    hget: vi.fn().mockResolvedValue(null),
    hset: vi.fn().mockResolvedValue(1),
    hdel: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue({}),
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    zadd: vi.fn().mockResolvedValue(1),
    zrem: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
    incr: vi.fn().mockResolvedValue(1),
    decr: vi.fn().mockResolvedValue(0),
    ttl: vi.fn().mockResolvedValue(-1),
    deletePattern: vi.fn().mockResolvedValue(undefined),
    isHealthy: vi.fn().mockResolvedValue(true),
    connect: vi.fn().mockResolvedValue(undefined),
    getPoolStats: vi.fn().mockResolvedValue({
      totalConnections: 1,
      activeConnections: 1,
      idleConnections: 0,
      waitingClients: 0,
    }),
  },
  RedisService: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    flushall: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    isConnected: vi.fn().mockReturnValue(true),
    connect: vi.fn().mockResolvedValue(undefined),
    ttl: vi.fn().mockResolvedValue(-1),
    incr: vi.fn().mockResolvedValue(1),
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    deletePattern: vi.fn().mockResolvedValue(undefined),
    isHealthy: vi.fn().mockResolvedValue(true),
    subscribe: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(1),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    getPoolStats: vi.fn().mockResolvedValue({
      totalConnections: 1,
      activeConnections: 1,
      idleConnections: 0,
      waitingClients: 0,
    }),
  })),
}))

// Also mock the RedisService class directly for tests that import it
vi.mock('@/lib/services/redis/RedisService', () => ({
  RedisService: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    flushall: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    isConnected: vi.fn().mockReturnValue(true),
    connect: vi.fn().mockResolvedValue(undefined),
    ttl: vi.fn().mockResolvedValue(-1),
    incr: vi.fn().mockResolvedValue(1),
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    deletePattern: vi.fn().mockResolvedValue(undefined),
    isHealthy: vi.fn().mockResolvedValue(true),
    subscribe: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(1),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    getPoolStats: vi.fn().mockResolvedValue({
      totalConnections: 1,
      activeConnections: 1,
      idleConnections: 0,
      waitingClients: 0,
    }),
    // Redis queue methods for testing
    lpush: vi.fn().mockResolvedValue(1),
    rpoplpush: vi.fn().mockResolvedValue('test-value'),
    lrem: vi.fn().mockResolvedValue(1),
    llen: vi.fn().mockResolvedValue(0),
    lrange: vi.fn().mockResolvedValue([]),
    brpop: vi.fn().mockResolvedValue(['queue', 'value']),
  })),
}))

// Also mock relative imports for tests in subdirectories
vi.mock('../RedisService', () => ({
  RedisService: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    flushall: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    isConnected: vi.fn().mockReturnValue(true),
    connect: vi.fn().mockResolvedValue(undefined),
    ttl: vi.fn().mockResolvedValue(-1),
    incr: vi.fn().mockResolvedValue(1),
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    deletePattern: vi.fn().mockResolvedValue(undefined),
    isHealthy: vi.fn().mockResolvedValue(true),
    subscribe: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(1),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    getPoolStats: vi.fn().mockResolvedValue({
      totalConnections: 1,
      activeConnections: 1,
      idleConnections: 0,
      waitingClients: 0,
    }),
    // Redis queue methods for testing
    lpush: vi.fn().mockResolvedValue(1),
    rpoplpush: vi.fn().mockResolvedValue('test-value'),
    lrem: vi.fn().mockResolvedValue(1),
    llen: vi.fn().mockResolvedValue(0),
    lrange: vi.fn().mockResolvedValue([]),
    brpop: vi.fn().mockResolvedValue(['queue', 'value']),
  })),
}))

// Mock audit logging for security tests
vi.mock('@/lib/security/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  AuditEventType: {
    DLP_ALLOWED: 'DLP_ALLOWED',
    DLP_BLOCKED: 'DLP_BLOCKED',
    DLP_REDACTED: 'DLP_REDACTED',
  },
}))

// Mock crypto for FHE tests
vi.mock('@/lib/fhe/crypto', () => ({
  fhe: {
    encrypt: vi.fn().mockReturnValue('encrypted_data'),
    decrypt: vi.fn().mockReturnValue('decrypted_data'),
    verifySender: vi.fn().mockReturnValue(true),
  },
}))

// Mock Astro runtime
vi.mock('astro/runtime/server/index.js', () => ({
  createAstro: () => ({
    props: {},
    request: new Request('http://localhost:3000'),
    params: {},
    url: new URL('http://localhost:3000'),
  }),
}))

// Polyfill for Node.js globals in test environment
globalThis.Request = globalThis.Request || Request
globalThis.Response = globalThis.Response || Response
globalThis.Headers = globalThis.Headers || Headers
globalThis.fetch = globalThis.fetch || fetch

// Setup garbage collection for memory management in tests
declare const global: { gc?: () => void }

if (process.env['CI'] && global.gc) {
  afterEach(() => {
    // Force garbage collection after memory-intensive tests
    global.gc?.()
  })
}

export {}
