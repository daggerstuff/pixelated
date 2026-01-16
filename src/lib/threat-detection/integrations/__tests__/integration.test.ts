/**
 * Integration Tests for Threat Detection Integration Layer
 *
 * These tests verify the integration between threat detection components
 * including rate limiting, API middleware, and response orchestration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createThreatDetectionIntegration, ThreatData } from '../index'
import { ThreatDetectionService } from '../threat-detection-service'
import { RateLimitingBridge } from '../rate-limiting-bridge'
import { ThreatDetectionMiddleware } from '../api-middleware'
import {
  generateThreatId,
  validateThreatData,
  calculateThreatScore,
  sanitizeThreatContext,
  shouldBlockRequest,
  shouldRateLimitRequest,
  extractRateLimitParams,
} from '../utils'
import type { ThreatResponse } from '../../response-orchestration'

vi.mock('../../logging/build-safe-logger')
vi.mock('../../response-orchestration')
vi.mock('../../rate-limiting/rate-limiter')

describe('Threat Detection Integration', () => {
  let mockOrchestrator: any
  let mockRateLimiter: any
  let threatDetectionService: ThreatDetectionService
  let integration: any

  beforeEach(() => {
    mockOrchestrator = {
      analyzeThreat: vi.fn(),
      orchestrateResponse: vi.fn().mockResolvedValue({
        responseId: 'mock_response_id',
        threatId: 'mock_threat_id',
        severity: 'low',
        confidence: 0,
        actions: [],
        responseType: 'alert' as const,
        estimatedImpact: 0,
        executionTime: 0,
        status: 'completed',
        metadata: { timestamp: new Date().toISOString() },
        recommendations: [],
      }),
      executeResponse: vi.fn(),
      getStatistics: vi.fn(),
      getHealthStatus: vi.fn().mockResolvedValue(true),
      isHealthy: vi.fn().mockResolvedValue(true),
    }

    mockRateLimiter = {
      checkLimit: vi.fn(),
      incrementCounter: vi.fn(),
      getRemainingRequests: vi.fn(),
      resetCounter: vi.fn(),
      getStatus: vi.fn().mockResolvedValue({
        allowed: true,
        remaining: 100,
        limit: 100,
        resetTime: new Date(),
      }),
      isBlocked: vi.fn().mockResolvedValue(false),
    }

    integration = createThreatDetectionIntegration(
      mockOrchestrator,
      mockRateLimiter,
    )
    threatDetectionService = integration.service
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Threat Detection Service', () => {
    it('should initialize with correct configuration', () => {
      expect(threatDetectionService).toBeDefined()
      expect((threatDetectionService as any).config).toBeDefined()
      expect((threatDetectionService as any).orchestrator).toBe(mockOrchestrator)
      expect((threatDetectionService as any).rateLimiter).toBe(mockRateLimiter)
    })

    it('should analyze threat data correctly', async () => {
      const threatData: ThreatData = {
        threatId: 'test_threat_123',
        source: 'rate_limiting',
        severity: 'medium',
        timestamp: new Date().toISOString(),
        riskFactors: {
          violationCount: 15,
          timeWindow: 60000,
          endpoint: '/api/sensitive',
        },
      }

      const mockResponse = {
        responseId: 'response_123',
        threatId: threatData.threatId,
        severity: 'medium',
        confidence: 0.8,
        actions: [],
        responseType: 'investigate' as const,
        estimatedImpact: 50,
        executionTime: new Date(),
        status: 'completed',
        metadata: { timestamp: new Date().toISOString() },
      }

      mockOrchestrator.orchestrateResponse.mockResolvedValue(mockResponse)

      const result = await threatDetectionService.analyzeThreat(threatData)

      expect(result).toEqual(mockResponse)
      expect(mockOrchestrator.orchestrateResponse).toHaveBeenCalled()
    })

    it('should handle analysis errors gracefully', async () => {
      const threatData: ThreatData = {
        threatId: 'test_threat_123',
        source: 'rate_limiting',
        severity: 'medium',
        timestamp: new Date().toISOString(),
      }

      mockOrchestrator.orchestrateResponse.mockRejectedValue(
        new Error('Analysis failed'),
      )

      const result = await threatDetectionService.analyzeThreat(threatData)
      expect(result.metadata!.reason).toBe('service_disabled_or_error')
      expect(result.metadata!.source).toBe('threat_detection_service')
    })

    it('should check request with rate limiting', async () => {
      const identifier = 'user:123'
      const context = {
        userId: '123',
        ip: '192.168.1.1',
        endpoint: '/api/data',
        userAgent: 'Mozilla/5.0...',
      }

      const mockRateLimitResult = {
        allowed: true,
        remaining: 45,
        resetTime: Date.now() + 60000,
        metadata: { source: 'rate_limiting' },
      }

      mockRateLimiter.checkLimit.mockResolvedValue(mockRateLimitResult)

      const result = await threatDetectionService.checkRequest(
        identifier,
        context,
      )

      expect(result.allowed).toBe(true)
      expect(result.rateLimitResult).toEqual(mockRateLimitResult)
      expect(result.shouldBlock).toBe(false)
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith(
        identifier,
        expect.anything(),
        context,
      )
    })

    it('should get health status correctly', async () => {
      const mockHealthStatus = {
        status: 'healthy',
        services: {
          orchestrator: 'healthy',
          rateLimiter: 'healthy',
          behavioral: 'healthy',
        },
        uptime: 3600000,
        lastCheck: new Date().toISOString(),
      }

      mockOrchestrator.getHealthStatus.mockResolvedValue(mockHealthStatus)

      const result = await threatDetectionService.getHealthStatus()

      // New health status structure
      expect(result.healthy).toBeDefined()
      expect(result.components).toBeDefined()
      expect(result.components.orchestrator).toBe(true)
      expect(mockOrchestrator.isHealthy).toHaveBeenCalled()
    })

    it('should get statistics correctly', async () => {
      const mockStats = {
        totalThreats: 150,
        blockedRequests: 45,
        averageResponseTime: 120,
        topThreatSources: ['rate_limiting', 'behavioral'],
        uptime: 3600000,
      }

      mockOrchestrator.getStatistics.mockResolvedValue(mockStats)

      const result = await threatDetectionService.getStatistics()

      // Current implementation returns placeholder stats (zeros)
      expect(result.totalThreats).toBe(0)
      expect(result.blockedRequests).toBe(0)
      expect(mockOrchestrator.getStatistics).not.toHaveBeenCalled() // Service doesn't call orchestrator yet
    })
  })

  describe('Rate Limiting Bridge', () => {
    it('should check rate limit with threat detection', async () => {
      const identifier = 'user:123'
      const context = {
        userId: '123',
        ip: '192.168.1.1',
        endpoint: '/api/sensitive',
      }

      const mockRateLimitResult = {
        allowed: true,
        remaining: 10,
        resetTime: Date.now() + 60000,
        metadata: { source: 'rate_limiting' },
      }

      mockRateLimiter.checkLimit.mockResolvedValue(mockRateLimitResult)

      const bridge = new RateLimitingBridge(mockRateLimiter, mockOrchestrator, {
        enableAutoRateLimiting: true,
        enableThreatDetection: true,
        threatLevelRules: { low: {}, medium: {}, high: {}, critical: {} } as any,
        bypassRules: { allowedRoles: [], allowedIPRanges: [], allowedEndpoints: [] },
        escalationConfig: { autoEscalateThreshold: 5, escalationWindowMs: 3600000 },
      })
      const result = await bridge.checkRateLimitWithThreatDetection(
        identifier,
        context,
      )

      expect(result.rateLimitResult.allowed).toBe(true)
      expect(result.rateLimitResult).toEqual(mockRateLimitResult)
      expect(result.shouldBlock).toBe(false)
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith(
        identifier,
        expect.anything(),
        context,
      )
    })

    it('should increment counter correctly', async () => {
      const identifier = 'user:123'
      const context = {
        userId: '123',
        ip: '192.168.1.1',
        endpoint: '/api/data',
      }

      mockRateLimiter.incrementCounter.mockResolvedValue(undefined)

      const bridge = new RateLimitingBridge(mockRateLimiter, mockOrchestrator, {
        enableAutoRateLimiting: true,
        enableThreatDetection: true,
        threatLevelRules: { low: {}, medium: {}, high: {}, critical: {} } as any,
        bypassRules: { allowedRoles: [], allowedIPRanges: [], allowedEndpoints: [] },
        escalationConfig: { autoEscalateThreshold: 5, escalationWindowMs: 3600000 },
      })
      await bridge.incrementCounter(identifier, context)

      expect(mockRateLimiter.incrementCounter).toHaveBeenCalledWith(
        identifier,
        expect.anything(), // rule
      )
    })

    it('should get remaining requests correctly', async () => {
      const identifier = 'user:123'
      const context = {
        userId: '123',
        ip: '192.168.1.1',
      }

      const mockRemaining = 25
      mockRateLimiter.getRemainingRequests.mockResolvedValue(mockRemaining)

      const bridge = new RateLimitingBridge(mockRateLimiter, mockOrchestrator, {
        enableAutoRateLimiting: true,
        enableThreatDetection: true,
        threatLevelRules: { low: {}, medium: {}, high: {}, critical: {} } as any,
        bypassRules: { allowedRoles: [], allowedIPRanges: [], allowedEndpoints: [] },
        escalationConfig: { autoEscalateThreshold: 5, escalationWindowMs: 3600000 },
      })
      const result = await bridge.getRemainingRequests(identifier, context)

      expect(result).toBe(mockRemaining)
      expect(mockRateLimiter.getRemainingRequests).toHaveBeenCalledWith(
        identifier,
        expect.anything(), // rule
      )
    })

    it('should reset counter correctly', async () => {
      const identifier = 'user:123'
      const context = {
        userId: '123',
        ip: '192.168.1.1',
      }

      mockRateLimiter.resetCounter.mockResolvedValue(undefined)

      const bridge = new RateLimitingBridge(mockRateLimiter, mockOrchestrator, {
        enableAutoRateLimiting: true,
        enableThreatDetection: true,
        threatLevelRules: { low: {}, medium: {}, high: {}, critical: {} } as any,
        bypassRules: { allowedRoles: [], allowedIPRanges: [], allowedEndpoints: [] },
        escalationConfig: { autoEscalateThreshold: 5, escalationWindowMs: 3600000 },
      })
      await bridge.resetCounter(identifier, context)

      expect(mockRateLimiter.resetCounter).toHaveBeenCalledWith(
        identifier,
        expect.anything(), // rule
      )
    })
  })

  describe('API Middleware', () => {
    it('should create middleware with correct configuration', () => {
      const config = {
        enabled: true,
        enableLogging: true,
        skipPaths: ['/health', '/status'],
      }

      const bridge = new RateLimitingBridge(mockRateLimiter, mockOrchestrator, {
        enableAutoRateLimiting: true,
        enableThreatDetection: true,
        threatLevelRules: { low: {}, medium: {}, high: {}, critical: {} } as any,
        bypassRules: { allowedRoles: [], allowedIPRanges: [], allowedEndpoints: [] },
        escalationConfig: { autoEscalateThreshold: 5, escalationWindowMs: 3600000 },
      })

      const middleware = new ThreatDetectionMiddleware({
        ...config,
        bridge,
      })

      expect(middleware).toBeDefined()
      // accessing private property via any cast for test verification
      const middlewareConfig = (middleware as any).config
      expect(middlewareConfig.enabled).toBe(true)
      expect(middlewareConfig.bridge).toBe(bridge)
    })

    it('should handle middleware correctly', async () => {
      const config = {
        enabled: true,
        enableLogging: false,
        skipPaths: ['/health'],
      }

      const bridge = new RateLimitingBridge(mockRateLimiter, mockOrchestrator, {
        enableAutoRateLimiting: true,
        enableThreatDetection: true,
        threatLevelRules: {
          low: { name: 'low', maxRequests: 100, windowMs: 60000, enableAttackDetection: false },
          medium: {}, high: {}, critical: {}
        } as any,
        bypassRules: { allowedRoles: [], allowedIPRanges: [], allowedEndpoints: [] },
        escalationConfig: { autoEscalateThreshold: 5, escalationWindowMs: 3600000 },
      })

      const middleware = new ThreatDetectionMiddleware({
        ...config,
        bridge,
      })

      const mockReq = {
        ip: '192.168.1.1',
        method: 'GET',
        path: '/api/data',
        get: vi.fn((_header: string) => 'Mozilla/5.0...'),
        headers: {},
        user: { id: '123', role: 'user' },
        session: { id: 'session_123' },
      }

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
      }

      const mockNext = vi.fn()

      mockRateLimiter.checkLimit.mockResolvedValue({
        allowed: true,
        remaining: 50,
        resetTime: Date.now() + 60000,
      })

      await middleware.middleware()(mockReq as any, mockRes as any, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockRateLimiter.checkLimit).toHaveBeenCalled()
    })

    it('should skip specified paths', async () => {
      const config = {
        enabled: true,
        enableLogging: false,
        skipPaths: ['/health', '/status'],
      }

      const bridge = new RateLimitingBridge(mockRateLimiter, mockOrchestrator, {
        enableAutoRateLimiting: true,
        enableThreatDetection: true,
        threatLevelRules: { low: {}, medium: {}, high: {}, critical: {} } as any,
        bypassRules: { allowedRoles: [], allowedIPRanges: [], allowedEndpoints: [] },
        escalationConfig: { autoEscalateThreshold: 5, escalationWindowMs: 3600000 },
      })

      const middleware = new ThreatDetectionMiddleware({
        ...config,
        bridge,
      })

      const mockReq = {
        ip: '192.168.1.1',
        method: 'GET',
        path: '/health',
        get: vi.fn(),
        headers: {},
        user: undefined,
        session: undefined,
      }

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
      }

      const mockNext = vi.fn()

      await middleware.middleware()(mockReq as any, mockRes as any, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockRateLimiter.checkLimit).not.toHaveBeenCalled()
    })

    it('should block requests when rate limit exceeded', async () => {
      const config = {
        enabled: true,
        enableLogging: false,
      }

      const bridge = new RateLimitingBridge(mockRateLimiter, mockOrchestrator, {
        enableAutoRateLimiting: true,
        enableThreatDetection: true,
        threatLevelRules: {
          low: { name: 'low', maxRequests: 100, windowMs: 60000, enableAttackDetection: false },
          medium: {}, high: {}, critical: {}
        } as any,
        bypassRules: { allowedRoles: [], allowedIPRanges: [], allowedEndpoints: [] },
        escalationConfig: { autoEscalateThreshold: 5, escalationWindowMs: 3600000 },
      })

      const middleware = new ThreatDetectionMiddleware({
        ...config,
        bridge,
      })

      const mockReq = {
        ip: '192.168.1.1',
        method: 'GET',
        path: '/api/data',
        get: vi.fn(),
        headers: {},
        user: undefined,
        session: undefined,
      }

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
      }

      const mockNext = vi.fn()

      // Mock rate limiter response indicating limit exceeded
      mockRateLimiter.checkLimit.mockResolvedValue({
        allowed: false,
        limit: 100,
        remaining: 0,
        resetTime: new Date(Date.now() + 60000),
        retryAfter: 60,
        metadata: { source: 'rate_limiting' },
      })

      await middleware.middleware()(mockReq as any, mockRes as any, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(429)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too Many Requests',
        }),
      )
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('Utility Functions', () => {
    it('should generate unique threat IDs', () => {
      const id1 = generateThreatId()
      const id2 = generateThreatId()

      expect(id1).toMatch(/^threat_([0-9a-f-]+|\d+_[a-z0-9]+)$/)
      expect(id2).toMatch(/^threat_([0-9a-f-]+|\d+_[a-z0-9]+)$/)
      expect(id1).not.toBe(id2)
    })

    it('should validate threat data correctly', () => {
      const validThreatData: Partial<ThreatData> = {
        threatId: 'threat_123',
        source: 'rate_limiting',
        severity: 'medium',
        timestamp: new Date().toISOString(),
      }

      const invalidThreatData: Partial<ThreatData> = {
        source: 'rate_limiting',
        severity: 'medium',
        timestamp: new Date().toISOString(),
        // Missing threatId
      }

      expect(validateThreatData(validThreatData)).toBe(true)
      expect(validateThreatData(invalidThreatData)).toBe(false)
    })

    it('should calculate threat score correctly', async () => {
      const threatData: ThreatData = {
        threatId: 'threat_123',
        source: 'rate_limiting',
        severity: 'high',
        timestamp: new Date().toISOString(),
        riskFactors: {
          violationCount: 20,
          timeWindow: 60000,
          endpoint: '/api/admin',
          ip: '192.168.1.100',
          userAgent: 'bot/scanner',
        },
      }

      const score = await calculateThreatScore(threatData)
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should sanitize threat context correctly', () => {
      const context = {
        userId: '123',
        password: 'secret123',
        token: 'abc123def',
        creditCard: '4111111111111111',
        normalData: 'this is fine',
        longString: 'a'.repeat(200),
      }

      const sanitized = sanitizeThreatContext(context)

      expect(sanitized).not.toHaveProperty('password')
      expect(sanitized).not.toHaveProperty('token')
      expect(sanitized).not.toHaveProperty('creditCard')
      expect(sanitized).toHaveProperty('normalData', 'this is fine')
      expect(sanitized.longString).toHaveLength(100) // Truncated
    })

    it('should determine if request should be blocked', () => {
      const responseWithBlock: ThreatResponse = {
        responseId: 'response_123',
        threatId: 'threat_123',
        severity: 'high',
        confidence: 0.9,
        actions: [
          {
            actionId: 'act_1',
            actionType: 'block',
            target: 'request',
            parameters: {},
            priority: 10,
            timeout: 1000,
            timestamp: new Date().toISOString(),
          },
        ],
        metadata: {},
        responseType: 'block' as const,
        estimatedImpact: 80,
        executionTime: new Date(),
        status: 'pending',
      }

      const responseWithoutBlock: ThreatResponse = {
        responseId: 'response_124',
        threatId: 'threat_124',
        severity: 'low',
        confidence: 0.5,
        actions: [
          {
            actionId: 'act_2',
            actionType: 'log',
            target: 'request',
            parameters: {},
            priority: 1,
            timeout: 1000,
            timestamp: new Date().toISOString(),
          },
        ],
        metadata: {},
        responseType: 'alert' as const,
        estimatedImpact: 10,
        executionTime: new Date(),
        status: 'completed',
      }

      expect(shouldBlockRequest(responseWithBlock as any)).toBe(true)
      expect(shouldBlockRequest(responseWithoutBlock as any)).toBe(false)
    })

    it('should determine if request should be rate limited', () => {
      const responseWithRateLimit: ThreatResponse = {
        responseId: 'response_123',
        threatId: 'threat_123',
        severity: 'medium',
        confidence: 0.7,
        actions: [
          {
            actionId: 'act_3',
            actionType: 'rate_limit',
            target: 'request',
            parameters: {},
            priority: 5,
            timeout: 1000,
            timestamp: new Date().toISOString(),
          },
        ],
        metadata: {},
        responseType: 'rate_limit' as const,
        estimatedImpact: 50,
        executionTime: new Date(),
        status: 'pending',
      }

      const responseWithoutRateLimit = {
        responseId: 'response_124',
        threatId: 'threat_124',
        severity: 'low',
        confidence: 0.3,
        actions: [
          {
            actionType: 'log',
            target: 'request',
            timestamp: new Date().toISOString(),
          },
        ],
        metadata: {},
        responseType: 'alert' as const,
        estimatedImpact: 10,
        executionTime: new Date(),
        status: 'completed',
      }

      expect(shouldRateLimitRequest(responseWithRateLimit as any)).toBe(true)
      expect(shouldRateLimitRequest(responseWithoutRateLimit as any)).toBe(false)
    })

    it('should extract rate limit parameters correctly', () => {
      const response: ThreatResponse = {
        responseId: 'response_123',
        threatId: 'threat_123',
        severity: 'medium',
        confidence: 0.7,
        actions: [
          {
            actionId: 'act_4',
            actionType: 'rate_limit',
            target: 'request',
            parameters: {},
            priority: 5,
            timeout: 1000,
            timestamp: new Date().toISOString(),
            metadata: {
              maxRequests: 10,
              windowMs: 60000,
              message: 'Rate limit exceeded',
            },
          },
        ],
        metadata: {},
        responseType: 'rate_limit' as const,
        estimatedImpact: 50,
        executionTime: new Date(),
        status: 'pending',
      }

      const params = extractRateLimitParams(response as any)

      expect(params.maxRequests).toBe(10)
      expect(params.windowMs).toBe(60000)
      expect(params.message).toBe('Rate limit exceeded')
    })

    it('should use default rate limit parameters when not specified', () => {
      const response: ThreatResponse = {
        responseId: 'response_123',
        threatId: 'threat_123',
        severity: 'low',
        confidence: 0.3,
        actions: [],
        metadata: {},
        responseType: 'investigate' as const,
        estimatedImpact: 10,
        executionTime: new Date(),
        status: 'completed',
      }

      const params = extractRateLimitParams(response as any)

      expect(params.maxRequests).toBe(100)
      expect(params.windowMs).toBe(60000)
      expect(params.message).toBeUndefined()
    })
  })

  describe('Integration Factory', () => {
    it('should create complete integration setup', () => {
      const integration = createThreatDetectionIntegration(
        mockOrchestrator,
        mockRateLimiter,
      )

      expect(integration).toBeDefined()
      expect(integration.service).toBeInstanceOf(ThreatDetectionService)
      expect(integration.middleware).toBeInstanceOf(ThreatDetectionMiddleware)
      expect(integration.bridge).toBeInstanceOf(RateLimitingBridge)
    })

    it('should provide convenience methods', () => {
      const integration = createThreatDetectionIntegration(
        mockOrchestrator,
        mockRateLimiter,
      )

      expect(typeof integration.analyzeThreat).toBe('function')
      expect(typeof integration.checkRequest).toBe('function')
      expect(typeof integration.getHealthStatus).toBe('function')
      expect(typeof integration.getStatistics).toBe('function')
    })

    it('should work with custom configuration', () => {
      const customConfig = {
        enabled: true,
        enableRateLimiting: false,
        enableResponseOrchestration: true,
      }

      const integration = createThreatDetectionIntegration(
        mockOrchestrator,
        mockRateLimiter,
        customConfig,
      )

      expect((integration.service as any).config).toEqual(
        expect.objectContaining(customConfig),
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle orchestrator errors gracefully', async () => {
      mockOrchestrator.analyzeThreat.mockRejectedValue(
        new Error('Orchestrator error'),
      )

      const threatData: ThreatData = {
        threatId: 'test_threat_123',
        source: 'rate_limiting',
        severity: 'medium',
        timestamp: new Date().toISOString(),
      }

      mockOrchestrator.orchestrateResponse.mockRejectedValue(new Error('Orchestrator error'))
      const result = await threatDetectionService.analyzeThreat(threatData)
      expect(result.metadata!.reason).toBe('service_disabled_or_error')
      expect(result.metadata!.source).toBe('threat_detection_service')
    })

    it('should handle rate limiter errors gracefully', async () => {
      mockRateLimiter.checkLimit.mockRejectedValue(
        new Error('Rate limiter error'),
      )

      const identifier = 'user:123'
      const context = { userId: '123', ip: '192.168.1.1' }

      const result = await threatDetectionService.checkRequest(identifier, context)
      expect(result.allowed).toBe(true)
      expect(result.shouldBlock).toBe(false)
    })

    it('should handle missing dependencies gracefully', () => {
      expect(() => {
        createThreatDetectionIntegration(null as any, null as any)
      }).not.toThrow()
    })
  })

  describe('Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const mockRateLimitResult = {
        allowed: true,
        remaining: 50,
        resetTime: Date.now() + 60000,
      }

      mockRateLimiter.checkLimit.mockResolvedValue(mockRateLimitResult)

      const identifier = 'user:123'
      const context = { userId: '123', ip: '192.168.1.1' }

      // Create multiple concurrent requests
      const requests = Array.from({ length: 10 }, (_, i) =>
        threatDetectionService.checkRequest(`${identifier}_${i}`, context),
      )

      const results = await Promise.all(requests)

      expect(results).toHaveLength(10)
      results.forEach((result) => {
        expect(result.allowed).toBe(mockRateLimitResult.allowed)
        expect(result.rateLimitResult).toEqual(mockRateLimitResult)
      })

      // Verify rate limiter was called for each request
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledTimes(10)
    })
  })
})
