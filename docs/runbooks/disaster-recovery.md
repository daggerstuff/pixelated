# Disaster Recovery Runbook — RTO/RPO Targets

**Document:** DR-1 | **Issue:**
[PIX-4132](https://linear.app/pixelated/issue/PIX-4132) **Owner:**
Infrastructure & Operations **Last Updated:** 2026-07-30 **Status:** Draft
(pending stakeholder sign-off)

---

## 1. Objective

Define Recovery Time Objective (RTO) and Recovery Point Objective (RPO) targets
for every production service in the Pixelated Empathy platform, establish a
service criticality classification framework, and document recovery procedures.

---

## 2. Service Criticality Classification

### Tier 1 — Critical (RTO: <1hr, RPO: <5min)

Services whose failure directly impacts patient safety, PHI integrity, or core
therapeutic functionality.

| Service                   | Description                                                                     | Dependencies                                                          |
| ------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| PostgreSQL                | Primary relational database (user accounts, therapy sessions, clinical records) | Storage volume                                                        |
| Therapy Session WebSocket | Real-time therapy chat between patient and AI                                   | Backend, OpenAI, PostgreSQL                                           |
| Auth Service              | Authentication, authorization, JWT management                                   | PostgreSQL (Primary); Redis (cache, Postgres fallback if unavailable) |
| OpenAI API Integration    | AI model inference for therapy responses                                        | OpenAI API (external)                                                 |
| MongoDB (if used)         | Document store for clinical notes                                               | Storage volume                                                        |

### Tier 2 — High (RTO: <4hr, RPO: <15min)

Services whose degradation impacts user experience or data integrity but does
not immediately endanger patient safety.

| Service                       | Description                                       | Dependencies                        |
| ----------------------------- | ------------------------------------------------- | ----------------------------------- |
| API Backend (FastAPI/Express) | REST API serving frontend and mobile clients      | PostgreSQL (Primary); Redis (cache) |
| Redis                         | Caching, session store, Celery broker             | —                                   |
| AI Inference Pipeline         | Emotional analysis, bias detection, model serving | PyTorch, GPU resources              |
| Message Queue (Celery)        | Async task processing (analytics, notifications)  | Redis                               |
| MinIO / S3 Object Storage     | Training data, exports, backups                   | Storage volume                      |
| Landing/Marketing Site        | Public-facing website (Astro)                     | CDN                                 |

### Tier 3 — Standard (RTO: <24hr, RPO: <1hr)

Services whose temporary loss is acceptable for up to 24 hours with minimal
business impact.

| Service                                            | Description                             | Dependencies   |
| -------------------------------------------------- | --------------------------------------- | -------------- |
| Monitoring Stack (Prometheus/Grafana/Alertmanager) | Metrics, dashboards, alerting           | Storage volume |
| Neo4j Graph Database                               | Knowledge graph for therapeutic context | —              |
| LanceDB Vector Store                               | Embedding vectors for semantic search   | —              |
| Analytics Pipeline                                 | Usage analytics, reporting              | ClickHouse     |
| Admin Dashboard                                    | Internal administration UI              | Backend API    |

### Tier 4 — Low (RTO: <72hr, RPO: <24hr)

Non-critical tooling with no customer-facing impact.

| Service                            | Description                            |
| ---------------------------------- | -------------------------------------- |
| CI/CD Pipeline (GitHub Actions)    | Build, test, deploy                    |
| Experiment Tracking (W&B)          | ML experiment logging                  |
| Development & Staging Environments | Non-production instances               |
| Internal Tooling                   | Scripts, utilities, monitoring scripts |
| Sentry (error tracking)            | Error aggregation and alerting         |

---

## 3. RTO/RPO Target Summary

| Tier | Description  | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) | Examples                        |
| ---- | ------------ | ----------------------------- | ------------------------------ | ------------------------------- |
| 1    | **Critical** | < 1 hour                      | < 5 minutes                    | PostgreSQL, Auth, Therapy WS    |
| 2    | **High**     | < 4 hours                     | < 15 minutes                   | API Backend, Redis, AI Pipeline |
| 3    | **Standard** | < 24 hours                    | < 1 hour                       | Monitoring, Neo4j, Analytics    |
| 4    | **Low**      | < 72 hours                    | < 24 hours                     | CI/CD, Dev/staging, Tooling     |

---

## 4. Recovery Procedures

### 4.1 Tier 1 Recovery (Critical)

**PostgreSQL failure:**

1. Detect: Prometheus alert `DatabaseConnectionsHigh` or app 500 errors
2. Assess: `pg_isready`, check `pg_stat_activity`, review PostgreSQL logs
3. Failover: Promote replica if available; otherwise restore from WAL archive
4. Validate: Run `pg_isready`, check recent data via application health check
5. Target: **< 1 hour**

**Therapy Session WebSocket failure:**

1. Detect: Prometheus alert on WebSocket connection errors
2. Assess: Check backend health, WebSocket server logs
3. Restart: `docker compose restart backend` or
   `kubectl rollout restart deployment/backend`
4. Validate: Test WebSocket connection, verify message flow
5. Target: **< 30 minutes**

**Auth Service failure:**

1. Detect: Elevated 401/403 errors, auth endpoint timeouts
2. Assess: Check JWT secret, Redis session store connectivity
3. Failover: Rotate to secondary auth instance if available
4. Validate: Test login flow, token refresh
5. Target: **< 30 minutes**

### 4.2 Tier 2 Recovery (High)

**API Backend failure:**

1. Detect: Prometheus `HighErrorRate` or `HighResponseTime` alerts
2. Assess: Check application logs, dependency connectivity (DB, Redis)
3. Restart: Rolling restart via `docker compose` or `k8s rollout`
4. Validate: Health endpoint returns 200, smoke-test key API routes
5. Target: **< 2 hours**

**Redis failure:**

1. Detect: Elevated cache miss rate, session errors
2. Assess: `redis-cli ping`, check memory usage
3. Restart: `docker compose restart redis` or restore from RDB/AOF
4. Validate: `redis-cli ping`, verify session data loads
5. Target: **< 1 hour**

**AI Inference Pipeline failure:**

1. Detect: Prometheus `AIInferenceLatencyHigh` or `EmotionalAnalysisError`
2. Assess: Check GPU availability, model loading, PyTorch errors
3. Restart: Restart AI service container/pod
4. Validate: Run test inference, verify latency within SLO
5. Target: **< 2 hours**

### 4.3 Tier 3 Recovery (Standard)

**Monitoring Stack failure:**

1. Detect: Missing metrics, blank Grafana dashboards
2. Assess: Check Prometheus target status, Grafana data source
3. Restart: `docker compose -f monitoring/docker-compose.monitoring.yml restart`
4. Validate: Verify metric collection, dashboard rendering
5. Target: **< 12 hours**

### 4.4 Tier 4 Recovery (Low)

**CI/CD failure:**

1. Detect: Failed GitHub Actions runs
2. Assess: Check workflow logs
3. Re-run: Re-trigger failed jobs or fix configuration
4. Target: **< 48 hours**

---

## 5. Backup and Restore Strategy

| Service         | Backup Method                         | Frequency                   | Retention | Restore Time Target |
| --------------- | ------------------------------------- | --------------------------- | --------- | ------------------- |
| PostgreSQL      | `pg_dump` + WAL archiving             | Daily full + continuous WAL | 30 days   | < 1 hr (Tier 1)     |
| Redis           | RDB snapshots + AOF                   | Hourly RDB                  | 7 days    | < 30 min            |
| MinIO/S3        | Cross-region replication + versioning | Continuous                  | 90 days   | < 2 hr              |
| MongoDB         | `mongodump` or Atlas backup           | Daily                       | 30 days   | < 1 hr              |
| Monitoring data | Prometheus TSDB snapshot              | Daily                       | 30 days   | < 4 hr              |
| Configuration   | Git (IaC)                             | Per commit                  | Permanent | < 1 hr              |

---

## 6. Disaster Scenarios

| Scenario                        | Impact                     | Recovery Strategy                  | RTO Target |
| ------------------------------- | -------------------------- | ---------------------------------- | ---------- |
| Single service crash            | Degraded functionality     | Restart container/pod              | < 30 min   |
| Database corruption             | Data loss, app errors      | Restore from backup                | < 2 hr     |
| Entire region failure           | Complete outage            | Failover to secondary region       | < 4 hr     |
| Ransomware / security incident  | Data compromise            | Isolate, restore from clean backup | < 24 hr    |
| Third-party API (OpenAI) outage | AI features unavailable    | Fallback to local model            | < 1 hr     |
| Cloud provider outage           | Infrastructure unavailable | DR site / multi-cloud failover     | < 8 hr     |

---

## 7. Testing Schedule

| Test Type                     | Frequency   | Scope                    | Success Criteria              |
| ----------------------------- | ----------- | ------------------------ | ----------------------------- |
| Backup restore test           | Monthly     | PostgreSQL, Redis        | Data integrity verified       |
| Failover drill                | Quarterly   | Auth service, DB replica | < RTO failover time           |
| Full DR exercise              | Bi-annually | All Tier 1 & 2 services  | All RTO/RPO targets met       |
| Tabletop exercise             | Quarterly   | Incident response team   | Documented improvement items  |
| Third-party outage simulation | Bi-annually | OpenAI fallback path     | Graceful degradation verified |

---

## 8. Stakeholder Sign-Off

> **⚠️ PENDING** — The following stakeholders must review and approve these
> RTO/RPO targets:

| Role                   | Name | Sign-off Date | Status  |
| ---------------------- | ---- | ------------- | ------- |
| CTO / Engineering Lead |      |               | Pending |
| Head of Product        |      |               | Pending |
| Security Officer       |      |               | Pending |
| VP of Engineering      |      |               | Pending |

Once signed off, this section will be updated and the RTO/RPO commitments are
considered active.
