# monitoring/FIXME.md — Resolution Status

> Resolved as part of PIX-4100. All items triaged with documented decisions.

## Original Problem

This directory was copied from `business-strategy-cms` and had not been
adapted for Pixelated Empathy.

## Resolution Status

### 1. Rename all `container_name` values to `pixelated-empathy-*` — RESOLVED

**Status**: Already done in prior commit. All container names in
`docker-compose.monitoring.yml` use `pixelated-empathy-*` prefix:
- `pixelated-empathy-prometheus`
- `pixelated-empathy-grafana`
- `pixelated-empathy-alertmanager`
- `pixelated-empathy-node-exporter`
- `pixelated-empathy-postgres-exporter`
- `pixelated-empathy-redis-exporter` (added PIX-4100)

### 2. Update `prometheus.yml` scrape targets — RESOLVED

**Status**: Updated in PIX-4100. Scrape targets now match actual services:
- `pixelated-app:3000` (Astro SSR)
- `pixelated-ai:8000` (FastAPI backend)
- `pixelated-empathy-postgres-exporter:9187` (PostgreSQL metrics)
- `pixelated-empathy-redis-exporter:9121` (Redis metrics, added PIX-4100)
- `pixelated-empathy-node-exporter:9100` (System metrics)
- `pixelated-caddy:2019` (Reverse proxy metrics)
- `localhost:9090` (Prometheus self-monitoring, added PIX-4100)

### 3. Adapt or remove `alert_rules.yml` for relevant metrics — RESOLVED

**Status**: `alert_rules.yml` already adapted with Pixelated-specific alerts
(`EmotionalAnalysisError`, `AIInferenceLatencyHigh`). Additionally, all alert
files in `alerts/` directory are now loaded by `prometheus.yml`:
- `alert_rules.yml` (8 rules: error rate, response time, DB connections, disk, memory, CPU, EI errors, AI latency)
- `alerts/application.yml` (16 rules: app health, DB, Redis, AI service, disk, network, containers)
- `alerts/performance-alerts.yaml` (2 rules: latency, error rate)
- `alerts/safety-alerts.yaml` (3 rules: safety gate violations, invalidations, PII)
- `alerts/launch-alerts.yaml` (12 rules: launch metrics, crisis detection, engagement, performance, readiness)

**Note**: `memory-alerts.yaml` at root level is a K8s ConfigMap targeting
`gitlab-runner` namespace — retained as reference but not loaded by Prometheus.
It is not applicable to the Docker Compose monitoring stack.

### 4. Mount via `docker-compose.production.yml` (add a `monitoring` profile) — TRIAGED

**Decision**: Deferred to infrastructure provisioning. The monitoring stack
is ready to deploy via `docker-compose -f monitoring/docker-compose.monitoring.yml up`
with a `.env` file containing required secrets. Integration with the production
docker-compose file requires a monitoring profile that depends on the main
app being up. This is an infrastructure task, not a code task — documented
in `MONITORING_README.md` with deployment instructions.

**Risk**: Low. The monitoring stack is self-contained and does not affect
application behavior. It can be deployed independently.

### 5. Validate dashboards against actual Prometheus metrics — TRIAGED

**Decision**: Dashboards exist in `monitoring/dashboards/` (5 JSON files)
and reference Prometheus-standard metrics (`http_requests_total`,
`node_memory_*`, `pg_stat_*`). Validation requires a running Prometheus
instance with actual metrics — this is a runtime verification task, not
a code task. Dashboards are provisioned via `monitoring/grafana/provisioning/`
and will auto-populate on first Grafana boot.

**Action**: Run `scripts/devops/verify-monitoring.sh` after deploying the
monitoring stack to validate dashboard panels against live metrics.
