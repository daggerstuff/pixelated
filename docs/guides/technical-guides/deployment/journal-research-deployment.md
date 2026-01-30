## Journal Research Deployment Guide

## Overview

This guide covers deployment of the Journal Research system, including both the FastAPI backend server and the Astro frontend application.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Docker Deployment](#docker-deployment)
- [Manual Deployment](#manual-deployment)
- [Production Deployment](#production-deployment)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

**API Server:**
- Python 3.11+
- Docker 20.10+ (for containerized deployment)
- 2GB RAM minimum
- 10GB disk space

**Frontend:**
- Node.js 24+
- pnpm 10.28.2+
- 4GB RAM minimum
- 5GB disk space

### Required Services

- Authentication service (Better Auth or Supabase)
- Database (if using persistent storage)
- Reverse proxy (Nginx, Caddy, or Traefik)

## Environment Configuration

### API Server Environment Variables

Create a `.env` file or set environment variables:

```bash
# Server Configuration
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=production
API_VERSION=1.0.0
DEBUG=false

# CORS Configuration
CORS_ORIGINS=http://localhost:4321,http://localhost:3000,https://yourdomain.com

# Authentication (REQUIRED)
AUTH_ENABLED=true
JWT_SECRET=your-secret-key-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=1440

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=1000

# Logging
LOG_LEVEL=INFO

# Session Storage
SESSION_STORAGE_PATH=/app/sessions
```

### Frontend Environment Variables

```bash
# API Configuration
PUBLIC_JOURNAL_RESEARCH_API_URL=http://localhost:8000/api/journal-research

# Authentication
PUBLIC_AUTH_URL=http://localhost:4321/api/auth

# Environment
NODE_ENV=production
```

## Docker Deployment

### Quick Start

1. **Build and run API server:**
```bash
cd docker/journal-research-api
docker-compose up -d
```

2. **Verify deployment:**
```bash
curl http://localhost:8000/health
```

### Using Deployment Script

```bash
# Production deployment
./scripts/deployment/deploy-journal-research-api.sh production

# Development deployment
./scripts/deployment/deploy-journal-research-api.sh development
```

### Docker Compose Configuration

The `docker-compose.yml` file includes:
- API server service
- Volume for session storage
- Network configuration
- Health checks

**Customize for your environment:**
```yaml
services:
  journal-research-api:
    environment:
      - JWT_SECRET=${JWT_SECRET}  # Set in .env file
      - CORS_ORIGINS=${CORS_ORIGINS}
    volumes:
      - ./sessions:/app/sessions  # Persistent storage
```

## Manual Deployment

### API Server

1. **Install dependencies:**
```bash
cd ai/journal_dataset_research/api
uv sync --frozen
```

2. **Set environment variables:**
```bash
export JWT_SECRET=your-secret-key
export ENVIRONMENT=production
# ... other variables
```

3. **Run server:**
```bash
python -m ai.journal_dataset_research.api.server
```

Or using uvicorn directly:
```bash
uvicorn ai.journal_dataset_research.api.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4
```

### Frontend

1. **Install dependencies:**
```bash
pnpm install --frozen-lockfile
```

2. **Build:**
```bash
pnpm build
```

3. **Preview (for testing):**
```bash
pnpm preview
```

4. **Production server:**
```bash
pnpm start
```

## Production Deployment

### API Server with Systemd

Create `/etc/systemd/system/journal-research-api.service`:

```ini
[Unit]
Description=Journal Research API Server
After=network.target

[Service]
Type=simple
User=api
WorkingDirectory=/app/ai/journal_dataset_research/api
Environment="PATH=/app/.venv/bin"
EnvironmentFile=/etc/journal-research-api/env
ExecStart=/app/.venv/bin/python -m ai.journal_dataset_research.api.server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl enable journal-research-api
sudo systemctl start journal-research-api
sudo systemctl status journal-research-api
```

### Frontend with Nginx

**Nginx configuration** (`/etc/nginx/sites-available/journal-research`):

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        root /app/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/journal-research {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /api/journal-research/ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/journal-research /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Docker Production Deployment

**docker-compose.prod.yml:**
```yaml
version: '3.8'

services:
  journal-research-api:
    build:
      context: .
      dockerfile: docker/journal-research-api/Dockerfile
    restart: always
    environment:
      - ENVIRONMENT=production
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGINS=https://yourdomain.com
    volumes:
      - journal-research-sessions:/app/sessions
    networks:
      - journal-research-network
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./dist:/usr/share/nginx/html
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - journal-research-api
    networks:
      - journal-research-network

volumes:
  journal-research-sessions:

networks:
  journal-research-network:
    driver: bridge
```

**Deploy:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Monitoring and Health Checks

### Health Check Endpoint

The API provides a health check endpoint:

```bash
curl http://localhost:8000/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "production"
}
```

### Monitoring Setup

**Prometheus metrics** (if configured):
```yaml
scrape_configs:
  - job_name: 'journal-research-api'
    static_configs:
      - targets: ['localhost:8000']
```

**Logging:**
- Logs are output to stdout/stderr
- Configure log aggregation (e.g., ELK, Loki)
- Log level controlled by `LOG_LEVEL` environment variable

### Health Check Script

```bash
#!/bin/bash
# health-check.sh

API_URL=${1:-http://localhost:8000}

response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")

if [ "$response" -eq 200 ]; then
  echo "✅ API is healthy"
  exit 0
else
  echo "❌ API health check failed (HTTP $response)"
  exit 1
fi
```

## Troubleshooting

### Common Issues

#### API Server Won't Start

**Check logs:**
```bash
docker logs journal-research-api
# or
journalctl -u journal-research-api -f
```

**Common causes:**
- Missing `JWT_SECRET` environment variable
- Port 8000 already in use
- Invalid CORS configuration

#### CORS Errors

**Solution:**
- Ensure `CORS_ORIGINS` includes your frontend URL
- Check that frontend is making requests to correct API URL
- Verify authentication headers are included

#### WebSocket Connection Fails

**Solution:**
- Check reverse proxy WebSocket configuration
- Verify WebSocket endpoint is accessible
- Check firewall rules for WebSocket ports

#### Session Storage Issues

**Solution:**
- Verify volume mount permissions
- Check disk space availability
- Ensure `SESSION_STORAGE_PATH` is writable

### Debugging

**Enable debug mode:**
```bash
export DEBUG=true
export LOG_LEVEL=DEBUG
```

**Check API documentation:**
```bash
# Development only
curl http://localhost:8000/api/docs
```

**Test endpoints:**
```bash
# Health check
curl http://localhost:8000/health

# Root endpoint
curl http://localhost:8000/

# List sessions (requires auth)
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/journal-research/sessions
```

## Security Considerations

### Production Checklist

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Use HTTPS for all connections
- [ ] Configure proper CORS origins
- [ ] Enable rate limiting
- [ ] Set up firewall rules
- [ ] Use non-root user in containers
- [ ] Enable authentication
- [ ] Configure proper logging
- [ ] Set up monitoring and alerts
- [ ] Regular security updates

### Secrets Management

**Use environment variables or secrets manager:**
- AWS Secrets Manager
- HashiCorp Vault
- Kubernetes Secrets
- Docker Secrets

**Never commit secrets to version control!**

## Scaling

### Horizontal Scaling

**API Server:**
- Run multiple instances behind load balancer
- Use shared session storage (database or Redis)
- Configure sticky sessions for WebSocket connections

**Frontend:**
- Use CDN for static assets
- Configure caching headers
- Use edge functions for dynamic content

### Vertical Scaling

**API Server:**
- Increase container resources
- Adjust uvicorn workers: `--workers 4`
- Monitor memory and CPU usage

## Backup and Recovery

### Session Data Backup

```bash
# Backup session storage
docker exec journal-research-api tar czf /tmp/sessions-backup.tar.gz /app/sessions
docker cp journal-research-api:/tmp/sessions-backup.tar.gz ./backups/
```

### Recovery

```bash
# Restore session storage
docker cp ./backups/sessions-backup.tar.gz journal-research-api:/tmp/
docker exec journal-research-api tar xzf /tmp/sessions-backup.tar.gz -C /app
```

## Updates and Maintenance

### Updating API Server

```bash
# Pull latest code
git pull

# Rebuild and restart
./scripts/deployment/deploy-journal-research-api.sh production
```

### Updating Frontend

```bash
# Pull latest code
git pull

# Rebuild
pnpm build

# Restart web server
sudo systemctl reload nginx
```

## Support

For deployment issues:
- Check logs: `docker logs journal-research-api`
- Review health check endpoint
- Verify environment variables
- Check network connectivity
- Review API documentation

**Last Updated**: January 2025

