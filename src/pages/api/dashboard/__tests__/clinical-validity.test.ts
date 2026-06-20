import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../clinical-validity'

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event, callback) => {
      if (event === 'close') {
        setTimeout(() => callback(0), 0)
      }
      return this
    }),
  })),
}))

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(() => Promise.resolve(JSON.stringify({
    overall: { pass_rate: 0.75 },
    per_dimension_breakdown: {
      technique: 0.85,
      alliance: 0.78,
      structure: 0.82,
      cultural: 0.65,
      ebp: 0.71,
      dsm5: 0.58
    },
    historical_trend: [
      { date: '2026-06-13', passRate: 0.68, queueDepth: 12 },
      { date: '2026-06-14', passRate: 0.70, queueDepth: 13 }
    ]
  }))),
}))

// Mock fetch for annotation API
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ pending: 15 }),
  } as Response)
)

describe('Clinical Validity API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns mock data when mock=true parameter is provided', async () => {
    const url = new URL('http://localhost/api/dashboard/clinical-validity')
    url.searchParams.set('mock', 'true')

    const request = new Request(url.toString())
    const response = await GET({ url: url } as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.passRate).toBe(0.72)
    expect(data.scoreDistribution).toHaveProperty('technique')
    expect(data.scoreDistribution).toHaveProperty('alliance')
    expect(data.scoreDistribution).toHaveProperty('structure')
    expect(data.scoreDistribution).toHaveProperty('cultural')
    expect(data.scoreDistribution).toHaveProperty('ebp')
    expect(data.scoreDistribution).toHaveProperty('dsm5')
    expect(data.queueDepth).toBe(14)
    expect(data.weeklyTrend).toHaveLength(7)
    expect(data.metadata.dataSource).toBe('mock')
  })

  it('returns valid JSON structure', async () => {
    const url = new URL('http://localhost/api/dashboard/clinical-validity')
    
    const request = new Request(url.toString())
    const response = await GET({ url: url } as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/json')
    
    // Check required fields
    expect(typeof data.passRate).toBe('number')
    expect(data.passRate).toBeGreaterThanOrEqual(0)
    expect(data.passRate).toBeLessThanOrEqual(1)
    
    expect(typeof data.scoreDistribution).toBe('object')
    expect(Object.keys(data.scoreDistribution)).toContain('technique')
    expect(Object.keys(data.scoreDistribution)).toContain('alliance')
    expect(Object.keys(data.scoreDistribution)).toContain('structure')
    expect(Object.keys(data.scoreDistribution)).toContain('cultural')
    expect(Object.keys(data.scoreDistribution)).toContain('ebp')
    expect(Object.keys(data.scoreDistribution)).toContain('dsm5')
    
    expect(typeof data.queueDepth).toBe('number')
    expect(data.queueDepth).toBeGreaterThanOrEqual(0)
    
    expect(Array.isArray(data.weeklyTrend)).toBe(true)
    
    expect(typeof data.metadata).toBe('object')
    expect(typeof data.metadata.generatedAt).toBe('string')
    expect(typeof data.metadata.dataSource).toBe('string')
  })

  it('handles errors gracefully and returns mock data', async () => {
    // Mock fetch to fail
    ;(global.fetch as any).mockImplementationOnce(() =>
      Promise.reject(new Error('Network error'))
    )

    const url = new URL('http://localhost/api/dashboard/clinical-validity')
    const request = new Request(url.toString())
    const response = await GET({ url: url } as any)
    const data = await response.json()

    expect(response.status).toBe(200) // Still returns 200 with mock data
    expect(data.passRate).toBeDefined()
    expect(data.metadata.error).toBeDefined()
  })
})
