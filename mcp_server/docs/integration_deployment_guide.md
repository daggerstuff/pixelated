# WebSocket-Flask Integration Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the integrated WebSocket real-time communication system with Flask 6-stage pipeline orchestration in production environments.

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd mcp_server

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the integrated services
docker-compose -f docker-compose.integration.yml up -d

# Verify deployment
docker-compose -f docker-compose.integration.yml ps
```

## 📋 Prerequisites

- Docker Engine 24.0+
- Docker Compose 2.20+
- 8GB+ RAM available
- 4+ CPU cores recommended
- 50GB+ disk space

## 🔧 Configuration

### Environment Variables

```bash
# Core Application
MCP_HOST=0.0.0.0
MCP_PORT=8080
API_VERSION=v1
ENVIRONMENT=production

# Database
MONGODB_URI=mongodb://mongodb:27017/mcp_server
MONGODB_USER=admin
MONGODB_PASSWORD=your-secure-password

# Redis
REDIS_URL=redis://redis:6379/0
REDIS_PASSWORD=your-redis-password

# Authentication
JWT_SECRET=your-jwt-secret-minimum-32-characters
JWT_ALGORITHM=HS256
TOKEN_EXPIRATION=3600

# External Services
FLASK_API_URL=http://flask-service:5000
BIAS_DETECTION_URL=http://bias-detection:8000
OPENAI_API_KEY=your-openai-key
GOOGLE_AI_API_KEY=your-google-ai-key

# WebSocket Configuration
WEBSOCKET_ENABLED=true
WEBSOCKET_MAX_CONNECTIONS=1000
WEBSOCKET_CORS_ORIGINS=https://your-domain.com
WEBSOCKET_PING_INTERVAL=25
WEBSOCKET_PING_TIMEOUT=20

# Monitoring
SENTRY_DSN=your-sentry-dsn
PROMETHEUS_ENABLED=true
GRAFANA_ADMIN_PASSWORD=your-grafana-password
```

## 🏗️ Architecture

### Component Interaction Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Nginx LB      │    │  MCP Server     │
│                 │◄──►│                 │◄──►│  (Port 8080)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                │                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Flask Service   │◄──►│   Pipeline API  │    │  Integration    │
│  (Port 5000)    │    │  6-Stage Proc.  │    │   Manager       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Bias Detection  │    │   MongoDB       │    │     Redis       │
│  (Port 8000)    │    │   Database      │    │     Cache       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                └───────────┬───────────┘
                                            ▼
                                ┌─────────────────┐
                                │  Prometheus/    │
                                │   Grafana       │
                                │  Monitoring     │
                                └─────────────────┘
```

## 🔒 Security Configuration

### SSL/TLS Setup
```nginx
# nginx.conf snippet
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    
    location / {
        proxy_pass http://mcp-server:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /ws {
        proxy_pass http://mcp-server:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Authentication & Authorization
- JWT-based authentication with 1-hour token expiration
- Role-based access control (RBAC) for different user types
- API rate limiting: 100 requests/minute per IP
- CORS configured for specific origins only

## 📊 Monitoring & Observability

### Health Checks
All services include comprehensive health checks:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Metrics Collection
- **Prometheus**: Collects metrics from all services
- **Grafana**: Provides dashboards for visualization
- **Key Metrics**:
  - Request latency and throughput
  - WebSocket connection count and message rates
  - Pipeline execution times and success rates
  - Error rates and types
  - Resource utilization (CPU, memory, disk)

### Alerting Rules
```yaml
# prometheus/alerts.yml
groups:
  - name: mcp-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          
      - alert: WebSocketConnectionsHigh
        expr: websocket_connections > 800
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "WebSocket connections approaching limit"
```

## 🚀 Deployment Strategies

### Blue-Green Deployment
```bash
# Deploy to green environment
docker-compose -f docker-compose.green.yml up -d

# Verify green is healthy
./scripts/health-check.sh green

# Switch traffic
./scripts/switch-traffic.sh green

# Cleanup blue
docker-compose -f docker-compose.blue.yml down
```

### Rolling Updates
```bash
# Update with zero downtime
docker-compose -f docker-compose.integration.yml up -d --no-deps --scale mcp-server=2 mcp-server

# Gradually replace instances
for i in {1..3}; do
    docker-compose restart mcp-server
    sleep 30
done
```

## 🔧 Maintenance

### Log Management
```bash
# View logs
docker-compose logs -f mcp-server

# Rotate logs
docker-compose exec mcp-server logrotate /etc/logrotate.conf

# Archive old logs
./scripts/archive-logs.sh
```

### Database Maintenance
```bash
# Backup MongoDB
docker-compose exec mongodb mongodump --out /backup/$(date +%Y%m%d)

# Cleanup old data
docker-compose exec mongodb mongo --eval "db.tasks.deleteMany({createdAt: {\$lt: new Date(Date.now() - 30*24*60*60*1000)}})"
```

### Redis Maintenance
```bash
# Monitor memory usage
docker-compose exec redis redis-cli info memory

# Flush old keys
docker-compose exec redis redis-cli --scan --pattern "mcp:pipeline:*" | xargs docker-compose exec redis redis-cli del
```

## 🚨 Troubleshooting

### Common Issues

1. **WebSocket Connection Failures**
   ```bash
   # Check nginx configuration
   docker-compose exec nginx nginx -t
   
   # Verify WebSocket endpoint
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8080/ws
   ```

2. **Pipeline Execution Timeouts**
   ```bash
   # Check Flask service logs
   docker-compose logs flask-service
   
   # Monitor pipeline execution times
   docker-compose exec prometheus promql --query="histogram_quantile(0.95, pipeline_execution_duration)"
   ```

3. **High Memory Usage**
   ```bash
   # Check container stats
   docker stats
   
   # Analyze memory leaks
   docker-compose exec mcp-server python -m memory_profiler app.py
   ```

### Performance Optimization
- Enable connection pooling for database connections
- Configure Redis with appropriate memory limits
- Use CDN for static assets
- Implement request caching where appropriate
- Monitor and optimize query performance

## 📋 Deployment Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database initialized and seeded
- [ ] All health checks passing
- [ ] Monitoring dashboards accessible
- [ ] Alerting rules configured
- [ ] Backup procedures tested
- [ ] Security scan completed
- [ ] Load testing performed
- [ ] Documentation updated

## 🔗 Related Documentation

- [API Specification](docs/api_specification.md)
- [WebSocket Protocol](docs/websocket_protocol.md)
- [Pipeline Architecture](docs/pipeline_architecture.md)
- [Security Guidelines](docs/security_guidelines.md)
- [Monitoring Setup](docs/monitoring_setup.md)

## 📞 Support

For deployment issues:
1. Check the troubleshooting section above
2. Review service logs: `docker-compose logs <service-name>`
3. Consult the monitoring dashboards
4. Contact the development team with specific error details