export const prerender = false
import type { APIRoute } from 'astro'

import { secureRandomHex } from '../../../lib/security'
import {
  CSRF_TOKEN_TTL_SECONDS,
  resolveCsrfStore,
} from '../../../lib/security/csrf-store'

/**
 * CSRF token minting endpoint.
 * GET /api/auth/csrf
 *
 * Issues a fresh CSRF token, stores it under `csrf:<token>` (the key that
 * `csrfProtection` in lib/auth/auth0-middleware.ts validates against), and
 * returns it to the caller. The token is written to the Worker's KV namespace
 * when one is bound and to the existing Redis cache otherwise. The client must
 * echo it back on subsequent state-changing requests via the `X-CSRF-Token`
 * header.
 */
export const GET: APIRoute = async ({ locals }) => {
  const token = secureRandomHex(32)
  const expiresAt = Date.now() + CSRF_TOKEN_TTL_SECONDS * 1000 // 1 hour

  const store = await resolveCsrfStore(locals)
  const stored = await store.store(
    token,
    { token, expiresAt },
    CSRF_TOKEN_TTL_SECONDS,
  )

  if (!stored) {
    return new Response(
      JSON.stringify({ error: 'CSRF token could not be issued' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  return new Response(JSON.stringify({ csrfToken: token, expiresAt }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

// Handle OPTIONS requests for CORS
export const OPTIONS = async ({ request }: { request: Request }) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('origin') ?? '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token',
      'Access-Control-Max-Age': '86400',
    },
  })
}
