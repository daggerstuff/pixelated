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
  console.error(`[Tracing] Middleware start: ${context.request.url} COMMAND=${import.meta.env.COMMAND}`);
  const startTime = Date.now()

  // Handle static prerendering scenarios where request or headers might not be available
  if (!context?.request) {
    logger.debug('Skipping tracing for static prerendering - no request object available')
    return next()
  }

  // Resolve a robust URL object; some runtimes may not provide `context.url` as a URL
  const req = context.request
  const url = (() => {
    try {
      const ctxUrl = (context as any).url
      if (ctxUrl && ctxUrl instanceof URL) return ctxUrl as URL
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
  const isBuild = import.meta.env.COMMAND === 'build'

  if (req?.url?.includes('/blog/tags/')) {
    console.log(`[Tracing] Request: ${req.url}, COMMAND=${import.meta.env.COMMAND}, isBuild=${isBuild}`);
  }

  const canAccessHeaders = !!req && 'headers' in req && typeof req.headers?.get === 'function' && !isBuild

  // Extract trace context from headers only if safe
  const traceParent = canAccessHeaders ? req.headers.get('traceparent') : null
  const traceState = canAccessHeaders ? req.headers.get('tracestate') : null

  // Create span for this request
  const span = tracer.startSpan(`${method} ${url.pathname}`, {
    kind: SpanKind.SERVER,
    attributes: {
      [SemanticAttributes.HTTP_METHOD]: method,
      [SemanticAttributes.HTTP_URL]: url.toString(),
      [SemanticAttributes.HTTP_SCHEME]: url.protocol.replace(':', ''),
      [SemanticAttributes.HTTP_TARGET]: url.pathname + url.search,
      [SemanticAttributes.HTTP_ROUTE]: url.pathname,
      'http.user_agent': canAccessHeaders ? (req.headers.get('user-agent') || '') : '',
      'http.request_id': canAccessHeaders ? (req.headers.get('x-request-id') || '') : '',
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