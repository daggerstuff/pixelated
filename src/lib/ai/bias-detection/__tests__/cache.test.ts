/**
 * Unit tests for the Bias Detection Caching Layer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  BiasDetectionCache,
  BiasAnalysisCache,
  DashboardCache,
  ReportCache,
  getCacheManager,
  resetCacheManager,
  cacheAnalysisResult,
  getCachedAnalysisResult,
  cacheDashboardData,
  getCachedDashboardData,
  cacheReport,
  getCachedReport,
} from '../cache'
import type {
  BiasAnalysisResult,
  TherapeuticSession,
  BiasDashboardData,
  BiasReport,
} from '../types'

// Mock logger
vi.mock('../../utils/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

describe('BiasDetectionCache', () => {
  let cache: BiasDetectionCache

  beforeEach(async () => {
    await resetCacheManager()
    cache = new BiasDetectionCache({
      maxSize: 10,
      defaultTtl: 1000, // 1 second for testing
      cleanupInterval: 500,
    })
  })

  afterEach(() => {
    cache.destroy()
  })

  describe('Basic Cache Operations', () => {
    it('should store and retrieve values', async () => {
      const key = 'test-key'
      const value = { data: 'test-value' }

      await cache.set(key, value)
      const retrieved = await cache.get(key)

      expect(retrieved).toEqual(value)
    })

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent')
      expect(result).toBeNull()
    })

    it('should check if key exists', async () => {
      const key = 'exists-key'
      const value = { data: 'test' }

      expect(await cache.has(key)).toBe(false)

      await cache.set(key, value)
      expect(await cache.has(key)).toBe(true)
    })

    it('should delete specific entries', async () => {
      const key = 'delete-key'
      const value = { data: 'test' }

      await cache.set(key, value)
      expect(await cache.has(key)).toBe(true)

      const deleted = await cache.delete(key)
      expect(deleted).toBe(true)
      expect(await cache.has(key)).toBe(false)
    })

    it('should clear all entries', async () => {
      await cache.set('key1', { data: 'value1' })
      await cache.set('key2', { data: 'value2' })

      expect(await cache.has('key1')).toBe(true)
      expect(await cache.has('key2')).toBe(true)

      await cache.clear()

      expect(await cache.has('key1')).toBe(false)
      expect(await cache.has('key2')).toBe(false)
    })
  })

  describe('TTL and Expiration', () => {
    it('should expire entries after TTL', async () => {
      const key = 'expire-key'
      const value = { data: 'test' }

      await cache.set(key, value, { ttl: 100 }) // 100ms
      expect(await cache.has(key)).toBe(true)

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150))
      expect(await cache.has(key)).toBe(false)
    })

    it('should use default TTL when not specified', async () => {
      const key = 'default-ttl-key'
      const value = { data: 'test' }

      await cache.set(key, value)
      expect(await cache.has(key)).toBe(true)

      // Should still exist after short time
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(await cache.has(key)).toBe(true)
    })

    it('should return null for expired entries on get', async () => {
      const key = 'expire-get-key'
      const value = { data: 'test' }

      await cache.set(key, value, { ttl: 50 })

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100))

      const result = await cache.get(key)
      expect(result).toBeNull()
    })
  })

  describe('Cache Statistics', () => {
    it('should track cache statistics', async () => {
      const stats = cache.getStats()
      expect(stats).toHaveProperty('totalEntries')
      expect(stats).toHaveProperty('hitRate')
      expect(stats).toHaveProperty('missRate')
      expect(stats).toHaveProperty('evictionCount')
      expect(stats).toHaveProperty('memoryUsage')
    })

    it('should update entry count', async () => {
      const initialStats = cache.getStats()
      expect(initialStats.totalEntries).toBe(0)

      await cache.set('key1', { data: 'value1' })
      await cache.set('key2', { data: 'value2' })

      const updatedStats = cache.getStats()
      expect(updatedStats.totalEntries).toBe(2)
    })

    it('should track hit and miss rates', async () => {
      await cache.set('hit-key', { data: 'value' })

      // Hit
      await cache.get('hit-key')

      // Miss
      await cache.get('miss-key')

      const stats = cache.getStats()
      expect(stats.hitRate).toBeGreaterThan(0)
      expect(stats.missRate).toBeGreaterThan(0)
    })
  })

  describe('Tag-based Invalidation', () => {
    it('should invalidate entries by tags', async () => {
      await cache.set('key1', { data: 'value1' }, { tags: ['tag1', 'tag2'] })
      await cache.set('key2', { data: 'value2' }, { tags: ['tag2', 'tag3'] })
      await cache.set('key3', { data: 'value3' }, { tags: ['tag3'] })

      expect(await cache.has('key1')).toBe(true)
      expect(await cache.has('key2')).toBe(true)
      expect(await cache.has('key3')).toBe(true)

      const invalidated = await cache.invalidateByTags(['tag2'])
      expect(invalidated).toBe(2) // key1 and key2

      expect(await cache.has('key1')).toBe(false)
      expect(await cache.has('key2')).toBe(false)
      expect(await cache.has('key3')).toBe(true)
    })

    it('should return 0 when no entries match tags', async () => {
      const invalidated = await cache.invalidateByTags(['non-existent-tag'])
      expect(invalidated).toBe(0)
    })
  })

  describe('Key Management', () => {
    it('should return all cache keys', async () => {
      await cache.set('key1', { data: 'value1' })
      await cache.set('key2', { data: 'value2' })
      await cache.set('key3', { data: 'value3' })

      const keys = cache.getKeys()
      expect(keys).toHaveLength(3)
      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
      expect(keys).toContain('key3')
    })

    it('should filter keys by pattern', async () => {
      await cache.set('user:123', { data: 'user1' })
      await cache.set('user:456', { data: 'user2' })
      await cache.set('session:789', { data: 'session1' })

      const userKeys = cache.getKeysByPattern(/^user:/)
      expect(userKeys).toHaveLength(2)
      expect(userKeys).toContain('user:123')
      expect(userKeys).toContain('user:456')
    })
  })

  describe('LRU Eviction', () => {
    it('should evict entries when max size reached', async () => {
      const smallCache = new BiasDetectionCache({ maxSize: 3 })

      // Fill cache to capacity
      await smallCache.set('key1', { data: 'value1' })
      await smallCache.set('key2', { data: 'value2' })
      await smallCache.set('key3', { data: 'value3' })

      // Verify cache is at capacity
      expect(smallCache.getStats().totalEntries).toBe(3)

      // Add new entry, should trigger eviction
      await smallCache.set('key4', { data: 'value4' })

      // Cache should still be at max capacity
      expect(smallCache.getStats().totalEntries).toBe(3)

      // New entry should exist
      expect(await smallCache.has('key4')).toBe(true)

      // At least one old entry should be evicted
      const remainingKeys = smallCache.getKeys()
      expect(remainingKeys).toHaveLength(3)
      expect(remainingKeys).toContain('key4')

      smallCache.destroy()
    })
  })

  describe('Cleanup Operations', () => {
    it('should clean up expired entries', async () => {
      await cache.set('expire1', { data: 'value1' }, { ttl: 50 })
      await cache.set('expire2', { data: 'value2' }, { ttl: 50 })
      await cache.set('persist', { data: 'value3' }, { ttl: 5000 })

      expect(await cache.has('expire1')).toBe(true)
      expect(await cache.has('expire2')).toBe(true)
      expect(await cache.has('persist')).toBe(true)

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100))

      const cleaned = await cache.cleanup()
      expect(cleaned).toBe(2)

      expect(await cache.has('expire1')).toBe(false)
      expect(await cache.has('expire2')).toBe(false)
      expect(await cache.has('persist')).toBe(true)
    })
  })
})

describe('BiasAnalysisCache', () => {
  let analysisCache: BiasAnalysisCache
  let mockAnalysisResult: BiasAnalysisResult
  let mockSession: TherapeuticSession

  beforeEach(async () => {
    await resetCacheManager()
    analysisCache = new BiasAnalysisCache({
      maxSize: 10,
      defaultTtl: 1000,
    })

    mockAnalysisResult = {
      sessionId: 'session-123',
      timestamp: new Date(),
      overallBiasScore: 0.3,
      layerResults: {
        preprocessing: {
          biasScore: 0.2,
          linguisticBias: {
            genderBiasScore: 0.1,
            racialBiasScore: 0.2,
            ageBiasScore: 0.1,
            culturalBiasScore: 0.15,
            biasedTerms: [],
            sentimentAnalysis: {
              overallSentiment: 0.5,
              emotionalValence: 0.6,
              subjectivity: 0.4,
              demographicVariations: {},
            },
          },
          representationAnalysis: {
            demographicDistribution: {},
            underrepresentedGroups: [],
            overrepresentedGroups: [],
            diversityIndex: 0.8,
            intersectionalityAnalysis: [],
          },
          dataQualityMetrics: {
            completeness: 0.9,
            consistency: 0.85,
            accuracy: 0.9,
            timeliness: 0.95,
            validity: 0.88,
            missingDataByDemographic: {},
          },
          recommendations: [],
        },
        modelLevel: {
          biasScore: 0.25,
          fairnessMetrics: {
            demographicParity: 0.1,
            equalizedOdds: 0.15,
            equalOpportunity: 0.12,
            calibration: 0.08,
            individualFairness: 0.2,
            counterfactualFairness: 0.18,
          },
          performanceMetrics: {
            accuracy: 0.85,
            precision: 0.82,
            recall: 0.88,
            f1Score: 0.85,
            auc: 0.9,
            calibrationError: 0.05,
            demographicBreakdown: {},
          },
          groupPerformanceComparison: [],
          recommendations: [],
        },
        interactive: {
          biasScore: 0.3,
          counterfactualAnalysis: {
            scenariosAnalyzed: 10,
            biasDetected: true,
            consistencyScore: 0.7,
            problematicScenarios: [],
          },
          featureImportance: [],
          whatIfScenarios: [],
          recommendations: [],
        },
        evaluation: {
          biasScore: 0.35,
          huggingFaceMetrics: {
            toxicity: 0.1,
            bias: 0.2,
            regard: {},
            stereotype: 0.15,
            fairness: 0.8,
          },
          customMetrics: {
            therapeuticBias: 0.2,
            culturalSensitivity: 0.8,
            professionalEthics: 0.9,
            patientSafety: 0.95,
          },
          temporalAnalysis: {
            trendDirection: 'stable',
            changeRate: 0.02,
            seasonalPatterns: [],
            interventionEffectiveness: [],
          },
          recommendations: [],
        },
      },
      demographics: {
        age: '25-35',
        gender: 'female',
        ethnicity: 'hispanic',
        primaryLanguage: 'en',
      },
      recommendations: [],
      alertLevel: 'medium',
      confidence: 0.85,
    }

    mockSession = {
      sessionId: 'session-123',
      timestamp: new Date(),
      participantDemographics: {
        age: '25-35',
        gender: 'female',
        ethnicity: 'hispanic',
        primaryLanguage: 'en',
      },
      scenario: {
        scenarioId: 'scenario-1',
        type: 'depression',
        complexity: 'intermediate',
        tags: ['mood', 'therapy'],
        description: 'Depression therapy scenario',
        learningObjectives: [],
      },
      content: {
        patientPresentation: 'Patient presents with depressive symptoms',
        therapeuticInterventions: [],
        patientResponses: [],
        sessionNotes: 'Initial assessment completed',
      },
      aiResponses: [],
      expectedOutcomes: [],
      transcripts: [],
      metadata: {
        trainingInstitution: 'Test University',
        traineeId: 'trainee-123',
        sessionDuration: 60,
        completionStatus: 'completed',
      },
    }
  })

  afterEach(() => {
    analysisCache.destroy()
  })

  describe('Analysis Result Caching', () => {
    it('should cache and retrieve analysis results', async () => {
      await analysisCache.cacheAnalysisResult('session-123', mockAnalysisResult)

      const retrieved = await analysisCache.getAnalysisResult('session-123')
      expect(retrieved).toBeTruthy()
      expect(retrieved!.sessionId).toBe(mockAnalysisResult.sessionId)
      expect(retrieved!.overallBiasScore).toBe(
        mockAnalysisResult.overallBiasScore,
      )
      expect(retrieved!.alertLevel).toBe(mockAnalysisResult.alertLevel)
      expect(retrieved!.confidence).toBe(mockAnalysisResult.confidence)

      // Handle timestamp comparison (might be serialized as string)
      const retrievedTimestamp =
        typeof retrieved!.timestamp === 'string'
          ? new Date(retrieved!.timestamp)
          : retrieved!.timestamp
      expect(retrievedTimestamp.getTime()).toBe(
        mockAnalysisResult.timestamp.getTime(),
      )
    })

    it('should return null for non-existent analysis results', async () => {
      const result = await analysisCache.getAnalysisResult('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('Session Caching', () => {
    it('should cache and retrieve sessions', async () => {
      await analysisCache.cacheSession(mockSession)

      const retrieved = await analysisCache.getSession('session-123')
      expect(retrieved).toBeTruthy()
      expect(retrieved!.sessionId).toBe(mockSession.sessionId)
      expect(retrieved!.participantDemographics).toEqual(
        mockSession.participantDemographics,
      )
      expect(retrieved!.scenario).toEqual(mockSession.scenario)

      // Handle timestamp comparison (might be serialized as string)
      const retrievedTimestamp =
        typeof retrieved!.timestamp === 'string'
          ? new Date(retrieved!.timestamp)
          : retrieved!.timestamp
      expect(retrievedTimestamp.getTime()).toBe(mockSession.timestamp.getTime())
    })

    it('should return null for non-existent sessions', async () => {
      const result = await analysisCache.getSession('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('Demographic-based Invalidation', () => {
    it('should invalidate by demographics', async () => {
      await analysisCache.cacheSession(mockSession)
      await analysisCache.cacheAnalysisResult('session-123', mockAnalysisResult)

      expect(await analysisCache.getSession('session-123')).not.toBeNull()

      // The tags are constructed as "participant:age:gender", so we need to match the exact format
      const invalidated = await analysisCache.invalidateByDemographics({
        age: '25-35',
      })

      expect(invalidated).toBeGreaterThan(0)
    })
  })

  describe('Statistics', () => {
    it('should provide cache statistics', () => {
      const stats = analysisCache.getStats()
      expect(stats).toHaveProperty('totalEntries')
      expect(stats).toHaveProperty('hitRate')
      expect(stats).toHaveProperty('missRate')
    })
  })
})

describe('DashboardCache', () => {
  let dashboardCache: DashboardCache
  let mockDashboardData: BiasDashboardData

  beforeEach(async () => {
    await resetCacheManager()
    dashboardCache = new DashboardCache({
      maxSize: 10,
      defaultTtl: 1000,
    })

    mockDashboardData = {
      summary: {
        totalSessions: 100,
        averageBiasScore: 0.3,
        alertsLast24h: 5,
        criticalIssues: 1,
        improvementRate: 0.05,
        complianceScore: 0.9,
      },
      recentAnalyses: [],
      alerts: [],
      trends: [],
      demographics: {
        age: {},
        gender: {},
        ethnicity: {},
        language: {},
        intersectional: [],
      },
      recommendations: [],
    }
  })

  afterEach(() => {
    dashboardCache.destroy()
  })

  describe('Dashboard Data Caching', () => {
    it('should cache and retrieve dashboard data', async () => {
      await dashboardCache.cacheDashboardData(
        'user-123',
        '7d',
        mockDashboardData,
      )

      const retrieved = await dashboardCache.getDashboardData('user-123', '7d')
      expect(retrieved).toEqual(mockDashboardData)
    })

    it('should return null for non-existent dashboard data', async () => {
      const result = await dashboardCache.getDashboardData('non-existent', '7d')
      expect(result).toBeNull()
    })
  })

  describe('User-based Invalidation', () => {
    it('should invalidate dashboard data for specific user', async () => {
      await dashboardCache.cacheDashboardData(
        'user-123',
        '7d',
        mockDashboardData,
      )
      await dashboardCache.cacheDashboardData(
        'user-456',
        '7d',
        mockDashboardData,
      )

      expect(
        await dashboardCache.getDashboardData('user-123', '7d'),
      ).not.toBeNull()
      expect(
        await dashboardCache.getDashboardData('user-456', '7d'),
      ).not.toBeNull()

      const invalidated =
        await dashboardCache.invalidateUserDashboard('user-123')
      expect(invalidated).toBe(1)

      expect(await dashboardCache.getDashboardData('user-123', '7d')).toBeNull()
      expect(
        await dashboardCache.getDashboardData('user-456', '7d'),
      ).not.toBeNull()
    })

    it('should invalidate all dashboard data', async () => {
      await dashboardCache.cacheDashboardData(
        'user-123',
        '7d',
        mockDashboardData,
      )
      await dashboardCache.cacheDashboardData(
        'user-456',
        '30d',
        mockDashboardData,
      )

      const invalidated = await dashboardCache.invalidateAllDashboards()
      expect(invalidated).toBe(2)

      expect(await dashboardCache.getDashboardData('user-123', '7d')).toBeNull()
      expect(
        await dashboardCache.getDashboardData('user-456', '30d'),
      ).toBeNull()
    })
  })
})

describe('ReportCache', () => {
  let reportCache: ReportCache
  let mockReport: BiasReport

  beforeEach(async () => {
    await resetCacheManager()
    reportCache = new ReportCache({
      maxSize: 10,
      defaultTtl: 1000,
    })

    mockReport = {
      reportId: 'report-123',
      generatedAt: new Date(),
      timeRange: {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      },
      overallFairnessScore: 0.8,
      executiveSummary: {
        keyFindings: [],
        criticalIssues: [],
        improvementAreas: [],
        complianceStatus: 'compliant',
      },
      detailedAnalysis: {
        demographicAnalysis: {
          representation: {},
          performanceGaps: [],
          intersectionalAnalysis: [],
          riskGroups: [],
        },
        temporalTrends: {
          overallTrend: 'stable',
          monthlyMetrics: [],
          seasonalPatterns: [],
          correlationAnalysis: [],
        },
        performanceAnalysis: {
          overallMetrics: {
            accuracy: 0.85,
            precision: 0.82,
            recall: 0.88,
            f1Score: 0.85,
            auc: 0.9,
            calibrationError: 0.05,
            demographicBreakdown: {},
          },
          demographicBreakdown: {},
          fairnessMetrics: {
            demographicParity: 0.1,
            equalizedOdds: 0.15,
            equalOpportunity: 0.12,
            calibration: 0.08,
            individualFairness: 0.2,
            counterfactualFairness: 0.18,
          },
          benchmarkComparison: [],
        },
        interventionAnalysis: {
          implementedInterventions: [],
          effectivenessAnalysis: [],
          recommendedInterventions: [],
        },
      },
      recommendations: [],
      appendices: [],
    }
  })

  afterEach(() => {
    reportCache.destroy()
  })

  describe('Report Caching', () => {
    it('should cache and retrieve reports', async () => {
      await reportCache.cacheReport('report-123', mockReport)

      const retrieved = await reportCache.getReport('report-123')
      expect(retrieved).toBeTruthy()
      expect(retrieved!.reportId).toBe(mockReport.reportId)
      expect(retrieved!.overallFairnessScore).toBe(
        mockReport.overallFairnessScore,
      )

      // Handle Date field comparisons (might be serialized as strings)
      const retrievedGeneratedAt =
        typeof retrieved!.generatedAt === 'string'
          ? new Date(retrieved!.generatedAt)
          : retrieved!.generatedAt
      expect(retrievedGeneratedAt.getTime()).toBe(
        mockReport.generatedAt.getTime(),
      )

      const retrievedStart =
        typeof retrieved!.timeRange.start === 'string'
          ? new Date(retrieved!.timeRange.start)
          : retrieved!.timeRange.start
      expect(retrievedStart.getTime()).toBe(
        mockReport.timeRange.start.getTime(),
      )

      const retrievedEnd =
        typeof retrieved!.timeRange.end === 'string'
          ? new Date(retrieved!.timeRange.end)
          : retrieved!.timeRange.end
      expect(retrievedEnd.getTime()).toBe(mockReport.timeRange.end.getTime())
    })

    it('should return null for non-existent reports', async () => {
      const result = await reportCache.getReport('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('Report Invalidation', () => {
    it('should invalidate specific reports', async () => {
      await reportCache.cacheReport('report-123', mockReport)
      await reportCache.cacheReport('report-456', mockReport)

      expect(await reportCache.getReport('report-123')).not.toBeNull()
      expect(await reportCache.getReport('report-456')).not.toBeNull()

      const invalidated = await reportCache.invalidateReport('report-123')
      expect(invalidated).toBe(1)

      expect(await reportCache.getReport('report-123')).toBeNull()
      expect(await reportCache.getReport('report-456')).not.toBeNull()
    })
  })
})

describe('CacheManager', () => {
  beforeEach(async () => {
    await resetCacheManager()
  })

  afterEach(async () => {
    await resetCacheManager()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const manager1 = getCacheManager()
      const manager2 = getCacheManager()

      expect(manager1).toBe(manager2)
    })

    it('should provide access to all cache types', () => {
      const manager = getCacheManager()

      expect(manager.analysisCache).toBeInstanceOf(BiasAnalysisCache)
      expect(manager.dashboardCache).toBeInstanceOf(DashboardCache)
      expect(manager.reportCache).toBeInstanceOf(ReportCache)
    })
  })

  describe('Combined Statistics', () => {
    it('should provide combined cache statistics', async () => {
      const manager = getCacheManager()

      // Add some data to different caches
      await manager.analysisCache.cacheAnalysisResult('session-1', {
        sessionId: 'session-1',
        timestamp: new Date(),
        overallBiasScore: 0.3,
        layerResults: {} as unknown,
        demographics: {} as unknown,
        recommendations: [],
        alertLevel: 'low',
        confidence: 0.8,
      })

      const stats = manager.getCombinedStats()

      expect(stats).toHaveProperty('analysis')
      expect(stats).toHaveProperty('dashboard')
      expect(stats).toHaveProperty('report')
      expect(stats).toHaveProperty('total')

      expect(stats.total.totalEntries).toBeGreaterThan(0)
    })
  })

  describe('Cache Management', () => {
    it('should clear all caches', () => {
      const manager = getCacheManager()

      // This should not throw
      expect(() => manager.clearAll()).not.toThrow()
    })

    it('should destroy cache manager', () => {
      const manager = getCacheManager()

      // This should not throw
      expect(() => manager.destroy()).not.toThrow()
    })
  })
})

describe('Convenience Functions', () => {
  beforeEach(async () => {
    await resetCacheManager()
  })

  afterEach(async () => {
    await resetCacheManager()
  })

  describe('Analysis Result Functions', () => {
    it('should cache and retrieve analysis results', async () => {
      const mockResult: BiasAnalysisResult = {
        sessionId: 'session-123',
        timestamp: new Date(),
        overallBiasScore: 0.3,
        layerResults: {} as unknown,
        demographics: {} as unknown,
        recommendations: [],
        alertLevel: 'medium',
        confidence: 0.85,
      }

      await cacheAnalysisResult('session-123', mockResult)
      const retrieved = await getCachedAnalysisResult('session-123')

      expect(retrieved).toBeTruthy()
      expect(retrieved!.sessionId).toBe(mockResult.sessionId)
      expect(retrieved!.overallBiasScore).toBe(mockResult.overallBiasScore)
      expect(retrieved!.alertLevel).toBe(mockResult.alertLevel)
      expect(retrieved!.confidence).toBe(mockResult.confidence)

      // Handle timestamp comparison (might be serialized as string)
      const retrievedTimestamp =
        typeof retrieved!.timestamp === 'string'
          ? new Date(retrieved!.timestamp)
          : retrieved!.timestamp
      expect(retrievedTimestamp.getTime()).toBe(mockResult.timestamp.getTime())
    })

    it('should return null for non-existent analysis results', async () => {
      const result = await getCachedAnalysisResult('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('Dashboard Data Functions', () => {
    it('should cache and retrieve dashboard data', async () => {
      const mockData: BiasDashboardData = {
        summary: {
          totalSessions: 100,
          averageBiasScore: 0.3,
          alertsLast24h: 5,
          criticalIssues: 1,
          improvementRate: 0.05,
          complianceScore: 0.9,
        },
        recentAnalyses: [],
        alerts: [],
        trends: [],
        demographics: {
          age: {},
          gender: {},
          ethnicity: {},
          language: {},
          intersectional: [],
        },
        recommendations: [],
      }

      await cacheDashboardData('user-123', '7d', mockData)
      const retrieved = await getCachedDashboardData('user-123', '7d')

      expect(retrieved).toEqual(mockData)
    })

    it('should return null for non-existent dashboard data', async () => {
      const result = await getCachedDashboardData('non-existent', '7d')
      expect(result).toBeNull()
    })
  })

  describe('Report Functions', () => {
    it('should cache and retrieve reports', async () => {
      const mockReport: BiasReport = {
        reportId: 'report-123',
        generatedAt: new Date(),
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
        overallFairnessScore: 0.8,
        executiveSummary: {} as unknown,
        detailedAnalysis: {} as unknown,
        recommendations: [],
        appendices: [],
      }

      await cacheReport('report-123', mockReport)
      const retrieved = await getCachedReport('report-123')

      expect(retrieved).toBeTruthy()
      expect(retrieved!.reportId).toBe(mockReport.reportId)
      expect(retrieved!.overallFairnessScore).toBe(
        mockReport.overallFairnessScore,
      )

      // Handle Date field comparisons (might be serialized as strings)
      const retrievedGeneratedAt =
        typeof retrieved!.generatedAt === 'string'
          ? new Date(retrieved!.generatedAt)
          : retrieved!.generatedAt
      expect(retrievedGeneratedAt.getTime()).toBe(
        mockReport.generatedAt.getTime(),
      )

      const retrievedStart =
        typeof retrieved!.timeRange.start === 'string'
          ? new Date(retrieved!.timeRange.start)
          : retrieved!.timeRange.start
      expect(retrievedStart.getTime()).toBe(
        mockReport.timeRange.start.getTime(),
      )

      const retrievedEnd =
        typeof retrieved!.timeRange.end === 'string'
          ? new Date(retrieved!.timeRange.end)
          : retrieved!.timeRange.end
      expect(retrievedEnd.getTime()).toBe(mockReport.timeRange.end.getTime())
    })

    it('should return null for non-existent reports', async () => {
      const result = await getCachedReport('non-existent')
      expect(result).toBeNull()
    })
  })
})
