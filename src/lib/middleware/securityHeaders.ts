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
    "object-src 'none'",
    // Do not allow this site to be embedded in frames
    "frame-ancestors 'none'",
    // Lock down sensitive sinks
    "base-uri 'self'",
    "form-action 'self'",
    // Network endpoints allowed (XHR/fetch/WebSocket if needed)
    "connect-src 'self' https://*.sentry.io https://pixelatedempathy.com https://cdn.pixelatedempathy.com wss://*.sentry.io https://cdn.jsdelivr.net",
    // Mixed content protections
    "block-all-mixed-content",
    // Additional CSP3 hardening (widely supported)
    "script-src-attr 'none'",
    "style-src-attr 'unsafe-inline'",
  ]

  // Conditionally add upgrade-insecure-requests
  // This can cause loops with Cloudflare Flexible SSL if the browser forces HTTPS and the proxy only speaks HTTP
  if (process.env.DISABLE_HSTS !== 'true') {
    csp.push('upgrade-insecure-requests')
  }

  if (process.env.NODE_ENV === 'development') {
    // In development, we need 'unsafe-inline' and 'unsafe-eval' for Vite/Astro to work.
    csp = [
      ...csp.filter((rule) => !rule.startsWith('default-src') && !rule.startsWith('connect-src')),
      "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src *", // Allow any connection in dev
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://cdn.jsdelivr.net https://giscus.app",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    ]
  } else {
    // Production CSP
    csp.push(
      nonce
        ? `script-src-elem 'self' 'nonce-${nonce}' https://*.sentry.io https://cdn.jsdelivr.net https://giscus.app`
        : "script-src-elem 'self' 'unsafe-inline' https://*.sentry.io https://cdn.jsdelivr.net https://giscus.app",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "frame-src 'self' https://giscus.app",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "media-src 'self'",
    )
  }

  response.headers.set('Content-Security-Policy', csp.join('; '))
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')

  // Only set HSTS header in production and if not explicitly disabled
  // disabling HSTS is necessary to avoid loops during development or when using proxies like Cloudflare Flexible SSL
  if (process.env.NODE_ENV === 'production' && process.env.DISABLE_HSTS !== 'true') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  )

  return response
}
