import { defineMiddleware } from 'astro:middleware'
import { v4 as uuidv4 } from 'uuid'
import { createResourceAuditLog } from '../audit'
import { getSession } from '../auth/session'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

// Initialize logger
const logger = createBuildSafeLogger('default')

/**
 * Security event types for audit logging
 */
export enum SecurityEventType {
  ACCESS_ATTEMPT = 'access_attempt',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CSRF_VIOLATION = 'csrf_violation',
  XSS_ATTEMPT = 'xss_attempt',
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  PERMISSION_DENIED = 'permission_denied',
  SENSITIVE_ACTION = 'sensitive_action',
  API_ACCESS = 'api_access',
  CONFIG_CHANGE = 'config_change',
  SECURITY_HEADER_VIOLATION = 'security_header_violation',
}

/**
 * Configuration for security audit logging
 */
export interface SecurityAuditConfig {
  /** Enable audit logging */
  enabled: boolean
  /** Log all requests or only security events */
  logAllRequests: boolean
  /** Paths to always log regardless of logAllRequests setting */
  sensitivePathPatterns: string[]
  /** Log request bodies for sensitive actions (may contain sensitive data) */
  logRequestBodies: boolean
  /** Maximum length for logged request bodies */
  maxBodyLength: number
  /** Log response status codes */
  logResponseStatus: boolean
  /** Log response timing information */
  logResponseTiming: boolean
  /** Skip logging for the following patterns */
  excludePaths: string[]
}

/**
 * Default security audit configuration
 */
export const defaultSecurityAuditConfig: SecurityAuditConfig = {
  enabled: true,
  logAllRequests: false,
  sensitivePathPatterns: [
    '/api/auth/',
    '/api/ai/',
    '/api/admin/',
    '/api/security/',
    '/admin/',
  ],
  logRequestBodies: false,
  maxBodyLength: 1024,
  logResponseStatus: true,
  logResponseTiming: true,
  excludePaths: ['/api/health', '/static/', '/assets/', '/favicon.ico'],
}

/**
 * Check if a path matches any of the patterns
 */
function pathMatchesPatterns(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      return path.startsWith(prefix)
    }
    return path === pattern
  })
}

/**
 * Get a truncated and sanitized version of the request body
 */
async function getSafeRequestBody(
  request: Request,
  maxLength: number,
): Promise<string | null> {
  try {
    // Only process specific content types to avoid binary data
    const contentType = request.headers.get('Content-Type') || ''
    if (
      !contentType.includes('application/json') &&
      !contentType.includes('application/x-www-form-urlencoded') &&
      !contentType.includes('text/plain')
    ) {
      return null
    }

    // Clone the request to avoid consuming the body
    const clonedRequest = request.clone()

    let body: string

    if (contentType.includes('application/json')) {
      // Parse as JSON
      const jsonData = await clonedRequest.json()
      body = JSON.stringify(jsonData)
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // Parse as form data
      const formData = await clonedRequest.formData()
      const formObj: Record<string, string> = {}

      // Use a more TypeScript-friendly approach
      formData.forEach((value, key) => {
        formObj[key] = value.toString()
      })

      body = JSON.stringify(formObj)
    } else {
      // Get as text
      body = await clonedRequest.text()
    }

    // Truncate if too long
    if (body.length > maxLength) {
      body = `${body.substring(0, maxLength)}...[truncated]`
    }

    return body
  } catch {
    logger.warn('Failed to capture request body for audit log')
    return null
  }
}

/**
 * Determine the security event type based on request and response
 */
function determineSecurityEventType(
  path: string,
  method: string,
  statusCode: number,
): SecurityEventType {
  // Authentication paths
  if (path.includes('/api/auth/')) {
    if (statusCode >= 200 && statusCode < 300) {
      return SecurityEventType.AUTH_SUCCESS
    } else if (statusCode >= 400) {
      return SecurityEventType.AUTH_FAILURE
    }
  }

  // Rate limit exceeded
  if (statusCode === 429) {
    return SecurityEventType.RATE_LIMIT_EXCEEDED
  }

  // CSRF violations
  if (
    statusCode === 403 &&
    (method === 'POST' ||
      method === 'PUT' ||
      method === 'DELETE' ||
      method === 'PATCH')
  ) {
    return SecurityEventType.CSRF_VIOLATION
  }

  // Permission denied
  if (statusCode === 401 || statusCode === 403) {
    return SecurityEventType.PERMISSION_DENIED
  }

  // API access
  if (path.startsWith('/api/')) {
    return SecurityEventType.API_ACCESS
  }

  // Sensitive actions (admin, security settings)
  if (
    path.includes('/admin/') ||
    path.includes('/api/admin/') ||
    path.includes('/api/security/')
  ) {
    return SecurityEventType.SENSITIVE_ACTION
  }

  // Default for other access
  return SecurityEventType.ACCESS_ATTEMPT
}

/**
 * Security audit logging middleware
 * Records security-relevant events for audit and compliance
 */
export const auditLoggingMiddleware = defineMiddleware(
  async ({ request }, next) => {
    const config = defaultSecurityAuditConfig

    // Check if audit logging is enabled
    if (!config.enabled) {
      return next()
    }

    const requestId = request.headers.get('x-request-id') || uuidv4()
    const startTime = performance.now()
    const url = new URL(request.url)
    const path = url.pathname
    const { method } = request

    // Skip excluded paths
    if (pathMatchesPatterns(path, config.excludePaths)) {
      return next()
    }

    // Get user info if available
    let userId = 'anonymous'
    let userRole = 'anonymous'

    try {
      const session = await getSession(request)
      if (session?.user?.id) {
        userId = session.user.id
        userRole = session.user.role || 'user'
      }
    } catch {
      // Session errors are not fatal for logging
    }

    // Determine if we should log this request
    const isSensitivePath = pathMatchesPatterns(
      path,
      config.sensitivePathPatterns,
    )
    const shouldLog = config.logAllRequests || isSensitivePath

    if (!shouldLog) {
      return next()
    }

    // Get request metadata
    const metadata: Record<string, unknown> = {
      requestId,
      method,
      path,
      query: Object.fromEntries(url.searchParams),
      headers: {} as Record<string, string>,
      userAgent: request.headers.get('user-agent') || 'unknown',
      referer: request.headers.get('referer') || 'direct',
      ipAddress:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('cf-connecting-ip') ||
        'unknown',
    }

    // Add important headers (but exclude sensitive ones like authorization)
    const headersToLog = [
      'content-type',
      'origin',
      'x-forwarded-for',
      'x-real-ip',
      'cf-connecting-ip',
      'cf-ipcountry',
      'accept-language',
    ]
    headersToLog.forEach((header) => {
      const value = request.headers.get(header)
      if (value) {
        ;(metadata['headers'] as Record<string, string>)[header] = value
      }
    })

    // Log request body for sensitive actions if enabled
    if (config.logRequestBodies && (isSensitivePath || method !== 'GET')) {
      const body = await getSafeRequestBody(request, config.maxBodyLength)
      if (body) {
        metadata['requestBody'] = body
      }
    }

    // Process the request
    const response = await next()

    // Calculate response time
    const endTime = performance.now()
    const duration = endTime - startTime

    // Add response metadata
    if (config.logResponseStatus && response) {
      metadata['responseStatus'] = response.status
      metadata['responseStatusText'] = response.statusText
    }

    if (response && config.logResponseTiming) {
      metadata['duration'] = Math.round(duration)
      metadata['durationUnit'] = 'ms'
    }

    // Determine the security event type
    const eventType = determineSecurityEventType(
      path,
      method,
      response?.status || 200,
    )

    // Create an audit log
    try {
      await createResourceAuditLog(
        eventType as unknown as any,
        userId,
        {
          id: path,
          type: 'security',
        },
        {
          ...metadata,
          userRole,
          eventType,
        },
      )
    } catch {
      // Log error but don't break the response flow
      logger.error('Failed to create security audit log')
    }

    return response
  },
)

// Export default for convenience
export default auditLoggingMiddleware
