# OpenTelemetry Tracing - Installation Notes

## Required Packages

The following OpenTelemetry packages are required for the tracing module:

```bash
pnpm add @opentelemetry/sdk-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/exporter-metrics-otlp-http \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/sdk-metrics \
  @opentelemetry/sdk-trace-base \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

## Note on Existing Dependencies

Some OpenTelemetry packages may already be available as transitive dependencies from:
- `@sentry/opentelemetry` (Sentry integration)
- Other monitoring tools

However, for full functionality, the packages listed above should be explicitly installed.

## Verification

After installation, verify the setup:

```typescript
import { isTracingInitialized } from '@/lib/tracing'

console.log('Tracing initialized:', isTracingInitialized())
```

## Troubleshooting

If you see import errors, ensure all packages are installed:

```bash
pnpm install
```

If packages are missing, install them explicitly using the command above.
