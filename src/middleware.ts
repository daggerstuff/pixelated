import { sequence, defineMiddleware } from 'astro:middleware'

/**
 * Edge-compatible CSP nonce generation
 * Uses Web Crypto API instead of Node.js crypto for Edge compatibility
 */
const generateCspNonce = defineMiddleware(async (context, next) => {
  // Generate a random nonce using Web Crypto API (Edge-compatible)
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  const nonce = btoa(String.fromCharCode(...array))

  // Store the nonce in locals
  context.locals.cspNonce = nonce

  return next()
})

/**
 * Security headers middleware (Edge-compatible)
 */
const securityHeaders = defineMiddleware(async (context, next) => {
  const response = await next()

  const nonce = context.locals.cspNonce || ''

  // Add security headers
  const headers = new Headers(response.headers)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-XSS-Protection', '1; mode=block')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // CSP header
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://*.sentry.io`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https://*.sentry.io https://cdn.pixelatedempathy.com https://pixelatedempathy.com",
    "font-src 'self' https://fonts.gstatic.com",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; ')

  headers.set('Content-Security-Policy', csp)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
})

// Single, clean middleware sequence (Edge-compatible)
// Note: Auth checks are handled in API routes (Node.js runtime) for MongoDB compatibility
export const onRequest = sequence(
  generateCspNonce,
  securityHeaders,
)
