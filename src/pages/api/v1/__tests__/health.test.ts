import { GET } from '../health'

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

// Create Supabase mock
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      limit: vi.fn(() => ({
        maybeSingle: vi.fn(() =>
          Promise.resolve({ data: { status: 'healthy' }, error: null }),
        ),
      })),
    })),
  })),
}

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => mockSupabase),
  }
})

// Mock environment variables
vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'public-key')

// Custom matchers
const customMatchers = {
  toBe: (received: any, expected: any) => {
    const pass = Object.is(received, expected)
    return {
      pass,
      message: () => `expected ${received} to be ${expected}`,
    }
  },
}

expect.extend(customMatchers)

describe('GET /api/v1/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-04-10T12:00:00Z'))
  })

  it('should return healthy status when all services are healthy', async () => {
    const request = new Request('https://example.com/api/v1/health')
    const response = await GET({ request } as any)

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.status).toBe('healthy')
    expect(data.api.status).toBe('healthy')
    expect(data.api.version).toBe('v1')
    expect(data.supabase.status).toBe('healthy')
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
    // Temporarily override supabase mock
    const originalFrom = mockSupabase.from
    mockSupabase.from = vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            Promise.resolve({
              data: null,
              error: { message: 'Database error' },
            }),
          ),
        })),
      })),
    }))

    const request = new Request('https://example.com/api/v1/health')
    const response = await GET({ request } as any)

    // Restore original mock
    mockSupabase.from = originalFrom

    expect(response.status).toBe(503)

    const data = await response.json()
    expect(data.status).toBe('unhealthy')
    expect(data.api.status).toBe('healthy')
    expect(data.supabase.status).toBe('unhealthy')
    expect(data.redis.status).toBe('healthy')
  })

  it('should return unhealthy status when Redis is unhealthy', async () => {
    // Mock Redis error using vi.mocked
    const { getRedisHealth } = await import('../../../../lib/redis')
    vi.mocked(getRedisHealth).mockResolvedValueOnce({
      status: 'unhealthy',
      details: { message: 'Redis error' },
    })

    const request = new Request('https://example.com/api/v1/health')
    const response = await GET({ request } as any)

    expect(response.status).toBe(503)

    const data = await response.json()
    expect(data.status).toBe('unhealthy')
    expect(data.api.status).toBe('healthy')
    expect(data.supabase.status).toBe('healthy')
    expect(data.redis.status).toBe('unhealthy')
  })

  it('should handle missing Supabase credentials', async () => {
    // Store original env values
    const originalUrl = process.env.PUBLIC_SUPABASE_URL
    const originalKey = process.env.PUBLIC_SUPABASE_ANON_KEY

    // Clear environment variables
    vi.stubEnv('PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', '')

    const request = new Request('https://example.com/api/v1/health')
    const response = await GET({ request } as any)

    // Restore env values
    vi.stubEnv('PUBLIC_SUPABASE_URL', originalUrl || '')
    vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', originalKey || '')

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.status).toBe('healthy') // Overall healthy since Redis is OK
    expect(data.api.status).toBe('healthy')
    expect(data.supabase.status).toBe('unknown')
    expect(data.supabase.message).toBe('No credentials available')
  })
})
