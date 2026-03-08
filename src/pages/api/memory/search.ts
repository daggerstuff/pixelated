import type { AuthenticatedRequest } from '@/lib/auth/auth0-middleware'
import { createBuildSafeLogger } from '../../../lib/logging/build-safe-logger'
import { MemoryService } from '../../../lib/memory'

const logger = createBuildSafeLogger('memory-api')
const memoryService = new MemoryService()

export const GET = async ({ request }: { request: AuthenticatedRequest }) => {
  try {
    // Authentication is handled by middleware, so we can safely access user data
    // The user object is attached to the request by the middleware
    const user = request.user

    if (!user) {
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

    // Parse query parameters
    const url = new URL(request.url)
    const query = url.searchParams.get('q')
    let limit = parseInt(url.searchParams.get('limit') || '50', 10)
    let offset = parseInt(url.searchParams.get('offset') || '0', 10)

    if (!query) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'Search query parameter (q) is required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Validate limit and offset
    if (isNaN(limit) || limit < 1 || limit > 100) {
      limit = 50
    }
    if (isNaN(offset) || offset < 0) {
      offset = 0
    }

    // Search memories
    const result = await memoryService.searchMemories(user.id, query, {
      limit,
      offset,
    })

    return new Response(JSON.stringify({
      success: true,
      memories: result,
      query,
      pagination: {
        limit,
        offset,
        total: result.length
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error: unknown) {
    logger.error('Error searching memories:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? String(error) : 'Unknown error',
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
