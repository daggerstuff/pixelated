---
title: 'Security Audit API'
description: 'API documentation for security audit logging and monitoring'
pubDate: '2025-01-01'
author: 'Pixelated Empathy Team'
draft: false
toc: true
share: true
---

# Security Audit API

The Security Audit API provides endpoints for retrieving and analyzing security-related events in the system.

## Authentication

All audit endpoints require authentication and the 'audit' role. Include your JWT token in the Authorization header:

```bash
Authorization: Bearer your-jwt-token
```

## Rate Limiting

Audit endpoints have a specific rate limit:

- 100 requests per 15 minutes per IP address
- Rate limit headers are included in responses

## Endpoints

### Get Audit Logs

Retrieve audit logs with optional filters.

```http
GET /api/audit/logs
```

#### Query Parameters

| Parameter    | Type   | Description                                  |
| ------------ | ------ | -------------------------------------------- |
| startTime    | string | Start time in ISO format (required)          |
| endTime      | string | End time in ISO format (required)            |
| eventType    | string | Filter by event type                         |
| userId       | string | Filter by user ID                            |
| sessionId    | string | Filter by session ID                         |
| resourceType | string | Filter by resource type                      |
| status       | string | Filter by status ('success' or 'failure')    |
| severity     | string | Filter by severity ('LOW', 'MEDIUM', 'HIGH') |

#### Response

```json
[
  {
    "id": "uuid",
    "eventType": "AUTH_SUCCESS",
    "userId": "user-uuid",
    "resourceType": "security",
    "resourceId": "resource-uuid",
    "action": "AUTH_SUCCESS",
    "status": "success",
    "details": {
      "method": "password",
      "ip": "127.0.0.1",
      "userAgent": "Mozilla/5.0..."
    },
    "metadata": {
      "timestamp": "2024-03-05T12:00:00Z"
    },
    "createdAt": "2024-03-05T12:00:00Z"
  }
]
```

### Get Security Metrics

Retrieve aggregated security metrics for a time period.

```http
GET /api/audit/metrics
```

#### Query Parameters

| Parameter | Type   | Description                                           |
| --------- | ------ | ----------------------------------------------------- |
| startTime | string | Start time in ISO format (required)                   |
| endTime   | string | End time in ISO format (required)                     |
| interval  | string | Time bucket interval ('hour', 'day', 'week', 'month') |

#### Response

```json
[
  {
    "time_bucket": "2024-03-05T12:00:00Z",
    "total_events": 100,
    "failure_events": 5,
    "auth_successes": 80,
    "auth_failures": 3,
    "security_alerts": 2,
    "rate_limit_events": 10,
    "session_events": 20,
    "data_access_events": 15
  }
]
```

### Get Security Alerts

Retrieve recent security alerts.

```http
GET /api/audit/alerts
```

#### Response

```json
[
  {
    "id": "uuid",
    "eventType": "SECURITY_ALERT",
    "details": {
      "type": "SUSPICIOUS_ACTIVITY",
      "severity": "HIGH",
      "ip": "127.0.0.1",
      "reason": "Multiple failed login attempts"
    },
    "metadata": {
      "timestamp": "2024-03-05T12:00:00Z"
    },
    "createdAt": "2024-03-05T12:00:00Z"
  }
]
```

### Get Rate Limit Events

Retrieve rate limit events for an IP or user.

```http
GET /api/audit/rate-limits
```

#### Query Parameters

| Parameter | Type   | Description                        |
| --------- | ------ | ---------------------------------- |
| ip        | string | IP address to filter by (optional) |
| userId    | string | User ID to filter by (optional)    |

Note: Either `ip` or `userId` must be provided.

#### Response

```json
[
  {
    "id": "uuid",
    "eventType": "RATE_LIMIT",
    "details": {
      "ip": "127.0.0.1",
      "endpoint": "/api/resource",
      "status": "exceeded",
      "limit": 100,
      "windowMs": 900000
    },
    "metadata": {
      "timestamp": "2024-03-05T12:00:00Z"
    },
    "createdAt": "2024-03-05T12:00:00Z"
  }
]
```

## Event Types

The system logs the following types of events:

### Authentication Events

- `AUTH_SUCCESS`: Successful authentication
- `AUTH_FAILURE`: Failed authentication attempt
- `USER_SIGNUP_SUCCESS`: Successful user registration
- `USER_SIGNUP_FAILED`: Failed user registration

### Session Events

- `SESSION_CREATED`: New session created
- `SESSION_UPDATED`: Session updated
- `SESSION_DELETED`: Session deleted
- `SESSION_CREATE_FAILED`: Failed to create session
- `SESSION_UPDATE_FAILED`: Failed to update session
- `SESSION_DELETE_FAILED`: Failed to delete session

### Security Events

- `SECURITY_ALERT`: Security-related alert
- `RATE_LIMIT`: Rate limit exceeded
- `IP_MARKED_SUSPICIOUS`: IP added to suspicious list
- `IP_BLACKLISTED`: IP blacklisted
- `IP_TEMPORARILY_BLOCKED`: IP temporarily blocked

### Data Access Events

- `DATA_ACCESS`: Data access event

## Error Responses

### 400 Bad Request

```json
{
  "error": "Invalid query parameters",
  "details": [
    {
      "code": "invalid_string",
      "path": ["startTime"],
      "message": "Invalid datetime string"
    }
  ]
}
```

### 401 Unauthorized

```json
{
  "error": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "error": "Insufficient permissions"
}
```

### 429 Too Many Requests

```json
{
  "error": "Too many audit log requests from this IP, please try again later."
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```
