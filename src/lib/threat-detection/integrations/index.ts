/**
 * Threat Detection Integration Module
 *
 * This module provides a unified interface for integrating threat detection
 * with various systems including rate limiting, API middleware, and external services.
 */

// Export rate limiting bridge
export {
  type RateLimitIntegrationConfig,
  RateLimitingBridge,
} from './rate-limiting-bridge'

// Import and export API middleware
import type { Request } from 'express'

import {
  type ApiMiddlewareConfig,
  createThreatDetectionMiddleware,
  type ThreatDetectionContext,
  ThreatDetectionMiddleware,
} from './api-middleware'

export {
  type ApiMiddlewareConfig,
  createThreatDetectionMiddleware,
  type ThreatDetectionContext,
  ThreatDetectionMiddleware,
}

// Import and export main threat detection service
import {
  createThreatDetectionService,
  type ThreatDetectionConfig,
  ThreatDetectionService,
} from './threat-detection-service'

// Export utility functions
export * from './utils'
export {
  createThreatDetectionService,
  type ThreatDetectionConfig,
  ThreatDetectionService,
}

// Import and export AI-enhanced monitoring
import {
  AIEnhancedMonitoringService,
  type AIInsight,
  type Alert,
  type MonitoringConfig,
  type SecurityMetrics,
} from '../monitoring/ai-enhanced-monitoring'

export {
  AIEnhancedMonitoringService,
  type AIInsight,
  type Alert,
  type MonitoringConfig,
  type SecurityMetrics,
}

// Import and export threat hunting service
import {
  type HuntFinding,
  type HuntingRule,
  type HuntResult,
  type Investigation,
  type InvestigationFinding,
  type InvestigationTemplate,
  type ThreatHuntingConfig,
  ThreatHuntingService,
} from '../threat-hunting/threat-hunting-service'

export {
  type HuntFinding,
  type HuntingRule,
  type HuntResult,
  type Investigation,
  type InvestigationFinding,
  type InvestigationTemplate,
  type ThreatHuntingConfig,
  ThreatHuntingService,
}

// Import and export external threat intelligence
import {
  ExternalThreatIntelligenceService,
  type ThreatIntelligence,
  type ThreatIntelligenceConfig,
  type ThreatIntelligenceFeed,
  type ThreatIntelligenceQuery,
  type ThreatIntelligenceResult,
} from './external-threat-intelligence'

// Import and re-export types from response orchestration
export type {
  RateLimitResult,
  ResponseAction,
  ThreatAnalysis,
  ThreatData,
  ThreatResponse,
} from '../response-orchestration'
export {
  ExternalThreatIntelligenceService,
  type ThreatIntelligence,
  type ThreatIntelligenceConfig,
  type ThreatIntelligenceFeed,
  type ThreatIntelligenceQuery,
  type ThreatIntelligenceResult,
}

import { DistributedRateLimiter } from '../../rate-limiting/rate-limiter'
import { redis } from '../../redis'
import { AdvancedResponseOrchestrator } from '../response-orchestration'

/**
 * Create a complete threat detection integration setup
 */
export function createThreatDetectionIntegration(
  orchestrator: AdvancedResponseOrchestrator,
  rateLimiter: DistributedRateLimiter,
  config?: Partial<ThreatDetectionConfig>,
) {
  const threatDetectionService = createThreatDetectionService(
    orchestrator,
    rateLimiter,
    config,
  )

  const middleware = threatDetectionService.getMiddleware()

  return {
    service: threatDetectionService,
    middleware,
    bridge: threatDetectionService['rateLimitingBridge'],

    // Convenience methods
    analyzeThreat: (threatData: unknown) =>
      threatDetectionService.analyzeThreat(threatData as ThreatData),
    checkRequest: (identifier: string, context: unknown) =>
      threatDetectionService.checkRequest(
        identifier,
        context as {
          userId?: string
          ip?: string
          endpoint?: string
          userAgent?: string
          method?: string
          headers?: Record<string, string>
        },
      ),
    getHealthStatus: () => threatDetectionService.getHealthStatus(),
    getStatistics: () => threatDetectionService.getStatistics(),
  }
}

/**
 * Default configuration for threat detection integration
 */
export const defaultThreatDetectionConfig: ThreatDetectionConfig = {
  enabled: true,
  enableResponseOrchestration: true,
  enableRateLimiting: true,
  enableBehavioralAnalysis: true,
  enablePredictiveThreats: true,
  rateLimitConfig: {
    enableAutoRateLimiting: true,
    enableThreatDetection: true,
    threatLevelRules: {
      low: {
        name: 'low_threat',
        maxRequests: 100,
        windowMs: 60000,
        enableAttackDetection: false,
      },
      medium: {
        name: 'medium_threat',
        maxRequests: 50,
        windowMs: 60000,
        enableAttackDetection: true,
      },
      high: {
        name: 'high_threat',
        maxRequests: 10,
        windowMs: 60000,
        enableAttackDetection: true,
      },
      critical: {
        name: 'critical_threat',
        maxRequests: 1,
        windowMs: 300000,
        enableAttackDetection: true,
      },
    },
    bypassRules: {
      allowedRoles: ['admin', 'system'],
      allowedIPRanges: ['127.0.0.1', '::1'],
      allowedEndpoints: ['/api/health', '/api/status'],
    },
    escalationConfig: {
      autoEscalateThreshold: 5,
      escalationWindowMs: 3600000,
    },
  },
  responseConfig: {
    enableAutoResponses: true,
    enableManualReview: true,
    escalationThresholds: {
      low: 3,
      medium: 5,
      high: 8,
      critical: 10,
    },
  },
  behavioralConfig: {
    enableProfiling: true,
    anomalyThreshold: 0.8,
    baselineUpdateInterval: 86400000,
  },
  predictiveConfig: {
    enableForecasting: true,
    forecastingWindow: 24,
    confidenceThreshold: 0.7,
  },
}

/**
 * Middleware configuration for Express applications
 */
export const expressMiddlewareConfig = {
  enabled: true,
  enableLogging: true,
  skipPaths: ['/health', '/status', '/metrics', '/api/health', '/api/status'],
  getIdentifier: (req: Request) => {
    if ((req as any).user?.id) {
      return `user:${(req as any).user.id}`
    }
    if ((req as any).session?.id) {
      return `session:${(req as any).session.id}`
    }
    if (req.ip) {
      return `ip:${req.ip}`
    }
    return 'unknown'
  },
  getContext: (req: Request): ThreatDetectionContext => ({
    ip: req.ip,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    userId: (req as any).user?.id,
    userRole: (req as any).user?.role,
    sessionId: (req as any).session?.id,
    headers: Object.fromEntries(
      Object.entries(req.headers)
        .filter(
          ([key]) =>
            !['authorization', 'cookie', 'set-cookie'].includes(
              key.toLowerCase(),
            ),
        )
        .map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join(', ') : value || '',
        ]),
    ),
  }),
}

/**
 * Example usage patterns
 */
export const usageExamples = {
  /**
   * Basic Express middleware setup
   */
  expressSetup: `
import { createThreatDetectionIntegration } from './integrations'
import { AdvancedResponseOrchestrator } from '../response-orchestration'
import { DistributedRateLimiter } from '../../rate-limiting/rate-limiter'

const orchestrator = new AdvancedResponseOrchestrator()
const rateLimiter = new DistributedRateLimiter()

const { middleware } = createThreatDetectionIntegration(
  orchestrator,
  rateLimiter
)

// Use in Express app
app.use(middleware.middleware())
  `,

  /**
   * Manual threat analysis
   */
  manualAnalysis: `
import { createThreatDetectionIntegration } from './integrations'

const { service } = createThreatDetectionIntegration(
  orchestrator,
  rateLimiter
)

const threatData = {
  threatId: 'threat_123',
  source: 'rate_limiting',
  severity: 'medium',
  riskFactors: {
    violationCount: 15,
    timeWindow: 60000,
    endpoint: '/api/sensitive'
  }
}

const response = await service.analyzeThreat(threatData)
  `,

  /**
   * Request checking with rate limiting
   */
  requestChecking: `
import { createThreatDetectionIntegration } from './integrations'

const { checkRequest } = createThreatDetectionIntegration(
  orchestrator,
  rateLimiter
)

const result = await checkRequest('user:123', {
  userId: '123',
  ip: '192.168.1.1',
  endpoint: '/api/data',
  userAgent: 'Mozilla/5.0...'
})

if (!result.allowed) {

  // Handle blocked request
  res.status(429).json({ error: 'Too many requests' })
}
  `,

  /**
   * Custom configuration
   */
  customConfig: `
import { createThreatDetectionIntegration } from './integrations'

const customConfig = {
  enabled: true,
  enableRateLimiting: true,
  rateLimitConfig: {
    threatLevelRules: {
      high: {
        maxRequests: 5,
        windowMs: 60000,
        enableAttackDetection: true
      }
    }
  }
}

const { service } = createThreatDetectionIntegration(
  orchestrator,
  rateLimiter,
  customConfig
)
  `,
}

/**
 * Create AI-enhanced monitoring service
 */
export function createAIEnhancedMonitoring(
  config: MonitoringConfig,
): AIEnhancedMonitoringService {
  return new AIEnhancedMonitoringService(config)
}

/**
 * Create threat hunting service
 */
export function createThreatHuntingService(
  redisClient: any,
  orchestrator: any,
  aiService: any,
  behavioralService: any,
  predictiveService: any,
  config: ThreatHuntingConfig,
): ThreatHuntingService {
  return new ThreatHuntingService(
    redisClient,
    orchestrator,
    aiService,
    behavioralService,
    predictiveService,
    config,
  )
}

/**
 * Create external threat intelligence service
 */
export function createExternalThreatIntelligence(
  config: ThreatIntelligenceConfig,
): ExternalThreatIntelligenceService {
  return new ExternalThreatIntelligenceService(config)
}

export { createCompleteThreatDetectionSystem } from './production-system'

/**
 * Default monitoring configuration
 */
export const defaultMonitoringConfig: MonitoringConfig = {
  enabled: true,
  aiInsightsEnabled: true,
  alertThresholds: {
    critical: 100,
    high: 50,
    medium: 20,
    low: 5,
  },
  monitoringIntervals: {
    realTime: 30000, // 30 seconds
    batch: 300000, // 5 minutes
    anomalyDetection: 60000, // 1 minute
  },
  notificationChannels: [
    {
      name: 'dashboard',
      type: 'dashboard',
      enabled: true,
      priority: 1,
      config: {},
    },
    {
      name: 'security_team',
      type: 'email',
      enabled: true,
      priority: 3,
      config: {
        recipients: ['security@pixelatedempathy.com'],
      },
    },
  ],
  aiModelConfig: {
    modelPath: './models/anomaly_detection',
    confidenceThreshold: 0.7,
    predictionWindow: 24,
  },
}

/**
 * Default threat hunting configuration
 */
export const defaultThreatHuntingConfig: ThreatHuntingConfig = {
  enabled: true,
  huntingFrequency: 300000, // 5 minutes
  investigationTimeout: 1800000, // 30 minutes
  mlModelConfig: {
    enabled: true,
    modelPath: './models/threat_hunting',
    confidenceThreshold: 0.8,
  },
  huntingRules: [
    {
      ruleId: 'high_threat_volume',
      name: 'High Threat Volume Detection',
      description: 'Detect unusually high volume of threats in recent period',
      query: {
        recentThreats: true,
        timeWindow: 3600000, // 1 hour
      },
      severity: 'high',
      enabled: true,
      autoInvestigate: true,
      investigationPriority: 3,
    },
    {
      ruleId: 'suspicious_ip_patterns',
      name: 'Suspicious IP Patterns',
      description: 'Detect patterns in suspicious IP addresses',
      query: {
        suspiciousIPs: true,
        patternAnalysis: true,
      },
      severity: 'medium',
      enabled: true,
      autoInvestigate: false,
      investigationPriority: 2,
    },
    {
      ruleId: 'rate_limit_anomalies',
      name: 'Rate Limiting Anomalies',
      description: 'Detect unusual rate limiting activity',
      query: {
        rateLimitViolations: true,
        threshold: 20,
      },
      severity: 'low',
      enabled: true,
      autoInvestigate: false,
      investigationPriority: 1,
    },
  ],
  investigationTemplates: [
    {
      templateId: 'standard_threat_investigation',
      name: 'Standard Threat Investigation',
      description: 'Comprehensive investigation template for general threats',
      steps: [
        {
          stepId: 'analyze_logs',
          name: 'Analyze System Logs',
          description: 'Review system logs for suspicious activity',
          action: 'analyze_logs',
          parameters: {
            timeRange: 3600000, // 1 hour
            logLevels: ['error', 'warning'],
          },
          validationRules: [
            {
              type: 'threshold',
              condition: 'error_count',
              expectedValue: 10,
              operator: 'less_than',
            },
          ],
          timeout: 300000, // 5 minutes
        },
        {
          stepId: 'check_iocs',
          name: 'Check Indicators of Compromise',
          description: 'Verify IOCs against threat intelligence',
          action: 'check_iocs',
          parameters: {
            iocTypes: ['ip', 'domain', 'hash'],
          },
          validationRules: [],
          timeout: 180000, // 3 minutes
        },
        {
          stepId: 'analyze_behavior',
          name: 'Analyze Behavioral Patterns',
          description: 'Identify anomalous user behavior',
          action: 'analyze_behavior',
          parameters: {
            timeWindow: 86400000, // 24 hours
          },
          validationRules: [],
          timeout: 600000, // 10 minutes
        },
        {
          stepId: 'correlate_data',
          name: 'Correlate Security Data',
          description: 'Correlate findings across multiple data sources',
          action: 'correlate_data',
          parameters: {
            dataSources: ['logs', 'metrics', 'threats'],
          },
          validationRules: [],
          timeout: 300000, // 5 minutes
        },
        {
          stepId: 'generate_report',
          name: 'Generate Investigation Report',
          description: 'Create comprehensive investigation report',
          action: 'generate_report',
          parameters: {
            includeRecommendations: true,
            format: 'json',
          },
          validationRules: [],
          timeout: 120000, // 2 minutes
        },
      ],
      requiredData: ['threat_id', 'user_id', 'timestamp'],
      estimatedDuration: 1800000, // 30 minutes
    },
  ],
}

/**
 * Default threat intelligence configuration
 */
export const defaultThreatIntelligenceConfig: ThreatIntelligenceConfig = {
  enabled: true,
  feeds: [
    {
      name: 'abuse_ch',
      type: 'open_source',
      url: 'https://urlhaus-api.abuse.ch/v1/urls',
      authType: 'none',
      rateLimit: {
        requestsPerMinute: 60,
        burstLimit: 10,
      },
      supportedIOCTypes: ['url', 'domain', 'ip'],
      updateFrequency: 3600000, // 1 hour
      enabled: true,
      priority: 1,
    },
    {
      name: 'alienvault_otx',
      type: 'community',
      url: 'https://otx.alienvault.com/api/v1',
      authType: 'api_key',
      apiKey: process.env.ALIENVAULT_API_KEY,
      rateLimit: {
        requestsPerMinute: 30,
        burstLimit: 5,
      },
      supportedIOCTypes: ['ip', 'domain', 'hash', 'url'],
      updateFrequency: 7200000, // 2 hours
      enabled: true,
      priority: 2,
    },
  ],
  updateInterval: 3600000, // 1 hour
  cacheTimeout: 86400000, // 24 hours
  apiKeys: {
    alienvault: process.env.ALIENVAULT_API_KEY || '',
    virustotal: process.env.VIRUSTOTAL_API_KEY || '',
    abuseipdb: process.env.ABUSEIPDB_API_KEY || '',
  },
}
