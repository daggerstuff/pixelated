/**
 * OpenTelemetry Tracing Configuration
 * 
 * Configures distributed tracing for the Pixelated Empathy platform
 * to enable end-to-end request tracking across microservices.
 */

import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

export interface TracingConfig {
  enabled: boolean
  serviceName: string
  serviceVersion: string
  environment: string
  exporter: {
    type: 'otlp' | 'console' | 'jaeger' | 'zipkin'
    endpoint?: string
    headers?: Record<string, string>
  }
  sampling: {
    ratio: number // 0.0 to 1.0
  }
  instrumentation: {
    http: boolean
    express: boolean
    mongodb: boolean
    postgres: boolean
    redis: boolean
    fastify?: boolean
  }
}

/**
 * Get tracing configuration from environment variables
 */
export function getTracingConfig(): TracingConfig {
  const isProduction = import.meta.env.PROD

  // Default to enabled in production, can be disabled via env var
  const enabled =
    import.meta.env.TRACING_ENABLED !== 'false' &&
    (isProduction || import.meta.env.TRACING_ENABLED === 'true')

  return {
    enabled,
    serviceName: import.meta.env.TRACING_SERVICE_NAME || 'pixelated-empathy',
    serviceVersion: import.meta.env.TRACING_SERVICE_VERSION || '1.0.0',
    environment: import.meta.env.MODE || (isProduction ? 'production' : 'development'),
    exporter: {
      type: (import.meta.env.TRACING_EXPORTER_TYPE as 'otlp' | 'console' | 'jaeger' | 'zipkin') || 'otlp',
      endpoint: import.meta.env.TRACING_EXPORTER_ENDPOINT || 'http://localhost:4318',
      headers: import.meta.env.TRACING_EXPORTER_HEADERS
        ? JSON.parse(import.meta.env.TRACING_EXPORTER_HEADERS)
        : undefined,
    },
    sampling: {
      ratio: parseFloat(import.meta.env.TRACING_SAMPLING_RATIO || '1.0'),
    },
    instrumentation: {
      http: import.meta.env.TRACING_INSTRUMENT_HTTP !== 'false',
      express: import.meta.env.TRACING_INSTRUMENT_EXPRESS !== 'false',
      mongodb: import.meta.env.TRACING_INSTRUMENT_MONGODB !== 'false',
      postgres: import.meta.env.TRACING_INSTRUMENT_POSTGRES !== 'false',
      redis: import.meta.env.TRACING_INSTRUMENT_REDIS !== 'false',
      fastify: import.meta.env.TRACING_INSTRUMENT_FASTIFY === 'true',
    },
  }
}

/**
 * Create OpenTelemetry Resource with service information
 */
export function createResource(config: TracingConfig): Resource {
  return new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
    [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: `${config.serviceName}-${Date.now()}`,
  })
}

/**
 * Get sampling configuration for traces
 */
export function getSamplerConfig(config: TracingConfig) {
  return {
    ratio: Math.max(0, Math.min(1, config.sampling.ratio)),
  }
}
