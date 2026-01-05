/**
 * Rate Limiting System for Pixelated
 *
 * A comprehensive distributed rate limiting solution with:
 * - Redis-based distributed rate limiting
 * - Attack pattern detection
 * - DDoS protection
 * - Better-Auth integration
 * - Real-time analytics and monitoring
 * - Configurable rules with role-based bypass
 */

export { DistributedRateLimiter, createRateLimiter } from './rate-limiter'
export { RateLimitAnalytics, rateLimitAnalytics } from './analytics'

export {
  createRateLimitMiddleware,
  createBetterAuthRateLimitMiddleware,
  createComprehensiveRateLimitMiddleware,
} from './middleware'

export {
  defaultRateLimitConfig,
  defaultRuleSets,
  defaultBypassRules,
  defaultDDoSConfig,
  defaultBetterAuthConfig,
  defaultWebSocketConfig,
  getEnvironmentConfig,
  getConfigFromEnv,
  getMergedConfig,
} from './config'

export type {
  RateLimitConfig,
  RateLimitRule,
  RateLimitResult,
  AttackPattern,
  RateLimitContext,
  RateLimitRuleSet,
  RateLimitAnalytics,
  SecurityEvent,
  RateLimitBypassRule,
  DDoSProtectionConfig,
  RateLimitMiddlewareConfig,
  RateLimitHeaders,
  BetterAuthRateLimitConfig,
  WebSocketRateLimitConfig,
  RateLimitAlert,
  RateLimitMonitor,
} from './types'

/**
 * Quick setup function for comprehensive rate limiting
 */
export function setupRateLimiting(
  options: {
    /** Enable all features */
    comprehensive?: boolean
    /** Enable Better-Auth integration */
    betterAuth?: boolean
    /** Enable DDoS protection */
    ddosProtection?: boolean
    /** Custom rule sets */
    customRuleSets?: import('./types').RateLimitRuleSet[]
    /** Custom bypass rules */
    customBypassRules?: import('./types').RateLimitBypassRule[]
    /** Better-Auth configuration */
    betterAuthConfig?: import('./types').BetterAuthRateLimitConfig
  } = {},
) {
  const {
    comprehensive = true,
    betterAuth = true,
    ddosProtection = true,
    customRuleSets = [],
    customBypassRules = [],
    betterAuthConfig,
  } = options

  if (comprehensive) {
    return createComprehensiveRateLimitMiddleware({
      customRuleSets,
      customBypassRules,
      enableDDoS: ddosProtection,
      enableBetterAuth: betterAuth,
      betterAuthConfig,
    })
  }

  if (betterAuth) {
    return createBetterAuthRateLimitMiddleware(betterAuthConfig)
  }

  return createRateLimitMiddleware({
    ruleSets: customRuleSets,
    bypassRules: customBypassRules,
  })
}

/**
 * Health check for rate limiting system
 */
export async function checkRateLimitHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  details: {
    redis: boolean
    analytics: boolean
    monitors: number
    recentAlerts: number
  }
}> {
  try {
    const redisHealthy = (await redis.ping()) === 'PONG'

    const analyticsHealthy = rateLimitAnalytics !== undefined

    const monitorCount =
      (rateLimitAnalytics as unknown as { monitors?: unknown[] }).monitors
        ?.length || 0

    const recentAlerts = await rateLimitAnalytics.getRecentAlerts(10)

    const details = {
      redis: redisHealthy,
      analytics: analyticsHealthy,
      monitors: monitorCount,
      recentAlerts: recentAlerts.length,
    }

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (!redisHealthy) {
      status = 'unhealthy'
    } else if (recentAlerts.length > 5) {
      status = 'degraded'
    }

    return { status, details }
  } catch (_error) {
    return {
      status: 'unhealthy',
      details: {
        redis: false,
        analytics: false,
        monitors: 0,
        recentAlerts: 0,
      },
    }
  }
}

/**
 * Get rate limiting system status
 */
export async function getRateLimitStatus(): Promise<{
  enabled: boolean
  rules: number
  monitors: number
  recentAlerts: number
  analytics: Awaited<ReturnType<typeof rateLimitAnalytics.getRealTimeMetrics>>
  health: Awaited<ReturnType<typeof checkRateLimitHealth>>
}> {
  const [analytics, health] = await Promise.all([
    rateLimitAnalytics.getRealTimeMetrics(),
    checkRateLimitHealth(),
  ])

  return {
    enabled: getMergedConfig().global.enabled,
    rules: defaultRuleSets.reduce((total, set) => total + set.rules.length, 0),
    monitors: (rateLimitAnalytics as unknown).monitors?.length || 0,
    recentAlerts: (await rateLimitAnalytics.getRecentAlerts(10)).length,
    analytics,
    health,
  }
}

/**
 * Default export with all components
 */
export default {
  DistributedRateLimiter,
  RateLimitAnalytics,
  rateLimitAnalytics,

  createRateLimitMiddleware,
  createBetterAuthRateLimitMiddleware,
  createComprehensiveRateLimitMiddleware,
  setupRateLimiting,

  defaultRateLimitConfig,
  defaultRuleSets,
  defaultBypassRules,
  defaultDDoSConfig,
  defaultBetterAuthConfig,
  defaultWebSocketConfig,
  getEnvironmentConfig,
  getConfigFromEnv,
  getMergedConfig,

  checkRateLimitHealth,
  getRateLimitStatus,
}
