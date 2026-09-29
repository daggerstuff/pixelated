# AWS Cost Optimization Guide

This document outlines the systematic AWS cost optimization architecture and
operational procedures implemented for **Pixelated Empathy**.

---

## 1. Summary of Implemented Cost Cutting Measures

| Area                         | Inefficiency Identified                                                         | Implemented Change                                                                                                                               | Estimated Savings                                              |
| ---------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| **EKS Compute**              | 100% On-Demand `t3.medium` instances                                            | Switch default instance to `t3a.medium` (AMD, 10% lower cost) with mixed Spot instance policy (`price-capacity-optimized`)                       | **50%–70%** on scaled node compute                             |
| **Kubernetes Autoscaling**   | Static 2-replica deployments regardless of traffic                              | HorizontalPodAutoscaler (`infra/k8s/aws/hpa.yaml`) scaling from 1 to 4 replicas based on CPU & Memory metrics                                    | **30%–50%** pod compute reduction during off-peak hours        |
| **Agent Resource Tuning**    | Session/QA/Pipeline agent limits over-provisioned at 1 CPU / 1GiB               | Right-sized resource limits to `500m CPU / 512Mi Memory`                                                                                         | Eliminates resource contention and unnecessary node scale-outs |
| **ECS Fargate Services**     | 100% On-Demand Fargate tasks                                                    | Configured `FARGATE_SPOT` capacity provider strategy (`weight=3`)                                                                                | **Up to 70%** on ECS Fargate compute                           |
| **CloudWatch Log Groups**    | Log groups defaulting to infinite retention (`Never expire`)                    | Enforced 30-day retention policies via deployment scripts and automation                                                                         | **80%+** reduction in cumulative log storage fees              |
| **S3 Storage Tiering**       | All objects stored in `STANDARD` storage ($0.023/GB/month)                      | Defaulted `S3StorageProvider` to `INTELLIGENT_TIERING` with automated Infrequent Access ($0.0125/GB) and Instant Archive ($0.004/GB) transitions | **45%–80%** reduction on backup/media storage                  |
| **Idle Resource Governance** | Unattached EBS volumes and unassociated Elastic IPs accumulating hourly charges | Automated audit & remediation script (`scripts/devops/aws_cost_optimizer.py`)                                                                    | Immediate recovery of orphaned infrastructure costs            |

---

## 2. Infrastructure as Code Details

### EKS Cluster Configuration (`infra/aws/eksctl/pixelated-eks.yaml`)

```yaml
managedNodeGroups:
  - name: pixelated-apps
    instanceType: t3a.medium
    minSize: 1
    maxSize: 3
    desiredCapacity: 2
    volumeSize: 20
    volumeType: gp3
    instancesDistribution:
      onDemandBaseCapacity: 1
      onDemandPercentageAboveBaseCapacity: 20
      spotAllocationStrategy: price-capacity-optimized
      instanceTypes:
        - t3a.medium
        - t3.medium
        - t2.medium
```

- **Base On-Demand Stability**: 1 on-demand node is guaranteed for core system
  pods and baseline stability.
- **Spot Bursting**: Scaled workloads utilize Spot instances with
  `price-capacity-optimized` allocation across `t3a.medium`, `t3.medium`, and
  `t2.medium` pools to minimize interruption rates.
- **AMD t3a Pricing**: $0.0376/hr vs $0.0416/hr (10% cheaper per on-demand
  hour).

### Kubernetes Horizontal Pod Autoscaling (`infra/k8s/aws/hpa.yaml`)

- Scales pods dynamically between 1 and 4 replicas based on 75% CPU and 80%
  Memory thresholds.
- Includes a 300-second scale-down stabilization window to avoid replica
  flapping while freeing resources during low-load intervals.

---

## 3. Storage Optimization & Intelligent-Tiering

The S3 storage provider
(`apps/web/src/lib/security/backup/storage-providers/aws-s3.ts`) defaults all
`putObject` requests to `INTELLIGENT_TIERING`:

- **Frequent Access**: Standard performance for active objects.
- **Infrequent Access (after 30 days)**: Saves 45% ($0.0125/GB).
- **Archive Instant Access (after 90 days)**: Saves 82% ($0.004/GB) with
  sub-second retrieval.
- **No Retrieval Fees**: Avoids unexpected data egress/retrieval surcharges.

---

## 4. Automated Cost Optimizer Tool

Run the automated cost auditor from the repository root:

```bash
# Dry-run audit across the target region:
uv run python scripts/devops/aws_cost_optimizer.py --region us-west-2

# Apply automatic remediations (sets 30-day log retention, cleans up orphaned resources):
uv run python scripts/devops/aws_cost_optimizer.py --region us-west-2 --fix

# Export findings to JSON:
uv run python scripts/devops/aws_cost_optimizer.py --region us-west-2 --output-json cost-audit.json
```

### Running Unit Tests

```bash
uv run pytest tests/python/test_aws_cost_optimizer.py
```
