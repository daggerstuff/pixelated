import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { isAuthenticated } from '@/lib/auth'
import { MemoryService } from '@/lib/memory'

const logger = createBuildSafeLogger('memory-api')
const memoryService = new MemoryService()

export const DELETE = async ({ request }: { request: Request }) => {
  try {
    // Authenticate request
    const authResult = await isAuthenticated(request)
    if (!authResult?.authenticated) {
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

    // Parse request body
    const body = await request.json()
    const { memoryId } = body

    if (!memoryId) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'memoryId parameter is required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Delete memory
    await memoryService.deleteMemory(memoryId, authResult.user?.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Memory deleted successfully',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    logger.error('Error deleting memory:', error)

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
