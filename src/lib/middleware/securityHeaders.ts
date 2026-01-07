type BaseAPIContext = {
  locals: Record<string, unknown>
}

type MiddlewareNext = () => Promise<Response>

export const securityHeaders = async (
  context: BaseAPIContext,
  next: MiddlewareNext,
) => {
  const response = await next()

  const nonce = context.locals['cspNonce'] as string | undefined

  let csp = [
    // Core restrictions
    "default-src 'self'",
    nonce
      ? `script-src 'self' 'nonce-${nonce}' https://*.sentry.io https://cdn.jsdelivr.net https://giscus.app`
      : "script-src 'self' 'unsafe-inline' https://*.sentry.io https://cdn.jsdelivr.net https://giscus.app",
    // Keep inline styles only if necessary; replace with nonce/hashes when possible
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    // Images from self, data URIs, and specific trusted domains
    "img-src 'self' data: https: https://*.sentry.io https://cdn.pixelatedempathy.com https://pixelatedempathy.com",
    // Fonts from self and Google Fonts
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
    // Disallow legacy plugin content
    "object-src 'none'",
    // Allows embedding Giscus comments
    "frame-src 'self' https://giscus.app",
    // Do not allow this site to be embedded in frames
    "frame-ancestors 'none'",
    // Lock down sensitive sinks
    "base-uri 'self'",
    "form-action 'self'",
    // Network endpoints allowed (XHR/fetch/WebSocket if needed)
    "connect-src 'self' https://*.sentry.io https://pixelatedempathy.com https://cdn.pixelatedempathy.com wss://*.sentry.io https://cdn.jsdelivr.net",
    // Mixed content protections
    'upgrade-insecure-requests',
    'block-all-mixed-content',
    // Additional CSP3 hardening (widely supported)
    "script-src-attr 'none'",
    nonce
      ? `script-src-elem 'self' 'nonce-${nonce}' https://*.sentry.io https://cdn.jsdelivr.net https://giscus.app`
      : "script-src-elem 'self' 'unsafe-inline' https://*.sentry.io https://cdn.jsdelivr.net https://giscus.app",
    "style-src-attr 'unsafe-inline'",
    // Reasonable defaults for less common types
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self'",
  ]

  if (process.env.NODE_ENV === 'development') {
    csp = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
      nonce
        ? `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://cdn.jsdelivr.net https://giscus.app`
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://cdn.jsdelivr.net https://giscus.app",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "style-src-attr 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
      "frame-src 'self' https://giscus.app",
      // Allow ws: and wss: in dev for local websocket debugging
      "connect-src 'self' ws: wss: http://localhost:* https://localhost:*",
    ]
  }

  response.headers.set('Content-Security-Policy', csp.join('; '))
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')

  // Only set HSTS header in production to avoid issues during local development
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    )
  }

  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  )

  return response
}
