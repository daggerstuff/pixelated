/**
 * Rate limiting middleware for Astro API routes
 * Integrates with Better-Auth and provides comprehensive protection
 */

import type { APIRoute, APIContext } from 'astro'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { createRateLimiter } from './rate-limiter'
import { getMergedConfig, defaultRuleSets, defaultBypassRules } from './config'
import type {
  RateLimitMiddlewareConfig,
  RateLimitContext,
  RateLimitRule,
  RateLimitResult,
  RateLimitHeaders,
  BetterAuthRateLimitConfig,
} from './types'

const logger = createBuildSafeLogger('rate-limit-middleware')

/**
 * Rate limiting middleware for Astro API routes
 */
export function createRateLimitMiddleware(
  config: RateLimitMiddlewareConfig = {},
) {
  const mergedConfig = {
    ruleSets: config.ruleSets || defaultRuleSets,
    bypassRules: config.bypassRules || defaultBypassRules,
    ddosProtection: config.ddosProtection,
    globalConfig: config.globalConfig,
    redisConfig: config.redisConfig,
  }

  const rateLimiter = createRateLimiter(getMergedConfig())

  /**
   * Main middleware function
   */
  return function rateLimitMiddleware(handler: APIRoute): APIRoute {
    return async (context: APIContext) => {
      try {
        // Check if rate limiting is enabled globally
        if (!(mergedConfig.globalConfig?.enabled ?? true)) {
          return handler(context)
        }

        // Extract request context
        const rateLimitContext = await extractRateLimitContext(context)

        // Check bypass rules
        const shouldBypass = await checkBypassRules(
          rateLimitContext,
          mergedConfig.bypassRules,
        )
        if (shouldBypass) {
          logger.debug('Request bypassed rate limiting', {
            identifier: rateLimitContext.identifier,
          })
          return handler(context)
        }

        // Determine which rule to apply
        const rule = await determineRule(
          rateLimitContext,
          mergedConfig.ruleSets,
        )
        if (!rule) {
          logger.warn('No rate limit rule found for request', {
            context: rateLimitContext,
          })
          return handler(context)
        }

        // Check rate limit
        const result = await rateLimiter.checkLimit(
          rateLimitContext.identifier,
          rule,
          rateLimitContext.metadata,
        )

        // Add rate limit headers to response
        const headers = createRateLimitHeaders(result, rule)

        if (!result.allowed) {
          // Return rate limit exceeded response
          return new Response(
            JSON.stringify({
              error: 'Rate limit exceeded',
              message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
              retryAfter: result.retryAfter,
              limit: result.limit,
              resetTime: result.resetTime.toISOString(),
            }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                ...headers,
                'Retry-After': result.retryAfter!.toString(),
              },
            },
          )
        }

        // Add headers to response
        context.request.headers.set(
          'X-RateLimit-Limit',
          headers['X-RateLimit-Limit'],
        )
        context.request.headers.set(
          'X-RateLimit-Remaining',
          headers['X-RateLimit-Remaining'],
        )
        context.request.headers.set(
          'X-RateLimit-Reset',
          headers['X-RateLimit-Reset'],
        )
        if (headers['X-RateLimit-Rule']) {
          context.request.headers.set(
            'X-RateLimit-Rule',
            headers['X-RateLimit-Rule'],
          )
        }

        // Continue to the actual handler
        const response = await handler(context)

        // Add rate limit headers to the response
        if (response instanceof Response) {
          const newHeaders = new Headers(response.headers)
          Object.entries(headers).forEach(([key, value]) => {
            newHeaders.set(key, value)
          })

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          })
        }

        return response
      } catch (error) {
        logger.error('Rate limiting middleware error:', { error })

        // Fail open - allow request if middleware fails
        return handler(context)
      }
    }
  }
}

/**
 * Extract rate limit context from Astro API context
 */
async function extractRateLimitContext(
  context: APIContext,
): Promise<RateLimitContext> {
  const request = context.request
  const url = new URL(request.url)

  // Get client IP (considering proxies)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const identifier =
    forwarded?.split(',')[0].trim() ||
    realIp ||
    context.clientAddress ||
    'unknown'

  // Get user role if authenticated (Better-Auth integration)
  let userRole: string | undefined
  try {
    // Try to get user info from Better-Auth session
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      // This would need to be implemented based on your Better-Auth setup
      // For now, we'll check for a simple role header
      userRole = request.headers.get('x-user-role') || undefined
    }
  } catch (error) {
    logger.debug('Could not extract user role', { error })
  }

  return {
    identifier,
    method: request.method,
    path: url.pathname,
    userAgent: request.headers.get('user-agent') || undefined,
    userRole,
    metadata: {
      url: url.toString(),
      headers: Object.fromEntries(request.headers.entries()),
      timestamp: Date.now(),
    },
  }
}

/**
 * Check if request should bypass rate limiting
 */
async function checkBypassRules(
  context: RateLimitContext,
  bypassRules: RateLimitMiddlewareConfig['bypassRules'] = [],
): Promise<boolean> {
  for (const rule of bypassRules) {
    const { conditions } = rule

    // Check role-based bypass
    if (conditions.roles && context.userRole) {
      if (conditions.roles.includes(context.userRole)) {
        return true
      }
    }

    // Check IP-based bypass
    if (conditions.ips && context.identifier) {
      if (isIpInRange(context.identifier, conditions.ips)) {
        return true
      }
    }

    // Check path-based bypass
    if (conditions.paths && context.path) {
      if (matchesPath(context.path, conditions.paths)) {
        return true
      }
    }

    // Check custom condition
    if (conditions.custom) {
      try {
        const result = await conditions.custom(context)
        if (result) {
          return true
        }
      } catch (error) {
        logger.error('Bypass rule custom condition failed:', {
          error,
          rule: rule.name,
        })
      }
    }
  }

  return false
}

/**
 * Determine which rate limit rule to apply
 */
async function determineRule(
  context: RateLimitContext,
  ruleSets: RateLimitMiddlewareConfig['ruleSets'] = [],
): Promise<RateLimitRule | null> {
  // Find matching rule set
  for (const ruleSet of ruleSets) {
    for (const rule of ruleSet.rules) {
      // Simple path-based matching (can be enhanced)
      if (matchesRule(context, rule)) {
        return rule
      }
    }
  }

  return null
}

/**
 * Check if context matches a specific rule
 */
function matchesRule(context: RateLimitContext, rule: RateLimitRule): boolean {
  // Check rule tags for path matching
  if (rule.tags) {
    // Strict rule for sensitive endpoints
    if (rule.tags.includes('strict') && isSensitivePath(context.path)) {
      return true
    }

    // Auth rule for auth endpoints
    if (rule.tags.includes('auth') && isAuthPath(context.path)) {
      return true
    }

    // AI rule for AI endpoints
    if (rule.tags.includes('ai') && isAiPath(context.path)) {
      return true
    }

    // Public rule for public endpoints
    if (rule.tags.includes('public') && isPublicPath(context.path)) {
      return true
    }
  }

  return false
}

/**
 * Check if path is sensitive
 */
function isSensitivePath(path?: string): boolean {
  if (!path) return false
  const sensitivePatterns = [
    '/api/admin',
    '/api/security',
    '/api/billing',
    '/api/payment',
    '/api/user/delete',
    '/api/user/update-password',
  ]
  return sensitivePatterns.some((pattern) => path.includes(pattern))
}

/**
 * Check if path is auth-related
 */
function isAuthPath(path?: string): boolean {
  if (!path) return false
  const authPatterns = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/reset-password',
    '/api/auth/verify',
    '/api/auth/signin',
    '/api/auth/signup',
  ]
  return authPatterns.some((pattern) => path.includes(pattern))
}

/**
 * Check if path is AI-related
 */
function isAiPath(path?: string): boolean {
  if (!path) return false
  const aiPatterns = [
    '/api/ai',
    '/api/bias-detection',
    '/api/mental-health',
    '/api/psychology',
  ]
  return aiPatterns.some((pattern) => path.includes(pattern))
}

/**
 * Check if path is public
 */
function isPublicPath(path?: string): boolean {
  if (!path) return false
  const publicPatterns = [
    '/api/health',
    '/api/docs',
    '/api/public',
    '/api/status',
  ]
  return publicPatterns.some((pattern) => path.includes(pattern))
}

/**
 * Check if IP is in allowed range
 */
function isIpInRange(ip: string, ranges: string[]): boolean {
  // Simple implementation - can be enhanced with proper IP range checking
  return ranges.some((range) => {
    if (range.includes('/')) {
      // CIDR notation - simplified check
      const [network] = range.split('/')
      return ip.startsWith(network)
    }
    return ip === range
  })
}

/**
 * Check if path matches any of the patterns
 */
function matchesPath(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.includes('*')) {
      // Wildcard pattern
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      return regex.test(path)
    }
    return path === pattern
  })
}

/**
 * Create rate limit headers from result
 */
function createRateLimitHeaders(
  result: RateLimitResult,
  rule: RateLimitRule,
): RateLimitHeaders {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(
      result.resetTime.getTime() / 1000,
    ).toString(),
    'X-RateLimit-Rule': rule.name,
  }
}

/**
 * Create Better-Auth specific rate limiting middleware
 */
export function createBetterAuthRateLimitMiddleware(
  authConfig: BetterAuthRateLimitConfig = { enabled: true },
) {
  if (!authConfig.enabled) {
    return (handler: APIRoute) => handler
  }

  const authRuleSet = {
    name: 'betterauth',
    description: 'Better-Auth specific rate limiting',
    rules: Object.values(authConfig.authRules || {}).filter(
      Boolean,
    ) as RateLimitRule[],
  }

  const authBypassRules: RateLimitBypassRule[] = []

  if (authConfig.bypassAuthenticated) {
    authBypassRules.push({
      name: 'authenticated_users',
      description: 'Bypass rate limiting for authenticated users',
      conditions: {
        custom: async (context) => {
          // Check if user is authenticated (has user role)
          return !!context.userRole && context.userRole !== 'anonymous'
        },
      },
    })
  }

  if (authConfig.bypassRoles && authConfig.bypassRoles.length > 0) {
    authBypassRules.push({
      name: 'privileged_roles',
      description: 'Bypass rate limiting for privileged roles',
      conditions: {
        roles: authConfig.bypassRoles,
      },
    })
  }

  return createRateLimitMiddleware({
    ruleSets: [authRuleSet],
    bypassRules: authBypassRules,
  })
}

/**
 * Create a comprehensive rate limiting middleware with all features
 */
export function createComprehensiveRateLimitMiddleware(
  options: {
    /** Custom rule sets */
    customRuleSets?: RateLimitMiddlewareConfig['ruleSets']
    /** Custom bypass rules */
    customBypassRules?: RateLimitMiddlewareConfig['bypassRules']
    /** Enable DDoS protection */
    enableDDoS?: boolean
    /** Enable Better-Auth integration */
    enableBetterAuth?: boolean
    /** Better-Auth configuration */
    betterAuthConfig?: BetterAuthRateLimitConfig
  } = {},
) {
  const ruleSets = [...(options.customRuleSets || []), ...defaultRuleSets]

  const bypassRules = [
    ...(options.customBypassRules || []),
    ...defaultBypassRules,
  ]

  let middleware = createRateLimitMiddleware({
    ruleSets,
    bypassRules,
    ddosProtection: options.enableDDoS ? undefined : undefined,
  })

  // Add Better-Auth integration if enabled
  if (options.enableBetterAuth) {
    const authMiddleware = createBetterAuthRateLimitMiddleware(
      options.betterAuthConfig || { enabled: true },
    )

    // Chain middlewares
    const originalMiddleware = middleware
    middleware = (handler: APIRoute) => {
      return originalMiddleware(authMiddleware(handler))
    }
  }

  return middleware
}
