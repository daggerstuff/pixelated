// import type { APIRoute } from 'astro'
import { createBuildSafeLogger } from '../../../lib/logging/build-safe-logger'
import { MemoryService } from '../../../lib/memory'

const logger = createBuildSafeLogger('memory-api')
const memoryService = new MemoryService()

export const GET = async ({ request, cookies }) => {
  try {
    // Authenticate request using cookies
    const sessionCookie = cookies.get('session')
    if (!sessionCookie) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const session = JSON.parse(sessionCookie.value) as unknown
    const userId = session.userId

    // Parse query parameters
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const sortBy = url.searchParams.get('sortBy') || 'createdAt'
    const sortOrder = url.searchParams.get('sortOrder') || 'desc'

    // Get memories for user
    const memories = await memoryService.listMemories(userId, {
      limit,
      offset,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc'
    })

    logger.info('Memories retrieved successfully', {
      userId,
      count: memories.length,
      limit,
      offset
    })

    return new Response(JSON.stringify({
      success: true,
      memories,
      pagination: {
        limit,
        offset,
        total: memories.length
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    logger.error('Memory list error:', {
      message: error instanceof Error ? String(error) : String(error)
    })

    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to retrieve memories'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
