/**
 * Threat Detection Service - Main Integration Hub
 *
 * This service orchestrates all threat detection components and integrates
 * them with the rate limiting system. It provides a unified interface for
 * threat detection across the entire application.
 */

import { AdvancedResponseOrchestrator } from '../response-orchestration'
import { DistributedRateLimiter } from '../../rate-limiting/rate-limiter'
import { RateLimitingBridge } from './rate-limiting-bridge'
import { ThreatDetectionMiddleware } from './api-middleware'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  ThreatData,
  ThreatResponse,
  RateLimitResult,
  ThreatAnalysis,
} from '../response-orchestration'
import type { RateLimitIntegrationConfig } from './rate-limiting-bridge'

const logger = createBuildSafeLogger('threat-detection-service')

export interface ThreatDetectionConfig {
  /** Enable threat detection globally */
  enabled: boolean
  /** Enable automatic response orchestration */
  enableResponseOrchestration: boolean
  /** Enable rate limiting integration */
  enableRateLimiting: boolean
  /** Enable behavioral analysis */
  enableBehavioralAnalysis: boolean
  /** Enable predictive threat intelligence */
  enablePredictiveThreats: boolean
  /** Configuration for rate limiting integration */
  rateLimitConfig: RateLimitIntegrationConfig
  /** Configuration for response orchestration */
  responseConfig: {
    /** Enable automatic responses */
    enableAutoResponses: boolean
    /** Enable manual review for certain threats */
    enableManualReview: boolean
    /** Escalation thresholds */
    escalationThresholds: {
      low: number
      medium: number
      high: number
      critical: number
    }
  }
  /** Configuration for behavioral analysis */
  behavioralConfig: {
    /** Enable user profiling */
    enableProfiling: boolean
    /** Anomaly detection threshold */
    anomalyThreshold: number
    /** Behavioral baseline update interval */
    baselineUpdateInterval: number
  }
  /** Configuration for predictive intelligence */
  predictiveConfig: {
    /** Enable threat forecasting */
    enableForecasting: boolean
    /** Forecasting window (in hours) */
    forecastingWindow: number
    /** Confidence threshold for predictions */
    confidenceThreshold: number
  }
}

export class ThreatDetectionService {
  private orchestrator: AdvancedResponseOrchestrator
  private rateLimiter: DistributedRateLimiter
  private rateLimitingBridge: RateLimitingBridge
  private middleware: ThreatDetectionMiddleware
  private config: ThreatDetectionConfig

  constructor(
    orchestrator: unknown,
    rateLimiter: unknown,
    config: ThreatDetectionConfig,
  ) {
    this.orchestrator = orchestrator as any
    this.rateLimiter = rateLimiter as any
    this.config = config

    // Initialize rate limiting bridge
    this.rateLimitingBridge = createRateLimitingBridge(
      rateLimiter,
      orchestrator,
      config.rateLimitConfig,
    )

    // Initialize middleware
    this.middleware = createThreatDetectionMiddleware(this.rateLimitingBridge, {
      enabled: config.enabled,
      enableLogging: true,
    })
  }

  /**
   * Analyze a potential threat
   */
  async analyzeThreat(threatData: ThreatData): Promise<ThreatResponse> {
    if (!this.config.enabled) {
      return this.createEmptyResponse(threatData.threatId)
    }

    try {
      logger.info('Analyzing threat', {
        threatId: threatData.threatId,
        source: threatData.source,
        severity: threatData.severity,
      })

      // Perform comprehensive threat analysis
      const analysis = await this.performThreatAnalysis(threatData)

      // Orchestrate response based on analysis
      const response = await this.orchestrator.orchestrateResponse(
        threatData.threatId,
        {
          ...threatData,
          analysis,
          timestamp: new Date().toISOString(),
        },
      )

      // Apply rate limiting if enabled
      if (this.config.enableRateLimiting) {
        await this.rateLimitingBridge.applyThreatBasedRateLimiting(response, {
          threatId: threatData.threatId,
          ...threatData.riskFactors,
        })
      }

      // Log the response
      logger.info('Threat analysis completed', {
        threatId: threatData.threatId,
        severity: response.severity,
        actions: response.actions.length,
        blocked: response.actions.some((a) => a.actionType === 'block'),
      })

      return response
    } catch (error) {
      logger.error('Threat analysis failed:', {
        error,
        threatId: threatData.threatId,
      })
      return this.createEmptyResponse(threatData.threatId)
    }
  }

  /**
   * Check request with integrated rate limiting and threat detection
   */
  async checkRequest(
    identifier: string,
    context: {
      userId?: string
      ip?: string
      endpoint?: string
      userAgent?: string
      method?: string
      headers?: Record<string, string>
    },
  ): Promise<{
    allowed: boolean
    rateLimitResult?: RateLimitResult
    threatResponse?: ThreatResponse
    shouldBlock: boolean
  }> {
    if (!this.config.enabled) {
      return {
        allowed: true,
        shouldBlock: false,
      }
    }

    try {
      // Use rate limiting bridge to check both rate limits and threats
      const result =
        await this.rateLimitingBridge.checkRateLimitWithThreatDetection(
          identifier,
          context,
        )

      return {
        allowed: result.rateLimitResult.allowed,
        rateLimitResult: result.rateLimitResult,
        threatResponse: result.threatResponse,
        shouldBlock: result.shouldBlock,
      }
    } catch (error) {
      logger.error('Request check failed:', { error, identifier })
      // Fail open - allow request if check fails
      return {
        allowed: true,
        shouldBlock: false,
      }
    }
  }

  /**
   * Perform comprehensive threat analysis
   */
  private async performThreatAnalysis(
    threatData: ThreatData,
  ): Promise<ThreatAnalysis> {
    const analysis: ThreatAnalysis = {
      confidence: 0,
      patterns: [],
      riskFactors: [],
      recommendations: [],
    }

    // Analyze based on threat source
    switch (threatData.source) {
      case 'rate_limiting':
        analysis.confidence = this.analyzeRateLimitingThreat(threatData)
        analysis.patterns = this.detectRateLimitingPatterns(threatData)
        break

      case 'user_behavior':
        if (this.config.enableBehavioralAnalysis) {
          analysis.confidence = await this.analyzeBehavioralThreat(threatData)
          analysis.patterns = await this.detectBehavioralPatterns(threatData)
        }
        break

      case 'predictive':
        if (this.config.enablePredictiveThreats) {
          analysis.confidence = await this.analyzePredictiveThreat(threatData)
          analysis.patterns = await this.detectPredictivePatterns(threatData)
        }
        break

      default:
        analysis.confidence = this.analyzeGenericThreat(threatData)
        analysis.patterns = this.detectGenericPatterns(threatData)
    }

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(
      threatData,
      analysis,
    )

    return analysis
  }

  /**
   * Analyze rate limiting related threats
   */
  private analyzeRateLimitingThreat(threatData: ThreatData): number {
    const violationCount = threatData.riskFactors?.violationCount || 0
    const timeWindow = threatData.riskFactors?.timeWindow || 60000

    // Calculate violation rate
    const violationRate = violationCount / (timeWindow / 1000) // violations per second

    if (violationRate > 10) return 0.9 // Very high violation rate
    if (violationRate > 5) return 0.7 // High violation rate
    if (violationRate > 2) return 0.5 // Moderate violation rate
    return 0.3 // Low violation rate
  }

  /**
   * Detect rate limiting patterns
   */
  private detectRateLimitingPatterns(threatData: ThreatData): string[] {
    const patterns: string[] = []
    const violationCount = threatData.riskFactors?.violationCount || 0
    const timeWindow = threatData.riskFactors?.timeWindow || 60000

    // Check for burst patterns
    if (violationCount > timeWindow / 1000) {
      patterns.push('burst_pattern')
    }

    // Check for sustained violations
    if (violationCount > 5) {
      patterns.push('sustained_violations')
    }

    // Check for endpoint targeting
    if (threatData.riskFactors?.endpoint) {
      patterns.push('endpoint_targeting')
    }

    return patterns
  }

  /**
   * Analyze behavioral threats
   */
  private async analyzeBehavioralThreat(
    _threatData: ThreatData,
  ): Promise<number> {
    // This would integrate with the behavioral analysis service
    // For now, return a placeholder confidence score
    return 0.5
  }

  /**
   * Detect behavioral patterns
   */
  private async detectBehavioralPatterns(
    _threatData: ThreatData,
  ): Promise<string[]> {
    // This would integrate with the behavioral analysis service
    // For now, return empty array
    return []
  }

  /**
   * Analyze predictive threats
   */
  private async analyzePredictiveThreat(
    _threatData: ThreatData,
  ): Promise<number> {
    // This would integrate with the predictive threat intelligence service
    // For now, return a placeholder confidence score
    return 0.6
  }

  /**
   * Detect predictive patterns
   */
  private async detectPredictivePatterns(
    _threatData: ThreatData,
  ): Promise<string[]> {
    // This would integrate with the predictive threat intelligence service
    // For now, return empty array
    return []
  }

  /**
   * Analyze generic threats
   */
  private analyzeGenericThreat(threatData: ThreatData): number {
    // Base confidence based on severity
    switch (threatData.severity) {
      case 'critical':
        return 0.9
      case 'high':
        return 0.7
      case 'medium':
        return 0.5
      case 'low':
        return 0.3
      default:
        return 0.5
    }
  }

  /**
   * Detect generic patterns
   */
  private detectGenericPatterns(threatData: ThreatData): string[] {
    const patterns: string[] = []

    // Add patterns based on risk factors
    if (threatData.riskFactors?.ip) {
      patterns.push('suspicious_ip')
    }

    if (threatData.riskFactors?.userAgent) {
      patterns.push('suspicious_user_agent')
    }

    if (threatData.riskFactors?.endpoint) {
      patterns.push('sensitive_endpoint_access')
    }

    return patterns
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    threatData: ThreatData,
    analysis: ThreatAnalysis,
  ): string[] {
    const recommendations: string[] = []

    // Base recommendations on confidence and severity
    if (analysis.confidence > 0.7) {
      recommendations.push('immediate_review_required')
    }

    if (analysis.confidence > 0.5) {
      recommendations.push('enhanced_monitoring')
    }

    // Add pattern-specific recommendations
    if (analysis.patterns.includes('burst_pattern')) {
      recommendations.push('implement_burst_protection')
    }

    if (analysis.patterns.includes('endpoint_targeting')) {
      recommendations.push('endpoint_protection_required')
    }

    // Add severity-based recommendations
    switch (threatData.severity) {
      case 'critical':
        recommendations.push('immediate_block', 'security_team_alert')
        break
      case 'high':
        recommendations.push('temporary_block', 'admin_notification')
        break
      case 'medium':
        recommendations.push('increased_monitoring', 'log_for_review')
        break
      case 'low':
        recommendations.push('continue_monitoring', 'update_baseline')
        break
    }

    return recommendations
  }

  /**
   * Create empty threat response
   */
  private createEmptyResponse(threatId: string): ThreatResponse {
    return {
      responseId: `empty_${threatId}_${Date.now()}`,
      threatId,
      severity: 'low',
      confidence: 0,
      actions: [],
      recommendations: [],
      metadata: {
        source: 'threat_detection_service',
        timestamp: new Date().toISOString(),
        reason: 'service_disabled_or_error',
      },
    }
  }

  /**
   * Get middleware for integration with web framework
   */
  getMiddleware(): ThreatDetectionMiddleware {
    return this.middleware
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean
    components: {
      orchestrator: boolean
      rateLimiter: boolean
      bridge: boolean
      middleware: boolean
    }
    recentThreats: number
    recentResponses: number
  }> {
    try {
      const [bridgeStatus, orchestratorHealthy] = await Promise.all([
        this.rateLimitingBridge.getStatus(),
        this.orchestrator.isHealthy(),
      ])

      const middlewareStatus = await this.middleware.getHealthStatus()

      return {
        healthy:
          bridgeStatus.healthy &&
          orchestratorHealthy &&
          middlewareStatus.healthy,
        components: {
          orchestrator: orchestratorHealthy,
          rateLimiter: bridgeStatus.rateLimiterHealthy,
          bridge: bridgeStatus.healthy,
          middleware: middlewareStatus.healthy,
        },
        recentThreats: 0, // Would be populated from analytics
        recentResponses: bridgeStatus.recentIntegrations,
      }
    } catch (error) {
      logger.error('Failed to get health status:', { error })
      return {
        healthy: false,
        components: {
          orchestrator: false,
          rateLimiter: false,
          bridge: false,
          middleware: false,
        },
        recentThreats: 0,
        recentResponses: 0,
      }
    }
  }

  /**
   * Get service statistics
   */
  async getStatistics(): Promise<{
    totalThreats: number
    blockedRequests: number
    averageResponseTime: number
    threatDistribution: Record<string, number>
    responseDistribution: Record<string, number>
  }> {
    try {
      // This would typically query analytics databases
      // For now, return placeholder statistics
      return {
        totalThreats: 0,
        blockedRequests: 0,
        averageResponseTime: 0,
        threatDistribution: {},
        responseDistribution: {},
      }
    } catch (error) {
      logger.error('Failed to get statistics:', { error })
      return {
        totalThreats: 0,
        blockedRequests: 0,
        averageResponseTime: 0,
        threatDistribution: {},
        responseDistribution: {},
      }
    }
  }
}

/**
 * Create threat detection service with default configuration
 */
export function createThreatDetectionService(
  orchestrator: unknown,
  rateLimiter: unknown,
  customConfig?: Partial<ThreatDetectionConfig>,
): ThreatDetectionService {
  const defaultConfig: ThreatDetectionConfig = {
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
      baselineUpdateInterval: 86400000, // 24 hours
    },
    predictiveConfig: {
      enableForecasting: true,
      forecastingWindow: 24,
      confidenceThreshold: 0.7,
    },
  }

  const config = { ...defaultConfig, ...customConfig }
  return new ThreatDetectionService(
    orchestrator as any,
    rateLimiter as any,
    config,
  )
}
