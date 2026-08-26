/// <reference types="astro/client" />
/**
 * OpenTelemetry Tracing Configuration
 *
 * Configures distributed tracing for the Pixelated Empathy platform
 * to enable end-to-end request tracking across microservices.
 */

import { resourceFromAttributes, type Resource } from '@opentelemetry/resources'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_SERVICE_INSTANCE_ID,
} from '@opentelemetry/semantic-conventions'
import { ATTR_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions/incubating'

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
  }
}

/**
 * Get tracing configuration from environment variables
 */
export function getTracingConfig(): TracingConfig {
  const envObj =
    typeof import.meta !== 'undefined' ? import.meta.env : process.env || {}
  const isProduction =
    envObj.PROD === true || process.env['NODE_ENV'] === 'production'

  // Default to enabled in production, can be disabled via env var
  const enabled =
    envObj['TRACING_ENABLED'] !== 'false' &&
    (isProduction || envObj['TRACING_ENABLED'] === 'true')

  return {
    enabled,
    serviceName: envObj['TRACING_SERVICE_NAME'] ?? 'pixelated-empathy',
    serviceVersion: envObj['TRACING_SERVICE_VERSION'] ?? '1.0.0',
    environment: envObj.MODE ?? (isProduction ? 'production' : 'development'),
    exporter: {
      type:
        (envObj['TRACING_EXPORTER_TYPE'] as
          | 'otlp'
          | 'console'
          | 'jaeger'
          | 'zipkin') || 'otlp',
      endpoint: envObj['TRACING_EXPORTER_ENDPOINT'] ?? 'http://localhost:4318',
      headers: envObj['TRACING_EXPORTER_HEADERS']
        ? JSON.parse(envObj['TRACING_EXPORTER_HEADERS'])
        : undefined,
    },
    sampling: {
      ratio: parseFloat(envObj['TRACING_SAMPLING_RATIO'] ?? '1.0'),
    },
    instrumentation: {
      http: envObj['TRACING_INSTRUMENT_HTTP'] !== 'false',
      express: envObj['TRACING_INSTRUMENT_EXPRESS'] !== 'false',
      mongodb: envObj['TRACING_INSTRUMENT_MONGODB'] !== 'false',
      postgres: envObj['TRACING_INSTRUMENT_POSTGRES'] !== 'false',
      redis: envObj['TRACING_INSTRUMENT_REDIS'] !== 'false',
    },
  }
}

/**
 * Create OpenTelemetry Resource with service information
 */
export function createResource(config: TracingConfig): Resource {
  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion,
    [ATTR_DEPLOYMENT_ENVIRONMENT]: config.environment,
    [ATTR_SERVICE_INSTANCE_ID]: `${config.serviceName}-${Date.now()}`,
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
