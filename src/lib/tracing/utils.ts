/**
 * OpenTelemetry Tracing Utilities
 * 
 * Helper functions for manual instrumentation and span management.
 */

import { trace, Span, SpanStatusCode, SpanKind } from '@opentelemetry/api'
import { SemanticAttributes } from '@opentelemetry/semantic-conventions'

const tracer = trace.getTracer('pixelated-empathy')

/**
 * Create a new span for a given operation
 */
export function createSpan(
  name: string,
  kind: SpanKind = SpanKind.INTERNAL,
  attributes?: Record<string, string | number | boolean>,
): Span {
  return tracer.startSpan(name, {
    kind,
    attributes,
  })
}

/**
 * Execute a function within a span
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const span = tracer.startSpan(name, {
    attributes,
  })

  try {
    const result = await fn(span)
    span.setStatus({ code: SpanStatusCode.OK })
    return result
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    })
    span.recordException(error instanceof Error ? error : new Error(String(error)))
    throw error
  } finally {
    span.end()
  }
}

/**
 * Execute a synchronous function within a span
 */
export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T,
  attributes?: Record<string, string | number | boolean>,
): T {
  const span = tracer.startSpan(name, {
    attributes,
  })

  try {
    const result = fn(span)
    span.setStatus({ code: SpanStatusCode.OK })
    return result
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    })
    span.recordException(error instanceof Error ? error : new Error(String(error)))
    throw error
  } finally {
    span.end()
  }
}

/**
 * Add attributes to the current active span
 */
export function addSpanAttributes(
  attributes: Record<string, string | number | boolean>,
): void {
  const activeSpan = trace.getActiveSpan()
  if (activeSpan) {
    Object.entries(attributes).forEach(([key, value]) => {
      activeSpan.setAttribute(key, value)
    })
  }
}

/**
 * Add an event to the current active span
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  const activeSpan = trace.getActiveSpan()
  if (activeSpan) {
    activeSpan.addEvent(name, attributes)
  }
}

/**
 * Mark the current span with an error
 */
export function markSpanError(error: Error): void {
  const activeSpan = trace.getActiveSpan()
  if (activeSpan) {
    activeSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    })
    activeSpan.recordException(error)
  }
}

/**
 * Create a span for a database operation
 */
export async function withDatabaseSpan<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  return withSpan(
    `db.${operation}`,
    async (span) => {
      span.setAttributes({
        [SemanticAttributes.DB_OPERATION]: operation,
        [SemanticAttributes.DB_SQL_TABLE]: table,
        ...attributes,
      })
      return fn()
    },
    {
      [SemanticAttributes.DB_SYSTEM]: 'postgresql',
      ...attributes,
    },
  )
}

/**
 * Create a span for an HTTP client request
 */
export async function withHttpClientSpan<T>(
  method: string,
  url: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  return withSpan(
    `http.${method}`,
    async (span) => {
      span.setAttributes({
        [SemanticAttributes.HTTP_METHOD]: method,
        [SemanticAttributes.HTTP_URL]: url,
        ...attributes,
      })
      return fn()
    },
    {
      [SemanticAttributes.HTTP_METHOD]: method,
      [SemanticAttributes.HTTP_URL]: url,
      ...attributes,
    },
  )
}

/**
 * Create a span for an AI service call
 */
export async function withAIServiceSpan<T>(
  provider: string,
  model: string,
  operation: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  return withSpan(
    `ai.${provider}.${operation}`,
    async (span) => {
      span.setAttributes({
        'ai.provider': provider,
        'ai.model': model,
        'ai.operation': operation,
        ...attributes,
      })
      return fn()
    },
    {
      'ai.provider': provider,
      'ai.model': model,
      'ai.operation': operation,
      ...attributes,
    },
  )
}

/**
 * Get the current trace ID
 */
export function getCurrentTraceId(): string | undefined {
  const activeSpan = trace.getActiveSpan()
  if (activeSpan) {
    const spanContext = activeSpan.spanContext()
    return spanContext.traceId
  }
  return undefined
}

/**
 * Get the current span ID
 */
export function getCurrentSpanId(): string | undefined {
  const activeSpan = trace.getActiveSpan()
  if (activeSpan) {
    const spanContext = activeSpan.spanContext()
    return spanContext.spanId
  }
  return undefined
}

/**
 * Get trace context for propagation (e.g., in HTTP headers)
 */
export function getTraceContext(): Record<string, string> {
  const activeSpan = trace.getActiveSpan()
  if (!activeSpan) {
    return {}
  }

  const spanContext = activeSpan.spanContext()
  return {
    'traceparent': `00-${spanContext.traceId}-${spanContext.spanId}-${spanContext.traceFlags.toString(16).padStart(2, '0')}`,
  }
}
