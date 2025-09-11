# Therapist Dashboard API Documentation

## Overview

The Therapist Dashboard API provides RESTful endpoints for managing therapist session progress tracking, analytics data storage, and performance metrics collection. Built with enterprise-grade security and scalability in mind, the API supports real-time progress monitoring and comprehensive analytics for therapist training sessions.

## Base URL

```
/api/session
```

## Authentication

All API endpoints require JWT-based authentication with valid therapist credentials. Requests must include an `Authorization` header with a valid bearer token.

```http
Authorization: Bearer <jwt-token>
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse and ensure fair usage:
- **100 requests per minute** for authenticated users
- **1000 requests per hour** for authenticated users
- Excessive requests will return `429 Too Many Requests`

## Error Handling

All API endpoints follow consistent error response format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Error details"
  }
}
```

### Common HTTP Status Codes

- `200 OK` - Successful request
- `201 Created` - Resource successfully created
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server-side error

## Endpoints

### Progress Metrics (`/api/session/progress`)

#### POST `/api/session/progress`
**Store session progress metrics and evaluation feedback**

**Request Body:**
```json
{
  "sessionId": "string",
  "progressMetrics": {
    "totalMessages": 42,
    "therapistMessages": 21,
    "clientMessages": 21,
    "sessionDuration": 3600,
    "activeTime": 3000,
    "skillScores": {
      "Active Listening": 85,
      "Empathy": 78
    },
    "responseTime": 2.5,
    "conversationFlow": 88,
    "milestonesReached": ["introduction", "exploration"]
  },
  "therapistId": "string",
  "evaluationFeedback": "string"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "string"
}
```

**Status Codes:**
- `200 OK` - Progress metrics stored successfully
- `400 Bad Request` - Missing required fields
- `404 Not Found` - Session not found
- `500 Internal Server Error` - Database error

#### GET `/api/session/progress`
**Retrieve session progress data and metrics**

**Query Parameters:**
- `sessionId` (required) - Session ID to retrieve
- `includeFeedback` (optional) - Include evaluation feedback in response

**Response:**
```json
{
  "sessionId": "string",
  "progressMetrics": {
    "totalMessages": 42,
    "therapistMessages": 21,
    "clientMessages": 21,
    "sessionDuration": 3600,
    "activeTime": 3000,
    "skillScores": {
      "Active Listening": 85,
      "Empathy": 78
    },
    "responseTime": 2.5,
    "conversationFlow": 88,
    "milestonesReached": ["introduction", "exploration"]
  },
  "feedback": [
    {
      "therapistId": "string",
      "feedback": "string",
      "createdAt": "ISO timestamp"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Progress data retrieved successfully
- `400 Bad Request` - Missing sessionId parameter
- `404 Not Found` - Session not found
- `500 Internal Server Error` - Database error

### Progress Snapshots (`/api/session/snapshots`)

#### POST `/api/session/snapshots`
**Store session progress snapshots and milestone data**

**Request Body:**
```json
{
  "sessionId": "string",
  "snapshots": [
    {
      "timestamp": "ISO timestamp",
      "value": 25
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "string"
}
```

**Status Codes:**
- `200 OK` - Snapshots stored successfully
- `400 Bad Request` - Missing required fields
- `404 Not Found` - Session not found
- `500 Internal Server Error` - Database error

#### GET `/api/session/snapshots`
**Retrieve session progress snapshots**

**Query Parameters:**
- `sessionId` (required) - Session ID to retrieve snapshots for

**Response:**
```json
{
  "sessionId": "string",
  "snapshots": [
    {
      "timestamp": "ISO timestamp",
      "value": 25
    }
  ],
  "milestones": [
    {
      "milestoneName": "string",
      "milestoneValue": 50,
      "achievedAt": "ISO timestamp",
      "metadata": {}
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Snapshots retrieved successfully
- `400 Bad Request` - Missing sessionId parameter
- `404 Not Found` - Session not found
- `500 Internal Server Error` - Database error

### Skill Scores (`/api/session/skills`)

#### POST `/api/session/skills`
**Store session skill scores and development data**

**Request Body:**
```json
{
  "sessionId": "string",
  "therapistId": "string",
  "skillScores": {
    "Active Listening": 85,
    "Empathy": 78
  }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "string",
  "therapistId": "string"
}
```

**Status Codes:**
- `200 OK` - Skill scores stored successfully
- `400 Bad Request` - Missing required fields
- `404 Not Found` - Session not found
- `500 Internal Server Error` - Database error

#### GET `/api/session/skills`
**Retrieve therapist skill development data**

**Query Parameters:**
- `sessionId` (optional) - Specific session ID
- `therapistId` (optional) - Specific therapist ID

**Response:**
```json
{
  "sessionId": "string",
  "therapistId": "string",
  "skills": [
    {
      "skillName": "string",
      "skillCategory": "therapeutic",
      "currentScore": 85,
      "practiceSessions": 5,
      "lastPracticed": "ISO timestamp",
      "createdAt": "ISO timestamp"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Skill data retrieved successfully
- `400 Bad Request` - Missing sessionId or therapistId parameter
- `404 Not Found` - Session or therapist not found
- `500 Internal Server Error` - Database error

### Analytics Data (`/api/session/analytics`)

#### POST `/api/session/analytics`
**Store session analytics data**

**Request Body:**
```json
{
  "sessionId": "string",
  "analyticsData": {
    "sessionMetrics": [
      {
        "date": "2025-01-01",
        "sessions": 1,
        "therapistSessions": 1,
        "averageSessionProgress": 85,
        "sessionId": "string",
        "therapistId": "string",
        "milestonesAchieved": 2,
        "averageResponseTime": 2.5
      }
    ],
    "skillProgress": [
      {
        "skill": "Active Listening",
        "skillId": "active-listening",
        "score": 85,
        "trend": "up",
        "category": "therapeutic",
        "sessionsPracticed": 5,
        "averageImprovement": 12
      }
    ],
    "summaryStats": [
      {
        "value": 1,
        "label": "Total Sessions",
        "therapistId": "string",
        "trend": {
          "value": 1,
          "direction": "up",
          "period": "recent"
        },
        "color": "blue"
      }
    ],
    "progressSnapshots": [
      {
        "timestamp": "ISO timestamp",
        "value": 25
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "string"
}
```

**Status Codes:**
- `200 OK` - Analytics data stored successfully
- `400 Bad Request` - Missing required fields
- `404 Not Found` - Session not found
- `500 Internal Server Error` - Database error

#### GET `/api/session/analytics`
**Retrieve session analytics data**

**Query Parameters:**
- `sessionId` (required) - Session ID to retrieve analytics for
- `timeRange` (optional) - Time range filter (7d, 30d, 90d, 1y)

**Response:**
```json
{
  "sessionId": "string",
  "analyticsData": {
    "sessionMetrics": [
      {
        "date": "2025-01-01",
        "sessions": 1,
        "therapistSessions": 1,
        "averageSessionProgress": 85,
        "sessionId": "string",
        "therapistId": "string",
        "milestonesAchieved": 2,
        "averageResponseTime": 2.5
      }
    ],
    "skillProgress": [
      {
        "skill": "Active Listening",
        "skillId": "active-listening",
        "score": 85,
        "trend": "up",
        "category": "therapeutic",
        "sessionsPracticed": 5,
        "averageImprovement": 12
      }
    ],
    "summaryStats": [
      {
        "value": 1,
        "label": "Total Sessions",
        "therapistId": "string",
        "trend": {
          "value": 1,
          "direction": "up",
          "period": "recent"
        },
        "color": "blue"
      }
    ],
    "progressSnapshots": [
      {
        "timestamp": "ISO timestamp",
        "value": 25
      }
    ]
  }
}
```

**Status Codes:**
- `200 OK` - Analytics data retrieved successfully
- `400 Bad Request` - Missing sessionId parameter
- `404 Not Found` - Session not found
- `500 Internal Server Error` - Database error

### Session Comparison (`/api/session/comparison`)

#### POST `/api/session/comparison`
**Store session comparison analysis data**

**Request Body:**
```json
{
  "therapistId": "string",
  "currentSessionId": "string",
  "previousSessionId": "string",
  "improvementScore": 85,
  "metrics": {
    "progressImprovement": 10,
    "skillScoreImprovement": 5,
    "responseTimeImprovement": 0.5
  }
}
```

**Response:**
```json
{
  "success": true,
  "comparisonId": "string",
  "therapistId": "string",
  "currentSessionId": "string"
}
```

**Status Codes:**
- `201 Created` - Comparison data stored successfully
- `400 Bad Request` - Missing required fields
- `500 Internal Server Error` - Database error

#### GET `/api/session/comparison`
**Retrieve session comparison analysis data**

**Query Parameters:**
- `therapistId` (optional) - Filter by therapist ID
- `sessionId` (optional) - Specific session ID
- `timeRange` (optional) - Time range filter (7d, 30d, 90d, 1y)

**Response:**
```json
{
  "therapistId": "string",
  "sessionId": "string",
  "comparisons": [
    {
      "id": "string",
      "therapistId": "string",
      "currentSessionId": "string",
      "previousSessionId": "string",
      "improvementScore": 85,
      "metrics": {
        "progressImprovement": 10,
        "skillScoreImprovement": 5,
        "responseTimeImprovement": 0.5
      },
      "analyzedAt": "ISO timestamp",
      "currentSessionStartedAt": "ISO timestamp",
      "previousSessionStartedAt": "ISO timestamp",
      "trend": "improving"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Comparison data retrieved successfully
- `400 Bad Request` - Missing therapistId or sessionId parameter
- `500 Internal Server Error` - Database error

### Evaluation Feedback (`/api/evaluation`)

#### POST `/api/evaluation`
**Store evaluation feedback data**

**Request Body:**
```json
{
  "sessionId": "string",
  "feedback": "string",
  "evaluatorId": "string",
  "rating": 5,
  "comments": "string"
}
```

**Response:**
```json
{
  "success": true,
  "evaluationId": "string"
}
```

**Status Codes:**
- `201 Created` - Evaluation feedback stored successfully
- `400 Bad Request` - Missing required fields
- `500 Internal Server Error` - Database error

#### GET `/api/evaluation`
**Retrieve evaluation feedback data**

**Query Parameters:**
- `sessionId` (required) - Session ID to retrieve feedback for

**Response:**
```json
{
  "sessionId": "string",
  "evaluations": [
    {
      "id": "string",
      "feedback": "string",
      "evaluatorId": "string",
      "rating": 5,
      "comments": "string",
      "createdAt": "ISO timestamp"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Evaluation feedback retrieved successfully
- `400 Bad Request` - Missing sessionId parameter
- `404 Not Found` - Session not found
- `500 Internal Server Error` - Database error

## Data Models

### Session Progress Metrics
```typescript
interface SessionProgressMetrics {
  totalMessages: number;
  therapistMessages: number;
  clientMessages: number;
  sessionDuration: number; // in seconds
  activeTime: number; // in seconds
  skillScores: Record<string, number>; // skill name -> score (0-100)
  responseTime: number; // average response time in seconds
  conversationFlow: number; // conversation quality score (0-100)
  milestonesReached: string[]; // milestone identifiers
  lastMilestoneTime?: string; // ISO timestamp
}
```

### Therapist Session
```typescript
interface TherapistSession {
  id: string;
  clientId: string;
  therapistId: string;
  startTime: string; // ISO timestamp
  endTime?: string; // ISO timestamp
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  progress: number; // 0-100
  progressSnapshots?: Array<{ timestamp: string; value: number }>;
  analyticsData?: AnalyticsChartData;
  sessionMetrics?: SessionData[];
  progressMetrics?: SessionProgressMetrics;
}
```

### Analytics Chart Data
```typescript
interface TherapistAnalyticsChartData {
  sessionMetrics: TherapistSessionData[];
  skillProgress: TherapistSkillProgressData[];
  summaryStats: TherapistMetricSummary[];
  progressSnapshots?: Array<{ timestamp: string; value: number }>;
  comparativeData?: {
    currentSession: TherapistSessionData;
    previousSession?: TherapistSessionData;
    trend: 'improving' | 'declining' | 'stable';
  };
}
```

## Security Considerations

### Data Encryption
- All data is encrypted at rest using AES-256 encryption
- All data is encrypted in transit using TLS 1.3
- Sensitive fields are hashed using bcrypt with salt

### Input Validation
- All API inputs are validated using Zod schemas
- SQL injection prevention through parameterized queries
- XSS prevention through input sanitization
- CSRF protection through token validation

### Access Control
- Role-based access control (RBAC) implementation
- Session-based authentication with JWT tokens
- Permission validation for each API endpoint
- Audit logging for all API access

## Performance Optimization

### Database Indexing
- Primary key indexing on session IDs
- Composite indexing on therapist ID and timestamp
- Full-text search indexing for feedback data
- Spatial indexing for geographic data

### Caching Strategy
- Redis caching for frequently accessed session data
- In-memory caching for analytics data
- CDN caching for static assets
- HTTP caching headers for API responses

### Query Optimization
- Efficient SQL query construction
- Database connection pooling
- Query result pagination
- Asynchronous data processing

## Monitoring and Logging

### Application Logging
- Structured JSON logging for all API requests
- Error logging with stack traces
- Performance monitoring with timing data
- Security event logging with audit trails

### Metrics Collection
- API request/response time monitoring
- Database query performance tracking
- System resource utilization monitoring
- User activity and engagement tracking

### Alerting System
- Real-time alerting for system errors
- Performance degradation notifications
- Security incident alerts
- Business metric threshold alerts

## Testing and Quality Assurance

### API Testing
- Unit tests for all endpoint handlers
- Integration tests for database operations
- Load testing with realistic traffic patterns
- Security testing with penetration testing tools

### Data Validation
- Schema validation for all API inputs
- Data integrity checks for database operations
- Cross-field validation for business rules
- Data migration testing for schema changes

### Performance Testing
- Load testing with concurrent users
- Stress testing with peak traffic scenarios
- Soak testing for long-running stability
- Chaos engineering for system resilience

## Deployment and Operations

### CI/CD Pipeline
- Automated testing on every code commit
- Staging environment deployment for QA
- Production deployment with rollback capability
- Blue-green deployment strategy for zero downtime

### Infrastructure
- Containerized deployment with Docker
- Kubernetes orchestration for scaling
- Load balancing with NGINX
- Database replication for high availability

### Backup and Recovery
- Daily database backups with retention policy
- Point-in-time recovery for data restoration
- Cross-region backup replication
- Automated backup validation and testing

## Support and Maintenance

### Documentation
- Comprehensive API documentation with examples
- Developer guides for integration
- Troubleshooting guides for common issues
- Release notes for version updates

### Incident Response
- 24/7 monitoring and alerting
- Escalation procedures for critical issues
- Post-mortem analysis for incidents
- Continuous improvement of reliability

### Version Management
- Semantic versioning for API releases
- Backward compatibility guarantees
- Deprecation notices for legacy features
- Migration guides for breaking changes
