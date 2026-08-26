---
title: Infrastructure Disaster Recovery
description:
  Complete infrastructure disaster recovery procedures for Kubernetes clusters,
  cloud regions, DNS, and CI/CD pipelines
---

<!-- markdownlint-disable MD025 MD013 MD036 -->

<div align="center">

# Infrastructure Disaster Recovery

**Complete Region Outage Recovery Runbook**

Kubernetes · Cloud Region · DNS · CI/CD Pipeline

</div>

---

## 1. Purpose & Scope

This runbook documents infrastructure-level disaster recovery procedures for the
Pixelated Empathy platform, covering Kubernetes cluster recovery, cloud region
failover, DNS failover, and CI/CD pipeline recovery.

**Scope**: Infrastructure components — compute orchestration (Kubernetes),
network routing (DNS, load balancers), deployment automation (CI/CD pipelines),
and cloud region failover.

**Out of scope**: Application-level data recovery (PostgreSQL, Redis, Foresight
MCP) — covered in [DR: RTO/RPO Targets](./dr-rto-rpo-targets.md). SLA breach
response — covered in [SLA Breach Response](./sla-breach-response.md).

**Related documents**:

- [DR: RTO/RPO Targets](./dr-rto-rpo-targets.md) — service tiers, RTO/RPO
  targets, backup strategy, BCP
- [SLA Breach Response](./sla-breach-response.md) — incident response,
  escalation, communication
- [SLO Definitions](./slo-definitions.md) — service-level objectives and error
  budgets

**Target audience**: Platform engineers, SREs, on-call engineers, DevOps leads.

**Review cadence**: Quarterly (aligned with DR drill schedule in
[DR: RTO/RPO Targets](./dr-rto-rpo-targets.md#11-disaster-recovery-drill-schedule)).

---

## 2. Infrastructure Overview

### 2.1 Production Architecture

| Component             | Technology                                             | Location                                                       | Redundancy                            |
| --------------------- | ------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------- |
| Compute orchestration | Civo K3s                                               | Civo Cloud (region: LON1)                                      | Single cluster (multi-region planned) |
| Deployment strategy   | Blue/green                                             | Kubernetes namespace                                           | Blue=active, green=standby            |
| Container registry    | Docker Hub                                             | `pixelatedempathy/{api,session-agent,qa-agent,pipeline-agent}` | Docker Hub SLA 99.9%                  |
| CI/CD                 | GitHub Actions                                         | 27 workflows                                                   | GitHub-hosted runners (multi-region)  |
| DNS                   | Cloudflare (primary), Route53 (failover health checks) | Global edge                                                    | Cloudflare 99.99% SLA                 |
| Ingress               | GCE ingress controller                                 | Civo K3s                                                       | Managed certificate                   |
| Secrets               | External Secrets Operator + secret-store               | Kubernetes                                                     | Operator-managed rotation             |
| Monitoring            | Prometheus + Grafana + Alertmanager                    | Docker Compose                                                 | 200h retention                        |

### 2.2 Kubernetes Cluster Details

- **Cluster name**: `pixelated-cluster`
- **Distribution**: Civo K3s
- **Namespace**: `pixelated-empathy`
- **Deployments**:
  - `pixelated-empathy` (blue + green slots, container port 5001, health
    `/health`)
  - `redis` (in-cluster cache, network policy restricted)
  - `session-agent`, `qa-agent`, `pipeline-agent` (AI agent deployments)
- **Service routing**: `slot: blue` selector on service → routes to active
  deployment
- **Autoscaling**: HPA on pixelated-empathy deployment
- **Ingress**: GCE class, managed TLS certificate, host `pixelatedempathy.com`
- **Kustomize overlays**: `base/` (16 resources), `civo/` overlay, `staging/`
  and `production/` overlays

### 2.3 CI/CD Pipeline Details

- **Platform**: GitHub Actions (27 workflows)
- **Primary deploy workflow**: `deploy-civo.yml`
  - Builds Docker images for 4 services (api, session-agent, qa-agent,
    pipeline-agent)
  - Pushes to Docker Hub (`pixelatedempathy/*`)
  - Deploys to Civo K3s via `kubectl` + `kustomize`
  - Blue slot = active deployment target
  - Post-deploy: rollout status check + smoke test via
    `scripts/deploy/verify-deployment.sh`
- **Other critical workflows**: `ci.yml` (lint/test/build), `monitoring.yml`,
  `security-scanning.yml`, `codeql.yml`, `playwright.yml`, `sdk-generation.yml`

### 2.4 Multi-Region Failover Capabilities

The platform has automated multi-region failover orchestration code:

- **`src/lib/deployment/multi-region/AutomatedFailoverOrchestrator.ts`**:
  Integrates Route53 health checks, SNS notifications, SQS queues, Lambda
  triggers, and CloudWatch alarms. Manages `FailoverState` (healthy →
  failing_over → degraded), emits `FailoverEvent` and `FailoverNotification`
  types. Includes circuit breakers and CDN config updates.
- **`ai/deployment/production_deployer.py`**: Blue-green canary deployment with
  rollback capability. Traffic shifting: 5% → 25% → 50% → 100% with health
  checks at each stage. SQLite deployment records for audit trail.

> **Note**: Multi-region failover orchestration code exists but is not yet
> deployed to production. Current production runs on a single Civo region
> (LON1). This runbook covers both current single-region recovery and future
> multi-region failover procedures.

---

## 3. Kubernetes Cluster Recovery

### 3.1 Scenario: Cluster Node Failure

**RTO**: 30 minutes (Tier 1 service: pixelated-app) **Trigger**: Node NotReady
for >5 minutes, or pod eviction storms.

#### Recovery Steps

1. **Assess cluster state**:

   ```bash
   kubectl get nodes -o wide
   kubectl get pods -n pixelated-empathy -o wide
   kubectl describe node <failing-node>
   ```

2. **Cordon and drain failing node**:

   ```bash
   kubectl cordon <failing-node>
   kubectl drain <failing-node> --ignore-daemonsets --delete-emptydir-data --force
   ```

3. **Verify pod rescheduling**:

   ```bash
   kubectl get pods -n pixelated-empathy -w
   # Confirm pods rescheduled to healthy nodes
   kubectl rollout status deployment/pixelated-empathy -n pixelated-empathy
   ```

4. **If K3s auto-recovery fails, replace node**:

   ```bash
   # Via Civo CLI
   civo kubernetes node delete <node-name> --cluster pixelated-cluster
   civo kubernetes node create --cluster pixelated-cluster --size g3.k3s.medium
   # Wait for node Ready, then verify workloads
   kubectl get nodes -w
   ```

5. **Run smoke tests**:

   ```bash
   bash scripts/deploy/verify-deployment.sh
   ```

6. **Post-recovery**: Uncordon if node recovered, or remove permanently failed
   node from cluster.

### 3.2 Scenario: Control Plane Failure

**RTO**: 1 hour (Tier 1) **Trigger**: `kubectl` commands fail, API server
unreachable, etcd quorum loss.

Civo K3s is a managed Kubernetes service — control plane is managed by Civo.
Control plane failures are Civo's responsibility.

#### Recovery Steps

1. **Check Civo status**:

   ```bash
   civo kubernetes show pixelated-cluster
   # Check Civo status page: https://status.civo.com
   ```

2. **Escalate to Civo support** if control plane unresponsive for >15 minutes:
   - Support: support@civo.com
   - Priority: Production down
   - Include: cluster name, region, timestamp, error messages

3. **If control plane recovers but workloads are degraded**:

   ```bash
   kubectl get pods -n pixelated-empathy
   kubectl rollout restart deployment/pixelated-empathy -n pixelated-empathy
   kubectl rollout restart deployment/session-agent -n pixelated-empathy
   kubectl rollout restart deployment/qa-agent -n pixelated-empathy
   kubectl rollout restart deployment/pipeline-agent -n pixelated-empathy
   ```

4. **Verify ingress and TLS**:
   ```bash
   kubectl get ingress -n pixelated-empathy
   kubectl get certificate -n pixelated-empathy
   # Test: curl -I https://pixelatedempathy.com/health
   ```

### 3.3 Scenario: Etcd Data Loss (Complete Cluster Rebuild)

**RTO**: 4 hours (Tier 2 — infra rebuild, app data recovered from backups)
**Trigger**: Complete cluster loss, corrupted etcd, irrecoverable control plane.

> **Note**: Civo K3s manages etcd internally. Full etcd restore on managed K3s
> requires cluster recreation. Application state is recovered from backups per
> [DR: RTO/RPO Targets](./dr-rto-rpo-targets.md#6-backup-and-recovery-strategy).

#### Recovery Steps

1. **Destroy and recreate cluster**:

   ```bash
   # Export current cluster config for reference
   civo kubernetes show pixelated-cluster > /tmp/cluster-config-backup.txt

   # Delete cluster (WARNING: destructive)
   civo kubernetes delete pixelated-cluster --yes

   # Recreate cluster
   civo kubernetes create pixelated-cluster \
     --size g3.k3s.medium \
     --nodes 3 \
     --region LON1 \
     --wait
   ```

2. **Update kubeconfig**:

   ```bash
   civo kubernetes config pixelated-cluster --save
   kubectl get nodes
   ```

3. **Reinstall External Secrets Operator**:

   ```bash
   # Follow: https://external-secrets.io/latest/introduction/getting-started/
   kubectl apply -f https://raw.githubusercontent.com/external-secrets/external-secrets/main/docs/deploy/manifests/deploy.yaml
   kubectl wait --for=condition=available deployment/external-secrets-controller -n external-secrets --timeout=120s
   ```

4. **Apply base K8s manifests**:

   ```bash
   # Apply in dependency order
   kubectl apply -k k8s/overlays/production/
   # Or manually:
   kubectl apply -f k8s/base/namespace.yaml
   kubectl apply -f k8s/base/configmap.yaml
   kubectl apply -f k8s/base/secret-store.yaml
   kubectl apply -f k8s/base/external-secrets.yaml
   kubectl apply -f k8s/base/secrets.yaml
   kubectl apply -f k8s/base/redis-deployment.yaml
   kubectl apply -f k8s/base/redis-service.yaml
   kubectl apply -f k8s/base/redis-network-policy.yaml
   kubectl apply -f k8s/base/deployment-blue.yaml
   kubectl apply -f k8s/base/deployment-green.yaml
   kubectl apply -f k8s/base/service.yaml
   kubectl apply -f k8s/base/hpa.yaml
   kubectl apply -f k8s/base/frontend-config.yaml
   kubectl apply -f k8s/base/managed-cert.yaml
   kubectl apply -f k8s/base/ingress.yaml
   ```

5. **Restore application data** (from
   [DR: RTO/RPO Targets](./dr-rto-rpo-targets.md)):

   ```bash
   # PostgreSQL restore (WAL + PITR)
   bash docker/postgres/backup/restore.sh --target-time "<timestamp>"

   # Redis restore (RDB + AOF)
   # Copy backup RDB to Redis data volume, restart Redis pod

   # Foresight MCP restore
   bash scripts/memory/restore-shared-memory-db.sh

   # NeMo model recovery
   bash scripts/devops/nemo-recovery.sh
   ```

6. **Deploy latest images**:

   ```bash
   # Trigger deploy-civo.yml workflow or deploy manually
   kubectl set image deployment/pixelated-empathy \
     app=pixelatedempathy/api:latest -n pixelated-empathy
   kubectl rollout status deployment/pixelated-empathy -n pixelated-empathy
   ```

7. **Verify full stack**:
   ```bash
   bash scripts/deploy/verify-deployment.sh
   curl -I https://pixelatedempathy.com/health
   # Verify Prometheus metrics: curl http://<prometheus>:9090/-/healthy
   ```

---

## 4. Cloud Region Failover

### 4.1 Current State: Single Region (Civo LON1)

Production currently runs on a single Civo region (LON1). No automated
multi-region failover is active. Region failure requires manual cluster rebuild
in an alternate region (see
[Section 3.3](#33-scenario-etcd-data-loss-complete-cluster-rebuild)).

**Manual region failover RTO**: 4 hours (Tier 2 — includes cluster rebuild +
data restore).

### 4.2 Future State: Multi-Region Active-Active

The `AutomatedFailoverOrchestrator` (in `src/lib/deployment/multi-region/`) is
designed for multi-region active-active with automated health-check-driven
failover:

| Component        | Role                                                            |
| ---------------- | --------------------------------------------------------------- |
| Route53          | Health check routing, weighted records, failover policies       |
| SNS              | Failover event notifications to subscribers                     |
| SQS              | Async failover command queue                                    |
| Lambda           | Failover trigger execution (DNS weight update, CDN config push) |
| CloudWatch       | Health alarm source, dashboard, log aggregation                 |
| Circuit breakers | Prevent failback flapping during unstable states                |
| CDN config       | Dynamic edge config update to reroute traffic                   |

#### Automated Failover Procedure (When Deployed)

1. **Health check fails** → CloudWatch alarm fires → Lambda triggered.
2. **Lambda executes**:
   - Updates Route53 weighted records (shift 100% traffic to healthy region).
   - Updates Cloudflare CDN config (origin pool to healthy region).
   - Publishes `FailoverEvent` to SNS.
   - State transitions: `healthy` → `failing_over` → `degraded` (if recovery) or
     `healthy` (if full recovery).
3. **Circuit breaker** prevents failback for configurable cooldown period
   (default: 15 minutes).
4. **Notification** sent via SNS to on-call (PagerDuty + Slack).

#### Manual Failover Trigger (When Deployed)

```bash
# Trigger failover via orchestrator API
node dist/lib/deployment/multi-region/failover-cli.js trigger \
  --from-region LON1 \
  --to-region FRA1 \
  --reason "Region degradation detected"
```

### 4.3 DNS-Based Failover (Cloudflare)

Cloudflare provides DNS-level failover independent of Route53:

1. **Health check**: Cloudflare monitors origin health (HTTP check to
   `/health`).
2. **Failover pool**: Configure Cloudflare Load Balancer with origin pool:
   - Primary origin: `pixelatedempathy.com` → Civo LON1 LB IP
   - Secondary origin: failover region LB IP (when available)
3. **Failover behavior**: Cloudflare automatically routes to secondary origin
   when primary fails health check for 3 consecutive checks (default 90
   seconds).

**Cloudflare Load Balancer configuration** (to be set up):

```yaml
# Cloudflare API config (via dashboard or API)
load_balancer:
  name: 'pixelated-empathy-primary'
  fallback_pool: 'failover-pool'
  default_pool: 'primary-pool'
  region_pools:
    EU: ['primary-pool', 'failover-pool']
    NA: ['primary-pool', 'failover-pool']
  steering_policy: 'dynamic'
  health_check:
    path: '/health'
    type: 'HTTPS'
    interval: 60
    timeout: 5
    retries: 2
```

---

## 5. DNS Failover

### 5.1 Cloudflare DNS (Primary)

**Current setup**: Cloudflare manages DNS for `pixelatedempathy.com`.

#### DNS Record Configuration

| Record                 | Type  | Value                    | TTL  | Proxied | Purpose             |
| ---------------------- | ----- | ------------------------ | ---- | ------- | ------------------- |
| `pixelatedempathy.com` | A     | Civo LB IP               | Auto | Yes     | Primary application |
| `www`                  | CNAME | `pixelatedempathy.com`   | Auto | Yes     | WWW redirect        |
| `api`                  | CNAME | `pixelatedempathy.com`   | Auto | Yes     | API subdomain       |
| `_dmarc`               | TXT   | `v=DMARC1; p=reject;...` | 1h   | No      | Email auth          |
| `_domainkey`           | TXT   | `v=DKIM1; k=rsa;...`     | 1h   | No      | Email signing       |

#### DNS Failover Procedure

1. **Verify current DNS**:

   ```bash
   dig pixelatedempathy.com +short
   curl -sI https://pixelatedempathy.com/health
   ```

2. **If primary origin down, update DNS**:

   ```bash
   # Via Cloudflare API
   curl -X PATCH "https://api.cloudflare.com/client/v4/zones/<zone-id>/dns_records/<record-id>" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{
       "type": "A",
       "name": "pixelatedempathy.com",
       "content": "<failover-origin-ip>",
       "proxied": true,
       "ttl": 1
     }'
   ```

3. **Verify propagation** (Cloudflare proxies, propagation is near-instant):

   ```bash
   dig pixelatedempathy.com +short
   curl -sI https://pixelatedempathy.com/health
   # Check Cloudflare dashboard for active origin
   ```

4. **Post-recovery: revert DNS**:
   ```bash
   # Same PATCH call with original IP
   curl -X PATCH "https://api.cloudflare.com/client/v4/zones/<zone-id>/dns_records/<record-id>" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"content": "<primary-origin-ip>"}'
   ```

### 5.2 Route53 Health Checks (Failover Health Monitoring)

Route53 is used by the `AutomatedFailoverOrchestrator` for health-check-driven
failover (when multi-region is deployed).

#### Route53 Configuration

| Element          | Configuration                                              |
| ---------------- | ---------------------------------------------------------- |
| Health check     | HTTP endpoint `/health`, interval 30s, failure threshold 3 |
| Failover policy  | Primary → Secondary, evaluated every 30s                   |
| Weighted routing | 100/0 normal, 0/100 during failover                        |
| SNS topic        | `pixelated-failover-alerts` — publishes on state change    |

#### Route53 Failover Trigger

```bash
# Update Route53 weighted records via AWS CLI
aws route53 change-resource-record-sets \
  --hosted-zone-id <zone-id> \
  --change-batch '{
    "Changes": [
      {
        "Action": "UPSERT",
        "ResourceRecordSet": {
          "Name": "pixelatedempathy.com.",
          "Type": "A",
          "SetIdentifier": "primary",
          "Weight": 0,
          "AliasTarget": {"DNSName": "primary-lb.example.com", "EvaluateTargetHealth": true}
        }
      },
      {
        "Action": "UPSERT",
        "ResourceRecordSet": {
          "Name": "pixelatedempathy.com.",
          "Type": "A",
          "SetIdentifier": "secondary",
          "Weight": 100,
          "AliasTarget": {"DNSName": "secondary-lb.example.com", "EvaluateTargetHealth": true}
        }
      }
    ]
  }'
```

---

## 6. CI/CD Pipeline Recovery

### 6.1 Scenario: GitHub Actions Outage

**RTO**: 4 hours (Tier 3 — development operations) **Trigger**: GitHub Actions
unavailable, workflow runs failing for >30 minutes.

#### Recovery Steps

1. **Check GitHub status**: https://www.githubstatus.com

2. **If GitHub Actions degraded but Git available**:
   - Deploy manually from latest Docker Hub images:
     ```bash
     # Pull latest images
     docker pull pixelatedempathy/api:latest
     docker pull pixelatedempathy/session-agent:latest
     docker pull pixelatedempathy/qa-agent:latest
     docker pull pixelatedempathy/pipeline-agent:latest

     # Deploy to K8s
     kubectl set image deployment/pixelated-empathy \
       app=pixelatedempathy/api:latest -n pixelated-empathy
     kubectl rollout status deployment/pixelated-empathy -n pixelated-empathy
     ```

3. **If Git also unavailable**:
   - Use local clone as fallback source.
   - Deploy from last known good commit:
     ```bash
     git log --oneline -5  # identify last good commit
     git checkout <last-good-commit>
     # Build and push manually if Docker Hub available
     docker build -t pixelatedempathy/api:emergency -f Dockerfile.api .
     docker push pixelatedempathy/api:emergency
     kubectl set image deployment/pixelated-empathy \
       app=pixelatedempathy/api:emergency -n pixelated-empathy
     ```

4. **Post-recovery**: Resume normal CI/CD pipeline. Reconcile any manual changes
   with Git history.

### 6.2 Scenario: Docker Hub Outage

**RTO**: 2 hours (Tier 2 — deployment blocked) **Trigger**: Docker Hub pull/push
failing, `kubectl rollout status` shows `ImagePullBackOff`.

#### Recovery Steps

1. **Check Docker Hub status**: https://status.docker.com

2. **If Docker Hub pull failing but images cached on nodes**:

   ```bash
   # Check if images are cached
   kubectl describe pod <pod-name> -n pixelated-empathy | grep "Image:"
   # If cached, pods may still start. Force restart to use cache:
   kubectl rollout restart deployment/pixelated-empathy -n pixelated-empathy
   ```

3. **If images not cached, use alternate registry**:

   ```bash
   # Pull from GitHub Container Registry (if configured) or build locally
   docker build -t ghcr.io/daggerstuff/pixelated/api:emergency -f Dockerfile.api .
   docker push ghcr.io/daggerstuff/pixelated/api:emergency

   # Update deployment to use alternate registry
   kubectl set image deployment/pixelated-empathy \
     app=ghcr.io/daggerstuff/pixelated/api:emergency -n pixelated-empathy
   ```

4. **Post-recovery**: Revert to Docker Hub images when service restored.

### 6.3 CI/CD Configuration Backup

Critical CI/CD configuration is version-controlled in Git. Backup strategy:

| Artifact                  | Location                           | Backup Method                         |
| ------------------------- | ---------------------------------- | ------------------------------------- |
| GitHub Actions workflows  | `.github/workflows/*.yml`          | Git (primary) + rclone nightly backup |
| K8s manifests             | `k8s/` (27 YAML files)             | Git (primary) + rclone nightly backup |
| Deploy scripts            | `scripts/deploy/` (20 scripts)     | Git (primary) + rclone nightly backup |
| Docker Compose            | `docker-compose*.yml` (25 files)   | Git (primary) + rclone nightly backup |
| Monitoring config         | `monitoring/`                      | Git (primary) + rclone nightly backup |
| Multi-region orchestrator | `src/lib/deployment/multi-region/` | Git (primary) + rclone nightly backup |

**Recovery from Git**:

```bash
# Clone repo (or use local clone)
git clone https://github.com/daggerstuff/pixelated.git
cd pixelated
git checkout <last-good-commit>

# Restore CI/CD configuration
ls .github/workflows/  # verify workflows present
ls k8s/                 # verify manifests present
ls scripts/deploy/      # verify deploy scripts present
```

---

## 7. Complete Region Outage Recovery Runbook

### 7.1 Scenario: Full Civo LON1 Region Outage

**RTO**: 4 hours (Tier 2 — full region rebuild) **Trigger**: Civo status page
reports LON1 region outage, all nodes unreachable, `kubectl` commands fail.

> This is the worst-case infrastructure scenario. Follow this runbook
> end-to-end.

#### Phase 1: Detection & Assessment (0–15 minutes)

1. **Confirm outage**:

   ```bash
   # Check Civo status
   curl -s https://status.civo.com/api/v2/incidents.json | jq '.incidents[]'
   # Check cluster
   kubectl get nodes  # expect timeout or error
   # Check external connectivity
   curl -sI --connect-timeout 10 https://pixelatedempathy.com/health
   ```

2. **Declare incident**: Open incident in incident management system.
   - Severity: **Emergency** (per
     [SLA Breach Response](./sla-breach-response.md#3-severity-classification))
   - Notify: PagerDuty (emergency), Slack `#incidents`, status page

3. **Assess blast radius**:
   - Is DNS resolving? (Cloudflare may still serve cached content)
   - Is Docker Hub available? (needed for image pulls during rebuild)
   - Are backups accessible? (S3 bucket `pixelated-empathy-backups`)

#### Phase 2: Decision Point (15–30 minutes)

4. **Evaluate options**:

   | Option                               | RTO                      | Complexity | Data Loss                |
   | ------------------------------------ | ------------------------ | ---------- | ------------------------ |
   | Wait for Civo recovery               | Unknown (Civo-dependent) | None       | None (if etcd intact)    |
   | Rebuild in alternate Civo region     | 4 hours                  | High       | RPO-dependent (5min–1hr) |
   | Rebuild on alternate cloud (AWS EKS) | 6+ hours                 | Very High  | RPO-dependent            |
   | Deploy to staging cluster            | 2 hours                  | Medium     | None (staging data)      |

5. **Decision criteria**:
   - Civo ETA < 30 min → Wait.
   - Civo ETA 30min–2hr → Prepare alternate region rebuild in parallel.
   - Civo ETA > 2hr or unknown → Initiate alternate region rebuild.

#### Phase 3: Alternate Region Rebuild (30 minutes–4 hours)

6. **Provision new cluster** (alternate Civo region, e.g., FRA1):

   ```bash
   civo kubernetes create pixelated-cluster-dr \
     --size g3.k3s.medium \
     --nodes 3 \
     --region FRA1 \
     --wait
   civo kubernetes config pixelated-cluster-dr --save
   ```

7. **Apply K8s manifests** (see
   [Section 3.3, steps 3–4](#33-scenario-etcd-data-loss-complete-cluster-rebuild)).

8. **Restore application data**:

   ```bash
   # PostgreSQL (most recent backup from S3)
   aws s3 cp s3://pixelated-empathy-backups/postgres/latest/ /tmp/pg-restore/
   PGPASSWORD=<password> pg_restore -h <new-pg-host> -U pixelated \
     -d pixelated_empathy /tmp/pg-restore/dump.sql

   # Redis (RDB from backup)
   aws s3 cp s3://pixelated-empathy-backups/redis/latest/dump.rdb /tmp/
   kubectl cp /tmp/dump.rdb redis-0:/data/dump.rdb -n pixelated-empathy
   kubectl rollout restart deployment/redis -n pixelated-empathy

   # Foresight MCP
   aws s3 cp s3://pixelated-empathy-backups/foresight/latest/ /tmp/foresight/
   bash scripts/memory/restore-shared-memory-db.sh --backup-dir /tmp/foresight/
   ```

9. **Deploy latest images**:
   ```bash
   # Deploy from Docker Hub
   kubectl set image deployment/pixelated-empathy \
     app=pixelatedempathy/api:latest -n pixelated-empathy
   kubectl set image deployment/session-agent \
     app=pixelatedempathy/session-agent:latest -n pixelated-empathy
   kubectl set image deployment/qa-agent \
     app=pixelatedempathy/qa-agent:latest -n pixelated-empathy
   kubectl set image deployment/pipeline-agent \
     app=pixelatedempathy/pipeline-agent:latest -n pixelated-empathy

   kubectl rollout status deployment/pixelated-empathy -n pixelated-empathy
   ```

#### Phase 4: DNS Cutover (4 hours–4h15m)

10. **Update Cloudflare DNS** to point to new cluster LB:

    ```bash
    # Get new cluster LB IP
    NEW_LB_IP=$(civo kubernetes show pixelated-cluster-dr | grep "Load Balancer" | awk '{print $NF}')

    # Update Cloudflare DNS (see [Section 5.1](#51-cloudflare-dns-primary))
    curl -X PATCH "https://api.cloudflare.com/client/v4/zones/<zone-id>/dns_records/<record-id>" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" \
      --data "{\"content\": \"$NEW_LB_IP\"}"
    ```

11. **Verify cutover**:
    ```bash
    sleep 30  # DNS propagation (Cloudflare proxied = near-instant)
    curl -sI https://pixelatedempathy.com/health
    bash scripts/deploy/verify-deployment.sh
    ```

#### Phase 5: Validation & Communication (4h15m–4h30m)

12. **Full validation**:

    ```bash
    # Health checks
    curl -s https://pixelatedempathy.com/health
    curl -s https://pixelatedempathy.com/api/health
    kubectl get pods -n pixelated-empathy
    kubectl get nodes

    # Metrics
    curl -s http://<new-prometheus>:9090/-/healthy

    # Authentication
    # Test login flow end-to-end
    ```

13. **Update status page**: Mark incident as resolved.
14. **Notify stakeholders**: Customer email (Enterprise+ within 24h per BAA,
    Enterprise within 48h, Pro within 7d — per
    [SLA Contract Terms](../sla-contract-terms.md)).
15. **Schedule postmortem**: Within 48h (per
    [SLA Breach Response](./sla-breach-response.md#8-postmortem-process)).

#### Phase 6: Post-Recovery (24–72 hours)

16. **Monitor for 24h** before declaring full stability.
17. **Postmortem** within 48h (per
    [SLA Breach Response](./sla-breach-response.md#8-postmortem-process)).
18. **Update DR runbook** with lessons learned.
19. **Evaluate permanent migration** to alternate region or multi-region setup.

---

## 8. Staging Failover Test Plan

### 8.1 Objective

Validate the complete region outage recovery procedure in a staging environment
before production failure. Tests cover: cluster rebuild, data restore, DNS
cutover, and application validation.

### 8.2 Test Schedule

| Quarter | Test Focus                                       | Duration | Success Criteria                      |
| ------- | ------------------------------------------------ | -------- | ------------------------------------- |
| Q1      | Kubernetes cluster rebuild (staging)             | 4 hours  | Cluster operational, all pods Running |
| Q2      | Full region failover (staging → staging-dr)      | 4 hours  | DNS cutover complete, app healthy     |
| Q3      | CI/CD pipeline recovery (simulate GitHub outage) | 2 hours  | Manual deploy succeeds                |
| Q4      | Multi-region failover (when available)           | 2 hours  | Automated failover triggers correctly |

> Aligned with quarterly DR drill schedule in
> [DR: RTO/RPO Targets](./dr-rto-rpo-targets.md#11-disaster-recovery-drill-schedule).

### 8.3 Test Procedure: Kubernetes Cluster Rebuild (Q1)

**Prerequisites**: Staging cluster operational, backups available in S3, test
window scheduled (off-hours).

#### Steps

1. **Snapshot staging cluster** (for rollback):

   ```bash
   civo kubernetes show pixelated-staging > /tmp/staging-snapshot.txt
   kubectl get all -n pixelated-empathy > /tmp/staging-resources.txt
   ```

2. **Destroy staging cluster**:

   ```bash
   civo kubernetes delete pixelated-staging --yes
   ```

3. **Execute recovery procedure** (follow
   [Section 3.3](#33-scenario-etcd-data-loss-complete-cluster-rebuild)):
   - Provision new cluster
   - Apply K8s manifests
   - Restore data from staging backups
   - Deploy latest images

4. **Validation checklist**:

   | Check                 | Expected                   | Pass/Fail |
   | --------------------- | -------------------------- | --------- |
   | All nodes Ready       | 3/3 Ready                  | ☐         |
   | All pods Running      | 0 CrashLoopBackOff         | ☐         |
   | Ingress healthy       | HTTP 200 on /health        | ☐         |
   | TLS valid             | Certificate valid >30 days | ☐         |
   | Redis connected       | App can read/write cache   | ☐         |
   | PostgreSQL connected  | App can read/write DB      | ☐         |
   | Authentication works  | Login + token validation   | ☐         |
   | API endpoints respond | All /api/* return 200      | ☐         |
   | Metrics scraping      | Prometheus targets up      | ☐         |
   | Alerts firing         | Alertmanager receiving     | ☐         |

5. **Document results**:
   - Actual RTO measured: ___ minutes
   - Issues encountered: ___
   - Runbook accuracy: ___
   - Action items: ___

6. **Restore staging** to pre-test state if needed.

### 8.4 Test Procedure: DNS Failover (Q2)

1. **Provision secondary staging cluster** in alternate region.
2. **Configure Cloudflare Load Balancer** with both staging clusters in origin
   pool.
3. **Simulate primary failure**: Scale primary deployment to 0 replicas.
4. **Verify Cloudflare failover**: DNS routes to secondary within 90 seconds.
5. **Simulate recovery**: Scale primary back up. Verify DNS reverts (after
   cooldown).
6. **Document results**: Failover time, recovery time, any edge cases.

---

## 9. Monitoring & Alerting for DR

### 9.1 DR-Specific Alerts

The following alerts should be configured to detect DR-relevant conditions:

| Alert                | Condition                                        | Severity  | Action                            |
| -------------------- | ------------------------------------------------ | --------- | --------------------------------- |
| ClusterNodeDown      | `up{job="kubernetes-nodes"} == 0` for 5m         | Critical  | Page on-call, assess node failure |
| ClusterAPIDown       | `kubectl get` fails for 10m                      | Critical  | Page on-call, escalate to Civo    |
| BackupFailure        | `backup_success_total` not incrementing in 26h   | Warning   | Investigate backup scripts        |
| DNSResolutionFailure | DNS lookup for pixelatedempathy.com fails for 5m | Emergency | Page on-call, check Cloudflare    |
| DockerHubPullFailure | `ImagePullBackOff` on any deployment for 10m     | Warning   | Check Docker Hub status           |
| CertificateExpiring  | TLS cert <14 days to expiry                      | Warning   | Renew managed certificate         |

### 9.2 Synthetic Monitoring

Deploy synthetic checks to detect region-wide outages:

```yaml
# External health check (e.g., via UptimeRobot, Pingdom, or Cloudflare Workers)
- name: 'Primary health endpoint'
  url: 'https://pixelatedempathy.com/health'
  expected_status: 200
  interval: 60s
  timeout: 10s
  alert_on_failure: true
  alert_channels: [pagerduty, slack]

- name: 'API health endpoint'
  url: 'https://pixelatedempathy.com/api/health'
  expected_status: 200
  interval: 60s
  timeout: 10s
  alert_on_failure: true
```

---

## 10. Roles & Responsibilities

| Role               | Responsibility       | DR Action                             |
| ------------------ | -------------------- | ------------------------------------- |
| On-call engineer   | First responder      | Detect, assess, execute recovery      |
| Incident commander | Coordination         | Declare incident, manage comms        |
| Platform engineer  | K8s/infra expertise  | Execute cluster rebuild, DNS cutover  |
| DevOps lead        | CI/CD expertise      | Manage deploy pipeline recovery       |
| SRE lead           | DR drill ownership   | Schedule, execute, document drills    |
| VP Engineering     | Executive escalation | Approve region migration decisions    |
| Compliance lead    | HIPAA/SLA oversight  | Ensure breach notification compliance |

> See [SLA Breach Response](./sla-breach-response.md#2-roles--responsibilities)
> for full incident role definitions.

---

## 11. Gap Analysis & Follow-Up Actions

| ID     | Gap                                               | Priority | Action                                                    | Owner         |
| ------ | ------------------------------------------------- | -------- | --------------------------------------------------------- | ------------- |
| DR3-1  | No multi-region deployment                        | P1       | Deploy AutomatedFailoverOrchestrator to production        | Platform team |
| DR3-2  | No Cloudflare Load Balancer configured            | P1       | Configure Cloudflare LB with origin pool + failover       | Platform team |
| DR3-3  | No Route53 health checks active                   | P2       | Configure Route53 health checks when multi-region live    | Platform team |
| DR3-4  | No alternate container registry (GHCR) configured | P2       | Set up GitHub Container Registry as Docker Hub fallback   | DevOps        |
| DR3-5  | No synthetic external monitoring                  | P1       | Deploy UptimeRobot/Cloudflare Workers synthetic checks    | SRE           |
| DR3-6  | No automated DR drill execution                   | P2       | Automate staging cluster rebuild test                     | SRE           |
| DR3-7  | External Secrets Operator not backed up           | P2       | Document ESO recovery procedure                           | Platform team |
| DR3-8  | No K8s etcd snapshot automation                   | P2       | Configure etcd snapshot to S3 (if K3s supports)           | Platform team |
| DR3-9  | Deploy scripts not containerized                  | P3       | Package deploy scripts as container for portability       | DevOps        |
| DR3-10 | No runbook automation (scripted DR)               | P3       | Create `scripts/disaster/recover-region.sh` orchestration | SRE           |

---

## 12. Glossary

| Term                          | Definition                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Blue/Green deployment**     | Deployment strategy with two identical environments; one active (blue), one standby (green). Switch by updating service selector. |
| **Civo K3s**                  | Managed lightweight Kubernetes distribution hosted on Civo Cloud.                                                                 |
| **DNS failover**              | Automatic rerouting of DNS records from primary to secondary origin upon health check failure.                                    |
| **etcd**                      | Distributed key-value store used as Kubernetes' backing store for all cluster data.                                               |
| **External Secrets Operator** | Kubernetes operator that syncs secrets from external secret stores (AWS Secrets Manager, Vault) into Kubernetes secrets.          |
| **Failover**                  | Automatic or manual switching from primary to secondary system upon failure.                                                      |
| **HPA**                       | Horizontal Pod Autoscaler — scales deployment replicas based on CPU/memory/custom metrics.                                        |
| **Kustomize**                 | Kubernetes-native configuration management tool for composing overlays from base manifests.                                       |
| **K3s**                       | Lightweight Kubernetes distribution optimized for edge and IoT.                                                                   |
| **Origin pool**               | Cloudflare Load Balancer concept — group of origins that can serve traffic for a hostname.                                        |
| **PITR**                      | Point-in-Time Recovery — PostgreSQL recovery to a specific timestamp using WAL archives.                                          |
| **Route53**                   | AWS DNS web service supporting health checks, failover routing, and weighted policies.                                            |
| **RPO**                       | Recovery Point Objective — maximum acceptable data loss measured in time.                                                         |
| **RTO**                       | Recovery Time Objective — maximum acceptable downtime before service is restored.                                                 |
| **Synthetic monitoring**      | External simulated user interactions to detect availability issues before real users.                                             |
| **WAL**                       | Write-Ahead Log — PostgreSQL transaction log enabling point-in-time recovery.                                                     |

---

## 13. References

### Internal Documents

- [DR: RTO/RPO Targets](./dr-rto-rpo-targets.md) — service tiers, RTO/RPO,
  backup strategy, BCP
- [SLA Breach Response](./sla-breach-response.md) — incident response,
  escalation, comms templates
- [SLO Definitions](./slo-definitions.md) — service-level objectives, error
  budgets
- [SLA Contract Terms](../sla-contract-terms.md) — customer SLA commitments,
  service credits
- [Vendor Inventory](../vendor-inventory.md) — third-party vendors, data access
  levels

### Infrastructure Files

- `k8s/` — Kubernetes manifests (27 YAML files: base, civo overlay,
  staging/production overlays)
- `k8s/base/` — base K8s resources (namespace, deployments, services, ingress,
  HPA, secrets)
- `.github/workflows/` — CI/CD workflows (27 files including `deploy-civo.yml`)
- `src/lib/deployment/multi-region/AutomatedFailoverOrchestrator.ts` —
  multi-region failover orchestration
- `ai/deployment/production_deployer.py` — blue-green canary deployer with
  rollback
- `scripts/deploy/` — deploy scripts (20 files including `verify-deployment.sh`,
  `rollout-civo.sh`)
- `scripts/backup/` — backup scripts (`disaster-recovery.sh`,
  `backup-system.sh`, `rclone-nightly-backup.sh`, `verify-backups.sh`)
- `docker/postgres/backup/` — PostgreSQL backup/restore scripts (WAL + PITR)
- `monitoring/` — Prometheus, Grafana, Alertmanager configuration

### External Resources

- [Civo Status](https://status.civo.com) — Civo Cloud status page
- [Cloudflare Status](https://www.cloudflarestatus.com) — Cloudflare status page
- [Docker Hub Status](https://status.docker.com) — Docker Hub status page
- [GitHub Status](https://www.githubstatus.com) — GitHub status page
- [Civo Kubernetes Documentation](https://www.civo.com/docs/kubernetes) — Civo
  K3s docs
- [Cloudflare Load Balancing](https://developers.cloudflare.com/load-balancing/)
  — Cloudflare LB docs
- [AWS Route53 Health Checks](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover.html)
  — Route53 failover docs
- [Kubernetes Disaster Recovery](https://kubernetes.io/docs/tasks/administer-cluster/recover-cluster/)
  — K8s cluster recovery
- [External Secrets Operator](https://external-secrets.io/) — ESO documentation

### Linear & GitHub

- [PIX-4134: DR-3 Infrastructure Disaster Recovery Procedure](https://linear.app/pixelated/issue/PIX-4134/dr-3-infrastructure-disaster-recovery-procedure)
- [Parent: PIX-4125 Disaster Recovery & Backup](https://linear.app/pixelated/issue/PIX-4125/disaster-recovery-backup)
- [GitHub PR: daggerstuff/pixelated#5069](https://github.com/daggerstuff/pixelated/pull/5069)
