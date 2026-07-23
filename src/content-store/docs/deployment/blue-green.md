---
description: Blue-green deployment strategy for zero-downtime production releases
pubDate: '2026-07-23'
author: Pixelated Team
tags:
  - deployment
  - blue-green
  - kubernetes
draft: false
toc: true
title: Blue-Green Deployment Strategy
---

# Blue-Green Deployment Strategy

## Overview

Pixelated Empathy uses a blue-green deployment strategy for zero-downtime
production releases with instant rollback capability.

**How it works**: Two identical deployments (blue and green) run simultaneously.
Traffic is routed to only one at a time via a Service selector. New releases
are deployed to the inactive slot, health-checked, then traffic is switched.

## Architecture

```
                    ┌─────────────────────────────────┐
                    │           Service                │
                    │  selector: slot: blue|green     │
                    └──────────┬──────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                                  ▼
     ┌─────────────────┐              ┌─────────────────┐
     │  Blue Deploy    │              │  Green Deploy  │
     │  (active)       │              │  (inactive)    │
     │  Replicas: 2+   │              │  Replicas: 0+  │
     │  Image: v1.2.3  │              │  Image: v1.3.0 │
     └─────────────────┘              └─────────────────┘
```

## Files

| File | Description |
|------|-------------|
| `k8s/base/deployment-blue.yaml` | Base (GCE) blue deployment (port 5001) |
| `k8s/base/deployment-green.yaml` | Base (GCE) green deployment (port 5001) |
| `k8s/base/service.yaml` | Base Service — selector includes `slot: blue` |
| `k8s/civo/deployment-blue.yaml` | Civo blue deployment (port 4321, TLS) |
| `k8s/civo/deployment-green.yaml` | Civo green deployment (port 4321, TLS) |
| `k8s/civo/service.yaml` | Civo LoadBalancer Service — selector includes `slot: blue` |
| `scripts/devops/blue-green-deploy.sh` | Deployment automation script |

## Deployment Workflow

### 1. Deploy a new release

```bash
IMAGE_TAG=v1.3.0 ./scripts/devops/blue-green-deploy.sh deploy
```

The script:
1. Reads the active slot from the Service selector (e.g., `blue`)
2. Deploys the new image to the inactive slot (`green`)
3. Waits for rollout completion (`kubectl rollout status`)
4. Runs health checks against the green pods
5. If healthy → patches the Service selector to `slot: green`
6. If unhealthy → aborts, traffic stays on blue

### 2. Check status

```bash
./scripts/devops/blue-green-deploy.sh status
```

Output:
```
Active slot:    green
Inactive slot:  blue

  blue:
    Deployment: pixelated-empathy-blue
    Replicas:   2/2 ready
    Image:      pixelatedempathy/api:v1.2.3

  green ← ACTIVE:
    Deployment: pixelated-empathy-green
    Replicas:   2/2 ready
    Image:      pixelatedempathy/api:v1.3.0
```

### 3. Rollback

```bash
./scripts/devops/blue-green-deploy.sh rollback
```

Instantly switches traffic back to the previous slot. The previous
deployment must still have running pods (kept for 5-minute window).

## Health Checks

The deploy script uses a layered health check approach:

1. **Pod readiness**: All pods in the new deployment must be `Ready`
2. **Comprehensive script**: `scripts/devops/health-check-comprehensive.sh` if available
3. **HTTP probe**: Falls back to `curl http://localhost:4321/health` on each pod

## Rollback Window

The old deployment is kept running after a traffic switch for a 5-minute
rollback window (`ROLLBACK_WINDOW=300`). During this window:

- Rolling back is instant (just a Service selector patch)
- The old pods are still serving and healthy
- After the window, the old deployment can be scaled down manually

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `NAMESPACE` | `pixelated-empathy` | K8s namespace |
| `SERVICE_NAME` | `pixelated-empathy` | K8s service name |
| `IMAGE_TAG` | `latest` | Image tag to deploy |
| `HEALTH_CHECK_TIMEOUT` | `300` | Rollout wait timeout (seconds) |
| `ROLLBACK_WINDOW` | `300` | Seconds to keep old slot |

## Kustomize Integration

### Base (GCE)
```yaml
# k8s/base/kustomization.yaml
resources:
  - deployment-blue.yaml
  - deployment-green.yaml
  - service.yaml
```

### Civo
```yaml
# k8s/civo/kustomization.yaml
resources:
  - deployment-blue.yaml
  - deployment-green.yaml
  - service.yaml
images:
  - name: pixelatedempathy/api
    newName: pixelatedempathy/api
    newTag: staging
```

## Session Affinity

During traffic switchover, existing sessions may briefly hit the old
deployment before the Service selector update propagates. This is handled by:

- `terminationGracePeriodSeconds: 30` — graceful shutdown
- Sticky sessions via Traefik load balancer (configured in `docker/traefik/dynamic.yml`)
- Client-side retry for transient failures

## HPA Integration

The Horizontal Pod Autoscaler (`k8s/base/hpa.yaml`) targets the
`app: pixelated-empathy-api` label, which both blue and green deployments
share. HPA scales the active deployment automatically based on load.

## Related Issues

- [PIX-4106](https://linear.app/pixelated/issue/PIX-4106) — Blue-green deployment strategy
- [PIX-4107](https://linear.app/pixelated/issue/PIX-4107) — Automated rollback mechanism
- [PIX-4108](https://linear.app/pixelated/issue/PIX-4108) — Deployment runbook
