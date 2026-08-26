---
title: Backup & Restore Testing
description:
  Procedures for verifying database backups, testing full restores,
  point-in-time recovery (PITR), retention policies, and quarterly restore
  drills for Pixelated Empathy.
---

<!-- markdownlint-disable MD025 MD013 MD036 -->

<div align="center">

# Backup & Restore Testing

**Pixelated Empathy — Enterprise Readiness Program**

_DR-2: Database backup and restore testing_

</div>

---

## 1. Purpose & Scope

This runbook defines the procedures for verifying automated database backups,
testing full restores, validating point-in-time recovery (PITR), documenting
retention policies, and scheduling quarterly restore drills for all datastores
in the Pixelated Empathy platform.

**In scope:**

| Datastore                                         | Backup Method                               | Frequency    | Retention    | RTO/RPO Tier                 |
| ------------------------------------------------- | ------------------------------------------- | ------------ | ------------ | ---------------------------- |
| PostgreSQL (primary)                              | `pg_dump` + WAL archiving + `pg_basebackup` | Daily 2 AM   | 30 days      | Tier 1 (RTO <1h, RPO <5min)  |
| PostgreSQL (AI submodule)                         | `pg_dump` + WAL archiving                   | Daily        | 30 days      | Tier 1                       |
| Redis                                             | `redis-cli --rdb` snapshot                  | Daily 2 AM   | 30 days      | Tier 2 (RTO <4h, RPO <15min) |
| Foresight/Memory DB (SQLite)                      | `.backup` + gzip                            | Daily        | 14 days      | Tier 2                       |
| App data (uploads, config)                        | `tar` + gzip                                | Daily 2 AM   | 30 days      | Tier 2                       |
| Monitoring data (dashboards, Grafana, Prometheus) | `tar` + gzip                                | Daily 2 AM   | 30 days      | Tier 4                       |
| MongoDB (Atlas managed)                           | Atlas automated backups                     | Atlas config | Atlas config | Tier 3                       |

**Out of scope:**

- Codebase backups (rclone to Google Drive — covered in DR runbook)
- S3 offsite replication (covered in `disaster-recovery.sh`)
- NeMo model recovery (covered in `nemo-recovery.sh`)

**Related documents:**

- [DR — RTO & RPO Targets](./dr-rto-rpo-targets.md) — Service tier definitions
- [Infra Disaster Recovery](./infra-disaster-recovery.md) — Infrastructure-level
  DR
- [SLA Breach Response](./sla-breach-response.md) — Incident response procedures
- [SLO Definitions](./slo-definitions.md) — Service-level objectives

---

## 2. Backup Infrastructure Overview

### 2.1 Backup System Script (`backup-system.sh`)

**Location:** `scripts/backup/backup-system.sh` (350 lines)

**Function:** Full system backup executed daily at 2 AM via cron.

| Component  | Method                                          | Output                              |
| ---------- | ----------------------------------------------- | ----------------------------------- |
| PostgreSQL | `pg_dump \| gzip`                               | `db_backup_YYYYMMDD_HHMMSS.sql.gz`  |
| Redis      | `redis-cli --rdb`                               | `redis_backup_YYYYMMDD_HHMMSS.rdb`  |
| App data   | `tar -czf` (uploads/, config/, .env)            | `app_data_YYYYMMDD_HHMMSS.tar.gz`   |
| Monitoring | `tar -czf` (dashboards/, grafana/, prometheus/) | `monitoring_YYYYMMDD_HHMMSS.tar.gz` |

**Upload:** rclone to `drive:pixel-data/backups/` (Google Drive remote).
**Retention:** 30 days local + 30 days remote. **Notifications:** Slack
webhook + email on success/failure. **Manifest:** JSON backup manifest written
to backup root.

**Commands:**

```bash
# Full backup
./scripts/backup/backup-system.sh backup

# List available backups
./scripts/backup/backup-system.sh list

# Restore from backup
./scripts/backup/backup-system.sh restore <timestamp>

# Cleanup old backups
./scripts/backup/backup-system.sh cleanup
```

### 2.2 PostgreSQL Dedicated Backup (`docker/postgres/backup/backup.sh`)

**Location:** `docker/postgres/backup/backup.sh` (309 lines)

**Function:** Standalone PostgreSQL backup with schema, data, and WAL base
backup.

| Step     | Command                                | Purpose                |
| -------- | -------------------------------------- | ---------------------- |
| Schema   | `pg_dump --schema-only`                | DDL without data       |
| Data     | `pg_dump --format=custom --compress=9` | Compressed binary dump |
| WAL base | `pg_basebackup`                        | Base backup for PITR   |

**Config:** `DB_HOST=localhost`, `DB_PORT=5432`, `DB_USER=pixelated`.
**Retention:** 30 days (`BACKUP_ROOT=/backups`). **Manifest:**
`BACKUP_MANIFEST.txt` with restoration instructions.

### 2.3 PostgreSQL Restore (`docker/postgres/backup/restore.sh`)

**Location:** `docker/postgres/backup/restore.sh` (390 lines)

**Function:** Restore from timestamped backup directory.

```bash
# List available backups
./docker/postgres/backup/restore.sh --list

# Restore from specific timestamp
./docker/postgres/backup/restore.sh 20260730_020000

# Restore specific database
./docker/postgres/backup/restore.sh 20260730_020000 pixelated_empathy
```

**Validation steps:**

1. Verify backup directory exists + manifest present
2. Create databases if not existing
3. Restore schema (`pg_restore --schema-only --no-owner --clean`)
4. Restore data (`pg_restore --no-owner --clean`)
5. Verify restore (table count, row count, connectivity check)

### 2.4 AI Submodule PostgreSQL PITR (`ai/docker/postgres/backup/`)

**Location:** `ai/docker/postgres/backup/`

| Script           | Lines | Function                           |
| ---------------- | ----- | ---------------------------------- |
| `backup.sh`      | —     | Standard pg_dump + WAL base backup |
| `restore.sh`     | —     | Restore from timestamped backup    |
| `archive_wal.sh` | 18    | WAL archive command handler        |

**WAL archiving config** (`postgresql.conf`):

```conf
archive_mode = on
wal_level = replica
archive_timeout = 60s
archive_command = '/path/to/archive_wal.sh %p %f'
```

**WAL archive directory:** `/backups/postgres/wal`

### 2.5 Foresight/Memory DB Backup (`scripts/memory/`)

**Location:** `scripts/memory/backup-shared-memory-db.sh` (95 lines)

**Function:** SQLite online backup for Foresight MCP memory database.

| Step     | Command                        | Purpose                 |
| -------- | ------------------------------ | ----------------------- |
| Backup   | `.timeout 5000 .backup <dest>` | Online SQLite backup    |
| Compress | `gzip`                         | Reduce storage          |
| Verify   | File size check                | Ensure non-empty backup |

**Config:** `FORESIGHT_LOCAL_DB_PATH` (source),
`BACKUP_DIR=/var/backups/pixelated-memory`. **Retention:** 14 days
(`MEMORY_BACKUP_RETENTION_DAYS`).

**Restore** (`scripts/memory/restore-shared-memory-db.sh`, 104 lines):

```bash
# Restore from backup
./scripts/memory/restore-shared-memory-db.sh <backup_file>

# Force overwrite
./scripts/memory/restore-shared-memory-db.sh <backup_file> --force
```

Validation: `PRAGMA integrity_check`, existing DB backed up to
`.pre-restore.bak`, atomic `mv`.

### 2.6 Backup Verification (`verify-backups.sh`)

**Location:** `scripts/backup/verify-backups.sh` (100 lines)

**Function:** Monthly backup integrity verification (1st of month, 4 AM).

| Step | Action                                                  |
| ---- | ------------------------------------------------------- |
| 1    | Download latest `db_backup_*.sql.gz` from rclone remote |
| 2    | Download latest `app_data_*.tar.gz` from rclone remote  |
| 3    | `gzip -t` integrity check on SQL backup                 |
| 4    | `tar -tzf` integrity check on app data archive          |
| 5    | Log results to `/var/log/backup-verification.log`       |
| 6    | Prune remote backups older than 30 days                 |

### 2.7 Disaster Recovery (`disaster-recovery.sh`)

**Location:** `scripts/backup/disaster-recovery.sh` (180 lines)

**Function:** S3-based disaster recovery.

**Config:** `BACKUP_BUCKET=pixelated-empathy-backups`, `RTO_TARGET=14400s` (4h),
`RPO_TARGET=3600s` (1h).

| Recovery Type | Steps                                                                |
| ------------- | -------------------------------------------------------------------- |
| Database      | S3 download → gzip verify → `psql` restore → verify (table count ≥5) |
| Application   | S3 download → tar extract → `kubectl apply` → rollout status         |
| Full          | `terraform apply` → recover_database → recover_application → verify  |

**Verification:** `pg_isready`, table count ≥5, `/health`,
`/api/health/database`.

### 2.8 Backup Schedule (`backup-schedule.cron`)

**Location:** `scripts/backup/backup-schedule.cron` (18 lines)

```cron
# Daily full backup at 2 AM
0 2 * * * /home/user/pixelated/scripts/backup/backup-system.sh backup >> /var/log/backup-system.log 2>&1

# Codebase to Google Drive every 6 hours
0 */6 * * * /home/user/pixelated/scripts/backup/rclone-nightly-backup.sh >> /var/log/rclone-backup.log 2>&1

# Monthly backup verification on 1st at 4 AM
0 4 1 * * /home/user/pixelated/scripts/backup/verify-backups.sh >> /var/log/backup-verification.log 2>&1
```

---

## 3. Backup Verification Procedures

### 3.1 Daily Verification (Automated)

**Owner:** On-call engineer (review alerts) **Cadence:** Daily, reviewed via
monitoring dashboard

| Check              | Method                                                   | Expected Result | Alert                  |
| ------------------ | -------------------------------------------------------- | --------------- | ---------------------- |
| Backup completed   | `backup_status{backup_type="postgresql"} == 1`           | Success (1)     | BackupFailed           |
| Backup within 24h  | `time() - backup_last_success_timestamp_seconds < 86400` | <24h since last | BackupMissed           |
| Backup size stable | `backup_size_bytes > 0`                                  | Non-zero        | BackupSizeZero         |
| No backup errors   | `increase(backup_failure_total[24h]) == 0`               | Zero failures   | BackupFailuresDetected |

> **Note:** Backup metrics require a textfile collector integration (see §6 —
> Follow-up DR-2.1).

### 3.2 Weekly Verification (Manual Spot Check)

**Owner:** SRE / DevOps engineer **Cadence:** Weekly (Monday)

```bash
# 1. List recent backups
ls -la /backups/ | tail -7

# 2. Verify PostgreSQL backup integrity
ls -la /backups/db_backup_*.sql.gz | tail -7
gzip -t /backups/db_backup_$(date +%Y%m%d)_020000.sql.gz && echo "OK"

# 3. Verify Redis backup exists
ls -la /backups/redis_backup_*.rdb | tail -7

# 4. Verify app data backup
ls -la /backups/app_data_*.tar.gz | tail -7
tar -tzf /backups/app_data_$(date +%Y%m%d)_020000.tar.gz | head -10

# 5. Check backup manifest
cat /backups/backup_manifest_$(date +%Y%m%d).json | python3 -m json.tool

# 6. Verify rclone remote has recent backups
rclone lsl drive:pixel-data/backups/ | tail -10
```

**Documentation:** Log results in
`.agent/internal/backup-verification/YYYY-Www.md`.

### 3.3 Monthly Verification (Automated + Manual Review)

**Owner:** SRE Lead **Cadence:** Monthly (1st, automated via
`verify-backups.sh`)

| Step | Script              | Verification                               |
| ---- | ------------------- | ------------------------------------------ |
| 1    | `verify-backups.sh` | Downloads latest DB + app data from rclone |
| 2    | `verify-backups.sh` | `gzip -t` on SQL backup                    |
| 3    | `verify-backups.sh` | `tar -tzf` on app data archive             |
| 4    | Manual              | Review `/var/log/backup-verification.log`  |
| 5    | Manual              | Compare backup sizes month-over-month      |
| 6    | Manual              | Verify rclone retention (prune >30 days)   |

**Review checklist:**

- [ ] Verification log shows all checks passed
- [ ] No "CORRUPT" or "FAILED" entries in log
- [ ] Backup sizes within ±20% of previous month
- [ ] rclone remote has backups from each day of past month
- [ ] No pruned backups younger than 30 days

---

## 4. Restore Testing Procedures

### 4.1 PostgreSQL Full Restore Test

**Objective:** Verify full database restore from backup and measure restore
time.

**Prerequisites:**

- Test PostgreSQL instance (separate from production)
- Latest backup available at `/backups/db_backup_YYYYMMDD_HHMMSS.sql.gz`
- `psql` client installed
- Test database name: `pixelated_restore_test`

**Procedure:**

```bash
# Step 1: Create test database
createdb pixelated_restore_test

# Step 2: Record start time
START_TIME=$(date +%s)

# Step 3: Restore from backup
gunzip -c /backups/db_backup_$(date +%Y%m%d)_020000.sql.gz | \
  psql -d pixelated_restore_test -v ON_ERROR_STOP=1

# Step 4: Record end time
END_TIME=$(date +%s)
RESTORE_DURATION=$((END_TIME - START_TIME))
echo "Restore duration: ${RESTORE_DURATION}s"

# Step 5: Verify row counts
psql -d pixelated_restore_test -c "
  SELECT schemaname, relname, n_live_tup
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC
  LIMIT 20;
"

# Step 6: Verify critical tables exist
psql -d pixelated_restore_test -c "\dt+"

# Step 7: Run integrity checks
psql -d pixelated_restore_test -c "SELECT count(*) FROM users;"
psql -d pixelated_restore_test -c "SELECT count(*) FROM sessions;"
psql -d pixelated_restore_test -c "SELECT count(*) FROM emotional_analyses;"

# Step 8: Clean up
dropdb pixelated_restore_test
```

**Pass criteria:**

| Check                   | Criteria                                  |
| ----------------------- | ----------------------------------------- |
| Restore completes       | No errors, `ON_ERROR_STOP=1` exits 0      |
| Restore time            | < RTO target (Tier 1: <1 hour)            |
| Table count             | ≥ production table count                  |
| Row counts              | ±1% of production (for static tables)     |
| Critical tables present | users, sessions, emotional_analyses exist |
| Data integrity          | No orphaned FKs (manual spot check)       |

**Documentation:** Record results in §8 drill template.

### 4.2 PostgreSQL Point-in-Time Recovery (PITR) Test

**Objective:** Verify PITR capability using WAL archives.

**Prerequisites:**

- WAL archives available at `/backups/postgres/wal/`
- Base backup available (from `pg_basebackup`)
- Test PostgreSQL instance with WAL archiving enabled
- AI submodule PostgreSQL with WAL config (see §2.4)

**Procedure:**

```bash
# Step 1: Identify recovery target timestamp (1 hour before now)
RECOVERY_TARGET=$(date -d '1 hour ago' '+%Y-%m-%d %H:%M:%S')
echo "Recovery target: $RECOVERY_TARGET"

# Step 2: Create recovery directory
RECOVERY_DIR="/tmp/pitr_test_$(date +%s)"
mkdir -p "$RECOVERY_DIR"

# Step 3: Copy base backup
cp -r /backups/postgres/base_latest/* "$RECOVERY_DIR/"

# Step 4: Create recovery.signal
touch "$RECOVERY_DIR/recovery.signal"

# Step 5: Configure recovery (postgresql.auto.conf)
cat > "$RECOVERY_DIR/postgresql.auto.conf" << EOF
restore_command = 'cp /backups/postgres/wal/%f %p'
recovery_target_time = '$RECOVERY_TARGET'
recovery_target_action = 'promote'
EOF

# Step 6: Start PostgreSQL in recovery mode
pg_ctl -D "$RECOVERY_DIR" start

# Step 7: Monitor recovery log
tail -f "$RECOVERY_DIR/log/postgresql.log" | grep -E "restore|recovery|consistent"

# Step 8: Verify recovery completed
psql -d postgres -c "SELECT pg_is_in_recovery();"  # Should return false

# Step 9: Verify data at recovery point
psql -d pixelated_empathy -c "SELECT count(*) FROM sessions WHERE created_at < '$RECOVERY_TARGET';"

# Step 10: Clean up
pg_ctl -D "$RECOVERY_DIR" stop
rm -rf "$RECOVERY_DIR"
```

**Pass criteria:**

| Check                   | Criteria                            |
| ----------------------- | ----------------------------------- |
| Recovery starts         | PostgreSQL enters recovery mode     |
| WAL replay              | WAL files replayed without errors   |
| Recovery target reached | Stops at specified timestamp        |
| Recovery promotes       | `pg_is_in_recovery()` returns false |
| Data consistent         | Tables queryable, no corruption     |
| Recovery time           | < 30 minutes for 1h of WAL          |

### 4.3 Redis Restore Test

**Objective:** Verify Redis backup restore from RDB snapshot.

**Procedure:**

```bash
# Step 1: Start test Redis instance
docker run -d --name redis-restore-test -p 6390:6379 redis:latest

# Step 2: Wait for Redis to start
sleep 3
redis-cli -p 6390 ping  # Should return PONG

# Step 3: Copy backup RDB
docker cp /backups/redis_backup_$(date +%Y%m%d)_020000.rdb \
  redis-restore-test:/data/dump.rdb

# Step 4: Restart Redis to load RDB
docker restart redis-restore-test
sleep 3

# Step 5: Verify data restored
redis-cli -p 6390 dbsize  # Should show key count > 0
redis-cli -p 6390 info keyspace

# Step 6: Spot check critical keys
redis-cli -p 6390 keys "session:*" | head -5
redis-cli -p 6390 keys "cache:*" | head -5

# Step 7: Clean up
docker stop redis-restore-test && docker rm redis-restore-test
```

**Pass criteria:**

| Check                 | Criteria                          |
| --------------------- | --------------------------------- |
| RDB loads             | Redis starts without errors       |
| Key count             | > 0, within ±10% of production    |
| Critical keys present | session:_, cache:_ patterns exist |
| Restore time          | < 5 minutes                       |

### 4.4 Foresight/Memory DB Restore Test

**Objective:** Verify SQLite memory database restore.

**Procedure:**

```bash
# Step 1: Identify latest backup
LATEST_BACKUP=$(ls -t /var/backups/pixelated-memory/*.gz | head -1)
echo "Latest backup: $LATEST_BACKUP"

# Step 2: Create test restore location
TEST_DB="/tmp/foresight_restore_test.db"
cp "$FORESIGHT_LOCAL_DB_PATH" "${TEST_DB}.pre-test.bak"

# Step 3: Run restore
./scripts/memory/restore-shared-memory-db.sh "$LATEST_BACKUP" \
  --dest "$TEST_DB" --force

# Step 4: Verify integrity
sqlite3 "$TEST_DB" "PRAGMA integrity_check;"  # Should return "ok"

# Step 5: Verify data
sqlite3 "$TEST_DB" "SELECT count(*) FROM memories;"
sqlite3 "$TEST_DB" "SELECT count(*) FROM conversations;"
sqlite3 "$TEST_DB" "SELECT * FROM memories ORDER BY created_at DESC LIMIT 5;"

# Step 6: Restore original
cp "${TEST_DB}.pre-test.bak" "$FORESIGHT_LOCAL_DB_PATH"
rm -f "$TEST_DB" "${TEST_DB}.pre-test.bak"
```

**Pass criteria:**

| Check           | Criteria                                                |
| --------------- | ------------------------------------------------------- |
| Integrity check | `PRAGMA integrity_check` returns "ok"                   |
| Table count     | Expected tables present (memories, conversations, etc.) |
| Row count       | > 0, within ±5% of production                           |
| Restore time    | < 2 minutes                                             |

---

## 5. Backup Retention Policies

### 5.1 Retention Matrix

| Datastore            | Backup Frequency | Local Retention | Remote Retention | Archive                                                 |
| -------------------- | ---------------- | --------------- | ---------------- | ------------------------------------------------------- |
| PostgreSQL (primary) | Daily 2 AM       | 30 days         | 30 days (rclone) | Monthly snapshot (first backup of month kept 12 months) |
| PostgreSQL (AI)      | Daily            | 30 days         | 30 days          | Monthly snapshot                                        |
| Redis                | Daily 2 AM       | 30 days         | 30 days          | None                                                    |
| Foresight/Memory     | Daily            | 14 days         | Not offsite      | None                                                    |
| App data             | Daily 2 AM       | 30 days         | 30 days (rclone) | None                                                    |
| Monitoring data      | Daily 2 AM       | 30 days         | 30 days          | None                                                    |
| MongoDB (Atlas)      | Atlas automated  | Atlas config    | Atlas config     | Atlas continuous backup                                 |

### 5.2 Retention Enforcement

**Local:** `backup-system.sh cleanup` prunes files older than 30 days.
**Remote:** `verify-backups.sh` prunes rclone remote older than 30 days.
**Foresight:** `backup-shared-memory-db.sh` prunes local files older than 14
days.

### 5.3 Gaps in Retention

| Gap                           | Impact                                           | Follow-up                               |
| ----------------------------- | ------------------------------------------------ | --------------------------------------- |
| Foresight backup only 14 days | Memory data loss if issue detected after 14 days | DR-2.2: Increase to 30 days             |
| No monthly archive snapshots  | Can't restore to a point >30 days ago            | DR-2.3: Implement monthly archive       |
| Foresight not offsite         | Complete loss if host fails                      | DR-2.4: Add rclone upload for Foresight |
| No MongoDB local backup       | Depends entirely on Atlas                        | DR-2.5: Document Atlas backup config    |

---

## 6. Backup Monitoring & Alerting

### 6.1 Planned Backup Metrics

Backup scripts do not currently expose metrics to Prometheus. The following
metrics should be exported via a textfile collector integration with
node-exporter.

**Follow-up action:** DR-2.1 — Implement backup metric export.

| Metric                                         | Type    | Labels        | Description                              |
| ---------------------------------------------- | ------- | ------------- | ---------------------------------------- |
| `backup_last_success_timestamp_seconds`        | Gauge   | `backup_type` | Unix timestamp of last successful backup |
| `backup_last_duration_seconds`                 | Gauge   | `backup_type` | Duration of last backup run              |
| `backup_size_bytes`                            | Gauge   | `backup_type` | Size of last backup in bytes             |
| `backup_status`                                | Gauge   | `backup_type` | 1=success, 0=failure                     |
| `backup_success_total`                         | Counter | `backup_type` | Total successful backups                 |
| `backup_failure_total`                         | Counter | `backup_type` | Total failed backups                     |
| `backup_verify_last_success_timestamp_seconds` | Gauge   | `backup_type` | Last successful verification             |

**Backup types:** `postgresql`, `postgresql-ai`, `redis`, `foresight-memory`,
`app-data`, `monitoring-data`, `mongodb-atlas`.

### 6.2 Backup Alert Rules

**Location:** `monitoring/backup-alerts.yml`

Alerts defined for:

| Alert                    | Severity | Condition                         | Description                         |
| ------------------------ | -------- | --------------------------------- | ----------------------------------- |
| BackupMissed             | warning  | No backup in 25h                  | Daily backup didn't run             |
| BackupFailed             | critical | `backup_status == 0`              | Last backup attempt failed          |
| BackupAgeCritical        | critical | No backup in 48h                  | Multiple consecutive missed backups |
| BackupSizeAnomaly        | warning  | Size dropped >50% vs previous day | Possible data loss or corruption    |
| BackupDurationHigh       | warning  | Backup took >1h                   | Backup performance degradation      |
| BackupVerificationFailed | warning  | Verification check failed         | Integrity check failed              |
| BackupForesightMissed    | warning  | Foresight backup >25h old         | Memory DB backup missed             |

### 6.3 Implementation Plan for Metrics Export

```bash
# 1. Create textfile collector directory
mkdir -p /var/lib/node_exporter/textfile

# 2. Add textfile collector to node-exporter
# In docker-compose.monitoring.yml, add to node-exporter command:
#   --collector.textfile.directory=/var/lib/node_exporter/textfile

# 3. Create backup metric exporter script
# scripts/backup/export-backup-metrics.sh
# Reads backup manifest, writes metrics to:
#   /var/lib/node_exporter/textfile/backup_metrics.prom

# 4. Add to cron after backup completes
# In backup-schedule.cron:
# 30 2 * * * /home/user/pixelated/scripts/backup/export-backup-metrics.sh
```

---

## 7. Quarterly Restore Drill

### 7.1 Drill Schedule

| Quarter      | Drill Type         | Target Datastore        | Focus                        |
| ------------ | ------------------ | ----------------------- | ---------------------------- |
| Q1 (Jan–Mar) | Full restore       | PostgreSQL primary      | Restore time measurement     |
| Q2 (Apr–Jun) | PITR               | PostgreSQL AI submodule | Point-in-time accuracy       |
| Q3 (Jul–Sep) | Complete system    | All datastores          | Full DR exercise             |
| Q4 (Oct–Dec) | Failover + restore | PostgreSQL + Redis      | Combined DR + infra failover |

### 7.2 Drill Prerequisites

- [ ] Test environment provisioned (separate from production)
- [ ] Backup files accessible (local + rclone remote)
- [ ] Test restore scripts ready
- [ ] Drill participants briefed (SRE, DevOps, on-call)
- [ ] Rollback plan documented
- [ ] Monitoring dashboards accessible for verification

### 7.3 Drill Procedure

1. **Announce** drill to team (Slack #ops, 24h notice for non-emergency drills)
2. **Snapshot** current production state for comparison
3. **Execute** restore per §4 procedure for the selected datastore
4. **Measure** restore duration (start-to-finish)
5. **Verify** data integrity (row counts, spot checks, critical queries)
6. **Document** results in §8 template
7. **Review** findings in next SRE meeting
8. **Update** RTO targets if measured time differs from documented targets

### 7.4 Drill Pass/Fail Criteria

| Criterion         | Pass                                | Fail                   |
| ----------------- | ----------------------------------- | ---------------------- |
| Restore completes | No errors                           | Script fails or errors |
| Restore time      | ≤ RTO target                        | > RTO target           |
| Data integrity    | All checks pass                     | Any check fails        |
| Critical data     | All critical tables present         | Missing critical table |
| App functionality | Test API endpoints return 200       | Endpoints return 500   |
| Monitoring        | Alerts fired correctly during drill | No alerts fired        |

---

## 8. Restore Drill Results Template

**Location:** `.agent/internal/backup-drills/YYYY-QQ-restore-drill.md`

```markdown
# Restore Drill Report — YYYY QN

## Drill Information

| Field         | Value                                            |
| ------------- | ------------------------------------------------ |
| Date          | YYYY-MM-DD                                       |
| Drill type    | Full restore / PITR / Complete system / Failover |
| Datastore     | PostgreSQL / Redis / Foresight / All             |
| Participants  | [names]                                          |
| Environment   | staging / test                                   |
| Backup source | [timestamp]                                      |

## Results

| Metric             | Target       | Actual    | Pass/Fail |
| ------------------ | ------------ | --------- | --------- |
| Restore duration   | < RTO target | [actual]s | [P/F]     |
| Table count        | ≥ prod       | [actual]  | [P/F]     |
| Row count variance | ±1%          | [actual]% | [P/F]     |
| Integrity check    | pass         | [result]  | [P/F]     |
| API health check   | 200          | [status]  | [P/F]     |

## Timeline

| Time | Action         | Duration    | Notes |
| ---- | -------------- | ----------- | ----- |
| T+0  | Start restore  | —           | —     |
| T+?  | Schema restore | [duration]s | —     |
| T+?  | Data restore   | [duration]s | —     |
| T+?  | Verification   | [duration]s | —     |
| T+?  | Complete       | [total]s    | —     |

## Findings

- [Finding 1]
- [Finding 2]

## Action Items

| ID     | Action        | Priority | Owner  | Due    |
| ------ | ------------- | -------- | ------ | ------ |
| DR-2.X | [description] | P0/P1/P2 | [name] | [date] |

## Decision

[ ] Drill PASSED — RTO/RPO targets met [ ] Drill PASSED with conditions —
[conditions] [ ] Drill FAILED — [reason], retest required
```

---

## 9. Roles & Responsibilities

| Role             | Responsibility                                               | Cadence           |
| ---------------- | ------------------------------------------------------------ | ----------------- |
| SRE / DevOps     | Run weekly verification, monitor backup alerts               | Daily/Weekly      |
| SRE Lead         | Review monthly verification log, approve quarterly drill     | Monthly/Quarterly |
| On-Call Engineer | Respond to backup failure alerts, initiate emergency restore | As needed         |
| Database Admin   | Execute restore tests, validate data integrity               | Quarterly         |
| VP Engineering   | Approve production restore (emergency only)                  | As needed         |
| Compliance Lead  | Review backup retention compliance (HIPAA)                   | Quarterly         |

---

## 10. Gap Analysis & Follow-Up Actions

| ID      | Action                                         | Priority | Description                                                                      |
| ------- | ---------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| DR-2.1  | Implement backup metric export                 | P0       | Add textfile collector for node-exporter, create metric exporter script          |
| DR-2.2  | Increase Foresight backup retention to 30 days | P1       | Change `MEMORY_BACKUP_RETENTION_DAYS` from 14 to 30                              |
| DR-2.3  | Implement monthly archive snapshots            | P1       | Keep first backup of month for 12 months                                         |
| DR-2.4  | Add Foresight offsite backup                   | P1       | Upload Foresight DB backup to rclone remote                                      |
| DR-2.5  | Document MongoDB Atlas backup config           | P1       | Capture Atlas automated backup settings, frequency, retention                    |
| DR-2.6  | Enable PITR for root PostgreSQL                | P1       | Configure WAL archiving for primary PostgreSQL (currently only in ai/ submodule) |
| DR-2.7  | Add Redis AOF persistence                      | P2       | Enable `appendonly yes` for better RPO than RDB-only snapshots                   |
| DR-2.8  | Automate restore testing in CI                 | P2       | Add GitHub Actions job to run restore test against ephemeral DB                  |
| DR-2.9  | Add backup size trend dashboard                | P2       | Grafana panel tracking backup size over time                                     |
| DR-2.10 | Create backup success webhook                  | P2       | Integrate backup-system.sh with monitoring system directly                       |

---

## 11. Glossary

| Term               | Definition                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------- |
| PITR               | Point-in-Time Recovery — restoring a database to a specific timestamp using WAL archives |
| WAL                | Write-Ahead Log — PostgreSQL transaction log used for PITR                               |
| RDB                | Redis Database — RDB file is a point-in-time snapshot of Redis data                      |
| AOF                | Append-Only File — Redis persistence mode that logs every write operation                |
| RPO                | Recovery Point Objective — maximum acceptable data loss measured in time                 |
| RTO                | Recovery Time Objective — maximum acceptable downtime for recovery                       |
| Textfile Collector | Node-exporter feature that reads metrics from text files for custom metrics              |
| Base Backup        | Full PostgreSQL backup used as starting point for PITR                                   |
| `pg_basebackup`    | PostgreSQL command to create a base backup for PITR                                      |
| `pg_dump`          | PostgreSQL command to create logical database dumps                                      |
| `pg_restore`       | PostgreSQL command to restore from `pg_dump` custom format archives                      |
| Backup Manifest    | JSON file listing all backup artifacts, timestamps, and metadata                         |
| Backup Drill       | Planned exercise to test backup restore procedures and measure RTO                       |

---

## 12. References

### Internal Documentation

- [DR — RTO & RPO Targets](./dr-rto-rpo-targets.md) — Service tier definitions
- [Infra Disaster Recovery](./infra-disaster-recovery.md) — Infrastructure DR
  procedures
- [SLA Breach Response](./sla-breach-response.md) — Incident response
- [SLO Definitions](./slo-definitions.md) — Service-level objectives
- [Resilience Testing](./resilience-testing.md) — Chaos engineering scenarios
- [Vendor Inventory](../vendor-inventory.md) — Third-party dependencies

### Backup Scripts

- `scripts/backup/backup-system.sh` — Full system backup
- `scripts/backup/backup-schedule.cron` — Cron schedule
- `scripts/backup/verify-backups.sh` — Monthly verification
- `scripts/backup/rclone-nightly-backup.sh` — Offsite codebase backup
- `scripts/backup/disaster-recovery.sh` — S3-based DR
- `docker/postgres/backup/backup.sh` — PostgreSQL dedicated backup
- `docker/postgres/backup/restore.sh` — PostgreSQL restore
- `ai/docker/postgres/backup/archive_wal.sh` — WAL archiving
- `scripts/memory/backup-shared-memory-db.sh` — Foresight backup
- `scripts/memory/restore-shared-memory-db.sh` — Foresight restore

### Monitoring Configuration

- `monitoring/prometheus.yml` — Prometheus scrape + rule config
- `monitoring/backup-alerts.yml` — Backup alert rules
- `monitoring/alertmanager.yml` — Alert routing

### External Resources

- [PostgreSQL Backup and Recovery](https://www.postgresql.org/docs/current/backup.html)
- [PostgreSQL PITR Documentation](https://www.postgresql.org/docs/current/continuous-archiving.html)
- [Redis Persistence](https://redis.io/docs/management/persistence/)
- [Prometheus Textfile Collector](https://github.com/prometheus/node_exporter#textfile-collector)
- [Google SRE Workbook — Backup](https://sre.google/workbook/postmortem/)

### Issue Tracking

- Linear:
  [PIX-4133](https://linear.app/pixelated/issue/PIX-4133/dr-2-database-backup-restore-testing)
- Parent: [PIX-4125](https://linear.app/pixelated/issue/PIX-4125) — DR epic
- GitHub: [#5068](https://github.com/daggerstuff/pixelated/issues/5068)
