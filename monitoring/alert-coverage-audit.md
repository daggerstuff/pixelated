# Alert Coverage Audit — PIX-4100

> Audit of all alert rules to verify every critical service path has at least
> one alert. Performed 2026-07-23.

## Critical Service Paths

| # | Service Path | Alert(s) | Coverage |
|---|-------------|----------|----------|
| 1 | Main app (Astro SSR) | `ApplicationDown`, `HighErrorRate`, `HighResponseTime` | ✅ Full |
| 2 | AI service (FastAPI) | `AIServiceDown`, `AIServiceHighLatency`, `AIInferenceLatencyHigh`, `EmotionalAnalysisError` | ✅ Full |
| 3 | PostgreSQL database | `DatabaseDown`, `DatabaseHighConnections`, `DatabaseSlowQueries`, `DatabaseConnectionsHigh`, `DatabaseConnectionPoolExhausted` | ✅ Full |
| 4 | Redis cache | `RedisDown`, `RedisHighMemoryUsage` | ✅ Full |
| 5 | System (CPU/Memory/Disk) | `CPUUsageHigh`, `HighMemoryUsage`, `DiskSpaceLow`, `DiskSpaceCritical`, `MemoryUsageCritical` | ✅ Full |
| 6 | Network | `HighNetworkTraffic` | ✅ Covered |
| 7 | Containers | `ContainerHighMemoryUsage`, `ContainerHighCPUUsage` | ✅ Full |
| 8 | Crisis detection | `HighCrisisDetectionRate`, `CrisisEscalationFailure` | ✅ Full |
| 9 | Safety gates | `PixelSafetyGateViolationsHigh`, `PixelInvalidationsSpike`, `PixelPIIAlerts` | ✅ Full |
| 10 | User engagement | `ZeroActiveUsers`, `UserRegistrationFailure` | ✅ Full |
| 11 | Launch metrics | `LowSessionCompletionRate`, `LowUserSatisfaction`, `HighSystemDowntime` | ✅ Full |
| 12 | Monitoring system | `MonitoringSystemDown` | ✅ Full |
| 13 | Backup system | `BackupSystemFailure` | ✅ Full |
| 14 | Performance (pixel) | `PixelLatencyHighP95`, `PixelErrorRateHigh` | ✅ Full |

## Alert Rule Review

### Threshold Accuracy

| Alert | Current Threshold | Assessment |
|-------|------------------|------------|
| `HighErrorRate` (alert_rules.yml) | `> 0.1 errors/s for 5m` | ⚠️ Threshold is absolute, not percentage. Consider: `rate(5xx[5m]) / rate(all[5m]) > 0.01` |
| `HighErrorRate` (application.yml) | `> 0.1 errors/s for 2m` | ⚠️ Same — absolute rate, not ratio |
| `HighResponseTime` (alert_rules.yml) | `p95 > 0.5s for 5m` | ✅ Appropriate for API endpoints |
| `HighResponseTime` (application.yml) | `p95 > 2s for 5m` | ✅ Appropriate for full page load |
| `DatabaseConnectionsHigh` | `> 80 connections for 5m` | ⚠️ Absolute number — depends on max_connections. Use ratio: `pg_stat_activity_count / pg_settings_max_connections > 0.8` |
| `DatabaseHighConnections` (application.yml) | `> 80% of max for 5m` | ✅ Uses ratio — this is the correct approach |
| `DiskSpaceLow` | `< 10% free for 5m` | ✅ Standard |
| `DiskSpaceCritical` | `< 5% free for 1m` | ✅ Standard |
| `CPUUsageHigh` | `> 80% for 5m` | ✅ Standard |
| `HighMemoryUsage` | `> 85% for 5m` | ✅ Standard |
| `EmotionalAnalysisError` | `> 0.05 errors/s for 5m` | ✅ Appropriate for clinical AI |
| `AIInferenceLatencyHigh` | `avg > 2s for 5m` | ✅ Appropriate |
| `CrisisEscalationFailure` | `> 0 for 5m` | ✅ Zero-tolerance for safety |
| `HighCrisisDetectionRate` | `> 5/hour for 30m` | ⚠️ May need tuning based on user volume |
| `MemoryUsageCritical` (launch) | `> 4GB for 10m` | ⚠️ Absolute — depends on container memory limit |

### Noise Reduction

- **Inhibition rules added** in `alertmanager.yml`:
  - Critical suppresses warning for same service + alertname
  - `DiskSpaceCritical` suppresses `DiskSpaceLow` for same instance + mountpoint
  - `EmergencyMemoryUsage` suppresses `HighCPUUsage` for same instance
- **Grouping**: Alerts grouped by `alertname`, `service`, `severity`
- **Repeat intervals**: Critical 30min, Warning 2h, Emergency 15min
- **Duplicate alerts**: `HighErrorRate` and `HighResponseTime` exist in both
  `alert_rules.yml` and `application.yml` with different thresholds. The
  `application.yml` versions have `service` labels and better annotations —
  consider deprecating the `alert_rules.yml` versions in a future cleanup.

### Actionable Routing

| Severity | Receiver | Channel | Repeat Interval |
|----------|----------|---------|-----------------|
| critical | `critical-notifications` | PagerDuty + Email | 30m |
| warning | `warning-notifications` | Slack + Email | 2h |
| emergency | `emergency-notifications` | PagerDuty + Slack (#alerts-critical) | 15m |
| default | `default` | Email | 1h |

## Gaps Identified

1. **No alert for API key rate limiting** — When rate limiting is implemented
   (PIX-4095), add alert for `rate_limit_triggered_total > threshold`
2. **No alert for consent expiry** — When consent expiry service runs in
   production, add alert for `consent_expired_total > 0`
3. **No alert for ZK proof verification failure** — Add alert when ZK proof
   service is production-deployed
4. **No alert for bias audit threshold exceeded** — Alert when bias audit
   report has `alertLevel >= high`

## Recommendations

1. Consolidate duplicate alerts between `alert_rules.yml` and
   `application.yml` — prefer `application.yml` versions (have `service` labels)
2. Convert absolute thresholds to ratios where possible (error rate, DB connections)
3. Add runbook URLs to all alerts (some have, most don't)
4. Add `for` duration tuning guidelines per service criticality
