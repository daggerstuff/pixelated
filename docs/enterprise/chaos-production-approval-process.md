# Production Chaos Engineering Approval Process

This document defines the approval workflow for running chaos experiments in
production environments.

## Approval Levels

### Level 1: Staging (No Approval Required)

- **Environment**: staging
- **Experiments**: All chaos types
- **Duration**: Up to 10 minutes
- **Approval**: None (automated via CI/CD)
- **Notification**: Slack #chaos-experiments channel

### Level 2: Production - Low Risk (Team Lead Approval)

- **Environment**: production
- **Experiments**: PodChaos (pod-kill, pod-failure)
- **Duration**: Up to 5 minutes
- **Approval**: Team Lead (on-call)
- **Notification**: Slack #chaos-experiments + #production-alerts
- **Requirements**:
  - Minimum 3 replicas running
  - HPA configured with minReplicas >= 2
  - No active incidents
  - Business hours only (9am-5pm local)

### Level 3: Production - Medium Risk (Engineering Manager Approval)

- **Environment**: production
- **Experiments**: NetworkChaos (latency, partition)
- **Duration**: Up to 3 minutes
- **Approval**: Engineering Manager
- **Notification**: Slack #chaos-experiments + #production-alerts + PagerDuty
- **Requirements**:
  - All Level 2 requirements
  - Database excluded from network chaos
  - External API endpoints excluded
  - Pre-approved maintenance window
  - Rollback plan documented

### Level 4: Production - High Risk (VP Engineering Approval)

- **Environment**: production
- **Experiments**: HTTPChaos, IOChaos, StressChaos
- **Duration**: Up to 1 minute
- **Approval**: VP Engineering + CTO
- **Notification**: All stakeholders + executive team
- **Requirements**:
  - All Level 3 requirements
  - Customer communication plan
  - Legal/compliance review (if PHI data at risk)
  - Full rollback procedure tested in staging
  - Post-incident review scheduled

## Approval Workflow

### Step 1: Experiment Proposal

Create a proposal document with:

- Experiment type and target
- Expected duration
- Risk assessment (Level 1-4)
- Rollback plan
- Success criteria
- Monitoring plan

### Step 2: Peer Review

- Submit proposal to #chaos-experiments Slack channel
- Minimum 2 peer reviews required
- Address all feedback before proceeding

### Step 3: Approval Chain

- Route to appropriate approver based on risk level
- Approver reviews proposal and rollback plan
- Approver confirms no active incidents
- Approver signs off via email or Slack thread

### Step 4: Pre-Flight Checks

- Verify minimum replica count
- Verify HPA configuration
- Verify monitoring dashboards ready
- Verify rollback scripts tested
- Notify on-call team

### Step 5: Execute Experiment

- Run experiment during approved window
- Monitor all dashboards continuously
- Have rollback scripts ready
- Document all observations

### Step 6: Post-Experiment

- Generate experiment report
- Share findings with team
- File follow-up issues if needed
- Update runbooks with learnings

## Emergency Stop Procedures

### Immediate Stop Triggers

- Error rate > 5% for > 30 seconds
- Latency p99 > 5s for > 30 seconds
- Pod restart loop detected
- Customer-reported issues
- On-call engineer override

### Stop Commands

```bash
# Stop all chaos experiments in namespace
kubectl delete podchaos,networkchaos,httpchaos,iochaos -n pixelated-empathy --all

# Stop specific experiment
kubectl delete podchaos <experiment-name> -n pixelated-empathy

# Emergency namespace isolation (last resort)
kubectl label namespace pixelated-empathy chaos-mesh.org/inject=disabled
```

## Audit Trail

All production experiments must log:

- Approver name and timestamp
- Experiment start/end times
- All metrics during experiment
- Rollback actions taken (if any)
- Post-incident review date

Logs stored in: `.agent/internal/chaos-results/production/`

## Quarterly Review

Chaos engineering program reviewed quarterly:

- Experiment success rate
- Resilience improvements made
- Incidents prevented
- Team confidence metrics
- Process improvements needed

Review owners: Engineering Manager + SRE Lead
