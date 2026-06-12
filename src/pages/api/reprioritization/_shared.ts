import { randomUUID } from 'node:crypto'

import { getCurrentUser } from '@/lib/auth'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import {
  ProductMemoryGatewayError,
  getProductMemoryGateway,
  type ProductMemoryScope,
} from '@/lib/services/product-memory-gateway'
import { redis } from '@/lib/services/redis'

export const reprioritizationApiLogger = createBuildSafeLogger(
  'reprioritization-api',
)

export async function requireReprioritizationUser(request: Request) {
  return getCurrentUser(request)
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export function jsonError(
  status: number,
  error: string,
  message: string,
): Response {
  return jsonResponse({ error, message }, status)
}

export function parsePagination(url: URL): {
  limit: number
  offset: number
} {
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '10', 10)
  const rawOffset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10)

  return {
    limit:
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 10,
    offset: Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0,
  }
}

export function getGateway() {
  return getProductMemoryGateway()
}

export function getRedis() {
  return redis
}

/** The public product API scopes memory to user+account+workspace only.
 *  Higher-level scope dimensions (orgId, projectId, sessionId, agentId, runId)
 *  are intentionally omitted — they are internal-service concerns not exposed
 *  to external API consumers. */
export function toReprioritizationScope(
  userId: string,
  accountId?: string,
  workspaceId?: string,
): ProductMemoryScope {
  return {
    userId,
    accountId,
    workspaceId,
    includeShared: true,
  }
}

export function assertRequestedUser(
  actualUserId: string,
  requestedUserId: string | null | undefined,
): Response | null {
  if (requestedUserId && requestedUserId !== actualUserId) {
    return jsonError(
      400,
      'Bad Request',
      'userId must match the authenticated user',
    )
  }
  return null
}

type ReprioritizationRouteContext = {
  request: Request
  params?: Record<string, string | undefined>
  cookies?: unknown
}

type AuthenticatedReprioritizationUser = NonNullable<
  Awaited<ReturnType<typeof requireReprioritizationUser>>
>

export function withAuthenticatedReprioritizationRoute<
  TContext extends ReprioritizationRouteContext,
>(
  action: string,
  handler: (
    context: TContext,
    user: AuthenticatedReprioritizationUser,
  ) => Promise<Response>,
) {
  return async (context: TContext): Promise<Response> => {
    const user = await requireReprioritizationUser(context.request)
    if (!user) {
      return jsonError(
        401,
        'Unauthorized',
        'You must be authenticated to access this endpoint',
      )
    }

    try {
      return await handler(context, user)
    } catch (error: unknown) {
      return handleReprioritizationApiError(action, error)
    }
  }
}

export function handleReprioritizationApiError(
  action: string,
  error: unknown,
): Response {
  const correlationId = randomUUID()

  if (error instanceof ProductMemoryGatewayError) {
    reprioritizationApiLogger.error(`Error ${action}:`, {
      correlationId,
      status: error.status,
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    if (error.status === 404) {
      return jsonError(404, 'Not Found', 'Reprioritization report not found')
    }

    if (error.status === 400) {
      return jsonError(400, 'Bad Request', 'Invalid reprioritization request')
    }

    if (error.status === 401 || error.status === 403) {
      return jsonError(
        502,
        'Bad Gateway',
        `Reprioritization service authorization failed (${correlationId})`,
      )
    }

    return jsonError(
      502,
      'Bad Gateway',
      `Reprioritization service request failed (${correlationId})`,
    )
  }

  if (error instanceof Error) {
    reprioritizationApiLogger.error(`Error ${action}:`, {
      correlationId,
      name: error.name,
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    return jsonError(
      500,
      'Internal Server Error',
      `Reprioritization operation failed (${correlationId})`,
    )
  }

  reprioritizationApiLogger.error(`Error ${action}:`, {
    correlationId,
    message: 'Unknown error',
  })
  return jsonError(
    500,
    'Internal Server Error',
    `Unknown reprioritization error (${correlationId})`,
  )
}
