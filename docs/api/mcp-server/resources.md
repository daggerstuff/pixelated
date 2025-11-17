# MCP Server Resources Documentation

This document provides comprehensive documentation for all resources available in the Journal Dataset Research MCP Server.

## Table of Contents

- [Overview](#overview)
- [Progress Resources](#progress-resources)
- [Session Resources](#session-resources)
- [Metrics Resources](#metrics-resources)
- [Resource Access](#resource-access)
- [Error Handling](#error-handling)
- [Usage Examples](#usage-examples)

## Overview

Resources provide read-only access to research data and progress information. Resources are accessed via URIs and return structured data in JSON format.

### Resource URI Scheme

Resources use a URI scheme: `research://{category}/{type}/{identifier}`

Examples:
- `research://progress/metrics/{session_id}`
- `research://progress/history/{session_id}`
- `research://sessions/{session_id}/state`
- `research://sessions/{session_id}/metrics`

### Resource Access Method

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

### Resource Response Format

Resources return content in MCP format:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "contents": [
      {
        "uri": "research://progress/metrics/session_123",
        "mimeType": "application/json",
        "text": "{\"session_id\": \"session_123\", \"progress\": {...}}"
      }
    ]
  },
  "id": 1
}
```

## Progress Resources

### Progress Metrics Resource

**URI**: `research://progress/metrics/{session_id}`

**Description**: Current progress metrics for a research session, including counts of sources identified, datasets evaluated, datasets acquired, and integration plans created.

**Parameters**:
- `session_id` (string, required): Session ID (extracted from URI or provided in params)

**Response**:
```json
{
  "contents": [
    {
      "uri": "research://progress/metrics/session_123",
      "mimeType": "application/json",
      "text": "{\"session_id\": \"session_123\", \"sources_identified\": 25, \"datasets_evaluated\": 20, \"datasets_acquired\": 15, \"integration_plans_created\": 10, \"last_updated\": \"2025-01-15T10:00:00Z\"}"
    }
  ]
}
```

**Example**:
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

**Update Frequency**: Real-time (updated as operations complete)

**Errors**:
- `INVALID_PARAMS` (-32602): Missing session_id
- `RESOURCE_NOT_FOUND` (-32010): Session not found
- `INTERNAL_ERROR` (-32603): Failed to read progress metrics

---

### Progress History Resource

**URI**: `research://progress/history/{session_id}`

**Description**: Historical progress snapshots for a research session, showing progress over time.

**Parameters**:
- `session_id` (string, required): Session ID (extracted from URI or provided in params)

**Response**:
```json
{
  "contents": [
    {
      "uri": "research://progress/history/session_123",
      "mimeType": "application/json",
      "text": "{\"session_id\": \"session_123\", \"history\": [{\"timestamp\": \"2025-01-15T10:00:00Z\", \"progress\": {\"sources_identified\": 25, \"datasets_evaluated\": 20}}, {\"timestamp\": \"2025-01-15T11:00:00Z\", \"progress\": {\"sources_identified\": 25, \"datasets_evaluated\": 20, \"datasets_acquired\": 15}}]}"
    }
  ]
}
```

**Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "resources/read",
  "params": {
    "uri": "research://progress/history/session_123"
  },
  "id": 1
}
```

**Update Frequency**: Updated with each progress snapshot (typically every 5 seconds during active operations)

**Errors**:
- `INVALID_PARAMS` (-32602): Missing session_id
- `RESOURCE_NOT_FOUND` (-32010): Session not found
- `INTERNAL_ERROR` (-32603): Failed to read progress history

---

## Session Resources

### Session State Resource

**URI**: `research://sessions/{session_id}/state`

**Description**: Complete session state including sources, evaluations, acquisitions, and integration plans.

**Parameters**:
- `session_id` (string, required): Session ID (extracted from URI or provided in params)

**Response**:
```json
{
  "contents": [
    {
      "uri": "research://sessions/session_123/state",
      "mimeType": "application/json",
      "text": "{\"session_id\": \"session_123\", \"target_sources\": [\"pubmed\", \"doaj\"], \"search_keywords\": {\"therapeutic\": [\"therapy\"]}, \"sources\": [...], \"evaluations\": [...], \"acquisitions\": [...], \"integration_plans\": [...]}"
    }
  ]
}
```

**Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "resources/read",
  "params": {
    "uri": "research://sessions/session_123/state"
  },
  "id": 1
}
```

**Update Frequency**: Updated when session state changes (sources added, evaluations completed, etc.)

**Errors**:
- `INVALID_PARAMS` (-32602): Missing session_id
- `RESOURCE_NOT_FOUND` (-32010): Session not found
- `INTERNAL_ERROR` (-32603): Failed to read session state

---

## Metrics Resources

### Session Metrics Resource

**URI**: `research://sessions/{session_id}/metrics`

**Description**: Session metrics including activity logs, error logs, and progress reports.

**Parameters**:
- `session_id` (string, required): Session ID (extracted from URI or provided in params)
- `metric_type` (string, optional): Type of metrics to retrieve
  - Allowed values: `["all", "activity", "errors", "report"]`
  - Default: `"all"`

**Response**:
```json
{
  "contents": [
    {
      "uri": "research://sessions/session_123/metrics",
      "mimeType": "application/json",
      "text": "{\"session_id\": \"session_123\", \"activity_log\": [{\"timestamp\": \"2025-01-15T10:00:00Z\", \"activity\": \"discovery_started\", \"details\": {}}], \"error_log\": [], \"progress_report\": {\"sources_identified\": 25, \"datasets_evaluated\": 20}}"
    }
  ]
}
```

**Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "resources/read",
  "params": {
    "uri": "research://sessions/session_123/metrics",
    "params": {
      "metric_type": "all"
    }
  },
  "id": 1
}
```

**Metric Types**:
- `all`: Returns all metrics (activity log, error log, progress report)
- `activity`: Returns only activity log
- `errors`: Returns only error log
- `report`: Returns only progress report

**Update Frequency**: 
- Activity log: Updated in real-time as activities occur
- Error log: Updated when errors occur
- Progress report: Updated periodically (every 5 seconds during active operations)

**Errors**:
- `INVALID_PARAMS` (-32602): Missing session_id or invalid metric_type
- `RESOURCE_NOT_FOUND` (-32010): Session not found
- `INTERNAL_ERROR` (-32603): Failed to read session metrics

---

## Resource Access

### Listing Resources

List all available resources:

```json
{
  "jsonrpc": "2.0",
  "method": "resources/list",
  "params": {},
  "id": 1
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "resources": [
      {
        "uri": "research://progress/metrics/{session_id}",
        "name": "Progress Metrics",
        "description": "Current progress metrics for a research session",
        "mimeType": "application/json"
      },
      {
        "uri": "research://progress/history/{session_id}",
        "name": "Progress History",
        "description": "Historical progress snapshots for a research session",
        "mimeType": "application/json"
      },
      {
        "uri": "research://sessions/{session_id}/state",
        "name": "Session State",
        "description": "Complete session state including sources, evaluations, acquisitions, and integration plans",
        "mimeType": "application/json"
      },
      {
        "uri": "research://sessions/{session_id}/metrics",
        "name": "Session Metrics",
        "description": "Session metrics including activity logs, error logs, and progress reports",
        "mimeType": "application/json"
      }
    ]
  },
  "id": 1
}
```

### Reading Resources

Read a resource by URI:

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

**Parameters**:
- `uri` (string, required): Resource URI
- `params` (object, optional): Additional parameters for resource access

**Response**: See individual resource documentation above.

---

## Error Handling

### Error Codes

- `INVALID_PARAMS` (-32602): Missing required parameters or invalid parameter types
- `RESOURCE_NOT_FOUND` (-32010): Resource not found (e.g., session not found)
- `RESOURCE_ACCESS_DENIED` (-32011): Access denied (authorization failure)
- `INTERNAL_ERROR` (-32603): Internal server error

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32010,
    "message": "Resource not found: Session session_123 not found",
    "data": {
      "uri": "research://progress/metrics/session_123"
    }
  },
  "id": 1
}
```

### Common Errors

1. **Missing session_id**: Ensure session_id is provided in URI or params
2. **Session not found**: Verify session_id exists
3. **Invalid URI format**: Use correct URI format: `research://{category}/{type}/{identifier}`
4. **Access denied**: Check authentication and authorization

---

## Usage Examples

### Monitor Progress

```json
// Get current progress metrics
{
  "method": "resources/read",
  "params": {
    "uri": "research://progress/metrics/session_123"
  }
}

// Get progress history
{
  "method": "resources/read",
  "params": {
    "uri": "research://progress/history/session_123"
  }
}
```

### Access Session Data

```json
// Get complete session state
{
  "method": "resources/read",
  "params": {
    "uri": "research://sessions/session_123/state"
  }
}

// Get session metrics
{
  "method": "resources/read",
  "params": {
    "uri": "research://sessions/session_123/metrics",
    "params": {
      "metric_type": "activity"
    }
  }
}
```

### List All Resources

```json
{
  "method": "resources/list",
  "params": {}
}
```

---

## Best Practices

1. **URI Format**: Always use the correct URI format with session_id
2. **Parameter Extraction**: Session ID can be extracted from URI or provided in params
3. **Update Frequency**: Resources update at different frequencies; check documentation
4. **Error Handling**: Always handle errors gracefully and check error codes
5. **Caching**: Resources are read-only; consider caching for frequently accessed data
6. **Authorization**: Ensure proper authentication and authorization before accessing resources

---

For more information, see the [API Documentation](./README.md).

