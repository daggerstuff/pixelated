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
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  hget: vi.fn(),
  hset: vi.fn(),
  hgetall: vi.fn(),
  hdel: vi.fn(),
  hincrby: vi.fn(),
  quit: vi.fn(),
}

const mockDb = {
  collection: vi.fn(() => ({
    replaceOne: vi.fn().mockResolvedValue({}),
    insertMany: vi.fn().mockResolvedValue({}),
    insertOne: vi.fn().mockResolvedValue({}),
  })),
}

const mockMongoClientInstance = {
  connect: vi.fn().mockResolvedValue(undefined),
  db: vi.fn(() => mockDb),
  close: vi.fn().mockResolvedValue(undefined),
}

// Mock external modules
vi.mock('ioredis', () => {
  return {
    Redis: vi.fn(function() { return mockRedisInstance })
  }
})

vi.mock('mongodb', () => {
  return {
    MongoClient: vi.fn(function() { return mockMongoClientInstance })
  }
})

vi.mock('@tensorflow/tfjs', () => {
  const mockModel = {
    add: vi.fn(),
    compile: vi.fn(),
    predict: vi.fn(() => ({
      dataSync: () => [0.1],
      dispose: vi.fn()
    })),
  }

  return {
    sequential: vi.fn(() => mockModel),
    layers: {
      dense: vi.fn(),
      dropout: vi.fn(),
    },
    train: {
      adam: vi.fn(),
    },
    tidy: vi.fn((fn: any) => fn()),
    tensor2d: vi.fn(),
    mean: vi.fn(() => ({ dataSync: () => [0.1] })),
    abs: vi.fn(),
    sub: vi.fn(),
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
      mechanism: 'laplace' as const
    },
    anomalyThresholds: {
      temporal: 0.8,
      spatial: 0.8,
      sequential: 0.8,
      frequency: 0.8
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    service = new AdvancedBehavioralAnalysisService(defaultConfig)
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
      const events: any[] = [{
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
        sessionId: 'sess_1'
      }]

      mockRedisInstance.setex.mockResolvedValue('OK')

      const profile = await service.createBehaviorProfile(userId, events)

      expect(profile).toBeDefined()
      expect(profile.userId).toBe(userId)
      expect(mockRedisInstance.setex).toHaveBeenCalled()
    })

    it('should detect anomalies', async () => {
      const userId = 'user_123'
      const events: any[] = [{
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
        sessionId: 'sess_1'
      }]

      const profile: any = {
        userId,
        profileId: 'pid_1',
        baselineMetrics: { timeOfDayThreshold: 0.5, geographicThreshold: 0.5 },
        anomalyThresholds: defaultConfig.anomalyThresholds
      }

      // Mock internal methods to avoid complex logic if needed, but integration test implies testing logic
      // We rely on mocks for IO.

      const anomalies = await service.detectAnomalies(profile, events)
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
      expect(anomalies.some((a) => a.type === 'unusual_ip')).toBe(true)
      expect(anomalies.some((a) => a.type === 'unusual_time')).toBe(true)
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
