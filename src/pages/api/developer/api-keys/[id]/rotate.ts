import { z } from 'zod'

import { developerApiKeyManager } from '@/lib/db/developer-api-keys'
import { logSecurityEvent, SecurityEventType } from '@/lib/security'
import { withAuth } from '@/middleware/auth'
import { jsonError, jsonResponse } from '@/pages/api/memory/_shared'

const RotateApiKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  expires_in_days: z.number().int().min(1).max(365).optional(),
})

function extractIdFromPath(request: Request): string {
  const url = new URL(request.url)
  const segments = url.pathname.split('/').filter(Boolean)
  // /api/developer/api-keys/[id]/rotate → segments = ["api", "developer", "api-keys", id, "rotate"]
  return segments[segments.length - 2] ?? ''
}

/**
 * POST /api/developer/api-keys/[id]/rotate
 * Rotates an API key: deactivates the old key and creates a new one atomically.
 * Returns the new plaintext key (shown once).
 */
export const POST = withAuth(async (request, session) => {
  const id = extractIdFromPath(request)

  if (!id) {
    return jsonError(400, 'Bad Request', 'API key ID is required')
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    // Body is optional for rotation
  }

  const parseResult = RotateApiKeySchema.safeParse(body)
  if (!parseResult.success) {
    return jsonError(400, 'Bad Request', parseResult?.error.issues[0].message)
  }

  try {
    const result = await developerApiKeyManager.rotateApiKey(
      id,
      session.user.id,
      parseResult.data,
    )

    logSecurityEvent(
      SecurityEventType.AUTHENTICATION_SUCCESS,
      session.user.id,
      {
        action: 'api_key_rotated',
        old_key_id: id,
        new_key_id: result.api_key.id,
        key_prefix: result.api_key.key_prefix,
      },
    )

    return jsonResponse({
      api_key: result.api_key,
      plain_key: result.plain_key,
      message:
        'API key rotated. Store the plain_key securely. It will not be shown again.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return jsonError(404, 'Not Found', message)
  }
})
