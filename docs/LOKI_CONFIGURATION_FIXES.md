# Loki Configuration Fixes

This document describes the configuration fixes made to resolve the "Loki needs config tweak" issue mentioned in the migration checklist.

## Issues Identified and Fixed

### 1. Loki Configuration (`docker/loki/config.yml`)

**Issue:** `instance_addr` was set to `127.0.0.1` which prevents external connections
**Fix:** Changed to `0.0.0.0` to allow container networking

**Issue:** AlertManager URL pointed to incorrect service name
**Fix:** Changed from `http://prometheus:9093` to `http://alertmanager:9093`

### 2. Promtail Configuration (`docker/promtail/config.yml`)

**Enhancements Made:**
- Added host labels for better log identification
- Added stream labels for log filtering
- Added docker service discovery configuration to automatically discover and collect logs from all running containers
- Improved JSON parsing pipeline

### 3. Grafana Loki Datasource (`docker/grafana/provisioning/datasources/loki.yml`)

**Enhancements Made:**
- Added timeout configuration (60 seconds)
- Added tenant header support for multi-tenancy
- Explicitly set `isDefault: false` to avoid conflicts

## Verification

Run the verification script to confirm all configurations are correct:
```bash
./scripts/verify-monitoring.sh
```

## Starting the Monitoring Stack

To start the monitoring services:
```bash
./scripts/start-monitoring.sh
```

## Key Configuration Changes Summary

| Component | File | Change Made | Purpose |
|-----------|------|-------------|---------|
| Loki | `docker/loki/config.yml` | `instance_addr: 0.0.0.0` | Enable container networking |
| Loki | `docker/loki/config.yml` | `alertmanager_url: http://alertmanager:9093` | Correct service reference |
| Promtail | `docker/promtail/config.yml` | Added docker service discovery | Automatic container log collection |
| Promtail | `docker/promtail/config.yml` | Added host/stream labels | Better log organization |
| Grafana | `docker/grafana/provisioning/datasources/loki.yml` | Added timeout/tenant config | Improved reliability |

## Access Points

Once running, the monitoring services will be available at:
- **Grafana:** http://localhost:3001
- **Prometheus:** http://localhost:9090
- **Loki:** http://localhost:3100
- **AlertManager:** http://localhost:9093

## Checklist Status

✅ **FIXED:** The Loki configuration has been corrected and enhanced
✅ **VERIFIED:** Configuration files are properly set up
✅ **DOCUMENTED:** Changes are recorded in this document