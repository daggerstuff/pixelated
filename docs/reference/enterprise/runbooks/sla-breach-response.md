---
title: SLA Breach Response Procedure
description:
  Comprehensive escalation paths, communication templates, remediation process,
  and on-call training for SLA breach response at Pixelated Empathy
---

<!-- markdownlint-disable MD025 MD013 MD036 -->

<div align="center">

# SLA Breach Response Procedure

**Enterprise Readiness Program — SLA-4**

Comprehensive incident response for SLA/SLO breaches: escalation paths,
communication templates, remediation workflow, postmortem process, and on-call
training program.

</div>

---

## 1. Purpose & Scope

This runbook defines the **end-to-end response procedure** when a Service-Level
Objective (SLO) or Service-Level Agreement (SLA) is breached or at imminent
risk. It covers:

- **Detection** through automated alerting and manual escalation
- **Escalation paths** from on-call engineer to executive leadership
- **Communication templates** for status page, customer email, Slack, and
  regulatory/HIPAA notifications
- **Remediation process** including root cause analysis and prevention
- **Postmortem process** with blameless review template
- **On-call training program** for ramp-up, shadowing, and drills
- **Breach credit processing** workflow with billing team

**In scope**: All 7 customer-facing services defined in the
[SLO Definitions runbook](./slo-definitions.md):

| Service       | SLO Target | SLA Tier Coverage            |
| ------------- | ---------- | ---------------------------- |
| pixelated-app | 99.9%      | All tiers                    |
| pixelated-ai  | 99.9%      | All tiers                    |
| PostgreSQL    | 99.95%     | All tiers (data persistence) |
| Redis         | 99.9%      | Pro+ (session/cache)         |
| Caddy         | 99.99%     | All tiers (edge)             |
| node-exporter | 99.5%      | Internal monitoring          |
| Foresight MCP | 99.9%      | Enterprise+ (memory service) |

**Out of scope**: Development/staging environment incidents, internal tooling
outages, scheduled maintenance (covered separately).

**Related documents**:

- [SLO Definitions & Error Budgets](./slo-definitions.md) — SLO targets, SLA
  commitments, error budget policy
- [SLO Monitoring & Burn Rate Alerts](../../../monitoring/slo-recording-rules.yml)
  — Prometheus recording rules and multi-window burn-rate alerts
- [DR RTO/RPO Targets](./dr-rto-rpo-targets.md) — Disaster recovery targets
- [Vendor Inventory](../vendor-inventory.md) — Third-party vendor SLAs and BAA
  requirements

---

## 2. Roles & Responsibilities

### 2.1 Incident Response Roles

| Role                      | Responsibility                                                                                       | Filled By                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **On-Call Engineer**      | First responder. Acknowledges, assesses, mitigates.                                                  | Rotating engineer (weekly)          |
| **Incident Commander**    | Coordinates response, makes go/no-go decisions, owns comms. Escalates as needed.                     | Senior engineer or tech lead        |
| **Communications Lead**   | Owns all external comms: status page, customer emails, social. Drafts and posts updates.             | IC delegate or dedicated comms role |
| **Scribe**                | Documents timeline, decisions, action items in real-time.                                            | On-call backup or IC delegate       |
| **Subject Matter Expert** | Deep expertise on affected service. Called in by IC.                                                 | Service owner                       |
| **Executive Sponsor**     | Escalated to for business-critical or customer-facing decisions (breach credits, public statements). | VP Engineering / CTO                |

### 2.2 On-Call Rotation

- **Primary on-call**: 1 engineer, 1-week rotation (Mon 10:00 UTC → Mon 10:00
  UTC)
- **Secondary on-call**: 1 engineer, same rotation, escalation backup
- **Schedule**: Managed in PagerDuty (rotation schedule
  `pixelated-empathy-primary`)
- **Handoff**: Monday 10:00 UTC standup (15 min). Outgoing on-call briefs
  incoming on: open incidents, error budget status, watch items.
- **Follow-the-sun**: Currently single-region (UTC). Future: AMER/EMEA/APAC
  rotation as team grows.

### 2.3 Escalation Authority

| Level | Role               | Can Trigger                                  |
| ----- | ------------------ | -------------------------------------------- |
| L1    | On-Call Engineer   | Mitigation, rollback, scale-up               |
| L2    | Incident Commander | Customer comms, service degradation announce |
| L3    | VP Engineering     | Breach credit approval, exec escalation      |
| L4    | CTO / CEO          | Public statement, contract renegotiation     |

---

## 3. Severity Classification

### 3.1 Operational Severity (from Alertmanager)

| Severity    | Definition                                               | Alertmanager Routing                           |
| ----------- | -------------------------------------------------------- | ---------------------------------------------- |
| `warning`   | SLO at risk — error budget burning > 50%                 | Slack #alerts + email, repeat 2h               |
| `critical`  | SLO violated — error budget exhausted or breach imminent | PagerDuty + email, repeat 30m                  |
| `emergency` | Multi-service outage or total platform down              | PagerDuty + Slack #alerts-critical, repeat 15m |

### 3.2 SLA Breach Tiers

An SLA breach is a **contractual** violation — the actual uptime, latency, or
error rate for the billing month has fallen below the customer's SLA tier:

| Breach Tier | Trigger                                                          | Customer Impact                                                                              |
| ----------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Tier A**  | SLO violated but SLA still met (error budget consumed)           | No contractual obligation. Internal postmortem only.                                         |
| **Tier B**  | SLA violated for Pro tier (uptime < 99.5% or p95 > 750ms)        | 10% breach credit. Status page + email.                                                      |
| **Tier C**  | SLA violated for Enterprise tier (uptime < 99.9% or p95 > 500ms) | 25% breach credit. Status page + direct email + postmortem.                                  |
| **Tier D**  | SLA violated for Enterprise+ HIPAA (uptime < 99.95%)             | 25% credit + incident review + HIPAA compliance notification (if PHI availability impacted). |

### 3.3 HIPAA-Specific Severity

If the breach involves **PHI availability, integrity, or confidentiality**:

- **HIPAA Breach (reportable)**: PHI was or may have been exposed to
  unauthorized parties. Requires HHS notification per
  [45 CFR 164.404](https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html):
  - **< 500 individuals**: Notify HHS within 60 days of discovery, annual log.
  - **≥ 500 individuals**: Notify HHS within 60 days, notify affected
    individuals within 60 days, notify media if > 500 in same state.
- **HIPAA Incident (non-reportable)**: PHI availability temporarily impacted but
  no unauthorized access. Document internally; notify customer compliance
  contact per BAA terms.

---

## 4. Escalation Paths

### 4.1 Standard Escalation Flow

```
Alert fires (PagerDuty)
    │
    ▼
On-Call Engineer (L1) — acknowledge within severity timeline
    │
    ├── Resolvable? ──► Mitigate, document, resolve
    │
    ├── Needs coordination? ──► Page Incident Commander (L2)
    │
    └── Needs SME? ──► Page Subject Matter Expert (service owner)
    │
    ▼
Incident Commander (L2) — assess scope, declare incident severity
    │
    ├── Customer comms needed? ──► Assign Comms Lead
    │
    ├── Breach credit likely? ──► Escalate to VP Engineering (L3)
    │
    └── Public statement needed? ──► Escalate to CTO/CEO (L4)
    │
    ▼
VP Engineering (L3) — approve breach credits, exec brief
    │
    └── Contract/legal impact? ──► Engage CTO/CEO (L4) + Legal
```

### 4.2 Escalation Timelines

| From → To | Trigger                                        | Max Time                             |
| --------- | ---------------------------------------------- | ------------------------------------ |
| L1 → L2   | Cannot mitigate within severity timeline       | 10 min (critical) / 30 min (warning) |
| L2 → L3   | SLA breach confirmed or breach credit required | 15 min                               |
| L3 → L4   | Public statement, legal, or contract impact    | 30 min                               |
| Any → SME | Service-specific expertise needed              | 10 min                               |

### 4.3 Manual Escalation

If automated alerts are **not firing** but a service degradation is observed:

1. Engineer observes degradation (dashboard, customer report, log anomaly).
2. Verify the issue is real (check Prometheus query, Grafana dashboard, recent
   deploys).
3. Page on-call via PagerDuty manually:
   `pd trigger --service pixelated-empathy-primary --description "<brief>"`.
4. If PagerDuty is down, call on-call engineer directly (phone numbers in
   `#on-call` Slack channel pinned message).
5. If on-call is unreachable after 5 min, escalate to secondary on-call.
6. If both unreachable after 10 min, escalate to engineering manager.

### 4.4 Customer-Initiated Escalation

When a customer reports an issue:

1. **Acknowledge** within the customer's support response SLA:
   - Free: best-effort (target 24h)
   - Pro: 4 business hours
   - Enterprise: 1 hour 24/7
   - Enterprise+ HIPAA: 1 hour 24/7 + dedicated SE
2. **Triage**: Determine if it's an SLA-relevant issue or customer-side.
3. **Link**: If SLA-relevant, create a Linear issue tagged `incident` and link
   to the customer's account in the CRM.
4. **Communicate**: Provide updates at the cadence matching the customer's tier
   (see Section 6).

---

## 5. Detection & Alerting

### 5.1 Automated Detection

Alerts fire from Prometheus rules and route through Alertmanager:

| Alert Source          | File                                        | Covers                                                   |
| --------------------- | ------------------------------------------- | -------------------------------------------------------- |
| SLO burn rate alerts  | `monitoring/slo-burn-rate-alerts.yml`       | Error budget burn, latency violations, budget exhaustion |
| Application alerts    | `monitoring/alerts/application.yml`         | App down, error rate, latency, DB/Redis down             |
| Infrastructure alerts | `monitoring/alert_rules.yml`                | Disk, memory, CPU, DB connections                        |
| Performance alerts    | `monitoring/alerts/performance-alerts.yaml` | Pixel latency p95, error rate                            |
| Safety alerts         | `monitoring/alerts/safety-alerts.yaml`      | Emotional analysis errors, AI safety                     |
| Launch alerts         | `monitoring/alerts/launch-alerts.yaml`      | Launch-specific monitoring                               |

**Alertmanager routing** (from `alertmanager.yml`):

| Severity    | Receivers                          | Repeat | Group Wait |
| ----------- | ---------------------------------- | ------ | ---------- |
| `critical`  | PagerDuty + email (critical@)      | 30 min | 5s         |
| `warning`   | Slack #alerts + email (warnings@)  | 2h     | 30s        |
| `emergency` | PagerDuty + Slack #alerts-critical | 15 min | 0s         |

### 5.2 Proactive Monitoring

On-call engineer monitors these dashboards during shift:

- **Grafana SLO Dashboard** (`slo-monitoring-dashboard.json`): error budget
  remaining, burn rates, availability, latency per service.
- **Pixelated Empathy Overview** (`pixelated-empathy-overview.json`): overall
  platform health.
- **Performance Dashboard** (`performance-dashboard.json`): request rates,
  latency histograms, error rates.
- **Safety Monitoring** (`safety-monitoring-dashboard.json`): AI safety,
  emotional analysis errors.

**Proactive checks** (every 2h during on-call shift):

1. Error budget remaining > 25% for all services.
2. No burn rate alerts in `firing` state.
3. Grafana overview: all green.
4. Recent deploy in last 24h? Check for correlated metric changes.

### 5.3 Synthetic Monitoring (Planned)

| Check         | Target                                          | Frequency | Owner    |
| ------------- | ----------------------------------------------- | --------- | -------- |
| Homepage load | `GET https://app.pixelatedempathy.com/`         | 1 min     | Platform |
| API health    | `GET https://api.pixelatedempathy.com/health`   | 30s       | Platform |
| AI inference  | `POST /api/v1/emotion-analysis` w/ test payload | 5 min     | AI       |
| Auth flow     | Login → dashboard redirect                      | 10 min    | Platform |
| DB write      | Insert test row → verify                        | 5 min     | Platform |

Synthetic checks create alerts when response > p95 SLO target or status != 2xx.
Implementation tracked as follow-up action SLA-4.1.

---

## 6. Communication Templates

### 6.1 Status Page Updates

Status page URL: `status.pixelatedempathy.com` (to be created — follow-up
SLA-4.2). All updates posted here first, then cross-posted to Twitter
`@pixelatedempathy` and Slack `#status`.

**Template — Investigating**:

```markdown
## [INVESTIGATING] {{ Service Name }} degradation

**Time**: {{ timestamp UTC }} **Severity**: {{ warning | critical | emergency }}
**Impact**: {{ affected feature(s) / customer experience }}

We are investigating reports of {{ issue description }}. Our on-call team has
been paged and is assessing the situation.

**Next update**: Within 15 minutes (critical) / 30 minutes (warning).
```

**Template — Identified**:

```markdown
## [IDENTIFIED] {{ Service Name }} degradation

**Time**: {{ timestamp UTC }} **Severity**: {{ severity }} **Impact**:
{{ affected feature(s) }}

We have identified the cause: {{ brief root cause }}. We are applying
{{ mitigation action }}. Estimated resolution: {{ ETA or "unknown" }}.

**Next update**: Within 30 minutes or upon resolution.
```

**Template — Resolved**:

```markdown
## [RESOLVED] {{ Service Name }} degradation

**Time**: {{ timestamp UTC }} **Duration**: {{ start - end }} **Severity**:
{{ severity }} **Impact**: {{ affected feature(s) }}

The issue has been resolved. {{ brief resolution description }}. All services
are operating normally.

A postmortem will be published within {{ 48h | 24h }} at {{ postmortem URL }}.
```

**Template — Maintenance (scheduled)**:

```markdown
## [SCHEDULED] {{ Service }} maintenance

**Window**: {{ start UTC }} – {{ end UTC }} **Impact**:
{{ brief downtime / degraded performance expected }}

Scheduled maintenance is planned for {{ purpose }}. This window was announced ≥
72h in advance per our SLA terms. Service may be intermittently unavailable
during this window.
```

### 6.2 Customer Email Templates

**Enterprise / Enterprise+ — SLA Breach Notification**:

```
Subject: [SLA BREACH] {{ Service }} — Action Required

Dear {{ customer.name }},

We are writing to inform you of a Service Level Agreement (SLA) breach
affecting {{ service name }} for your account {{ account ID }}.

Incident details:
  - Incident ID: {{ INC-XXXX }}
  - Start time: {{ UTC timestamp }}
  - End time: {{ UTC timestamp }}
  - Duration: {{ hours minutes }}
  - Services affected: {{ list }}
  - SLA tier: {{ Enterprise | Enterprise+ HIPAA }}
  - SLA commitment: {{ 99.9% uptime / 500ms p95 }}
  - Actual performance: {{ measured value }}

Impact on your account:
  {{ description of customer-visible impact }}

Breach credit:
  Per your SLA terms, a 25% credit will be applied to your next billing
  cycle. Your account manager will confirm the credit within 5 business days.

Root cause:
  {{ brief technical summary — no PHI, no sensitive internal details }}

Remediation:
  {{ what we did to fix it + what we're doing to prevent recurrence }}

Postmortem:
  A detailed postmortem is available at {{ URL }}.
  {{ For Enterprise+ HIPAA: A written incident review will be provided
  to your compliance team within 5 business days. }}

We sincerely apologize for the disruption. For questions, contact your
account manager {{ name }} at {{ email }} or reply to this email.

Sincerely,
{{ On-call engineer name }}
Pixelated Empathy Engineering
```

**Pro Tier — SLA Breach Notification**:

```
Subject: [SLA BREACH] {{ Service }} — Credit Applied

Hello {{ customer.name }},

We experienced a service degradation on {{ date }} affecting {{ service }}.

Incident: {{ INC-XXXX }}
Duration: {{ hours }}
Impact: {{ brief }}

Per your Pro SLA terms, a 10% credit has been applied to your next
invoice. The credit will appear on your {{ month }} billing statement.

Root cause: {{ brief }}
Remediation: {{ brief }}

Status page: {{ URL }}
Questions? Contact <support@pixelatedempathy.com>

Pixelated Empathy Team
```

### 6.3 Internal Slack Templates

**#incidents — New Incident**:

```
🚨 INCIDENT DECLARED: {{ INC-XXXX }}
Severity: {{ critical }}
Service: {{ service name }}
IC: {{ @oncall }}
SME: {{ @serviceowner }}
Scribe: {{ @backup }}

Impact: {{ description }}
Started: {{ timestamp }}

Bridge: {{ Zoom/Meet link }}
Dashboard: {{ Grafana link }}
Postmortem doc: {{ Google Doc link }}

All updates in this thread. Do NOT DM the IC.
```

**#incidents — Mitigation Update**:

```
📊 UPDATE {{ INC-XXXX }} — {{ timestamp }}
Status: {{ mitigating | monitoring | resolved }}
Action: {{ what was done }}
SLOs: {{ service }} error budget now at {{ X }}%
Next update: {{ time or "upon resolution" }}
```

**#incidents — Resolved**:

```
✅ RESOLVED {{ INC-XXXX }}
Duration: {{ hours minutes }}
Final severity: {{ severity }}
Root cause: {{ one line }}
Error budget consumed: {{ X }}% of monthly budget
Postmortem due: {{ 48h | 24h from now }}
Postmortem owner: {{ @name }}
```

### 6.4 Executive Brief Template

For L3/L4 escalations (breach credit, public statement, legal):

```
EXEC BRIEF — {{ INC-XXXX }}
{{ timestamp }}

Severity: {{ critical | emergency }}
Duration: {{ hours }}
Services: {{ list }}
Customers impacted: {{ count + tier breakdown }}

SLA impact:
  - {{ tier }}: {{ SLA target }} vs {{ actual }}
  - Breach credits likely: {{ $ amount estimate }}

Root cause (1-2 sentences): {{ summary }}

Current status: {{ mitigating | resolved | investigating }}

Customer comms: {{ status page updated at X, emails sent to Y customers }}

Public risk: {{ low | medium | high }} — {{ reason }}

Requested action: {{ approve breach credits | approve public statement | engage legal }}

Incident Commander: {{ name }}
```

### 6.5 HIPAA / Regulatory Communication

If the breach involves PHI (Tier D or HIPAA Breach):

1. **Internal notification** (within 1h of discovery):
   - Compliance Officer: <compliance@pixelatedempathy.com>
   - VP Engineering
   - Legal counsel (external, via VP Eng)
   - Privacy Officer (if designated)

2. **Customer compliance contact** (per BAA terms, within 24h):
   - Direct email to customer's compliance officer (not general support).
   - Include: incident summary, PHI scope (which data elements, how many
     records), containment status, remediation steps.

3. **HHS notification** (if reportable breach):
   - **< 500 individuals**: Log in annual breach report (due March 1).
   - **≥ 500 individuals**: Notify HHS Secretary within 60 days via
     [HHS Breach Portal](https://ocrportal.hhs.gov/ocr/breach/wizard_breach.jsf).
     Notify affected individuals within 60 days. Notify media if > 500 residents
     in same state.

4. **Documentation**: All HIPAA breach communications logged in
   `docs/compliance/breach-log/` (to be created — follow-up SLA-4.3).

---

## 7. Response Procedure

### 7.1 Step-by-Step Response

| Step | Action                                                                              | Owner         | Timeline                                  |
| ---- | ----------------------------------------------------------------------------------- | ------------- | ----------------------------------------- |
| 1    | **Acknowledge** alert in PagerDuty                                                  | On-Call (L1)  | Warning 30m / Critical 5m / Emergency 2m  |
| 2    | **Assess** scope: services affected, customer count, tier impact                    | On-Call       | Within 10m of ack                         |
| 3    | **Declare** incident if SLO violation confirmed or imminent                         | On-Call → IC  | Within 15m                                |
| 4    | **Assign** IC, Comms Lead, Scribe, SME                                              | IC            | Immediately                               |
| 5    | **Mitigate**: Apply service runbook or general response (rollback, scale, failover) | On-Call + SME | Warning 2h / Critical 30m / Emergency 15m |
| 6    | **Communicate** (see templates): status page, customer email, Slack                 | Comms Lead    | Per severity timeline                     |
| 7    | **Monitor** mitigation effectiveness; adjust if not improving                       | On-Call       | Continuous                                |
| 8    | **Resolve** when SLO indicators return to target for 15 min                         | IC            | Confirm with SME                          |
| 9    | **Post-resolve comms**: status page resolved update, customer follow-up             | Comms Lead    | Within 30m of resolution                  |
| 10   | **Postmortem** scheduled (48h / 24h for emergency)                                  | IC → Scribe   | Within 2h of resolution                   |

### 7.2 General Mitigation Playbook

When no service-specific runbook exists, follow this general order:

1. **Check recent deploys** — `git log --oneline -20` in affected service repo.
   If a deploy in the last 2h correlates with the issue, **roll back**:
   - App: `pnpm run deploy:rollback` (or revert + redeploy)
   - AI: Revert container image: `kubectl rollout undo deployment/pixelated-ai`
   - Infra: revert Terraform apply or Helm rollback

2. **Scale horizontally** if load-related:
   - K8s: `kubectl scale deployment {{ svc }} --replicas={{ N*2 }}`
   - HPA: verify HPA is functioning (check `kubectl get hpa`)

3. **Failover** if a single instance/zone is degraded:
   - Database: promote replica (see DR runbook Tier 1 procedure)
   - Redis: switch to replica if available
   - App: traffic to healthy pods via Caddy health checks

4. **Circuit break**: if a downstream dependency is causing cascading failures,
   enable circuit breaker to shed load:
   - AI service: disable non-critical inference paths, keep health endpoint
   - Vector store: fall back to cached embeddings
   - External API: timeout + fallback to cached response

5. **Rate limit**: if specific customers/tenants are causing load:
   - Enable @upstash/ratelimit emergency throttle
   - Caddy: add temporary rate limit rule

### 7.3 Service-Specific Runbooks (To Be Created)

Each customer-facing service needs a dedicated runbook with:

- Common failure modes
- Diagnostic commands
- Mitigation steps specific to the service
- Recovery verification

| Service       | Runbook Path                                    | Status         |
| ------------- | ----------------------------------------------- | -------------- |
| pixelated-app | `docs/enterprise/runbooks/svc-pixelated-app.md` | TODO (SLA-4.4) |
| pixelated-ai  | `docs/enterprise/runbooks/svc-pixelated-ai.md`  | TODO (SLA-4.5) |
| PostgreSQL    | `docs/enterprise/runbooks/svc-postgresql.md`    | TODO (SLA-4.6) |
| Redis         | `docs/enterprise/runbooks/svc-redis.md`         | TODO (SLA-4.7) |
| Caddy         | `docs/enterprise/runbooks/svc-caddy.md`         | TODO (SLA-4.8) |
| Foresight MCP | `docs/enterprise/runbooks/svc-foresight-mcp.md` | TODO (SLA-4.9) |

---

## 8. Postmortem Process

### 8.1 Postmortem Requirements

| Severity            | Postmortem Required                       | Due By              | Owner                   |
| ------------------- | ----------------------------------------- | ------------------- | ----------------------- |
| Warning (Tier A)    | Optional — if error budget > 50% consumed | 1 week              | Service owner           |
| Critical (Tier B/C) | **Required**                              | 48h from resolution | IC assigns              |
| Emergency (Tier D)  | **Required** + exec review                | 24h from resolution | IC assigns              |
| HIPAA Breach        | **Required** + compliance review          | 24h from resolution | IC + Compliance Officer |

### 8.2 Postmortem Template

```markdown
# Postmortem: {{ INC-XXXX }} — {{ title }}

**Date**: {{ resolution date }} **Severity**: {{ critical | emergency }}
**Duration**: {{ start → end (UTC) }} **Services affected**: {{ list }}
**Incident Commander**: {{ name }} **Scribe**: {{ name }}

## Summary

{{ 2-3 sentence summary of what happened and customer impact }}

## Timeline (all times UTC)

| Time        | Event                              |
| ----------- | ---------------------------------- |
| {{ T+0 }}   | Alert fired: {{ alert name }}      |
| {{ T+2m }}  | On-call acknowledged               |
| {{ T+5m }}  | IC declared, bridge opened         |
| {{ T+10m }} | Root cause identified: {{ cause }} |
| {{ T+30m }} | Mitigation applied: {{ action }}   |
| {{ T+45m }} | SLOs returned to target            |
| {{ T+50m }} | Incident resolved                  |

## Root Cause Analysis

### What happened

{{ technical description }}

### Why it happened

{{ contributing factors: deploy, config change, dependency, load spike, etc. }}

### Why it wasn't caught earlier

{{ detection gaps, missing alert, test coverage }}

## Impact

- **Customers affected**: {{ count + tier breakdown }}
- **SLA impact**: {{ tier }} SLA {{ met | breached }} (actual: {{ value }})
- **Error budget consumed**: {{ X }}% of monthly budget
- **Breach credits**: {{ $ amount if applicable }}
- **HIPAA impact**: {{ none | reportable | non-reportable }}

## What went well

- {{ positive observation 1 }}
- {{ positive observation 2 }}

## What went poorly

- {{ negative observation 1 }}
- {{ negative observation 2 }}

## Action items

| ID   | Action       | Owner       | Priority | Due        | Status |
| ---- | ------------ | ----------- | -------- | ---------- | ------ |
| AI-1 | {{ action }} | {{ @name }} | P0/P1/P2 | {{ date }} | TODO   |
| AI-2 | {{ action }} | {{ @name }} | P1       | {{ date }} | TODO   |

## Lessons learned

{{ insights for future prevention, detection, and response }}
```

### 8.3 Blameless Postmortem Principles

- **Focus on systems, not people.** The goal is to improve the system, not
  assign blame.
- **Assume good intent.** Everyone made decisions with the information available
  at the time.
- **Identify systemic gaps.** Why did the system allow this to happen? What
  guardrails were missing?
- **Action items must be specific and tracked.** Every action item has an owner,
  due date, and priority. Track in Linear with `postmortem` label.
- **Share widely.** Postmortems are published internally (Google Doc +
  `#postmortems` Slack). Customer-facing summaries posted to status page.

### 8.4 Postmortem Review

- **Internal review**: IC walks through postmortem at next engineering all-hands
  (weekly Thursday).
- **Action item tracking**: Scribe owns the action item tracker. Weekly check-in
  until all P0/P1 items are closed.
- **Trend analysis**: Quarterly review of all postmortems to identify recurring
  patterns (see Section 12).

---

## 9. Breach Credit Processing

### 9.1 Workflow

```
Postmortem complete
    │
    ▼
IC confirms SLA breach (compare actual vs SLA tier commitment)
    │
    ▼
IC calculates breach credit:
  - Pro: 10% of monthly fee
  - Enterprise / Enterprise+: 25% of monthly fee
  - Enterprise+ HIPAA: 25% + incident review document
    │
    ▼
VP Engineering (L3) approves credit
    │
    ▼
Billing team applies credit to next invoice cycle
    │
    ▼
Account manager notifies customer of credit application
    │
    ▼
Document in CRM (Salesforce/HubSpot) under account
```

### 9.2 Breach Credit Matrix

| Customer Tier     | SLA Breach                    | Credit          | Additional                                                                    |
| ----------------- | ----------------------------- | --------------- | ----------------------------------------------------------------------------- |
| Free              | N/A (no SLA)                  | None            | —                                                                             |
| Pro               | Uptime < 99.5% or p95 > 750ms | 10% monthly fee | Status page                                                                   |
| Enterprise        | Uptime < 99.9% or p95 > 500ms | 25% monthly fee | Status page + direct email + postmortem                                       |
| Enterprise+ HIPAA | Uptime < 99.95%               | 25% monthly fee | All above + written incident review to compliance team within 5 business days |

### 9.3 Multi-Breach Escalation

If a customer experiences **3+ SLA breaches in a single billing month**:

1. VP Engineering reviews account for systemic issues.
2. CTO briefed on pattern.
3. Customer offered: contract renegotiation, dedicated SE, or service credit cap
   waiver (per contract terms).
4. Root cause analysis across all breaches to identify common pattern.

---

## 10. On-Call Training Program

### 10.1 On-Call Ramp-Up (New Engineer)

| Week    | Activity                                                   | Outcome                      |
| ------- | ---------------------------------------------------------- | ---------------------------- |
| 1       | Read this runbook + SLO definitions runbook + DR runbook   | Understand SLO/SLA framework |
| 2       | Shadow current on-call (observe PagerDuty, attend handoff) | See real alerts and response |
| 3       | Shadow + take first acknowledgments under supervision      | Practice ack + assess        |
| 4       | Primary on-call with secondary as backup                   | First solo rotation          |
| Ongoing | Quarterly refresher + drill participation                  | Maintain readiness           |

### 10.2 On-Call Readiness Checklist

Before going on-call, engineer must complete:

- [ ] Read this runbook end-to-end
- [ ] Read [SLO Definitions](./slo-definitions.md) runbook
- [ ] Read [DR RTO/RPO Targets](./dr-rto-rpo-targets.md) runbook
- [ ] Review all Grafana dashboards (SLO, overview, performance, safety)
- [ ] Know PagerDuty escalation chain (primary → secondary → manager)
- [ ] Know Slack channels: #on-call, #incidents, #alerts, #alerts-critical
- [ ] Have access to: K8s cluster, Prometheus, Grafana, Alertmanager, Caddy
      admin
- [ ] Practice: trigger a test alert in staging and walk through response
- [ ] Review last 3 postmortems for lessons learned

### 10.3 Quarterly Drills

| Quarter | Drill Type | Scenario                                      | Participants         |
| ------- | ---------- | --------------------------------------------- | -------------------- |
| Q1      | Tabletop   | PostgreSQL primary failure — promote replica  | On-call + DB SME     |
| Q2      | Game Day   | Full platform outage — multi-service recovery | All on-call rotation |
| Q3      | Tabletop   | AI service degraded — model inference timeout | On-call + AI SME     |
| Q4      | Game Day   | Region failure — DR failover to standby       | On-call + infra team |

**Drill process**:

1. **Plan** (2 weeks prior): Define scenario, success criteria, observers.
2. **Pre-brief** (1 day prior): Confirm participants, review runbooks.
3. **Execute** (drill day): Simulate failure in staging, walk through response.
   Observers score against checklist.
4. **Debrief** (immediately after): What worked, what didn't, action items.
5. **Document**: Drill report filed in `docs/enterprise/runbooks/drills/` (to be
   created — follow-up SLA-4.10).

### 10.4 Alert Tuning Feedback Loop

On-call engineers own alert quality. After each rotation:

1. **Review** all alerts that fired during the shift.
2. **Flag** noisy alerts (fired but no action needed) → create Linear issue
   tagged `alert-tuning` to adjust threshold or add inhibition rule.
3. **Flag** missing alerts (issue observed but no alert fired) → create Linear
   issue tagged `alert-gap` to add new alert rule.
4. **Submit** alert tuning report to `#on-call` Slack channel weekly.

---

## 11. Metrics & Improvement

### 11.1 Incident Response Metrics

| Metric                          | Target                        | Measured By               |
| ------------------------------- | ----------------------------- | ------------------------- |
| MTTA (Mean Time to Acknowledge) | Critical < 5m, Warning < 30m  | PagerDuty analytics       |
| MTTM (Mean Time to Mitigate)    | Critical < 30m, Warning < 2h  | Incident timestamps       |
| MTTR (Mean Time to Resolve)     | Critical < 2h, Emergency < 1h | Incident timestamps       |
| Postmortem on-time completion   | 100% within 48h/24h           | Postmortem tracker        |
| Action item closure rate        | > 80% P0/P1 within 30 days    | Linear `postmortem` label |
| False positive alert rate       | < 10% of critical alerts      | Alert review per rotation |

### 11.2 SLA Compliance Metrics

| Metric                          | Target                      | Source                           |
| ------------------------------- | --------------------------- | -------------------------------- |
| Monthly SLA compliance          | 100% of tiers meet SLA      | Prometheus SLO recording rules   |
| Error budget consumption        | < 50% per service per month | `slo:error_budget_remaining:pct` |
| Breach count per quarter        | 0 Tier C/D breaches         | Incident log                     |
| Breach credit total per quarter | < ${{ threshold }}          | Billing system                   |

### 11.3 Quarterly Review

Each quarter, the IC rotation lead presents to engineering:

1. **Incident summary**: count by severity, services most affected, MTTR trend.
2. **SLA compliance**: per-tier uptime/latency, breach credits issued.
3. **Postmortem action items**: closure rate, overdue items, recurring patterns.
4. **Alert health**: false positive rate, noisy alerts tuned, gaps filled.
5. **Drill results**: Q1-Q4 drill outcomes, readiness score.
6. **Recommendations**: SLO target adjustments (RFC required), runbook updates,
   training improvements.

---

## 12. Follow-Up Action Items

| ID       | Action                                                            | Priority | Owner       | Due     |
| -------- | ----------------------------------------------------------------- | -------- | ----------- | ------- |
| SLA-4.1  | Implement synthetic monitoring checks (5 checks)                  | P1       | Platform    | Q1 2027 |
| SLA-4.2  | Create public status page (status.pixelatedempathy.com)           | P1       | Platform    | Q1 2027 |
| SLA-4.3  | Create HIPAA breach log directory (docs/compliance/breach-log/)   | P0       | Compliance  | 2 weeks |
| SLA-4.4  | Create service runbook: pixelated-app                             | P1       | App team    | Q1 2027 |
| SLA-4.5  | Create service runbook: pixelated-ai                              | P1       | AI team     | Q1 2027 |
| SLA-4.6  | Create service runbook: PostgreSQL                                | P1       | DBA         | Q1 2027 |
| SLA-4.7  | Create service runbook: Redis                                     | P2       | Platform    | Q2 2027 |
| SLA-4.8  | Create service runbook: Caddy                                     | P2       | Platform    | Q2 2027 |
| SLA-4.9  | Create service runbook: Foresight MCP                             | P2       | Memory team | Q2 2027 |
| SLA-4.10 | Create drills directory and Q1 drill report template              | P2       | IC lead     | Q1 2027 |
| SLA-4.11 | Configure PagerDuty rotation schedule (pixelated-empathy-primary) | P0       | Eng ops     | 1 week  |
| SLA-4.12 | Document on-call handoff runbook (Mon 10:00 UTC)                  | P1       | IC lead     | 2 weeks |

---

## 13. Glossary

| Term              | Definition                                                                   |
| ----------------- | ---------------------------------------------------------------------------- |
| **MTTA**          | Mean Time to Acknowledge — time from alert fire to on-call ack               |
| **MTTM**          | Mean Time to Mitigate — time from ack to initial mitigation applied          |
| **MTTR**          | Mean Time to Resolve — time from alert fire to incident resolved             |
| **IC**            | Incident Commander — coordinates response, owns comms and decisions          |
| **SME**           | Subject Matter Expert — deep expertise on affected service                   |
| **SLO**           | Service-Level Objective — internal target (e.g., 99.9% uptime)               |
| **SLA**           | Service-Level Agreement — contractual commitment to customer                 |
| **Error budget**  | Allowed unavailability before SLO is violated (e.g., 43 min/month for 99.9%) |
| **Breach credit** | Service credit applied when SLA is violated (10% Pro, 25% Enterprise)        |
| **BAA**           | Business Associate Agreement — HIPAA contract with vendors handling PHI      |
| **Postmortem**    | Blameless written review of an incident, published within 48h/24h            |
| **Game Day**      | Simulated failure exercise in staging to test response readiness             |
| **Tabletop**      | Discussion-based drill — walk through scenario without actual failure        |
| **PagerDuty**     | On-call alerting and escalation platform                                     |
| **Alertmanager**  | Prometheus alert routing to PagerDuty/Slack/Email                            |
| **Status page**   | Public page showing current service status (status.pixelatedempathy.com)     |

---

## 14. References

### Internal Documents

- [SLO Definitions & Error Budgets](./slo-definitions.md) — PIX-4144
- [SLO Monitoring & Burn Rate Alerts](../../../monitoring/slo-recording-rules.yml)
  — PIX-4145
- [DR RTO/RPO Targets](./dr-rto-rpo-targets.md) — PIX-4132
- [Vendor Inventory](../vendor-inventory.md) — PIX-4151
- [HIPAA Compliance](../../compliance/hipaa.mdx)
- [Security Policy](../../compliance/security.mdx)

### Monitoring Configuration

- `monitoring/prometheus.yml` — scrape configs and rule files
- `monitoring/alertmanager.yml` — alert routing (PagerDuty/Slack/Email)
- `monitoring/slo-recording-rules.yml` — SLO SLI recording rules
- `monitoring/slo-burn-rate-alerts.yml` — multi-window burn rate alerts
- `monitoring/alert_rules.yml` — infrastructure alert rules
- `monitoring/alerts/application.yml` — application alert rules
- `monitoring/dashboards/slo-monitoring-dashboard.json` — Grafana SLO dashboard

### External References

- [Google SRE Workbook — Incident Response](https://sre.google/workbook/incident-response/)
- [Google SRE Workbook — Postmortems](https://sre.google/workbook/postmortems/)
- [HHS Breach Notification Rule (45 CFR 164.400-414)](https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html)
- [PagerDuty Incident Response documentation](https://response.pagerduty.com/)

### Linear

- [PIX-4147 — SLA-4: Create SLA Breach Response Procedure](https://linear.app/pixelated/issue/PIX-4147/sla-4-create-sla-breach-response-procedure)
- [PIX-4127 — Parent: SLA/SLO Definitions & Error Budgets](https://linear.app/pixelated/issue/PIX-4127)
- [GitHub #5082](https://github.com/daggerstuff/pixelated/issues/5082)
