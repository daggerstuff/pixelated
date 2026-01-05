---
title: 'Breach Notification API'
description: 'API documentation for the breach notification system'
pubDate: 2025-03-25
share: true
toc: true
lastModDate: 2025-03-25
tags: ['api', 'security', 'breach-notification']
author: 'Pixelated Team'
---

# Breach Notification API Reference

## Overview

The Breach Notification API provides programmatic access to our HIPAA-compliant security breach notification system. This API allows you to report security breaches, manage notifications, and monitor breach status.

## Authentication

All API requests must include an API key in the Authorization header:

```bash
Authorization: Bearer your-api-key
```

API keys can be generated in the Security Dashboard under API Management.

## Rate Limits

- Standard tier: 100 requests per minute
- Enterprise tier: 1000 requests per minute
- Burst limit: 2x standard rate for 30 seconds

## Endpoints

### Breach Management

#### Report New Breach

```http
POST /api/security/breaches
```

Reports a new security breach and initiates the notification process.

**Request Body:**

```json
{
  "type": "unauthorized_access",
  "severity": "high",
  "description": "Unauthorized access detected in patient records",
  "affectedUsers": ["user_id_1", "user_id_2"],
  "affectedData": ["personal_info", "medical_records"],
  "detectionMethod": "system_monitoring",
  "remediation": "Access revoked and passwords reset"
}
```

**Parameters:**

| Name            | Type     | Required | Description                                                                      |
| --------------- | -------- | -------- | -------------------------------------------------------------------------------- |
| type            | string   | Yes      | Type of breach: 'unauthorized_access', 'data_leak', 'system_compromise', 'other' |
| severity        | string   | Yes      | Severity level: 'low', 'medium', 'high', 'critical'                              |
| description     | string   | Yes      | Detailed description of the breach                                               |
| affectedUsers   | string[] | Yes      | Array of affected user IDs                                                       |
| affectedData    | string[] | Yes      | Array of affected data types                                                     |
| detectionMethod | string   | Yes      | Method used to detect the breach                                                 |
| remediation     | string   | Yes      | Actions taken to address the breach                                              |

**Response:**

```json
{
  "id": "breach_1234567890",
  "timestamp": 1648675200000,
  "status": "pending",
  "notificationStatus": "pending"
}
```

#### Get Breach Status

```http
GET /api/security/breaches/{breachId}
```

Retrieves the current status of a specific breach.

**Parameters:**

| Name     | Type   | Location | Required | Description              |
| -------- | ------ | -------- | -------- | ------------------------ |
| breachId | string | path     | Yes      | Unique breach identifier |

**Response:**

```json
{
  "id": "breach_1234567890",
  "type": "unauthorized_access",
  "severity": "high",
  "description": "Unauthorized access detected in patient records",
  "timestamp": 1648675200000,
  "status": "active",
  "notificationStatus": "completed",
  "affectedUsers": {
    "total": 100,
    "notified": 98,
    "pending": 2,
    "failed": 0
  },
  "timeline": [
    {
      "timestamp": 1648675200000,
      "event": "breach_reported",
      "details": "Initial breach report received"
    },
    {
      "timestamp": 1648675260000,
      "event": "notifications_started",
      "details": "Notification process initiated"
    }
  ]
}
```

#### List Recent Breaches

```http
GET /api/security/breaches
```

Retrieves a list of recent breaches with optional filtering.

**Query Parameters:**

| Name     | Type   | Required | Description                             |
| -------- | ------ | -------- | --------------------------------------- |
| from     | string | No       | Start date (ISO 8601)                   |
| to       | string | No       | End date (ISO 8601)                     |
| severity | string | No       | Filter by severity                      |
| type     | string | No       | Filter by breach type                   |
| status   | string | No       | Filter by status                        |
| limit    | number | No       | Maximum number of results (default: 50) |
| offset   | number | No       | Pagination offset (default: 0)          |

**Response:**

```json
{
  "breaches": [
    {
      "id": "breach_1234567890",
      "type": "unauthorized_access",
      "severity": "high",
      "timestamp": 1648675200000,
      "status": "active",
      "notificationStatus": "completed",
      "affectedUsers": {
        "total": 100,
        "notified": 98
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### Notification Management

#### Get Notification Status

```http
GET /api/security/breaches/{breachId}/notifications
```

Retrieves detailed notification status for a specific breach.

**Parameters:**

| Name     | Type   | Location | Required | Description              |
| -------- | ------ | -------- | -------- | ------------------------ |
| breachId | string | path     | Yes      | Unique breach identifier |

**Response:**

```json
{
  "breachId": "breach_1234567890",
  "totalNotifications": 100,
  "deliveredNotifications": 98,
  "pendingNotifications": 2,
  "failedNotifications": 0,
  "channels": {
    "email": {
      "sent": 100,
      "delivered": 98,
      "opened": 75
    },
    "sms": {
      "sent": 50,
      "delivered": 48
    },
    "inApp": {
      "sent": 100,
      "viewed": 60
    }
  },
  "timeline": [
    {
      "timestamp": 1648675200000,
      "channel": "email",
      "event": "notification_sent",
      "recipients": 100
    }
  ]
}
```

#### Update Notification Preferences

```http
PUT /api/security/users/{userId}/notification-preferences
```

Updates notification preferences for a specific user.

**Request Body:**

```json
{
  "channels": {
    "email": true,
    "sms": true,
    "inApp": true,
    "push": false
  },
  "frequency": "immediate",
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "07:00",
    "timezone": "America/New_York"
  },
  "categories": {
    "security": true,
    "system": false,
    "policy": true
  }
}
```

**Response:**

```json
{
  "userId": "user_123",
  "preferences": {
    "channels": {
      "email": true,
      "sms": true,
      "inApp": true,
      "push": false
    },
    "frequency": "immediate",
    "quietHours": {
      "enabled": true,
      "start": "22:00",
      "end": "07:00",
      "timezone": "America/New_York"
    },
    "categories": {
      "security": true,
      "system": false,
      "policy": true
    }
  },
  "updatedAt": 1648675200000
}
```

### Analytics

#### Get Breach Analytics

```http
GET /api/security/analytics/breaches
```

Retrieves analytics data for breaches.

**Query Parameters:**

| Name    | Type     | Required | Description                              |
| ------- | -------- | -------- | ---------------------------------------- |
| from    | string   | No       | Start date (ISO 8601)                    |
| to      | string   | No       | End date (ISO 8601)                      |
| groupBy | string   | No       | Group results by: 'day', 'week', 'month' |
| metrics | string[] | No       | Specific metrics to include              |

**Response:**

```json
{
  "timeframe": {
    "from": "2025-01-01T00:00:00Z",
    "to": "2025-03-31T23:59:59Z"
  },
  "summary": {
    "totalBreaches": 150,
    "bySeverity": {
      "low": 50,
      "medium": 60,
      "high": 30,
      "critical": 10
    },
    "byType": {
      "unauthorized_access": 70,
      "data_leak": 40,
      "system_compromise": 25,
      "other": 15
    },
    "averageResponseTime": 3600,
    "notificationEffectiveness": 0.98
  },
  "trends": [
    {
      "timestamp": "2025-01-01T00:00:00Z",
      "breaches": 12,
      "affectedUsers": 150,
      "notificationRate": 0.99
    }
  ]
}
```

## Webhooks

### Webhook Events

Subscribe to real-time updates by configuring webhooks in the Security Dashboard.

Available events:

- `breach.created`
- `breach.updated`
- `notification.sent`
- `notification.delivered`
- `notification.failed`

### Webhook Payload

```json
{
  "id": "evt_123456",
  "type": "breach.created",
  "timestamp": 1648675200000,
  "data": {
    "breachId": "breach_1234567890",
    "type": "unauthorized_access",
    "severity": "high",
    "affectedUsers": 100
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Invalid breach type provided",
    "details": {
      "field": "type",
      "value": "invalid_type",
      "allowedValues": [
        "unauthorized_access",
        "data_leak",
        "system_compromise",
        "other"
      ]
    }
  }
}
```

### Common Error Codes

| Code                  | Description                |
| --------------------- | -------------------------- |
| invalid_request       | Invalid request parameters |
| authentication_failed | Invalid or missing API key |
| rate_limit_exceeded   | Too many requests          |
| not_found             | Resource not found         |
| internal_error        | Internal server error      |

## SDK Support

Official SDKs are available for:

- JavaScript/TypeScript
- Python
- Java
- C#
- Go
- Ruby

Example using TypeScript SDK:

```typescript

const client = new BreachNotificationClient('your-api-key')

async function reportBreach() {
  const breach = await client.breaches.create({
    type: 'unauthorized_access',
    severity: 'high',
    description: 'Unauthorized access detected',
    affectedUsers: ['user_1', 'user_2'],
    affectedData: ['personal_info'],
    detectionMethod: 'system_monitoring',
    remediation: 'Access revoked',
  })

  console.log('Breach reported:', breach.id)
}
```

## Best Practices

1. Error Handling
   - Implement proper error handling
   - Retry failed requests with exponential backoff
   - Log all API errors for debugging

2. Rate Limiting
   - Monitor rate limit headers
   - Implement rate limiting in your client
   - Use bulk operations when possible

3. Security
   - Store API keys securely
   - Use HTTPS for all requests
   - Validate webhook signatures
   - Implement proper access controls

4. Performance
   - Cache responses when appropriate
   - Use pagination for large datasets
   - Implement request timeouts
   - Monitor API response times

## Support

For API support:

- Email: api-support@example.com
- Documentation: https://docs.example.com/api
- Status page: https://status.example.com
