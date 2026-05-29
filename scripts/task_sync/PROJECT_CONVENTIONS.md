# Per-Project Sync Conventions

*Defines label taxonomies, status workflows, and required fields per Linear project.*

## Convention Structure

Each project entry defines:
- **Status workflow**: allowed states and transitions
- **Label taxonomy**: required and optional labels
- **Priority scale**: allowed priority levels
- **Required fields**: minimum metadata for sync
- **Provider routing**: which downstream providers to sync to

---

## 1. CI Federation & Release Readiness
- **Status**: Done, Todo, Canceled, Backlog
- **Labels**: `release`, `ci`, `deploy`, `infra`, `security`
- **Priority**: P0 (urgent) — P4 (none), P2 default
- **Fields**: assignee, milestone, due-date
- **Sync → ADHD**: ✅ Yes (42 of 59 mapped)

## 2. Foresight Memory Architecture
- **Status**: Done, Todo, Duplicate, In Progress, Backlog
- **Labels**: `memory`, `agent`, `context`, `embedding`, `retrieval`
- **Priority**: P0–P4, P2 default
- **Fields**: assignee, specification doc
- **Sync → ADHD**: ✅ Yes (39 of 59 mapped)

## 3. Data Governance & Compliance
- **Status**: Done, Backlog, Todo
- **Labels**: `governance`, `compliance`, `audit`, `hipaa`, `data`
- **Priority**: P1–P4 (no P0), P2 default
- **Fields**: owner, regulation-reference
- **Sync → ADHD**: ✅ Yes (24 of 29 mapped)

## 4. Training Pipeline Improvements
- **Status**: Done, Backlog, In Progress, Todo
- **Labels**: `training`, `pipeline`, `model`, `etl`, `data`
- **Priority**: P0–P4, P3 default
- **Fields**: assignee, training-run-ref
- **Sync → ADHD**: ❌ **None mapped** — needs bulk creation

## 5. Platform Foundations & Operations
- **Status**: Done, Duplicate, In Progress, Backlog
- **Labels**: `platform`, `ops`, `infra`, `monitoring`, `reliability`
- **Priority**: P0–P4, P2 default
- **Fields**: assignee, runbook-link
- **Sync → ADHD**: ✅ Yes (20 of 25 mapped)

## 6. Modern Dataset Project
- **Status**: Done, Canceled, Todo
- **Labels**: `dataset`, `benchmark`, `eval`, `data`, `research`
- **Priority**: P1–P4, P3 default
- **Fields**: dataset-source, size-estimate
- **Sync → ADHD**: Partial (8 of 24 mapped)

## 7. AutoReview Workflow Improvements
- **Status**: Done, Triage, In Progress, Backlog
- **Labels**: `autoreview`, `workflow`, `review`, `automation`, `quality`
- **Priority**: P0–P4, P2 default
- **Fields**: assignee, review-criteria
- **Sync → ADHD**: ✅ Yes (24 of 24 mapped — full coverage)

## 8. Hybrid App Architecture Migration
- **Status**: Done, Backlog, Todo
- **Labels**: `architecture`, `migration`, `frontend`, `backend`, `tech-debt`
- **Priority**: P1–P4, P2 default
- **Fields**: assignee, migration-plan
- **Sync → ADHD**: ✅ Yes (15 of 19 mapped)

## 9. Memory May-Hem Expansion
- **Status**: Todo, Done, Duplicate, Triage
- **Labels**: `memory`, `expansion`, `scale`, `performance`
- **Priority**: P0–P4, P2 default
- **Fields**: assignee, spec-link
- **Sync → ADHD**: ❌ **None mapped** — needs bulk creation

## 10. Test Coverage & Security Baseline
- **Status**: Done, In Progress, Todo
- **Labels**: `testing`, `security`, `baseline`, `coverage`, `audit`
- **Priority**: P0–P4, P1 default (security-sensitive)
- **Fields**: assignee, test-type, severity
- **Sync → ADHD**: ✅ Yes (17 of 18 mapped)

## 11. Discovery & Backlog
- **Status**: Backlog, Done, Todo, Duplicate
- **Labels**: `discovery`, `research`, `idea`, `backlog`, `exploration`
- **Priority**: P2–P4 only (no P0/P1 — exploration)
- **Fields**: discovery-summary
- **Sync → ADHD**: ✅ Yes (14 of 16 mapped)

## 12. Data Pipeline Recovery & External Integrations
- **Status**: Done, Todo, In Progress, Backlog
- **Labels**: `pipeline`, `integration`, `recovery`, `etl`, `external`
- **Priority**: P0–P4, P2 default
- **Fields**: assignee, integration-point
- **Sync → ADHD**: ✅ Yes (9 of 11 mapped)

## 13. Checkmate
- **Status**: Done, Todo, Duplicate, Backlog
- **Labels**: `checkmate`, `qa`, `validation`, `testing`, `quality`
- **Priority**: P1–P4, P2 default
- **Fields**: assignee, acceptance-criteria
- **Sync → ADHD**: ✅ Yes (7 of 8 mapped)

## 14. Churnmeon Reliability
- **Status**: Backlog only (all 4 issues)
- **Labels**: `reliability`, `churn`, `stability`, `monitoring`
- **Priority**: P0–P4, P1 default (reliability-sensitive)
- **Fields**: assignee, reliability-metric
- **Sync → ADHD**: ✅ Yes (4 of 4 mapped — full coverage)

---

## Cross-Cutting Rules

### Status Canonical Mapping

```
Linear State → Canonical Status
────────────────────────────────────
Backlog    → backlog
Todo       → open (unstarted)
Triage     → triage
In Progress → in_progress
In Review  → review
Done       → closed
Canceled   → closed (canceled)
Duplicate  → closed (duplicate)
```

### Provider Priority Mapping

```
Linear (numeric)   Jira ADHD (name)      Beads
─────────────────────────────────────────────
0 (urgent)    →   Highest              → critical
1 (high)      →   High                 → high
2 (medium)    →   Medium               → normal
3 (low)       →   Low                  → low
4 (none)      →   None                 → none
```

### Required Sync Fields

Every issue synced to any provider MUST have:
- `sync-key` in body or metadata
- Assignee (or `Unassigned`)
- Priority level
- Project association
- Status from the per-project allowed set

### Blocked Providers
- **Asana**: ❌ Disabled — all 162 unmapped issues must target ADHD (Jira), not Asana
- **Beads**: ❌ Not deployed — no `.beads/` directory exists
