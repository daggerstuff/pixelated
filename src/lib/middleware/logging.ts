import { defineMiddleware } from 'astro:middleware'
import { v4 as uuidv4 } from 'uuid'
import { getSession } from '../auth/session'
import { getLogger } from '../utils/logger'

/**
 * Request logging and tracking middleware
 * Adds request ID tracking and structured logging for all requests
 */
export const loggingMiddleware = defineMiddleware(async ({ request }, next) => {
  // Generate or get request ID
  const requestId = request.headers.get('x-request-id') || uuidv4()

  // Create a logger for this request
  const logger = getLogger(requestId)

  // Basic request information
  const { method } = request
  const url = new URL(request.url)
  const path = url.pathname
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const referer = request.headers.get('referer') || 'direct'
  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'

  // Try to get user from session
  let userId = 'anonymous'
  try {
    const session = await getSession(request)
    if (session?.user?.id) {
      userId = session.user.id
    }
  } catch {
    // Ignore session errors
  }

  // Log the start of the request
  logger.info(`${method} ${path}`, {
    request: {
      method,
      path,
      query: Object.fromEntries(url.searchParams),
      userAgent,
      referer,
      ip,
      userId,
    },
  })

  // Record start time
  const startTime = performance.now()

  try {
    // Process the request
    const response = await next()

    // Calculate request duration
    const duration = performance.now() - startTime

    // Add request ID header to response
    response?.headers.set('x-request-id', requestId)

    // Log successful response
    logger.info(`${response.status} ${method} ${path}`, {
      response: {
        status: response?.status,
        duration: Math.round(duration),
        contentType: response?.headers.get('content-type') || 'unknown',
      },
    })

    return response
  } catch (error: unknown) {
    // Calculate request duration event for errors
    const duration = performance.now() - startTime

    // Log error
    logger.error(
      `Error processing ${method} ${path}`,
      { message: error instanceof Error ? error : new Error(String(error)) },
      {
        request: {
          method,
          path,
          duration: Math.round(duration),
        },
      },
    )

    // Re-throw the error to be handled by error handlers
    throw error
  }
})
