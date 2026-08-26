import { describe, it, expect } from 'vitest'
import { getAIUsageStats } from './analytics'

describe('getAIUsageStats', () => {
  it('should return default stats when no options are provided', async () => {
    const stats = await getAIUsageStats()
    expect(stats).toEqual({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      period: 'day'
    })
  })

  it('should return stats with provided period', async () => {
    const stats = await getAIUsageStats({ period: 'week' })
    expect(stats.period).toBe('week')
  })
})
