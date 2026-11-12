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

/**
 * The `code` an identity-provider outage carries out of first-login
 * provisioning.
 *
 * Callers detect the condition by this code rather than by `instanceof`: the
 * error crosses a dynamic `import()`, and a test that mocks the module without
 * the class must still be able to exercise the mapping.
 */
export const IDENTITY_PROVIDER_UNAVAILABLE_CODE =
  'IDENTITY_PROVIDER_UNAVAILABLE'

/** True when `error` is an identity-provider outage from provisioning. */
export function isIdentityProviderUnavailable(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === IDENTITY_PROVIDER_UNAVAILABLE_CODE
  )
}

/**
 * True when a failure from the identity provider is worth retrying.
 *
 * The provider service answers `null` for a lookup it could not complete, so
 * the provisioning path asks for the error instead and classifies it here: a
 * throttled or erroring Management API, a network failure, or a lookup that
 * ran out its deadline is an outage. A missing client or a malformed request is
 * a configuration failure and must not become a retryable 503.
 */
export function isTransientIdentityProviderFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as {
    name?: unknown
    statusCode?: unknown
    code?: unknown
  }
  if (candidate.name === 'DeadlineExceededError') return true

  if (typeof candidate.statusCode === 'number') {
    return candidate.statusCode === 429 || candidate.statusCode >= 500
  }

  return (
    typeof candidate.code === 'string' &&
    [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'EAI_AGAIN',
      'ENOTFOUND',
    ].includes(candidate.code)
  )
}
