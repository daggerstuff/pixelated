/**
 * OpenTelemetry Tracing Module
 * 
 * Main entry point for distributed tracing functionality.
 */

export { initializeTracing, shutdownTracing, isTracingInitialized } from './setup'
export { getTracingConfig, createResource, getSamplerConfig } from './config'
export {
  createSpan,
  withSpan,
  withSpanSync,
  addSpanAttributes,
  addSpanEvent,
  markSpanError,
  withDatabaseSpan,
  withHttpClientSpan,
  withAIServiceSpan,
  getCurrentTraceId,
  getCurrentSpanId,
  getTraceContext,
} from './utils'
export { tracingMiddleware } from './middleware'
