import type { APIRoute } from 'astro'
import { validationRunner } from '../../../../lib/ai/validation/ContinuousValidationRunner'
import { createBuildSafeLogger } from '../../../../../../lib/logging/build-safe-logger'
import { getSession } from '../../../../lib/auth/session'
import { verifySecureToken } from '../../../../lib/security'
import {
  createAuditLog,
  AuditEventType,
  AuditEventStatus,
} from '../../../../lib/audit'

export const GET: APIRoute = async ({ request }) => {
  const logger = createBuildSafeLogger('validation-history')

  try {
    let userId = 'system'
    let authenticatedViaToken = false

    // Try API token authentication first (for GitHub Actions)
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)

      try {
        const tokenPayload = verifySecureToken(token)
        if (
          tokenPayload &&
          tokenPayload.purpose === 'ai-validation' &&
          tokenPayload.scope === 'validation:read'
        ) {
          userId = 'github-actions'
          authenticatedViaToken = true
          logger.info('Authenticated via API token for validation history')
        } else {
          logger.warn('Invalid API token provided for validation history')
        }
      } catch (error) {
        logger.warn('Failed to verify API token:', error)
      }
    }

    // If not authenticated via token, try session authentication
    if (!authenticatedViaToken) {
      const sessionData = await getSession(request)
      if (!sessionData) {
        return new Response(
          JSON.stringify({
            error: 'Unauthorized',
            message: 'You must be authenticated to access this endpoint',
          }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
      }
      userId = sessionData.user?.id || 'system'
    }

    // Parse query parameters for limit
    const url = new URL(request.url)
    const limitParam = url.searchParams.get('limit')
    const limit =
      limitParam !== null && /^\d+$/.test(limitParam)
        ? parseInt(limitParam, 10)
        : 20
    if (limit <= 0 || isNaN(limit)) {
      return new Response(
        JSON.stringify({ error: 'Invalid limit parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Initialize the validation runner if needed
    await validationRunner.initialize()

    // Get history
    const history = await validationRunner.getRunHistory(limit)

    // Create audit log for successful retrieval
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'validation-history-get',
      userId,
      'validation-api',
      {
        userId,
        entriesCount: history.length,
        authMethod: authenticatedViaToken ? 'api-token' : 'session',
      },
      AuditEventStatus.SUCCESS,
    )

    return new Response(
      JSON.stringify({
        success: true,
        history,
        count: history.length,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    )
  } catch (error) {
    // Log the error
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Failed to get validation history: ${errorMessage}`)

    // Create audit log for failed retrieval
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'validation-history-get',
      'system',
      'validation-api',
      {
        error: errorMessage,
      },
      AuditEventStatus.FAILURE,
    )

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: `Failed to get validation history: ${errorMessage}`,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
