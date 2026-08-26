import { developerApiKeyManager } from '@/lib/db/developer-api-keys'
import { withAuth } from '@/middleware/auth'
import { jsonError, jsonResponse } from '@/pages/api/memory/_shared'

function extractIdFromPath(request: Request): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/').filter(Boolean)
  return segments[segments.length - 2] ?? ''
}

/**
 * GET /api/developer/api-keys/[id]/usage
 * Returns current rate limit window usage for the authenticated user's API key.
 */
export const GET = withAuth(async (request, session) => {
  const id = extractIdFromPath(request)

  if (!id) {
    return jsonError(400, 'Bad Request', 'API key ID is required')
  }

  // Verify ownership
  const apiKey = await developerApiKeyManager.getApiKeyById(id, session.user.id)
  if (!apiKey) {
    return jsonError(404, 'Not Found', 'API key not found')
  }

  try {
    const usage = await developerApiKeyManager.getApiKeyUsage(id)
    return jsonResponse({ usage })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return jsonError(404, 'Not Found', message)
  }
})
