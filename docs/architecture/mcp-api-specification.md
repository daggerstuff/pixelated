---
title: MCP Server API Specification
description: Comprehensive API specification for the Management Control Panel (MCP) server, including REST endpoints, WebSocket events, and integration patterns.
version: v1
sidebar_position: 1
sidebar_label: MCP API
---

## MCP Server API Specification

## Overview

This document provides comprehensive API specifications for the Management Control Panel (MCP) server, including RESTful endpoints, WebSocket events, data contracts, and integration patterns for the TechDeck-Python pipeline system.

## API Versioning

- Current Version: `v1`
- Base URL: `https://api.pixelatedempathy.com/mcp/v1`
- WebSocket URL: `wss://api.pixelatedempathy.com/mcp/ws`

## Authentication

### JWT Authentication

All API endpoints require JWT authentication using the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

### Agent Authentication

Agents use a specialized authentication flow:

```typescript
interface AgentAuthRequest {
  agent_id: string
  agent_type: string
  capabilities: string[]
  auth_token: string
}

interface AgentAuthResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  permissions: string[]
}
```

## REST API Endpoints

### Agent Management

#### Register Agent
```http
POST /api/v1/agents/register
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "agent_id": "bias-detector-001",
  "name": "Bias Detection Agent",
  "type": "bias-detector",
  "capabilities": ["bias_detection", "text_analysis", "sentiment_analysis"],
  "version": "1.0.0",
  "endpoint_url": "http://bias-detector:8000",
  "health_check_url": "http://bias-detector:8000/health",
  "metadata": {
    "model_version": "v2.1",
    "max_concurrent_tasks": 5
  }
}

Response: 201 Created
{
  "agent_id": "bias-detector-001",
  "status": "active",
  "registered_at": "2024-01-15T10:30:00Z",
  "auth_token": "agent_token_abc123"
}
```

#### List Agents
```http
GET /api/v1/agents?status=active&type=bias-detector&limit=50&offset=0
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "agents": [
    {
      "agent_id": "bias-detector-001",
      "name": "Bias Detection Agent",
      "type": "bias-detector",
      "status": "active",
      "capabilities": ["bias_detection", "text_analysis"],
      "last_heartbeat": "2024-01-15T10:30:00Z",
      "current_tasks": 2,
      "performance_metrics": {
        "tasks_completed": 150,
        "average_response_time": 2.3,
        "success_rate": 0.98
      }
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

#### Get Agent Details
```http
GET /api/v1/agents/{agent_id}
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "agent_id": "bias-detector-001",
  "name": "Bias Detection Agent",
  "type": "bias-detector",
  "status": "active",
  "capabilities": ["bias_detection", "text_analysis"],
  "version": "1.0.0",
  "endpoint_url": "http://bias-detector:8000",
  "health_check_url": "http://bias-detector:8000/health",
  "registered_at": "2024-01-15T10:30:00Z",
  "last_heartbeat": "2024-01-15T10:30:00Z",
  "metadata": {
    "model_version": "v2.1",
    "max_concurrent_tasks": 5
  },
  "permissions": ["task:execute", "task:read"],
  "performance_metrics": {
    "tasks_completed": 150,
    "tasks_failed": 3,
    "average_response_time": 2.3,
    "success_rate": 0.98,
    "last_24h": {
      "tasks_completed": 25,
      "average_response_time": 2.1
    }
  }
}
```

#### Update Agent
```http
PUT /api/v1/agents/{agent_id}
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "name": "Bias Detection Agent Pro",
  "capabilities": ["bias_detection", "text_analysis", "emotion_detection"],
  "endpoint_url": "http://bias-detector:8001",
  "metadata": {
    "model_version": "v2.2",
    "max_concurrent_tasks": 10
  }
}

Response: 200 OK
{
  "agent_id": "bias-detector-001",
  "updated_at": "2024-01-15T11:00:00Z"
}
```

#### Agent Heartbeat
```http
POST /api/v1/agents/{agent_id}/heartbeat
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "status": "healthy",
  "current_tasks": 2,
  "system_metrics": {
    "cpu_usage": 0.45,
    "memory_usage": 0.62,
    "disk_usage": 0.31
  }
}

Response: 200 OK
{
  "status": "acknowledged",
  "next_heartbeat": "2024-01-15T10:35:00Z"
}
```

### Task Management

#### Create Task
```http
POST /api/v1/tasks
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "pipeline_id": "pipeline-123",
  "stage": 2,
  "task_type": "bias_detection",
  "parameters": {
    "text": "The patient seems very anxious about their treatment.",
    "context": "therapy_session",
    "patient_id": "patient-456"
  },
  "priority": 5,
  "deadline": "2024-01-15T11:30:00Z",
  "dependencies": ["task-001", "task-002"]
}

Response: 201 Created
{
  "task_id": "task-789",
  "status": "pending",
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### List Tasks
```http
GET /api/v1/tasks?status=pending&pipeline_id=pipeline-123&limit=100&offset=0
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "tasks": [
    {
      "task_id": "task-789",
      "pipeline_id": "pipeline-123",
      "stage": 2,
      "task_type": "bias_detection",
      "status": "pending",
      "priority": 5,
      "created_at": "2024-01-15T10:30:00Z",
      "deadline": "2024-01-15T11:30:00Z",
      "estimated_duration": 30
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 100,
    "offset": 0,
    "has_more": false
  }
}
```

#### Delegate Task
```http
POST /api/v1/tasks/{task_id}/delegate
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "agent_id": "bias-detector-001",
  "priority": 7
}

Response: 200 OK
{
  "task_id": "task-789",
  "agent_id": "bias-detector-001",
  "status": "assigned",
  "assigned_at": "2024-01-15T10:31:00Z",
  "estimated_completion": "2024-01-15T10:32:00Z"
}
```

#### Complete Task
```http
POST /api/v1/tasks/{task_id}/complete
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "result": {
    "bias_detected": true,
    "bias_type": "gender",
    "confidence": 0.87,
    "recommendations": ["Consider gender-neutral language"]
  },
  "metadata": {
    "processing_time": 2.3,
    "model_version": "v2.1"
  }
}

Response: 200 OK
{
  "task_id": "task-789",
  "status": "completed",
  "completed_at": "2024-01-15T10:32:15Z"
}
```

### Pipeline Orchestration

#### Create Pipeline
```http
POST /api/v1/pipelines
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "name": "Mental Health Analysis Pipeline",
  "description": "6-stage pipeline for comprehensive mental health text analysis",
  "input_data": {
    "text": "The patient seems very anxious about their treatment.",
    "context": "therapy_session",
    "patient_id": "patient-456",
    "session_id": "session-789"
  },
  "stages": [
    {
      "stage": 1,
      "name": "Text Preprocessing",
      "task_type": "text_preprocessing",
      "dependencies": []
    },
    {
      "stage": 2,
      "name": "Bias Detection",
      "task_type": "bias_detection",
      "dependencies": [1]
    },
    {
      "stage": 3,
      "name": "Emotion Analysis",
      "task_type": "emotion_analysis",
      "dependencies": [1]
    },
    {
      "stage": 4,
      "name": "Empathy Scoring",
      "task_type": "empathy_scoring",
      "dependencies": [2, 3]
    },
    {
      "stage": 5,
      "name": "Therapeutic Recommendations",
      "task_type": "therapeutic_recommendations",
      "dependencies": [4]
    },
    {
      "stage": 6,
      "name": "Report Generation",
      "task_type": "report_generation",
      "dependencies": [5]
    }
  ],
  "metadata": {
    "therapist_id": "therapist-123",
    "session_type": "initial_consultation"
  }
}

Response: 201 Created
{
  "pipeline_id": "pipeline-456",
  "status": "created",
  "created_at": "2024-01-15T10:30:00Z",
  "estimated_duration": 180
}
```

#### Get Pipeline Status
```http
GET /api/v1/pipelines/{pipeline_id}
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "pipeline_id": "pipeline-456",
  "name": "Mental Health Analysis Pipeline",
  "status": "running",
  "progress": 0.5,
  "current_stage": 3,
  "stages": [
    {
      "stage": 1,
      "name": "Text Preprocessing",
      "status": "completed",
      "started_at": "2024-01-15T10:30:05Z",
      "completed_at": "2024-01-15T10:30:10Z"
    },
    {
      "stage": 2,
      "name": "Bias Detection",
      "status": "completed",
      "started_at": "2024-01-15T10:30:15Z",
      "completed_at": "2024-01-15T10:30:25Z"
    },
    {
      "stage": 3,
      "name": "Emotion Analysis",
      "status": "running",
      "started_at": "2024-01-15T10:30:30Z",
      "progress": 0.6
    }
  ],
  "created_at": "2024-01-15T10:30:00Z",
  "started_at": "2024-01-15T10:30:05Z",
  "estimated_completion": "2024-01-15T10:33:00Z"
}
```

#### Execute Pipeline Stage
```http
POST /api/v1/pipelines/{pipeline_id}/stages/{stage}/execute
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "agent_id": "emotion-analyzer-001",
  "parameters": {
    "deep_analysis": true,
    "include_confidence_scores": true
  }
}

Response: 202 Accepted
{
  "stage": 3,
  "status": "running",
  "task_id": "task-stage3-001",
  "started_at": "2024-01-15T10:30:30Z"
}
```

### Discovery & Health

#### Service Health Check
```http
GET /api/v1/health
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "healthy",
      "response_time": 15
    },
    "redis": {
      "status": "healthy",
      "response_time": 5
    },
    "external_services": {
      "status": "healthy",
      "services": {
        "flask_api": "healthy",
        "openai": "healthy",
        "bias_detection": "healthy"
      }
    }
  }
}
```

#### Discover Services
```http
GET /api/v1/discovery/services
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "services": [
    {
      "service_id": "flask-api",
      "name": "Flask API Service",
      "type": "api",
      "status": "active",
      "endpoint": "http://flask-api:8000",
      "capabilities": ["text_analysis", "emotion_detection"],
      "version": "1.2.0"
    },
    {
      "service_id": "bias-detection-service",
      "name": "Bias Detection Service",
      "type": "ai_service",
      "status": "active",
      "endpoint": "http://bias-detection:8001",
      "capabilities": ["bias_detection", "fairness_analysis"],
      "version": "2.1.0"
    }
  ]
}
```

## WebSocket API

### Connection

```javascript
const socket = io('wss://api.pixelatedempathy.com/mcp/ws', {
  auth: {
    token: 'jwt_token_here'
  }
});
```

### Events

#### Agent Registration
```typescript
// Client -> Server
socket.emit('agent:register', {
  agent_id: 'bias-detector-001',
  agent_type: 'bias-detector',
  capabilities: ['bias_detection', 'text_analysis'],
  metadata: {
    version: '1.0.0',
    max_concurrent_tasks: 5
  }
});

// Server -> Client
socket.on('agent:registered', (data) => {
  console.log('Agent registered:', data);
});
```

#### Task Delegation
```typescript
// Server -> Client
socket.on('task:delegate', (task) => {
  console.log('New task delegated:', task);
  
  // Process task and send result
  socket.emit('task:result', {
    task_id: task.task_id,
    result: {
      bias_detected: true,
      bias_type: 'gender',
      confidence: 0.87
    }
  });
});
```

#### Progress Updates
```typescript
// Client -> Server
socket.emit('progress:update', {
  task_id: 'task-789',
  pipeline_id: 'pipeline-123',
  stage: 2,
  progress: 0.75,
  status: 'running',
  message: 'Analyzing text for bias patterns'
});
```

### WebSocket Event Types

```typescript
interface WebSocketEvents {
  // Agent events
  'agent:register': AgentRegisterEvent
  'agent:registered': AgentRegisteredEvent
  'agent:heartbeat': AgentHeartbeatEvent
  'agent:status_update': AgentStatusUpdateEvent
  
  // Task events
  'task:delegate': TaskDelegateEvent
  'task:result': TaskResultEvent
  'task:progress': TaskProgressEvent
  'task:failed': TaskFailedEvent
  
  // Pipeline events
  'pipeline:created': PipelineCreatedEvent
  'pipeline:stage_started': PipelineStageStartedEvent
  'pipeline:stage_completed': PipelineStageCompletedEvent
  'pipeline:completed': PipelineCompletedEvent
  'pipeline:failed': PipelineFailedEvent
  
  // System events
  'system:health_check': SystemHealthCheckEvent
  'system:shutdown': SystemShutdownEvent
  'system:error': SystemErrorEvent
}
```

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task with ID 'task-999' not found",
    "details": {
      "task_id": "task-999",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    "request_id": "req-123456"
  }
}
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AGENT_NOT_FOUND` | Agent ID not found | 404 |
| `TASK_NOT_FOUND` | Task ID not found | 404 |
| `PIPELINE_NOT_FOUND` | Pipeline ID not found | 404 |
| `AGENT_ALREADY_REGISTERED` | Agent already exists | 409 |
| `TASK_ALREADY_ASSIGNED` | Task already assigned to agent | 409 |
| `INSUFFICIENT_PERMISSIONS` | Agent lacks required permissions | 403 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INVALID_PARAMETERS` | Request parameters invalid | 400 |
| `EXTERNAL_SERVICE_ERROR` | External service failure | 502 |
| `INTERNAL_ERROR` | Internal server error | 500 |

## Rate Limiting

### Rate Limits

- **Agent Registration**: 10 requests per minute
- **Task Creation**: 100 requests per minute
- **Task Delegation**: 200 requests per minute
- **Health Checks**: 60 requests per minute
- **WebSocket Connections**: 10 connections per agent

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1642249800
```

## Pagination

### Pagination Parameters

- `limit`: Number of items per page (default: 50, max: 1000)
- `offset`: Number of items to skip (default: 0)
- `sort`: Sort field and direction (e.g., `created_at:desc`)

### Pagination Response

```json
{
  "items": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "has_more": true,
    "next_offset": 50
  }
}
```

## Webhook Integration

### Webhook Events

```typescript
interface WebhookPayload {
  event: string
  timestamp: string
  data: Record<string, unknown>
  signature: string
}

// Example webhook events
interface TaskCompletedWebhook {
  event: 'task.completed'
  timestamp: '2024-01-15T10:32:15Z'
  data: {
    task_id: 'task-789'
    pipeline_id: 'pipeline-123'
    stage: 2
    result: {
      bias_detected: true
      bias_type: 'gender'
      confidence: 0.87
    }
  }
  signature: 'sha256=abc123...'
}
```

## SDK Integration

### TypeScript SDK Example

```typescript
import { MCPServerClient } from '@pixelated/mcp-sdk';

const client = new MCPServerClient({
  baseUrl: 'https://api.pixelatedempathy.com/mcp/v1',
  authToken: 'your_jwt_token'
});

// Register an agent
const agent = await client.agents.register({
  agent_id: 'bias-detector-001',
  name: 'Bias Detection Agent',
  type: 'bias-detector',
  capabilities: ['bias_detection'],
  endpoint_url: 'http://localhost:8000'
});

// Create a pipeline
const pipeline = await client.pipelines.create({
  name: 'Mental Health Analysis',
  input_data: { text: 'Patient is feeling anxious.' },
  stages: [...]
});

// Listen for WebSocket events
client.websocket.on('task:delegate', async (task) => {
  const result = await processTask(task);
  client.websocket.emit('task:result', {
    task_id: task.task_id,
    result
  });
});
```

## Testing

### Test Endpoints

```http
GET /api/v1/test/echo?message=hello
POST /api/v1/test/validate
```

### Load Testing

```bash
# Using k6 for load testing
k6 run --vus 100 --duration 30s tests/load/mcp-api-test.js
```

## Monitoring

### API Metrics

- Request count and rate
- Response time percentiles
- Error rate by endpoint
- Active WebSocket connections
- Task processing rate

### Health Monitoring

```http
GET /api/v1/health/detailed
```

Returns detailed health information including:
- Database connectivity
- Redis connectivity
- External service status
- System resource usage
- Queue depths

## Version History

### v1.0.0 (Current)
- Initial API release
- Agent management
- Task delegation
- Pipeline orchestration
- WebSocket support
- Basic authentication

### Planned v1.1.0
- Advanced filtering
- Batch operations
- Enhanced monitoring
- Plugin system
- Advanced retry mechanisms

## Support

For API support, please contact:
- [Email](mailto:api-support@pixelatedempathy.com)
- [Documentation](https://docs.pixelatedempathy.com/mcp-api)
- [Status Page](https://status.pixelatedempathy.com)
