/**
 * OpenTelemetry Tracing Middleware for Astro
 *
 * Adds distributed tracing to HTTP requests handled by Astro.
 * This middleware should be used with Astro's middleware system.
 */

import { trace, context as otelContext, SpanStatusCode, SpanKind } from '@opentelemetry/api'
import { SemanticAttributes } from '@opentelemetry/semantic-conventions'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import type { MiddlewareHandler } from 'astro'

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
  // Check if context has request property before destructuring
  if (!context.request) {
    logger.debug('Skipping tracing for static prerendering - no request object available')
    return next()
  }

  const { url, request } = context

  const { method } = request

  // Determine if it's safe to access request headers
  // Some prerender/static contexts may provide a request object without usable headers
  const canAccessHeaders = typeof (request as any)?.headers?.get === 'function'

  // Extract trace context from headers only if safe
  const traceParent = canAccessHeaders ? request.headers.get('traceparent') : null
  const traceState = canAccessHeaders ? request.headers.get('tracestate') : null

  // Create span for this request
  const span = tracer.startSpan(`${method} ${url.pathname}`, {
    kind: SpanKind.SERVER,
    attributes: {
      [SemanticAttributes.HTTP_METHOD]: method,
      [SemanticAttributes.HTTP_URL]: url.toString(),
      [SemanticAttributes.HTTP_SCHEME]: url.protocol.replace(':', ''),
      [SemanticAttributes.HTTP_TARGET]: url.pathname + url.search,
      [SemanticAttributes.HTTP_ROUTE]: url.pathname,
      'http.user_agent': canAccessHeaders ? (request.headers.get('user-agent') || '') : '',
      'http.request_id': canAccessHeaders ? (request.headers.get('x-request-id') || '') : '',
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
      [SemanticAttributes.HTTP_STATUS_CODE]: response.status,
      [SemanticAttributes.HTTP_RESPONSE_SIZE]: Number(
        response.headers.get('content-length') || 0,
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
  } catch (error) {
    // Calculate duration
    const duration = Date.now() - startTime

    // Mark span as error
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    })
    span.recordException(error instanceof Error ? error : new Error(String(error)))
    span.setAttribute('http.response.duration_ms', duration)

    logger.error('Request failed in tracing middleware', {
      error: error instanceof Error ? error.message : String(error),
      method,
      pathname: url.pathname,
      duration,
    })

    throw error
  } finally {
    span.end()
  }
}