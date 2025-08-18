import { azureInsights } from '../lib/monitoring/azure-insights'
import { createBuildSafeLogger } from '../lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('monitoring-middleware')

export interface RequestMetrics {
  startTime: number
  endTime?: number
  duration?: number
  statusCode?: number
  success?: boolean
  userAgent?: string
  ip?: string
  userId?: string
}

interface MiddlewareContext {
  url: URL
  request: Request
}

type NextFunction = () => Promise<Response>

/**
 * Monitoring middleware for Astro
 * Tracks requests, performance, and errors
 */
export async function monitoringMiddleware(
  context: MiddlewareContext,
  next: NextFunction,
) {
  const startTime = Date.now()
  const { url } = context
  const { method } = context.request
  const userAgent = context.request.headers.get('user-agent') || 'unknown'
  const ip =
    context.request.headers.get('x-forwarded-for') ||
    context.request.headers.get('x-real-ip') ||
    'unknown'

  // Extract user ID from session if available
  let userId: string | undefined
  try {
    const cookies = context.request.headers.get('cookie')
    const sessionCookie = cookies
      ?.split(';')
      .find((c: string) => c.trim().startsWith('pixelated_session='))
      ?.split('=')[1]

    if (sessionCookie) {
      const session = JSON.parse(decodeURIComponent(sessionCookie) as any)
      userId = session.userId
    }
  } catch {
    // Ignore session parsing errors
  }

  const requestMetrics: RequestMetrics = {
    startTime,
    userAgent,
    ip,
    userId: userId ?? '',
  }

  // Track page view for GET requests to pages (not API routes)
  if (method === 'GET' && !url.pathname.startsWith('/api/')) {
    azureInsights.trackPageView(url.pathname, url.toString(), {
      userAgent,
      ip,
      userId: userId || 'anonymous',
    })
  }

  try {
    // Continue with the request
    const response = await next()

    // Calculate metrics
    const endTime = Date.now()
    const duration = endTime - startTime
    const statusCode = response.status
    const success = statusCode >= 200 && statusCode < 400

    requestMetrics.endTime = endTime
    requestMetrics.duration = duration
    requestMetrics.statusCode = statusCode
    requestMetrics.success = success

    // Track the request
    azureInsights.trackRequest({
      name: `${method} ${url.pathname}`,
      url: url.toString(),
      duration,
      responseCode: statusCode.toString(),
      success,
      properties: {
        method,
        userAgent,
        ip,
        userId: userId || 'anonymous',
        pathname: url.pathname,
      },
      measurements: {
        duration,
        statusCode,
      },
    })

    // Track performance metrics
    azureInsights.trackMetric({
      name: 'request.duration',
      value: duration,
      properties: {
        method,
        pathname: url.pathname,
        statusCode: statusCode.toString(),
        success: success.toString(),
      },
    })

    // Track error rates
    if (!success) {
      azureInsights.trackMetric({
        name: 'request.errors',
        value: 1,
        properties: {
          method,
          pathname: url.pathname,
          statusCode: statusCode.toString(),
        },
      })

      // Track specific error types
      if (statusCode >= 500) {
        azureInsights.trackEvent({
          name: 'server_error',
          properties: {
            method,
            pathname: url.pathname,
            statusCode: statusCode.toString(),
            userAgent,
            ip,
            userId: userId || 'anonymous',
          },
        })
      } else if (statusCode === 404) {
        azureInsights.trackEvent({
          name: 'page_not_found',
          properties: {
            method,
            pathname: url.pathname,
            userAgent,
            ip,
            userId: userId || 'anonymous',
          },
        })
      } else if (statusCode === 401 || statusCode === 403) {
        azureInsights.trackEvent({
          name: 'unauthorized_access',
          properties: {
            method,
            pathname: url.pathname,
            statusCode: statusCode.toString(),
            userAgent,
            ip,
            userId: userId || 'anonymous',
          },
        })
      }
    }

    // Track slow requests
    if (duration > 5000) {
      // 5 seconds
      azureInsights.trackEvent({
        name: 'slow_request',
        properties: {
          method,
          pathname: url.pathname,
          userAgent,
          ip,
          userId: userId || 'anonymous',
        },
        measurements: {
          duration,
        },
      })
    }

    // Log request completion
    logger.info('Request completed', {
      method,
      pathname: url.pathname,
      statusCode,
      duration,
      success,
      userId: userId || 'anonymous',
      ip,
    })

    return response
  } catch (error: unknown) {
    // Calculate metrics for failed requests
    const endTime = Date.now()
    const duration = endTime - startTime

    requestMetrics.endTime = endTime
    requestMetrics.duration = duration
    requestMetrics.success = false

    // Track the exception
    azureInsights.trackException({
      exception: error instanceof Error ? error : new Error(String(error)),
      properties: {
        method,
        pathname: url.pathname,
        userAgent,
        ip,
        userId: userId || 'anonymous',
      },
      measurements: {
        duration,
      },
      severityLevel: 'Error',
    })

    // Track failed request
    azureInsights.trackRequest({
      name: `${method} ${url.pathname}`,
      url: url.toString(),
      duration,
      responseCode: '500',
      success: false,
      properties: {
        method,
        userAgent,
        ip,
        userId: userId || 'anonymous',
        pathname: url.pathname,
        error: error instanceof Error ? String(error) : String(error),
      },
      measurements: {
        duration,
      },
    })

    // Track error metrics
    azureInsights.trackMetric({
      name: 'request.exceptions',
      value: 1,
      properties: {
        method,
        pathname: url.pathname,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      },
    })

    // Log the error
    logger.error('Request failed', {
      method,
      pathname: url.pathname,
      duration,
      error: error instanceof Error ? String(error) : String(error),
      stack: error instanceof Error ? (error as Error)?.stack : undefined,
      userId: userId || 'anonymous',
      ip,
    })

    // Re-throw the error
    throw error
  }
}

/**
 * Track custom business events
 */
export function trackBusinessEvent(
  eventName: string,
  properties?: Record<string, string>,
  measurements?: Record<string, number>,
) {
  azureInsights.trackEvent({
    name: eventName,
    properties: properties ?? {},
    measurements: measurements ?? {},
  })

  logger.info('Business event tracked', {
    eventName,
    properties,
    measurements,
  })
}

/**
 * Track user actions
 */
export function trackUserAction(
  action: string,
  userId: string,
  properties?: Record<string, string>,
) {
  azureInsights.trackEvent({
    name: 'user_action',
    properties: {
      action,
      userId,
      ...properties,
    },
  })

  logger.info('User action tracked', {
    action,
    userId,
    properties,
  })
}

/**
 * Track AI service usage
 */
export function trackAIUsage(
  provider: string,
  model: string,
  tokens: number,
  duration: number,
  success: boolean,
  userId?: string,
) {
  azureInsights.trackEvent({
    name: 'ai_service_usage',
    properties: {
      provider,
      model,
      success: success.toString(),
      userId: userId || 'anonymous',
    },
    measurements: {
      tokens,
      duration,
    },
  })

  azureInsights.trackMetric({
    name: 'ai.tokens_used',
    value: tokens,
    properties: {
      provider,
      model,
    },
  })

  azureInsights.trackMetric({
    name: 'ai.request_duration',
    value: duration,
    properties: {
      provider,
      model,
    },
  })

  logger.info('AI usage tracked', {
    provider,
    model,
    tokens,
    duration,
    success,
    userId: userId || 'anonymous',
  })
}

export default monitoringMiddleware
