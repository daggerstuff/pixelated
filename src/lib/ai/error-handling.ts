import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('default')

/**
 * Handles API errors and returns a standardized Response
 */
export function handleApiError(error: unknown): Response {
  const errorMessage = error instanceof Error ? error.message : String(error)

  logger.error('API Error:', { error: errorMessage })

  return new Response(
    JSON.stringify({
      error: 'Internal Server Error',
      message: errorMessage,
    }),
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}
