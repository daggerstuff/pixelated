# Sentry Metrics Usage Examples

Sentry Metrics are already configured and enabled in this project. This document provides quick examples for using metrics in both client and server code.

## Configuration Status

✅ **Metrics are enabled** in both `sentry.client.config.js` and `sentry.server.config.js`  
✅ **SDK Version**: `@sentry/astro@^10.28.1` (requires >= 10.28.1)  
✅ **DSN**: Configured and matches Sentry project  
✅ **Utilities**: Available in `src/lib/sentry/utils.ts`

## Quick Start

### Basic Usage (Direct API)

```typescript
import * as Sentry from '@sentry/astro'

// Counter - track incrementing values
Sentry.metrics.count('user_action', 1)

// Distribution - track response times
Sentry.metrics.distribution('api_response_time', 150, {
  unit: 'millisecond',
  attributes: {
    endpoint: '/api/analyze',
    method: 'POST'
  }
})

// Gauge - track values that go up and down
Sentry.metrics.gauge('active_sessions', 42, {
  attributes: { region: 'us-west' }
})
```

### Using Project Utilities (Recommended)

The project provides type-safe utilities in `src/lib/sentry/utils.ts`:

```typescript
import {
  countMetric,
  gaugeMetric,
  distributionMetric,
  emotionMetrics,
  biasMetrics,
  apiMetrics,
  sessionMetrics
} from '@/lib/sentry/utils'

// Counter metrics
countMetric('button_click', 1, { button: 'submit', page: 'login' })
countMetric('api_call', 1, { endpoint: '/api/analyze', method: 'POST' })

// Distribution metrics (for percentiles: p50, p90, p99)
distributionMetric('api_response_time', 187.5, {
  attributes: { endpoint: '/api/analyze' },
  unit: 'millisecond'
})

// Gauge metrics
gaugeMetric('active_sessions', 42, { region: 'us-west' })
gaugeMetric('queue_depth', 15, { priority: 'high' }, 'count')

// Domain-specific helpers
emotionMetrics.analysisPerformed({
  model: 'emotion-llama',
  sessionType: 'therapy',
  success: true
})

emotionMetrics.analysisLatency(234, 'emotion-llama')

biasMetrics.analysisPerformed({
  layer: 'preprocessing',
  success: true
})

apiMetrics.request('/api/analyze', 'POST', 200)
apiMetrics.responseTime('/api/analyze', 187.5, 'POST')

sessionMetrics.started('therapy')
sessionMetrics.completed('therapy', 45) // duration in minutes
```

## Metric Types

### Counter (`count`)
Use for incrementing values:
- Button clicks
- API calls
- Feature usage
- Error counts
- Job completions

### Gauge (`gauge`)
Use for values that can go up and down:
- Active sessions
- Queue depth
- Memory usage
- Concurrent users
- Cache size

### Distribution (`distribution`)
Use for value distributions (calculates percentiles: p50, p90, p99):
- Response times
- Request sizes
- Processing durations
- Latency measurements

## Adding Attributes

Attributes allow you to filter and group metrics in Sentry:

```typescript
Sentry.metrics.count('button_click', 1, {
  attributes: {
    browser: 'Firefox',
    app_version: '1.0.0',
    page: 'login',
    button: 'submit'
  }
})
```

## Specifying Units

For `gauge` and `distribution` metrics, specify units for better display:

```typescript
Sentry.metrics.distribution('response_time', 187.5, {
  unit: 'millisecond'
})

Sentry.metrics.gauge('memory_usage', 1024, {
  unit: 'byte'
})
```

## Flushing Metrics

By default, metrics are buffered and flushed automatically. To manually flush:

```typescript
import { flushMetrics } from '@/lib/sentry/utils'

// Flush all pending metrics
await flushMetrics()
```

## Configuration

Metrics are configured in:
- **Client**: `sentry.client.config.js`
- **Server**: `sentry.server.config.js`

Both include:
- `enableMetrics: true` (enabled by default)
- `beforeSendMetric` callback for filtering/modifying metrics
- Environment-specific attributes

## Environment Variables

- `SENTRY_ENABLE_METRICS`: Set to `'false'` to disable metrics (default: enabled)
- `SENTRY_DSN`: Sentry DSN (already configured)
- `SENTRY_RELEASE`: Release version (set in CI/CD)

## References

- [Sentry Metrics Documentation](https://docs.sentry.io/platforms/javascript/guides/astro/metrics/)
- Project utilities: `src/lib/sentry/utils.ts`
- Configuration: `sentry.client.config.js`, `sentry.server.config.js`
