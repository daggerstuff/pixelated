import { GET } from '../health'
import type { APIContext } from 'astro'

// Mock dependencies first to avoid hoisting issues
vi.mock('node:os', () => ({
  totalmem: vi.fn(() => 16000000000), // 16GB
  freemem: vi.fn(() => 8000000000), // 8GB
  cpus: vi.fn(() => Array(8).fill({ model: 'Intel(R) Core(TM) i7-10700K' })),
  loadavg: vi.fn(() => [1.5, 1.2, 0.9]),
  platform: vi.fn(() => 'linux'),
  release: vi.fn(() => '5.10.0-15-amd64'),
  uptime: vi.fn(() => 86400), // 1 day
}))

// Mock process with current Node version to avoid version mismatch errors
const nodeVersionMock = process.version
vi.mock('node:process', () => ({
  version: nodeVersionMock, // Use actual running Node.js version
  memoryUsage: vi.fn(() => ({
    rss: 200000000,
    heapTotal: 100000000,
    heapUsed: 80000000,
    external: 10000000,
  })),
  uptime: vi.fn(() => 86400), // 1 day
}))

// Mock Redis - define inline to avoid hoisting issues
vi.mock('../../../../lib/redis', () => ({
  getRedisHealth: vi.fn(() => Promise.resolve({ status: 'healthy' })),
}))

// Mock MongoDB connection - replacing Supabase
vi.mock('@/config/mongodb.config', () => ({
  default: {
    connect: vi.fn(() =>
      Promise.resolve({
        collection: vi.fn(() => ({
          findOne: vi.fn(() => Promise.resolve({ status: 'healthy' })),
        })),
      }),
    ),
  },
}))

// Mock environment variables for MongoDB (replacing Supabase)
vi.stubEnv('MONGO_URI', 'mongodb://localhost:27017')
vi.stubEnv('MONGO_DB_NAME', 'test-db')

// Custom matchers with proper types
const customMatchers = {
  toBe: (received: unknown, expected: unknown) => {
    const pass = Object.is(received, expected)
    return {
      pass,
      message: () => `expected ${received} to be ${expected}`,
    }
  },
}

expect.extend(customMatchers)

// Helper to create mock API context
function createMockAPIContext(request: Request): APIContext {
  return { request } as APIContext
}

describe('GET /api/v1/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-04-10T12:00:00Z'))
  })

  it('should return healthy status when all services are healthy', async () => {
    const request = new Request('https://example.com/api/v1/health')
    const response = await GET(createMockAPIContext(request))

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.status).toBe('healthy')
    expect(data.api.status).toBe('healthy')
    expect(data.api.version).toBe('v1')
    expect(data.mongodb.status).toBe('healthy') // Changed from supabase to mongodb
    expect(data.redis.status).toBe('healthy')

    // Check system information
    expect(data.system).toBeDefined()
    expect(data.system.memory).toBeDefined()
    expect(data.system.memory.usagePercent).toBe(50) // 8GB / 16GB = 50%
    expect(data.system.cpu).toBeDefined()
    expect(data.system.cpu.cores).toBe(8)
    expect(data.system.os).toBeDefined()
    expect(data.system.os.platform).toBe('linux')
    expect(data.system.runtime).toBeDefined()

    // Use the actual Node.js version, not a hardcoded value
    expect(data.system.runtime.nodeVersion).toBe(nodeVersionMock)
  })

  it('should return unhealthy status when database is unhealthy', async () => {
    // Mock MongoDB connection failure instead of Supabase
    vi.doMock('@/config/mongodb.config', () => ({
      default: {
        connect: vi.fn(() =>
          Promise.reject(new Error('MongoDB connection failed')),
        ),
      },
    }))

    const request = new Request('https://example.com/api/v1/health')
    const response = await GET(createMockAPIContext(request))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.status).toBe('unhealthy')
    expect(data.mongodb.status).toBe('unhealthy') // Changed from supabase to mongodb
  })

  it('should handle missing environment variables', async () => {
    // Clear MongoDB environment variables
    vi.unstubAllEnvs()

    const request = new Request('https://example.com/api/v1/health')
    const response = await GET(createMockAPIContext(request))

    const data = await response.json()
    expect(data.mongodb.status).toBe('unhealthy') // Changed from supabase to mongodb
    expect(data.mongodb.message).toBe('MongoDB credentials not configured')
  })
})
