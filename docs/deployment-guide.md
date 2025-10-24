# Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Pixelated bias detection platform to production environments. The deployment process is optimized for performance, security, and scalability.

## 🚀 Quick Deployment

### Prerequisites

- **Node.js 24+** with pnpm package manager
- **PostgreSQL 15+** with connection pooling
- **Redis 7+** for caching and session storage
- **Docker & Docker Compose** for containerized deployment
- **Kubernetes cluster** (optional, for high-scale deployment)

### Environment Setup

1. **Clone and configure:**
```bash
git clone https://github.com/pixelated-empathy/platform.git
cd platform
cp .env.example .env
# Edit .env with your configuration
```

2. **Install dependencies:**
```bash
pnpm install
```

3. **Database setup:**
```bash
# Run database migrations
pnpm db:migrate

# Seed initial data (development only)
pnpm db:seed
```

4. **Start services:**
```bash
# Development deployment
pnpm dev:all-services

# Production deployment
docker-compose up -d
```

## 🏗️ Deployment Architecture

### Containerized Deployment (Recommended)

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "4321:4321"
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=pixelated
      - POSTGRES_USER=pixelated_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Kubernetes Deployment

```yaml
# k8s/production/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pixelated-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pixelated
  template:
    metadata:
      labels:
        app: pixelated
    spec:
      containers:
      - name: app
        image: pixelated-empathy/app:latest
        ports:
        - containerPort: 4321
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: pixelated-secrets
              key: db-host
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 4321
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health/simple
            port: 4321
          initialDelaySeconds: 5
          periodSeconds: 5
```

## ⚙️ Configuration

### Environment Variables

#### Required Variables
```bash
# Database
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=pixelated
DB_USER=pixelated_user
DB_PASSWORD=your-secure-password

# Redis
REDIS_URL=redis://your-redis-host:6379
REDIS_PASSWORD=your-redis-password

# Authentication
JWT_SECRET=your-jwt-secret-min-32-chars

# Application
NODE_ENV=production
PUBLIC_SITE_URL=https://yourdomain.com

# Monitoring
SENTRY_DSN=https://your-sentry-dsn
```

#### Optional Variables
```bash
# Performance
API_TIMEOUT=10000
DB_MAX_CONNECTIONS=20
REDIS_TTL=3600

# Security
CORS_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX_REQUESTS=100

# CDN
CDN_BASE_URL=https://cdn.yourdomain.com

# Monitoring
NEW_RELIC_LICENSE_KEY=your-newrelic-key
```

### Secrets Management

**Recommended:** Use external secrets management:
```bash
# Using AWS Secrets Manager
aws secretsmanager create-secret \
  --name pixelated/production \
  --secret-string file://secrets.json

# Using Kubernetes secrets
kubectl create secret generic pixelated-secrets \
  --from-env-file=.env.secrets
```

## 🚀 Deployment Strategies

### Blue-Green Deployment

```bash
# Deploy to staging (blue environment)
kubectl apply -f k8s/staging/

# Validate deployment
kubectl rollout status deployment/pixelated-app-blue

# Switch traffic to new version (green)
kubectl patch service pixelated-service -p \
  '{"spec":{"selector":{"app":"pixelated","version":"green"}}}'

# Rollback if needed
kubectl patch service pixelated-service -p \
  '{"spec":{"selector":{"app":"pixelated","version":"blue"}}}'
```

### Rolling Updates

```bash
# Update deployment with rolling strategy
kubectl patch deployment pixelated-app -p \
  '{"spec":{"strategy":{"type":"RollingUpdate","rollingUpdate":{"maxUnavailable":"25%","maxSurge":"25%"}}}}'

# Monitor rollout
kubectl rollout status deployment/pixelated-app
```

### Canary Deployment

```bash
# Deploy canary version
kubectl set image deployment/pixelated-app app=pixelated-empathy/app:canary

# Route 10% traffic to canary
kubectl patch service pixelated-service -p \
  '{"spec":{"selector":{"app":"pixelated"},"ports":[{"port":80,"targetPort":4321}]}}'

# Gradually increase traffic based on metrics
```

## 🔍 Health Checks & Monitoring

### Health Endpoints

```bash
# Comprehensive health check
curl https://yourdomain.com/api/health

# Simple health check (for load balancers)
curl https://yourdomain.com/api/health/simple

# Database connectivity check
curl https://yourdomain.com/api/health?check=db
```

### Monitoring Setup

#### Application Metrics
```typescript
// Built-in performance monitoring
const metrics = {
  responseTime: performance.now() - startTime,
  cacheHitRate: await getCacheHitRate(),
  databaseLatency: await getDatabaseLatency(),
  errorRate: getErrorRate()
};
```

#### Infrastructure Monitoring
```yaml
# Prometheus metrics endpoint
scrape_configs:
  - job_name: 'pixelated'
    static_configs:
      - targets: ['your-app:4321']
    metrics_path: '/metrics'
```

## 🔒 Security Hardening

### SSL/TLS Configuration

```nginx
# Nginx configuration for SSL
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.com.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    location / {
        proxy_pass http://pixelated-app:4321;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Firewall Rules

```bash
# Basic firewall configuration
sudo ufw allow ssh
sudo ufw allow https
sudo ufw allow http  # Remove in production

# Database firewall (restrict to app servers only)
sudo ufw allow from 10.0.0.0/8 to any port 5432
sudo ufw allow from 172.16.0.0/12 to any port 5432
```

## 📊 Performance Optimization

### Load Balancer Configuration

```hcl
# Terraform for load balancer
resource "aws_lb" "pixelated" {
  name               = "pixelated-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.pixelated.id]
  subnets            = aws_subnet.public.*.id

  enable_deletion_protection = true

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/api/health/simple"
    port                = "traffic-port"
    timeout             = 5
    unhealthy_threshold = 2
  }
}
```

### CDN Configuration

```javascript
// Cloudflare configuration
const cdnConfig = {
  provider: 'cloudflare',
  baseUrl: 'https://cdn.yourdomain.com',
  edgeCache: {
    defaultTTL: 3600,
    maxTTL: 86400,
    staleWhileRevalidate: 300
  }
};
```

## 🚨 Troubleshooting

### Common Deployment Issues

#### Database Connection Errors
```bash
# Check database connectivity
pnpm db:health

# Verify connection pool settings
curl https://yourdomain.com/api/health?check=db
```

#### High Memory Usage
```bash
# Check application metrics
curl https://yourdomain.com/api/admin/metrics

# Monitor resource usage
kubectl top pods
```

#### Slow Response Times
```bash
# Check cache hit rates
curl https://yourdomain.com/api/health

# Monitor database query performance
pnpm performance:quick
```

### Emergency Procedures

#### Rollback Deployment
```bash
# Kubernetes rollback
kubectl rollout undo deployment/pixelated-app

# Docker rollback
docker-compose down
git pull origin main
docker-compose up -d
```

#### Service Recovery
```bash
# Restart all services
docker-compose restart

# Check service health
docker-compose ps

# View logs
docker-compose logs -f app
```

## 📋 Production Checklist

### Pre-Deployment
- [ ] All tests passing (`pnpm test:all`)
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Secrets management implemented
- [ ] SSL certificates installed
- [ ] DNS configured
- [ ] CDN configured
- [ ] Monitoring setup complete

### Post-Deployment
- [ ] Health checks passing
- [ ] All endpoints responding
- [ ] Performance metrics within targets
- [ ] Error rates < 1%
- [ ] Cache hit rates > 90%
- [ ] Database response times < 500ms

### Security Verification
- [ ] SSL/TLS properly configured
- [ ] Security headers present
- [ ] Authentication working
- [ ] Rate limiting functional
- [ ] Audit logging operational
- [ ] Secrets not exposed in logs

## 🔧 Maintenance

### Regular Tasks

#### Daily
- Monitor error rates and response times
- Check database and cache performance
- Review security logs
- Verify backup integrity

#### Weekly
- Update dependencies (`pnpm update`)
- Review and optimize slow queries
- Analyze performance trends
- Check resource utilization

#### Monthly
- Security patch updates
- Performance optimization review
- Capacity planning
- Compliance audit

### Backup Strategy

```bash
# Database backups
pg_dump pixelated > backup_$(date +%Y%m%d).sql

# Application configuration backup
tar -czf config_backup_$(date +%Y%m%d).tar.gz config/

# Automated backup script
./scripts/backup/backup-system.sh
```

## 📞 Support & Escalation

### Development Support
- **Issues**: [GitHub Issues](https://github.com/pixelated-empathy/issues)
- **Discussions**: [GitHub Discussions](https://github.com/pixelated-empathy/discussions)
- **Documentation**: This deployment guide

### Production Support
- **On-call**: production-support@pixelatedempathy.com
- **Emergency**: +1-555-PIXELATED (24/7)
- **Status Page**: status.pixelatedempathy.com

### Escalation Matrix
1. **Level 1**: Development team (response: < 1 hour)
2. **Level 2**: Technical lead (response: < 4 hours)
3. **Level 3**: Management (response: < 24 hours)

## 📈 Performance Monitoring

### Key Metrics to Monitor

| Metric | Target | Alert Threshold | Action |
|--------|--------|-----------------|---------|
| Response Time | < 2s | > 5s | Scale horizontally |
| Error Rate | < 1% | > 5% | Investigate immediately |
| Cache Hit Rate | > 90% | < 80% | Review cache strategy |
| Database Latency | < 500ms | > 2000ms | Query optimization |
| CPU Usage | < 70% | > 90% | Scale up/down |

### Monitoring Tools
- **Application**: Built-in performance monitoring
- **Infrastructure**: Prometheus + Grafana
- **Error Tracking**: Sentry
- **Analytics**: Custom analytics pipeline

## 🎯 Optimization

### Performance Tuning

#### Application Level
```bash
# Build optimized version
NODE_ENV=production pnpm build:optimized

# Start with performance monitoring
PERFORMANCE_MONITORING=1 pnpm start
```

#### Database Level
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM bias_analyses WHERE therapist_id = $1;

-- Optimize slow queries
CREATE INDEX CONCURRENTLY idx_bias_analyses_performance
ON bias_analyses(therapist_id, created_at DESC, overall_bias_score);
```

#### Infrastructure Level
```yaml
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: pixelated-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pixelated-app
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## 📚 Additional Resources

- **[API Documentation](./api/README.md)** - Complete API reference
- **[Performance Guide](./performance-optimization.md)** - Performance tuning guide
- **[Security Guide](./security-guide.md)** - Security best practices
- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

---

**Deployment Status**: ✅ Production Ready (95% Complete)
**Last Updated**: 2024-12-19
**Version**: 1.0.0

---

## Production Deployment (Helm + GKE)

This section describes how to deploy the Pixelated app to production using Helm and the GKE workflows.

### Prerequisites
- kubectl and helm installed
- Access to the target Kubernetes cluster
- Container image published to the registry (e.g., GHCR)

### Helm Production Values
Use the provided production overrides in `helm/values-production.yaml`.

### Deploy via Script
```
./scripts/deploy/production_deploy.sh \
  -r pixelated \
  -n production \
  -i ghcr.io/pixelated/ai-service \
  -t <IMAGE_TAG> \
  --wait
```

### Deploy via GitHub Actions
Use the `GKE Production Deploy` workflow (`.github/workflows/gke-production-deploy.yml`) with `workflow_dispatch` inputs:
- release, namespace, image, tag
Optionally provide a base64 kubeconfig if not using GKE auth steps in the workflow.

### Post-Deployment
- Verify rollout status in the script output
- Check service health endpoints `/healthz` and `/readyz`
- Monitor safety metrics dashboard and alert rules
