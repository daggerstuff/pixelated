import { trace, type Tracer } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions'

/**
 * Arize AX Tracing Configuration
 */
const ARIZE_CONFIG = {
  // Arize Space ID usually accompanies the API Key
  SPACE_ID:
    'ak-1c94aa3a-e12e-404a-8408-73ae0da9b729-uhchi5XKZqHsMUmph5WyF9ynK-FGKYfH',
  API_KEY:
    'ak-1c94aa3a-e12e-404a-8408-73ae0da9b729-uhchi5XKZqHsMUmph5WyF9ynK-FGKYfH',
  MODEL_ID: 'pixelated-empathy-gym',
  MODEL_VERSION: '0.1.0',
  ENDPOINT: 'otlp.arize.com',
}

let tracer: Tracer | null = null

/**
 * Initialize Arize AX Tracing
 */
export function initArizeTracing(): Tracer {
  if (tracer) return tracer

  const exporter = new OTLPTraceExporter({
    url: ARIZE_CONFIG.ENDPOINT,
    headers: {
      space_id: ARIZE_CONFIG.SPACE_ID,
      api_key: ARIZE_CONFIG.API_KEY,
    },
  })

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: ARIZE_CONFIG.MODEL_ID,
      [ATTR_SERVICE_VERSION]: ARIZE_CONFIG.MODEL_VERSION,
      model_id: ARIZE_CONFIG.MODEL_ID,
    }),
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  })

  provider.register()

  tracer = trace.getTracer('pixelated-empathy-tracing')
  return tracer
}

/**
 * Get the global Arize Tracer
 */
export function getArizeTracer(): Tracer {
  if (!tracer) {
    return initArizeTracing()
  }
  return tracer
}
