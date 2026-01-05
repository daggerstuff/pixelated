import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('default')

/**
 * Handles API errors and returns a standardized Response
 */
export function handleApiError(error: unknown): Response {
    const errorMessage = error instanceof Error ? String(error) : String(error)

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
