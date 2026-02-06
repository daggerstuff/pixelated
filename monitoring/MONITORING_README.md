# Monitoring & Observability

This directory contains comprehensive monitoring and observability infrastructure for Pixelated Empathy.

## Overview

The monitoring system provides:

- **Metrics Collection** with Prometheus
- **Visualization** with Grafana dashboards
- **Log Aggregation** with Loki and Promtail
- **Alerting** with Alertmanager
- **Application Performance Monitoring** with custom metrics
- **Infrastructure Monitoring** with Node Exporter and cAdvisor
- **Database Monitoring** with PostgreSQL and Redis exporters

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │───▶│   Prometheus    │───▶│     Grafana     │
│                 │    │                 │    │                 │
│  /metrics       │    │  Time Series    │    │   Dashboards    │
│  /health        │    │   Database      │    │  Visualization  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      Loki       │    │  Alertmanager   │    │   Exporters     │
│                 │    │                 │    │                 │
│ Log Aggregation │    │   Alerting      │    │ Node, cAdvisor  │
│   & Querying    │    │ & Notifications │    │ PostgreSQL, Redis│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### Setup Monitoring Infrastructure
```bash
# Setup and start all monitoring services
./monitoring/scripts/setup-monitoring.sh setup

# Check service status
./monitoring/scripts/setup-monitoring.sh status
```

### Access Monitoring Services
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

## Components

### Prometheus
- **Purpose**: Metrics collection and time-series database
- **Port**: 9090
- **Configuration**: `monitoring/prometheus/prometheus.yml`
- **Data Retention**: 200 hours
- **Scrape Interval**: 15 seconds

### Grafana
- **Purpose**: Metrics visualization and dashboards
- **Port**: 3001
- **Configuration**: `monitoring/grafana/`
- **Default Login**: admin/admin
- **Dashboards**: `monitoring/dashboards/`

### Alertmanager
- **Purpose**: Alert routing and notifications
- **Port**: 9093
- **Configuration**: `monitoring/alertmanager/alertmanager.yml`
- **Notifications**: Email, Slack, Webhooks

### Loki
- **Purpose**: Log aggregation and querying
- **Port**: 3100
- **Configuration**: `monitoring/loki/local-config.yaml`
- **Log Retention**: Configurable

### Promtail
- **Purpose**: Log collection and forwarding to Loki
- **Configuration**: `monitoring/promtail/config.yml`
- **Sources**: Container logs, system logs, application logs

## Metrics

### Application Metrics
- **HTTP Requests**: Total requests, duration, status codes
- **AI Service**: Request count, latency, model usage
- **Chat Messages**: Message count by type and status
- **User Sessions**: Active session count
- **Database**: Connection count, query performance
- **Memory Usage**: Heap usage, RSS, external memory
- **Error Rate**: Application errors by type and severity

### Infrastructure Metrics
- **System**: CPU, memory, disk, network usage
- **Containers**: Resource usage per container
- **Database**: PostgreSQL performance metrics
- **Cache**: Redis memory usage and operations
- **Network**: Traffic, connections, latency

### Custom Metrics Collection

```javascript
// In your application code
const { recordAIRequest, recordChatMessage, recordError } = require('./monitoring/scripts/metrics-middleware');

// Record AI service usage
recordAIRequest('openai', 'gpt-4', 2.5, 'success');

// Record chat messages
recordChatMessage('user', 'sent');

// Record errors
recordError('validation', 'warning');
```

## Dashboards

### Pixelated Empathy Overview
- **File**: `monitoring/dashboards/pixelated-empathy-overview.json`
- **Metrics**: Application status, request rate, error rate, response times
- **Panels**: HTTP requests, response times, memory usage, CPU usage, database connections

### System Monitoring
- **Metrics**: CPU, memory, disk, network usage
- **Panels**: System load, memory usage, disk I/O, network traffic

### Database Monitoring
- **Metrics**: PostgreSQL and Redis performance
- **Panels**: Connection count, query performance, cache hit rate

## Alerting

### Alert Rules
- **File**: `monitoring/alerts/application.yml`
- **Categories**: Application, system, database, network, container alerts

### Critical Alerts
- **Application Down**: Application unavailable for >1 minute
- **High Error Rate**: Error rate >10% for >2 minutes
- **Database Down**: Database unavailable for >1 minute
- **Critical Disk Space**: Disk usage >95%
- **High Memory Usage**: Memory usage >85% for >5 minutes

### Warning Alerts
- **High Response Time**: 95th percentile >2 seconds for >5 minutes
- **High CPU Usage**: CPU usage >80% for >5 minutes
- **Database High Connections**: >80% of max connections for >5 minutes
- **Redis High Memory**: Redis memory usage >90% for >5 minutes

### Notification Channels
- **Email**: Critical and warning alerts
- **Slack**: Real-time notifications
- **Webhooks**: Custom integrations

## Configuration

### Environment Variables
```bash
# Grafana
GRAFANA_ADMIN_PASSWORD=secure_password

# Database monitoring
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pixelated_empathy
DB_USERNAME=monitoring_user
DB_PASSWORD=monitoring_password

# Redis monitoring
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Alerting
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=alerts@pixelatedempathy.com
SMTP_PASSWORD=smtp_password
ALERT_EMAIL_FROM=alerts@pixelatedempathy.com
CRITICAL_ALERT_EMAIL=critical@pixelatedempathy.com
WARNING_ALERT_EMAIL=warnings@pixelatedempathy.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Prometheus Configuration
```yaml
# monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'pixelated-empathy'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

### Grafana Provisioning
```yaml
# monitoring/grafana/datasources.yml
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
```

## Application Integration

### Metrics Middleware
```javascript
// Add to your Express app
const { metricsMiddleware, metricsHandler } = require('./monitoring/scripts/metrics-middleware');

app.use(metricsMiddleware);
app.get('/metrics', metricsHandler);
```

### Health Check Endpoint
```javascript
app.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: {
      status: 'connected',
      connections: 5
    },
    sessions: {
      active: 150
    },
    memory: process.memoryUsage()
  };
  
  updateHealthMetrics(healthData);
  res.json(healthData);
});
```

### Custom Metrics
```javascript
// Record custom business metrics
const businessMetrics = new promClient.Counter({
  name: 'pixelated_empathy_user_registrations_total',
  help: 'Total user registrations',
  labelNames: ['source']
});

// Increment on user registration
businessMetrics.inc({ source: 'web' });
```

## Log Management

### Log Collection
- **Application Logs**: Structured JSON logs
- **Container Logs**: Docker container stdout/stderr
- **System Logs**: System and service logs
- **Access Logs**: HTTP access logs

### Log Formats
```javascript
// Structured logging example
const logger = require('winston');

logger.info('User login', {
  userId: '12345',
  email: 'user@example.com',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  timestamp: new Date().toISOString()
});
```

### Log Queries
```logql
# Loki query examples
{job="pixelated-empathy"} |= "error"
{job="pixelated-empathy"} | json | level="error"
rate({job="pixelated-empathy"}[5m])
```

## Performance Monitoring

### Key Performance Indicators (KPIs)
- **Availability**: 99.9% uptime target
- **Response Time**: <2 seconds 95th percentile
- **Error Rate**: <1% of total requests
- **Throughput**: Requests per second capacity
- **Resource Utilization**: <80% CPU and memory

### SLA Monitoring
- **Application Availability**: 99.9%
- **Database Availability**: 99.95%
- **API Response Time**: <500ms average
- **Error Budget**: 0.1% monthly error rate

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Check memory metrics
   curl http://localhost:9090/api/v1/query?query=process_resident_memory_bytes
   
   # Check container memory
   docker stats
   ```

2. **Database Connection Issues**
   ```bash
   # Check database metrics
   curl http://localhost:9187/metrics | grep pg_stat_database_numbackends
   
   # Check connection pool
   curl http://localhost:3000/health
   ```

3. **High Error Rate**
   ```bash
   # Check error metrics
   curl http://localhost:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m])
   
   # Check application logs
   docker logs pixelated-empathy-app
   ```

### Debug Commands
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check Grafana health
curl http://localhost:3001/api/health

# Check Loki logs
curl http://localhost:3100/ready

# Test alerting
curl -X POST http://localhost:9093/api/v1/alerts
```

## Maintenance

### Regular Tasks
- **Weekly**: Review dashboard metrics and alerts
- **Monthly**: Update retention policies and cleanup old data
- **Quarterly**: Review and update alert thresholds
- **Annually**: Capacity planning and infrastructure review

### Backup and Recovery
- **Prometheus Data**: Backup time-series data regularly
- **Grafana Dashboards**: Export and version control dashboards
- **Configuration**: Keep all configuration files in version control

### Scaling
- **Prometheus**: Use federation for multiple instances
- **Grafana**: Use external database for high availability
- **Loki**: Configure distributed mode for large log volumes

## Security

### Access Control
- **Grafana**: Role-based access control
- **Prometheus**: Network-level access restrictions
- **Alertmanager**: Secure webhook endpoints

### Data Protection
- **Encryption**: TLS for all communications
- **Authentication**: Strong passwords and API keys
- **Network**: Firewall rules and network segmentation

## Integration

### CI/CD Pipeline
```yaml
# Add monitoring checks to pipeline
- name: Check monitoring health
  run: |
    curl -f http://localhost:9090/-/healthy
    curl -f http://localhost:3001/api/health
```

### External Services
- **Sentry**: Error tracking integration
- **Datadog**: Additional monitoring and APM
- **PagerDuty**: Incident management
- **Slack**: Team notifications

## Support

For monitoring issues:
1. Check service health endpoints
2. Review Grafana dashboards for anomalies
3. Check Prometheus targets and metrics
4. Review alert history in Alertmanager
5. Contact the DevOps team for assistance
