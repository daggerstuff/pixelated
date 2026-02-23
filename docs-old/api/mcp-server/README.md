## Journal Dataset Research MCP Server API Documentation

## Overview

The Journal Dataset Research MCP Server provides a Model Context Protocol (MCP) interface for AI agents to interact with the journal dataset research system. The server exposes research operations through tools, resources, and prompts, enabling AI agents to discover, evaluate, acquire, and integrate research datasets.

**Version**: 0.1.0  
**Protocol Version**: 2024-11-05  
**Server Name**: journal-dataset-research-mcp

## Table of Contents

- [Architecture](#architecture)
- [Protocol](#protocol)
- [Authentication & Authorization](#authentication--authorization)
- [Tools](#tools)
- [Resources](#resources)
- [Prompts](#prompts)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Progress Streaming](#progress-streaming)

## Architecture

The MCP server is built on top of the JSON-RPC 2.0 protocol and follows the Model Context Protocol specification. It integrates with the journal dataset research system through the `CommandHandlerService`, which provides access to research orchestration, discovery, evaluation, acquisition, and integration services.

### Components

- **MCPServer**: Main server class that handles protocol requests
- **ToolRegistry**: Manages tool registration and discovery
- **ResourceRegistry**: Manages resource registration and access
- **PromptRegistry**: Manages prompt registration and rendering
- **MCPProtocolHandler**: Handles JSON-RPC 2.0 protocol parsing and formatting
- **ToolExecutor**: Executes tools with progress tracking and error handling
- **ProgressStreamer**: Provides real-time progress updates for async operations

### Request Flow

1. **Parse Request**: JSON-RPC 2.0 request is parsed and validated
2. **Input Sanitization**: Request parameters are sanitized for security
3. **Authentication**: Request is authenticated (if enabled)
4. **Rate Limiting**: Rate limits are checked (if enabled)
5. **Authorization**: User permissions are verified
6. **Route Request**: Request is routed to appropriate handler (tools/resources/prompts)
7. **Execute**: Tool/resource/prompt is executed
8. **Output Sanitization**: Response is sanitized
9. **Format Response**: Response is formatted as JSON-RPC 2.0

## Protocol

The server implements the Model Context Protocol (MCP) over JSON-RPC 2.0. All requests and responses follow the JSON-RPC 2.0 specification.

### Request Format

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {
      "param1": "value1",
      "param2": "value2"
    }
  },
  "id": 1
}
```

### Response Format

**Success Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Result data"
      }
    ]
  },
  "id": 1
}
```

**Error Response:**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "param": "session_id",
      "reason": "Missing required parameter"
    }
  },
  "id": 1
}
```

### Methods

#### Initialization

- `initialize`: Initialize MCP connection and get server capabilities
- `notifications/initialized`: Notification sent after initialization

#### Tools

- `tools/list`: List all available tools
- `tools/call`: Execute a tool

#### Resources

- `resources/list`: List all available resources
- `resources/read`: Read a resource

#### Prompts

- `prompts/list`: List all available prompts
- `prompts/get`: Get a rendered prompt

## Authentication & Authorization

The server supports multiple authentication methods and role-based access control (RBAC).

### Authentication Methods

1. **API Key Authentication**: Bearer token in Authorization header
2. **JWT Token Authentication**: JWT token in Authorization header

### Configuration

Authentication is configured via environment variables:

```bash
MCP_AUTH_ENABLED=true
MCP_AUTH_API_KEY_REQUIRED=true
MCP_AUTH_ALLOWED_API_KEYS=key1,key2,key3
MCP_AUTH_JWT_SECRET=your-secret-key
MCP_AUTH_JWT_ALGORITHM=HS256
```

### Roles

- **admin**: Full access to all tools, resources, and prompts
- **researcher**: Access to research tools and resources
- **viewer**: Read-only access to resources

### Permissions

Permissions are checked before tool execution, resource access, and prompt rendering. The authorization handler verifies:

- User role has required permissions
- Resource access is allowed for the user
- Tool execution is permitted

### Example

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "headers": {
      "Authorization": "Bearer your-api-key"
    },
    "name": "create_session",
    "arguments": {
      "target_sources": ["pubmed"],
      "search_keywords": {
        "therapeutic": ["therapy"]
      }
    }
  },
  "id": 1
}
```

## Tools

Tools are the primary interface for executing research operations. Each tool represents a specific action that can be performed on the research system.

### Tool Categories

1. **Session Management**: Create, list, get, update, delete sessions
2. **Source Discovery**: Discover, list, get, filter sources
3. **Dataset Evaluation**: Evaluate sources, get evaluations
4. **Dataset Acquisition**: Acquire datasets, get acquisitions
5. **Integration Planning**: Create integration plans, generate scripts
6. **Report Generation**: Generate reports, list reports

### Tool Execution

Tools are executed asynchronously and may return progress updates for long-running operations. The server supports:

- **Synchronous Execution**: Immediate results for quick operations
- **Asynchronous Execution**: Progress updates for long-running operations
- **Timeout Handling**: Automatic timeout for operations exceeding limits

### Tool Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"result\": \"data\"}"
    }
  ]
}
```

For detailed tool documentation, see [Tools Documentation](./tools.md).

## Resources

Resources provide read-only access to research data and progress information. Resources are accessed via URIs and return structured data.

### Resource Categories

1. **Progress Resources**: Current progress metrics and history
2. **Session Resources**: Session state and metadata
3. **Metrics Resources**: Session metrics and statistics

### Resource URI Format

Resources use a URI scheme: `research://{category}/{type}/{identifier}`

Examples:
- `research://progress/metrics/{session_id}`
- `research://progress/history/{session_id}`
- `research://session/state/{session_id}`
- `research://session/metrics/{session_id}`

### Resource Access

Resources are accessed via the `resources/read` method:

```json
{
  "jsonrpc": "2.0",
  "method": "resources/read",
  "params": {
    "uri": "research://progress/metrics/session_123"
  },
  "id": 1
}
```

For detailed resource documentation, see [Resources Documentation](./resources.md).

## Prompts

Prompts provide workflow guidance and instructions for using the research system. Prompts are rendered with parameters to generate contextual instructions.

### Prompt Categories

1. **Discovery Workflow**: Guide for discovering dataset sources
2. **Evaluation Workflow**: Guide for evaluating datasets
3. **Acquisition Workflow**: Guide for acquiring datasets
4. **Integration Workflow**: Guide for creating integration plans

### Prompt Rendering

Prompts are rendered with parameters to generate contextual instructions:

```json
{
  "jsonrpc": "2.0",
  "method": "prompts/get",
  "params": {
    "name": "discover_sources_workflow",
    "arguments": {
      "session_id": "session_123",
      "keywords": ["therapy", "counseling"],
      "sources": ["pubmed", "doaj"]
    }
  },
  "id": 1
}
```

For detailed prompt documentation, see [Prompts Documentation](./prompts.md).

## Error Handling

The server provides comprehensive error handling with detailed error codes and messages.

### Error Codes

#### JSON-RPC 2.0 Standard Errors

- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error

#### MCP-Specific Errors

- `-32000`: Tool execution error
- `-32001`: Tool validation error
- `-32002`: Tool timeout
- `-32010`: Resource not found
- `-32011`: Resource access denied
- `-32020`: Authentication error
- `-32021`: Authorization error
- `-32030`: Rate limit exceeded

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "param": "session_id",
      "reason": "Missing required parameter"
    }
  },
  "id": 1
}
```

### Error Recovery

The server implements error recovery mechanisms:

- **Retry Logic**: Automatic retry for transient errors
- **Timeout Handling**: Graceful timeout for long-running operations
- **Error Logging**: Comprehensive error logging for debugging
- **Audit Logging**: Security and access audit logging

## Rate Limiting

Rate limiting is configurable and can be enabled to prevent abuse and ensure fair resource usage.

### Configuration

```bash
MCP_RATE_LIMITS_ENABLED=true
MCP_RATE_LIMITS_REQUESTS_PER_MINUTE=60
MCP_RATE_LIMITS_REQUESTS_PER_HOUR=1000
MCP_RATE_LIMITS_REQUESTS_PER_DAY=10000
```

### Rate Limit Headers

When rate limiting is enabled, responses include rate limit headers:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time when limit resets

### Rate Limit Exceeded

When rate limit is exceeded, the server returns:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32030,
    "message": "Rate limit exceeded",
    "data": {
      "limit": 60,
      "reset_at": "2025-01-15T10:00:00Z"
    }
  },
  "id": 1
}
```

## Progress Streaming

Long-running operations provide progress updates through the progress streaming system.

### Progress Updates

Progress updates are available via:

1. **Progress Resources**: Real-time progress metrics
2. **Progress History**: Historical progress snapshots
3. **Progress Events**: Event-based progress notifications

### Progress Format

```json
{
  "session_id": "session_123",
  "operation": "discover_sources",
  "status": "in_progress",
  "progress": {
    "sources_identified": 10,
    "total_sources": 50,
    "percentage": 20
  },
  "timestamp": "2025-01-15T10:00:00Z"
}
```

## Security

The server implements multiple security measures:

1. **Input Sanitization**: All input is sanitized to prevent injection attacks
2. **Output Sanitization**: All output is sanitized to prevent data leakage
3. **Authentication**: Required authentication for all operations
4. **Authorization**: Role-based access control
5. **Rate Limiting**: Prevents abuse and DoS attacks
6. **Audit Logging**: Comprehensive audit logging for security monitoring

## Configuration

The server is configured via environment variables. See [Deployment Configuration](../../guides/technical-guides/deployment/mcp-server-deployment.md) for details.

## Examples

See the [Examples](./examples.md) document for complete usage examples.

## Support

For issues, questions, or contributions, please see the project repository.

