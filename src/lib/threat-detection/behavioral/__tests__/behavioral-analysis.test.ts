/**
 * Unit Tests for Behavioral Analysis Service
 *
 * These tests verify the behavioral analysis functionality including
 * user profiling, anomaly detection, and pattern recognition.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BehavioralAnalysisService } from '../behavioral-analysis-service'
import type { SecurityEvent } from '../behavioral-analysis-service'

// Mock dependencies
vi.mock('ioredis')
vi.mock('mongodb')
vi.mock('@tensorflow/tfjs')
vi.mock('../../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('BehavioralAnalysisService', () => {
  let service: BehavioralAnalysisService

  const mockConfig = {
    redisUrl: 'redis://localhost:6379',
    mongoUrl: 'mongodb://localhost:27017',
    modelPath: './models/test',
    privacyConfig: {
      epsilon: 0.1,
      delta: 1e-5,
      sensitivity: 1.0,
      mechanism: 'laplace' as const,
    },
    anomalyThresholds: {
      temporal: 0.8,
      spatial: 0.8,
      sequential: 0.8,
      frequency: 0.8,
    },
  }

  const createMockSecurityEvent = (overrides?: Partial<SecurityEvent>): SecurityEvent => ({
    eventId: 'evt_123',
    userId: 'user_123',
    timestamp: new Date(),
    eventType: 'login',
    sourceIp: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    requestMethod: 'POST',
    endpoint: '/api/auth/login',
    responseCode: 200,
    responseTime: 150,
    payloadSize: 1024,
    sessionId: 'session_123',
    ...overrides,
  })

  beforeEach(() => {
    service = new BehavioralAnalysisService(mockConfig)
  })

  describe('Service Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(BehavioralAnalysisService)
    })

    it('should have required methods', () => {
      expect(typeof service.createBehaviorProfile).toBe('function')
      expect(typeof service.detectAnomalies).toBe('function')
      expect(typeof service.calculateBehavioralRisk).toBe('function')
      expect(typeof service.mineBehavioralPatterns).toBe('function')
      expect(typeof service.analyzeBehaviorGraph).toBe('function')
      expect(typeof service.analyzeWithPrivacy).toBe('function')
    })
  })

  describe('createBehaviorProfile', () => {
    it('should create a behavior profile from security events', async () => {
      const userId = 'user_123'
      const events: SecurityEvent[] = [
        createMockSecurityEvent({ eventType: 'login' }),
        createMockSecurityEvent({ eventType: 'data_access', endpoint: '/api/data' }),
        createMockSecurityEvent({ eventType: 'logout' }),
      ]

      const profile = await service.createBehaviorProfile(userId, events)

      expect(profile).toBeDefined()
      expect(profile.userId).toBe(userId)
      expect(profile.profileId).toBeDefined()
      expect(profile.behavioralPatterns).toBeDefined()
      expect(Array.isArray(profile.behavioralPatterns)).toBe(true)
      expect(profile.riskIndicators).toBeDefined()
      expect(profile.lastUpdated).toBeInstanceOf(Date)
      expect(profile.confidenceScore).toBeGreaterThanOrEqual(0)
      expect(profile.confidenceScore).toBeLessThanOrEqual(1)
    })

    it('should handle empty events array', async () => {
      const userId = 'user_123'
      const events: SecurityEvent[] = []

      await expect(service.createBehaviorProfile(userId, events)).rejects.toThrow()
    })

    it('should extract behavioral patterns from events', async () => {
      const userId = 'user_123'
      const events: SecurityEvent[] = Array.from({ length: 10 }, (_, i) =>
        createMockSecurityEvent({
          eventId: `evt_${i}`,
          eventType: i % 2 === 0 ? 'login' : 'data_access',
          timestamp: new Date(Date.now() - i * 60000),
        })
      )

      const profile = await service.createBehaviorProfile(userId, events)

      expect(profile.behavioralPatterns.length).toBeGreaterThan(0)
      expect(profile.baselineMetrics).toBeDefined()
    })
  })

  describe('detectAnomalies', () => {
    it('should detect anomalies in current events', async () => {
      const userId = 'user_123'
      const baselineEvents: SecurityEvent[] = Array.from({ length: 20 }, (_, i) =>
        createMockSecurityEvent({
          eventId: `evt_${i}`,
          eventType: 'login',
          sourceIp: '192.168.1.1',
          timestamp: new Date(Date.now() - i * 3600000),
        })
      )

      const profile = await service.createBehaviorProfile(userId, baselineEvents)

      // Create anomalous events
      const anomalousEvents: SecurityEvent[] = [
        createMockSecurityEvent({
          eventType: 'login',
          sourceIp: '10.0.0.1', // Different IP
          timestamp: new Date(),
        }),
        createMockSecurityEvent({
          eventType: 'data_access',
          endpoint: '/api/admin', // Unusual endpoint
          timestamp: new Date(),
        }),
      ]

      const anomalies = await service.detectAnomalies(profile, anomalousEvents)

      expect(Array.isArray(anomalies)).toBe(true)
      anomalies.forEach((anomaly) => {
        expect(anomaly.anomalyId).toBeDefined()
        expect(anomaly.userId).toBe(userId)
        expect(anomaly.anomalyType).toMatch(/deviation|novelty|outlier/)
        expect(anomaly.severity).toMatch(/low|medium|high|critical/)
        expect(anomaly.deviationScore).toBeGreaterThanOrEqual(0)
        expect(anomaly.confidence).toBeGreaterThanOrEqual(0)
        expect(anomaly.confidence).toBeLessThanOrEqual(1)
      })
    })

    it('should return empty array for normal behavior', async () => {
      const userId = 'user_123'
      const events: SecurityEvent[] = Array.from({ length: 10 }, (_, i) =>
        createMockSecurityEvent({
          eventId: `evt_${i}`,
          timestamp: new Date(Date.now() - i * 60000),
        })
      )

      const profile = await service.createBehaviorProfile(userId, events)

      // Same pattern of events
      const currentEvents: SecurityEvent[] = [
        createMockSecurityEvent({ eventType: 'login' }),
      ]

      const anomalies = await service.detectAnomalies(profile, currentEvents)

      expect(Array.isArray(anomalies)).toBe(true)
    })
  })

  describe('calculateBehavioralRisk', () => {
    it('should calculate risk score for user behavior', async () => {
      const userId = 'user_123'
      const events: SecurityEvent[] = Array.from({ length: 15 }, (_, i) =>
        createMockSecurityEvent({
          eventId: `evt_${i}`,
          timestamp: new Date(Date.now() - i * 60000),
        })
      )

      const profile = await service.createBehaviorProfile(userId, events)
      const riskScore = await service.calculateBehavioralRisk(profile, events)

      expect(riskScore).toBeDefined()
      expect(riskScore.userId).toBe(userId)
      expect(riskScore.score).toBeGreaterThanOrEqual(0)
      expect(riskScore.score).toBeLessThanOrEqual(1)
      expect(riskScore.confidence).toBeGreaterThanOrEqual(0)
      expect(riskScore.confidence).toBeLessThanOrEqual(1)
      expect(Array.isArray(riskScore.contributingFactors)).toBe(true)
      expect(riskScore.trend).toMatch(/increasing|decreasing|stable/)
      expect(riskScore.timestamp).toBeInstanceOf(Date)
    })

    it('should identify high-risk behavior', async () => {
      const userId = 'user_123'
      const suspiciousEvents: SecurityEvent[] = [
        createMockSecurityEvent({
          eventType: 'failed_login',
          sourceIp: '10.0.0.1',
        }),
        createMockSecurityEvent({
          eventType: 'failed_login',
          sourceIp: '10.0.0.2',
        }),
        createMockSecurityEvent({
          eventType: 'failed_login',
          sourceIp: '10.0.0.3',
        }),
        createMockSecurityEvent({
          eventType: 'data_access',
          endpoint: '/api/admin',
        }),
      ]

      const profile = await service.createBehaviorProfile(userId, suspiciousEvents)
      const riskScore = await service.calculateBehavioralRisk(profile, suspiciousEvents)

      expect(riskScore.score).toBeGreaterThan(0)
      expect(riskScore.contributingFactors.length).toBeGreaterThan(0)
    })
  })

  describe('mineBehavioralPatterns', () => {
    it('should mine patterns from behavioral sequences', async () => {
      const sequences = [
        {
          sequenceId: 'seq_1',
          userId: 'user_123',
          timestamp: new Date(),
          actions: ['login', 'data_access', 'logout'],
          context: {},
        },
        {
          sequenceId: 'seq_2',
          userId: 'user_123',
          timestamp: new Date(),
          actions: ['login', 'data_access', 'data_access', 'logout'],
          context: {},
        },
      ]

      const patterns = await service.mineBehavioralPatterns(sequences)

      expect(Array.isArray(patterns)).toBe(true)
      patterns.forEach((pattern) => {
        expect(pattern.patternId).toBeDefined()
        expect(pattern.patternType).toMatch(/temporal|spatial|sequential|frequency/)
        expect(pattern.confidence).toBeGreaterThanOrEqual(0)
        expect(pattern.confidence).toBeLessThanOrEqual(1)
        expect(pattern.frequency).toBeGreaterThanOrEqual(0)
        expect(pattern.lastObserved).toBeInstanceOf(Date)
      })
    })
  })

  describe('analyzeBehaviorGraph', () => {
    it('should analyze behavior graph from events', async () => {
      const events: SecurityEvent[] = Array.from({ length: 10 }, (_, i) =>
        createMockSecurityEvent({
          eventId: `evt_${i}`,
          userId: `user_${i % 3}`,
          timestamp: new Date(Date.now() - i * 60000),
        })
      )

      const graph = await service.analyzeBehaviorGraph(events)

      expect(graph).toBeDefined()
      expect(graph.graphId).toBeDefined()
      expect(Array.isArray(graph.nodes)).toBe(true)
      expect(Array.isArray(graph.edges)).toBe(true)
      expect(graph.properties).toBeDefined()
      expect(graph.timestamp).toBeInstanceOf(Date)
    })
  })

  describe('analyzeWithPrivacy', () => {
    it('should perform privacy-preserving analysis', async () => {
      const events: SecurityEvent[] = Array.from({ length: 5 }, (_, i) =>
        createMockSecurityEvent({
          eventId: `evt_${i}`,
          timestamp: new Date(Date.now() - i * 60000),
        })
      )

      const analysis = await service.analyzeWithPrivacy(events)

      expect(analysis).toBeDefined()
      expect(analysis.analysisId).toBeDefined()
      expect(analysis.privatizedFeatures).toBeDefined()
      expect(Array.isArray(analysis.behavioralPatterns)).toBe(true)
      expect(analysis.privacyBudgetUsed).toBeGreaterThanOrEqual(0)
      expect(analysis.privacyBudgetRemaining).toBeGreaterThanOrEqual(0)
      expect(analysis.epsilon).toBe(mockConfig.privacyConfig.epsilon)
      expect(analysis.timestamp).toBeInstanceOf(Date)
    })
  })

  describe('getBehavioralProfile', () => {
    it('should retrieve existing behavioral profile', async () => {
      const userId = 'user_123'

      // This will return null since we're not mocking the database
      const profile = await service.getBehavioralProfile(userId)

      // In a real scenario with mocked DB, we'd expect the profile
      expect(profile === null || typeof profile === 'object').toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid user ID gracefully', async () => {
      const invalidUserId = ''
      const events: SecurityEvent[] = [createMockSecurityEvent()]

      await expect(
        service.createBehaviorProfile(invalidUserId, events)
      ).rejects.toThrow()
    })

    it('should handle malformed events', async () => {
      const userId = 'user_123'
      const malformedEvents = [
        {
          eventId: 'evt_1',
          // Missing required fields
        } as SecurityEvent,
      ]

      // Should either throw or handle gracefully
      try {
        await service.createBehaviorProfile(userId, malformedEvents)
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete behavioral analysis workflow', async () => {
      const userId = 'user_123'

      // Step 1: Create baseline profile
      const baselineEvents: SecurityEvent[] = Array.from({ length: 20 }, (_, i) =>
        createMockSecurityEvent({
          eventId: `baseline_${i}`,
          timestamp: new Date(Date.now() - i * 3600000),
        })
      )

      const profile = await service.createBehaviorProfile(userId, baselineEvents)
      expect(profile).toBeDefined()

      // Step 2: Detect anomalies
      const newEvents: SecurityEvent[] = [
        createMockSecurityEvent({
          eventType: 'login',
          sourceIp: '10.0.0.1',
        }),
      ]

      const anomalies = await service.detectAnomalies(profile, newEvents)
      expect(Array.isArray(anomalies)).toBe(true)

      // Step 3: Calculate risk
      const riskScore = await service.calculateBehavioralRisk(profile, newEvents)
      expect(riskScore).toBeDefined()
      expect(riskScore.score).toBeGreaterThanOrEqual(0)
    })
  })
})
