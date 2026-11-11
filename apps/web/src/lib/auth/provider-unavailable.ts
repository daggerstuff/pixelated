/**
 * The one response shape for "the authentication provider could not answer".
 *
 * A `/userinfo` 429, a 5xx, a deadline, or a network failure means the token
 * could not be checked — not that it is invalid. Every route class answers that
 * condition the same way: a retryable `503` carrying `Retry-After`. It must
 * never be a `401` and must never leave the request unauthenticated, because a
 * client renders both as a sign-out (diagnosis D1, GAP-34).
 *
 * Shared by the middleware's cookie-session resolution (page routes) and by
 * `authenticateRequest` (the `routeAuthConfig` routes), so the two halves of
 * the same condition cannot drift into different status contracts.
 */

/** Fallback `Retry-After` when the provider sent no usable value. */
export const PROVIDER_RETRY_AFTER_DEFAULT_SECONDS = 30

/**
 * Build the retryable response for a provider outage.
 *
 * API callers get JSON; page routes get a short plain-text body. Both carry
 * `Retry-After` and `Cache-Control: no-store`.
 */
export function providerUnavailableResponse(
  pathname: string,
  retryAfterSeconds: number = PROVIDER_RETRY_AFTER_DEFAULT_SECONDS,
): Response {
  const retryAfter = String(Math.max(1, Math.ceil(retryAfterSeconds)))
  if (pathname.startsWith('/api/')) {
    return new Response(
      JSON.stringify({
        error: 'Authentication provider temporarily unavailable',
        retryAfterSeconds: Number(retryAfter),
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter,
          'Cache-Control': 'no-store',
        },
      },
    )
  }
  return new Response(
    'Authentication is temporarily unavailable. Please retry shortly.\n',
    {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Retry-After': retryAfter,
        'Cache-Control': 'no-store',
      },
    },
  )
}
