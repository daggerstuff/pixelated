## Journal Dataset Research MCP Server Deployment Guide

This guide provides comprehensive instructions for deploying the Journal Dataset Research MCP Server.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Docker Deployment](#docker-deployment)
- [Manual Deployment](#manual-deployment)
- [Configuration](#configuration)
- [MCP Client Configuration](#mcp-client-configuration)
- [Monitoring and Logging](#monitoring-and-logging)
- [Troubleshooting](#troubleshooting)

## Overview

The Journal Dataset Research MCP Server provides a Model Context Protocol (MCP) interface for AI agents to interact with the journal dataset research system. The server can be deployed using Docker or manually.

## Prerequisites

- Python 3.11+
- Docker and Docker Compose (for Docker deployment)
- uv package manager (for manual deployment)
- Access to journal dataset research backend services
- Sufficient disk space for session storage and logs

## Environment Configuration

### Environment Variables

Create a `.env` file or set environment variables:

```bash
# Server configuration
MCP_HOST=0.0.0.0
MCP_PORT=8001
MCP_ENVIRONMENT=production
MCP_DEBUG=false

# Protocol configuration
MCP_PROTOCOL_VERSION=2024-11-05
MCP_SERVER_NAME=journal-dataset-research-mcp
MCP_SERVER_VERSION=0.1.0

# Authentication
MCP_AUTH_ENABLED=true
MCP_AUTH_API_KEY_REQUIRED=true
MCP_API_KEYS=key1,key2,key3
MCP_JWT_SECRET=your-secret-key-change-in-production
MCP_JWT_ALGORITHM=HS256
MCP_JWT_EXPIRATION_MINUTES=1440

# Rate limiting
MCP_RATE_LIMITS_ENABLED=true
MCP_RATE_LIMIT_PER_MINUTE=60
MCP_RATE_LIMIT_PER_HOUR=1000
MCP_RATE_LIMIT_BURST=10

# Logging
MCP_LOG_LEVEL=INFO
MCP_LOG_FILE=/app/logs/mcp.log
MCP_AUDIT_LOG_PATH=/app/logs/mcp_audit.log

# Async operations
MCP_ASYNC_TIMEOUT=3600
MCP_PROGRESS_UPDATE_INTERVAL=5

# Session storage
SESSION_STORAGE_PATH=/app/sessions
```

### Security Considerations

1. **API Keys**: Use strong, unique API keys for production
2. **JWT Secret**: Use a strong, random secret for JWT tokens
3. **Environment**: Set `MCP_ENVIRONMENT=production` for production deployments
4. **Debug Mode**: Set `MCP_DEBUG=false` for production
5. **Rate Limiting**: Enable rate limiting to prevent abuse

## Docker Deployment

### Using Docker Compose

1. **Navigate to the docker directory**:
```bash
cd docker/journal-research-mcp-server
```

2. **Create `.env` file** with your configuration (see [Environment Configuration](#environment-configuration))

3. **Start the server**:
```bash
docker-compose up -d
```

4. **Check logs**:
```bash
docker-compose logs -f journal-research-mcp-server
```

5. **Stop the server**:
```bash
docker-compose down
```

### Using Docker

1. **Build the image**:
```bash
docker build -f docker/journal-research-mcp-server/Dockerfile -t journal-research-mcp-server:latest .
```

2. **Run the container**:
```bash
docker run -d \
  --name journal-research-mcp-server \
  -p 8001:8001 \
  --env-file .env \
  -v journal-research-mcp-sessions:/app/sessions \
  -v journal-research-mcp-logs:/app/logs \
  journal-research-mcp-server:latest
```

## Manual Deployment

### Installation

1. **Install dependencies**:
```bash
uv sync
```

2. **Set environment variables** (see [Environment Configuration](#environment-configuration))

3. **Create directories**:
```bash
mkdir -p logs sessions
```

4. **Run the server**:
```bash
uv run python -m ai.journal_dataset_research.mcp.server
```

### Systemd Service

Create a systemd service file at `/etc/systemd/system/journal-research-mcp-server.service`:

```ini
[Unit]
Description=Journal Dataset Research MCP Server
After=network.target

[Service]
Type=simple
User=mcp
WorkingDirectory=/app
EnvironmentFile=/etc/journal-research-mcp-server/.env
ExecStart=/app/.venv/bin/python -m ai.journal_dataset_research.mcp.server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl enable journal-research-mcp-server
sudo systemctl start journal-research-mcp-server
```

## Configuration

### MCP Server Configuration File

The server can be configured via environment variables (see [Environment Configuration](#environment-configuration)). Future versions may support YAML/JSON configuration files.

### Backend Integration

The MCP server integrates with the journal dataset research backend through the `CommandHandlerService`. Ensure the backend is accessible and properly configured.

### Session Storage

Sessions are stored in the directory specified by `SESSION_STORAGE_PATH`. Ensure this directory:
- Has sufficient disk space
- Has proper permissions (read/write for the server user)
- Is backed up regularly

## MCP Client Configuration

### Cursor Configuration

Add to `~/.cursor/mcp.json` or `~/.openhands/mcp.json`:

```json
{
  "mcpServers": {
    "journal-research": {
      "command": "uv",
      "args": [
        "run",
        "python",
        "-m",
        "ai.journal_dataset_research.mcp.server"
      ],
      "env": {
        "MCP_HOST": "0.0.0.0",
        "MCP_PORT": "8001",
        "MCP_AUTH_ENABLED": "true",
        "MCP_API_KEYS": "your-api-key"
      }
    }
  }
}
```

### HTTP Transport (if supported)

For HTTP transport, configure the client to connect to:
```
http://localhost:8001
```

With authentication header:
```
Authorization: Bearer your-api-key
```

## Monitoring and Logging

### Log Files

- **Application Logs**: `MCP_LOG_FILE` (default: `/app/logs/mcp.log`)
- **Audit Logs**: `MCP_AUDIT_LOG_PATH` (default: `/app/logs/mcp_audit.log`)

### Log Rotation

Logs are automatically rotated:
- Max file size: 10 MB
- Backup count: 5

### Health Checks

The server includes health check endpoints (if HTTP transport is enabled):
- Health endpoint: `GET /health`
- Metrics endpoint: `GET /metrics`

### Monitoring

Monitor the following:
- Server uptime and availability
- Request rate and latency
- Error rates
- Rate limit violations
- Authentication failures
- Tool execution times

## Troubleshooting

### Common Issues

1. **Server won't start**:
   - Check environment variables are set correctly
   - Verify Python version (3.11+)
   - Check logs for errors

2. **Authentication failures**:
   - Verify API keys are correct
   - Check JWT secret is set
   - Ensure authentication is enabled

3. **Rate limit exceeded**:
   - Adjust rate limit settings
   - Check for client issues causing excessive requests

4. **Session storage errors**:
   - Verify storage path exists and is writable
   - Check disk space
   - Verify permissions

5. **Backend connection errors**:
   - Verify backend services are running
   - Check network connectivity
   - Verify backend configuration

### Debug Mode

Enable debug mode for detailed logging:
```bash
MCP_DEBUG=true
MCP_LOG_LEVEL=DEBUG
```

### Log Analysis

View recent logs:
```bash
tail -f /app/logs/mcp.log
tail -f /app/logs/mcp_audit.log
```

## Production Checklist

- [ ] Set `MCP_ENVIRONMENT=production`
- [ ] Set `MCP_DEBUG=false`
- [ ] Configure strong API keys
- [ ] Set strong JWT secret
- [ ] Enable rate limiting
- [ ] Configure log rotation
- [ ] Set up monitoring
- [ ] Configure backups for session storage
- [ ] Test authentication and authorization
- [ ] Test all tools and resources
- [ ] Verify health checks
- [ ] Document deployment procedures

## Support

For issues, questions, or contributions, please see the project repository.

---

For API documentation, see [MCP Server API Documentation](../api/mcp-server/README.md).

