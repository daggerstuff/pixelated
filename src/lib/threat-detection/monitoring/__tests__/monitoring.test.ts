/**
 * Unit Tests for Enhanced Monitoring & Alerting System
 *
 * These tests verify the monitoring functionality including
 * AI-powered insights, alerting, and performance tracking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { EnhancedMonitoringService } from '../enhanced-monitoring-service'
import {
  calculateAlertSeverity,
  shouldEscalateAlert,
  getAlertStatistics,
  generateAlertReport,
} from '../alert-utils'
import {
  calculateMetricsSummary,
  detectMetricAnomalies,
  getPerformanceMetrics,
} from '../metrics-utils'

// Mock dependencies
vi.mock('../../logging/build-safe-logger')
vi.mock('../../redis')
vi.mock('../../response-orchestration')
vi.mock('../../ai-services')

describe('Enhanced Monitoring Service', () => {
  let service: EnhancedMonitoringService
  let mockRedis: any
  let mockOrchestrator: any
  let mockAIService: any

  beforeEach(() => {
    // Setup mock Redis
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
      lpush: vi.fn(),
      lrange: vi.fn(),
      rpop: vi.fn(),
    }

    // Setup mock orchestrator
    mockOrchestrator = {
      analyzeThreat: vi.fn(),
      executeResponse: vi.fn(),
      getStatistics: vi.fn(),
    }

    // Setup mock AI service
    mockAIService = {
      analyzePattern: vi.fn(),
      predictAnomaly: vi.fn(),
      generateInsights: vi.fn(),
    }

    service = new EnhancedMonitoringService(
      mockRedis,
      mockOrchestrator,
      mockAIService,
    )
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
      expect(service.aiService).toBe(mockAIService)
      expect(service.alerts).toBeDefined()
      expect(service.metrics).toBeDefined()
    })

    it('should use default configuration when none provided', () => {
      const defaultService = new EnhancedMonitoringService(
        mockRedis,
        mockOrchestrator,
        mockAIService,
      )
      expect(defaultService.config).toEqual({
        enabled: true,
        alertThresholds: {
          critical: 0.9,
          high: 0.7,
          medium: 0.5,
          low: 0.3,
        },
        escalationRules: {
          critical: { minutes: 5, levels: ['admin', 'security'] },
          high: { minutes: 15, levels: ['security'] },
          medium: { minutes: 30, levels: ['operations'] },
          low: { minutes: 60, levels: ['monitoring'] },
        },
        enableAIInsights: true,
        maxAlertHistory: 1000,
        metricsRetention: 86400000, // 24 hours
        enableRealTimeAlerting: true,
      })
    })

    it('should use custom configuration when provided', () => {
      const customConfig = {
        enabled: false,
        alertThresholds: {
          critical: 0.95,
          high: 0.8,
          medium: 0.6,
          low: 0.4,
        },
        escalationRules: {
          critical: { minutes: 2, levels: ['admin', 'security', 'executive'] },
          high: { minutes: 10, levels: ['security', 'operations'] },
        },
        enableAIInsights: false,
        maxAlertHistory: 500,
        metricsRetention: 43200000,
        enableRealTimeAlerting: false,
      }

      const customService = new EnhancedMonitoringService(
        mockRedis,
        mockOrchestrator,
        mockAIService,
        customConfig,
      )
      expect(customService.config).toEqual(customConfig)
    })
  })

  describe('Alert Management', () => {
    it('should create alert with correct data', async () => {
      const alertData = {
        title: 'Suspicious Activity Detected',
        description: 'Unusual login pattern detected for user',
        severity: 'high',
        source: 'behavioral_analysis',
        metadata: {
          userId: 'user_123',
          anomalyType: 'unusual_login',
          confidence: 0.85,
        },
      }

      mockRedis.incr.mockResolvedValue(1)
      mockRedis.set.mockResolvedValue('OK')
      mockRedis.expire.mockResolvedValue(1)

      const alert = await service.createAlert(alertData)

      expect(alert).toBeDefined()
      expect(alert.id).toBe('alert_1')
      expect(alert.title).toBe(alertData.title)
      expect(alert.severity).toBe(alertData.severity)
      expect(alert.status).toBe('active')
      expect(alert.createdAt).toBeDefined()
      expect(mockRedis.set).toHaveBeenCalledWith(
        `alert:alert_1`,
        expect.any(String),
        expect.any(Number),
      )
    })

    it('should update alert status correctly', async () => {
      const alertId = 'alert_1'
      const updateData = {
        status: 'investigating',
        notes: 'Under investigation by security team',
      }

      const existingAlert = {
        id: alertId,
        title: 'Test Alert',
        severity: 'high',
        status: 'active',
        createdAt: new Date().toISOString(),
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(existingAlert))
      mockRedis.set.mockResolvedValue('OK')

      const updatedAlert = await service.updateAlert(alertId, updateData)

      expect(updatedAlert.status).toBe('investigating')
      expect(updatedAlert.notes).toBe(updateData.notes)
      expect(updatedAlert.updatedAt).toBeDefined()
      expect(mockRedis.set).toHaveBeenCalled()
    })

    it('should escalate alert based on severity', async () => {
      const alertId = 'alert_1'
      const alert = {
        id: alertId,
        title: 'Critical Security Alert',
        severity: 'critical',
        status: 'active',
        createdAt: new Date().toISOString(),
        escalationCount: 0,
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(alert))
      mockRedis.set.mockResolvedValue('OK')

      const escalatedAlert = await service.escalateAlert(alertId)

      expect(escalatedAlert.escalationCount).toBe(1)
      expect(escalatedAlert.status).toBe('escalated')
      expect(escalatedAlert.escalatedAt).toBeDefined()
      expect(mockRedis.set).toHaveBeenCalled()
    })

    it('should resolve alert correctly', async () => {
      const alertId = 'alert_1'
      const resolutionData = {
        resolvedBy: 'security_team',
        resolutionNotes: 'False positive, user verified',
        resolvedAt: new Date().toISOString(),
      }

      const existingAlert = {
        id: alertId,
        title: 'Test Alert',
        severity: 'medium',
        status: 'active',
        createdAt: new Date().toISOString(),
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(existingAlert))
      mockRedis.set.mockResolvedValue('OK')

      const resolvedAlert = await service.resolveAlert(alertId, resolutionData)

      expect(resolvedAlert.status).toBe('resolved')
      expect(resolvedAlert.resolvedBy).toBe(resolutionData.resolvedBy)
      expect(resolvedAlert.resolutionNotes).toBe(resolutionData.resolutionNotes)
      expect(mockRedis.set).toHaveBeenCalled()
    })

    it('should get alert by ID', async () => {
      const alertId = 'alert_1'
      const alert = {
        id: alertId,
        title: 'Test Alert',
        severity: 'high',
        status: 'active',
        createdAt: new Date().toISOString(),
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(alert))

      const result = await service.getAlert(alertId)

      expect(result).toEqual(alert)
      expect(mockRedis.get).toHaveBeenCalledWith(`alert:${alertId}`)
    })

    it('should return null for non-existent alert', async () => {
      const alertId = 'alert_1'
      mockRedis.get.mockResolvedValue(null)

      const result = await service.getAlert(alertId)

      expect(result).toBeNull()
    })

    it('should get active alerts', async () => {
      const activeAlerts = [
        { id: 'alert_1', title: 'Alert 1', severity: 'high', status: 'active' },
        {
          id: 'alert_2',
          title: 'Alert 2',
          severity: 'medium',
          status: 'active',
        },
      ]

      mockRedis.lrange.mockResolvedValue(
        activeAlerts.map((a) => JSON.stringify(a)),
      )

      const result = await service.getActiveAlerts()

      expect(result).toEqual(activeAlerts)
      expect(mockRedis.lrange).toHaveBeenCalledWith('alerts:active', 0, -1)
    })

    it('should get alerts by severity', async () => {
      const highSeverityAlerts = [
        {
          id: 'alert_1',
          title: 'Critical Alert',
          severity: 'critical',
          status: 'active',
        },
        {
          id: 'alert_2',
          title: 'High Alert',
          severity: 'high',
          status: 'active',
        },
      ]

      mockRedis.lrange.mockResolvedValue(
        highSeverityAlerts.map((a) => JSON.stringify(a)),
      )

      const result = await service.getAlertsBySeverity('high')

      expect(result).toEqual(highSeverityAlerts)
      expect(mockRedis.lrange).toHaveBeenCalledWith('alerts:high', 0, -1)
    })
  })

  describe('Alert Utilities', () => {
    it('should calculate alert severity correctly', () => {
      const threatData = {
        severity: 'high',
        confidence: 0.8,
        impact: 'data_breach',
        velocity: 'rapid',
      }

      const severity = calculateAlertSeverity(threatData)

      expect(severity).toBe('critical')
    })

    it('should determine when to escalate alert', () => {
      const alert = {
        severity: 'critical',
        status: 'active',
        createdAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        escalationCount: 0,
      }

      const shouldEscalate = shouldEscalateAlert(alert)

      expect(shouldEscalate).toBe(true)
    })

    it('should not escalate recently escalated alert', () => {
      const alert = {
        severity: 'high',
        status: 'escalated',
        createdAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        escalationCount: 1,
        lastEscalatedAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
      }

      const shouldEscalate = shouldEscalateAlert(alert)

      expect(shouldEscalate).toBe(false)
    })

    it('should generate alert statistics', async () => {
      const alertStats = {
        total: 150,
        active: 45,
        resolved: 105,
        bySeverity: {
          critical: 10,
          high: 25,
          medium: 45,
          low: 70,
        },
        bySource: {
          rate_limiting: 60,
          behavioral_analysis: 50,
          threat_intelligence: 40,
        },
        avgResolutionTime: 3600000,
      }

      mockRedis.hgetall.mockResolvedValue({
        total: '150',
        active: '45',
        resolved: '105',
        critical: '10',
        high: '25',
        medium: '45',
        low: '70',
        rate_limiting: '60',
        behavioral_analysis: '50',
        threat_intelligence: '40',
      })

      const stats = await getAlertStatistics(mockRedis)

      expect(stats).toEqual(alertStats)
    })

    it('should generate alert report', async () => {
      const alerts = [
        {
          id: 'alert_1',
          title: 'Alert 1',
          severity: 'high',
          status: 'resolved',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'alert_2',
          title: 'Alert 2',
          severity: 'medium',
          status: 'active',
          createdAt: new Date().toISOString(),
        },
      ]

      const report = await generateAlertReport(alerts, {
        timeRange: '24h',
        includeMetrics: true,
        includeRecommendations: true,
      })

      expect(report).toBeDefined()
      expect(report.summary).toBeDefined()
      expect(report.alerts).toEqual(alerts)
      expect(report.metrics).toBeDefined()
      expect(report.recommendations).toBeDefined()
    })
  })

  describe('Metrics Tracking', () => {
    it('should track metric correctly', async () => {
      const metricData = {
        name: 'response_time',
        value: 150,
        tags: { endpoint: '/api/data', method: 'GET' },
        timestamp: new Date().toISOString(),
      }

      mockRedis.incr.mockResolvedValue(1)
      mockRedis.set.mockResolvedValue('OK')
      mockRedis.expire.mockResolvedValue(1)

      await service.trackMetric(metricData)

      expect(mockRedis.set).toHaveBeenCalledWith(
        `metric:response_time:${Date.now()}`,
        expect.any(String),
        expect.any(Number),
      )
    })

    it('should get metrics for time range', async () => {
      const metrics = [
        {
          name: 'response_time',
          value: 150,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'error_rate',
          value: 0.05,
          timestamp: new Date().toISOString(),
        },
      ]

      mockRedis.lrange.mockResolvedValue(metrics.map((m) => JSON.stringify(m)))

      const result = await service.getMetrics('response_time', '1h')

      expect(result).toEqual(metrics)
      expect(mockRedis.lrange).toHaveBeenCalled()
    })

    it('should calculate metrics summary', async () => {
      const metrics = [
        {
          name: 'response_time',
          value: 100,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'response_time',
          value: 150,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'response_time',
          value: 200,
          timestamp: new Date().toISOString(),
        },
      ]

      const summary = await calculateMetricsSummary(metrics)

      expect(summary).toBeDefined()
      expect(summary.average).toBe(150)
      expect(summary.min).toBe(100)
      expect(summary.max).toBe(200)
      expect(summary.count).toBe(3)
    })

    it('should detect metric anomalies', async () => {
      const metrics = [
        {
          name: 'response_time',
          value: 100,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'response_time',
          value: 150,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'response_time',
          value: 500,
          timestamp: new Date().toISOString(),
        }, // Anomaly
      ]

      mockAIService.predictAnomaly.mockResolvedValue({
        isAnomaly: true,
        confidence: 0.9,
        severity: 'high',
      })

      const anomalies = await detectMetricAnomalies(metrics, mockAIService)

      expect(anomalies).toHaveLength(1)
      expect(anomalies[0].value).toBe(500)
      expect(anomalies[0].isAnomaly).toBe(true)
    })

    it('should get performance metrics', async () => {
      const performanceMetrics = {
        system: {
          cpu: 45,
          memory: 60,
          disk: 30,
        },
        application: {
          responseTime: 150,
          throughput: 1000,
          errorRate: 0.02,
        },
        database: {
          connections: 25,
          queryTime: 50,
          cacheHitRate: 0.85,
        },
      }

      mockRedis.hgetall.mockResolvedValue(JSON.stringify(performanceMetrics))

      const result = await getPerformanceMetrics(mockRedis)

      expect(result).toEqual(performanceMetrics)
    })
  })

  describe('AI-Powered Insights', () => {
    it('should generate AI insights from metrics', async () => {
      const metrics = [
        {
          name: 'response_time',
          value: 150,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'error_rate',
          value: 0.05,
          timestamp: new Date().toISOString(),
        },
        {
          name: 'throughput',
          value: 1000,
          timestamp: new Date().toISOString(),
        },
      ]

      mockAIService.generateInsights.mockResolvedValue({
        insights: [
          {
            type: 'trend',
            description: 'Response times increasing',
            severity: 'medium',
          },
          {
            type: 'anomaly',
            description: 'Error rate spike detected',
            severity: 'high',
          },
        ],
        recommendations: [
          'Investigate database performance',
          'Add caching layer for frequently accessed data',
        ],
      })

      const insights = await service.generateAIInsights(metrics)

      expect(insights).toBeDefined()
      expect(insights.insights).toBeDefined()
      expect(insights.recommendations).toBeDefined()
      expect(mockAIService.generateInsights).toHaveBeenCalledWith(metrics)
    })

    it('should analyze patterns in alert data', async () => {
      const alerts = [
        {
          id: 'alert_1',
          title: 'Data Breach',
          severity: 'critical',
          source: 'threat_intelligence',
        },
        {
          id: 'alert_2',
          title: 'Suspicious Login',
          severity: 'high',
          source: 'behavioral_analysis',
        },
        {
          id: 'alert_3',
          title: 'Rate Limit Exceeded',
          severity: 'medium',
          source: 'rate_limiting',
        },
      ]

      mockAIService.analyzePattern.mockResolvedValue({
        patterns: [
          {
            type: 'temporal',
            description: 'Alerts clustered in time',
            confidence: 0.8,
          },
          {
            type: 'spatial',
            description: 'Common source IP addresses',
            confidence: 0.7,
          },
        ],
      })

      const patterns = await service.analyzeAlertPatterns(alerts)

      expect(patterns).toBeDefined()
      expect(patterns.patterns).toBeDefined()
      expect(mockAIService.analyzePattern).toHaveBeenCalledWith(alerts)
    })

    it('should predict future anomalies', async () => {
      const historicalData = [
        {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          value: 100,
        },
        {
          timestamp: new Date(Date.now() - 43200000).toISOString(),
          value: 120,
        },
        {
          timestamp: new Date(Date.now() - 21600000).toISOString(),
          value: 150,
        },
      ]

      mockAIService.predictAnomaly.mockResolvedValue({
        isAnomaly: true,
        confidence: 0.85,
        predictedValue: 300,
        timeWindow: '1h',
      })

      const prediction = await service.predictFutureAnomalies(historicalData)

      expect(prediction).toBeDefined()
      expect(prediction.isAnomaly).toBe(true)
      expect(prediction.confidence).toBe(0.85)
      expect(mockAIService.predictAnomaly).toHaveBeenCalledWith(historicalData)
    })
  })

  describe('Real-time Monitoring', () => {
    it('should perform real-time monitoring check', async () => {
      const monitoringData = {
        metrics: [
          { name: 'cpu_usage', value: 75, timestamp: new Date().toISOString() },
          {
            name: 'memory_usage',
            value: 80,
            timestamp: new Date().toISOString(),
          },
        ],
        alerts: [{ id: 'alert_1', severity: 'high', status: 'active' }],
        systemHealth: 'degraded',
      }

      mockRedis.lrange.mockResolvedValue([])
      mockAIService.generateInsights.mockResolvedValue({
        insights: [],
        recommendations: [],
      })

      const result = await service.performRealTimeMonitoring(monitoringData)

      expect(result).toBeDefined()
      expect(result.healthStatus).toBeDefined()
      expect(result.alerts).toBeDefined()
      expect(result.insights).toBeDefined()
      expect(result.actions).toBeDefined()
    })

    it('should trigger alerts based on thresholds', async () => {
      const metricData = {
        name: 'cpu_usage',
        value: 95, // Above critical threshold
        tags: { host: 'server-1' },
        timestamp: new Date().toISOString(),
      }

      mockRedis.incr.mockResolvedValue(1)
      mockRedis.set.mockResolvedValue('OK')

      await service.trackMetric(metricData)

      // Verify that alert was created
      expect(mockRedis.set).toHaveBeenCalled()
    })

    it('should handle monitoring timeouts gracefully', async () => {
      const monitoringData = {
        metrics: [],
        alerts: [],
        systemHealth: 'unknown',
      }

      // Simulate timeout by not resolving AI service promise
      mockAIService.generateInsights.mockReturnValue(new Promise(() => {}))

      const result = await service.performRealTimeMonitoring(monitoringData)

      expect(result).toBeDefined()
      expect(result.healthStatus).toBe('unknown')
      expect(result.insights).toHaveLength(0)
      expect(result.errors).toContain('AI analysis timeout')
    })
  })

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      const alertData = {
        title: 'Test Alert',
        description: 'Test description',
        severity: 'medium',
        source: 'test',
      }

      mockRedis.incr.mockRejectedValue(new Error('Redis connection failed'))

      const alert = await service.createAlert(alertData)

      expect(alert).toBeDefined()
      expect(alert.errors).toContain('Redis connection failed')
    })

    it('should handle invalid alert data', async () => {
      const invalidAlertData = {
        title: '', // Invalid empty title
        description: 'Test description',
        severity: 'invalid_severity' as any, // Invalid severity
      }

      mockRedis.incr.mockResolvedValue(1)

      const alert = await service.createAlert(invalidAlertData)

      expect(alert).toBeDefined()
      expect(alert.errors).toContain('Invalid alert data')
    })

    it('should handle metric tracking errors', async () => {
      const metricData = {
        name: 'response_time',
        value: 150,
        tags: { endpoint: '/api/data' },
        timestamp: new Date().toISOString(),
      }

      mockRedis.set.mockRejectedValue(new Error('Redis error'))

      await service.trackMetric(metricData)

      // Should not throw error, but log it
      expect(mockRedis.set).toHaveBeenCalled()
    })
  })

  describe('Performance', () => {
    it('should handle concurrent alert creation', async () => {
      const alertData = {
        title: 'Test Alert',
        description: 'Test description',
        severity: 'medium',
        source: 'test',
      }

      mockRedis.incr.mockResolvedValue(1)
      mockRedis.set.mockResolvedValue('OK')

      const alerts = Array.from({ length: 10 }, (_, i) =>
        service.createAlert({ ...alertData, title: `Alert ${i}` }),
      )

      const results = await Promise.all(alerts)

      expect(results).toHaveLength(10)
      results.forEach((result, index) => {
        expect(result).toBeDefined()
        expect(result.title).toBe(`Alert ${index}`)
        expect(result.id).toBeDefined()
      })
    })

    it('should handle large metric datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        name: 'response_time',
        value: 100 + Math.random() * 200,
        tags: { endpoint: `/api/data/${i % 10}` },
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
      }))

      mockRedis.set.mockResolvedValue('OK')

      const startTime = Date.now()
      await service.trackBatchMetrics(largeDataset)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(5000) // Should complete in under 5 seconds
    })

    it('should generate reports efficiently', async () => {
      const alerts = Array.from({ length: 100 }, (_, i) => ({
        id: `alert_${i}`,
        title: `Alert ${i}`,
        severity:
          i < 10 ? 'critical' : i < 30 ? 'high' : i < 60 ? 'medium' : 'low',
        status: i < 80 ? 'active' : 'resolved',
        createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      }))

      const startTime = Date.now()
      const report = await service.generateAlertReport(alerts)
      const endTime = Date.now()

      expect(report).toBeDefined()
      expect(report.alerts).toHaveLength(100)
      expect(endTime - startTime).toBeLessThan(3000) // Should complete in under 3 seconds
    })
  })

  describe('Integration Tests', () => {
    it('should integrate alerts with metrics correctly', async () => {
      // Track metrics that should trigger alerts
      const metricData = {
        name: 'error_rate',
        value: 0.15, // High error rate
        tags: { endpoint: '/api/payment' },
        timestamp: new Date().toISOString(),
      }

      mockRedis.incr.mockResolvedValue(1)
      mockRedis.set.mockResolvedValue('OK')

      await service.trackMetric(metricData)

      // Verify alert was created
      expect(mockRedis.set).toHaveBeenCalled()
    })

    it('should integrate AI insights with alerting', async () => {
      const alerts = [
        {
          id: 'alert_1',
          title: 'Data Breach',
          severity: 'critical',
          source: 'threat_intelligence',
        },
        {
          id: 'alert_2',
          title: 'Suspicious Activity',
          severity: 'high',
          source: 'behavioral_analysis',
        },
      ]

      mockAIService.analyzePattern.mockResolvedValue({
        patterns: [
          {
            type: 'coordinated',
            description: 'Coordinated attack pattern',
            confidence: 0.9,
          },
        ],
      })

      const insights = await service.analyzeAlertPatterns(alerts)

      expect(insights.patterns).toHaveLength(1)
      expect(insights.patterns[0].type).toBe('coordinated')
      expect(insights.patterns[0].confidence).toBe(0.9)
    })

    it('should handle complete monitoring workflow', async () => {
      // Step 1: Track metrics
      const metricData = {
        name: 'cpu_usage',
        value: 85,
        tags: { host: 'server-1' },
        timestamp: new Date().toISOString(),
      }

      mockRedis.incr.mockResolvedValue(1)
      mockRedis.set.mockResolvedValue('OK')

      await service.trackMetric(metricData)

      // Step 2: Generate AI insights
      const metrics = [metricData]
      mockAIService.generateInsights.mockResolvedValue({
        insights: [
          {
            type: 'threshold',
            description: 'CPU usage above threshold',
            severity: 'high',
          },
        ],
        recommendations: ['Scale up server resources'],
      })

      const insights = await service.generateAIInsights(metrics)

      // Step 3: Create alert based on insights
      const alertData = {
        title: 'High CPU Usage',
        description: insights.insights[0].description,
        severity: 'high',
        source: 'ai_analysis',
        metadata: {
          insightType: insights.insights[0].type,
          recommendation: insights.recommendations[0],
        },
      }

      const alert = await service.createAlert(alertData)

      expect(alert).toBeDefined()
      expect(alert.severity).toBe('high')
      expect(alert.metadata.insightType).toBe('threshold')
    })
  })
})
