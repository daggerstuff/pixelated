/**
 * API Middleware for Threat Detection Integration
 *
 * This middleware provides a seamless integration between threat detection
 * and rate limiting for all API requests. It can be used as Express middleware
 * or integrated with other web frameworks.
 */

import { Request, Response, NextFunction } from 'express'
import { RateLimitingBridge } from './rate-limiting-bridge'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type { RateLimitResult } from '../../rate-limiting/types'
import type { ThreatResponse } from '../response-orchestration'

const logger = createBuildSafeLogger('api-middleware')

export interface ApiMiddlewareConfig {
  /** Enable threat detection integration */
  enabled: boolean
  /** Rate limiting bridge instance */
  bridge: RateLimitingBridge
  /** Custom identifier extraction function */
  getIdentifier?: (req: Request) => string
  /** Custom context extraction function */
  getContext?: (req: Request) => ThreatDetectionContext
  /** Response handler for rate limited requests */
  rateLimitHandler?: (
    req: Request,
    res: Response,
    result: RateLimitCheckResult,
  ) => void
  /** Skip middleware for certain paths */
  skipPaths?: string[]
  /** Enable logging */
  enableLogging?: boolean
}

/**
 * Context gathered from an incoming request for threat detection and rate limiting
 */
export interface ThreatDetectionContext {
  ip?: string
  method?: string
  path?: string
  userAgent?: string | undefined
  timestamp?: string
  userId?: string
  userRole?: string
  sessionId?: string
  headers?: Record<string, unknown>
  body?: Record<string, unknown>
  [key: string]: unknown
}

export interface RateLimitCheckResult {
  rateLimitResult: RateLimitResult
  threatResponse?: ThreatResponse
  shouldBlock: boolean
}

// Augment Express Request to carry threat detection info
declare module 'express-serve-static-core' {
  interface Request {
    threatDetection?: {
      result: RateLimitCheckResult
      threatResponse?: ThreatResponse
    }
  }
}

export class ThreatDetectionMiddleware {
  private config: ApiMiddlewareConfig

  constructor(config: ApiMiddlewareConfig) {
    this.config = {
      enabled: true,
      enableLogging: true,
      skipPaths: ['/health', '/status', '/metrics'],
      ...config,
    }
  }

  /**
   * Express middleware function
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled) {
        return next().slice()
      }

      try {
        // Skip middleware for certain paths
        if (this.shouldSkip(req.path)) {
          return next()
        }

        // Get identifier and context
        const identifier = this.getIdentifier(req)
        const context = this.getContext(req)

        // Check rate limit with threat detection
        const result =
          await this.config.bridge.checkRateLimitWithThreatDetection(
            identifier,
            context,
          )

        // Log the check if enabled
        if (this.config.enableLogging) {
          logger.info('Rate limit and threat detection check', {
            path: req.path,
            method: req.method,
            identifier,
            allowed: result.rateLimitResult.allowed,
            shouldBlock: result.shouldBlock,
            threatDetected: !!result.threatResponse,
          })
        }

        // If request should be blocked
        if (result.shouldBlock) {
          if (this.config.rateLimitHandler) {
            return this.config.rateLimitHandler(req, res, result)
          }

          // Default rate limit response
          return this.defaultRateLimitHandler(req, res, result)
        }

        // Add threat detection context to request (typed via declaration merging above)
        req.threatDetection = {
          result,
          threatResponse: result.threatResponse,
        }

        // Continue to next middleware
        next()
      } catch (error: unknown) {
        logger.error('Threat detection middleware error:', {
          error,
          path: req.path,
        })

        // Fail open - allow request if middleware fails
        next()
      }
    }
  }

  /**
   * Check if middleware should be skipped for this path
   */
  private shouldSkip(path: string): boolean {
    return (
      this.config.skipPaths?.some(
        (skipPath) => path.startsWith(skipPath) || path === skipPath,
      ) || false
    )
  }

  /**
   * Get identifier from request
   */
  private getIdentifier(req: Request): string {
    if (this.config.getIdentifier) {
      return this.config.getIdentifier(req)
    }

    // Default identifier extraction
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
  }

  /**
   * Get context from request
   */
  private getContext(req: Request): ThreatDetectionContext {
    const context: ThreatDetectionContext = {
      ip: req.ip,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    }

    // Add user context if available
    if (req.user) {
      context.userId = req.user.id
      context.userRole = req.user.role
    }

    // Add session context if available
    if (req.session) {
      context.sessionId = req.session.id
    }

    // Add request headers (filtered)
    const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie']
    context.headers = Object.fromEntries(
      Object.entries(req.headers).filter(
        ([key]) => !sensitiveHeaders.includes(key.toLowerCase()),
      ),
    )

    // Add request body for certain methods (filtered)
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      // Filter sensitive fields
      const sensitiveFields = ['password', 'token', 'secret', 'key']
      context.body = Object.fromEntries(
        Object.entries(req.body).filter(
          ([key]) => !sensitiveFields.includes(key.toLowerCase()),
        ),
      )
    }

    // Add custom context if provided
    if (this.config.getContext) {
      Object.assign(context, this.config.getContext(req))
    }

    return context
  }

  /**
   * Default rate limit handler
   */
  private defaultRateLimitHandler(
    req: Request,
    res: Response,
    result: RateLimitCheckResult,
  ): void {
    const { rateLimitResult, threatResponse } = result

    res.set({
      'X-RateLimit-Limit': rateLimitResult.limit.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': rateLimitResult.resetTime.toISOString(),
      'X-RateLimit-Retry-After': rateLimitResult.retryAfter?.toString() || '0',
      'X-Threat-Detected': threatResponse ? 'true' : 'false',
    })

    if (threatResponse) {
      res.set('X-Threat-Response-Id', threatResponse.responseId)
      res.set('X-Threat-Severity', threatResponse.severity)
    }

    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      retryAfter: rateLimitResult.retryAfter,
      limit: rateLimitResult.limit,
      remaining: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime,
      threatDetected: !!threatResponse,
      ...(threatResponse && {
        threatResponse: {
          id: threatResponse.responseId,
          severity: threatResponse.severity,
          actions: threatResponse.actions.length,
        },
      }),
    })
  }

  /**
   * Get middleware health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean
    bridgeHealthy: boolean
    enabled: boolean
    recentRequests: number
  }> {
    try {
      const bridgeStatus = await this.config.bridge.getStatus()

      return {
        healthy: bridgeStatus.healthy,
        bridgeHealthy: bridgeStatus.healthy,
        enabled: this.config.enabled,
        recentRequests: bridgeStatus.recentIntegrations,
      }
    } catch (error) {
      logger.error('Failed to get middleware health status:', { error })
      return {
        healthy: false,
        bridgeHealthy: false,
        enabled: this.config.enabled,
        recentRequests: 0,
      }
    }
  }
}

/**
 * Create threat detection middleware
 */
export function createThreatDetectionMiddleware(
  bridge: RateLimitingBridge,
  customConfig?: Partial<ApiMiddlewareConfig>,
): ThreatDetectionMiddleware {
  const config: ApiMiddlewareConfig = {
    enabled: true,
    bridge,
    ...customConfig,
  }

  return new ThreatDetectionMiddleware(config)
}

/**
 * Express middleware shortcut
 */
export function threatDetection(
  bridge: RateLimitingBridge,
  config?: Partial<ApiMiddlewareConfig>,
): RequestHandler {
  const middleware = createThreatDetectionMiddleware(bridge, config)
  return middleware.middleware()
}

// Type alias for Express RequestHandler
type RequestHandler = (req: Request, res: Response, next: NextFunction) => void
