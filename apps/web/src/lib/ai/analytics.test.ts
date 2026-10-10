import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUsageStats: vi.fn(),
}))

vi.mock('../db/ai/repository', () => ({
  aiRepository: {
    getUsageStats: mocks.getUsageStats,
  },
}))

import { getAIUsageStats } from './analytics'

const BASE_STATS = {
  totalRequests: 10,
  successfulRequests: 8,
  failedRequests: 2,
  averageResponseTime: 420.5,
}

describe('getAIUsageStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('queries the repository and returns aggregated stats with a default period', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))

    mocks.getUsageStats.mockResolvedValue(BASE_STATS)

    const stats = await getAIUsageStats()

    expect(stats).toEqual({ ...BASE_STATS, period: 'day' })
    const [call] = mocks.getUsageStats.mock.calls
    expect(call[0].userId).toBeUndefined()
    expect(call[0].since).toEqual(new Date('2026-01-14T12:00:00Z'))
    expect(call[0].until).toEqual(new Date('2026-01-15T12:00:00Z'))
  })

  it('passes userId and a 7-day window for the weekly period', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))

    mocks.getUsageStats.mockResolvedValue(BASE_STATS)

    const stats = await getAIUsageStats({ period: 'weekly', userId: 'user-1' })

    expect(stats.period).toBe('weekly')
    const [call] = mocks.getUsageStats.mock.calls
    expect(call[0].userId).toBe('user-1')
    expect(call[0].since).toEqual(new Date('2026-01-08T12:00:00Z'))
    expect(call[0].until).toEqual(new Date('2026-01-15T12:00:00Z'))
  })

  it('honors explicit startDate/endDate over the named period', async () => {
    const since = new Date('2026-01-01T00:00:00Z')
    const until = new Date('2026-01-10T00:00:00Z')
    mocks.getUsageStats.mockResolvedValue(BASE_STATS)

    await getAIUsageStats({ period: 'weekly', startDate: since, endDate: until })

    const [call] = mocks.getUsageStats.mock.calls
    expect(call[0].since).toEqual(since)
    expect(call[0].until).toEqual(until)
  })

  it('propagates zero counts from the repository', async () => {
    mocks.getUsageStats.mockResolvedValue({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
    })

    const stats = await getAIUsageStats({ period: 'monthly' })

    expect(stats).toEqual({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      period: 'monthly',
    })
  })
})
