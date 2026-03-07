// import type { APIRoute } from 'astro'
import { createBuildSafeLogger } from '../../../lib/logging/build-safe-logger'
import { getCurrentUser } from '@/lib/auth'
import { MemoryService } from '../../../lib/memory'

const logger = createBuildSafeLogger('memory-api')
const memoryService = new MemoryService()

export const PUT = async ({ request, cookies }) => {
  try {
    // Authenticate request
    const user = await getCurrentUser(cookies)
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

    // Parse request body
    const body = await request.json()
    const { memoryId, content, metadata } = body

    if (!memoryId || !content) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'memoryId and content parameters are required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Update memory
    const result = await memoryService.updateMemory(
      memoryId,
      user.id,
      {
        content,
        ...metadata,
      }
    )

    if (result === null) {
      return new Response(
        JSON.stringify({
          error: 'Not Found',
          message: 'Memory not found or you do not have permission to update it',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error: unknown) {
    logger.error('Error updating memory:', error)

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
