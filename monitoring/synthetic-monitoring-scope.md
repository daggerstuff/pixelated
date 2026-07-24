# Synthetic Monitoring Scope — PIX-4101

> Scoping document for synthetic monitoring integration. Created as part of
> PIX-4100 (monitoring FIXME resolution). Implementation deferred to PIX-4101.

## Objective

Add synthetic monitoring for critical user paths to detect availability and
performance issues before users report them.

## Critical User Paths

| # | Path | Method | Expected Status | Check Frequency | Alert Threshold |
|---|------|--------|----------------|-----------------|-----------------|
| 1 | `/` (homepage) | GET | 200 | 1m | 3 consecutive failures -> critical |
| 2 | `/api/v1/health` | GET | 200 | 30s | 2 failures -> critical |
| 3 | `/api/health` | GET | 200 | 30s | 2 failures -> critical |
| 4 | `/api/health/simple` | GET | 200 | 30s | 2 failures -> critical |
| 5 | `/docs/getting-started` | GET | 200 | 5m | 3 failures -> warning |
| 6 | `/admin/dashboard` | GET | 200/302 | 5m | 3 failures -> warning |
| 7 | `/api/v1/developer/api-keys` | GET | 401 (unauth) | 2m | Non-401 -> critical |
| 8 | `/api/graphql` | POST | 200/400 | 2m | 5xx -> critical |

## Implementation Options

### Option A: Blackbox Exporter (Recommended)

- **Tool**: `prom/blackbox-exporter`
- **Deployment**: Add to `docker-compose.monitoring.yml` as a new service
- **Config**: `monitoring/blackbox-exporter.yml` with HTTP probes
- **Prometheus**: Add scrape config with `blackbox_exporter` job
- **Alerts**: Add `blackbox_alerts.yml` with probe success/failure rules
- **Pros**: Native Prometheus integration, minimal infrastructure
- **Cons**: No browser rendering (JS-only checks)

### Option B: k6 + Grafana Cloud Synthetics

- **Tool**: Grafana k6 or Grafana Cloud Synthetics
- **Deployment**: k6 scripts run from GitHub Actions or k6 cloud
- **Config**: `monitoring/synthetic/*.js` k6 scripts
- **Results**: Push to Grafana via remote write
- **Pros**: Real browser testing, RUM integration
- **Cons**: More complex setup, potential cost

### Option C: Playwright in CI

- **Tool**: Existing Playwright setup (`tests/e2e/`)
- **Deployment**: Run selected e2e tests on schedule from GitHub Actions
- **Config**: `monitoring/synthetic/` with tagged e2e tests
- **Results**: Parse test results, push metrics to Prometheus pushgateway
- **Pros**: Reuses existing test infrastructure
- **Cons**: Slower feedback, not true synthetic monitoring

## Recommended Approach

**Option A (Blackbox Exporter)** for HTTP endpoint checks, with **Option C
(Playwright)** for critical user journey validation on a 15-minute schedule.

## Alert Rules (Proposed)

```yaml
groups:
  - name: synthetic-monitoring
    rules:
      - alert: EndpointDown
        expr: probe_success == 0
        for: 1m
        labels:
          severity: critical
          category: synthetic
        annotations:
          summary: 'Endpoint {{ $labels.instance }} is down'
          description: 'Synthetic check failed for {{ $labels.instance }}'

      - alert: EndpointSlow
        expr: probe_duration_seconds > 2
        for: 5m
        labels:
          severity: warning
          category: synthetic
        annotations:
          summary: 'Endpoint {{ $labels.instance }} is slow'
          description: 'Response time is {{ $value }}s (threshold: 2s)'

      - alert: SSLCertExpiring
        expr: probe_ssl_earliest_cert_expiry - time() < 86400 * 14
        for: 1h
        labels:
          severity: warning
          category: synthetic
        annotations:
          summary: 'SSL certificate expiring soon'
          description: 'Certificate for {{ $labels.instance }} expires in < 14 days'
```

## Dependencies

- PIX-4100 (monitoring FIXME resolution) — must be complete first
- Monitoring stack deployed and running

## Estimate

- Blackbox exporter setup: 1-2 hours
- Playwright synthetic tests: 2-3 hours
- Alert rules + dashboard: 1 hour
- Total: ~4-6 hours (1-2 days)
