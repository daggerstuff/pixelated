/**
 * Threat Detection Integration Module
 *
 * This module provides a unified interface for integrating threat detection
 * with various systems including rate limiting, API middleware, and external services.
 */

// Export rate limiting bridge
export {
  RateLimitingBridge,
  type RateLimitIntegrationConfig,
} from './rate-limiting-bridge'

// Export API middleware
export {
  ThreatDetectionMiddleware,
  createThreatDetectionMiddleware,
  type ApiMiddlewareConfig,
} from './api-middleware'

// Export main threat detection service
export {
  ThreatDetectionService,
  createThreatDetectionService,
  type ThreatDetectionConfig,
} from './threat-detection-service'

// Export utility functions
export * from './utils'

// Export AI-enhanced monitoring
export {
  AIEnhancedMonitoringService,
  type MonitoringConfig,
  type SecurityMetrics,
  type AIInsight,
  type Alert,
} from '../monitoring/ai-enhanced-monitoring'

// Export threat hunting service
export {
  ThreatHuntingService,
  type ThreatHuntingConfig,
  type HuntingRule,
  type InvestigationTemplate,
  type HuntResult,
  type HuntFinding,
  type Investigation,
  type InvestigationFinding,
} from '../threat-hunting/threat-hunting-service'

// Export external threat intelligence
export {
  ExternalThreatIntelligenceService,
  type ThreatIntelligenceConfig,
  type ThreatIntelligenceFeed,
  type ThreatIntelligence,
  type ThreatIntelligenceQuery,
  type ThreatIntelligenceResult,
} from './external-threat-intelligence'

// Re-export types from response orchestration
export type {
  ThreatData,
  ThreatResponse,
  ResponseAction,
  RateLimitRule,
  RateLimitResult,
  ThreatAnalysis,
} from '../response-orchestration'

/**
 * Create a complete threat detection integration setup
 */
export function createThreatDetectionIntegration(
  orchestrator: unknown,
  rateLimiter: unknown,
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
      threatDetectionService.analyzeThreat(threatData),
    checkRequest: (identifier: string, context: unknown) =>
      threatDetectionService.checkRequest(identifier, context),
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
  getIdentifier: (req: unknown) => {
    if (req.user?.id) {
      return `user:${req.user.id}`
    }
    if (req.session?.id) {
      return `session:${req.session.id}`
    }
    if (req.ip) {
      return `ip:${req.ip}`
    }
    return 'unknown'
  },
  getContext: (req: unknown) => ({
    ip: req.ip,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    userId: req.user?.id,
    userRole: req.user?.role,
    sessionId: req.session?.id,
    headers: Object.fromEntries(
      Object.entries(req.headers).filter(
        ([key]) =>
          !['authorization', 'cookie', 'set-cookie'].includes(
            key.toLowerCase(),
          ),
      ),
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

/**
 * Create AI-enhanced monitoring service
 */
export function createAIEnhancedMonitoring(config: MonitoringConfig): AIEnhancedMonitoringService {
  return new AIEnhancedMonitoringService(config)
}

/**
 * Create threat hunting service
 */
export function createThreatHuntingService(config: ThreatHuntingConfig): ThreatHuntingService {
  return new ThreatHuntingService(config)
}

/**
 * Create external threat intelligence service
 */
export function createExternalThreatIntelligence(config: ThreatIntelligenceConfig): ExternalThreatIntelligenceService {
  return new ExternalThreatIntelligenceService(config)
}

/**
 * Create complete Phase 8 threat detection system
 */
export function createCompleteThreatDetectionSystem(
  orchestrator: unknown,
  rateLimiter: unknown,
  options?: {
    threatDetection?: Partial<ThreatDetectionConfig>
    monitoring?: Partial<MonitoringConfig>
    hunting?: Partial<ThreatHuntingConfig>
    intelligence?: Partial<ThreatIntelligenceConfig>
  }
) {
  // Create main threat detection service
  const threatDetectionService = createThreatDetectionService(orchestrator, rateLimiter, options?.threatDetection)

  // Create AI-enhanced monitoring
  const monitoringService = createAIEnhancedMonitoring({
    enabled: true,
    aiInsightsEnabled: true,
    alertThresholds: {
      critical: 100,
      high: 50,
      medium: 20,
      low: 5
    },
    monitoringIntervals: {
      realTime: 30000, // 30 seconds
      batch: 300000,   // 5 minutes
      anomalyDetection: 60000 // 1 minute
    },
    notificationChannels: [
      {
        name: 'dashboard',
        type: 'dashboard',
        enabled: true,
        priority: 1,
        config: {}
      },
      {
        name: 'security_team',
        type: 'email',
        enabled: true,
        priority: 3,
        config: {
          recipients: ['security@pixelatedempathy.com']
        }
      }
    ],
    aiModelConfig: {
      modelPath: './models/anomaly_detection',
      confidenceThreshold: 0.7,
      predictionWindow: 24
    },
    ...options?.monitoring
  })

  // Create threat hunting service
  const huntingService = createThreatHuntingService({
    enabled: true,
    huntingFrequency: 300000, // 5 minutes
    investigationTimeout: 1800000, // 30 minutes
    mlModelConfig: {
      enabled: true,
      modelPath: './models/threat_hunting',
      confidenceThreshold: 0.8
    },
    huntingRules: [
      {
        ruleId: 'high_threat_volume',
        name: 'High Threat Volume Detection',
        description: 'Detect unusually high volume of threats in recent period',
        query: {
          recentThreats: true,
          timeWindow: 3600000 // 1 hour
        },
        severity: 'high',
        enabled: true,
        autoInvestigate: true,
        investigationPriority: 3
      },
      {
        ruleId: 'suspicious_ip_patterns',
        name: 'Suspicious IP Patterns',
        description: 'Detect patterns in suspicious IP addresses',
        query: {
          suspiciousIPs: true,
          patternAnalysis: true
        },
        severity: 'medium',
        enabled: true,
        autoInvestigate: false,
        investigationPriority: 2
      },
      {
        ruleId: 'rate_limit_anomalies',
        name: 'Rate Limiting Anomalies',
        description: 'Detect unusual rate limiting activity',
        query: {
          rateLimitViolations: true,
          threshold: 20
        },
        severity: 'low',
        enabled: true,
        autoInvestigate: false,
        investigationPriority: 1
      }
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
              logLevels: ['error', 'warning']
            },
            validationRules: [
              {
                type: 'threshold',
                condition: 'error_count',
                expectedValue: 10,
                operator: 'less_than'
              }
            ],
            timeout: 300000 // 5 minutes
          },
          {
            stepId: 'check_iocs',
            name: 'Check Indicators of Compromise',
            description: 'Verify IOCs against threat intelligence',
            action: 'check_iocs',
            parameters: {
              iocTypes: ['ip', 'domain', 'hash']
            },
            validationRules: [],
            timeout: 180000 // 3 minutes
          },
          {
            stepId: 'analyze_behavior',
            name: 'Analyze Behavioral Patterns',
            description: 'Identify anomalous user behavior',
            action: 'analyze_behavior',
            parameters: {
              timeWindow: 86400000 // 24 hours
            },
            validationRules: [],
            timeout: 600000 // 10 minutes
          },
          {
            stepId: 'correlate_data',
            name: 'Correlate Security Data',
            description: 'Correlate findings across multiple data sources',
            action: 'correlate_data',
            parameters: {
              dataSources: ['logs', 'metrics', 'threats']
            },
            validationRules: [],
            timeout: 300000 // 5 minutes
          },
          {
            stepId: 'generate_report',
            name: 'Generate Investigation Report',
            description: 'Create comprehensive investigation report',
            action: 'generate_report',
            parameters: {
              includeRecommendations: true,
              format: 'json'
            },
            validationRules: [],
            timeout: 120000 // 2 minutes
          }
        ],
        requiredData: ['threat_id', 'user_id', 'timestamp'],
        estimatedDuration: 1800000 // 30 minutes
      }
    ],
    ...options?.hunting
  })

  // Create external threat intelligence service
  const intelligenceService = createExternalThreatIntelligence({
    enabled: true,
    feeds: [
      {
        name: 'abuse_ch',
        type: 'open_source',
        url: 'https://urlhaus-api.abuse.ch/v1/urls',
        authType: 'none',
        rateLimit: {
          requestsPerMinute: 60,
          burstLimit: 10
        },
        supportedIOCTypes: ['url', 'domain', 'ip'],
        updateFrequency: 3600000, // 1 hour
        enabled: true,
        priority: 1
      },
      {
        name: 'alienvault_otx',
        type: 'community',
        url: 'https://otx.alienvault.com/api/v1',
        authType: 'api_key',
        apiKey: process.env.ALIENVAULT_API_KEY,
        rateLimit: {
          requestsPerMinute: 30,
          burstLimit: 5
        },
        supportedIOCTypes: ['ip', 'domain', 'hash', 'url'],
        updateFrequency: 7200000, // 2 hours
        enabled: true,
        priority: 2
      }
    ],
    updateInterval: 3600000, // 1 hour
    cacheTimeout: 86400000, // 24 hours
    apiKeys: {
      alienvault: process.env.ALIENVAULT_API_KEY || '',
      virustotal: process.env.VIRUSTOTAL_API_KEY || '',
      abuseipdb: process.env.ABUSEIPDB_API_KEY || ''
    },
    ...options?.intelligence
  })

  return {
    threatDetectionService,
    monitoringService,
    huntingService,
    intelligenceService
  }
}

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
    low: 5
  },
  monitoringIntervals: {
    realTime: 30000, // 30 seconds
    batch: 300000,   // 5 minutes
    anomalyDetection: 60000 // 1 minute
  },
  notificationChannels: [
    {
      name: 'dashboard',
      type: 'dashboard',
      enabled: true,
      priority: 1,
      config: {}
    },
    {
      name: 'security_team',
      type: 'email',
      enabled: true,
      priority: 3,
      config: {
        recipients: ['security@pixelatedempathy.com']
      }
    }
  ],
  aiModelConfig: {
    modelPath: './models/anomaly_detection',
    confidenceThreshold: 0.7,
    predictionWindow: 24
  }
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
    confidenceThreshold: 0.8
  },
  huntingRules: [
    {
      ruleId: 'high_threat_volume',
      name: 'High Threat Volume Detection',
      description: 'Detect unusually high volume of threats in recent period',
      query: {
        recentThreats: true,
        timeWindow: 3600000 // 1 hour
      },
      severity: 'high',
      enabled: true,
      autoInvestigate: true,
      investigationPriority: 3
    },
    {
      ruleId: 'suspicious_ip_patterns',
      name: 'Suspicious IP Patterns',
      description: 'Detect patterns in suspicious IP addresses',
      query: {
        suspiciousIPs: true,
        patternAnalysis: true
      },
      severity: 'medium',
      enabled: true,
      autoInvestigate: false,
      investigationPriority: 2
    },
    {
      ruleId: 'rate_limit_anomalies',
      name: 'Rate Limiting Anomalies',
      description: 'Detect unusual rate limiting activity',
      query: {
        rateLimitViolations: true,
        threshold: 20
      },
      severity: 'low',
      enabled: true,
      autoInvestigate: false,
      investigationPriority: 1
    }
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
            logLevels: ['error', 'warning']
          },
          validationRules: [
            {
              type: 'threshold',
              condition: 'error_count',
              expectedValue: 10,
              operator: 'less_than'
            }
          ],
          timeout: 300000 // 5 minutes
        },
        {
          stepId: 'check_iocs',
          name: 'Check Indicators of Compromise',
          description: 'Verify IOCs against threat intelligence',
          action: 'check_iocs',
          parameters: {
            iocTypes: ['ip', 'domain', 'hash']
          },
          validationRules: [],
          timeout: 180000 // 3 minutes
        },
        {
          stepId: 'analyze_behavior',
          name: 'Analyze Behavioral Patterns',
          description: 'Identify anomalous user behavior',
          action: 'analyze_behavior',
          parameters: {
            timeWindow: 86400000 // 24 hours
          },
          validationRules: [],
          timeout: 600000 // 10 minutes
        },
        {
          stepId: 'correlate_data',
          name: 'Correlate Security Data',
          description: 'Correlate findings across multiple data sources',
          action: 'correlate_data',
          parameters: {
            dataSources: ['logs', 'metrics', 'threats']
          },
          validationRules: [],
          timeout: 300000 // 5 minutes
        },
        {
          stepId: 'generate_report',
          name: 'Generate Investigation Report',
          description: 'Create comprehensive investigation report',
          action: 'generate_report',
          parameters: {
            includeRecommendations: true,
            format: 'json'
          },
          validationRules: [],
          timeout: 120000 // 2 minutes
        }
      ],
      requiredData: ['threat_id', 'user_id', 'timestamp'],
      estimatedDuration: 1800000 // 30 minutes
    }
  ]
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
        burstLimit: 10
      },
      supportedIOCTypes: ['url', 'domain', 'ip'],
      updateFrequency: 3600000, // 1 hour
      enabled: true,
      priority: 1
    },
    {
      name: 'alienvault_otx',
      type: 'community',
      url: 'https://otx.alienvault.com/api/v1',
      authType: 'api_key',
      apiKey: process.env.ALIENVAULT_API_KEY,
      rateLimit: {
        requestsPerMinute: 30,
        burstLimit: 5
      },
      supportedIOCTypes: ['ip', 'domain', 'hash', 'url'],
      updateFrequency: 7200000, // 2 hours
      enabled: true,
      priority: 2
    }
  ],
  updateInterval: 3600000, // 1 hour
  cacheTimeout: 86400000, // 24 hours
  apiKeys: {
    alienvault: process.env.ALIENVAULT_API_KEY || '',
    virustotal: process.env.VIRUSTOTAL_API_KEY || '',
    abuseipdb: process.env.ABUSEIPDB_API_KEY || ''
  }
}
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
