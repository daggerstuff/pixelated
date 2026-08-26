/**
 * Unit Tests for Behavioral Analysis Service
 *
 * These tests verify the behavioral analysis functionality including
 * user profiling, anomaly detection, and pattern recognition.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { IRedisClient, IMongoClient } from '../../threat-hunting/types'
import { BehavioralAnalysisRepository } from '../behavioral-analysis-repository'
import { AdvancedBehavioralAnalysisService } from '../behavioral-analysis-service'
import {
  detectAnomalies,
  calculateBehavioralScore,
  extractBehavioralFeatures,
  normalizeBehavioralData,
  detectPatternChanges,
  getBehavioralInsights,
} from '../behavioral-utils'

// Type-safe test interfaces
interface TestBehavioralEvent {
  eventId: string
  userId: string
  timestamp: Date
  eventType: string
  sourceIp: string
  userAgent: string
  requestMethod: string
  endpoint: string
  responseCode: number
  responseTime: number
  payloadSize: number
  sessionId: string
}

interface TestBehavioralProfile {
  userId: string
  profileId: string
  baselineMetrics: {
    timeOfDayThreshold: number
    geographicThreshold: number
  }
  anomalyThresholds: {
    temporal: number
    spatial: number
    sequential: number
    frequency: number
  }
}

// Test fixture factory
class BehavioralTestFixtures {
  static createEvent(
    overrides: Partial<TestBehavioralEvent> = {},
  ): TestBehavioralEvent {
    return {
      eventId: 'evt_1',
      userId: 'user_123',
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
      ...overrides,
    }
  }

  static createProfile(
    overrides: Partial<TestBehavioralProfile> = {},
  ): TestBehavioralProfile {
    return {
      userId: 'user_123',
      profileId: 'pid_1',
      baselineMetrics: {
        timeOfDayThreshold: 0.5,
        geographicThreshold: 0.5,
      },
      anomalyThresholds: {
        temporal: 0.8,
        spatial: 0.8,
        sequential: 0.8,
        frequency: 0.8,
      },
      ...overrides,
    }
  }

  static createEvents(
    count: number,
    baseOverrides: Partial<TestBehavioralEvent> = {},
  ): TestBehavioralEvent[] {
    return Array.from({ length: count }, (_, i) =>
      this.createEvent({ eventId: `evt_${i + 1}`, ...baseOverrides }),
    )
  }
}

// Define mock instances to capture calls
const mockRedisInstance = {
  get: vi.fn<(...args: unknown[]) => unknown>(),
  set: vi.fn<(...args: unknown[]) => unknown>(),
  setex: vi.fn<(...args: unknown[]) => unknown>(),
  del: vi.fn<(...args: unknown[]) => unknown>(),
  exists: vi.fn<(...args: unknown[]) => unknown>(),
  incr: vi.fn<(...args: unknown[]) => unknown>(),
  expire: vi.fn<(...args: unknown[]) => unknown>(),
  hget: vi.fn<(...args: unknown[]) => unknown>(),
  hset: vi.fn<(...args: unknown[]) => unknown>(),
  hgetall: vi.fn<(...args: unknown[]) => unknown>(),
  hdel: vi.fn<(...args: unknown[]) => unknown>(),
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
    add: vi.fn(),
    compile: vi.fn(),
    predict: vi.fn(() => ({
      dataSync: () => [0.1],
      data: () => Promise.resolve(new Float32Array([0.1])),
      dispose: vi.fn(),
    })),
  }

  return {
    sequential: vi.fn(() => mockModel),
    loadLayersModel: vi.fn().mockResolvedValue(mockModel),
    layers: {
      dense: vi.fn(),
      dropout: vi.fn(),
    },
    train: {
      adam: vi.fn(),
    },
    tidy: vi.fn((fn: any) => fn()),
    tensor2d: vi.fn(() => ({
      dispose: vi.fn(),
    })),
    mean: vi.fn(() => ({
      dataSync: () => [0.1],
      data: () => Promise.resolve(new Float32Array([0.1])),
      dispose: vi.fn(),
    })),
    abs: vi.fn(),
    sub: vi.fn(),
  }
})

vi.mock('../../logging/build-safe-logger')
vi.mock('../../response-orchestration')

describe('Behavioral Analysis Service', () => {
  let service: AdvancedBehavioralAnalysisService

  const defaultConfig = {
    mlEnabled: true,
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
    await service.initializeServices(
      mockRedisInstance as unknown as IRedisClient,
      mockMongoClientInstance as unknown as IMongoClient,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Service Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(service).toBeDefined()
      // Access private fields via type assertion for testing
      // expect((service as any).redis).toBeDefined() // Should use the mock
      // expect((service as any).mongoClient).toBeDefined()
    })
  })

  describe('User Profile Management', () => {
    /**
     * Helper to setup repository mocks with type safety
     */
    function setupRepositoryMocks(
      testService: AdvancedBehavioralAnalysisService,
      mocks: {
        getRecentEvents?: TestBehavioralEvent[]
        getProfile?: TestBehavioralProfile
        storeProfile?: boolean
      },
    ): BehavioralAnalysisRepository {
      const repo = (testService as any)
        .repository as BehavioralAnalysisRepository

      if (mocks.getRecentEvents) {
        vi.spyOn(repo, 'getRecentEvents').mockResolvedValue(
          mocks.getRecentEvents,
        )
      }
      if (mocks.getProfile) {
        vi.spyOn(repo, 'getProfile').mockResolvedValue(mocks.getProfile)
      }
      if (mocks.storeProfile !== undefined) {
        vi.spyOn(repo, 'storeProfile').mockResolvedValue(undefined)
      }

      return repo
    }

    it('should create behavioral profile for new user', async () => {
      const userId = 'user_123'
      const events = [BehavioralTestFixtures.createEvent({ userId })]

      mockRedisInstance.setex.mockResolvedValue('OK')
      const repo = setupRepositoryMocks(service, {
        getRecentEvents: events,
        storeProfile: true,
      })

      await service.createBehaviorProfile(userId)

      expect(repo.getRecentEvents).toHaveBeenCalledWith(userId, 500, undefined)
      expect(repo.storeProfile).toHaveBeenCalled()
    })

    it('should detect anomalies', async () => {
      const userId = 'user_123'
      const events = [BehavioralTestFixtures.createEvent({ userId })]
      const profile = BehavioralTestFixtures.createProfile({ userId })

      setupRepositoryMocks(service, { getProfile: profile })

      const anomalies = await service.detectAnomalies(userId, events[0])
      expect(anomalies).toBeDefined()
      expect(Array.isArray(anomalies)).toBe(true)
    })
  })

  describe('Utility Functions (Pure)', () => {
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
      })
    })

    describe('Data Normalization', () => {
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
    })

    describe('Pattern Change Detection', () => {
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
    })

    describe('Insight Generation', () => {
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
})
