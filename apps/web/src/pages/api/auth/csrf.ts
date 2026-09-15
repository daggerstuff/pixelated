export const prerender = false
import { setInCache } from '../../../lib/redis'
import { secureRandomHex } from '../../../lib/security'

/**
 * CSRF token minting endpoint.
 * GET /api/auth/csrf
 *
 * Issues a fresh CSRF token, stores it in Redis under `csrf:<token>` (the key
 * that `csrfProtection` in lib/auth/auth0-middleware.ts validates against), and
 * returns it to the caller. The client must echo it back on subsequent
 * state-changing requests via the `X-CSRF-Token` header.
 */
export const GET = async () => {
  const token = secureRandomHex(32)
  const expiresAt = Date.now() + 60 * 60 * 1000 // 1 hour

  const stored = await setInCache(`csrf:${token}`, { token, expiresAt }, 3600)

  if (!stored) {
    return new Response(
      JSON.stringify({ error: 'CSRF token could not be issued' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  return new Response(
    JSON.stringify({ csrfToken: token, expiresAt }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    },
  )
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