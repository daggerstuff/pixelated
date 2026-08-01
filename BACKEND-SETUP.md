# Backend Setup Guide

This guide covers the unified Docker Compose backend stack for Pixelated Empathy.

## Overview

The backend consists of:

- **Databases**: PostgreSQL 17, Redis, MongoDB
- **API Services**: Express API (port 5000), FastAPI clinical backend (port 8000)
- **AI Microservices**: Bias detection (8001), AI service (8002), WebSocket server (3001)
- **Background Workers**: Job worker, training server (8084)
- **Monitoring**: Prometheus (9090), Grafana (3100), Alertmanager (9093), Loki (3100)

## Quick Start

### Prerequisites

1. Copy the environment file:
   ```bash
   cp .env.backend.example .env.backend
   ```

2. Edit `.env.backend` and set required passwords:
   ```bash
   POSTGRES_PASSWORD=your-secure-password
   REDIS_PASSWORD=your-redis-password
   ```

3. Comment out empty optional variables (Zod validation fails on empty strings):
   ```bash
   # Comment these if not using:
   # SENTRY_DSN=
   # PUBLIC_SENTRY_DSN=
   # SLACK_WEBHOOK_URL=
   ```

### Start the Backend

```bash
# Load environment and start
set -a && source .env.backend && set +a
sudo env POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" REDIS_PASSWORD="${REDIS_PASSWORD}" \
  docker compose -f docker/docker-compose.backend.yml up -d
```

### Verify Health

```bash
# Check all containers
sudo docker ps --format "table {{.Names}}\t{{.Status}}"

# Run health check script
./scripts/devops/backend-health-check.sh
```

All services should report `(healthy)` after 30-60 seconds.

## Architecture

### Service Dependencies

```
postgres, redis, mongo (databases)
  ↓
express-api, pe-backend, bias-detection, ai-service, websocket-server, worker
  ↓
training-server (depends on postgres)
```

### Port Mappings

| Service | Container Port | Host Port | Health Check |
|---------|---------------|-----------|--------------|
| Express API | 5000 | 5000 | `/api/health` |
| FastAPI Backend | 8000 | 8000 | `/health` |
| Bias Detection | 8001 | 8001 | `/health` |
| AI Service | 8002 | 8002 | `/health` |
| WebSocket Server | 3001 | 3001 | `/health` |
| Training Server | 8084 | 8084 | `/health` |
| Prometheus | 9090 | 9090 | N/A |
| Grafana | 3000 | 3100 | N/A |
| Alertmanager | 9093 | 9093 | N/A |
| Loki | 3100 | 3100 | N/A |

### Network

All services run on the `pe-net` Docker network and communicate via container names (e.g., `http://pe-bias-detection:8001`).

## Common Issues

### Rate Limiter Blocking Health Checks

**Problem**: Express API health check returns 429 (Too Many Requests).

**Solution**: The health route is mounted before the rate limiter middleware in `src/api/server.ts` (line 117). This ensures health checks bypass rate limiting.

### Bias Detection Service Unhealthy

**Problem**: Container shows `(unhealthy)` but logs show "Python service unavailable".

**Expected**: This is normal. The bias detection service has an in-JS fallback and operates without the Python service.
The health check verifies the Node server is running, not the Python service.

**Logs**: You'll see repeated "fetch failed" messages for `http://localhost:5000/health` — this is the Python bridge retrying. The service continues operating with fallback analysis.

### WebSocket Server Port Mismatch

**Problem**: Health check fails with "Connection refused" on port 4321.

**Solution**: The WebSocket server listens on port 3001 (configured via `WS_PORT` env var). The Dockerfile and compose file both use port 3001.

### Empty Environment Variables

**Problem**: Zod validation errors on startup:
```
ZodError: [
  {
    "code": "invalid_string",
    "validation": "url",
    "path": ["SENTRY_DSN"],
    "message": "Invalid url"
  }
]
```

**Solution**: Comment out empty optional variables in `.env.backend`:
```bash
# SENTRY_DSN=
# PUBLIC_SENTRY_DSN=
# SLACK_WEBHOOK_URL=
```

Zod's `z.url().optional()` rejects empty strings. Commenting the line makes the variable undefined, which Zod accepts.

### Database Connection Failures

**Problem**: Services fail to connect to databases on startup.

**Solution**: The compose file uses `depends_on` with `condition: service_healthy` to ensure databases are ready before services start. Check database health:
```bash
sudo docker exec pe-postgres pg_isready -U pixelated
sudo docker exec pe-redis redis-cli ping
sudo docker exec pe-mongo mongosh --eval "db.adminCommand('ping')"
```

## Maintenance

### View Logs

```bash
# All services
sudo docker compose -f docker/docker-compose.backend.yml logs -f

# Specific service
sudo docker logs -f pe-express-api
```

### Restart Services

```bash
# Restart all
sudo docker compose -f docker/docker-compose.backend.yml restart

# Restart specific service
sudo docker compose -f docker/docker-compose.backend.yml restart express-api
```

### Rebuild After Code Changes

```bash
# Rebuild specific service
sudo docker compose -f docker/docker-compose.backend.yml build express-api

# Recreate container with new image
sudo docker compose -f docker/docker-compose.backend.yml up -d --force-recreate express-api
```

### Reset Everything

```bash
# Stop and remove all containers, networks
sudo docker compose -f docker/docker-compose.backend.yml down

# Remove volumes (WARNING: deletes all data)
sudo docker compose -f docker/docker-compose.backend.yml down -v

# Rebuild and start fresh
sudo docker compose -f docker/docker-compose.backend.yml up -d --build
```

## Monitoring

### Grafana Dashboards

Access Grafana at http://localhost:3100 (default credentials: admin/admin).

Pre-provisioned dashboards:
- AI Monitoring
- Pixelated Overview
- System Health
- Threat Detection

### Prometheus Metrics

Access Prometheus at http://localhost:9090.

Scrape targets:
- `express-api`: Node.js metrics
- `pe-backend`: Python metrics
- `bias-detection`: Bias detection metrics
- `ai-service`: AI service metrics

### Alertmanager

Access Alertmanager at http://localhost:9093.

Configure alert routes in `docker/alertmanager/alertmanager.yml`.

## Development

### Local Development Without Docker

For rapid iteration, you can run services locally:

```bash
# Start only databases
sudo docker compose -f docker/docker-compose.backend.yml up -d postgres redis mongo

# Run services locally
pnpm dev  # Starts Express API on port 5000
```

### Adding a New Service

1. Create Dockerfile in `docker/` directory
2. Add service to `docker/docker-compose.backend.yml`:
   ```yaml
   my-service:
     build:
       context: ..
       dockerfile: docker/my-service.Dockerfile
     container_name: pe-my-service
     env_file:
       - ../.env.backend
     ports:
       - 'PORT:PORT'
     depends_on:
       postgres:
         condition: service_healthy
       redis:
         condition: service_healthy
     healthcheck:
       test: ['CMD-SHELL', "curl -sf http://localhost:PORT/health || exit 1"]
       interval: 15s
       timeout: 5s
       retries: 3
       start_period: 20s
     restart: unless-stopped
     networks:
       - pe-net
   ```
3. Add health check to `scripts/devops/backend-health-check.sh`
4. Rebuild and start: `sudo docker compose -f docker/docker-compose.backend.yml up -d --build my-service`

## Troubleshooting

### Container Won't Start

```bash
# Check logs
sudo docker logs pe-my-service

# Check if port is in use
sudo lsof -i :PORT

# Remove and recreate
sudo docker rm -f pe-my-service
sudo docker compose -f docker/docker-compose.backend.yml up -d my-service
```

### Health Check Fails but Service is Running

```bash
# Test health endpoint manually
sudo docker exec pe-my-service curl -v http://localhost:PORT/health

# Check if service is listening
sudo docker exec pe-my-service netstat -tlnp | grep PORT
```

### Database Migration Issues

```bash
# Run migrations manually
sudo docker exec pe-postgres psql -U pixelated -d pixelated_empathy -c "SELECT * FROM alembic_version;"

# Reset migrations (WARNING: deletes data)
sudo docker compose -f docker/docker-compose.backend.yml down -v
sudo docker compose -f docker/docker-compose.backend.yml up -d
```

## Security Notes

- Never commit `.env.backend` (already in `.gitignore`)
- Use strong, unique passwords for `POSTGRES_PASSWORD` and `REDIS_PASSWORD`
- Rotate secrets regularly
- Review Alertmanager webhook URLs before enabling notifications
- All services run on a private Docker network (`pe-net`) — only expose ports you need

## Further Reading

- [Docker Compose file reference](https://docs.docker.com/compose/compose-file/)
- [PostgreSQL documentation](https://www.postgresql.org/docs/)
- [Redis documentation](https://redis.io/docs/)
- [Grafana documentation](https://grafana.com/docs/)
