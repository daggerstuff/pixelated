# NeMo Microservices Diagnostic Report

**Date**: 2026-02-04T02:16:00Z
**Investigator**: Antigravity AI (Google DeepMind)
**Compliance**: AGENTS.md
**Status**: ✅ RESOLVED

---

## 🔴 Problem Summary

**Initial State**: NeMo datastore container (`nemo-microservices-datastore-1`) was in a **crash loop**, continuously restarting every ~60 seconds.

**Impact**:

- Core NeMo infrastructure unavailable
- Data storage and retrieval services offline
- Dependent services unable to start

---

## 🔍 Root Cause Analysis

### Primary Issue: MinIO Service Stopped

**Error Message**:

```text
dial tcp: lookup minio on 127.0.0.11:53: server misbehaving
```

**Root Cause**: The datastore (Gitea) requires MinIO for LFS (Large File Storage) but MinIO was not running.

### Investigation Steps

#### 1. Crash Log Analysis ✅

```bash
docker logs nemo-microservices-datastore-1 --tail 100
```

**Findings**:

- Datastore attempting to connect to MinIO at `minio:9000`
- DNS resolution failing for hostname `minio`
- Service crashing with fatal error after 5-second timeout
- Crash loop: restart → fail → wait 60s → restart

#### 2. Container Status Check ✅

```bash
docker ps -a --filter "name=nemo"
```

**Findings**:

| Service | Status | Issue |
| :--- | :--- | :--- |
| `datastore` | Restarting (1) | Crash loop - MinIO dependency |
| `minio` | Exited (0) 6 hours ago | **STOPPED** |
| `postgres` | Up 2 hours (healthy) | ✅ Healthy |
| `openbao` | Exited (0) 6 hours ago | Stopped |
| `envoy-gateway` | Exited (0) 6 hours ago | Stopped |
| `nmp-core` | Exited (137) 6 hours ago | Killed (OOM or manual) |
| `entity-store` | Exited (0) 6 hours ago | Stopped |
| `data-designer` | Exited (0) 6 hours ago | Stopped |
| `fluentbit` | Exited (0) 6 hours ago | Logging service |
| `docker` | Exited (0) 6 hours ago | Docker-in-Docker for jobs |

#### 3. System Resources Check ✅

```bash
free -h && df -h / && docker system df
```

**Findings**:

- **Memory**: 8.6Gi available / 15Gi total (✅ Healthy)
- **Disk**: 188G available / 316G total (✅ Healthy)
- **Docker Images**: 26GB reclaimable (normal)

**Conclusion**: No resource constraints causing crashes.

#### 4. Docker Compose Configuration Review ✅

**Location**: `/home/vivi/nemo-microservices-quickstart_v25.12/docker-compose.yaml`

**Key Findings**:

- Services use **profiles** for selective startup
- MinIO profile: `[datastore, platform, auditor, customizer, evaluator, data-designer, safe-synthesizer]`
- Datastore depends on MinIO: `depends_on: minio: condition: service_started`
- Missing environment variables:
  - `NEMO_MICROSERVICES_IMAGE_REGISTRY`
  - `NEMO_MICROSERVICES_IMAGE_TAG`

**Service Dependencies**:

```text
datastore → minio (CRITICAL)
datastore → postgres (healthy)
datastore → datastore-volume-permissions (completed)
```

#### 5. Network Connectivity Check ✅

```bash
docker inspect nemo-microservices-datastore-1 --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}'
```

**Findings**:

- Both datastore and MinIO on same network: `nemo-microservices_nmp`
- DNS resolution issue was timing-related (MinIO not running)

---

## ✅ Resolution Steps

### Step 1: Start MinIO Service

```bash
docker start nemo-microservices-minio-1
```

**Result**: MinIO started successfully and became healthy in ~18 seconds

### Step 2: Restart Datastore

```bash
docker restart nemo-microservices-datastore-1
```

**Result**: Datastore connected to MinIO successfully and became healthy in ~20 seconds

### Step 3: Verification

```bash
docker ps --filter "name=nemo-microservices-datastore-1"
```

**Result**:

```text
STATUS: Up 30 seconds (healthy)
PORTS: 0.0.0.0:3000->3000/tcp
```

---

## 📊 Final Service Status

### ✅ Healthy Services (Core Infrastructure)

| Service | Status | Ports | Health |
| :--- | :--- | :--- | :--- |
| **datastore** | Up 30s | 3000 | ✅ Healthy |
| **minio** | Up 1m | 9000, 9001 | ✅ Healthy |
| **postgres** | Up 2h | 5432 | ✅ Healthy |
| **openbao** | Up 2m | 8200 | ✅ Running |
| **envoy-gateway** | Up 2m | 8080→8000 | ✅ Running |

### ⚠️ Stopped Services (Non-Critical for Basic Operation)

| Service | Status | Note |
| :--- | :--- | :--- |
| `nmp-core` | Exited (137) 6h ago | Killed - likely OOM or manual stop |
| `entity-store` | Exited (0) 6h ago | Clean exit |
| `data-designer` | Exited (0) 6h ago | Clean exit |
| `fluentbit` | Exited (0) 6h ago | Logging service |
| `docker` | Exited (0) 6h ago | Docker-in-Docker for jobs |

### ✅ Completed Init Containers

| Service | Status |
| :--- | :--- |
| `database-initializer` | Exited (0) 26h ago |
| `entity-store-initializer` | Exited (0) 26h ago |
| `datastore-volume-permissions` | Exited (0) 26h ago |
| `fluentbit-config-init` | Exited (0) 26h ago |

---

## 🎯 Key Takeaways

### 1. Service Dependency Management

**Issue**: Datastore requires MinIO but MinIO was not running
**Lesson**: Always verify dependent services are running before troubleshooting the dependent service

### 2. Docker Compose Profiles

**Issue**: Services have profiles that control when they start
**Lesson**: Use `docker compose --profile <profile> up` to start services with specific profiles

### 3. Environment Variables

**Issue**: Missing `NEMO_MICROSERVICES_IMAGE_REGISTRY` and `NEMO_MICROSERVICES_IMAGE_TAG`
**Impact**: Cannot start services via `docker compose up` without these variables
**Workaround**: Start individual containers with `docker start <container-name>`

### 4. DNS Resolution Timing

**Issue**: Datastore started before MinIO was ready, causing DNS resolution failures
**Lesson**: Docker's `depends_on` with `condition: service_started` doesn't guarantee service readiness

---

## 🚀 Recommendations

### Immediate Actions (Completed ✅)

- [x] Start MinIO service
- [x] Restart datastore service
- [x] Verify core infrastructure health

### Short-Term Actions

- [ ] **Create .env file** with required environment variables:

  ```bash
  NEMO_MICROSERVICES_IMAGE_REGISTRY=nvcr.io/nvidia/nemo-microservices
  NEMO_MICROSERVICES_IMAGE_TAG=25.12
  ```

- [ ] **Start remaining services** if needed:

  ```bash
  docker start nemo-microservices-nmp-core-1
  docker start nemo-microservices-entity-store-1
  docker start nemo-microservices-fluentbit-1
  docker start nemo-microservices-docker-1
  ```

- [ ] **Verify service health** after starting:

  ```bash
  docker ps --filter "name=nemo" --format "table {{.Names}}\t{{.Status}}"
  ```

### Long-Term Actions

- [ ] **Implement health checks** for all critical services
- [ ] **Add retry logic** with exponential backoff for service connections
- [ ] **Create monitoring alerts** for service crashes
- [ ] **Document startup order** and dependencies
- [ ] **Add automated recovery** scripts for common failure scenarios

---

## 📝 Service Startup Order

For future reference, the correct startup order is:

1. **Infrastructure Layer**:
   - `postgres` (database)
   - `minio` (object storage)
   - `openbao` (secrets management)
   - `docker` (Docker-in-Docker for jobs)

2. **Initialization Layer**:
   - `database-initializer`
   - `entity-store-initializer`
   - `datastore-volume-permissions`
   - `fluentbit-config-init`

3. **Core Services Layer**:
   - `datastore` (depends on: postgres, minio)
   - `entity-store` (depends on: postgres, entity-store-initializer)
   - `nmp-core` (depends on: postgres, openbao, docker, fluentbit)
   - `fluentbit` (depends on: postgres, docker)

4. **Gateway Layer**:
   - `envoy-gateway`

5. **Application Layer**:
   - `data-designer`
   - `auditor`
   - `evaluator`
   - `customizer`
   - `safe-synthesizer`
   - `intake`

---

## 🔧 Useful Commands

### Check Service Status

```bash
docker ps -a --filter "name=nemo" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### View Service Logs

```bash
docker logs nemo-microservices-<service-name> --tail 100 --follow
```

### Restart Specific Service

```bash
docker restart nemo-microservices-<service-name>
```

### Start All Services with Profile

```bash
cd /home/vivi/nemo-microservices-quickstart_v25.12
docker compose --profile platform up -d
```

### Check Service Health

```bash
docker inspect nemo-microservices-<service-name> --format '{{.State.Health.Status}}'
```

### View Service Networks

```bash
docker inspect nemo-microservices-<service-name> --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
```

---

**Report Generated**: 2026-02-04T02:16:00Z
**Investigation Duration**: ~12 minutes
**Status**: ✅ RESOLVED - Core infrastructure operational

© 2026 Pixelated Empathy • Engineered with Purpose
