import type { BaseAPIContext } from '../auth/apiRouteTypes';

type MiddlewareNext = () => Promise<Response>;

export const securityHeaders = async (context: BaseAPIContext, next: MiddlewareNext) => {
  const response = await next();

  const nonce = context.locals['cspNonce'];

  let csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https: https://*.sentry.io`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "connect-src 'self' https: wss: https://*.sentry.io",
  ];

  if (import.meta.env.DEV) {
    csp = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' https://fonts.gstatic.com",
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
