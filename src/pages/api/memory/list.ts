// import type { APIRoute } from 'astro' // Removed due to missing export
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { getCurrentUser } from '@/lib/auth'
import { MemoryService } from '@/lib/memory'

const logger = createBuildSafeLogger('memory-api')
const memoryService = new MemoryService()

export const GET = async ({ request }: { request: Request }) => {
  try {
    // Authenticate request
    // Extract cookies from the request
    const cookieHeader = request.headers.get('cookie') || ''
    const cookies = {
      get: (name: string) => {
        const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`))
        return match ? { value: match[1] } : undefined
      },
    }
  // Type for Astro APIContext cookies
  type AstroCookies = { get: (name: string) => { value: string } | undefined }
  const user = await getCurrentUser(cookies as AstroCookies)
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
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const offset = parseInt(url.searchParams.get('offset') || '0', 10)

    // Only allow valid sortBy fields
    const allowedSortBy = ['id', 'userId', 'content', 'createdAt']
    const sortByParam = url.searchParams.get('sortBy') || 'createdAt'
    const sortBy = allowedSortBy.includes(sortByParam) ? sortByParam : 'createdAt'

    // Only allow 'asc' or 'desc' for sortOrder
    const sortOrderParam = url.searchParams.get('sortOrder') || 'desc'
    const sortOrder = sortOrderParam === 'asc' ? 'asc' : 'desc'

    // List memories
    const result = await memoryService.listMemories(
      user.id,
      {
        limit,
        offset,
  sortBy: sortBy as keyof import('@/lib/memory').Memory,
        sortOrder,
      },
    )

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    logger.error('Error listing memories:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
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
