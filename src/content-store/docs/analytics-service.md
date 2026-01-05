---
title: 'Analytics Service'
description: 'Guide to Pixelated Healths analytics service for data processing and insights'
pubDate: 2025-03-24
share: true
toc: true
lastModDate: 2025-03-25
tags: ['analytics', 'services', 'data-processing']
author: 'Pixelated Team'
---

## Analytics Service Documentation

## Overview

The Analytics Service provides a robust, real-time analytics system for tracking events
and metrics across the application. Built with TypeScript and WebSocket technology,
it offers a scalable solution for collecting, processing, and analyzing data while maintaining
HIPAA compliance.

## Features

- Real-time event tracking
- Metric collection and aggregation
- WebSocket-based real-time updates
- Redis-based queue system
- HIPAA-compliant data handling
- Customizable event types and priorities
- Metric tagging and filtering
- Automatic data cleanup
- Comprehensive error handling

## Usage

### Initializing the Service

```typescript

const analyticsService = new AnalyticsService({
  retentionDays: 90, // How long to keep data
  batchSize: 100, // Events to process per batch
  processingInterval: 1000, // Processing interval in ms
})
```

### Tracking Events

```typescript
  EventType,
  EventPriority,
} from '@/lib/services/analytics/AnalyticsService'

// Track a user action
await analyticsService.trackEvent({
  type: EventType.USER_ACTION,
  priority: EventPriority.NORMAL,
  userId: 'user-123',
  sessionId: 'session-456',
  properties: {
    action: 'click',
    target: 'submit-button',
    page: '/therapy/session',
  },
  metadata: {
    browser: 'Chrome',
    os: 'macOS',
    timestamp: Date.now(),
  },
})

// Track a therapy session
await analyticsService.trackEvent({
  type: EventType.THERAPY_SESSION,
  priority: EventPriority.HIGH,
  userId: 'user-123',
  sessionId: 'therapy-789',
  properties: {
    duration: 3600,
    type: 'cbt',
    outcome: 'completed',
  },
})
```

### Tracking Metrics

```typescript
// Track API response time
await analyticsService.trackMetric({
  name: 'api_response_time',
  value: 150, // milliseconds
  tags: {
    endpoint: '/api/therapy/session',
    method: 'POST',
    status: '200',
  },
})

// Track active users
await analyticsService.trackMetric({
  name: 'active_users',
  value: 1250,
  tags: {
    type: 'daily',
    source: 'web',
  },
})
```

### Retrieving Events

```typescript
// Get recent user actions
const events = await analyticsService.getEvents({
  type: EventType.USER_ACTION,
  startTime: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
  endTime: Date.now(),
  limit: 100,
  offset: 0,
})

// Get therapy sessions
const sessions = await analyticsService.getEvents({
  type: EventType.THERAPY_SESSION,
  startTime: weekStart,
  endTime: weekEnd,
})
```

### Retrieving Metrics

```typescript
// Get API response times
const responseTimes = await analyticsService.getMetrics({
  name: 'api_response_time',
  startTime: dayStart,
  endTime: dayEnd,
  tags: {
    endpoint: '/api/therapy/session',
  },
})

// Get user metrics
const userMetrics = await analyticsService.getMetrics({
  name: 'active_users',
  tags: {
    type: 'daily',
  },
})
```

### WebSocket Integration

```typescript

// In your client code:
const ws = new WebSocket('ws://localhost:8083')

// Authenticate
ws.send(
  JSON.stringify({
    type: 'authenticate',
    userId: 'user-123',
  }),
)

// Listen for events
ws.on('message', (data) => {
  const message = JSON.parse(data.toString())
  if (message.type === 'analytics_event') {
    console.log('New event:', message.event)
  }
})
```

## Configuration

### Environment Variables

```bash
# WebSocket server port
ANALYTICS_WS_PORT=8083

# Redis configuration
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=analytics:
```

### Event Types

```typescript
enum EventType {
  PAGE_VIEW = 'page_view',
  USER_ACTION = 'user_action',
  THERAPY_SESSION = 'therapy_session',
  NOTIFICATION = 'notification',
  ERROR = 'error',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  CUSTOM = 'custom',
}
```

### Event Priorities

```typescript
enum EventPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}
```

## Data Storage

The service uses Redis for data storage and queuing:

1. **Event Queue**
   - `analytics:events:queue` - Main queue for pending events
   - `analytics:events:processed:{type}` - Processed events by type
   - `analytics:events:time:{type}` - Time series data for events

2. **Metrics Storage**
   - `analytics:metrics:{name}` - Time series data for metrics
   - `analytics:metrics:tags:{name}` - Tags for metric filtering

## Security

1. **HIPAA Compliance**
   - All data is stored in a HIPAA-compliant manner
   - PII is properly handled and protected
   - Access is controlled and audited

2. **Authentication**
   - WebSocket connections require authentication
   - Real-time updates are user-scoped
   - Invalid connections are automatically closed

3. **Data Protection**
   - Event data is validated and sanitized
   - Metric values are type-checked
   - Error handling prevents data leaks

## Best Practices

1. **Event Tracking**
   - Use appropriate event types
   - Set meaningful priorities
   - Include relevant properties
   - Add helpful metadata

2. **Metric Collection**
   - Use consistent metric names
   - Add relevant tags
   - Track trends over time
   - Monitor system health

3. **Real-time Updates**
   - Handle WebSocket reconnection
   - Implement error handling
   - Process updates efficiently
   - Manage connection state

## Worker Process

Run the analytics worker:

```bash
# Production mode
pnpm worker:analytics

# Development mode with file watching
pnpm worker:analytics:dev
```

The worker process handles:

- Event processing
- WebSocket server
- Data cleanup
- Error recovery

## Testing

Run the test suite:

```bash
# Run all analytics tests
pnpm test src/lib/services/analytics/__tests__

# Run specific test file
pnpm test src/lib/services/analytics/__tests__/AnalyticsService.test.ts
```

## Monitoring

Monitor the analytics system using:

1. **Queue Statistics**
   - Queue length
   - Processing rate
   - Error rate
   - Processing time

2. **WebSocket Statistics**
   - Connected clients
   - Message rate
   - Error rate
   - Authentication failures

3. **System Health**
   - Memory usage
   - Redis connection
   - Worker status
   - Cleanup status

## Troubleshooting

Common issues and solutions:

1. **Event Processing Issues**
   - Check Redis connection
   - Verify worker is running
   - Monitor queue length
   - Check error logs

2. **WebSocket Issues**
   - Verify port configuration
   - Check authentication
   - Monitor connections
   - Review client code

3. **Performance Issues**
   - Optimize batch size
   - Adjust intervals
   - Monitor memory
   - Check Redis performance

## API Reference

### AnalyticsService

```typescript
class AnalyticsService {
  constructor(options?: {
    retentionDays?: number
    batchSize?: number
    processingInterval?: number
  })

  // Event operations
  async trackEvent(data: EventData): Promise<string>
  async getEvents(options: {
    type: EventType
    startTime?: number
    endTime?: number
    limit?: number
    offset?: number
  }): Promise<Event[]>

  // Metric operations
  async trackMetric(data: Metric): Promise<void>
  async getMetrics(options: {
    name: string
    startTime?: number
    endTime?: number
    tags?: Record<string, string>
  }): Promise<Metric[]>

  // WebSocket operations
  registerClient(userId: string, ws: WebSocket): void
  unregisterClient(userId: string): void

  // Maintenance operations
  async processEvents(): Promise<void>
  async cleanup(): Promise<void>
}
```

## Future Enhancements

Planned improvements for future releases:

1. **Advanced Analytics**
   - Machine learning integration
   - Predictive analytics
   - Pattern detection
   - Anomaly detection

2. **Enhanced Features**
   - Custom metric aggregations
   - Advanced filtering
   - Bulk operations
   - Data export

3. **Performance Improvements**
   - Horizontal scaling
   - Caching layer
   - Load balancing
   - Performance monitoring
