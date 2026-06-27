import { describe, it, expect, vi, beforeEach } from 'vitest'

import { GET } from '../clinical-validity'

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const mockProcess = {
      stdout: {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            // Simulate benchmark output
            setTimeout(
              () =>
                callback(
                  JSON.stringify({
                    scorer_version: '3.0.0',
                    total_sample_count: 691,
                    scored_sample_count: 133,
                    missing_transcript_count: 1,
                    csv_checksums: {},
                    overall: {
                      pearson_correlation: 0.078,
                      spearman_correlation: 0.0397,
                      mae: 0.75,
                    },
                    per_dimension: {
                      technique: { pearson: 0.4273 },
                      alliance: { pearson: 0.6532 },
                      structure: { pearson: 0.3809 },
                      cultural: { pearson: 0.0 },
                      ebp: { pearson: 0.8546 },
                      dsm5: { pearson: 0.5 },
                    },
                    per_channel: {},
                  }),
                ),
              0,
            )
          }
        }),
      },
      stderr: { on: vi.fn() },
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10)
        }
        return mockProcess
      }),
    }
    return mockProcess
  }),
}))

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(() => Promise.reject(new Error('File not found'))),
}))

// Mock fetch for annotation API
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ pending: 15 }),
  } as Response),
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

  it('handles errors gracefully and returns 500', async () => {
    // Mock spawn to fail (simulate benchmark failure)
    const { spawn } = await import('child_process')
    vi.mocked(spawn).mockImplementationOnce(() => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(1), 10) // Non-zero exit code
          }
          return mockProcess
        }),
      }
      return mockProcess as any
    })

    const url = new URL('http://localhost/api/dashboard/clinical-validity')
    const request = new Request(url.toString())
    const response = await GET({ url: url } as any)
    const data = await response.json()

    expect(response.status).toBe(500) // Returns 500 when scorer fails
    expect(data.error).toBeDefined()
  })
})
