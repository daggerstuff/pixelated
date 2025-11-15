## Journal Research API Documentation

## Overview

The Journal Research API provides a comprehensive REST API for managing journal dataset research operations. The API enables you to create research sessions, discover sources, evaluate datasets, acquire data, plan integrations, track progress, and generate reports.

**Base URL**: `/api/journal-research`  
**API Version**: `1.0.0`  
**Protocol**: HTTP/HTTPS, WebSocket (for real-time updates)

## Table of Contents

- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Endpoints](#endpoints)
  - [Sessions](#sessions)
  - [Discovery](#discovery)
  - [Evaluation](#evaluation)
  - [Acquisition](#acquisition)
  - [Integration](#integration)
  - [Progress](#progress)
  - [Reports](#reports)
- [WebSocket API](#websocket-api)
- [Data Models](#data-models)

## Authentication

All API endpoints require authentication via JWT tokens. The API uses Bearer token authentication in the Authorization header.

### Authentication Flow

1. Obtain a JWT token from your authentication provider (Better Auth or Supabase Auth)
2. Include the token in the Authorization header for all requests:
   ```
   Authorization: Bearer <your-jwt-token>
   ```
3. Tokens expire after 24 hours (configurable via `JWT_EXPIRATION_MINUTES`)

### Permissions

The API uses role-based access control (RBAC). Common permissions include:

- `sessions:read` - View sessions
- `sessions:create` - Create new sessions
- `sessions:update` - Update sessions
- `sessions:delete` - Delete sessions
- `discovery:read` - View discovered sources
- `discovery:create` - Initiate discovery
- `evaluation:read` - View evaluations
- `evaluation:create` - Create evaluations
- `evaluation:update` - Update evaluations
- `acquisition:read` - View acquisitions
- `acquisition:create` - Initiate acquisition
- `acquisition:update` - Update acquisition status
- `integration:read` - View integration plans
- `integration:create` - Create integration plans
- `reports:read` - View reports
- `reports:create` - Generate reports

## Error Handling

The API uses standard HTTP status codes and returns error responses in a consistent format:

```json
{
  "detail": "Error message describing what went wrong",
  "status_code": 400,
  "error_type": "ValidationError"
}
```

### HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Error Types

- `ValidationError` - Request validation failed
- `AuthenticationError` - Authentication failed
- `AuthorizationError` - Insufficient permissions
- `NotFoundError` - Resource not found
- `RateLimitError` - Rate limit exceeded
- `InternalServerError` - Server error

## Rate Limiting

Rate limiting is enabled by default to protect the API from abuse:

- **Per minute**: 60 requests
- **Per hour**: 1000 requests

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1640995200
```

When rate limit is exceeded, a `429 Too Many Requests` response is returned.

## Endpoints

### Sessions

#### List Sessions

```http
GET /api/journal-research/sessions
```

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `page_size` (integer, default: 20) - Items per page

**Response:**
```json
{
  "items": [
    {
      "session_id": "session_123",
      "start_date": "2025-01-21T00:00:00Z",
      "target_sources": ["pubmed", "doaj"],
      "search_keywords": {
        "therapeutic": ["therapy", "counseling"]
      },
      "weekly_targets": {
        "sources_identified": 10
      },
      "current_phase": "discovery",
      "progress_metrics": {
        "sources_identified": 5
      }
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

**Permissions**: `sessions:read`

#### Create Session

```http
POST /api/journal-research/sessions
```

**Request Body:**
```json
{
  "target_sources": ["pubmed", "doaj"],
  "search_keywords": {
    "therapeutic": ["therapy", "counseling"],
    "dataset": ["dataset", "conversation"]
  },
  "weekly_targets": {
    "sources_identified": 10,
    "datasets_evaluated": 5
  },
  "session_id": "optional-custom-id"
}
```

**Response:** `201 Created`
```json
{
  "session_id": "session_123",
  "start_date": "2025-01-21T00:00:00Z",
  "target_sources": ["pubmed", "doaj"],
  "search_keywords": {
    "therapeutic": ["therapy", "counseling"]
  },
  "weekly_targets": {
    "sources_identified": 10
  },
  "current_phase": "discovery",
  "progress_metrics": {}
}
```

**Permissions**: `sessions:create`

#### Get Session

```http
GET /api/journal-research/sessions/{session_id}
```

**Response:**
```json
{
  "session_id": "session_123",
  "start_date": "2025-01-21T00:00:00Z",
  "target_sources": ["pubmed", "doaj"],
  "search_keywords": {
    "therapeutic": ["therapy", "counseling"]
  },
  "weekly_targets": {
    "sources_identified": 10
  },
  "current_phase": "discovery",
  "progress_metrics": {
    "sources_identified": 5
  }
}
```

**Permissions**: `sessions:read`

#### Update Session

```http
PUT /api/journal-research/sessions/{session_id}
```

**Request Body:**
```json
{
  "target_sources": ["pubmed", "doaj", "arxiv"],
  "current_phase": "evaluation"
}
```

**Response:** `200 OK` (same as Get Session)

**Permissions**: `sessions:update`

#### Delete Session

```http
DELETE /api/journal-research/sessions/{session_id}
```

**Response:** `204 No Content`

**Permissions**: `sessions:delete`

### Discovery

#### Initiate Discovery

```http
POST /api/journal-research/sessions/{session_id}/discovery
```

**Request Body:**
```json
{
  "sources": ["pubmed", "doaj"],
  "keywords": {
    "therapeutic": ["therapy", "counseling"]
  },
  "max_results": 100
}
```

**Response:** `202 Accepted`
```json
{
  "discovery_id": "discovery_123",
  "session_id": "session_123",
  "status": "pending",
  "started_at": "2025-01-21T10:00:00Z"
}
```

**Permissions**: `discovery:create`

#### List Discovered Sources

```http
GET /api/journal-research/sessions/{session_id}/sources
```

**Query Parameters:**
- `page` (integer, default: 1)
- `page_size` (integer, default: 20)
- `source_type` (string, optional) - Filter by source type
- `open_access` (boolean, optional) - Filter by open access status

**Response:**
```json
{
  "items": [
    {
      "source_id": "source_123",
      "title": "Therapeutic Conversation Dataset",
      "authors": ["John Doe", "Jane Smith"],
      "publication_date": "2024-01-15T00:00:00Z",
      "source_type": "journal_article",
      "url": "https://example.com/paper",
      "doi": "10.1234/example",
      "abstract": "Abstract text...",
      "keywords": ["therapy", "conversation"],
      "open_access": true,
      "data_availability": "available",
      "discovery_date": "2025-01-21T10:00:00Z",
      "discovery_method": "keyword_search"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

**Permissions**: `discovery:read`

#### Get Source Details

```http
GET /api/journal-research/sessions/{session_id}/sources/{source_id}
```

**Response:**
```json
{
  "source_id": "source_123",
  "title": "Therapeutic Conversation Dataset",
  "authors": ["John Doe", "Jane Smith"],
  "publication_date": "2024-01-15T00:00:00Z",
  "source_type": "journal_article",
  "url": "https://example.com/paper",
  "doi": "10.1234/example",
  "abstract": "Abstract text...",
  "keywords": ["therapy", "conversation"],
  "open_access": true,
  "data_availability": "available",
  "discovery_date": "2025-01-21T10:00:00Z",
  "discovery_method": "keyword_search"
}
```

**Permissions**: `discovery:read`

### Evaluation

#### Initiate Evaluation

```http
POST /api/journal-research/sessions/{session_id}/evaluate
```

**Request Body:**
```json
{
  "source_ids": ["source_123", "source_456"],
  "evaluation_criteria": {
    "quality_threshold": 0.7,
    "relevance_threshold": 0.8
  }
}
```

**Response:** `202 Accepted`
```json
{
  "evaluation_id": "eval_123",
  "session_id": "session_123",
  "status": "pending",
  "started_at": "2025-01-21T11:00:00Z"
}
```

**Permissions**: `evaluation:create`

#### List Evaluations

```http
GET /api/journal-research/sessions/{session_id}/evaluations
```

**Query Parameters:**
- `page` (integer, default: 1)
- `page_size` (integer, default: 20)
- `status` (string, optional) - Filter by status: `pending`, `completed`, `failed`

**Response:**
```json
{
  "items": [
    {
      "evaluation_id": "eval_123",
      "session_id": "session_123",
      "source_id": "source_123",
      "status": "completed",
      "quality_score": 0.85,
      "relevance_score": 0.92,
      "recommendation": "acquire",
      "evaluated_at": "2025-01-21T11:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

**Permissions**: `evaluation:read`

#### Get Evaluation Details

```http
GET /api/journal-research/sessions/{session_id}/evaluations/{evaluation_id}
```

**Response:**
```json
{
  "evaluation_id": "eval_123",
  "session_id": "session_123",
  "source_id": "source_123",
  "status": "completed",
  "quality_score": 0.85,
  "relevance_score": 0.92,
  "recommendation": "acquire",
  "details": {
    "data_quality": "high",
    "documentation": "comprehensive",
    "license": "CC-BY-4.0"
  },
  "evaluated_at": "2025-01-21T11:30:00Z"
}
```

**Permissions**: `evaluation:read`

#### Update Evaluation

```http
PUT /api/journal-research/sessions/{session_id}/evaluations/{evaluation_id}
```

**Request Body:**
```json
{
  "recommendation": "acquire",
  "notes": "Manual override: high quality dataset"
}
```

**Response:** `200 OK` (same as Get Evaluation Details)

**Permissions**: `evaluation:update`

### Acquisition

#### Initiate Acquisition

```http
POST /api/journal-research/sessions/{session_id}/acquire
```

**Request Body:**
```json
{
  "source_ids": ["source_123"],
  "acquisition_method": "download",
  "storage_location": "s3://bucket/datasets"
}
```

**Response:** `202 Accepted`
```json
{
  "acquisition_id": "acq_123",
  "session_id": "session_123",
  "status": "pending",
  "started_at": "2025-01-21T12:00:00Z"
}
```

**Permissions**: `acquisition:create`

#### List Acquisitions

```http
GET /api/journal-research/sessions/{session_id}/acquisitions
```

**Query Parameters:**
- `page` (integer, default: 1)
- `page_size` (integer, default: 20)
- `status` (string, optional) - Filter by status: `pending`, `in_progress`, `completed`, `failed`

**Response:**
```json
{
  "items": [
    {
      "acquisition_id": "acq_123",
      "session_id": "session_123",
      "source_id": "source_123",
      "status": "completed",
      "progress": 100,
      "storage_location": "s3://bucket/datasets/source_123",
      "acquired_at": "2025-01-21T12:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

**Permissions**: `acquisition:read`

#### Get Acquisition Details

```http
GET /api/journal-research/sessions/{session_id}/acquisitions/{acquisition_id}
```

**Response:**
```json
{
  "acquisition_id": "acq_123",
  "session_id": "session_123",
  "source_id": "source_123",
  "status": "completed",
  "progress": 100,
  "storage_location": "s3://bucket/datasets/source_123",
  "file_size": 1048576,
  "acquired_at": "2025-01-21T12:30:00Z"
}
```

**Permissions**: `acquisition:read`

#### Update Acquisition Status

```http
PUT /api/journal-research/sessions/{session_id}/acquisitions/{acquisition_id}
```

**Request Body:**
```json
{
  "status": "completed",
  "storage_location": "s3://bucket/datasets/source_123"
}
```

**Response:** `200 OK` (same as Get Acquisition Details)

**Permissions**: `acquisition:update`

### Integration

#### Initiate Integration Planning

```http
POST /api/journal-research/sessions/{session_id}/integrate
```

**Request Body:**
```json
{
  "acquisition_ids": ["acq_123", "acq_456"],
  "integration_strategy": "merge",
  "target_schema": "unified_conversation_schema"
}
```

**Response:** `202 Accepted`
```json
{
  "plan_id": "plan_123",
  "session_id": "session_123",
  "status": "pending",
  "started_at": "2025-01-21T13:00:00Z"
}
```

**Permissions**: `integration:create`

#### List Integration Plans

```http
GET /api/journal-research/sessions/{session_id}/integration-plans
```

**Query Parameters:**
- `page` (integer, default: 1)
- `page_size` (integer, default: 20)
- `status` (string, optional) - Filter by status: `pending`, `completed`, `failed`

**Response:**
```json
{
  "items": [
    {
      "plan_id": "plan_123",
      "session_id": "session_123",
      "status": "completed",
      "datasets_included": ["acq_123", "acq_456"],
      "preprocessing_steps": [
        {
          "step": "normalize_timestamps",
          "description": "Normalize all timestamps to UTC"
        }
      ],
      "created_at": "2025-01-21T13:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

**Permissions**: `integration:read`

#### Get Integration Plan Details

```http
GET /api/journal-research/sessions/{session_id}/integration-plans/{plan_id}
```

**Response:**
```json
{
  "plan_id": "plan_123",
  "session_id": "session_123",
  "status": "completed",
  "datasets_included": ["acq_123", "acq_456"],
  "preprocessing_steps": [
    {
      "step": "normalize_timestamps",
      "description": "Normalize all timestamps to UTC",
      "script": "def normalize_timestamps(data): ..."
    }
  ],
  "target_schema": "unified_conversation_schema",
  "created_at": "2025-01-21T13:30:00Z"
}
```

**Permissions**: `integration:read`

### Progress

#### Get Progress Metrics

```http
GET /api/journal-research/sessions/{session_id}/progress
```

**Response:**
```json
{
  "session_id": "session_123",
  "current_phase": "evaluation",
  "overall_progress": 45,
  "phase_progress": {
    "discovery": 100,
    "evaluation": 60,
    "acquisition": 0,
    "integration": 0
  },
  "metrics": {
    "sources_identified": 10,
    "sources_evaluated": 6,
    "sources_acquired": 0,
    "integration_plans_created": 0
  },
  "targets": {
    "sources_identified": 10,
    "sources_evaluated": 5,
    "sources_acquired": 3,
    "integration_plans_created": 1
  },
  "last_updated": "2025-01-21T14:00:00Z"
}
```

**Permissions**: `sessions:read`

### Reports

#### Generate Report

```http
POST /api/journal-research/sessions/{session_id}/reports
```

**Request Body:**
```json
{
  "report_type": "summary",
  "format": "pdf",
  "include_charts": true,
  "sections": ["overview", "sources", "evaluations", "acquisitions"]
}
```

**Response:** `202 Accepted`
```json
{
  "report_id": "report_123",
  "session_id": "session_123",
  "status": "pending",
  "started_at": "2025-01-21T15:00:00Z"
}
```

**Permissions**: `reports:create`

#### List Reports

```http
GET /api/journal-research/sessions/{session_id}/reports
```

**Query Parameters:**
- `page` (integer, default: 1)
- `page_size` (integer, default: 20)
- `status` (string, optional) - Filter by status: `pending`, `completed`, `failed`

**Response:**
```json
{
  "items": [
    {
      "report_id": "report_123",
      "session_id": "session_123",
      "report_type": "summary",
      "format": "pdf",
      "status": "completed",
      "download_url": "https://api.example.com/reports/report_123/download",
      "created_at": "2025-01-21T15:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

**Permissions**: `reports:read`

#### Get Report

```http
GET /api/journal-research/sessions/{session_id}/reports/{report_id}
```

**Response:**
```json
{
  "report_id": "report_123",
  "session_id": "session_123",
  "report_type": "summary",
  "format": "pdf",
  "status": "completed",
  "download_url": "https://api.example.com/reports/report_123/download",
  "file_size": 524288,
  "created_at": "2025-01-21T15:30:00Z"
}
```

**Permissions**: `reports:read`

## WebSocket API

### Progress Stream

Connect to a WebSocket endpoint to receive real-time progress updates:

```javascript
const ws = new WebSocket('ws://api.example.com/api/journal-research/sessions/{session_id}/progress/stream?token=<jwt-token>');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Progress update:', update);
};
```

**Message Format:**
```json
{
  "type": "progress_update",
  "session_id": "session_123",
  "progress": {
    "current_phase": "evaluation",
    "overall_progress": 45,
    "phase_progress": {
      "discovery": 100,
      "evaluation": 60
    },
    "metrics": {
      "sources_identified": 10,
      "sources_evaluated": 6
    }
  },
  "timestamp": "2025-01-21T14:00:00Z"
}
```

## Data Models

### Session

```typescript
interface Session {
  session_id: string;
  start_date: string; // ISO 8601 datetime
  target_sources: string[];
  search_keywords: Record<string, string[]>;
  weekly_targets: Record<string, number>;
  current_phase: "discovery" | "evaluation" | "acquisition" | "integration";
  progress_metrics: Record<string, number>;
}
```

### Source

```typescript
interface Source {
  source_id: string;
  title: string;
  authors: string[];
  publication_date: string; // ISO 8601 datetime
  source_type: string;
  url: string;
  doi?: string;
  abstract: string;
  keywords: string[];
  open_access: boolean;
  data_availability: string;
  discovery_date: string; // ISO 8601 datetime
  discovery_method: string;
}
```

### Evaluation

```typescript
interface Evaluation {
  evaluation_id: string;
  session_id: string;
  source_id: string;
  status: "pending" | "completed" | "failed";
  quality_score: number; // 0-1
  relevance_score: number; // 0-1
  recommendation: "acquire" | "reject" | "review";
  details?: Record<string, unknown>;
  evaluated_at: string; // ISO 8601 datetime
}
```

### Acquisition

```typescript
interface Acquisition {
  acquisition_id: string;
  session_id: string;
  source_id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  progress: number; // 0-100
  storage_location?: string;
  file_size?: number;
  acquired_at?: string; // ISO 8601 datetime
}
```

### Integration Plan

```typescript
interface IntegrationPlan {
  plan_id: string;
  session_id: string;
  status: "pending" | "completed" | "failed";
  datasets_included: string[];
  preprocessing_steps: Array<{
    step: string;
    description: string;
    script?: string;
  }>;
  target_schema: string;
  created_at: string; // ISO 8601 datetime
}
```

### Progress Metrics

```typescript
interface ProgressMetrics {
  session_id: string;
  current_phase: string;
  overall_progress: number; // 0-100
  phase_progress: Record<string, number>; // 0-100 per phase
  metrics: {
    sources_identified: number;
    sources_evaluated: number;
    sources_acquired: number;
    integration_plans_created: number;
  };
  targets: {
    sources_identified: number;
    sources_evaluated: number;
    sources_acquired: number;
    integration_plans_created: number;
  };
  last_updated: string; // ISO 8601 datetime
}
```

## Examples

### Complete Workflow Example

```bash
# 1. Create a session
curl -X POST https://api.example.com/api/journal-research/sessions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "target_sources": ["pubmed", "doaj"],
    "search_keywords": {
      "therapeutic": ["therapy", "counseling"]
    },
    "weekly_targets": {
      "sources_identified": 10
    }
  }'

# 2. Initiate discovery
curl -X POST https://api.example.com/api/journal-research/sessions/session_123/discovery \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sources": ["pubmed"],
    "keywords": {
      "therapeutic": ["therapy"]
    }
  }'

# 3. List discovered sources
curl https://api.example.com/api/journal-research/sessions/session_123/sources \
  -H "Authorization: Bearer <token>"

# 4. Evaluate sources
curl -X POST https://api.example.com/api/journal-research/sessions/session_123/evaluate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "source_ids": ["source_123"]
  }'

# 5. Acquire evaluated sources
curl -X POST https://api.example.com/api/journal-research/sessions/session_123/acquire \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "source_ids": ["source_123"]
  }'

# 6. Generate report
curl -X POST https://api.example.com/api/journal-research/sessions/session_123/reports \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "report_type": "summary",
    "format": "pdf"
  }'
```

## Support

For API support, please contact the development team or refer to the project documentation.

**Last Updated**: January 2025  
**API Version**: 1.0.0

