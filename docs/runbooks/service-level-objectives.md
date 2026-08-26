# Service-Level Objectives — SLO Definitions

**Document:** SLA-1 | **Issue:**
[PIX-4144](https://linear.app/pixelated/issue/PIX-4144) **Owner:** Platform
Engineering **Last Updated:** 2026-07-30 **Status:** Final

---

## 1. SLO Framework Overview

This document defines Service-Level Objectives (SLOs) for every customer-facing
service in the Pixelated Empathy platform. SLOs are measured using Prometheus
metrics as defined in our monitoring stack and tracked via the companion
[SLO Monitoring & Burn Rate Alerts](../alerts/slo-alerts.yaml) configuration
(SLA-2).

### SLO Components

Each SLO defines:

- **Service** — the system component being measured
- **SLI** — Service-Level Indicator (the actual metric)
- **Target** — the objective threshold
- **Measurement window** — the evaluation period
- **Error budget** — the allowable margin of error
- **Burn rate** — how fast error budget can be consumed

---

## 2. Service Catalog — SLO Summary

| Service                    | Category       | Uptime SLO | Latency SLO (p95) | Error Budget | Measurement                     |
| -------------------------- | -------------- | ---------- | ----------------- | ------------ | ------------------------------- |
| Therapy Chat Session       | AI Interaction | 99.95%     | < 2s              | 0.05%        | `http_request_duration_seconds` |
| User Authentication        | Auth           | 99.99%     | < 500ms           | 0.01%        | `http_request_duration_seconds` |
| REST API (Backend)         | API            | 99.9%      | < 500ms           | 0.1%         | `http_request_duration_seconds` |
| AI Inference               | AI Service     | 99.5%      | < 5s              | 0.5%         | `ai_inference_duration_seconds` |
| Bias Detection             | AI Service     | 99.5%      | < 3s              | 0.5%         | Custom metrics                  |
| WebSocket Connection       | Real-time      | 99.95%     | < 200ms connect   | 0.05%        | Connection metrics              |
| Landing Page               | Web            | 99.99%     | < 2s load (LCP)   | 0.01%        | Synthetic monitoring            |
| Dashboard (Clinical/Admin) | Web            | 99.9%      | < 3s load         | 0.1%         | Synthetic monitoring            |
| API Health Endpoint        | Internal       | 99.99%     | < 100ms           | 0.01%        | `http_request_duration_seconds` |
| Object Storage (MinIO/S3)  | Storage        | 99.9%      | < 1s              | 0.1%         | S3-compatible metrics           |

---

## 3. Detailed SLO Definitions

### 3.1 Therapy Chat Session

- **SLI**: Proportion of chat requests completing successfully within latency
  target
- **Uptime target**: 99.95% availability (≤ 4.38 hours downtime/year)
- **Latency target (p95)**: < 2 seconds end-to-end
- **Error budget**: 0.05% of total requests
- **Measurement**:
  `rate(http_request_duration_seconds_count{route="/api/chat"}[5m])`
- **Burn rate alert**: > 2x burn over 1h triggers warning

### 3.2 User Authentication

- **SLI**: Login and token refresh success rate
- **Uptime target**: 99.99% (≤ 52.6 minutes downtime/year)
- **Latency target (p95)**: < 500ms for login, < 200ms for token refresh
- **Error budget**: 0.01% of auth requests
- **Measurement**:
  `rate(http_request_duration_seconds_count{route=~"/api/auth/.*"}[5m])`

### 3.3 REST API (Backend)

- **SLI**: API request success rate across all endpoints
- **Uptime target**: 99.9% (≤ 8.77 hours downtime/year)
- **Latency target (p95)**: < 500ms for standard endpoints, < 2s for analytics
- **Error budget**: 0.1% of all API requests
- **Measurement**:
  `rate(http_request_duration_seconds_count{route!~"/api/chat|/api/auth/.*"}[5m])`

### 3.4 AI Inference

- **SLI**: Model inference call success and completion within timeout
- **Uptime target**: 99.5% (≤ 1.83 days downtime/year)
- **Latency target (p95)**: < 5s per inference call
- **Error budget**: 0.5% of inference calls
- **Measurement**: `rate(ai_inference_duration_seconds_count[5m])`

### 3.5 Bias Detection

- **SLI**: Bias analysis pipeline completion rate
- **Uptime target**: 99.5% (≤ 1.83 days downtime/year)
- **Latency target (p95)**: < 3s per analysis
- **Error budget**: 0.5% of analysis requests
- **Measurement**: Custom metrics via bias detection pipeline

### 3.6 WebSocket Connection

- **SLI**: WebSocket connect and message delivery success rate
- **Uptime target**: 99.95% (≤ 4.38 hours downtime/year)
- **Latency target (p95)**: < 200ms connection establishment
- **Error budget**: 0.05% of connection attempts
- **Measurement**: WebSocket connection metrics

### 3.7 Landing Page

- **SLI**: Page load success and Core Web Vitals compliance
- **Uptime target**: 99.99% (≤ 52.6 minutes downtime/year)
- **Latency target**: LCP < 2s, FID < 100ms, CLS < 0.1
- **Error budget**: 0.01% of page loads
- **Measurement**: Synthetic monitoring + RUM

### 3.8 Dashboard (Clinical/Admin)

- **SLI**: Dashboard load and data refresh success rate
- **Uptime target**: 99.9% (≤ 8.77 hours downtime/year)
- **Latency target (p95)**: < 3s initial load, < 1s data refresh
- **Error budget**: 0.1% of dashboard loads
- **Measurement**: Synthetic monitoring

---

## 4. Error Budget Policy

### Budget Calculation

```
Error Budget = 1 - SLO Target
Example: 99.9% SLO → 0.1% error budget (≈ 8.77 hours/year)
```

### Budget Consumption

- Error budget is consumed by any request that exceeds either the latency SLO or
  returns a 5xx status code
- Budget is tracked as a rolling window over the current measurement period (30
  days)
- Budget burn rate is calculated as the ratio of actual errors to allowed errors
  over time

### Depletion Actions

| Budget Remaining | Action                                                                    |
| ---------------- | ------------------------------------------------------------------------- |
| > 50%            | Normal operations                                                         |
| 25% – 50%        | Team reviews recent changes; consider rolling back risky deployments      |
| 10% – 25%        | Freeze feature deployments; focus on reliability improvements             |
| < 10%            | Emergency response: all-hands on reliability, potential service rollback  |
| 0% (depleted)    | Mandatory reliability sprint; no new features until budget is replenished |

---

## 5. SLO Measurement Methodology

### Data Sources

All SLO measurements derive from Prometheus metrics collected by the monitoring
stack:

- **Latency**: `http_request_duration_seconds_bucket` histogram — used for
  percentile calculations
- **Error rate**: `http_requests_total{status=~"5.."}` counter — used for error
  budget tracking
- **Uptime**: Successful health check probes — used for availability SLO

### Query Examples

**Availability SLO query (29-day rolling window):**

```promql
(
  sum(rate(http_requests_total{status!~"5.."}[29d]))
  /
  sum(rate(http_requests_total[29d]))
) * 100
```

**Latency SLO query (p95 over 5m):**

```promql
histogram_quantile(0.95,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)
)
```

**Error budget remaining:**

```promql
(
  (1 - (sum(rate(http_requests_total{status=~"5.."}[30d])) / sum(rate(http_requests_total[30d]))))
  /
  (1 - 0.999)  # Replace 0.999 with target SLO as decimal
) * 100
```

---

## 6. SLO Review Cadence

| Review Type            | Frequency          | Participants             |
| ---------------------- | ------------------ | ------------------------ |
| SLO attainment review  | Monthly            | Platform team            |
| Error budget review    | Weekly (automated) | On-call engineer         |
| SLO target adjustment  | Quarterly          | Engineering + Product    |
| Burn rate alert tuning | Monthly            | Platform team            |
| New service SLO intake | Per launch         | Service owner + Platform |

---

## 7. Service Ownership

| Service        | Owner                | Escalation Path         |
| -------------- | -------------------- | ----------------------- |
| Therapy Chat   | AI Platform          | #ai-platform, PagerDuty |
| Authentication | Platform Engineering | #platform, PagerDuty    |
| REST API       | Backend Team         | #backend, PagerDuty     |
| AI Inference   | ML Engineering       | #ml, PagerDuty          |
| Bias Detection | ML Engineering       | #ml, PagerDuty          |
| Landing Page   | Web Team             | #web, PagerDuty         |
| Dashboards     | Product Engineering  | #product, PagerDuty     |
| Storage        | Platform Engineering | #infra, PagerDuty       |
