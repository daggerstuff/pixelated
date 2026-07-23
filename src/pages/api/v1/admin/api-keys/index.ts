import { developerApiKeyManager } from '@/lib/db/developer-api-keys'
import { logSecurityEvent, SecurityEventType } from '@/lib/security'

import { protectRoute } from '../../../../../lib/auth/serverAuth'

export const prerender = false

/**
 * GET /api/v1/admin/api-keys
 * Returns all API keys (system-wide) + statistics.
 * Admin-only, no-store headers.
 */
export const GET = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(async ({ request }) => {
  try {
    const searchParams = new URL(request.url).searchParams
    const stats = searchParams.get('stats') === 'true'
    const activeOnly = searchParams.get('active') === 'true'
    const userId = searchParams.get('userId') ?? undefined

    if (stats) {
      const apiStats = await developerApiKeyManager.getApiKeyStats()
      return new Response(JSON.stringify({ stats: apiStats }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      })
    }

    const keys = await developerApiKeyManager.listAllApiKeys({
      activeOnly,
      userId,
    })

    return new Response(JSON.stringify({ keys, count: keys.length }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  }
})
