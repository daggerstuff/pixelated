// import type { APIRoute, APIContext } from 'astro'
import { createBuildSafeLogger } from '../../../lib/logging/build-safe-logger'
import { getCurrentUser } from '@/lib/auth'
import { MemoryService } from '../../../lib/memory'

const logger = createBuildSafeLogger('memory-api')
const memoryService = new MemoryService()

export const POST = async ({ request, cookies }) => {
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
        }
      )
    }

    // Parse request body
    const body = await request.json()
    const { content, metadata } = body

    if (!content) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'content parameter is required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Create memory
    const result = await memoryService.createMemory(
      content,
      {
        userId: user.id,
        ...metadata,
      }
    )

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error: unknown) {
    logger.error('Error creating memory:', error)

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
      }
    )
  }
}
