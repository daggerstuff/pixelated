# Distributed Tracing Guide

## Overview

Pixelated Empathy uses OpenTelemetry for distributed tracing, enabling end-to-end request tracking across all microservices. This helps identify performance bottlenecks, debug issues, and understand system behavior.

## Features

- **Automatic Instrumentation**: HTTP requests, database operations, and external API calls are automatically traced
- **Manual Instrumentation**: Utilities for adding custom spans to business logic
- **Trace Context Propagation**: Trace IDs are propagated across service boundaries
- **Performance Monitoring**: Track latency, errors, and throughput across services
- **HIPAA-Compliant**: All tracing data respects privacy requirements

## Configuration

Tracing is configured via environment variables:

```bash
# Enable/disable tracing (default: enabled in production)
TRACING_ENABLED=true

# Service identification
TRACING_SERVICE_NAME=pixelated-empathy
TRACING_SERVICE_VERSION=1.0.0

# Exporter configuration
TRACING_EXPORTER_TYPE=otlp  # Options: otlp, console, jaeger, zipkin
TRACING_EXPORTER_ENDPOINT=http://localhost:4318
TRACING_EXPORTER_HEADERS='{"Authorization": "Bearer token"}'

# Sampling ratio (0.0 to 1.0, default: 1.0 = 100%)
TRACING_SAMPLING_RATIO=1.0

# Instrumentation flags
TRACING_INSTRUMENT_HTTP=true
TRACING_INSTRUMENT_EXPRESS=true
TRACING_INSTRUMENT_MONGODB=true
TRACING_INSTRUMENT_POSTGRES=true
TRACING_INSTRUMENT_REDIS=true
```

## Usage

### Automatic Instrumentation

Most common operations are automatically instrumented:

- **HTTP Requests**: All HTTP requests are automatically traced
- **Database Operations**: MongoDB and PostgreSQL queries are traced
- **Redis Operations**: Cache operations are traced
- **Express Routes**: Express endpoints are automatically instrumented

### Manual Instrumentation

For custom business logic, use the tracing utilities:

```typescript
import { withSpan, addSpanAttributes, markSpanError } from '@/lib/tracing'

// Wrap an async function with a span
const result = await withSpan('process-payment', async (span) => {
  span.setAttribute('payment.amount', amount)
  span.setAttribute('payment.currency', 'USD')
  
  try {
    return await processPayment(amount)
  } catch (error) {
    markSpanError(error)
    throw error
  }
})

// Add attributes to the current span
addSpanAttributes({
  'user.id': userId,
  'operation.type': 'data-export',
})

// Database operation with tracing
import { withDatabaseSpan } from '@/lib/tracing'

const users = await withDatabaseSpan(
  'SELECT',
  'users',
  async () => {
    return db.query('SELECT * FROM users WHERE id = ?', [userId])
  },
  {
    'db.query.type': 'select',
    'db.query.table': 'users',
  }
)

// AI service call with tracing
import { withAIServiceSpan } from '@/lib/tracing'

const response = await withAIServiceSpan(
  'openai',
  'gpt-4',
  'chat-completion',
  async () => {
    return await aiService.chat(messages)
  },
  {
    'ai.tokens.input': inputTokens,
    'ai.tokens.output': outputTokens,
  }
)
```

### Accessing Trace Information

```typescript
import { getCurrentTraceId, getCurrentSpanId, getTraceContext } from '@/lib/tracing'

// Get current trace ID (useful for logging correlation)
const traceId = getCurrentTraceId()

// Get current span ID
const spanId = getCurrentSpanId()

// Get trace context for propagation (e.g., in HTTP headers)
const traceContext = getTraceContext()
// Returns: { 'traceparent': '00-...' }
```

## Trace Context Propagation

Trace context is automatically propagated via HTTP headers:

- **traceparent**: W3C Trace Context standard header
- **x-trace-id**: Custom header with trace ID
- **x-span-id**: Custom header with current span ID

When making HTTP requests to other services, the trace context is automatically included, enabling distributed tracing across service boundaries.

## Viewing Traces

### Local Development

For local development, you can use:

1. **Console Exporter**: Set `TRACING_EXPORTER_TYPE=console` to see traces in logs
2. **Jaeger**: Run Jaeger locally and set `TRACING_EXPORTER_TYPE=jaeger`
3. **OTLP Collector**: Run an OTLP collector and point to it

### Production

In production, traces are typically sent to:

- **Azure Application Insights**: Via OTLP exporter
- **Datadog**: Via OTLP exporter
- **Grafana Tempo**: Via OTLP exporter
- **Custom OTLP endpoint**: Configure via `TRACING_EXPORTER_ENDPOINT`

## Best Practices

1. **Use Descriptive Span Names**: Use clear, hierarchical names like `db.query.users`, `ai.completion.gpt4`
2. **Add Relevant Attributes**: Include context that helps debugging (user IDs, operation types, etc.)
3. **Handle Errors Properly**: Always mark spans as errors when exceptions occur
4. **Avoid High Cardinality**: Don't add attributes with unique values (like timestamps) as they create too many unique spans
5. **Respect Sampling**: In high-traffic scenarios, use sampling to reduce overhead
6. **HIPAA Compliance**: Never include PHI (Protected Health Information) in span attributes

## Performance Considerations

- Tracing adds minimal overhead (~1-5ms per request)
- Sampling can reduce overhead in high-traffic scenarios
- Batch export reduces network overhead
- Spans are exported asynchronously and don't block requests

## Troubleshooting

### Traces Not Appearing

1. Check that `TRACING_ENABLED=true`
2. Verify exporter endpoint is accessible
3. Check exporter configuration (headers, endpoint URL)
4. Review logs for initialization errors

### High Overhead

1. Reduce sampling ratio: `TRACING_SAMPLING_RATIO=0.1` (10%)
2. Disable unnecessary instrumentations
3. Check batch export settings

### Missing Spans

1. Ensure tracing is initialized before other modules
2. Check that instrumentations are enabled
3. Verify span context is properly propagated

## Integration with Monitoring

Tracing integrates with:

- **Azure Application Insights**: Automatic integration via OTLP
- **Prometheus**: Metrics are exported alongside traces
- **Grafana**: Visualize traces in Grafana dashboards
- **Sentry**: Error tracking includes trace context

## Examples

See the following files for examples:

- `src/lib/tracing/utils.ts`: Utility functions
- `src/middleware.ts`: Middleware integration
- `src/lib/startup.ts`: Initialization

## Further Reading

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [OpenTelemetry JavaScript](https://opentelemetry.io/docs/instrumentation/js/)
