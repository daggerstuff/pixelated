/**
 * Rate Limiting Integration Bridge
 * Connects threat detection system with rate limiting system
 *
 * This bridge enables:
 * - Automatic rate limiting based on threat detection
 * - Bidirectional communication between systems
 * - Coordinated security responses
 * - Shared analytics and monitoring
 */

import { DistributedRateLimiter } from '../../rate-limiting/rate-limiter'
import { AdvancedResponseOrchestrator } from '../response-orchestration'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type { ThreatResponse } from '../response-orchestration'
import type {
  RateLimitRule,
  RateLimitResult,
} from '../../rate-limiting/types'

const logger = createBuildSafeLogger('threat-rate-limit-bridge')

export interface RateLimitContext {
  userId?: string
  ip?: string
  endpoint?: string
  userAgent?: string
  method?: string
  headers?: Record<string, string>
  threatId?: string
}

export interface RateLimitIntegrationConfig {
  /** Enable automatic rate limiting based on threats */
  enableAutoRateLimiting: boolean
  /** Enable threat detection based on rate limit violations */
  enableThreatDetection: boolean
  /** Default rate limit rules for different threat levels */
  threatLevelRules: {
    low: RateLimitRule
    medium: RateLimitRule
    high: RateLimitRule
    critical: RateLimitRule
  }
  /** Configuration for bypass rules */
  bypassRules: {
    /** Allow certain user roles to bypass rate limits */
    allowedRoles: string[]
    /** Allow certain IP ranges to bypass rate limits */
    allowedIPRanges: string[]
    /** Allow certain endpoints to bypass rate limits */
    allowedEndpoints: string[]
  }
  /** Configuration for escalation */
  escalationConfig: {
    /** Automatically escalate to human review after X violations */
    autoEscalateThreshold: number
    /** Time window for escalation consideration */
    escalationWindowMs: number
  }
}

export class RateLimitingBridge {
  private rateLimiter: DistributedRateLimiter
  private orchestrator: AdvancedResponseOrchestrator
  private config: RateLimitIntegrationConfig

  constructor(
    rateLimiter: DistributedRateLimiter,
    orchestrator: AdvancedResponseOrchestrator,
    config: RateLimitIntegrationConfig,
  ) {
    this.rateLimiter = rateLimiter
    this.orchestrator = orchestrator
    this.config = config
  }

  /**
   * Check rate limit and integrate with threat detection
   */
  async checkRateLimitWithThreatDetection(
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
    rateLimitResult: RateLimitResult
    threatResponse?: ThreatResponse
    shouldBlock: boolean
  }> {
    try {
      // Determine appropriate rule based on context
      // Check for bypass rules
      // console.log('TRACE: Bridge start', identifier)
      // console.log('TRACE: rateLimiter keys', Object.keys(this.rateLimiter))


      const rule = this.selectRateLimitRule(context)

      // Check rate limit
      const rateLimitResult = await this.rateLimiter.checkLimit(
        identifier,
        rule,
        context as unknown as Record<string, unknown>,
      )


      // If rate limited, trigger threat detection
      if (!rateLimitResult.allowed) {
        const threatResponse = await this.handleRateLimitViolation(
          identifier,
          context,
          rateLimitResult,
        )

        return {
          rateLimitResult,
          threatResponse,
          shouldBlock: true,
        }
      }

      // Check for potential threats even within limits
      const threatResponse = await this.checkForPotentialThreats(
        identifier,
        context,
        rateLimitResult,
      )

      return {
        rateLimitResult,
        threatResponse,
        shouldBlock: false,
      }
    } catch (error) {
      logger.error('Rate limit check with threat detection failed:', {
        error,
        identifier,
      })
      // Fail open - allow request if bridge fails
      const rule = this.selectRateLimitRule(context)
      const fallbackResult = await this.rateLimiter.getStatus(identifier, rule)

      return {
        rateLimitResult: fallbackResult,
        shouldBlock: false,
      }
    }
  }

  /**
   * Apply threat-based rate limiting
   */
  async applyThreatBasedRateLimiting(
    threatResponse: ThreatResponse,
    context: RateLimitContext,
  ): Promise<boolean> {
    if (!this.config.enableAutoRateLimiting) {
      return false
    }

    try {
      const actions = threatResponse.actions.filter(
        (action) => action.actionType === 'rate_limiting',
      )

      for (const action of actions) {
        if (action.parameters.userId && action.parameters.limit) {
          await this.rateLimiter.checkLimit(
            action.parameters.userId as string,
            {
              name: `threat_${threatResponse.responseId}`,
              maxRequests: action.parameters.limit as number,
              windowMs: (action.parameters.windowMs as number) || 60000,
              enableAttackDetection: true,
            },
            context as unknown as Record<string, unknown>,
          )
        }
      }

      logger.info('Applied threat-based rate limiting', {
        responseId: threatResponse.responseId,
        actions: actions.length,
      })

      return true
    } catch (error) {
      logger.error('Failed to apply threat-based rate limiting:', {
        error,
        responseId: threatResponse.responseId,
      })
      return false
    }
  }

  /**
   * Handle rate limit violations with threat detection
   */
  private async handleRateLimitViolation(
    identifier: string,
    context: RateLimitContext,
    rateLimitResult: RateLimitResult,
  ): Promise<ThreatResponse | undefined> {
    if (!this.config.enableThreatDetection) {
      return undefined
    }

    try {
      // Create threat data from rate limit violation
      const threatData = {
        threatId: `rate_limit_violation_${identifier}_${Date.now()}`,
        source: 'rate_limiting',
        severity: this.determineThreatSeverity(rateLimitResult),
        impact: this.calculateImpact(context),
        riskFactors: {
          identifier,
          userId: context.userId,
          ip: context.ip,
          endpoint: context.endpoint,
          userAgent: context.userAgent,
          violationCount: rateLimitResult.limit - rateLimitResult.remaining + 1,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          rateLimitResult,
          context,
        },
      }

      // Orchestrate response
      const threatResponse = await this.orchestrator.orchestrateResponse(
        threatData.threatId,
        threatData,
      )

      // Apply rate limiting based on threat response
      await this.applyThreatBasedRateLimiting(threatResponse, context)

      return threatResponse
    } catch (error) {
      logger.error('Failed to handle rate limit violation:', {
        error,
        identifier,
      })
      return undefined
    }
  }

  /**
   * Check for potential threats within rate limits
   */
  private async checkForPotentialThreats(
    identifier: string,
    context: RateLimitContext,
    rateLimitResult: RateLimitResult,
  ): Promise<ThreatResponse | undefined> {
    // Check if we're approaching rate limits (potential threat indicator)
    const usagePercentage =
      (rateLimitResult.limit - rateLimitResult.remaining) /
      rateLimitResult.limit

    if (usagePercentage > 0.8) {
      // 80% usage threshold
      const threatData = {
        threatId: `high_usage_${identifier}_${Date.now()}`,
        source: 'rate_monitoring',
        severity: 'medium',
        impact: 0.5,
        riskFactors: {
          identifier,
          userId: context.userId,
          ip: context.ip,
          endpoint: context.endpoint,
          usagePercentage,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          rateLimitResult,
          context,
        },
      }

      try {
        return await this.orchestrator.orchestrateResponse(
          threatData.threatId,
          threatData,
        )
      } catch (error) {
        logger.error('Failed to orchestrate high usage response:', {
          error,
          identifier,
        })
        return undefined
      }
    }

    return undefined
  }

  /**
   * Select appropriate rate limit rule based on context
   */
  private selectRateLimitRule(context: RateLimitContext): RateLimitRule {
    // Check for bypass rules
    if (this.shouldBypass(context)) {
      return {
        name: 'bypass',
        maxRequests: 1000, // High limit for bypassed requests
        windowMs: 60000,
        enableAttackDetection: false,
      }
    }

    // Default to low severity rule
    return this.config.threatLevelRules.low
  }

  /**
   * Check if request should bypass rate limits
   */
  private shouldBypass(context: RateLimitContext): boolean {
    // Check role-based bypass
    if (
      context.userId &&
      this.config.bypassRules.allowedRoles
        .includes(context.userId)

    ) {
      return true
    }

    // Check IP-based bypass
    if (context.ip && this.isAllowedIP(context.ip)) {
      return true
    }

    // Check endpoint-based bypass
    if (
      context.endpoint &&
      this.config.bypassRules.allowedEndpoints.includes(context.endpoint)
    ) {
      return true
    }

    return false
  }

  /**
   * Check if IP is in allowed ranges
   */
  private isAllowedIP(ip: string): boolean {
    return this.config.bypassRules.allowedIPRanges.some((range) => {
      if (range.includes('/')) {
        // CIDR notation
        const [network, prefixLength] = range.split('/')
        const mask = parseInt(prefixLength)
        const ipInt = this.ipToInt(ip)
        const networkInt = this.ipToInt(network)
        const maskInt = (0xffffffff << (32 - mask)) >>> 0
        return (ipInt & maskInt) === (networkInt & maskInt)
      } else {
        // Exact match
        return ip === range
      }
    })
  }

  /**
   * Convert IP address to integer
   */
  private ipToInt(ip: string): number {
    if (ip.includes(':')) {
      // Basic handling for IPv6 addresses. Full IPv6 -> integer conversion
      // would require BigInt and is out of scope for this simple utility.
      // Handle common loopback explicitly and return a safe fallback for others.
      if (ip === '::1') {
        return 1
      }
      // Unhandled IPv6 addresses return 0 to avoid throwing errors when
      // configurations contain IPv6 entries. This preserves existing behavior
      // for IPv4 while preventing crashes.
      return 0
    }
    return (
      ip
        .split('.')
        .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
    )
  }

  /**
   * Determine threat severity based on rate limit result
   */
  private determineThreatSeverity(
    rateLimitResult: RateLimitResult,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (rateLimitResult.retryAfter && rateLimitResult.retryAfter > 300) {
      return 'critical'
    }
    if (rateLimitResult.retryAfter && rateLimitResult.retryAfter > 60) {
      return 'high'
    }
    if (rateLimitResult.retryAfter && rateLimitResult.retryAfter > 10) {
      return 'medium'
    }
    return 'low'
  }

  /**
   * Calculate impact of rate limit violation
   */
  private calculateImpact(context: RateLimitContext): number {
    let impact = 0.1 // Base impact

    // Higher impact for authenticated users
    if (context.userId) {
      impact += 0.3
    }

    // Higher impact for sensitive endpoints
    if (context.endpoint && this.isSensitiveEndpoint(context.endpoint)) {
      impact += 0.4
    }

    // Higher impact for automated requests
    if (context.userAgent && this.isAutomatedUserAgent(context.userAgent)) {
      impact += 0.2
    }

    return Math.min(impact, 1.0) // Cap at 1.0
  }

  /**
   * Check if endpoint is sensitive
   */
  private isSensitiveEndpoint(endpoint: string): boolean {
    const sensitivePatterns = [
      '/api/auth',
      '/api/admin',
      '/api/internal',
      '/api/v1/private',
    ]
    return sensitivePatterns.some((pattern) => endpoint.includes(pattern))
  }

  /**
   * Check if user agent indicates automated requests
   */
  private isAutomatedUserAgent(userAgent: string): boolean {
    const botPatterns = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget']
    return botPatterns.some((pattern) =>
      userAgent.toLowerCase().includes(pattern),
    )
  }

  /**
   * Get integration status
   */
  async getStatus(): Promise<{
    healthy: boolean
    rateLimiterHealthy: boolean
    orchestratorHealthy: boolean
    recentIntegrations: number
  }> {
    try {
      // Check rate limiter health
      const rateLimiterHealthy =
        await this.rateLimiter.isBlocked('health_check')

      // Check orchestrator health (basic check)
      const orchestratorHealthy = true // Simplified for now

      // Get recent integration count
      const recentIntegrations = await this.getRecentIntegrationCount()

      return {
        healthy: rateLimiterHealthy && orchestratorHealthy,
        rateLimiterHealthy,
        orchestratorHealthy,
        recentIntegrations,
      }
    } catch (error) {
      logger.error('Failed to get integration status:', { error })
      return {
        healthy: false,
        rateLimiterHealthy: false,
        orchestratorHealthy: false,
        recentIntegrations: 0,
      }
    }
  }

  /**
   * Get recent integration count
   */
  private async getRecentIntegrationCount(): Promise<number> {
    try {
      // This would typically query a database or analytics system
      // For now, return a placeholder
      return 0
    } catch (error) {
      logger.error('Failed to get recent integration count:', { error })
      return 0
    }
  }
  /**
   * Increment counter for identifier
   */
  async incrementCounter(
    identifier: string,
    context: RateLimitContext,
  ): Promise<void> {
    const rule = this.selectRateLimitRule(context)
    await this.rateLimiter.incrementCounter(identifier, rule)
  }

  /**
   * Get remaining requests for identifier
   */
  async getRemainingRequests(
    identifier: string,
    context: RateLimitContext,
  ): Promise<number> {
    const rule = this.selectRateLimitRule(context)
    return this.rateLimiter.getRemainingRequests(identifier, rule)
  }

  /**
   * Reset counter for identifier
   */
  async resetCounter(
    identifier: string,
    context: RateLimitContext,
  ): Promise<void> {
    const rule = this.selectRateLimitRule(context)
    await this.rateLimiter.resetCounter(identifier, rule)
  }
}

/**
 * Create rate limiting bridge with default configuration
 */
export function createRateLimitingBridge(
  rateLimiter: DistributedRateLimiter,
  orchestrator: AdvancedResponseOrchestrator,
  customConfig?: Partial<RateLimitIntegrationConfig>,
): RateLimitingBridge {
  const defaultConfig: RateLimitIntegrationConfig = {
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
        windowMs: 300000, // 5 minutes
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
      escalationWindowMs: 3600000, // 1 hour
    },
  }

  const config = { ...defaultConfig, ...customConfig }
  return new RateLimitingBridge(rateLimiter, orchestrator, config)
}

