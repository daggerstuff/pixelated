---
title: 'Notification Service'
description: 'Documentation for Pixelated Healths notification system and real-time alerts'
pubDate: 2025-03-27
share: true
toc: true
lastModDate: 2025-03-27
tags: ['notifications', 'services', 'real-time']
author: 'Pixelated Team'
---

## Notification Service

### Overview

The Notification Service provides a robust, real-time notification system that supports multiple
delivery channels and ensures reliable message delivery. Built with TypeScript and WebSocket technology,
it offers a scalable solution for handling notifications across the application.

### Features

- Multi-channel delivery (in-app, email, push notifications)
- Real-time notifications via WebSocket
- Template-based notification system
- Redis-based queue for reliable delivery
- User preference management
- Delivery status tracking
- Comprehensive error handling
- HIPAA-compliant data handling

### Usage

### Initializing the Service

```typescript

const notificationService = new NotificationService()
```

### Registering Notification Templates

```typescript
await notificationService.registerTemplate({
  id: 'appointment-reminder',
  title: 'Upcoming Appointment',
  body: 'You have an appointment with {{therapistName}} on {{date}} at {{time}}',
  channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  priority: NotificationPriority.NORMAL,
})
```

### Queuing a Notification

```typescript
const notificationId = await notificationService.queueNotification({
  userId: 'user-123',
  templateId: 'appointment-reminder',
  data: {
    therapistName: 'Dr. Smith',
    date: '2025-03-15',
    time: '2:00 PM',
  },
})
```

### Handling WebSocket Connections

```typescript

const wss = new WebSocketServer({ port: 8082 }, notificationService)

// In your client code:
const ws = new WebSocket('ws://localhost:8082')
ws.send(
  JSON.stringify({
    type: 'authenticate',
    token: 'user-auth-token',
  }),
)
```

### Marking Notifications as Read

```typescript
await notificationService.markAsRead('user-123', 'notification-456')
```

### Retrieving Notifications

```typescript
// Get all notifications for a user
const notifications = await notificationService.getNotifications('user-123')

// With pagination
const paginatedNotifications = await notificationService.getNotifications(
  'user-123',
  10,
  0,
)

// Get unread count
const unreadCount = await notificationService.getUnreadCount('user-123')
```

### Configuration

### Environment Variables

```bash
# WebSocket server port
NOTIFICATION_WS_PORT=8082

# Redis configuration
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=notification:

# Email configuration (for email notifications)
EMAIL_FROM_ADDRESS=notifications@yourdomain.com
$1=YOUR_API_KEY_HERE
```

### Queue System

The notification service uses Redis for reliable message queuing:

- `notification:queue` - Main queue for pending notifications
- `notification:processing` - Queue for notifications being processed
- `notifications:{userId}` - Hash storing user's notifications

### Message Types

```typescript
// WebSocket message types
type WebSocketMessage = {
  type: 'authenticate' | 'markAsRead' | 'getNotifications'
  token?: string
  notificationId?: string
  limit?: number
  offset?: number
}

// Server response types
type ServerResponse = {
  type: 'authenticated' | 'notification' | 'unreadCount' | 'error'
  data?: any
  error?: string
}
```

### Error Handling

The service implements comprehensive error handling:

1. **Queue Processing Errors**
   - Failed notifications are marked with error status
   - Automatic retry with exponential backoff
   - Error logging with stack traces

2. **WebSocket Errors**
   - Connection error handling
   - Authentication failure handling
   - Message parsing errors
   - Client disconnection handling

3. **Template Errors**
   - Template validation
   - Missing template handling
   - Template rendering errors

### Security

1. **Authentication**
   - WebSocket connections require valid authentication token
   - Token verification on every message
   - Automatic client disconnection on auth failure

2. **Data Protection**
   - HIPAA-compliant data handling
   - Encrypted WebSocket connections
   - PII detection and redaction in notifications

3. **Rate Limiting**
   - Connection rate limiting
   - Message rate limiting per client
   - Queue processing rate control

### Best Practices

1. **Template Management**
   - Register templates at application startup
   - Use semantic template IDs
   - Include all required placeholders in templates
   - Validate template data before queuing

2. **Queue Management**
   - Monitor queue length
   - Set appropriate processing intervals
   - Implement proper error handling
   - Use appropriate priority levels

3. **WebSocket Usage**
   - Implement reconnection logic in clients
   - Handle connection errors gracefully
   - Use appropriate message types
   - Validate message data

### Testing

Run the test suite:

```bash
# Run all notification service tests
pnpm test src/lib/services/notification/__tests__

# Run specific test file
pnpm test src/lib/services/notification/__tests__/NotificationService.test.ts
```

### Monitoring

Monitor the notification system using the following metrics:

1. **Queue Statistics**
   - Queue length
   - Processing rate
   - Error rate
   - Average processing time

2. **WebSocket Statistics**
   - Connected clients count
   - Message rate
   - Error rate
   - Authentication failures

3. **Delivery Statistics**
   - Delivery success rate
   - Channel-specific metrics
   - Template usage statistics
   - User engagement metrics

### Troubleshooting

Common issues and solutions:

1. **Queue Processing Issues**
   - Check Redis connection
   - Verify worker process is running
   - Check for error logs
   - Monitor queue length

2. **WebSocket Connection Issues**
   - Verify port configuration
   - Check authentication token
   - Monitor server logs
   - Check client connection code

3. **Notification Delivery Issues**
   - Check channel configuration
   - Verify template existence
   - Check user preferences
   - Monitor delivery logs

### Worker Process

Run the notification worker:

```bash
# Production mode
pnpm worker:notification

# Development mode with file watching
pnpm worker:notification:dev
```

The worker process handles:

- Queue processing
- WebSocket server management
- Real-time notification delivery
- Error recovery
- Graceful shutdown

### API Reference

### NotificationService

```typescript
class NotificationService {
  // Template management
  async registerTemplate(template: NotificationTemplate): Promise<void>

  // Notification operations
  async queueNotification(notification: NotificationData): Promise<string>
  async markAsRead(userId: string, notificationId: string): Promise<void>
  async getNotifications(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<Notification[]>
  async getUnreadCount(userId: string): Promise<number>

  // WebSocket client management
  registerClient(userId: string, ws: WebSocket): void
  unregisterClient(userId: string): void

  // Queue processing
  async processQueue(): Promise<void>
}
```

### WebSocketServer

```typescript
class WebSocketServer {
  constructor(wss: WSServer, notificationService: NotificationService)

  private async handleConnection(ws: WebSocket): Promise<void>
  private async verifyToken(token: string): Promise<string>
  private async sendUnreadCount(userId: string, ws: WebSocket): Promise<void>
  private handleError(error: Error): void
}
```

### Future Enhancements

Planned improvements for future releases:

1. **Additional Channels**
   - SMS notifications
   - Mobile push notifications
   - Desktop notifications

2. **Enhanced Features**
   - Notification categories
   - Advanced filtering
   - Bulk operations
   - Message threading

3. **Performance Improvements**
   - Horizontal scaling
   - Caching optimizations
   - Load balancing
   - Performance monitoring
