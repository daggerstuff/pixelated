# Monitoring & Observability

Comprehensive monitoring and observability infrastructure for Pixelated Empathy.

## Architecture

```
                    +-----------------+     +-----------------+
  Application ----> |   Prometheus    |     |   Grafana       |
  /metrics           |  Time Series DB |---->|   Dashboards    |
  /health            +-----------------+     +-----------------+
                     |                       |
                     v                       v
              +-----------------+     +-----------------+
              |  Alertmanager   |     |   Exporters     |
              |  Alert Routing   |     |  Node, Postgres |
              |  PagerDuty/Slack |     |  Redis, Caddy  |
              +-----------------+     +-----------------+
```

## Quick Start

### Start Monitoring Stack

```bash
# Start all monitoring services
docker compose -f monitoring/docker-compose.monitoring.yml up -d

# Check status
docker compose -f monitoring/docker-compose.monitoring.yml ps
```

### Required Environment Variables

Create a `.env` file or export these variables:

```bash
# Grafana
GF_ADMIN_PASSWORD=secure_password

# Database monitoring
POSTGRES_USER=pixelated
POSTGRES_PASSWORD=your_password
POSTGRES_DB=pixelated_empathy

# Redis monitoring
REDIS_HOST=pixelated-redis
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Alerting
SMTP_SMARTHOST=smtp.gmail.com:587
SMTP_FROM=alerts@pixelatedempathy.com
SMTP_USERNAME=alerts@pixelatedempathy.com
SMTP_PASSWORD=your_app_password
PAGERDUTY_ROUTING_KEY=your_routing_key
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
ALERT_EMAIL_TO=admin@pixelatedempathy.com
CRITICAL_ALERT_EMAIL=critical@pixelatedempathy.com
WARNING_ALERT_EMAIL=warnings@pixelatedempathy.com
```

### Access Services

- **Grafana**: http://localhost:3100 (admin/password)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

## Components

### Prometheus
- **Port**: 9090
- **Config**: `monitoring/prometheus.yml`
- **Rule Files**: `monitoring/alert_rules.yml` + `monitoring/alerts/*.yml`
- **Scrape Targets**: pixelated-app, ai-service, postgres-exporter,
  redis-exporter, node-exporter, caddy, prometheus
- **Retention**: 200 hours

### Grafana
- **Port**: 3100
- **Provisioning**: `monitoring/grafana/provisioning/`
- **Dashboards**: `monitoring/grafana/dashboards/` and `monitoring/dashboards/`
- **Default Login**: admin / `${GF_ADMIN_PASSWORD}`

### Alertmanager
- **Port**: 9093
- **Config**: `monitoring/alertmanager.yml`
- **Routing**: critical -> PagerDuty, warning -> Slack, emergency -> PagerDuty + Slack
- **Inhibition**: Critical suppresses warning for same service

### Exporters

| Exporter | Port | Purpose |
|----------|------|---------|
| node-exporter | 9100 | System metrics (CPU, memory, disk, network) |
| postgres-exporter | 9187 | PostgreSQL metrics (connections, queries) |
| redis-exporter | 9121 | Redis metrics (memory, operations, keys) |

## Alert Rules

### Files

| File | Rules | Focus |
|------|-------|-------|
| `alert_rules.yml` | 8 | Core infrastructure (error rate, response time, DB, disk, CPU, memory, AI) |
| `alerts/application.yml` | 16 | Application health, DB, Redis, AI service, containers |
| `alerts/performance-alerts.yaml` | 2 | Pixel performance (latency, error rate) |
| `alerts/safety-alerts.yaml` | 3 | Safety gates, content invalidations, PII |
| `alerts/launch-alerts.yaml` | 12 | Launch metrics, crisis detection, engagement, readiness |

**Note**: `memory-alerts.yaml` is a K8s ConfigMap for GitLab Runner monitoring
and is NOT loaded by the Docker Compose Prometheus instance.

### Severity Routing

| Severity | Receiver | Channels | Repeat |
|----------|----------|----------|--------|
| critical | critical-notifications | PagerDuty + Email | 30m |
| warning | warning-notifications | Slack + Email | 2h |
| emergency | emergency-notifications | PagerDuty + Slack | 15m |
| default | default | Email | 1h |

## Dashboards

| File | Description |
|------|-------------|
| `pixelated-empathy-overview.json` | Application status, requests, errors, response times |
| `performance-dashboard.json` | Latency, throughput, resource utilization |
| `safety-monitoring-dashboard.json` | Safety gates, crisis detection, PII alerts |
| `clinical-validity-dashboard.json` | Clinical metrics, bias audit, consent |
| `launch-monitoring-dashboard.json` | Launch metrics, user engagement, uptime |

## Validation

### AlertManager Routing Test

```bash
./monitoring/scripts/test-alertmanager-routing.sh
```

Tests: YAML syntax, severity routing, inhibition rules, alert rule count.

### Alert Coverage Audit

See `monitoring/alert-coverage-audit.md` for the full audit of all alert rules
against critical service paths.

## Synthetic Monitoring (Planned)

See `monitoring/synthetic-monitoring-scope.md` for the scope document.
Implementation is tracked in PIX-4101.

## Key Metrics

### Application
- HTTP requests (total, duration, status codes)
- AI service (request count, latency, model usage)
- Active sessions, user registrations
- Error rate by type and severity

### Infrastructure
- CPU, memory, disk, network usage
- PostgreSQL connections, query performance
- Redis memory, operations, key count
- Container resource usage

## Troubleshooting

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check Grafana health
curl http://localhost:3100/api/health

# Test alerting
curl -X POST http://localhost:9093/api/v1/alerts

# Check Alertmanager config
curl http://localhost:9093/api/v1/status
```

## Maintenance

- **Weekly**: Review dashboard metrics and alert noise
- **Monthly**: Update retention policies, cleanup old data
- **Quarterly**: Review and update alert thresholds
- **Annually**: Capacity planning and infrastructure review
