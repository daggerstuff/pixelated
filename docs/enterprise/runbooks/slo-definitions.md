---
title: 'SLO Definitions & SLA Commitments'
description:
  'Service-level objectives, error budgets, and breach procedures for every
  customer-facing Pixelated Empathy service.'
---

<!-- markdownlint-disable MD025 MD013 -->

<div align="center">

## Service-Level Objectives

## Operational reliability targets for the Pixelated Empathy platform

</div>

---

## 1. Purpose & Scope

This runbook defines **Service-Level Objectives (SLOs)** for every
customer-facing service in the Pixelated Empathy platform. It documents the SLA
commitments we make to customers by tier, the error-budget policy that governs
feature velocity versus reliability, and the breach-notification procedure the
on-call team must follow when an SLO is at risk.

**Coverage**: six customer-facing services plus Foresight MCP (internal-facing
but supports customer sessions).

| #   | Service         | Type                             | Scrape Target                  |
| --- | --------------- | -------------------------------- | ------------------------------ |
| 1   | `pixelated-app` | Astro SSR web app                | `:3000/metrics`                |
| 2   | `pixelated-ai`  | FastAPI cognitive engine         | `:8000/metrics`                |
| 3   | `PostgreSQL`    | Primary datastore                | `postgres-exporter:9187`       |
| 4   | `Redis`         | Cache & session store            | `redis-exporter:9121`          |
| 5   | `Caddy`         | Reverse proxy / edge             | `pixelated-caddy:2019/metrics` |
| 6   | `node-exporter` | Host system metrics              | `:9100/metrics`                |
| 7   | `Foresight MCP` | Memory service (session support) | TBD — not yet scraped          |

**Measurement window**: rolling 30-day period unless otherwise stated.

---

## 2. SLO Definitions by Service

### 2.1 pixelated-app (Astro SSR Web App)

| Indicator            | SLO Target            | Alert Threshold                      | Measurement                                                                |
| -------------------- | --------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| **Uptime**           | 99.9%                 | 5xx error rate > 0.1 req/s for 5 min | `up{job="pixelated-app"} == 1`                                             |
| **Latency (p95)**    | ≤ 500 ms              | p95 > 500 ms for 5 min               | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` |
| **Error rate (5xx)** | ≤ 0.1% of requests    | 5xx rate > 0.1 req/s for 5 min       | `rate(http_requests_total{status=~"5.."}[5m])`                             |
| **Throughput**       | ≥ 100 req/s sustained | —                                    | `rate(http_requests_total[5m])`                                            |

**Aligned alerts**: `HighErrorRate` (warning), `HighResponseTime` (warning).

### 2.2 pixelated-ai (FastAPI Cognitive Engine)

| Indicator                         | SLO Target                  | Alert Threshold               | Measurement                                                                                   |
| --------------------------------- | --------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| **Uptime**                        | 99.9%                       | `up{job="pixelated-ai"} == 0` | `up{job="pixelated-ai"}`                                                                      |
| **Inference latency (avg)**       | ≤ 2.0 s                     | avg > 2.0 s for 5 min         | `rate(ai_inference_duration_seconds_sum[5m]) / rate(ai_inference_duration_seconds_count[5m])` |
| **Emotional analysis error rate** | ≤ 0.05 errors/s             | > 0.05 errors/s for 5 min     | `rate(emotional_analysis_errors_total[5m])`                                                   |
| **Throughput**                    | ≥ 50 inferences/s sustained | —                             | `rate(ai_inference_duration_seconds_count[5m])`                                               |

**Aligned alerts**: `AIInferenceLatencyHigh` (warning), `EmotionalAnalysisError`
(critical).

### 2.3 PostgreSQL (Primary Datastore)

| Indicator               | SLO Target | Alert Threshold | Measurement                                           |
| ----------------------- | ---------- | --------------- | ----------------------------------------------------- |
| **Uptime**              | 99.95%     | `pg_up == 0`    | `pg_up`                                               |
| **Active connections**  | ≤ 80       | > 80 for 5 min  | `pg_stat_activity_count`                              |
| **Replication lag**     | ≤ 5 s      | > 5 s for 5 min | `pg_replication_lag_seconds`                          |
| **Query latency (p99)** | ≤ 200 ms   | —               | `pg_stat_user_tables_seq_scan` + custom query metrics |

**Aligned alerts**: `DatabaseConnectionsHigh` (warning).

> **Why higher uptime (99.95%)?** The datastore is a hard dependency for every
> customer transaction. A 0.05% error budget (21.6 min/month) is tighter than
> the web tier because data-layer incidents cascade across all services.

### 2.4 Redis (Cache & Session Store)

| Indicator         | SLO Target         | Alert Threshold          | Measurement                                                                             |
| ----------------- | ------------------ | ------------------------ | --------------------------------------------------------------------------------------- |
| **Uptime**        | 99.9%              | `redis_up == 0`          | `redis_up`                                                                              |
| **Hit rate**      | ≥ 90%              | < 90% for 10 min         | `redis_keyspace_hits_total / (redis_keyspace_hits_total + redis_keyspace_misses_total)` |
| **Memory usage**  | ≤ 80% of maxmemory | > 80% for 5 min          | `redis_memory_used_bytes / redis_memory_max_bytes`                                      |
| **Eviction rate** | ≤ 100 keys/min     | > 100 keys/min for 5 min | `rate(redis_evicted_keys_total[5m])`                                                    |

**Aligned alerts**: `MemoryUsageHigh` (warning) covers host-level;
Redis-specific alerting to be added to `alerts/application.yml`.

### 2.5 Caddy (Reverse Proxy / Edge)

| Indicator                 | SLO Target | Alert Threshold                         | Measurement                                                                 |
| ------------------------- | ---------- | --------------------------------------- | --------------------------------------------------------------------------- |
| **Uptime**                | 99.95%     | `up{job="pixelated-caddy"} == 0`        | `up{job="pixelated-caddy"}`                                                 |
| **Upstream error rate**   | ≤ 0.1%     | 5xx from upstream > 0.1 req/s for 5 min | `caddy_reverse_proxy_upstream__requests_total{status=~"5.."}`               |
| **TLS handshake errors**  | 0          | Any TLS error for 5 min                 | `caddy_tls_handshake_errors_total`                                          |
| **Request latency (p99)** | ≤ 200 ms   | p99 > 200 ms for 5 min                  | `histogram_quantile(0.99, rate(caddy_request_duration_seconds_bucket[5m]))` |

> Caddy sits in front of all customer traffic; its uptime target matches
> PostgreSQL at 99.95% because it is the single ingress point.

### 2.6 node-exporter (Host System)

| Indicator             | SLO Target | Alert Threshold            | Measurement                                                      |
| --------------------- | ---------- | -------------------------- | ---------------------------------------------------------------- |
| **Disk availability** | ≥ 10% free | < 10% for 5 min (critical) | `fs_avail / fs_size`                                             |
| **Memory usage**      | ≤ 90%      | > 90% for 5 min            | `(MemTotal - MemAvailable) / MemTotal`                           |
| **CPU usage**         | ≤ 80%      | > 80% for 5 min            | `100 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100` |

**Aligned alerts**: `DiskSpaceLow` (critical), `MemoryUsageHigh` (warning),
`CPUUsageHigh` (warning).

> System-level SLOs are **platform-wide**: every service inherits these host
> guarantees. A disk or memory breach threatens all services simultaneously.

### 2.7 Foresight MCP (Memory Service)

> **Not yet instrumented in Prometheus.** SLOs below are **target** definitions;
> monitoring integration is a follow-up action item (see §6).

| Indicator                       | SLO Target         | Alert Threshold               | Measurement                     |
| ------------------------------- | ------------------ | ----------------------------- | ------------------------------- |
| **Uptime**                      | 99.5%              | Service unreachable for 5 min | Health check (to implement)     |
| **Memory lookup latency (p95)** | ≤ 100 ms           | p95 > 100 ms for 5 min        | Custom histogram (to implement) |
| **Memory write latency (p95)**  | ≤ 200 ms           | p95 > 200 ms for 5 min        | Custom histogram (to implement) |
| **Error rate**                  | ≤ 1% of operations | > 1% for 5 min                | Custom counter (to implement)   |

> Foresight MCP has a **lower uptime target (99.5%)** because it is a
> session-support service, not a request-critical path. Memory retrieval
> failures degrade experience but do not block core transactions.

---

## 3. Error Budget Policy

### 3.1 Budget Calculation

An error budget is the maximum amount of unreliability a service may accumulate
within the measurement window before feature development must pause in favor of
reliability work.

| SLO Target | Monthly Error Budget | Daily Budget |
| ---------- | -------------------- | ------------ |
| 99.5%      | 3 h 36 min           | 7.2 min      |
| 99.9%      | 43 min 12 s          | 1.44 min     |
| 99.95%     | 21 min 36 s          | 43.2 s       |
| 99.99%     | 4 min 19 s           | 8.6 s        |

### 3.2 Budget Consumption Tracking

Prometheus records error-budget consumption via the `slo:error_budget:remaining`
recording rule (to be added to `alert_rules.yml`). The budget is consumed
whenever a service violates any of its SLO indicators within the window.

```yaml
# Example recording rule (to add to monitoring/alert_rules.yml)
groups:
  - name: slo_error_budget
    interval: 30s
    rules:
      - record: slo:error_budget:remaining:pixelated_app
        expr: |
          1 - (
            sum(rate(http_requests_total{job="pixelated-app",status=~"5.."}[30d]))
            / sum(rate(http_requests_total{job="pixelated-app"}[30d]))
          )
      - record: slo:error_budget:remaining:pixelated_ai
        expr: |
          1 - (
            sum(rate(ai_inference_errors_total[30d]))
            / sum(rate(ai_inference_duration_seconds_count[30d]))
          )
```

### 3.3 Policy Enforcement

| Budget Remaining   | Action                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| **> 50%**          | Normal feature development. No restrictions.                                                               |
| **25–50%**         | On-call engineer reviews incident trends at next standup.                                                  |
| **10–25%**         | Feature launches require on-call sign-off. Reliability backlog prioritized.                                |
| **< 10%**          | **Feature freeze.** All engineering effort redirects to reliability fixes until budget recovers above 25%. |
| **0% (exhausted)** | Page on-call immediately. Postmortem required within 48 h. VP Engineering notified.                        |

### 3.4 Budget Reset

Error budgets reset at the start of each calendar month. Historical consumption
is retained in Grafana dashboard `slo-error-budget` (to be created) for trend
analysis.

---

## 4. SLA Commitments by Customer Tier

These are the **contractual** commitments we make to customers, derived from
(but lower than) our internal SLO targets. The gap between SLO and SLA is the
**error-budget buffer** that protects us from SLA violations.

| Tier                  | Uptime SLA | Latency SLA (p95) | Support Response           | Breach Credit                     |
| --------------------- | ---------- | ----------------- | -------------------------- | --------------------------------- |
| **Free**              | 99.0%      | 1.0 s             | Best-effort                | None                              |
| **Pro**               | 99.5%      | 750 ms            | 4 business hours           | 10% monthly fee                   |
| **Enterprise**        | 99.9%      | 500 ms            | 1 business hour (24/7)     | 25% monthly fee                   |
| **Enterprise+ HIPAA** | 99.95%     | 500 ms            | 1 hour 24/7 + dedicated SE | 25% monthly fee + incident review |

### 4.1 SLA Measurement

- **Uptime** is measured from the edge (Caddy) perspective, excluding
  customer-side network issues. Maintenance windows (announced ≥ 72 h in
  advance) are excluded.
- **Latency** is measured at the 95th percentile of successful (2xx) requests
  over the billing month.
- **Error rate** is measured as 5xx responses as a percentage of total requests
  at the edge.

### 4.2 SLA Exclusions

The following do not count as SLA breaches:

- Scheduled maintenance (≥ 72 h notice, ≤ 2 h/month for Enterprise)
- Customer misconfiguration (incorrect API keys, malformed requests)
- Force majeure events (cloud provider region outage, ISP failure)
- Rate-limit responses (429) when the customer exceeds their plan quota
- Third-party dependencies outside our control (e.g., customer's IdP)

---

## 5. SLO Breach Notification Procedure

### 5.1 Detection

SLO breaches are detected via two mechanisms:

1. **Automated alerting** — Prometheus alert rules fire when SLO thresholds are
   crossed. Alerts route to Alertmanager, which dispatches by severity (see
   `alertmanager.yml`):
   - `critical` → PagerDuty + Email, repeat every 30 min
   - `warning` → Slack + Email, repeat every 2 h
   - `emergency` → PagerDuty + Slack, repeat every 15 min

2. **Manual escalation** — Any engineer who observes a service degradation
   outside alert coverage must page on-call via PagerDuty manually.

### 5.2 Response Timeline

| Severity                             | Acknowledge | Mitigate | Communicate to Customers                          |
| ------------------------------------ | ----------- | -------- | ------------------------------------------------- |
| **Warning** (SLO at risk)            | 30 min      | 2 h      | Status page update if > 1 h                       |
| **Critical** (SLO violated)          | 5 min       | 30 min   | Status page update within 15 min                  |
| **Emergency** (multi-service outage) | 2 min       | 15 min   | Status page + direct customer comms within 10 min |

### 5.3 Breach Response Steps

1. **Acknowledge** the PagerDuty alert within the response timeline above.
2. **Assess** scope: which services are affected, how many customers, which
   tiers.
3. **Mitigate**: Apply the runbook for the specific service (see
   service-specific runbooks — to be created). If no runbook exists, follow
   general incident response: roll back recent deploys, scale horizontally,
   failover to standby.
4. **Communicate**:
   - Update the status page (`status.pixelatedempathy.com` — to be created)
   - For Enterprise/Enterprise+ customers: direct email to the account's
     technical contact within the timeline above.
   - HIPAA-tier customers: also notify their compliance officer if the breach
     involves PHI availability (per BAA terms).
5. **Resolve** the incident and confirm SLO indicators return to target.
6. **Postmortem** within 48 h (24 h for Emergency). Postmortem covers:
   - Timeline of events
   - Root cause analysis
   - Error-budget impact (how much budget was consumed)
   - Action items to prevent recurrence
   - Action items to improve detection/mitigation

### 5.4 Breach Credits

If an SLA commitment is violated (actual uptime or latency falls below the
tier's SLA for the billing month):

- **Pro**: 10% credit applied to next month's invoice.
- **Enterprise / Enterprise+**: 25% credit applied to next month's invoice.
- **Enterprise+ HIPAA**: Additionally, a written incident review is provided to
  the customer's compliance team within 5 business days.

Customers must request breach credits within 30 days of the billing period end
by contacting `support@pixelatedempathy.com`.

---

## 6. Monitoring Alignment & Gaps

### 6.1 Currently Instrumented (production-ready)

| Service       | Uptime | Latency | Error Rate | Throughput | Notes                                         |
| ------------- | ------ | ------- | ---------- | ---------- | --------------------------------------------- |
| pixelated-app | ✅     | ✅      | ✅         | ✅         | Full coverage via `http_requests_total`       |
| pixelated-ai  | ✅     | ✅      | ✅         | ✅         | Via `ai_inference_*` + `emotional_analysis_*` |
| PostgreSQL    | ✅     | ⚠️      | ✅         | ✅         | Query latency needs custom exporter config    |
| Redis         | ✅     | ❌      | ⚠️         | ✅         | Hit-rate + eviction alerts to be added        |
| Caddy         | ✅     | ⚠️      | ✅         | ✅         | Upstream error + TLS metrics to be verified   |
| node-exporter | ✅     | N/A     | ✅         | N/A        | System-level, applies to all hosts            |
| Foresight MCP | ❌     | ❌      | ❌         | ❌         | **Not instrumented — follow-up item**         |

### 6.2 Follow-up Action Items

| #   | Action                                                                   | Priority | Owner    | Ticket          |
| --- | ------------------------------------------------------------------------ | -------- | -------- | --------------- |
| 1   | Add Foresight MCP to `prometheus.yml` scrape config                      | High     | Platform | PIX-4144 (this) |
| 2   | Add Redis hit-rate & eviction alert rules to `alerts/application.yml`    | Medium   | Platform | New ticket      |
| 3   | Add PostgreSQL query latency (p99) recording rule                        | Medium   | Platform | New ticket      |
| 4   | Create `slo-error-budget` Grafana dashboard                              | Medium   | Platform | New ticket      |
| 5   | Create `slo:error_budget:remaining` recording rules in `alert_rules.yml` | High     | Platform | New ticket      |
| 6   | Create service-specific incident runbooks (one per service)              | Medium   | SRE      | PIX-4127 child  |
| 7   | Set up status page (`status.pixelatedempathy.com`)                       | Medium   | Platform | New ticket      |
| 8   | Verify Caddy upstream error + TLS metric labels match exporter version   | Low      | Platform | New ticket      |

### 6.3 Alert-to-SLO Traceability Matrix

| SLO Indicator  | Alert Rule Name           | File              | Severity | Fires When              |
| -------------- | ------------------------- | ----------------- | -------- | ----------------------- |
| App error rate | `HighErrorRate`           | `alert_rules.yml` | warning  | 5xx > 0.1 req/s for 5m  |
| App latency    | `HighResponseTime`        | `alert_rules.yml` | warning  | p95 > 500ms for 5m      |
| DB connections | `DatabaseConnectionsHigh` | `alert_rules.yml` | warning  | > 80 connections for 5m |
| Disk space     | `DiskSpaceLow`            | `alert_rules.yml` | critical | < 10% free for 5m       |
| Memory         | `MemoryUsageHigh`         | `alert_rules.yml` | warning  | > 90% for 5m            |
| CPU            | `CPUUsageHigh`            | `alert_rules.yml` | warning  | > 80% for 5m            |
| AI EI errors   | `EmotionalAnalysisError`  | `alert_rules.yml` | critical | > 0.05 errors/s for 5m  |
| AI latency     | `AIInferenceLatencyHigh`  | `alert_rules.yml` | warning  | avg > 2.0s for 5m       |

Additional alert files (`alerts/application.yml`,
`alerts/performance-alerts.yaml`, `alerts/safety-alerts.yaml`,
`alerts/launch-alerts.yaml`) contain service-specific rules that supplement the
core SLO alerts above. Full traceability for those files is a follow-up action
item.

---

## 7. Governance & Review

### 7.1 Review Cadence

| Review              | Frequency    | Owner                 | Output                                                       |
| ------------------- | ------------ | --------------------- | ------------------------------------------------------------ |
| SLO target review   | Quarterly    | Engineering + Product | Updated SLOs based on customer feedback + performance trends |
| Error budget review | Monthly      | On-call lead          | Budget consumption report, feature-freeze decisions          |
| SLA contract review | Annually     | Legal + Engineering   | Tier definitions, breach credit percentages                  |
| Postmortem review   | Per-incident | Incident commander    | Root cause, action items, SLO adjustments                    |

### 7.2 SLO Adjustment Process

SLOs are not changed in response to a single incident. To change an SLO:

1. Propose the change in an RFC (`.agent/internal/rfcs/`).
2. Assess customer impact (will it violate existing SLA contracts?).
3. Review in quarterly SLO review meeting.
4. Update this document and the Prometheus alert rules in the same PR.
5. Notify Enterprise customers if their SLA commitment changes.

---

## 8. Glossary

| Term             | Definition                                                                 |
| ---------------- | -------------------------------------------------------------------------- |
| **SLO**          | Service-Level Objective — internal reliability target we aim for.          |
| **SLA**          | Service-Level Agreement — contractual commitment to customers.             |
| **SLI**          | Service-Level Indicator — the metric we measure (e.g., p95 latency).       |
| **Error budget** | The allowable amount of unreliability before action is required.           |
| **Breach**       | An SLO or SLA violation within the measurement window.                     |
| **p95 / p99**    | 95th / 99th percentile — the value below which 95% / 99% of requests fall. |
| **5xx**          | HTTP 5xx status codes — server errors.                                     |
| **Scrape**       | Prometheus pulling metrics from an endpoint at a fixed interval.           |
| **Postmortem**   | A blameless written analysis of an incident, completed within 48 h.        |

---

## 9. References

- **Monitoring README**: `monitoring/MONITORING_README.md`
- **Prometheus config**: `monitoring/prometheus.yml`
- **Alert rules**: `monitoring/alert_rules.yml`, `monitoring/alerts/*.yml`
- **Alertmanager config**: `monitoring/alertmanager.yml`
- **Parent ticket**:
  [PIX-4127 — SLA Program](https://linear.app/pixelated/issue/PIX-4127)
- **This ticket**:
  [PIX-4144 — SLO Definitions](https://linear.app/pixelated/issue/PIX-4144)
- **Google SRE Workbook**:
  [Implementing SLOs](https://sre.google/workbook/implementing-slos/) (reference
  methodology)
