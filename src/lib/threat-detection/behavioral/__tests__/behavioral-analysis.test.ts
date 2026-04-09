/**
 * Unit Tests for Behavioral Analysis Service
 *
 * These tests verify the behavioral analysis functionality including
 * user profiling, anomaly detection, and pattern recognition.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { AdvancedBehavioralAnalysisService } from '../behavioral-analysis-service'
import {
  detectAnomalies,
  calculateBehavioralScore,
  extractBehavioralFeatures,
  normalizeBehavioralData,
  detectPatternChanges,
  getBehavioralInsights,
} from '../behavioral-utils'

// Define mock instances to capture calls
const mockRedisInstance = {
  get: vi.fn<any>(),
  set: vi.fn<any>(),
  setex: vi.fn<any>(),
  del: vi.fn<any>(),
  exists: vi.fn<any>(),
  incr: vi.fn<any>(),
  expire: vi.fn<any>(),
  hget: vi.fn<any>(),
  hset: vi.fn<any>(),
  hgetall: vi.fn<any>(),
  hdel: vi.fn<any>(),
  hincrby: vi.fn<any>(),
  quit: vi.fn<any>(),
}

const mockDb = {
  collection: vi.fn(() => ({
    replaceOne: vi.fn<any>().mockResolvedValue({}),
    insertMany: vi.fn<any>().mockResolvedValue({}),
    insertOne: vi.fn<any>().mockResolvedValue({}),
  })),
}

const mockMongoClientInstance = {
  connect: vi.fn<any>().mockResolvedValue(undefined),
  db: vi.fn(() => mockDb),
  close: vi.fn<any>().mockResolvedValue(undefined),
}

// Mock external modules
vi.mock('ioredis', () => {
  return {
    Redis: vi.fn(function () {
      return mockRedisInstance
    }),
  }
})

vi.mock('mongodb', () => {
  return {
    MongoClient: vi.fn(function () {
      return mockMongoClientInstance
    }),
  }
})

vi.mock('@tensorflow/tfjs', () => {
  const mockModel = {
    add: vi.fn<any>(),
    compile: vi.fn<any>(),
    predict: vi.fn(() => ({
      dataSync: () => [0.1],
      dispose: vi.fn<any>(),
    })),
  }

  return {
    sequential: vi.fn(() => mockModel),
    layers: {
      dense: vi.fn<any>(),
      dropout: vi.fn<any>(),
    },
    train: {
      adam: vi.fn<any>(),
    },
    tidy: vi.fn((fn: any) => fn()),
    tensor2d: vi.fn<any>(),
    mean: vi.fn(() => ({ dataSync: () => [0.1] })),
    abs: vi.fn<any>(),
    sub: vi.fn<any>(),
  }
})

vi.mock('../../logging/build-safe-logger')
vi.mock('../../response-orchestration')

describe('Behavioral Analysis Service', () => {
  let service: AdvancedBehavioralAnalysisService
  let mockOrchestrator: any

  const defaultConfig = {
    redisUrl: 'redis://localhost:6379',
    mongoUrl: 'mongodb://localhost:27017',
    modelPath: '/tmp/model',
    privacyConfig: {
      epsilon: 1,
      delta: 1e-5,
      sensitivity: 1,
      mechanism: 'laplace' as const,
    },
    anomalyThresholds: {
      temporal: 0.8,
      spatial: 0.8,
      sequential: 0.8,
      frequency: 0.8,
    },
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    service = new AdvancedBehavioralAnalysisService(defaultConfig)
    // P4.2 FIX: Provide required mock dependencies
    await service.initializeServices(mockRedisInstance as any, mockMongoClientInstance as any)
  })

  describe('Service Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(service).toBeDefined()
      // Access private fields via type assertion for testing
      expect((service as any).redis).toBeDefined() // Should use the mock
      expect((service as any).mongoClient).toBeDefined()
    })
  })

  describe('User Profile Management', () => {
    it('should create behavioral profile for new user', async () => {
      const userId = 'user_123'
      const events: any[] = [
        {
          eventId: 'evt_1',
          userId,
          timestamp: new Date(),
          eventType: 'login',
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent',
          requestMethod: 'POST',
          endpoint: '/login',
          responseCode: 200,
          responseTime: 100,
          payloadSize: 100,
          sessionId: 'sess_1',
        },
      ]

      mockRedisInstance.setex.mockResolvedValue('OK')
      // Use internal repository mock via any to setup the expectation
      const repo = (service as any).repository
      vi.spyOn(repo, 'getRecentEvents').mockResolvedValue(events)
      vi.spyOn(repo, 'storeProfile').mockResolvedValue(undefined)

      await service.createBehaviorProfile(userId)

      expect(repo.getRecentEvents).toHaveBeenCalledWith(userId, 500)
      expect(repo.storeProfile).toHaveBeenCalled()
    })

    it('should detect anomalies', async () => {
      const userId = 'user_123'
      const events: any[] = [
        {
          eventId: 'evt_1',
          userId,
          timestamp: new Date(),
          eventType: 'login',
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent',
          requestMethod: 'POST',
          endpoint: '/login',
          responseCode: 200,
          responseTime: 100,
          payloadSize: 100,
          sessionId: 'sess_1',
        },
      ]

      const profile: any = {
        userId,
        profileId: 'pid_1',
        baselineMetrics: { timeOfDayThreshold: 0.5, geographicThreshold: 0.5 },
        anomalyThresholds: defaultConfig.anomalyThresholds,
      }

      const repo = (service as any).repository
      vi.spyOn(repo, 'getProfile').mockResolvedValue(profile)

      const anomalies = await service.detectAnomalies(userId, events[0])
      expect(anomalies).toBeDefined()
      expect(Array.isArray(anomalies)).toBe(true)
    })
  })

  // Keep the utility function tests as they were, they test pure functions
  describe('Anomaly Detection Utilities', () => {
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
      expect(anomalies.some((a: any) => a.type === 'unusual_ip')).toBe(true)
      expect(anomalies.some((a: any) => a.type === 'unusual_time')).toBe(true)
    })

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
    })

    it('should detect pattern changes', () => {
      const historicalData = [
        {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          action: 'login',
        },
      ]

      const currentData = [
        { timestamp: new Date().toISOString(), action: 'login' },
      ]

      const changes = detectPatternChanges(historicalData, currentData)
      expect(changes).toBeDefined()
    })

    it('should generate behavioral insights', () => {
      const userProfile = {
        userId: 'user_123',
        loginFrequency: 5,
        sessionDuration: 1800,
        requestPatterns: {
          endpoints: ['/api/data'],
          methods: ['GET'],
          avgRequestsPerHour: 15,
        },
        timePatterns: {
          peakHours: [14, 15, 16],
          activeDays: [1, 2, 3, 4, 5],
        },
      }

      const insights = getBehavioralInsights(userProfile)
      expect(insights).toBeDefined()
      expect(insights.riskLevel).toBeDefined()
    })
  })
})
