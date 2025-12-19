# Sentry Metrics Implementation Summary

This document summarizes where Sentry metrics have been instrumented throughout the Pixelated Empathy codebase.

## Overview

Metrics have been strategically placed in the most efficient and logical locations to provide comprehensive observability:

1. **API Routes** - Request counts, response times, error rates
2. **AI Services** - Emotion analysis, bias detection, response generation
3. **Background Jobs** - Job processing times, queue depth, success/failure rates
4. **User Interactions** - Button clicks, form submissions, chat messages
5. **AI Providers** - Model usage, latency, success rates

## Implementation Details

### 1. API Route Metrics Helper

**Location**: `src/lib/sentry/api-metrics.ts`

Created a reusable helper for consistent API route instrumentation:

- `withMetrics()` - Wraps API route handlers with automatic metrics
- `trackApiRequest()` - Manually track API requests with timing
- `trackApiError()` - Track API errors with error types

**Usage Example**:
```typescript
import { trackApiRequest, trackApiError } from '@/lib/sentry/api-metrics'

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now()
  const endpoint = '/api/ai/response'
  
  try {
    // ... handler code ...
    trackApiRequest(endpoint, 'POST', 200, Date.now() - startTime)
  } catch (error) {
    trackApiError(endpoint, errorType, 'POST')
  }
}
```

### 2. Critical API Routes Instrumented

#### `/api/ai/response` (`src/pages/api/ai/response.ts`)
- ✅ Request counts by status code
- ✅ Response time distribution
- ✅ Error tracking with error types
- ✅ AI response generation success/failure counts
- ✅ Model and provider tracking

**Metrics Tracked**:
- `api.request` - Request count with endpoint, method, status code
- `api.response_time` - Response latency distribution
- `api.error` - Error counts by type
- `ai.response.generated` - Successful response generation
- `ai.response.error` - Failed response generation

#### `/api/emotions/real-time-analysis` (`src/pages/api/emotions/real-time-analysis.ts`)
- ✅ Request counts and response times
- ✅ Emotion analysis performance metrics
- ✅ Analysis latency tracking
- ✅ Success/failure rates

**Metrics Tracked**:
- `api.request` - Request count
- `api.response_time` - Total request duration
- `emotion.analysis_performed` - Analysis count with model and success status
- `emotion.analysis_latency` - Analysis duration distribution

### 3. AI Service Servers

#### AI Service Server (`src/lib/ai/services/server.ts`)
- ✅ Request handling metrics for all endpoints
- ✅ Chat completion tracking
- ✅ Emotion analysis endpoint metrics
- ✅ Streaming chat metrics

**Metrics Tracked**:
- `/ai-service/chat` - Chat completion requests
- `/ai-service/analyze-emotion` - Emotion analysis requests
- `/ai-service/chat/stream` - Streaming chat requests
- Error tracking for all endpoints

### 4. Background Job Worker

#### Job Worker (`src/lib/jobs/worker.ts`)
- ✅ Active job count gauge
- ✅ Job dequeued/completed/failed counts
- ✅ Job duration distributions
- ✅ Bias analysis batch processing metrics
- ✅ Report generation metrics

**Metrics Tracked**:
- `jobs.active_count` - Gauge of currently active jobs
- `jobs.dequeued` - Jobs pulled from queue
- `jobs.completed` - Successfully completed jobs
- `jobs.failed` - Failed jobs with error types
- `jobs.duration` - Job processing time distribution
- `jobs.bias_analysis_batch.duration` - Batch analysis duration
- `jobs.report_generation.duration` - Report generation duration

### 5. AI Providers

#### EmotionLlamaProvider (`src/lib/ai/providers/EmotionLlamaProvider.ts`)
- ✅ Emotion analysis success/failure rates
- ✅ Analysis latency tracking
- ✅ Model version tracking
- ✅ Fallback detection

**Metrics Tracked**:
- `emotion.analysis_performed` - Analysis attempts with model and success
- `emotion.analysis_latency` - Analysis duration by model

### 6. User Interaction Components

#### TherapyChatClient (`src/components/chat/TherapyChatClient.tsx`)
- ✅ Chat message submission tracking
- ✅ WebSocket message sending
- ✅ Scenario selection tracking
- ✅ Encryption status tracking

**Metrics Tracked**:
- `user.action` - User actions (chat_submit) with context
- `websocket.message_sent` - WebSocket message tracking

#### BiasDetectionForm (`src/components/ui/BiasDetectionForm.tsx`)
- ✅ Form submission tracking
- ✅ Validation failure tracking
- ✅ Submission error tracking
- ✅ Session type tracking

**Metrics Tracked**:
- `form.submitted` - Successful form submissions
- `form.validation_failed` - Validation errors
- `form.submission_error` - Submission errors with error types

## Metric Types Used

### Counters (`count`)
- Request counts
- Job counts (dequeued, completed, failed)
- User actions
- Form submissions
- Error occurrences

### Distributions (`distribution`)
- Response times (p50, p90, p99)
- Job durations
- Analysis latencies
- Processing times

### Gauges (`gauge`)
- Active job count
- Queue depth (when implemented)
- Active sessions (when implemented)

## Best Practices Applied

1. **Consistent Naming**: All metrics use dot notation (e.g., `api.request`, `jobs.completed`)
2. **Rich Attributes**: Metrics include relevant context (model, endpoint, error type, etc.)
3. **Error Tracking**: All error paths include error type classification
4. **Performance Tracking**: Critical operations track latency distributions
5. **Domain-Specific Helpers**: Use `emotionMetrics`, `apiMetrics`, `biasMetrics` from `@/lib/sentry/utils`

## Next Steps (Optional Enhancements)

1. **Additional API Routes**: Add metrics to more API endpoints as needed
2. **Database Operations**: Add metrics for database query performance
3. **External Service Calls**: Track latency for external API calls
4. **Cache Operations**: Track cache hit/miss rates
5. **WebSocket Metrics**: More detailed WebSocket connection and message metrics
6. **Session Metrics**: Track active sessions, session duration, etc.

## References

- [Sentry Metrics Documentation](https://docs.sentry.io/platforms/javascript/guides/astro/metrics/)
- Project utilities: `src/lib/sentry/utils.ts`
- API metrics helper: `src/lib/sentry/api-metrics.ts`
- Usage examples: `docs/sentry-metrics-examples.md`
