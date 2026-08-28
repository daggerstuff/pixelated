import { describe, it, expect, beforeEach } from 'vitest'
import {
  getAIUsageStats,
  recordAIUsage,
  clearAIUsageEvents,
  getAIUsageEvents,
} from './analytics'

describe('AI Usage Analytics', () => {
  beforeEach(() => {
    clearAIUsageEvents()
  })

  // ---------------------------------------------------------------------------
  // getAIUsageStats — empty state
  // ---------------------------------------------------------------------------

  describe('getAIUsageStats — empty state', () => {
    it('should return zeroed stats when no events are recorded', async () => {
      const stats = await getAIUsageStats()
      expect(stats.totalRequests).toBe(0)
      expect(stats.successfulRequests).toBe(0)
      expect(stats.failedRequests).toBe(0)
      expect(stats.averageResponseTime).toBe(0)
      expect(stats.totalTokensIn).toBe(0)
      expect(stats.totalTokensOut).toBe(0)
      expect(stats.totalTokens).toBe(0)
      expect(stats.uniqueSessions).toBe(0)
      expect(stats.uniqueModels).toBe(0)
      expect(stats.successRate).toBe(0)
      expect(stats.errorRate).toBe(0)
      expect(stats.period).toBe('day')
      expect(stats.modelBreakdown).toEqual([])
    })

    it('should return the provided period', async () => {
      const stats = await getAIUsageStats({ period: 'week' })
      expect(stats.period).toBe('week')
    })
  })

  // ---------------------------------------------------------------------------
  // recordAIUsage — event recording
  // ---------------------------------------------------------------------------

  describe('recordAIUsage', () => {
    it('should record an event and make it available via getAIUsageEvents', () => {
      recordAIUsage({
        model: 'gpt-4',
        sessionId: 'session-1',
        tokensIn: 100,
        tokensOut: 50,
        latencyMs: 200,
        success: true,
      })

      const events = getAIUsageEvents()
      expect(events).toHaveLength(1)
      expect(events[0].model).toBe('gpt-4')
      expect(events[0].sessionId).toBe('session-1')
      expect(events[0].tokensIn).toBe(100)
      expect(events[0].tokensOut).toBe(50)
      expect(events[0].latencyMs).toBe(200)
      expect(events[0].success).toBe(true)
      expect(events[0].timestamp).toBeInstanceOf(Date)
    })

    it('should auto-generate a timestamp if not provided', () => {
      recordAIUsage({
        model: 'gpt-4',
        sessionId: 'session-1',
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: 100,
        success: true,
      })

      const events = getAIUsageEvents()
      expect(events[0].timestamp).toBeInstanceOf(Date)
    })

    it('should use the provided timestamp when given', () => {
      const ts = new Date('2025-01-01T00:00:00Z')
      recordAIUsage({
        model: 'gpt-4',
        sessionId: 'session-1',
        tokensIn: 0,
        tokensOut: 0,
        latencyMs: 100,
        success: true,
        timestamp: ts,
      })

      const events = getAIUsageEvents()
      expect(events[0].timestamp).toEqual(ts)
    })

    it('should record failed events with error message', () => {
      recordAIUsage({
        model: 'gpt-4',
        sessionId: 'session-1',
        tokensIn: 50,
        tokensOut: 0,
        latencyMs: 500,
        success: false,
        error: 'Rate limit exceeded',
      })

      const events = getAIUsageEvents()
      expect(events[0].success).toBe(false)
      expect(events[0].error).toBe('Rate limit exceeded')
    })
  })

  // ---------------------------------------------------------------------------
  // getAIUsageStats — aggregation
  // ---------------------------------------------------------------------------

  describe('getAIUsageStats — aggregation', () => {
    it('should aggregate multiple events correctly', async () => {
      recordAIUsage({
        model: 'gpt-4',
        sessionId: 's1',
        tokensIn: 100,
        tokensOut: 50,
        latencyMs: 200,
        success: true,
      })
      recordAIUsage({
        model: 'gpt-4',
        sessionId: 's1',
        tokensIn: 80,
        tokensOut: 40,
        latencyMs: 300,
        success: true,
      })
      recordAIUsage({
        model: 'gpt-4',
        sessionId: 's2',
        tokensIn: 120,
        tokensOut: 60,
        latencyMs: 100,
        success: false,
        error: 'timeout',
      })

      const stats = await getAIUsageStats()
      expect(stats.totalRequests).toBe(3)
      expect(stats.successfulRequests).toBe(2)
      expect(stats.failedRequests).toBe(1)
      expect(stats.averageResponseTime).toBe(200) // (200+300+100)/3
      expect(stats.totalTokensIn).toBe(300)
      expect(stats.totalTokensOut).toBe(150)
      expect(stats.totalTokens).toBe(450)
      expect(stats.uniqueSessions).toBe(2)
      expect(stats.uniqueModels).toBe(1)
      expect(stats.successRate).toBe(66.7) // 2/3 = 66.666... → 66.7
      expect(stats.errorRate).toBe(33.3) // 1/3 = 33.333... → 33.3
    })

    it('should compute model breakdown sorted by total requests descending', async () => {
      recordAIUsage({
        model: 'claude-3',
        sessionId: 's1',
        tokensIn: 100,
        tokensOut: 50,
        latencyMs: 200,
        success: true,
      })
      recordAIUsage({
        model: 'gpt-4',
        sessionId: 's1',
        tokensIn: 80,
        tokensOut: 40,
        latencyMs: 300,
        success: true,
      })
      recordAIUsage({
        model: 'gpt-4',
        sessionId: 's2',
        tokensIn: 120,
        tokensOut: 60,
        latencyMs: 100,
        success: true,
      })

      const stats = await getAIUsageStats()
      expect(stats.modelBreakdown).toHaveLength(2)

      // gpt-4 has 2 requests, claude-3 has 1 — gpt-4 should be first
      expect(stats.modelBreakdown[0].model).toBe('gpt-4')
      expect(stats.modelBreakdown[0].totalRequests).toBe(2)
      expect(stats.modelBreakdown[0].successfulRequests).toBe(2)
      expect(stats.modelBreakdown[0].failedRequests).toBe(0)
      expect(stats.modelBreakdown[0].totalTokensIn).toBe(200)
      expect(stats.modelBreakdown[0].totalTokensOut).toBe(100)
      expect(stats.modelBreakdown[0].averageResponseTime).toBe(200) // (300+100)/2

      expect(stats.modelBreakdown[1].model).toBe('claude-3')
      expect(stats.modelBreakdown[1].totalRequests).toBe(1)
    })

    it('should handle 100% success rate', async () => {
      recordAIUsage({
        model: 'gpt-4',
        sessionId: 's1',
        tokensIn: 100,
        tokensOut: 50,
        latencyMs: 200,
        success: true,
      })

      const stats = await getAIUsageStats()
      expect(stats.successRate).toBe(100)
      expect(stats.errorRate).toBe(0)
    })

    it('should handle 100% failure rate', async () => {
      recordAIUsage({
        model: 'gpt-4',
        sessionId: 's1',
        tokensIn: 100,
        tokensOut: 0,
        latencyMs: 200,
        success: false,
        error: 'error',
      })

      const stats = await getAIUsageStats()
      expect(stats.successRate).toBe(0)
      expect(stats.errorRate).toBe(100)
    })
  })

  // ---------------------------------------------------------------------------
  // getAIUsageStats — filtering
  // ---------------------------------------------------------------------------

  describe('getAIUsageStats — filtering', () => {
    beforeEach(() => {
      recordAIUsage({
        model: 'gpt-4',
        sessionId: 's1',
        tokensIn: 100,
        tokensOut: 50,
        latencyMs: 200,
        success: true,
        userId: 'user-a',
        timestamp: new Date('2025-01-15T12:00:00Z'),
      })
      recordAIUsage({
        model: 'claude-3',
        sessionId: 's2',
        tokensIn: 200,
        tokensOut: 100,
        latencyMs: 400,
        success: false,
        userId: 'user-b',
        timestamp: new Date('2025-01-16T12:00:00Z'),
      })
      recordAIUsage({
        model: 'gpt-4',
        sessionId: 's3',
        tokensIn: 50,
        tokensOut: 25,
        latencyMs: 100,
        success: true,
        userId: 'user-a',
        timestamp: new Date('2025-01-17T12:00:00Z'),
      })
    })

    it('should filter by userId', async () => {
      const stats = await getAIUsageStats({ userId: 'user-a' })
      expect(stats.totalRequests).toBe(2)
      expect(stats.successfulRequests).toBe(2)
      expect(stats.totalTokensIn).toBe(150)
    })

    it('should filter by sessionId', async () => {
      const stats = await getAIUsageStats({ sessionId: 's2' })
      expect(stats.totalRequests).toBe(1)
      expect(stats.modelBreakdown[0].model).toBe('claude-3')
    })

    it('should filter by model', async () => {
      const stats = await getAIUsageStats({ model: 'gpt-4' })
      expect(stats.totalRequests).toBe(2)
      expect(stats.uniqueModels).toBe(1)
      expect(stats.modelBreakdown[0].model).toBe('gpt-4')
    })

    it('should filter by startDate (inclusive)', async () => {
      const stats = await getAIUsageStats({
        startDate: new Date('2025-01-16T00:00:00Z'),
      })
      expect(stats.totalRequests).toBe(2) // events on Jan 16 and 17
    })

    it('should filter by endDate (inclusive)', async () => {
      const stats = await getAIUsageStats({
        endDate: new Date('2025-01-16T23:59:59Z'),
      })
      expect(stats.totalRequests).toBe(2) // events on Jan 15 and 16
    })

    it('should filter by date range', async () => {
      const stats = await getAIUsageStats({
        startDate: new Date('2025-01-16T00:00:00Z'),
        endDate: new Date('2025-01-16T23:59:59Z'),
      })
      expect(stats.totalRequests).toBe(1)
      expect(stats.modelBreakdown[0].model).toBe('claude-3')
    })

    it('should return empty when no events match filter', async () => {
      const stats = await getAIUsageStats({ userId: 'nonexistent' })
      expect(stats.totalRequests).toBe(0)
      expect(stats.modelBreakdown).toEqual([])
    })

    it('should combine multiple filters', async () => {
      const stats = await getAIUsageStats({
        userId: 'user-a',
        model: 'gpt-4',
      })
      expect(stats.totalRequests).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // clearAIUsageEvents
  // ---------------------------------------------------------------------------

  describe('clearAIUsageEvents', () => {
    it('should remove all recorded events', () => {
      recordAIUsage({
        model: 'gpt-4',
        sessionId: 's1',
        tokensIn: 100,
        tokensOut: 50,
        latencyMs: 200,
        success: true,
      })
      expect(getAIUsageEvents()).toHaveLength(1)

      clearAIUsageEvents()
      expect(getAIUsageEvents()).toHaveLength(0)
    })
  })
})
