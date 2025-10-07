import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../health'

// Mock the health monitor
vi.mock('../../../lib/services/health-monitor', () => ({
  healthMonitor: {
    getHealth: vi.fn()
  }
}))

describe('GET /api/v1/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return healthy status when all systems are operational', async () => {
    const { healthMonitor } = await import('../../../lib/services/health-monitor')
    
    vi.mocked(healthMonitor.getHealth).mockResolvedValue({
      status: 'healthy',
      timestamp: '2025-08-16T20:00:00.000Z',
      uptime: 86400,
      responseTime: 50,
      checks: [
        { name: 'system', status: 'healthy', responseTime: 10, message: 'System operating normally' },
        { name: 'memory', status: 'healthy', responseTime: 5, message: 'Memory usage normal' },
        { name: 'disk', status: 'healthy', responseTime: 8, message: 'Disk usage normal' }
      ],
      system: {
        memory: { total: 16000000000, free: 8000000000, used: 8000000000, usagePercent: 50 },
        cpu: { cores: 8, loadAverage: [1.5, 1.2, 0.9], model: 'Intel Core i7' },
        platform: 'linux',
        nodeVersion: 'v18.0.0'
      }
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('healthy')
    expect(data.checks).toHaveLength(3)
    expect(data.system).toBeDefined()
  })

  it('should return degraded status when some systems have issues', async () => {
    const { healthMonitor } = await import('../../../lib/services/health-monitor')
    
    vi.mocked(healthMonitor.getHealth).mockResolvedValue({
      status: 'degraded',
      timestamp: '2025-08-16T20:00:00.000Z',
      uptime: 86400,
      responseTime: 150,
      checks: [
        { name: 'system', status: 'healthy', responseTime: 10, message: 'System operating normally' },
        { name: 'memory', status: 'degraded', responseTime: 5, message: 'High memory usage' },
        { name: 'disk', status: 'healthy', responseTime: 8, message: 'Disk usage normal' }
      ],
      system: {
        memory: { total: 16000000000, free: 1000000000, used: 15000000000, usagePercent: 94 },
        cpu: { cores: 8, loadAverage: [3.5, 3.2, 2.9], model: 'Intel Core i7' },
        platform: 'linux',
        nodeVersion: 'v18.0.0'
      }
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200) // Still 200 for degraded
    expect(data.status).toBe('degraded')
    expect(data.checks.some(c => c.status === 'degraded')).toBe(true)
  })

  it('should return unhealthy status when critical systems fail', async () => {
    const { healthMonitor } = await import('../../../lib/services/health-monitor')
    
    vi.mocked(healthMonitor.getHealth).mockResolvedValue({
      status: 'unhealthy',
      timestamp: '2025-08-16T20:00:00.000Z',
      uptime: 86400,
      responseTime: 500,
      checks: [
        { name: 'system', status: 'unhealthy', responseTime: 10, message: 'System overloaded' },
        { name: 'memory', status: 'unhealthy', responseTime: 5, message: 'Critical memory usage' },
        { name: 'disk', status: 'healthy', responseTime: 8, message: 'Disk usage normal' }
      ],
      system: {
        memory: { total: 16000000000, free: 100000000, used: 15900000000, usagePercent: 99 },
        cpu: { cores: 8, loadAverage: [8.5, 8.2, 7.9], model: 'Intel Core i7' },
        platform: 'linux',
        nodeVersion: 'v18.0.0'
      }
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503) // Service unavailable for unhealthy
    expect(data.status).toBe('unhealthy')
    expect(data.checks.some(c => c.status === 'unhealthy')).toBe(true)
  })

  it('should handle health monitor errors gracefully', async () => {
    const { healthMonitor } = await import('../../../lib/services/health-monitor')
    
    vi.mocked(healthMonitor.getHealth).mockRejectedValue(new Error('Health monitor failed'))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.status).toBe('unhealthy')
    expect(data.error).toBe('Health monitor failed')
  })
})
