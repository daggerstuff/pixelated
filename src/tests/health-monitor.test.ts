import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HealthMonitor } from '../lib/services/health-monitor'

describe('HealthMonitor', () => {
  let healthMonitor: HealthMonitor

  beforeEach(() => {
    healthMonitor = new HealthMonitor()
  })

  it('should create a health monitor instance', () => {
    expect(healthMonitor).toBeDefined()
    expect(healthMonitor).toBeInstanceOf(HealthMonitor)
  })

  it('should return system health information', async () => {
    const health = await healthMonitor.getHealth()
    
    expect(health).toBeDefined()
    expect(health.status).toMatch(/^(healthy|degraded|unhealthy)$/)
    expect(health.timestamp).toBeDefined()
    expect(health.uptime).toBeGreaterThan(0)
    expect(health.responseTime).toBeGreaterThan(0)
    expect(Array.isArray(health.checks)).toBe(true)
    expect(health.system).toBeDefined()
    expect(health.system.memory).toBeDefined()
    expect(health.system.cpu).toBeDefined()
  })

  it('should register and run custom health checks', async () => {
    const customCheck = vi.fn().mockResolvedValue({
      name: 'custom-service',
      status: 'healthy' as const,
      responseTime: 10,
      message: 'Custom service is running'
    })

    healthMonitor.registerCheck('custom-service', customCheck)
    
    const health = await healthMonitor.getHealth()
    
    expect(customCheck).toHaveBeenCalled()
    expect(health.checks.some(check => check.name === 'custom-service')).toBe(true)
  })

  it('should handle failing health checks gracefully', async () => {
    const failingCheck = vi.fn().mockRejectedValue(new Error('Service unavailable'))

    healthMonitor.registerCheck('failing-service', failingCheck)
    
    const health = await healthMonitor.getHealth()
    
    expect(health.checks.some(check => 
      check.name === 'failing-service' && check.status === 'unhealthy'
    )).toBe(true)
  })
})
