/**
 * Utility Functions for Threat Detection Integration
 *
 * These helper functions provide common functionality used across
 * the threat detection integration components.
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import crypto from 'node:crypto'
import type {
  ThreatData,
  ThreatResponse,
  ResponseAction,
} from '../response-orchestration'
import { ExternalThreatIntelligenceService } from './external-threat-intelligence'

const logger = createBuildSafeLogger('threat-detection-utils')

/**
 * Generate a unique threat ID
 */
export function generateThreatId(): string {
  try {
    const c: unknown = crypto
    const asObj = c as Record<string, unknown> | undefined
    if (asObj && typeof asObj['randomUUID'] === 'function') {
      const fn = asObj['randomUUID'] as () => string
      return `threat_${fn()}`
    }
    if (asObj && typeof asObj['randomBytes'] === 'function') {
      const fn = asObj['randomBytes'] as (size: number) => Buffer
      return `threat_${fn(16).toString('hex')}`
    }
  } catch (_err) {
    // Log at debug level to avoid swallowing errors silently
    logger.debug('generateThreatId: crypto fallback failed', {
      error: String(_err),
    })
  }
  return _secureId('threat_')
}

function _secureId(prefix = ''): string {
  try {
    const c: unknown = crypto
    const asObj = c as Record<string, unknown> | undefined
    if (asObj && typeof asObj['randomUUID'] === 'function') {
      const fn = asObj['randomUUID'] as () => string
      return `${prefix}${fn()}`
    }
    if (asObj && typeof asObj['randomBytes'] === 'function') {
      const fn = asObj['randomBytes'] as (size: number) => Buffer
      return `${prefix}${fn(16).toString('hex')}`
    }
  } catch (_err) {
    // Log at debug level to avoid swallowing errors silently
    logger.debug('_secureId: crypto fallback failed', { error: String(_err) })
  }
  return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Validate threat data structure
 */
export function validateThreatData(threatData: Partial<ThreatData>): boolean {
  if (!threatData.threatId) {
    logger.warn('Threat ID is required')
    return false
  }

  if (!threatData.source) {
    logger.warn('Threat source is required')
    return false
  }

  if (
    !threatData.severity ||
    !['low', 'medium', 'high', 'critical'].includes(threatData.severity)
  ) {
    logger.warn('Valid severity level is required')
    return false
  }

  if (!threatData.timestamp) {
    logger.warn('Timestamp is required')
    return false
  }

  return true
}

/**
 * Sanitize sensitive data from threat context
 */
export function sanitizeThreatContext(
  context: Record<string, unknown>,
): Record<string, unknown> {
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'credit_card',
    'ssn',
    'pii',
    'personal',
    'private',
  ]

  const sanitized = { ...context }

  Object.keys(sanitized).forEach((key) => {
    const lowerKey = key.toLowerCase()

    // Remove sensitive fields
    if (sensitiveFields.some((field) => lowerKey.includes(field))) {
      delete sanitized[key]
      logger.debug('Removed sensitive field:', { field: key })
    }

    // Sanitize string values that might contain sensitive info
    if (
      typeof sanitized[key] === 'string' &&
      (sanitized[key] as string).length > 100
    ) {
      // Truncate long strings to prevent data leakage
      sanitized[key] = (sanitized[key] as string).substring(0, 100) + '...'
    }
  })

  return sanitized
}

/**
 * Calculate threat score based on various factors
 */
export function calculateThreatScore(threatData: ThreatData): number {
  let score = 0

  // Base score from severity
  switch (threatData.severity) {
    case 'critical':
      score += 90
      break
    case 'high':
      score += 70
      break
    case 'medium':
      score += 50
      break
    case 'low':
      score += 30
      break
  }

  // Add risk factor contributions
  if (threatData.riskFactors) {
    const violationCount = threatData.riskFactors.violationCount || 0
    const timeWindow = threatData.riskFactors.timeWindow || 60000

    // Calculate violation rate
    const violationRate = violationCount / (timeWindow / 1000)
    score += Math.min(violationRate * 10, 20) // Max 20 points from violation rate

    // Add points for suspicious patterns
    if (
      threatData.riskFactors.ip &&
      isSuspiciousIP(threatData.riskFactors.ip)
    ) {
      score += 15
    }

    if (
      threatData.riskFactors.userAgent &&
      isSuspiciousUserAgent(threatData.riskFactors.userAgent)
    ) {
      score += 10
    }

    if (
      threatData.riskFactors.endpoint &&
      isSensitiveEndpoint(threatData.riskFactors.endpoint)
    ) {
      score += 20
    }
  }

  // Cap score at 100
  return Math.min(score, 100)
}

/**
 * Check if IP address is suspicious
 */
export async function isSuspiciousIP(
  ip: string,
  threatIntelligenceService?: ExternalThreatIntelligenceService,
): Promise<boolean> {
  // Private IP ranges
  const privateRanges = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^127\./,
    /^169\.254\./,
  ]

  // Check if IP is in private range
  if (privateRanges.some((range) => range.test(ip))) {
    return false // Private IPs are not suspicious
  }

  // Check for localhost
  if (ip === '127.0.0.1' || ip === '::1') {
    return false
  }

  // External threat intelligence checks
  if (threatIntelligenceService) {
    try {
      const threatResult = await threatIntelligenceService.queryIntelligence({
        iocType: 'ip',
        iocValue: ip,
      })

      // If we found threat intelligence for this IP, it's suspicious
      if (threatResult.intelligence.length > 0) {
        logger.info(`IP ${ip} found in threat intelligence`, {
          sources: threatResult.sources,
          threatCount: threatResult.intelligence.length,
        })
        return true
      }

      // Log cache hit/miss for monitoring
      logger.debug(`Threat intelligence query for IP ${ip}`, {
        cacheHit: threatResult.cacheHit,
        sources: threatResult.sources,
      })
    } catch (error) {
      // Log error but don't fail the check - fallback to basic heuristics
      logger.warn(`Failed to query threat intelligence for IP ${ip}`, {
        error: String(error),
      })
    }
  }

  // Fallback: consider non-private IPs as potentially suspicious
  // This maintains the original behavior when threat intelligence is unavailable
  return true
}

/**
 * Check if IP address is suspicious (synchronous version for backward compatibility)
 * @deprecated Use isSuspiciousIP with threat intelligence service for better accuracy
 */
export function isSuspiciousIPSync(ip: string): boolean {
  // Private IP ranges
  const privateRanges = [
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^127\./,
    /^169\.254\./,
  ]

  // Check if IP is in private range
  if (privateRanges.some((range) => range.test(ip))) {
    return false // Private IPs are not suspicious
  }

  // Check for localhost
  if (ip === '127.0.0.1' || ip === '::1') {
    return false
  }

  // Fallback: consider non-private IPs as potentially suspicious
  return true
}

/**
 * Check if IP address is suspicious with enhanced threat intelligence
 * This is a convenience function that initializes the threat intelligence service if needed
 */
export async function checkSuspiciousIPWithIntelligence(
  ip: string,
  config?: {
    mongoUrl?: string
    redisUrl?: string
    enabled?: boolean
  },
): Promise<boolean> {
  if (!config?.enabled) {
    return isSuspiciousIPSync(ip)
  }

  try {
    const threatService = new ExternalThreatIntelligenceService({
      mongoUrl:
        config.mongoUrl ||
        process.env.MONGODB_URL ||
        'mongodb://localhost:27017',
      redisUrl:
        config.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
      enabled: true,
    })

    await threatService.initialize()
    const result = await isSuspiciousIP(ip, threatService)
    await threatService.shutdown()
    return result
  } catch (error) {
    logger.warn(
      'Failed to use threat intelligence service, falling back to basic check',
      {
        error: String(error),
      },
    )
    return isSuspiciousIPSync(ip)
  }
}

/**
 * Check if user agent is suspicious
 */
export function isSuspiciousUserAgent(userAgent: string): boolean {
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scanner/i,
    /test/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java/i,
    /perl/i,
  ]

  return suspiciousPatterns.some((pattern) => pattern.test(userAgent))
}

/**
 * Check if endpoint is sensitive
 */
export function isSensitiveEndpoint(endpoint: string): boolean {
  const sensitivePatterns = [
    /\/admin/i,
    /\/api\/admin/i,
    /\/api\/internal/i,
    /\/config/i,
    /\/settings/i,
    /\/users/i,
    /\/auth/i,
    /\/login/i,
    /\/password/i,
    /\/reset/i,
  ]

  return sensitivePatterns.some((pattern) => pattern.test(endpoint))
}

/**
 * Format threat response for logging
 */
export function formatThreatResponseForLogging(
  response: ThreatResponse,
): Record<string, unknown> {
  return {
    responseId: response.responseId,
    threatId: response.threatId,
    severity: response.severity,
    confidence: response.confidence,
    actions: response.actions.map((action) => ({
      type: action.actionType,
      target: action.target,
      metadata: action.metadata,
    })),
    recommendations: response.recommendations,
    timestamp: response.metadata?.timestamp,
    source: response.metadata?.source,
  }
}

/**
 * Determine if a request should be blocked based on threat response
 */
export function shouldBlockRequest(response: ThreatResponse): boolean {
  return response.actions.some(
    (action) => action.actionType === 'block' || action.actionType === 'deny',
  )
}

/**
 * Determine if a request should be rate limited based on threat response
 */
export function shouldRateLimitRequest(response: ThreatResponse): boolean {
  return response.actions.some(
    (action) =>
      action.actionType === 'rate_limit' || action.actionType === 'throttle',
  )
}

/**
 * Extract rate limiting parameters from threat response
 */
export function extractRateLimitParams(response: ThreatResponse): {
  maxRequests: number
  windowMs: number
  message?: string
} {
  const rateLimitAction = response.actions.find(
    (action) =>
      action.actionType === 'rate_limit' || action.actionType === 'throttle',
  )

  if (!rateLimitAction) {
    return {
      maxRequests: 100,
      windowMs: 60000,
    }
  }

  return {
    maxRequests: rateLimitAction.metadata?.maxRequests || 10,
    windowMs: rateLimitAction.metadata?.windowMs || 60000,
    message: rateLimitAction.metadata?.message,
  }
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string,
  code: string = 'THREAT_DETECTION_ERROR',
  details?: Record<string, unknown>,
): ThreatResponse {
  logger.error('Threat detection error:', { error, code, details })

  return {
    responseId: _secureId('error_'),
    threatId: 'error',
    severity: 'low',
    confidence: 0,
    actions: [],
    recommendations: [],
    metadata: {
      source: 'threat_detection_utils',
      timestamp: new Date().toISOString(),
      error,
      code,
      details,
    },
  }
}

/**
 * Debounce function to limit how often a function can be called
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(() => {
      // We intentionally ignore the return value of func for debounce
      // and cast args to unknown[] to call safely.
      ;(func as (...a: unknown[]) => unknown)(...(args as unknown[]))
      timeout = null
    }, wait)
  }
}

/**
 * Throttle function to limit how often a function can be called
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      ;(func as (...a: unknown[]) => unknown)(...(args as unknown[]))
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * Memoize function results to avoid repeated calculations
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  func: T,
  keyGenerator?: (...args: Parameters<T>) => string,
): T {
  const cache = new Map<string, ReturnType<T>>()

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key)!
    }

    const result = (func as (...a: unknown[]) => unknown)(
      ...(args as unknown[]),
    )
    cache.set(key, result as ReturnType<T>)
    return result as ReturnType<T>
  }) as T
}

/**
 * Convert threat severity to numeric value for calculations
 */
export function severityToNumber(severity: string): number {
  switch (severity) {
    case 'critical':
      return 4
    case 'high':
      return 3
    case 'medium':
      return 2
    case 'low':
      return 1
    default:
      return 0
  }
}

/**
 * Convert numeric severity back to string
 */
export function numberToSeverity(number: number): string {
  if (number >= 4) {
    return 'critical'
  }
  if (number >= 3) {
    return 'high'
  }
  if (number >= 2) {
    return 'medium'
  }
  if (number >= 1) {
    return 'low'
  }
  return 'low'
}

/**
 * Calculate time window for rate limiting based on threat level
 */
export function calculateRateLimitWindow(severity: string): number {
  switch (severity) {
    case 'critical':
      return 300000 // 5 minutes
    case 'high':
      return 60000 // 1 minute
    case 'medium':
      return 300000 // 5 minutes
    case 'low':
      return 600000 // 10 minutes
    default:
      return 60000 // 1 minute
  }
}

/**
 * Calculate maximum requests for rate limiting based on threat level
 */
export function calculateRateLimitMaxRequests(severity: string): number {
  switch (severity) {
    case 'critical':
      return 1
    case 'high':
      return 5
    case 'medium':
      return 10
    case 'low':
      return 50
    default:
      return 100
  }
}

/**
 * Check if an identifier is allowed to bypass rate limiting
 */
export function isRateLimitBypassAllowed(
  identifier: string,
  bypassRules: {
    allowedRoles?: string[]
    allowedIPRanges?: string[]
    allowedEndpoints?: string[]
  },
  context: {
    userRole?: string
    ip?: string
    endpoint?: string
  },
): boolean {
  // Check role-based bypass
  if (
    bypassRules.allowedRoles &&
    context.userRole &&
    bypassRules.allowedRoles.includes(context.userRole)
  ) {
    return true
  }

  // Check IP-based bypass
  if (
    bypassRules.allowedIPRanges &&
    context.ip &&
    bypassRules.allowedIPRanges.some((range) => {
      // Fix: ensure ALL '*' occurrences are removed before matching.
      // Using split/join avoids relying on regex replace semantics and
      // guarantees all '*' characters are removed.
      const normalizedRange = range.split('*').join('')
      return context.ip!.startsWith(normalizedRange)
    })
  ) {
    return true
  }

  // Check endpoint-based bypass
  if (
    bypassRules.allowedEndpoints &&
    context.endpoint &&
    bypassRules.allowedEndpoints.some((pattern) =>
      context.endpoint!.includes(pattern),
    )
  ) {
    return true
  }

  return false
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`
  }
  return `${(ms / 3600000).toFixed(1)}h`
}

/**
 * Generate a unique correlation ID for tracking requests
 */
export function generateCorrelationId(): string {
  return _secureId('corr_')
}

/**
 * Create a standardized threat action
 */
export function createThreatAction(
  actionType: ResponseAction['actionType'],
  target: string,
  metadata?: Record<string, unknown>,
): ResponseAction {
  return {
    actionType,
    target,
    timestamp: new Date().toISOString(),
    metadata: (metadata as Record<string, unknown>) || {},
  }
}
