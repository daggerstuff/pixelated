/**
 * Unit Tests for Behavioral Analysis Service
 *
 * These tests verify the behavioral analysis functionality including
 * user profiling, anomaly detection, and pattern recognition.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BehavioralAnalysisService } from '../behavioral-analysis-service'
import {
  detectAnomalies,
  calculateBehavioralScore,
  extractBehavioralFeatures,
  normalizeBehavioralData,
  detectPatternChanges,
  getBehavioralInsights,
} from '../behavioral-utils'

vi.mock('../../logging/build-safe-logger')
vi.mock('../../redis')
vi.mock('../../response-orchestration')

describe('Behavioral Analysis Service', () => {
  let service: BehavioralAnalysisService
  let mockRedis: any
  let mockOrchestrator: any

  beforeEach(() => {
    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      exists: vi.fn(),
      incr: vi.fn(),
      expire: vi.fn(),
      hget: vi.fn(),
      hset: vi.fn(),
      hgetall: vi.fn(),
      hdel: vi.fn(),
      hincrby: vi.fn(),
    }

    mockOrchestrator = {
      analyzeThreat: vi.fn(),
      executeResponse: vi.fn(),
      getStatistics: vi.fn(),
    }

    service = new BehavioralAnalysisService(mockRedis, mockOrchestrator)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Service Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(service).toBeDefined()
      expect(service.config).toBeDefined()
      expect(service.redis).toBe(mockRedis)
      expect(service.orchestrator).toBe(mockOrchestrator)
      expect(service.profiles).toBeDefined()
      expect(service.anomalyDetector).toBeDefined()
    })

    it('should use default configuration when none provided', () => {
      const defaultService = new BehavioralAnalysisService(
        mockRedis,
        mockOrchestrator,
      )
      expect(defaultService.config).toEqual({
        enabled: true,
        profileUpdateInterval: 300000, // 5 minutes
        anomalyThreshold: 0.75,
        maxProfileAge: 86400000, // 24 hours
        enableLogging: true,
        enableRealTimeAnalysis: true,
        maxProfileSize: 1000,
      })
    })

    it('should use custom configuration when provided', () => {
      const customConfig = {
        enabled: false,
        profileUpdateInterval: 600000,
        anomalyThreshold: 0.85,
        maxProfileAge: 43200000,
        enableLogging: false,
        enableRealTimeAnalysis: false,
        maxProfileSize: 500,
      }

      const customService = new BehavioralAnalysisService(
        mockRedis,
        mockOrchestrator,
        customConfig,
      )
      expect(customService.config).toEqual(customConfig)
    })
  })

  describe('User Profile Management', () => {
    it('should create behavioral profile for new user', async () => {
      const userId = 'user_123'
      const initialData = {
        loginFrequency: 5,
        sessionDuration: 1800,
        requestPatterns: {
          endpoints: ['/api/data', '/api/user'],
          methods: ['GET', 'POST'],
          avgRequestsPerHour: 12,
        },
        timePatterns: {
          peakHours: [14, 15, 16],
          activeDays: [1, 2, 3, 4, 5],
        },
        deviceInfo: {
          userAgent: 'Mozilla/5.0...',
          platform: 'desktop',
        },
      }

      mockRedis.exists.mockResolvedValue(0) // User doesn't exist
      mockRedis.set.mockResolvedValue('OK')

      const profile = await service.createOrUpdateProfile(userId, initialData)

      expect(profile).toBeDefined()
      expect(profile.userId).toBe(userId)
      expect(profile.createdAt).toBeDefined()
      expect(profile.lastUpdated).toBeDefined()
      expect(profile.loginFrequency).toBe(5)
      expect(profile.sessionDuration).toBe(1800)
      expect(mockRedis.set).toHaveBeenCalledWith(
        `behavioral_profile:${userId}`,
        expect.any(String),
        expect.any(Number),
      )
    })

    it('should update existing behavioral profile', async () => {
      const userId = 'user_123'
      const existingProfile = {
        userId,
        loginFrequency: 5,
        sessionDuration: 1800,
        requestPatterns: {
          endpoints: ['/api/data'],
          methods: ['GET'],
          avgRequestsPerHour: 8,
        },
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        lastUpdated: new Date(Date.now() - 3600000).toISOString(),
      }

      const updateData = {
        loginFrequency: 8,
        sessionDuration: 2200,
        requestPatterns: {
          endpoints: ['/api/data', '/api/admin'],
          methods: ['GET', 'POST'],
          avgRequestsPerHour: 15,
        },
      }

      mockRedis.exists.mockResolvedValue(1)
      mockRedis.get.mockResolvedValue(JSON.stringify(existingProfile))
      mockRedis.set.mockResolvedValue('OK')

      const updatedProfile = await service.createOrUpdateProfile(
        userId,
        updateData,
      )

      expect(updatedProfile.loginFrequency).toBe(8)
      expect(updatedProfile.sessionDuration).toBe(2200)
      expect(updatedProfile.requestPatterns.endpoints).toContain('/api/admin')
      expect(updatedProfile.lastUpdated).not.toBe(existingProfile.lastUpdated)
    })

    it('should handle profile creation errors gracefully', async () => {
      const userId = 'user_123'
      const initialData = { loginFrequency: 5 }

      mockRedis.exists.mockRejectedValue(new Error('Redis error'))

      await expect(
        service.createOrUpdateProfile(userId, initialData),
      ).rejects.toThrow('Redis error')
    })

    it('should get user profile by ID', async () => {
      const userId = 'user_123'
      const profile = {
        userId,
        loginFrequency: 5,
        sessionDuration: 1800,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(profile))

      const result = await service.getProfile(userId)

      expect(result).toEqual(profile)
      expect(mockRedis.get).toHaveBeenCalledWith(`behavioral_profile:${userId}`)
    })

    it('should return null for non-existent profile', async () => {
      const userId = 'user_123'
      mockRedis.get.mockResolvedValue(null)

      const result = await service.getProfile(userId)

      expect(result).toBeNull()
    })

    it('should delete user profile', async () => {
      const userId = 'user_123'
      mockRedis.del.mockResolvedValue(1)

      await service.deleteProfile(userId)

      expect(mockRedis.del).toHaveBeenCalledWith(`behavioral_profile:${userId}`)
    })

    it('should handle profile deletion errors gracefully', async () => {
      const userId = 'user_123'
      mockRedis.del.mockRejectedValue(new Error('Redis error'))

      await expect(service.deleteProfile(userId)).rejects.toThrow('Redis error')
    })
  })

  describe('Behavioral Analysis', () => {
    it('should analyze user behavior correctly', async () => {
      const userId = 'user_123'
      const behaviorData = {
        timestamp: new Date().toISOString(),
        action: 'login',
        metadata: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
          endpoint: '/api/auth/login',
        },
      }

      const existingProfile = {
        userId,
        loginFrequency: 5,
        sessionDuration: 1800,
        requestPatterns: {
          endpoints: ['/api/data'],
          methods: ['GET'],
          avgRequestsPerHour: 8,
        },
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        lastUpdated: new Date(Date.now() - 3600000).toISOString(),
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(existingProfile))
      mockRedis.set.mockResolvedValue('OK')

      const analysis = await service.analyzeBehavior(userId, behaviorData)

      expect(analysis).toBeDefined()
      expect(analysis.userId).toBe(userId)
      expect(analysis.anomalies).toBeDefined()
      expect(analysis.patterns).toBeDefined()
      expect(analysis.score).toBeDefined()
      expect(analysis.recommendations).toBeDefined()
      expect(mockRedis.set).toHaveBeenCalled()
    })

    it('should detect behavioral anomalies', async () => {
      const userId = 'user_123'
      const suspiciousBehavior = {
        timestamp: new Date().toISOString(),
        action: 'bulk_download',
        metadata: {
          ip: '192.168.1.100',
          userAgent: 'bot/scanner',
          endpoint: '/api/data/export',
          downloadSize: 1000000, // 1MB
        },
      }

      const existingProfile = {
        userId,
        loginFrequency: 5,
        sessionDuration: 1800,
        requestPatterns: {
          endpoints: ['/api/data'],
          methods: ['GET'],
          avgRequestsPerHour: 8,
        },
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        lastUpdated: new Date(Date.now() - 3600000).toISOString(),
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(existingProfile))
      mockRedis.set.mockResolvedValue('OK')

      const analysis = await service.analyzeBehavior(userId, suspiciousBehavior)

      expect(analysis.anomalies).toHaveLength(1)
      expect(analysis.anomalies[0].type).toBe('unusual_behavior')
      expect(analysis.score).toBeGreaterThan(0.5)
    })

    it('should handle analysis errors gracefully', async () => {
      const userId = 'user_123'
      const behaviorData = {
        timestamp: new Date().toISOString(),
        action: 'login',
      }

      mockRedis.get.mockRejectedValue(new Error('Redis error'))

      await expect(
        service.analyzeBehavior(userId, behaviorData),
      ).rejects.toThrow('Redis error')
    })

    it('should analyze batch behavior data', async () => {
      const userId = 'user_123'
      const batchData = [
        {
          timestamp: new Date().toISOString(),
          action: 'login',
          metadata: { ip: '192.168.1.1' },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'data_access',
          metadata: { endpoint: '/api/data' },
        },
        { timestamp: new Date().toISOString(), action: 'logout' },
      ]

      const existingProfile = {
        userId,
        loginFrequency: 5,
        sessionDuration: 1800,
        requestPatterns: {
          endpoints: ['/api/data'],
          methods: ['GET'],
          avgRequestsPerHour: 8,
        },
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        lastUpdated: new Date(Date.now() - 3600000).toISOString(),
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(existingProfile))
      mockRedis.set.mockResolvedValue('OK')

      const analysis = await service.analyzeBatchBehavior(userId, batchData)

      expect(analysis).toBeDefined()
      expect(analysis.userId).toBe(userId)
      expect(analysis.anomalies).toBeDefined()
      expect(analysis.patterns).toBeDefined()
      expect(analysis.score).toBeDefined()
    })
  })

  describe('Anomaly Detection', () => {
    it('should detect unusual login patterns', () => {
      const userProfile = {
        userId: 'user_123',
        loginFrequency: 5,
        typicalLoginHours: [9, 10, 14, 15],
        typicalIPs: ['192.168.1.1', '10.0.0.1'],
      }

      const currentBehavior = {
        timestamp: new Date().toISOString(),
        action: 'login',
        metadata: {
          ip: '192.168.1.100', // Unusual IP
          hour: 3, // Unusual hour
          userAgent: 'Mozilla/5.0...',
        },
      }

      const anomalies = detectAnomalies(userProfile, currentBehavior)

      expect(anomalies).toHaveLength(2)
      expect(anomalies.some((a) => a.type === 'unusual_ip')).toBe(true)
      expect(anomalies.some((a) => a.type === 'unusual_time')).toBe(true)
    })

    it('should detect unusual request patterns', () => {
      const userProfile = {
        userId: 'user_123',
        typicalEndpoints: ['/api/data', '/api/user'],
        typicalMethods: ['GET', 'POST'],
        avgRequestsPerHour: 10,
      }

      const currentBehavior = {
        timestamp: new Date().toISOString(),
        action: 'api_request',
        metadata: {
          endpoint: '/api/admin', // Unusual endpoint
          method: 'DELETE', // Unusual method
          requestsInLastHour: 50, // High frequency
        },
      }

      const anomalies = detectAnomalies(userProfile, currentBehavior)

      expect(anomalies).toHaveLength(3)
      expect(anomalies.some((a) => a.type === 'unusual_endpoint')).toBe(true)
      expect(anomalies.some((a) => a.type === 'unusual_method')).toBe(true)
      expect(anomalies.some((a) => a.type === 'high_frequency')).toBe(true)
    })

    it('should detect unusual session behavior', () => {
      const userProfile = {
        userId: 'user_123',
        typicalSessionDuration: 1800, // 30 minutes
        typicalSessionCount: 2,
      }

      const currentBehavior = {
        timestamp: new Date().toISOString(),
        action: 'session_start',
        metadata: {
          sessionDuration: 7200, // 2 hours - unusually long
          concurrentSessions: 5, // High concurrency
        },
      }

      const anomalies = detectAnomalies(userProfile, currentBehavior)

      expect(anomalies).toHaveLength(2)
      expect(anomalies.some((a) => a.type === 'long_session')).toBe(true)
      expect(anomalies.some((a) => a.type === 'high_concurrency')).toBe(true)
    })

    it('should return empty array for normal behavior', () => {
      const userProfile = {
        userId: 'user_123',
        typicalEndpoints: ['/api/data'],
        typicalMethods: ['GET'],
        typicalLoginHours: [9, 10, 14, 15],
        typicalIPs: ['192.168.1.1'],
      }

      const normalBehavior = {
        timestamp: new Date().toISOString(),
        action: 'api_request',
        metadata: {
          endpoint: '/api/data',
          method: 'GET',
          ip: '192.168.1.1',
          hour: 10,
        },
      }

      const anomalies = detectAnomalies(userProfile, normalBehavior)

      expect(anomalies).toHaveLength(0)
    })
  })

  describe('Behavioral Scoring', () => {
    it('should calculate behavioral score correctly', () => {
      const userProfile = {
        userId: 'user_123',
        loginFrequency: 5,
        sessionDuration: 1800,
        requestPatterns: {
          endpoints: ['/api/data'],
          methods: ['GET'],
          avgRequestsPerHour: 8,
        },
      }

      const currentBehavior = {
        timestamp: new Date().toISOString(),
        action: 'login',
        metadata: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0...',
        },
      }

      const score = calculateBehavioralScore(userProfile, currentBehavior)

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    })

    it('should give higher score for suspicious behavior', () => {
      const userProfile = {
        userId: 'user_123',
        typicalEndpoints: ['/api/data'],
        typicalMethods: ['GET'],
        avgRequestsPerHour: 10,
      }

      const suspiciousBehavior = {
        timestamp: new Date().toISOString(),
        action: 'bulk_download',
        metadata: {
          endpoint: '/api/admin',
          method: 'POST',
          requestsInLastHour: 100,
        },
      }

      const normalBehavior = {
        timestamp: new Date().toISOString(),
        action: 'api_request',
        metadata: {
          endpoint: '/api/data',
          method: 'GET',
          requestsInLastHour: 5,
        },
      }

      const suspiciousScore = calculateBehavioralScore(
        userProfile,
        suspiciousBehavior,
      )
      const normalScore = calculateBehavioralScore(userProfile, normalBehavior)

      expect(suspiciousScore).toBeGreaterThan(normalScore)
    })
  })

  describe('Feature Extraction', () => {
    it('should extract behavioral features from raw data', () => {
      const rawData = [
        {
          timestamp: new Date().toISOString(),
          action: 'login',
          metadata: { ip: '192.168.1.1' },
        },
        {
          timestamp: new Date().toISOString(),
          action: 'data_access',
          metadata: { endpoint: '/api/data' },
        },
        { timestamp: new Date().toISOString(), action: 'logout' },
      ]

      const features = extractBehavioralFeatures(rawData)

      expect(features).toBeDefined()
      expect(features.loginFrequency).toBe(1)
      expect(features.logoutFrequency).toBe(1)
      expect(features.dataAccessFrequency).toBe(1)
      expect(features.uniqueIPs).toBe(1)
      expect(features.uniqueEndpoints).toBe(1)
    })

    it('should normalize behavioral data', () => {
      const rawData = {
        loginFrequency: 100,
        sessionDuration: 7200,
        requestPatterns: {
          avgRequestsPerHour: 50,
        },
      }

      const normalized = normalizeBehavioralData(rawData)

      expect(normalized.loginFrequency).toBeGreaterThanOrEqual(0)
      expect(normalized.loginFrequency).toBeLessThanOrEqual(1)
      expect(normalized.sessionDuration).toBeGreaterThanOrEqual(0)
      expect(normalized.sessionDuration).toBeLessThanOrEqual(1)
      expect(
        normalized.requestPatterns.avgRequestsPerHour,
      ).toBeGreaterThanOrEqual(0)
      expect(normalized.requestPatterns.avgRequestsPerHour).toBeLessThanOrEqual(
        1,
      )
    })

    it('should detect pattern changes', () => {
      const historicalData = [
        {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          action: 'login',
        },
        {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          action: 'data_access',
        },
        {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          action: 'logout',
        },
      ]

      const currentData = [
        { timestamp: new Date().toISOString(), action: 'login' },
        { timestamp: new Date().toISOString(), action: 'bulk_download' },
        { timestamp: new Date().toISOString(), action: 'bulk_download' },
        { timestamp: new Date().toISOString(), action: 'bulk_download' },
      ]

      const changes = detectPatternChanges(historicalData, currentData)

      expect(changes).toBeDefined()
      expect(changes.loginChange).toBeDefined()
      expect(changes.dataAccessChange).toBeDefined()
      expect(changes.newPatterns).toBeDefined()
    })
  })

  describe('Behavioral Insights', () => {
    it('should generate behavioral insights', () => {
      const userProfile = {
        userId: 'user_123',
        loginFrequency: 5,
        sessionDuration: 1800,
        requestPatterns: {
          endpoints: ['/api/data', '/api/admin'],
          methods: ['GET', 'POST'],
          avgRequestsPerHour: 15,
        },
        timePatterns: {
          peakHours: [14, 15, 16],
          activeDays: [1, 2, 3, 4, 5],
        },
      }

      const insights = getBehavioralInsights(userProfile)

      expect(insights).toBeDefined()
      expect(insights.activityLevel).toBeDefined()
      expect(insights.riskLevel).toBeDefined()
      expect(insights.typicalBehavior).toBeDefined()
      expect(insights.recommendations).toBeDefined()
    })

    it('should identify high-risk behavior', () => {
      const highRiskProfile = {
        userId: 'user_123',
        loginFrequency: 50,
        sessionDuration: 7200,
        requestPatterns: {
          endpoints: ['/api/admin', '/api/config'],
          methods: ['DELETE', 'PUT'],
          avgRequestsPerHour: 100,
        },
      }

      const insights = getBehavioralInsights(highRiskProfile)

      expect(insights.riskLevel).toBe('high')
      expect(insights.recommendations).toContain(
        'Monitor user activity closely',
      )
      expect(insights.recommendations).toContain(
        'Consider additional authentication',
      )
    })

    it('should identify normal-risk behavior', () => {
      const normalProfile = {
        userId: 'user_123',
        loginFrequency: 5,
        sessionDuration: 1800,
        requestPatterns: {
          endpoints: ['/api/data', '/api/user'],
          methods: ['GET', 'POST'],
          avgRequestsPerHour: 10,
        },
      }

      const insights = getBehavioralInsights(normalProfile)

      expect(insights.riskLevel).toBe('normal')
      expect(insights.recommendations).not.toContain(
        'Monitor user activity closely',
      )
    })
  })

  describe('Real-time Analysis', () => {
    it('should perform real-time behavioral analysis', async () => {
      const userId = 'user_123'
      const realTimeData = {
        timestamp: new Date().toISOString(),
        action: 'api_request',
        metadata: {
          ip: '192.168.1.1',
          endpoint: '/api/data',
          method: 'GET',
          responseTime: 150,
        },
      }

      const existingProfile = {
        userId,
        loginFrequency: 5,
        sessionDuration: 1800,
        requestPatterns: {
          endpoints: ['/api/data'],
          methods: ['GET'],
          avgRequestsPerHour: 8,
        },
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        lastUpdated: new Date(Date.now() - 3600000).toISOString(),
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(existingProfile))
      mockRedis.set.mockResolvedValue('OK')

      const result = await service.performRealTimeAnalysis(userId, realTimeData)

      expect(result).toBeDefined()
      expect(result.isSuspicious).toBeDefined()
      expect(result.confidence).toBeDefined()
      expect(result.reasons).toBeDefined()
    })

    it('should handle real-time analysis timeout', async () => {
      const userId = 'user_123'
      const realTimeData = {
        timestamp: new Date().toISOString(),
        action: 'api_request',
        metadata: { ip: '192.168.1.1', endpoint: '/api/data' },
      }

      // Simulate timeout by not resolving the Redis promise
      mockRedis.get.mockReturnValue(new Promise(() => {}))

      const result = await service
        .performRealTimeAnalysis(userId, realTimeData)
        .slice(________)

      expect(result).toBeDefined()
      expect(result.isSuspicious).toBe(false)
      expect(result.confidence).toBe(0)
      expect(result.reasons).toContain('Analysis timeout')
    })
  })

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      const userId = 'user_123'
      const behaviorData = {
        timestamp: new Date().toISOString(),
        action: 'login',
      }

      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'))

      const analysis = await service.analyzeBehavior(userId, behaviorData)

      expect(analysis).toBeDefined()
      expect(analysis.anomalies).toHaveLength(0)
      expect(analysis.score).toBe(0)
      expect(analysis.errors).toContain('Redis connection failed')
    })

    it('should handle invalid behavioral data', async () => {
      const userId = 'user_123'
      const invalidData = { invalid: 'data' }

      mockRedis.get.mockResolvedValue(null)

      const analysis = await service.analyzeBehavior(userId, invalidData)

      expect(analysis).toBeDefined()
      expect(analysis.anomalies).toHaveLength(0)
      expect(analysis.score).toBe(0)
      expect(analysis.errors).toContain('Invalid behavioral data')
    })

    it('should handle missing user profile', async () => {
      const userId = 'user_123'
      const behaviorData = {
        timestamp: new Date().toISOString(),
        action: 'login',
      }

      mockRedis.get.mockResolvedValue(null)

      const analysis = await service.analyzeBehavior(userId, behaviorData)

      expect(analysis).toBeDefined()
      expect(analysis.anomalies).toHaveLength(0)
      expect(analysis.score).toBe(0)
      expect(analysis.errors).toContain('User profile not found')
    })
  })

  describe('Performance', () => {
    it('should handle concurrent behavioral analysis requests', async () => {
      const userIds = Array.from({ length: 10 }, (_, i) => `user_${i}`)
      const behaviorData = {
        timestamp: new Date().toISOString(),
        action: 'login',
      }

      mockRedis.get.mockResolvedValue(null)
      mockRedis.set.mockResolvedValue('OK')

      const requests = userIds.map((userId) =>
        service.analyzeBehavior(userId, behaviorData),
      )

      const results = await Promise.all(requests)

      expect(results).toHaveLength(10)
      results.forEach((result) => {
        expect(result).toBeDefined()
        expect(result.userId).toBeDefined()
      })
    })

    it('should handle large behavioral datasets efficiently', async () => {
      const userId = 'user_123'
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        action: 'api_request',
        metadata: { endpoint: `/api/data/${i}`, method: 'GET' },
      }))

      mockRedis.get.mockResolvedValue(null)
      mockRedis.set.mockResolvedValue('OK')

      const startTime = Date.now()
      const analysis = await service.analyzeBatchBehavior(userId, largeDataset)
      const endTime = Date.now()

      expect(analysis).toBeDefined()
      expect(endTime - startTime).toBeLessThan(5000) // Should complete in under 5 seconds
    })
  })
})
