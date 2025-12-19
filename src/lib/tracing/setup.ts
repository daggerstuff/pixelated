/**
 * OpenTelemetry Tracing Setup
 * 
 * Initializes distributed tracing for the application.
 * This should be called early in the application startup process.
 */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { getTracingConfig, createResource, getSamplerConfig } from './config'

const logger = createBuildSafeLogger('tracing')

let sdk: NodeSDK | null = null
let isInitialized = false

/**
 * Initialize OpenTelemetry tracing
 * 
 * This should be called once during application startup, before any other
 * modules that need tracing are loaded.
 */
export function initializeTracing(): void {
  if (isInitialized) {
    logger.warn('Tracing already initialized, skipping')
    return
  }

  const config = getTracingConfig()

  if (!config.enabled) {
    logger.info('Tracing is disabled, skipping initialization')
    return
  }

  try {
    logger.info('Initializing OpenTelemetry tracing', {
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion,
      environment: config.environment,
      exporterType: config.exporter.type,
    })

    // Create resource with service information
    const resource = createResource(config)

    // Create trace exporter based on configuration
    const traceExporter =
      config.exporter.type === 'console'
        ? new ConsoleSpanExporter()
        : new OTLPTraceExporter({
          url: config.exporter.endpoint
            ? `${config.exporter.endpoint}/v1/traces`
            : undefined,
          headers: config.exporter.headers,
        })

    // Create metric exporter
    const metricExporter = new OTLPMetricExporter({
      url: config.exporter.endpoint
        ? `${config.exporter.endpoint}/v1/metrics`
        : undefined,
      headers: config.exporter.headers,
    })

    // Create sampler based on configuration
    const sampler = new TraceIdRatioBasedSampler(
      getSamplerConfig(config).ratio,
    )

    // Create span processor
    const spanProcessor = new BatchSpanProcessor(traceExporter, {
      maxExportBatchSize: 512,
      scheduledDelayMillis: 5000,
      exportTimeoutMillis: 30000,
    })

    // Get auto-instrumentations
    const instrumentations = getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        enabled: config.instrumentation.http,
      },
      '@opentelemetry/instrumentation-express': {
        enabled: config.instrumentation.express,
      },
      '@opentelemetry/instrumentation-mongodb': {
        enabled: config.instrumentation.mongodb,
      },
      '@opentelemetry/instrumentation-pg': {
        enabled: config.instrumentation.postgres,
      },
      '@opentelemetry/instrumentation-redis': {
        enabled: config.instrumentation.redis,
      },
      '@opentelemetry/instrumentation-fastify': {
        enabled: config.instrumentation.fastify || false,
      },
    })

    // Initialize SDK
    sdk = new NodeSDK({
      resource,
      traceExporter,
      spanProcessor,
      sampler,
      instrumentations,
      metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 60000, // Export metrics every minute
      }),
    })

    // Start SDK
    sdk.start()

    isInitialized = true
    logger.info('OpenTelemetry tracing initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize tracing', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    // Don't throw - allow application to continue without tracing
  }
}

/**
 * Shutdown tracing gracefully
 * 
 * This should be called during application shutdown to ensure all
 * spans are exported before the process exits.
 */
export async function shutdownTracing(): Promise<void> {
  if (!isInitialized || !sdk) {
    return
  }

  try {
    logger.info('Shutting down tracing...')
    await sdk.shutdown()
    isInitialized = false
    sdk = null
    logger.info('Tracing shutdown complete')
  } catch (error) {
    logger.error('Error during tracing shutdown', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Check if tracing is initialized
 */
export function isTracingInitialized(): boolean {
  return isInitialized
}
