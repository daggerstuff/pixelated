---
title: Resilience Testing & Chaos Engineering
description:
  Chaos engineering scenarios, experiment manifests, test schedule, and safety
  guardrails for validating platform fault tolerance in staging
---

<!-- markdownlint-disable MD025 MD013 MD036 -->

<div align="center">

# Resilience Testing & Chaos Engineering

**Fault Injection Experiments for Platform Hardening**

Chaos Mesh · Network Chaos · Pod Failure · Resource Exhaustion · HTTP Chaos

</div>

---

## 1. Purpose & Scope

This runbook defines chaos engineering practices and resilience testing
scenarios for the Pixelated Empathy platform. It covers Chaos Mesh experiment
definitions, execution schedule, safety guardrails, result documentation, and
CI/CD integration.

**Scope**: Staging environment experiments targeting Kubernetes workloads in the
`pixelated-empathy` namespace. Production experiments require explicit approval
(see §6.5).

**Related runbooks**:

- [SLO Definitions](./slo-definitions.md) — SLO targets these experiments
  validate
- [SLO Burn Rate Alerts](../../monitoring/slo-burn-rate-alerts.yml) — alerts
  expected to fire during experiments
- [SLA Breach Response](./sla-breach-response.md) — response procedure if
  experiment breaches SLA
- [Infrastructure Disaster Recovery](./infra-disaster-recovery.md) — DR
  procedures validated by chaos experiments

**Parent epic**: [PIX-4128](https://linear.app/pixelated/issue/PIX-4128) — Chaos
Engineering & Resilience Testing

---

## 2. Chaos Mesh Installation

### 2.1 Prerequisites

- Kubernetes cluster (Civo K3s `pixelated-cluster` for staging)
- `kubectl` configured with cluster access
- Helm 3.x installed
- Cluster-admin privileges for installation

### 2.2 Install Chaos Mesh via Helm

```bash
# Add Chaos Mesh Helm repository
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm repo update

# Create chaos-engineering namespace
kubectl create namespace chaos-engineering

# Install Chaos Mesh (staging cluster only)
helm install chaos-mesh chaos-mesh/chaos-mesh \
  --namespace chaos-engineering \
  --set chaosDaemon.runtime=containerd \
  --set dashboard.securityMode=false \
  --set controllerManager.replicas=2 \
  --version 2.7.0
```

### 2.3 Verify Installation

```bash
# Check Chaos Mesh components
kubectl get pods -n chaos-engineering

# Expected output:
# chaos-controller-manager-xxx   1/1 Running
# chaos-daemon-xxx                1/1 Running
# chaos-dashboard-xxx             1/1 Running

# Verify CRDs are registered
kubectl get crd | grep chaos-mesh.org

# Expected CRDs:
# podchaos.chaos-mesh.org
# networkchaos.chaos-mesh.org
# httpchaos.chaos-mesh.org
# stresschaos.chaos-mesh.org
# iochaos.chaos-mesh.org
# timechaos.chaos-mesh.org
```

### 2.4 Enable Chaos Dashboard (Optional)

```bash
# Port-forward dashboard for local access
kubectl port-forward -n chaos-engineering svc/chaos-dashboard 2333:2333

# Access at http://localhost:2333
```

### 2.5 Label Namespace for Chaos

```bash
# Enable chaos injection on target namespace
kubectl label namespace pixelated-empathy chaos-mesh.org/inject=enabled
```

---

## 3. Experiment Scenarios

All experiment manifests are located at `k8s/chaos/` and bundled via
`k8s/chaos/kustomization.yaml`.

**Registered experiments**: `pod-kill`, `network-latency`, `network-partition`, `http-chaos`, `postgres`, `foresight-mcp`

### 3.1 Pod Failure Scenario

**Objective**: Validate Kubernetes self-healing, HPA scale-up, probe behavior,
and zero-downtime recovery when API pods are killed.

| Parameter       | Value                                                   |
| --------------- | ------------------------------------------------------- |
| Experiment file | `k8s/chaos/pod-kill-experiment.yaml`                    |
| CRD             | `PodChaos`                                              |
| Action          | `pod-kill` (random kill) + `pod-failure` (50% NotReady) |
| Target          | `app: pixelated-empathy-api` pods                       |
| Frequency       | Every 5 min (pod-kill) / 10 min (pod-failure)           |
| Duration        | 30s / 2m                                                |

**Expected outcomes**:

- Kubernetes restarts killed pods automatically
- HPA scales up if CPU/memory pressure detected
- Zero request failures if min replicas ≥ 2
- `ApplicationDown` alert does NOT fire (restarts complete before 5m threshold)
- `/health` probe recovers within 60s of pod restart

**Validation steps**:

1. Deploy experiments: `kubectl apply -k k8s/chaos/pod-kill-experiment.yaml`
2. Monitor pod status: `kubectl get pods -n pixelated-empathy -w`
3. Check Prometheus: `up{job="pixelated-app"}` remains 1
4. Verify no 5xx errors:
   `rate(http_requests_total{job="pixelated-app",status=~"5.."}[5m])`
5. Record results in §7 template

### 3.2 Network Latency Scenario

**Objective**: Validate latency SLO compliance (p95 ≤ 500ms) under degraded
network conditions and client-side timeout handling.

| Parameter       | Value                                                    |
| --------------- | -------------------------------------------------------- |
| Experiment file | `k8s/chaos/network-latency-experiment.yaml`              |
| CRD             | `NetworkChaos`                                           |
| Action          | `delay` (200ms + 10ms jitter) + `loss` (10% packet loss) |
| Target          | API → Redis egress traffic                               |
| Frequency       | Every 15m (delay) / 20m (loss)                           |
| Duration        | 5m / 3m                                                  |

**Expected outcomes**:

- p95 latency increases but stays within client timeout (30s)
- `HighResponseTime` alert fires if p95 > 500ms for 5m (matching SLO threshold)
- SLO latency burn rate alert fires at slow tier (3x over 3d+6h)
- Cache fallback logic engages (if implemented)
- No data corruption — Redis operations retry successfully

**Validation steps**:

1. Deploy: `kubectl apply -f k8s/chaos/network-latency-experiment.yaml`
2. Monitor Grafana latency dashboard: p95 response time panel
3. Check Redis connection pool metrics
4. Verify retry logic (no silent data loss)
5. Confirm alert fires and auto-resolves after experiment

### 3.3 Network Partition Scenario

**Objective**: Simulate complete network outage / DNS failure between services.
Validates circuit breaker activation, fallback behavior, and `RedisDown` /
`ApplicationDown` alert triggering.

| Parameter       | Value                                         |
| --------------- | --------------------------------------------- |
| Experiment file | `k8s/chaos/network-partition-experiment.yaml` |
| CRD             | `NetworkChaos`                                |
| Action          | `partition` (complete isolation)              |
| Target          | API ↔ Redis, API ↔ AI service                 |
| Frequency       | Every 30m                                     |
| Duration        | 1m (destructive — keep short)                 |

**Expected outcomes**:

- Circuit breaker opens after N failed attempts
- Fallback to cached responses (if cache layer exists)
- `RedisDown` alert fires within 5m (matching alert_rules.yml threshold)
- `ApplicationDown` fires if `/health` depends on Redis
- SLO availability burn rate alert fires at fast tier (14.4x over 1h+5m)
- No data loss — Redis reconnects and syncs after partition heals

**Validation steps**:

1. Deploy: `kubectl apply -f k8s/chaos/network-partition-experiment.yaml`
2. Monitor Prometheus: `up{job="redis-exporter"}` drops to 0
3. Check Alertmanager: `RedisDown` alert fires
4. Verify circuit breaker state (if instrumented)
5. Confirm auto-recovery after partition heals (1m)
6. Validate no data corruption post-recovery

### 3.4 API Backend Failure Scenario

**Objective**: Simulate API backend failures via HTTP request aborts and
response delays. Tests liveness probe failure, 5xx error rate alerting, and SLO
burn rate alerts.

| Parameter       | Value                                               |
| --------------- | --------------------------------------------------- |
| Experiment file | `k8s/chaos/http-chaos-experiment.yaml`              |
| CRD             | `HTTPChaos`                                         |
| Action          | `abort` (connection reset) + `delay` (3s on /api/*) |
| Target          | API pod port 5001                                   |
| Frequency       | Every 10m (abort) / 15m (delay)                     |
| Duration        | 2m / 3m                                             |

**Expected outcomes**:

- Liveness probe fails → pod restart initiated
- 5xx error rate exceeds 0.1% threshold → `HighErrorRate` alert fires
- SLO request error burn rate alert fires at fast tier (14.4x)
- SLO error budget consumption accelerates
- Client retry logic engages (if implemented)
- After experiment ends: error rate returns to 0, alerts auto-resolve

**Validation steps**:

1. Deploy: `kubectl apply -f k8s/chaos/http-chaos-experiment.yaml`
2. Monitor: `rate(http_requests_total{status=~"5.."}[5m])`
3. Check `HighErrorRate` alert in Alertmanager
4. Verify SLO burn rate dashboard shows budget consumption
5. Confirm auto-recovery after experiment ends

### 3.5 Resource Exhaustion Scenario

**Objective**: Simulate CPU and memory pressure to validate HPA scaling, OOM
handling, and resource alerts.

| Parameter       | Value                                                        |
| --------------- | ------------------------------------------------------------ |
| Experiment file | `k8s/chaos/http-chaos-experiment.yaml` (StressChaos section) |
| CRD             | `StressChaos`                                                |
| Action          | CPU burn (90% load, 2 workers) + Memory burn (150MB)         |
| Target          | API pods                                                     |
| Frequency       | Every 20m                                                    |
| Duration        | 2m                                                           |

**Expected outcomes**:

- CPU usage exceeds 80% → `CPUUsageHigh` alert fires
- Memory approaches 192Mi limit → `MemoryUsageHigh` (>90%) fires
- HPA scales up (if maxReplicas > 1)
- OOM kill occurs if memory exceeds limit (pod restarts)
- No cascading failures — other services remain healthy

**Validation steps**:

1. Deploy: `kubectl apply -f k8s/chaos/http-chaos-experiment.yaml`
2. Monitor: `node_cpu_seconds_total` and `container_memory_usage_bytes`
3. Check HPA status: `kubectl get hpa -n pixelated-empathy`
4. Verify alert fires and auto-resolves
5. Confirm no cascading pod failures

---

## 4. Test Schedule & Cadence

### 4.1 Weekly Staging Experiments

| Day       | Scenario            | Experiment                                 | Window          | Owner            |
| --------- | ------------------- | ------------------------------------------ | --------------- | ---------------- |
| Monday    | Pod failure         | `pod-kill-experiment.yaml`                 | 10:00-10:30 UTC | On-call engineer |
| Tuesday   | Network latency     | `network-latency-experiment.yaml`          | 10:00-10:15 UTC | On-call engineer |
| Wednesday | Network partition   | `network-partition-experiment.yaml`        | 10:00-10:05 UTC | On-call engineer |
| Thursday  | API backend failure | `http-chaos-experiment.yaml`               | 10:00-10:10 UTC | On-call engineer |
| Friday    | Resource exhaustion | `http-chaos-experiment.yaml` (StressChaos) | 10:00-10:05 UTC | On-call engineer |

### 4.2 Monthly Game Day

First Friday of each month, 14:00-17:00 UTC:

1. **Combined scenario**: Run all 4 experiment categories simultaneously for 30
   min
2. **Failover test**: Trigger blue-green slot switch during chaos
3. **DR drill**: Execute one scenario from
   [DR runbook](./infra-disaster-recovery.md) §8
4. **Postmortem**: Review results, update experiments, adjust SLO thresholds

### 4.3 Quarterly Review

Each quarter:

- Review all experiment results from §7 logs
- Update experiment parameters based on findings
- Add new scenarios for newly discovered failure modes
- Re-evaluate SLO thresholds (per [SLO runbook](./slo-definitions.md) §7
  governance)
- Validate Chaos Mesh version and upgrade if needed

---

## 5. Safety Guardrails

### 5.1 Blast Radius Controls

| Control           | Configuration                | Rationale                             |
| ----------------- | ---------------------------- | ------------------------------------- |
| Namespace scope   | `pixelated-empathy` only     | Prevent cross-namespace impact        |
| Label selectors   | `app: pixelated-empathy-api` | Target only API pods                  |
| Duration limits   | Max 5m per experiment        | Avoid sustained damage                |
| Cron frequency    | Min 5m between runs          | Allow recovery time                   |
| Mode              | `one` or `fixed-percent: 50` | Limit pod impact                      |
| Network partition | Max 1m                       | Full partition is destructive         |
| Stress chaos      | CPU 90%, Memory 150MB        | Below OOM threshold for graceful test |

### 5.2 Abort Conditions

**STOP immediately if any of the following occur**:

1. **Data corruption detected** — Redis/postgres checksums fail
2. **Alert fires in production** — Even if staging experiment, check for
   cross-cluster contamination
3. **HPA maxed out** — All replicas exhausted, cannot scale further
4. **Pod restart loop** — CrashLoopBackOff persists > 5m
5. **Dashboard shows cascading failures** — Other services affected unexpectedly
6. **On-call engineer unavailable** — All experiments require monitoring

### 5.3 Rollback Procedure

```bash
# Pause all chaos experiments
kubectl annotate chaosengine -n pixelated-empathy \
  experiment.chaos-mesh.org/pause=true --all

# Or delete specific experiment
kubectl delete -f k8s/chaos/<experiment-file>.yaml

# Force-delete all chaos resources (emergency)
kubectl delete podchaos,networkchaos,httpchaos,stresschaos \
  -n pixelated-empathy --all --grace-period=0 --force

# Verify all chaos controllers are paused
kubectl get chaosengine -n pixelated-empathy
```

### 5.4 Production Experiments

Production chaos experiments are **prohibited** until:

1. Staging experiments run successfully for 4 consecutive weeks
2. All false-positive alerts are tuned out
3. SLO error budget has > 50% remaining
4. Explicit VP Engineering approval (ticket required)
5. Maintenance window scheduled (72h notice per SLA terms)
6. On-call engineer + backup available
7. Rollback procedure tested and documented

---

## 6. CI/CD Integration

### 6.1 GitHub Actions Integration

Chaos experiments are integrated into CI as a post-deploy validation step
(see `.github/workflows/chaos-validation.yml`):

- **Trigger**: Manual dispatch + weekly cron (Monday 10:00 UTC)
- **Environment**: Staging (`staging` branch only)
- **Scenarios**: `pod-kill`, `network-latency`, `network-partition`, `http-chaos`, `postgres`, `foresight-mcp`, `all`
- **Duration**: Configurable (default 300s)
- **Report**: Auto-generated to `.agent/internal/chaos-results/` and uploaded as artifact
- **Cleanup**: Automatic on failure (deletes all chaos resources)

### 6.2 Pre-Merge Gate (Future)

Once experiments are stable:

1. Run pod-kill experiment on PR staging deploy
2. Verify zero-downtime deployment (no 5xx errors during experiment)
3. Block merge if experiment causes SLO breach

### 6.3 Scheduled Runs

```bash
# Cron job (staging cluster) — add to k8s/civo/ overlay
# Runs weekly Monday 10:00 UTC
apiVersion: batch/v1
kind: CronJob
metadata:
  name: chaos-pod-kill-weekly
  namespace: pixelated-empathy
spec:
  schedule: "0 10 * * 1"     # Monday 10:00 UTC
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: chaos-runner
            image: bitnami/kubectl:latest
            command:
            - kubectl
            - apply
            - -f
            - k8s/chaos/pod-kill-experiment.yaml
```

---

## 7. Results Documentation Template

Each experiment run must be documented using this template. Store results in
`.agent/internal/chaos-results/YYYY-MM-DD-<scenario>.md`.

```markdown
# Chaos Experiment Report

**Date**: YYYY-MM-DD **Scenario**: [pod-kill | network-latency |
network-partition | http-chaos | resource-exhaustion] **Experiment file**:
k8s/chaos/<file>.yaml **Environment**: staging **Operator**: [name]
**Duration**: [actual duration]

## 7.1 Hypothesis

[What we expect to happen — e.g., "Pod restarts complete within 60s, no 5xx
errors"]

## 7.2 Observed Results

| Metric           | Expected     | Actual               | Pass/Fail |
| ---------------- | ------------ | -------------------- | --------- |
| Pod restart time | < 60s        | [actual]             |           |
| 5xx error rate   | < 0.1%       | [actual]             |           |
| p95 latency      | < 500ms      | [actual]             |           |
| Alert fired      | [alert name] | [fired/did not fire] |           |
| HPA scale-up     | yes/no       | [actual]             |           |

## 7.3 Alerts Triggered

| Alert        | Severity   | Time to fire | Auto-resolved |
| ------------ | ---------- | ------------ | ------------- |
| [alert name] | [severity] | [duration]   | [yes/no]      |

## 7.4 SLO Impact

| SLO                | Target | During experiment | After experiment | Error budget consumed |
| ------------------ | ------ | ----------------- | ---------------- | --------------------- |
| Availability (app) | 99.9%  | [actual]          | [recovered]      | [minutes]             |
| Latency p95 (app)  | ≤500ms | [actual]          | [recovered]      | [budget %]            |
| Error rate (app)   | ≤0.1%  | [actual]          | [recovered]      | [budget %]            |

## 7.5 Findings

- [Finding 1 — what worked]
- [Finding 2 — what failed]
- [Finding 3 — unexpected behavior]

## 7.6 Action Items

- [ ] [action item 1 — owner — ticket]
- [ ] [action item 2 — owner — ticket]

## 7.7 Decision

- [ ] Experiment passed — promote to weekly schedule
- [ ] Experiment failed — investigate, fix, retry
- [ ] Experiment inconclusive — adjust parameters, retry
```

---

## 8. Metrics & Success Criteria

### 8.1 Experiment Success Criteria

| Criterion            | Target  | Measurement                                       |
| -------------------- | ------- | ------------------------------------------------- |
| Auto-recovery time   | < 5 min | Time from experiment end to all metrics normal    |
| Alert accuracy       | 100%    | Expected alerts fire, no false positives          |
| Data integrity       | 100%    | No data corruption post-experiment                |
| Zero-downtime        | 100%    | No user-facing errors for ≥ 2 replica deployments |
| SLO breach detection | 100%    | SLO burn rate alerts fire on SLO violation        |

### 8.2 Platform Resilience Metrics

| Metric                       | Target                | Source                            |
| ---------------------------- | --------------------- | --------------------------------- |
| Mean Time to Recovery (MTTR) | < 5 min               | Prometheus + experiment logs      |
| Mean Time to Detect (MTTD)   | < 2 min               | Alertmanager first-fire timestamp |
| Alert noise ratio            | < 10% false positives | Alertmanager metrics              |
| Experiment coverage          | ≥ 80% services        | Chaos experiment registry         |

---

## 9. Roles & Responsibilities

| Role             | Responsibility                                             | Rotation            |
| ---------------- | ---------------------------------------------------------- | ------------------- |
| Chaos Engineer   | Design experiments, monitor execution, document results    | Assigned per sprint |
| On-Call Engineer | Execute weekly experiments, verify alerts, abort if needed | Weekly rotation     |
| SRE Lead         | Review quarterly results, approve production experiments   | Standing            |
| VP Engineering   | Approve production chaos experiments                       | As needed           |
| Compliance Lead  | Verify HIPAA compliance for any PHI-adjacent experiments   | As needed           |

---

## 10. Gap Analysis & Follow-Up Actions

| ID      | Gap                                | Priority | Action                                                      | Owner          |
| ------- | ---------------------------------- | -------- | ----------------------------------------------------------- | -------------- |
| CE-2.1  | Chaos Mesh not installed           | P0       | Install Chaos Mesh on staging cluster                       | SRE            |
| CE-2.2  | HPA maxReplicas=1                  | P0       | Increase to min=2, max=4 for zero-downtime pod-kill tests   | SRE            |
| CE-2.3  | No circuit breaker instrumentation | P1       | Add circuit breaker metrics for Redis/AI connections        | Backend        |
| CE-2.4  | No cache fallback layer            | P1       | Implement response caching for AI service partitions        | Backend        |
| CE-2.5  | No chaos CI workflow               | P1       | Create `.github/workflows/chaos-validation.yml`             | DevOps         |
| CE-2.6  | No results storage                 | P2       | Create `.agent/internal/chaos-results/` directory structure | Chaos Engineer |
| CE-2.7  | No synthetic monitoring            | P1       | Add synthetic checks for experiment validation              | SRE            |
| CE-2.8  | No Foresight MCP experiment        | P2       | Add NetworkChaos targeting Foresight MCP service            | Chaos Engineer |
| CE-2.9  | No database partition experiment   | P2       | Add NetworkChaos targeting PostgreSQL                       | Chaos Engineer |
| CE-2.10 | No production approval process     | P2       | Document production chaos approval workflow                 | SRE Lead       |

---

## 11. Glossary

| Term              | Definition                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Chaos Engineering | Discipline of experimenting on systems to build confidence in their capability to withstand turbulent conditions |
| Chaos Mesh        | Kubernetes chaos engineering platform for injecting failures into pods, networks, HTTP, and resources            |
| PodChaos          | Chaos Mesh CRD for killing or failing Kubernetes pods                                                            |
| NetworkChaos      | Chaos Mesh CRD for injecting network delays, loss, partition, and corruption                                     |
| HTTPChaos         | Chaos Mesh CRD for aborting, delaying, or modifying HTTP requests/responses                                      |
| StressChaos       | Chaos Mesh CRD for CPU and memory stress injection                                                               |
| Blast Radius      | Scope of impact a chaos experiment can have on the system                                                        |
| Error Budget      | Allowable downtime/errors per SLO (see SLO runbook §3)                                                           |
| Game Day          | Scheduled exercise where teams run chaos experiments and practice incident response                              |
| Hypothesis        | Expected outcome of a chaos experiment, stated before execution                                                  |
| Steady State      | Normal operating condition of the system, used as baseline for comparison                                        |
| Circuit Breaker   | Pattern that prevents cascading failures by stopping calls to a failing service                                  |

---

## 12. References

### Internal Documentation

- [SLO Definitions](./slo-definitions.md) — SLO targets validated by these
  experiments
- [SLA Breach Response](./sla-breach-response.md) — Response if experiment
  causes SLA breach
- [Infrastructure Disaster Recovery](./infra-disaster-recovery.md) — DR
  procedures tested during game day
- [DR RTO/RPO Targets](./dr-rto-rpo-targets.md) — Recovery targets to validate

### Experiment Manifests

- `k8s/chaos/pod-kill-experiment.yaml` — Pod failure scenarios
- `k8s/chaos/network-latency-experiment.yaml` — Network latency and loss
- `k8s/chaos/network-partition-experiment.yaml` — Network partition
- `k8s/chaos/http-chaos-experiment.yaml` — HTTP abort, delay, and stress
- `k8s/chaos/kustomization.yaml` — Bundle manifest

### Monitoring Configuration

- `monitoring/slo-burn-rate-alerts.yml` — SLO burn rate alerts expected to fire
- `monitoring/alert_rules.yml` — Platform alerts (HighErrorRate,
  HighResponseTime, etc.)
- `monitoring/dashboards/slo-monitoring-dashboard.json` — SLO dashboard for
  real-time monitoring

### Kubernetes Configuration

- `k8s/base/deployment-blue.yaml` — Target deployment (labels:
  app=pixelated-empathy-api, slot=blue)
- `k8s/base/service.yaml` — Service routing (port 80 → 5001)
- `k8s/base/hpa.yaml` — HPA config (currently min=1 max=1 — see gap CE-2.2)

### External Resources

- [Chaos Mesh Documentation](https://chaos-mesh.org/docs/)
- [Chaos Mesh GitHub](https://github.com/chaos-mesh/chaos-mesh)
- [Google SRE Workbook — Chaos Engineering](https://sre.google/workbook/chaos-engineering/)
- [Principles of Chaos Engineering](https://principlesofchaos.org/)

### Linear & GitHub

- [PIX-4149](https://linear.app/pixelated/issue/PIX-4149) — This ticket
- [PIX-4128](https://linear.app/pixelated/issue/PIX-4128) — Parent epic: Chaos
  Engineering & Resilience Testing
- [GitHub #5084](https://github.com/daggerstuff/pixelated/issues/5084) — PR
  branch
