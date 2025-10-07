import type { AstroCookies } from 'astro'
import { defineMiddleware } from 'astro:middleware'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { generateSecureToken } from '../security'

// Initialize logger
const logger = createBuildSafeLogger('default')

/**
 * CSRF Configuration
 */
export interface CSRFConfig {
  /** Cookie name for storing the CSRF token */
  cookieName: string
  /** Header name for verifying the CSRF token */
  headerName: string
  /** Form field name for CSRF token (for form submissions) */
  formFieldName: string
  /** Cookie path */
  cookiePath: string
  /** Cookie domain */
  cookieDomain?: string
  /** Set secure flag on the cookie (should be true in production) */
  cookieSecure: boolean
  /** Set HttpOnly flag on the cookie (should be false to allow JS access) */
  cookieHttpOnly: false
  /** SameSite cookie policy */
  cookieSameSite: 'lax' | 'strict' | 'none'
  /** Cookie max age in seconds */
  cookieMaxAge: number
  /** Paths to exclude from CSRF protection */
  excludePaths: string[]
  /** Methods that don't require CSRF protection (safe methods) */
  safeMethods: string[]
  /** Enable enhanced security via referer checking */
  enableRefererCheck: boolean
  /** Trusted origins for referer checking */
  trustedOrigins: string[]
}

/**
 * Default CSRF configuration
 */
export const defaultCSRFConfig: CSRFConfig = {
  cookieName: '__Host-csrf_token',
  headerName: 'X-CSRF-Token',
  formFieldName: 'csrf_token',
  cookiePath: '/',
  cookieSecure: true,
  cookieHttpOnly: false,
  cookieSameSite: 'lax',
  cookieMaxAge: 86400, // 24 hours
  excludePaths: ['/api/health', '/api/webhook'],
  safeMethods: ['GET', 'HEAD', 'OPTIONS', 'TRACE'],
  enableRefererCheck: true,
  trustedOrigins: [],
}

/**
 * Generate a new CSRF token
 */
function generateCSRFToken(): string {
  return generateSecureToken(32)
}

/**
 * Set a CSRF token cookie
 */
function setCSRFCookie(
  cookies: AstroCookies,
  token: string,
  config: CSRFConfig,
): void {
  cookies.set(config.cookieName, token, {
    path: config.cookiePath,
    domain: config.cookieDomain,
    secure: config.cookieSecure,
    httpOnly: config.cookieHttpOnly,
    sameSite: config.cookieSameSite,
    maxAge: config.cookieMaxAge,
  })
}

/**
 * Check if the path should be excluded from CSRF protection
 */
function isExcludedPath(path: string, excludePaths: string[]): boolean {
  return excludePaths.some((excludePath) => {
    if (excludePath.endsWith('*')) {
      const prefix = excludePath.slice(0, -1)
      return path.startsWith(prefix)
    }
    return path === excludePath
  })
}

/**
 * Check if the referer is valid
 */
function isValidReferer(
  referer: string | null,
  request: Request,
  trustedOrigins: string[],
): boolean {
  if (!referer) {
    return false
  }

  const refererUrl = new URL(referer)
  const requestUrl = new URL(request.url)

  // Check if same origin
  if (refererUrl.origin === requestUrl.origin) {
    return true
  }

  // Check if in trusted origins
  return trustedOrigins.some((origin) => {
    if (origin.includes('*')) {
      const pattern = new RegExp(
        `^${origin.replace(/\./g, '\\.').replace(/\*/g, '.*')}$`,
      )
      return pattern.test(refererUrl.origin)
    }
    return refererUrl.origin === origin
  })
}

/**
 * CSRF middleware implementation using Double Submit Cookie Pattern
 */
export const csrfMiddleware = defineMiddleware(
  async ({ request, cookies }, next) => {
    // Use default configuration
    const config = defaultCSRFConfig

    // Get the path from the URL
    const url = new URL(request.url)
    const path = url.pathname

    // Skip CSRF check for excluded paths
    if (isExcludedPath(path, config.excludePaths)) {
      return next()
    }

    // Skip CSRF check for safe methods
    if (config.safeMethods.includes(request.method.toUpperCase())) {
      // For safe methods, ensure the token exists in the cookie
      let csrfToken = cookies.get(config.cookieName)?.value

      // If no token exists, generate one
      if (!csrfToken) {
        csrfToken = generateCSRFToken()
        setCSRFCookie(cookies, csrfToken, config)
      }

      return next()
    }

    // For unsafe methods (POST, PUT, DELETE, etc.), validate the token
    const csrfToken = cookies.get(config.cookieName)?.value

    if (!csrfToken) {
      logger.warn('CSRF token missing from cookie', {
        path,
        method: request.method,
      })
      return new Response(
        JSON.stringify({
          error: 'CSRF token missing',
          message: 'Missing CSRF token cookie',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get token from header or form data
    let requestToken: string | null = null

    // Try to get token from header
    requestToken = request.headers.get(config.headerName)

    // If not in header, try to get from form data for POST requests
    if (!requestToken && request.method === 'POST') {
      // Clone the request to avoid consuming the body
      const clonedRequest = request.clone()

      // Check content type to determine how to parse the body
      const contentType = request.headers.get('Content-Type') || ''

      if (contentType.includes('application/x-www-form-urlencoded')) {
        try {
          const formData = await clonedRequest.formData()
          requestToken = formData.get(config.formFieldName) as string
        } catch (error: unknown) {
          logger.error('Error parsing form data for CSRF check', error)
        }
      } else if (contentType.includes('application/json')) {
        try {
          const body = await clonedRequest.json()
          requestToken = body[config.formFieldName]
        } catch (error: unknown) {
          logger.error('Error parsing JSON body for CSRF check', error)
        }
      }
    }

    // If no token found in request, rejec
    if (!requestToken) {
      logger.warn('CSRF token missing from request', {
        path,
        method: request.method,
      })
      return new Response(
        JSON.stringify({
          error: 'CSRF validation failed',
          message: 'Missing CSRF token in request',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Validate token
    if (requestToken !== csrfToken) {
      logger.warn('CSRF token mismatch', {
        path,
        method: request.method,
      })
      return new Response(
        JSON.stringify({
          error: 'CSRF validation failed',
          message: 'Invalid CSRF token',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Check referer for HTTPS requests if enabled
    if (
      config.enableRefererCheck &&
      url.protocol === 'https:' &&
      request.method !== 'GET' &&
      request.method !== 'HEAD'
    ) {
      const referer = request.headers.get('Referer')
      if (!isValidReferer(referer, request, config.trustedOrigins)) {
        logger.warn('CSRF referer check failed', {
          path,
          method: request.method,
          referer,
        })
        return new Response(
          JSON.stringify({
            error: 'CSRF validation failed',
            message: 'Invalid or missing referer',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }
    }

    // CSRF validation passed, continue to the next middleware
    return next()
  },
)

// Export default for convenience
export default csrfMiddleware
