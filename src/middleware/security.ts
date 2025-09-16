import type { APIRoute } from 'astro'

// Security headers configuration
const SECURITY_HEADERS = {
  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Enable XSS filtering
  'X-XSS-Protection': '1; mode=block',

  // Referrer policy for privacy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Content Security Policy
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
    "upgrade-insecure-requests"
  ].join('; '),

  // HTTP Strict Transport Security
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Permissions policy for modern browsers
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'payment=()',
    'usb=()'
  ].join(', '),

  // Cross-Origin policies
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',

  // Remove server information
  'Server': undefined,
  'X-Powered-By': undefined,

  // Security for downloads
  'X-Download-Options': 'noopen',

  // IE security
  'X-DNS-Prefetch-Control': 'off'
}

// Rate limiting configuration
const RATE_LIMITS = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000, // limit each IP to 1000 requests per windowMs
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  keyGenerator: (req: Request) => {
    // Use X-Forwarded-For header for real IP behind load balancer
    const forwarded = req.headers.get('x-forwarded-for')
    const realIP = req.headers.get('x-real-ip')
    const clientIP = req.headers.get('cf-connecting-ip') // Cloudflare

    return forwarded?.split(',')[0]?.trim() ||
           realIP ||
           clientIP ||
           'unknown'
  }
}

// Request size limits
const REQUEST_LIMITS = {
  json: '10mb',
  urlencoded: '10mb',
  text: '10mb',
  raw: '10mb'
}

// CORS configuration
const CORS_CONFIG = {
  origin: (origin: string | null) => {
    const allowedOrigins = [
      'https://pixelated.com',
      'https://app.pixelated.com',
      'https://dashboard.pixelated.com',
      /^https:\/\/.*\.pixelated\.com$/
    ]

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return true

    return allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin
      }
      return allowed.test(origin)
    })
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  maxAge: 86400 // 24 hours
}

// Input validation and sanitization
export class InputValidator {
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') return ''

    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim()
      .slice(0, 10000) // Limit length
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && email.length <= 254
  }

  static validatePassword(password: string): { valid: boolean; errors: string[] } {
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

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  static validateBiasScore(score: number): boolean {
    return typeof score === 'number' &&
           !isNaN(score) &&
           score >= 0 &&
           score <= 1
  }

  static validateSessionId(sessionId: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(sessionId)
  }
}

// Rate limiting implementation
class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>()

  checkLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const windowMs = RATE_LIMITS.windowMs
    const maxRequests = RATE_LIMITS.maxRequests

    const existing = this.requests.get(identifier)

    if (!existing || now > existing.resetTime) {
      // First request or window expired
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      })
      return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs }
    }

    if (existing.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetTime: existing.resetTime }
    }

    existing.count++
    return {
      allowed: true,
      remaining: maxRequests - existing.count,
      resetTime: existing.resetTime
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

// Cleanup expired rate limit entries every 5 minutes
setInterval(() => {
  rateLimiter.cleanup()
}, 5 * 60 * 1000)

// Security middleware function
export async function securityMiddleware(
  request: Request,
  context: any
): Promise<Response | null> {
  const url = new URL(request.url)
  const method = request.method

  // Rate limiting
  const clientIP = RATE_LIMITS.keyGenerator(request)
  const rateLimitResult = rateLimiter.checkLimit(clientIP)

  if (!rateLimitResult.allowed) {
    return new Response(JSON.stringify({
      error: 'Too many requests',
      retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
        'X-Rate-Limit-Remaining': rateLimitResult.remaining.toString(),
        'X-Rate-Limit-Reset': rateLimitResult.resetTime.toString()
      }
    })
  }

  // Add security headers to response
  const responseHeaders = new Headers()

  // Apply security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    if (value !== undefined) {
      responseHeaders.set(key, value)
    }
  })

  // Add rate limiting headers
  responseHeaders.set('X-Rate-Limit-Remaining', rateLimitResult.remaining.toString())
  responseHeaders.set('X-Rate-Limit-Reset', rateLimitResult.resetTime.toString())
  responseHeaders.set('X-Rate-Limit-Limit', RATE_LIMITS.maxRequests.toString())

  // Store headers in context for use in route handlers
  context.securityHeaders = responseHeaders

  // Continue to next middleware/route handler
  return null
}

// Utility function to apply security headers to any response
export function applySecurityHeaders(response: Response, additionalHeaders?: Record<string, string>): Response {
  const headers = new Headers(response.headers)

  // Apply security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    if (value !== undefined) {
      headers.set(key, value)
    }
  })

  // Apply additional headers if provided
  if (additionalHeaders) {
    Object.entries(additionalHeaders).forEach(([key, value]) => {
      headers.set(key, value)
    })
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

// HIPAA compliance utilities
export class HIPAACompliance {
  static validatePHIContent(content: string): { compliant: boolean; issues: string[] } {
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
      issues
    }
  }

  static sanitizeForAudit(content: string): string {
    // Remove or mask sensitive information for audit logs
    return content
      .replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN_MASKED]')
      .replace(/\b\d{3}-?\d{3}-?\d{4}\b/g, '[PHONE_MASKED]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_MASKED]')
      .replace(/\b\d+\s+[A-Za-z0-9\s,.-]+\b/g, '[ADDRESS_MASKED]')
  }

  static generateAuditLog(action: string, userId: string, resource: string, details: any): any {
    return {
      timestamp: new Date().toISOString(),
      action,
      userId,
      resource,
      details: this.sanitizeForAudit(JSON.stringify(details)),
      ipAddress: 'masked', // Would be populated by middleware
      userAgent: 'masked', // Would be populated by middleware
      sessionId: 'masked'  // Would be populated by middleware
    }
  }
}

// Export security utilities
export {
  SECURITY_HEADERS,
  RATE_LIMITS,
  REQUEST_LIMITS,
  CORS_CONFIG
}
