import type { BaseAPIContext } from '../auth/apiRouteTypes';

type MiddlewareNext = () => Promise<Response>;

export const securityHeaders = async (context: BaseAPIContext, next: MiddlewareNext) => {
  const response = await next();

  const nonce = context.locals['cspNonce'];

  let csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://*.sentry.io`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Restrict img-src to self, data, and any trusted image domains (add more as needed)
    "img-src 'self' data: https://*.sentry.io", // Restrict img-src to self, data, and trusted image domains (add more as needed)
    "font-src 'self' https://fonts.gstatic.com",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    // Restrict connect-src to self and trusted websocket/XHR endpoints (add more as needed)
    "connect-src 'self' https://*.sentry.io",
  ];

  if (import.meta.env.DEV) {
    csp = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' https://fonts.gstatic.com",
      // Allow ws: and wss: in dev for local websocket debugging
      "connect-src 'self' ws: wss:",
    ];
  }

  response.headers.set('Content-Security-Policy', csp.join('; '));
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');

  // Only set HSTS header in production to avoid issues during local development
  if (import.meta.env.PROD) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  return response;
};
