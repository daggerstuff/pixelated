---
title: 'Centralized Logging System'
description: 'Comprehensive documentation for our ELK-based centralized logging infrastructure'
pubDate: '2025-01-01'
author: 'DevOps Team'
draft: false
toc: true
share: true
date: '2025-04-12'
---

# Centralized Logging System

This document provides a comprehensive guide to our centralized logging system built on the ELK stack (Elasticsearch, Logstash, Kibana).

## Overview

Our centralized logging system provides:

- **Log Collection**: Automatic collection of logs from all application components
- **Structured Storage**: Indexed storage of logs in Elasticsearch
- **Advanced Visualization**: Real-time dashboards in Kibana
- **Automated Retention**: Configurable retention policies for different log types
- **Log Archiving**: Long-term storage of important logs

## Architecture

The centralized logging system consists of the following components:

1. **Logger**: Application-level logger that generates structured logs (`src/lib/logging`)
2. **ELK Service**: Integration with Elasticsearch for storing logs (`src/lib/services/logging/elk.ts`)
3. **Log Retention**: Management of log retention policies (`src/lib/services/logging/log-retention.ts`)
4. **Log Visualization**: Creation and configuration of Kibana dashboards (`src/lib/services/logging/log-visualization.ts`)
5. **Kibana Dashboard Generator**: Utilities for creating dashboards (`src/lib/services/logging/kibana-dashboard.ts`)

## Configuration

### Environment Variables

Configure the centralized logging system with the following environment variables:

```
# ELK Configuration
ELK_ENABLED=true
ELK_URL=http://elasticsearch:9200
ELK_INDEX_PREFIX=app-logs
ELK_USERNAME=elastic
ELK_PASSWORD=changeme
$1=YOUR_API_KEY_HERE
ELK_NODE_NAME=app-server-1
ELK_KIBANA_URL=http://kibana:5601
ELK_KIBANA_SPACE=default

# Log Retention Configuration
LOG_RETENTION_ENABLED=true
LOG_RETENTION_DAYS=90
APP_LOG_RETENTION_DAYS=90
API_LOG_RETENTION_DAYS=90
ERROR_LOG_RETENTION_DAYS=180
SECURITY_LOG_RETENTION_DAYS=365
AUDIT_LOG_RETENTION_DAYS=730
SERVER_LOG_RETENTION_DAYS=60
NETWORK_LOG_RETENTION_DAYS=60
DB_LOG_RETENTION_DAYS=90

# Log Archiving Configuration
LOG_ARCHIVING_ENABLED=true
LOG_ARCHIVE_DESTINATION=cold_storage
LOG_ARCHIVE_AFTER_DAYS=30

# Visualization Configuration
ELK_DEFAULT_TIME_FROM=now-24h
ELK_DEFAULT_TIME_TO=now
ELK_REFRESH_INTERVAL=30s
```

### Initialization

The centralized logging system is automatically initialized in `src/middleware.ts`. You can also manually initialize it:

```typescript

// Initialize all logging services
loggingServices.initialize({
  elk: {
    enabled: true,
    url: 'http://elasticsearch:9200',
    indexPrefix: 'custom-app-logs',
  },
  retention: {
    defaultRetentionDays: 120,
    retentionByType: {
      errorLogs: 180,
      securityLogs: 365,
    },
    archiving: {
      enabled: true,
      destination: 's3',
      afterDays: 30,
    },
  },
  visualization: {
    kibanaUrl: 'http://kibana:5601',
    spaceId: 'my-app',
  },
})

// Set up log interception to capture logs from the standard logger
loggingServices.setupInterception()

// Schedule log retention tasks to run automatically
const cleanupTask = loggingServices.scheduleRetention()
```

## Usage Examples

### Application Logging

Use the standard logger throughout your application:

```typescript

// Use the default logger
logger.info('Application started')

// Or create a namespaced logger for a specific component
const apiLogger = getLogger({ prefix: 'api-service' })
apiLogger.info('API request received', {
  method: 'GET',
  path: '/api/users',
  ip: '192.168.1.1',
})

// Log errors with details
try {
  // Some operation
} catch (error) {
  logger.error('Failed to perform operation', {
    error,
    context: 'user-service',
    userId: 123,
  })
}
```

### Creating Custom Dashboards

Create custom dashboards for specific application components:

```typescript

// Create a custom dashboard for API monitoring
async function createApiDashboard() {
  // Define the endpoints to monitor
  const endpoints = ['/api/v1/users', '/api/v1/products', '/api/v1/orders']

  // Define common error types
  const errorTypes = ['ValidationError', 'AuthenticationError', 'DatabaseError']

  // Create the dashboard
  await logVisualization.createApplicationMonitoringDashboard(
    'API Service',
    endpoints,
    errorTypes,
    {
      timeRange: { from: 'now-7d', to: 'now' },
      refreshInterval: '1m',
    },
  )

  console.log('API monitoring dashboard created')
}

// Generate an embed URL for a dashboard
function getEmbedUrl(dashboardId) {
  return logVisualization.generateEmbedUrl(dashboardId, {
    timeRange: { from: 'now-24h', to: 'now' },
    darkMode: true,
  })
}
```

### Managing Log Retention

Configure and manage log retention policies:

```typescript

// Set up ILM policies in Elasticsearch
async function setupRetentionPolicies() {
  await logRetention.setupILMPolicies()

  // Apply policies to index patterns
  await logRetention.applyPolicyToIndexPattern('app-logs-*', 'app-logs-policy')
  await logRetention.applyPolicyToIndexPattern('api-logs-*', 'api-logs-policy')
  await logRetention.applyPolicyToIndexPattern(
    'error-logs-*',
    'error-logs-policy',
  )
  await logRetention.applyPolicyToIndexPattern(
    'security-logs-*',
    'security-logs-policy',
  )
  await logRetention.applyPolicyToIndexPattern(
    'audit-logs-*',
    'audit-logs-policy',
  )

  console.log('Log retention policies set up successfully')
}

// Run manual cleanup (usually scheduled, but can be triggered manually)
async function cleanupOldLogs() {
  await logRetention.runManualCleanup()
  console.log('Manual log cleanup completed')
}
```

## Standard Dashboards

The system includes several pre-defined dashboards:

1. **Application Overview**: General application performance and health
2. **Error Tracking**: Detailed view of application errors
3. **API Monitoring**: API performance and usage metrics
4. **User Activity**: User sessions and behavior analytics
5. **Security Events**: Authentication and authorization events

Access these dashboards in Kibana at `http://kibana:5601/app/dashboards`.

## Best Practices

### Structured Logging

Always use structured logging with metadata:

```typescript
// Good: Structured log with metadata
logger.info('User logged in', {
  userId: 123,
  ip: '192.168.1.1',
  device: 'mobile',
})

// Bad: Unstructured log with string concatenation
logger.info('User 123 logged in from 192.168.1.1 using mobile')
```

### Log Levels

Use appropriate log levels:

- **debug**: Detailed information for debugging
- **info**: General operational events
- **warn**: Non-critical issues that should be addressed
- **error**: Errors that affect functionality

### Security Considerations

- Do not log sensitive information (passwords, tokens, etc.)
- Always log security events (login attempts, permission changes, etc.)
- Use audit logs for compliance-required events

### Performance Impact

- Be mindful of log volume in high-traffic sections
- Consider using sampling for very high-volume events
- Use batch operations for log processing

## Troubleshooting

### Common Issues

1. **Logs not appearing in Elasticsearch**
   - Check ELK_ENABLED environment variable
   - Verify Elasticsearch connection in logs
   - Check network connectivity between app and Elasticsearch

2. **Kibana dashboard not showing data**
   - Verify index patterns in Kibana
   - Check time range selection
   - Confirm log format matches Kibana mappings

3. **High disk usage in Elasticsearch**
   - Verify retention policies are applied
   - Check ILM policy setup in Elasticsearch
   - Run manual cleanup if needed

### Debugging Tools

Use the following tools to debug logging issues:

```typescript
// Check ELK connection
const isConnected = await elkService.testConnection()
console.log('ELK connection:', isConnected ? 'OK' : 'Failed')

// Get index statistics
const indexStats = await elkService.getIndexStats()
console.log('Log indices:', indexStats)
```

## Additional Information

### Updating the ELK Stack

When upgrading the ELK stack:

1. Update Elasticsearch first
2. Update Logstash
3. Update Kibana
4. Test with a small subset of logs
5. Verify visualizations and dashboards
6. Roll out to production

### Scaling Considerations

For high-volume logging:

1. Consider using Elasticsearch clusters
2. Implement log shipping with Filebeat
3. Use buffer queues for peak traffic
4. Optimize index management with ILM

### Security Configuration

Secure your ELK stack:

1. Use TLS for all connections
2. Implement proper authentication
3. Use API keys instead of username/password
4. Apply role-based access control in Kibana

## Conclusion

The centralized logging system provides comprehensive visibility into application behavior and performance. Use it to monitor application health, troubleshoot issues, and gain insights into user activity.
