---
title: Disaster Recovery — RTO & RPO Targets
description:
  Recovery Time Objective and Recovery Point Objective targets for all Pixelated
  Empathy critical services, aligned with backup infrastructure and DR
  procedures.
---

<!-- markdownlint-disable MD025 MD013 MD036 -->

<div align="center">

# Disaster Recovery — RTO & RPO Targets

**Pixelated Empathy — Enterprise Readiness Program**

_DR-1: Define RTO/RPO targets for all critical services_

</div>

---

## 1. Purpose & Scope

This runbook defines **Recovery Time Objectives (RTO)** and **Recovery Point
Objectives (RPO)** for every production service in the Pixelated Empathy
platform. It classifies services by criticality tier, maps each service to its
backup mechanism, and documents the DR procedures that achieve these targets.

**Scope**: All customer-facing and infrastructure services deployed in the
Pixelated Empathy production environment, including the core web application, AI
cognitive engine, databases, caching layer, reverse proxy, memory service, and
model storage.

**Related documents**:

- [SLO Definitions](./slo-definitions.md) — service-level objectives for uptime,
  latency, throughput
- `scripts/backup/disaster-recovery.sh` — existing DR automation script
- `scripts/backup/backup-system.sh` — full system backup script
- `scripts/backup/backup-schedule.cron` — cron backup schedule

---

## 2. Criticality Tier Definitions

Services are classified into four tiers based on business impact and patient
safety considerations. Pixelated Empathy is a HIPAA-compliant clinical AI
platform — patient-facing services receive the highest criticality.

| Tier       | Label             | Description                                                                                                     | RTO Target     | RPO Target       |
| ---------- | ----------------- | --------------------------------------------------------------------------------------------------------------- | -------------- | ---------------- |
| **Tier 1** | Mission-Critical  | Patient-facing services whose disruption directly impacts clinical operations or patient safety                 | **< 1 hour**   | **< 5 minutes**  |
| **Tier 2** | Business-Critical | Core platform services whose disruption degrades platform functionality but does not directly endanger patients | **< 4 hours**  | **< 15 minutes** |
| **Tier 3** | Important         | Supporting services whose disruption causes degraded performance or limited feature availability                | **< 24 hours** | **< 1 hour**     |
| **Tier 4** | Non-Critical      | Auxiliary services whose disruption does not affect core platform functionality                                 | **< 72 hours** | **< 24 hours**   |

### Tier Classification Criteria

- **Patient Safety**: Does disruption create risk to patients or clinicians
  relying on the platform?
- **Revenue Impact**: Does disruption directly cause revenue loss or contract
  breach?
- **Data Integrity**: Does disruption risk permanent data loss of clinical or
  user data?
- **Recoverability**: How quickly can the service be restored using existing
  backup infrastructure?

---

## 3. Service Inventory & Classification

### 3.1 Complete Service Inventory

| #   | Service                  | Technology           | Port   | Tier   | RTO | RPO   | Rationale                                                                                                                            |
| --- | ------------------------ | -------------------- | ------ | ------ | --- | ----- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Pixelated App**        | Astro SSR + React 19 | 3000   | Tier 1 | 1h  | 5min  | Primary patient-facing web interface. Direct clinical workflow dependency.                                                           |
| 2   | **Pixelated AI**         | Python FastAPI       | 8000   | Tier 1 | 1h  | 5min  | Cognitive engine powering clinical training scenarios. Core product value.                                                           |
| 3   | **PostgreSQL (Primary)** | PostgreSQL 16        | 5432   | Tier 1 | 1h  | 5min  | Primary transactional database. Stores user accounts, session data, clinical assessments. WAL archiving enables PITR.                |
| 4   | **Redis**                | Redis 7              | 6379   | Tier 2 | 4h  | 15min | Session cache, rate limiting, queue. Data is ephemeral/reconstructible from PostgreSQL.                                              |
| 5   | **Caddy**                | Caddy 2              | 80/443 | Tier 2 | 4h  | 15min | Reverse proxy and TLS termination. Stateless — config-only recovery.                                                                 |
| 6   | **Foresight MCP**        | Node.js MCP Server   | 3001   | Tier 2 | 4h  | 15min | Cross-session memory service. Backed by `scripts/memory/backup-shared-memory-db.sh`.                                                 |
| 7   | **Vector Store**         | pgvector / Qdrant    | 7687   | Tier 2 | 4h  | 15min | Embedding storage for AI retrieval. Reconstructible from source data.                                                                |
| 8   | **MongoDB**              | MongoDB 7            | 27017  | Tier 3 | 24h | 1h    | Analytics and logging store. Non-clinical data.                                                                                      |
| 9   | **NeMo Models**          | NVIDIA NeMo          | N/A    | Tier 3 | 24h | 1h    | Pre-trained AI model artifacts. Recoverable via `scripts/devops/nemo-recovery.sh`. Large file — restore time dominated by bandwidth. |
| 10  | **Grafana**              | Grafana OSS          | 3100   | Tier 4 | 72h | 24h   | Observability dashboards. Config backed up; dashboards re-deployable from Git.                                                       |
| 11  | **Prometheus**           | Prometheus           | 9090   | Tier 4 | 72h | 24h   | Metrics storage. 200h retention. Historical data loss acceptable in DR.                                                              |
| 12  | **Alertmanager**         | Alertmanager         | 9093   | Tier 4 | 72h | 24h   | Alert routing config. Re-deployable from Git.                                                                                        |
| 13  | **Node Exporter**        | node_exporter        | 9100   | Tier 4 | 72h | N/A   | System metrics exporter. Stateless.                                                                                                  |
| 14  | **Postgres Exporter**    | postgres-exporter    | 9187   | Tier 4 | 72h | N/A   | Database metrics exporter. Stateless.                                                                                                |
| 15  | **Redis Exporter**       | redis-exporter       | 9121   | Tier 4 | 72h | N/A   | Redis metrics exporter. Stateless.                                                                                                   |

### 3.2 Service Dependency Map

```
Patient Request → Caddy (T2) → Pixelated App (T1) → PostgreSQL (T1)
                                         ↘ Pixelated AI (T1) → Vector Store (T2)
                                         ↘ Redis (T2)
                                         ↘ Foresight MCP (T2) → MongoDB (T3)
                                         ↰ NeMo Models (T3)
```

**Key insight**: Tier 1 services depend on Tier 2 infrastructure (Caddy, Redis,
Vector Store). Tier 2 recovery must complete within the Tier 1 RTO window for
full restoration. In practice, stateless Tier 2 services (Caddy) recover in
minutes via config re-deployment.

---

## 4. RTO/RPO Targets Summary

### 4.1 RTO Targets (Recovery Time Objective)

| Tier   | Target     | Measurement                                 | Acceptable Downtime/Month |
| ------ | ---------- | ------------------------------------------- | ------------------------- |
| Tier 1 | < 1 hour   | From incident detection to service restored | ~20 min (at 99.95% SLA)   |
| Tier 2 | < 4 hours  | From incident detection to service restored | ~22 min (at 99.9% SLA)    |
| Tier 3 | < 24 hours | From incident detection to service restored | ~43 min (at 99.0% SLA)    |
| Tier 4 | < 72 hours | From incident detection to service restored | N/A (no SLA commitment)   |

### 4.2 RPO Targets (Recovery Point Objective)

| Tier   | Target       | Measurement                                     | Max Data Loss         |
| ------ | ------------ | ----------------------------------------------- | --------------------- |
| Tier 1 | < 5 minutes  | Time between last successful backup and failure | 5 min of transactions |
| Tier 2 | < 15 minutes | Time between last successful backup and failure | 15 min of data        |
| Tier 3 | < 1 hour     | Time between last successful backup and failure | 1 hour of data        |
| Tier 4 | < 24 hours   | Time between last successful backup and failure | 24 hours of data      |

### 4.3 Current Backup Infrastructure Alignment

| Backup Mechanism             | Script                                                                          | Schedule                    | RPO Achieved      | Target RPO    | Status                 |
| ---------------------------- | ------------------------------------------------------------------------------- | --------------------------- | ----------------- | ------------- | ---------------------- |
| PostgreSQL WAL + base backup | `docker/postgres/backup/backup.sh` + `ai/docker/postgres/backup/archive_wal.sh` | Daily base + continuous WAL | < 5 min           | Tier 1: 5min  | ✅ Meets Tier 1        |
| Full system backup           | `scripts/backup/backup-system.sh`                                               | Daily 2:00 AM               | < 24h             | Tier 3: 1h    | ⚠️ Gap — see Section 7 |
| Rclone incremental           | `scripts/backup/rclone-nightly-backup.sh`                                       | Every 6 hours               | < 6h              | Tier 2: 15min | ⚠️ Gap — see Section 7 |
| Memory DB backup             | `scripts/memory/backup-shared-memory-db.sh`                                     | Per cron schedule           | TBD               | Tier 2: 15min | ⚠️ Needs measurement   |
| Backup verification          | `scripts/backup/verify-backups.sh`                                              | Monthly 1st 4:00 AM         | N/A (validation)  | —             | ✅ In place            |
| DR automation                | `scripts/backup/disaster-recovery.sh`                                           | On-demand                   | RTO_TARGET=4h     | Tier 2: 4h    | ✅ Meets Tier 2        |
| NeMo model recovery          | `scripts/devops/nemo-recovery.sh`                                               | On-demand                   | Bandwidth-limited | Tier 3: 24h   | ✅ Meets Tier 3        |

**Note**: The existing `disaster-recovery.sh` script has `RTO_TARGET=14400` (4
hours) and `RPO_TARGET=3600` (1 hour), which aligns with Tier 2/3 targets. Tier
1 RTO/RPO requires additional infrastructure (streaming replication, hot
standby) — see Section 7.

---

## 5. Backup Strategy by Service

### 5.1 PostgreSQL (Tier 1)

- **Backup method**: WAL archiving + daily base backup
- **Scripts**: `docker/postgres/backup/backup.sh`,
  `docker/postgres/backup/restore.sh`,
  `ai/docker/postgres/backup/archive_wal.sh`
- **Recovery type**: Point-in-time recovery (PITR)
- **RPO achieved**: < 5 minutes (WAL streaming)
- **RTO achieved**: < 1 hour (restore from base + WAL replay)
- **Retention**: 30 days of base backups; WAL archived continuously
- **Verification**: `scripts/backup/verify-backups.sh` monthly
- **Storage**: Local + Google Drive (rclone) + S3 (backup-system.sh)

### 5.2 Redis (Tier 2)

- **Backup method**: RDB snapshot + AOF persistence
- **Recovery**: Restore from RDB snapshot, AOF replay for recent writes
- **RPO achieved**: < 15 minutes (AOF fsync every 15s)
- **RTO achieved**: < 4 hours (RDB restore + restart)
- **Note**: Redis data is cache/session — reconstructible from PostgreSQL if
  needed

### 5.3 Pixelated App (Tier 1)

- **Backup method**: Application state stored in PostgreSQL + Redis; code in Git
- **Recovery**: Redeploy from Git + restore DB + restore Redis
- **RTO achieved**: < 1 hour (container redeploy + DB restore)
- **RPO achieved**: Inherits PostgreSQL RPO (< 5 min)

### 5.4 Pixelated AI (Tier 1)

- **Backup method**: Model artifacts (NeMo) backed up separately; inference
  state in PostgreSQL
- **Recovery**: Redeploy container + restore model artifacts + restore DB
- **RTO achieved**: < 1 hour (container redeploy + model restore)
- **RPO achieved**: Inherits PostgreSQL RPO for state; NeMo models have Tier 3
  RPO

### 5.5 Caddy (Tier 2)

- **Backup method**: Config-only (Caddyfile) in Git
- **Recovery**: Redeploy with config from Git
- **RTO achieved**: < 5 minutes (stateless, config-only)
- **RPO achieved**: N/A (stateless)

### 5.6 Foresight MCP (Tier 2)

- **Backup method**: `scripts/memory/backup-shared-memory-db.sh`
- **Recovery**: `scripts/memory/restore-shared-memory-db.sh`
- **RTO achieved**: < 4 hours
- **RPO achieved**: TBD — needs measurement against cron schedule

### 5.7 Vector Store (Tier 2)

- **Backup method**: Embeddings reconstructible from source data (PostgreSQL +
  model)
- **Recovery**: Re-index from source
- **RTO achieved**: < 4 hours (re-index is I/O-bound)
- **RPO achieved**: N/A (reconstructible)

### 5.8 MongoDB (Tier 3)

- **Backup method**: `mongodump` via backup-system.sh
- **Recovery**: `mongorestore` from backup
- **RTO achieved**: < 24 hours
- **RPO achieved**: < 24 hours (daily backup)

### 5.9 NeMo Models (Tier 3)

- **Backup method**: Model artifacts stored in S3 + local
- **Recovery**: `scripts/devops/nemo-recovery.sh`
- **RTO achieved**: < 24 hours (bandwidth-limited)
- **RPO achieved**: < 1 hour (models are immutable post-training)

### 5.10 Observability Stack (Tier 4)

- **Grafana**: Config in Git; dashboards re-deployable from
  `monitoring/dashboards/`
- **Prometheus**: 200h retention; historical data loss acceptable in DR
- **Alertmanager**: Config in Git; re-deployable
- **Exporters**: Stateless; re-deploy with container stack

---

## 6. DR Procedures

### 6.1 Disaster Recovery Execution

The existing `scripts/backup/disaster-recovery.sh` script supports three
recovery types:

```bash
# Database-only recovery
./scripts/backup/disaster-recovery.sh recover_database

# Application-only recovery (containers + config)
./scripts/backup/disaster-recovery.sh recover_application

# Full system recovery
./scripts/backup/disaster-recovery.sh recover_full_system
```

**Environment variables** (defaults from script):

- `BACKUP_BUCKET=pixelated-empathy-backups`
- `RTO_TARGET=14400` (4 hours)
- `RPO_TARGET=3600` (1 hour)

### 6.2 Recovery Procedure by Tier

#### Tier 1 Recovery (< 1 hour RTO)

1. **Detect** (0-5 min): Alertmanager triggers PagerDuty for Tier 1 service
2. **Acknowledge** (0-5 min): On-call engineer acknowledges, opens incident
   channel
3. **Assess** (5-15 min): Identify failure scope (DB, app, or AI)
4. **Execute recovery** (15-45 min):
   - PostgreSQL: Restore from latest base + WAL replay via `restore.sh`
   - Application: Redeploy containers from latest Git + restored DB
   - AI service: Redeploy container + restore NeMo models if needed
5. **Verify** (45-55 min): Health checks, smoke tests, data integrity validation
6. **Declare restored** (55-60 min): Close incident, begin postmortem timer

#### Tier 2 Recovery (< 4 hour RTO)

1. **Detect** (0-30 min): Alertmanager triggers Slack + email
2. **Acknowledge** (0-30 min): On-call engineer acknowledges
3. **Execute recovery** (30 min-3 hr):
   - Redis: Restore RDB snapshot or rebuild from PostgreSQL
   - Caddy: Redeploy from Git config
   - Foresight MCP: `restore-shared-memory-db.sh`
   - Vector Store: Re-index from source data
4. **Verify** (3-3.5 hr): Functional tests
5. **Declare restored** (3.5-4 hr): Close incident

#### Tier 3 Recovery (< 24 hour RTO)

1. **Detect** (0-2 hr): Monitoring detects service degradation
2. **Execute recovery** (2-20 hr):
   - MongoDB: `mongorestore` from latest backup
   - NeMo models: `nemo-recovery.sh` (bandwidth-limited)
3. **Verify** (20-23 hr): Data consistency checks
4. **Declare restored** (23-24 hr): Close incident

#### Tier 4 Recovery (< 72 hour RTO)

1. **Detect** (0-4 hr): Monitoring or manual check
2. **Execute recovery** (4-48 hr): Redeploy observability containers from Git
3. **Verify** (48-70 hr): Dashboard/config validation
4. **Declare restored** (70-72 hr): Close incident

### 6.3 Backup Verification Procedure

```bash
# Monthly verification (cron: 1st of month, 4:00 AM)
./scripts/backup/verify-backups.sh

# Manual verification
./scripts/backup/verify-backups.sh --target db_backup
./scripts/backup/verify-backups.sh --target app_data
```

**Verification checks**:

- Backup file exists and is non-empty
- Checksum matches expected value
- Test restore to staging environment
- Verify row counts against production snapshot

---

## 7. Gap Analysis & Remediation

### 7.1 Current Gaps

| Gap                                   | Affected Tier | Current State                                         | Required State               | Remediation                                                          |
| ------------------------------------- | ------------- | ----------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| **No streaming replication**          | Tier 1        | Daily base + WAL archive                              | Hot standby with < 5 min RPO | Deploy PostgreSQL streaming replication with hot standby             |
| **Rclone schedule too infrequent**    | Tier 2        | Every 6 hours                                         | Every 15 minutes             | Increase rclone incremental frequency or use S3 sync with versioning |
| **Memory DB backup unmeasured**       | Tier 2        | Unknown RPO                                           | < 15 min RPO                 | Measure Foresight MCP backup frequency, adjust cron schedule         |
| **No automated DR drill**             | All           | Manual only                                           | Quarterly automated test     | Schedule quarterly DR drill (see Section 8)                          |
| **No DR runbook in deployment docs**  | All           | This document                                         | Also in deployment docs      | Add this runbook to deployment documentation                         |
| **Monitoring dashboards not mounted** | Tier 4        | JSON files in `monitoring/dashboards/` not in Grafana | Dashboards loaded in Grafana | Fix docker-compose volume mount (pre-existing gap from SLO runbook)  |

### 7.2 Remediation Priority

1. **P0**: PostgreSQL streaming replication (Tier 1 RPO compliance)
2. **P1**: Increase rclone incremental frequency (Tier 2 RPO compliance)
3. **P1**: Measure and adjust Foresight MCP backup frequency
4. **P2**: Schedule and execute first quarterly DR drill
5. **P2**: Add DR runbook to deployment docs
6. **P3**: Fix Grafana dashboard mounting (shared with SLO runbook gap)

---

## 8. DR Drill Schedule

### 8.1 Quarterly DR Drill Plan

| Quarter | Drill Type           | Scope                         | Success Criteria                                    |
| ------- | -------------------- | ----------------------------- | --------------------------------------------------- |
| Q1      | Database recovery    | PostgreSQL PITR from WAL      | RTO < 1h, RPO < 5min, data integrity verified       |
| Q2      | Full system recovery | Complete platform from backup | RTO < 4h for Tier 1+2, all services operational     |
| Q3      | AI service recovery  | NeMo model + AI container     | RTO < 1h, inference verified                        |
| Q4      | Failover simulation  | Simulate primary DB failure   | Hot standby promoted, RTO < 5min (post-replication) |

### 8.2 Drill Execution Procedure

1. **Schedule**: Drill date set 2 weeks in advance; stakeholders notified
2. **Pre-drill**: Snapshot current state; prepare staging environment
3. **Execute**: Run DR procedure in staging; record timestamps
4. **Measure**: Capture actual RTO and RPO; compare to targets
5. **Document**: Write drill report with findings and gaps
6. **Remediate**: Create tickets for any gaps discovered
7. **Sign-off**: Engineering lead and compliance officer sign off

### 8.3 Backup Restore Testing

```bash
# Test PostgreSQL restore to staging
docker/postgres/backup/restore.sh --target staging --timestamp <latest>

# Test memory DB restore to staging
scripts/memory/restore-shared-memory-db.sh --target staging

# Test NeMo model recovery
scripts/devops/nemo-recovery.sh --target staging

# Verify backup integrity
scripts/backup/verify-backups.sh --full
```

---

## 9. Business Continuity Plan (BCP)

### 9.1 BCP Overview

In the event of a disaster that renders the primary production environment
unrecoverable, the following business continuity procedures apply:

### 9.2 BCP Tiers

| Scenario                   | Response                                              | Timeline                          |
| -------------------------- | ----------------------------------------------------- | --------------------------------- |
| **Single service failure** | Failover to backup/standby; restore from backup       | Tier 1: 1h, Tier 2: 4h            |
| **Data center failure**    | Deploy to secondary region; restore from cloud backup | < 24h for Tier 1+2                |
| **Ransomware/corruption**  | Isolate, restore from immutable backup, forensics     | < 72h with data integrity audit   |
| **Total loss**             | Full rebuild from Git + cloud backups                 | < 72h for Tier 1+2, < 1 week full |

### 9.3 Communication Plan

| Stakeholder                  | Notification Method          | Timeline                                       |
| ---------------------------- | ---------------------------- | ---------------------------------------------- |
| Engineering team             | PagerDuty + Slack #incidents | Immediate (automated)                          |
| Leadership                   | Email + Slack #exec-status   | < 30 min from detection                        |
| Customers (Enterprise)       | Status page + email          | < 1 hr from detection                          |
| Customers (Pro/Free)         | Status page                  | < 4 hr from detection                          |
| Compliance officer           | Email + phone                | < 1 hr for Tier 1 incidents                    |
| HIPAA breach (if applicable) | HHS notification             | < 60 days (per HIPAA Breach Notification Rule) |

### 9.4 Data Retention Policy

| Data Type             | Retention         | Backup Location           |
| --------------------- | ----------------- | ------------------------- |
| PostgreSQL backups    | 30 days rolling   | Local + S3 + Google Drive |
| Redis snapshots       | 7 days rolling    | Local                     |
| NeMo models           | Latest 2 versions | S3 + local                |
| Memory DB (Foresight) | 7 days rolling    | Local + S3                |
| MongoDB dumps         | 30 days rolling   | Local + S3                |
| Monitoring data       | 200h (Prometheus) | Local only (Tier 4)       |
| Audit logs            | 6 years (HIPAA)   | Immutable S3 storage      |

---

## 10. RTO/RPO Compliance Dashboard

The following Prometheus queries track RTO/RPO compliance. These align with the
SLO monitoring infrastructure from the SLO runbook:

### 10.1 Backup Age Monitoring

```promql
# PostgreSQL backup age (should be < 5min for Tier 1)
time() - pg_backup_last_success_timestamp_seconds

# Redis last save age
time() - redis_rdb_last_save_timestamp_seconds

# Foresight MCP backup age
time() - foresight_backup_last_success_timestamp_seconds
```

### 10.2 RTO Compliance (Recovery Time Tracking)

```promql
# Service recovery time (measured during drills)
histogram_quantile(0.95, dr_recovery_duration_seconds_bucket{tier="1"})

# Drill success rate
dr_drill_success_total / dr_drill_total
```

> **Note**: These metrics require instrumentation not yet present in the
> monitoring stack. See Gap Analysis (Section 7) for remediation items.

---

## 11. Governance & Review

### 11.1 Review Cadence

| Review Type            | Frequency           | Owner                   | Output                         |
| ---------------------- | ------------------- | ----------------------- | ------------------------------ |
| RTO/RPO target review  | Quarterly           | Engineering Lead        | Updated targets if needed      |
| DR drill review        | Quarterly           | SRE + Eng Lead          | Drill report + gap tickets     |
| BCP review             | Annually            | Leadership + Compliance | Updated BCP document           |
| Backup verification    | Monthly (automated) | SRE                     | Verification report            |
| Gap remediation review | Monthly             | SRE                     | Progress update on P0-P3 items |

### 11.2 Change Management

RTO/RPO target changes require:

1. RFC describing the proposed change and rationale
2. Impact analysis on SLA commitments
3. Engineering Lead approval
4. Compliance Officer sign-off (for Tier 1/2 changes)
5. Customer notification (for SLA-affecting changes)
6. Update to this document + SLO definitions runbook

---

## 12. Glossary

| Term                 | Definition                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------- |
| **RTO**              | Recovery Time Objective — maximum acceptable time to restore a service after failure        |
| **RPO**              | Recovery Point Objective — maximum acceptable data loss measured in time                    |
| **DR**               | Disaster Recovery — procedures for restoring services after a catastrophic failure          |
| **BCP**              | Business Continuity Plan — procedures for maintaining business operations during a disaster |
| **PITR**             | Point-in-Time Recovery — restoring a database to a specific moment using WAL logs           |
| **WAL**              | Write-Ahead Log — PostgreSQL's transaction log enabling PITR                                |
| **Hot Standby**      | A standby server continuously receiving updates, ready for immediate failover               |
| **DR Drill**         | A planned exercise to test DR procedures and measure actual RTO/RPO                         |
| **Tier**             | Criticality classification (1-4) determining RTO/RPO targets                                |
| **Immutable Backup** | Backup storage that cannot be modified or deleted (ransomware protection)                   |

---

## 13. References

### Internal Documentation

- [SLO Definitions](./slo-definitions.md) — service-level objectives runbook
- `scripts/backup/disaster-recovery.sh` — DR automation script
- `scripts/backup/backup-system.sh` — full system backup
- `scripts/backup/backup-schedule.cron` — backup cron schedule
- `scripts/backup/verify-backups.sh` — backup verification
- `scripts/backup/rclone-nightly-backup.sh` — cloud backup
- `docker/postgres/backup/backup.sh` — PostgreSQL backup
- `docker/postgres/backup/restore.sh` — PostgreSQL restore
- `scripts/memory/backup-shared-memory-db.sh` — Foresight MCP backup
- `scripts/devops/nemo-recovery.sh` — NeMo model recovery

### External References

- [Google SRE Workbook — Disaster Recovery](https://sre.google/workbook/disaster-recovery/)
- [NIST SP 800-34 — Contingency Planning Guide](https://csrc.nist.gov/publications/detail/sp/800-34/rev-1/final)
- [HIPAA Breach Notification Rule](https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html)

### Linear Tickets

- [PIX-4132](https://linear.app/pixelated/issue/PIX-4132) — DR-1: Define RTO/RPO
  Targets
- [PIX-4125](https://linear.app/pixelated/issue/PIX-4125) — Parent: Disaster
  Recovery & Business Continuity
