# Distributed Tracing Module

This module provides OpenTelemetry-based distributed tracing for the Pixelated Empathy platform.

## Features

- ✅ Automatic instrumentation for HTTP, Express, MongoDB, PostgreSQL, Redis
- ✅ Manual instrumentation utilities for custom business logic
- ✅ Trace context propagation across service boundaries
- ✅ Configurable sampling and exporters
- ✅ HIPAA-compliant (no PHI in traces)
- ✅ Integration with Azure Application Insights, Grafana, Jaeger, etc.

## Quick Start

Tracing is automatically initialized when the application starts. No additional setup required!

### Environment Variables

```bash
# Enable tracing (default: enabled in production)
TRACING_ENABLED=true

# Service identification
TRACING_SERVICE_NAME=pixelated-empathy
TRACING_SERVICE_VERSION=1.0.0

# Exporter configuration
TRACING_EXPORTER_TYPE=otlp
TRACING_EXPORTER_ENDPOINT=http://localhost:4318
```

### Basic Usage

```typescript
import { withSpan, addSpanAttributes } from '@/lib/tracing'

// Wrap async operations
const result = await withSpan('my-operation', async (span) => {
  span.setAttribute('user.id', userId)
  return await doSomething()
})

// Add attributes to current span
addSpanAttributes({
  'operation.type': 'data-processing',
})
```

## Architecture

```
┌─────────────────────────────────────────┐
│         Application Code                │
│  (HTTP requests, DB queries, etc.)      │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│    OpenTelemetry Auto-Instrumentation   │
│  (HTTP, Express, MongoDB, PostgreSQL) │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      Tracing Middleware (Astro)        │
│  (Request/response tracking)            │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      OpenTelemetry SDK                   │
│  (Span processing, sampling, export)    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      OTLP Exporter                       │
│  (Sends traces to collector/backend)    │
└──────────────────────────────────────────┘
```

## Files

- `config.ts`: Configuration and environment variable parsing
- `setup.ts`: OpenTelemetry SDK initialization
- `middleware.ts`: Astro middleware for HTTP request tracing
- `utils.ts`: Utilities for manual instrumentation
- `index.ts`: Public API exports

## Integration Points

1. **Application Startup** (`src/lib/startup.ts`): Initializes tracing
2. **Astro Middleware** (`src/middleware.ts`): Adds tracing middleware
3. **Monitoring Middleware** (`src/middleware/monitoring.ts`): Can use trace IDs for correlation

## Performance Impact

- Overhead: ~1-5ms per request
- Memory: Minimal (spans are batched and exported asynchronously)
- Network: Traces are exported in batches to reduce overhead

## HIPAA Compliance

- No PHI (Protected Health Information) is included in span attributes
- Trace IDs are safe to log (they're random identifiers)
- All tracing respects the same privacy requirements as the rest of the application

## See Also

- [Tracing Guide](../../../docs/guides/tracing.md): Comprehensive documentation
- [OpenTelemetry Docs](https://opentelemetry.io/docs/): Official documentation
