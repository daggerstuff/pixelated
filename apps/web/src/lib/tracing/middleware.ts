/**
 * OpenTelemetry Tracing Middleware for Astro
 *
 * Adds distributed tracing to HTTP requests handled by Astro.
 * This middleware should be used with Astro's middleware system.
 */

import {
  trace,
  context as otelContext,
  SpanStatusCode,
  SpanKind,
} from '@opentelemetry/api'
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_URL_FULL,
  ATTR_URL_SCHEME,
  ATTR_URL_PATH,
  ATTR_URL_QUERY,
  ATTR_HTTP_ROUTE,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
} from '@opentelemetry/semantic-conventions'
import { ATTR_HTTP_RESPONSE_SIZE } from '@opentelemetry/semantic-conventions/incubating'
import type { MiddlewareHandler } from 'astro'

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('tracing-middleware')
const tracer = trace.getTracer('pixelated-empathy-http')

/**
 * Tracing middleware for Astro requests
 *
 * Creates a span for each HTTP request and automatically tracks
 * request/response attributes and errors.
 *
 * This middleware integrates with Astro's middleware system and should
 * be added early in the middleware chain to capture all requests.
 */
export const tracingMiddleware: MiddlewareHandler = async (context, next) => {
  const startTime = Date.now()

  // Handle static prerendering scenarios where request or headers might not be available
  if (!context?.request) {
    logger.debug(
      'Skipping tracing for static prerendering - no request object available',
    )
    return next()
  }

  // Resolve a robust URL object; some runtimes may not provide `context.url` as a URL
  const req = context.request
  const url = (() => {
    try {
      const ctxUrl = (context as { url?: string }).url
      if (ctxUrl && ctxUrl instanceof URL) return ctxUrl
      // Fallback to constructing from request.url when available
      if (typeof req?.url === 'string') return new URL(req.url)
    } catch {
      // ignore and use final fallback below
    }
    // Final safe fallback to avoid crashing spans; minimal default
    return new URL('http://localhost/')
  })()

  const method = req?.method ?? 'GET'

  // Determine if it's safe to access request headers
  // In Astro, accessing headers on a prerendered page during build triggers a warning
  const isBuild = import.meta.env['COMMAND'] === 'build'
  const canAccessHeaders =
    !isBuild &&
    !!req &&
    'headers' in req &&
    typeof req.headers?.get === 'function'

  // Extract trace context from headers only if safe
  const traceParent = canAccessHeaders ? req.headers.get('traceparent') : null
  const traceState = canAccessHeaders ? req.headers.get('tracestate') : null

  // Create span for this request
  const span = tracer.startSpan(`${method} ${url.pathname}`, {
    kind: SpanKind.SERVER,
    attributes: {
      [ATTR_HTTP_REQUEST_METHOD]: method,
      [ATTR_URL_FULL]: url.toString(),
      [ATTR_URL_SCHEME]: url.protocol.replace(':', ''),
      [ATTR_URL_PATH]: url.pathname,
      [ATTR_URL_QUERY]: url.search,
      [ATTR_HTTP_ROUTE]: url.pathname,
      'http.user_agent': canAccessHeaders
        ? (req.headers.get('user-agent') ?? '')
        : '',
      'http.request_id': canAccessHeaders
        ? (req.headers.get('x-request-id') ?? '')
        : '',
    },
  })

  // Set trace context if provided
  if (traceParent || traceState) {
    // Note: In a real implementation, you'd parse and set the trace context
    // For now, we'll just record it as an attribute
    if (traceParent) {
      span.setAttribute('http.traceparent', traceParent)
    }
    if (traceState) {
      span.setAttribute('http.tracestate', traceState)
    }
  }

  try {
    // Execute the request within the span context
    const activeContext = trace.setSpan(otelContext.active(), span)
    const response = await otelContext.with(activeContext, async () => {
      return next()
    })

    // Calculate duration
    const duration = Date.now() - startTime

    // Update span with response information
    span.setAttributes({
      [ATTR_HTTP_RESPONSE_STATUS_CODE]: response.status,
      [ATTR_HTTP_RESPONSE_SIZE]: Number(
        response.headers.get('content-length') ?? 0,
      ),
      'http.response.duration_ms': duration,
    })

    // Set span status based on HTTP status code
    if (response.status >= 500) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${response.status}`,
      })
    } else if (response.status >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${response.status}`,
      })
    } else {
      span.setStatus({ code: SpanStatusCode.OK })
    }

    // Add trace ID to response headers for client correlation
    const spanContext = span.spanContext()
    const responseHeaders = new Headers(response.headers)
    responseHeaders.set('x-trace-id', spanContext.traceId)
    responseHeaders.set('x-span-id', spanContext.spanId)

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error: unknown) {
    // Calculate duration
    const duration = Date.now() - startTime

    // Mark span as error
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message:
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : String(error),
    })
    span.recordException(
      error instanceof Error ? error : new Error(String(error)),
    )
    span.setAttribute('http.response.duration_ms', duration)

    logger.error('Request failed in tracing middleware', {
      error:
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : String(error),
      method,
      pathname: url.pathname,
      duration,
    })

    throw error
  } finally {
    span.end()
  }
}
