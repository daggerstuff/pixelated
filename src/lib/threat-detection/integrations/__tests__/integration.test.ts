/**
 * Integration Tests for Threat Detection Integration Layer
 *
 * These tests verify the integration between threat detection components
 * including rate limiting, API middleware, and response orchestration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createThreatDetectionIntegration } from '../index'
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
      executeResponse: vi.fn(),
      getStatistics: vi.fn(),
      getHealthStatus: vi.fn(),
    }

    mockRateLimiter = {
      checkRateLimit: vi.fn(),
      incrementCounter: vi.fn(),
      getRemainingRequests: vi.fn(),
      resetCounter: vi.fn(),
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
      expect(threatDetectionService.config).toBeDefined()
      expect(threatDetectionService.orchestrator).toBe(mockOrchestrator)
      expect(threatDetectionService.rateLimiter).toBe(mockRateLimiter)
    })

    it('should analyze threat data correctly', async () => {
      const threatData = {
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
        recommendations: ['Monitor user activity'],
        metadata: { timestamp: new Date().toISOString() },
      }

      mockOrchestrator.analyzeThreat.mockResolvedValue(mockResponse)

      const result = await threatDetectionService.analyzeThreat(threatData)

      expect(result).toEqual(mockResponse)
      expect(mockOrchestrator.analyzeThreat).toHaveBeenCalledWith(threatData)
    })

    it('should handle analysis errors gracefully', async () => {
      const threatData = {
        threatId: 'test_threat_123',
        source: 'rate_limiting',
        severity: 'medium',
        timestamp: new Date().toISOString(),
      }

      mockOrchestrator.analyzeThreat.mockRejectedValue(
        new Error('Analysis failed'),
      )

      await expect(
        threatDetectionService.analyzeThreat(threatData),
      ).rejects.toThrow('Analysis failed')
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

      mockRateLimiter.checkRateLimit.mockResolvedValue(mockRateLimitResult)

      const result = await threatDetectionService.checkRequest(
        identifier,
        context,
      )

      expect(result).toEqual(mockRateLimitResult)
      expect(mockRateLimiter.checkRateLimit).toHaveBeenCalledWith(
        identifier,
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

      expect(result).toEqual(mockHealthStatus)
      expect(mockOrchestrator.getHealthStatus).toHaveBeenCalled()
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

      expect(result).toEqual(mockStats)
      expect(mockOrchestrator.getStatistics).toHaveBeenCalled()
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

      mockRateLimiter.checkRateLimit.mockResolvedValue(mockRateLimitResult)

      const bridge = new RateLimitingBridge(mockOrchestrator, mockRateLimiter)
      const result = await bridge.checkRateLimitWithThreatDetection(
        identifier,
        context,
      )

      expect(result).toEqual(mockRateLimitResult)
      expect(mockRateLimiter.checkRateLimit).toHaveBeenCalledWith(
        identifier,
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

      const bridge = new RateLimitingBridge(mockOrchestrator, mockRateLimiter)
      await bridge.incrementCounter(identifier, context)

      expect(mockRateLimiter.incrementCounter).toHaveBeenCalledWith(
        identifier,
        context,
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

      const bridge = new RateLimitingBridge(mockOrchestrator, mockRateLimiter)
      const result = await bridge.getRemainingRequests(identifier, context)

      expect(result).toBe(mockRemaining)
      expect(mockRateLimiter.getRemainingRequests).toHaveBeenCalledWith(
        identifier,
        context,
      )
    })

    it('should reset counter correctly', async () => {
      const identifier = 'user:123'
      const context = {
        userId: '123',
        ip: '192.168.1.1',
      }

      mockRateLimiter.resetCounter.mockResolvedValue(undefined)

      const bridge = new RateLimitingBridge(mockOrchestrator, mockRateLimiter)
      await bridge.resetCounter(identifier, context)

      expect(mockRateLimiter.resetCounter).toHaveBeenCalledWith(
        identifier,
        context,
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

      const middleware = new ThreatDetectionMiddleware(
        mockOrchestrator,
        mockRateLimiter,
        config,
      )

      expect(middleware).toBeDefined()
      expect(middleware.config).toEqual(config)
      expect(middleware.orchestrator).toBe(mockOrchestrator)
      expect(middleware.rateLimiter).toBe(mockRateLimiter)
    })

    it('should handle middleware correctly', async () => {
      const config = {
        enabled: true,
        enableLogging: false,
        skipPaths: ['/health'],
      }

      const middleware = new ThreatDetectionMiddleware(
        mockOrchestrator,
        mockRateLimiter,
        config,
      )

      const mockReq = {
        ip: '192.168.1.1',
        method: 'GET',
        path: '/api/data',
        get: vi.fn((_header: string) => 'Mozilla/5.0...'),
        user: { id: '123', role: 'user' },
        session: { id: 'session_123' },
      }

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
      }

      const mockNext = vi.fn()

      mockRateLimiter.checkRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 50,
        resetTime: Date.now() + 60000,
      })

      await middleware.middleware()(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockRateLimiter.checkRateLimit).toHaveBeenCalled()
    })

    it('should skip specified paths', async () => {
      const config = {
        enabled: true,
        enableLogging: false,
        skipPaths: ['/health', '/status'],
      }

      const middleware = new ThreatDetectionMiddleware(
        mockOrchestrator,
        mockRateLimiter,
        config,
      )

      const mockReq = {
        ip: '192.168.1.1',
        method: 'GET',
        path: '/health',
        get: vi.fn(),
        user: undefined,
        session: undefined,
      }

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
      }

      const mockNext = vi.fn()

      await middleware.middleware()(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(mockRateLimiter.checkRateLimit).not.toHaveBeenCalled()
    })

    it('should block requests when rate limit exceeded', async () => {
      const config = {
        enabled: true,
        enableLogging: false,
      }

      const middleware = new ThreatDetectionMiddleware(
        mockOrchestrator,
        mockRateLimiter,
        config,
      )

      const mockReq = {
        ip: '192.168.1.1',
        method: 'GET',
        path: '/api/data',
        get: vi.fn(),
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
      mockRateLimiter.checkRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        metadata: { source: 'rate_limiting' },
      })

      await middleware.middleware()(mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(429)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many requests',
        }),
      )
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('Utility Functions', () => {
    it('should generate unique threat IDs', () => {
      const id1 = generateThreatId()
      const id2 = generateThreatId()

      expect(id1).toMatch(/^threat_\d+_[a-z0-9]+$/)
      expect(id2).toMatch(/^threat_\d+_[a-z0-9]+$/)
      expect(id1).not.toBe(id2)
    })

    it('should validate threat data correctly', () => {
      const validThreatData = {
        threatId: 'threat_123',
        source: 'rate_limiting',
        severity: 'medium',
        timestamp: new Date().toISOString(),
      }

      const invalidThreatData = {
        source: 'rate_limiting',
        severity: 'medium',
        timestamp: new Date().toISOString(),
        // Missing threatId
      }

      expect(validateThreatData(validThreatData)).toBe(true)
      expect(validateThreatData(invalidThreatData)).toBe(false)
    })

    it('should calculate threat score correctly', () => {
      const threatData = {
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

      const score = calculateThreatScore(threatData)
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
      const responseWithBlock = {
        responseId: 'response_123',
        threatId: 'threat_123',
        severity: 'high',
        confidence: 0.9,
        actions: [
          {
            actionType: 'block',
            target: 'request',
            timestamp: new Date().toISOString(),
          },
        ],
        recommendations: [],
        metadata: {},
      }

      const responseWithoutBlock = {
        responseId: 'response_124',
        threatId: 'threat_124',
        severity: 'low',
        confidence: 0.5,
        actions: [
          {
            actionType: 'log',
            target: 'request',
            timestamp: new Date().toISOString(),
          },
        ],
        recommendations: [],
        metadata: {},
      }

      expect(shouldBlockRequest(responseWithBlock)).toBe(true)
      expect(shouldBlockRequest(responseWithoutBlock)).toBe(false)
    })

    it('should determine if request should be rate limited', () => {
      const responseWithRateLimit = {
        responseId: 'response_123',
        threatId: 'threat_123',
        severity: 'medium',
        confidence: 0.7,
        actions: [
          {
            actionType: 'rate_limit',
            target: 'request',
            timestamp: new Date().toISOString(),
          },
        ],
        recommendations: [],
        metadata: {},
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
        recommendations: [],
        metadata: {},
      }

      expect(shouldRateLimitRequest(responseWithRateLimit)).toBe(true)
      expect(shouldRateLimitRequest(responseWithoutRateLimit)).toBe(false)
    })

    it('should extract rate limit parameters correctly', () => {
      const response = {
        responseId: 'response_123',
        threatId: 'threat_123',
        severity: 'medium',
        confidence: 0.7,
        actions: [
          {
            actionType: 'rate_limit',
            target: 'request',
            timestamp: new Date().toISOString(),
            metadata: {
              maxRequests: 10,
              windowMs: 60000,
              message: 'Rate limit exceeded',
            },
          },
        ],
        recommendations: [],
        metadata: {},
      }

      const params = extractRateLimitParams(response)

      expect(params.maxRequests).toBe(10)
      expect(params.windowMs).toBe(60000)
      expect(params.message).toBe('Rate limit exceeded')
    })

    it('should use default rate limit parameters when not specified', () => {
      const response = {
        responseId: 'response_123',
        threatId: 'threat_123',
        severity: 'low',
        confidence: 0.3,
        actions: [],
        recommendations: [],
        metadata: {},
      }

      const params = extractRateLimitParams(response)

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

      expect(integration.service.config).toEqual(
        expect.objectContaining(customConfig),
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle orchestrator errors gracefully', async () => {
      mockOrchestrator.analyzeThreat.mockRejectedValue(
        new Error('Orchestrator error'),
      )

      const threatData = {
        threatId: 'test_threat',
        source: 'rate_limiting',
        severity: 'medium',
        timestamp: new Date().toISOString(),
      }

      await expect(
        threatDetectionService.analyzeThreat(threatData),
      ).rejects.toThrow('Orchestrator error')
    })

    it('should handle rate limiter errors gracefully', async () => {
      mockRateLimiter.checkRateLimit.mockRejectedValue(
        new Error('Rate limiter error'),
      )

      const identifier = 'user:123'
      const context = { userId: '123', ip: '192.168.1.1' }

      await expect(
        threatDetectionService.checkRequest(identifier, context),
      ).rejects.toThrow('Rate limiter error')
    })

    it('should handle missing dependencies gracefully', () => {
      expect(() => {
        createThreatDetectionIntegration(null, null)
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

      mockRateLimiter.checkRateLimit.mockResolvedValue(mockRateLimitResult)

      const identifier = 'user:123'
      const context = { userId: '123', ip: '192.168.1.1' }

      // Create multiple concurrent requests
      const requests = Array.from({ length: 10 }, (_, i) =>
        threatDetectionService.checkRequest(`${identifier}_${i}`, context),
      )

      const results = await Promise.all(requests)

      expect(results).toHaveLength(10)
      results.forEach((result) => {
        expect(result).toEqual(mockRateLimitResult)
      })

      // Verify rate limiter was called for each request
      expect(mockRateLimiter.checkRateLimit).toHaveBeenCalledTimes(10)
    })
  })
})
