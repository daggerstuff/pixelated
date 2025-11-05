const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',

  'X-Content-Type-Options': 'nosniff',

  'X-XSS-Protection': '1; mode=block',

  'Referrer-Policy': 'strict-origin-when-cross-origin',

  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.pixelated.com wss://api.pixelated.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; '),

  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'payment=()',
    'usb=()',
  ].join(', '),

  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',

  'Server': undefined,
  'X-Powered-By': undefined,

  'X-Download-Options': 'noopen',

  'X-DNS-Prefetch-Control': 'off',
}

export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') {
    return ''
  }

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .slice(0, 10000) // Limit length
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

export function validatePassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function validateBiasScore(score: number): boolean {
  return typeof score === 'number' && !isNaN(score) && score >= 0 && score <= 1
}

export function validateSessionId(sessionId: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(sessionId)
}

export const InputValidator = {
  sanitizeString,
  validateEmail,
  validatePassword,
  validateBiasScore,
  validateSessionId,
}

export const RATE_LIMITS = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // limit each IP to 100 requests per windowMs
  keyGenerator: (request: Request): string => {
    // Use x-forwarded-for header, or fallback to a default for local dev
    return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1'
  },
};

class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>()

  checkLimit(identifier: string): {
    allowed: boolean
    remaining: number
    resetTime: number
  } {
    const now = Date.now()
    const { windowMs, maxRequests } = RATE_LIMITS

    const existing = this.requests.get(identifier)

    if (!existing || now > existing.resetTime) {
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
      })
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: now + windowMs,
      }
    }

    if (existing.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetTime: existing.resetTime }
    }

    existing.count++
    return {
      allowed: true,
      remaining: maxRequests - existing.count,
      resetTime: existing.resetTime,
    }
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, value] of this.requests.entries()) {
      if (now > value.resetTime) {
        this.requests.delete(key)
      }
    }
  }
}

const rateLimiter = new RateLimiter()

setInterval(
  () => {
    rateLimiter.cleanup()
  },
  5 * 60 * 1000,
)

export async function securityMiddleware(
  request: Request,
  context: Record<string, unknown>,
): Promise<Response | null> {
  const clientIP = RATE_LIMITS.keyGenerator(request)
  const rateLimitResult = rateLimiter.checkLimit(clientIP)

  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil(
            (rateLimitResult.resetTime - Date.now()) / 1000,
          ).toString(),
          'X-Rate-Limit-Remaining': rateLimitResult.remaining.toString(),
          'X-Rate-Limit-Reset': rateLimitResult.resetTime.toString(),
        },
      },
    )
  }

  const responseHeaders = new Headers()

  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    if (value !== undefined) {
      responseHeaders.set(key, value)
    }
  })

  responseHeaders.set(
    'X-Rate-Limit-Remaining',
    rateLimitResult.remaining.toString(),
  )
  responseHeaders.set(
    'X-Rate-Limit-Reset',
    rateLimitResult.resetTime.toString(),
  )
  responseHeaders.set('X-Rate-Limit-Limit', RATE_LIMITS.maxRequests.toString())
  ;(context as Record<string, unknown>)['securityHeaders'] = responseHeaders

  return null
}

export function applySecurityHeaders(
  response: Response,
  additionalHeaders?: Record<string, string>,
): Response {
  const headers = new Headers(response.headers)

  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    if (value !== undefined) {
      headers.set(key, value)
    }
  })

  if (additionalHeaders) {
    Object.entries(additionalHeaders).forEach(([key, value]) => {
      headers.set(key, value)
    })
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export function validatePHIContent(content: string): {
  compliant: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check for sensitive information patterns
  const ssnPattern = /\b\d{3}-?\d{2}-?\d{4}\b/g
  const phonePattern = /\b\d{3}-?\d{3}-?\d{4}\b/g
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
  const addressPattern = /\b\d+\s+[A-Za-z0-9\s,.-]+\b/g

  if (ssnPattern.test(content)) {
    issues.push('Content contains Social Security Numbers')
  }

  if (phonePattern.test(content)) {
    issues.push('Content contains phone numbers')
  }

  if (emailPattern.test(content)) {
    issues.push('Content contains email addresses')
  }

  if (addressPattern.test(content)) {
    issues.push('Content may contain physical addresses')
  }

  return {
    compliant: issues.length === 0,
    issues,
  }
}

export function sanitizeForAudit(content: string): string {
  return content
    .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN_MASKED]')
    .replace(/\b\d{3}-?\d{3}-?\d{4}\b/g, '[PHONE_MASKED]')
    .replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      '[EMAIL_MASKED]',
    )
    .replace(/\b\d+\s+[A-Za-z0-9\s,.-]+\b/g, '[ADDRESS_MASKED]')
}

export function generateAuditLog(
  action: string,
  userId: string,
  resource: string,
  details: unknown,
): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    action,
    userId,
    resource,
    details: sanitizeForAudit(JSON.stringify(details)),
    ipAddress: 'masked', // Would be populated by middleware
    userAgent: 'masked', // Would be populated by middleware
    sessionId: 'masked', // Would be populated by middleware
  }
}

export const HIPAACompliance = {
  validatePHIContent,
  sanitizeForAudit,
  generateAuditLog,
}

export { SECURITY_HEADERS, RATE_LIMITS }
