# Task Sync: Cross-System Mapping Gap Matrix

*Generated: 2026-05-29 from live Linear queries + export cross-reference*

## Overview

| System | Provider | Status | Issues |
|--------|----------|--------|--------|
| Linear (PIX) | `normalize_linear_payload` | ✅ Active | 385 issues, 14 projects |
| Jira ADHD | `normalize_jira_payload` | ✅ Active | 399 issues exported |
| Asana | `normalize_asana_payload` | ❌ Disabled (config: `enabled: false`) | N/A |
| Beads | `normalize_beads_payload` | ❌ No runtime | No `.beads/` directory |
| GitHub | `normalize_github_payload` | ⚠️ Partial | Env vars not set |

## 1. Status Mapping Gaps

### Canonical States (expected vs actual)

| Canonical (wanted) | STATUS_ALIASES (actual) | Linear States Found |
|---|---|---|
| `backlog` | `open` (aliased from backlog/todo/triage) | Backlog (45), Todo (45), Triage (9) |
| `in_progress` | `in_progress` (aliased from "in progress"/review/doing/active) | In Progress (26) |
| `review` | **MISSING** — maps to `in_progress` | (none — no "In Review" state active) |
| `closed` | `closed` (aliased from done/resolved/cancelled) | Done (223), Canceled (16), Duplicate (21) |

### Per-Project State Coverage Gap

| Project | Total | States Used | Missing Canonical States |
|---|---|---|---|
| Training Pipeline Improvements | 70 | Done, Backlog, In Progress, Todo | `closed`, `review` |
| CI Federation & Release Readiness | 59 | Done, Todo, Canceled, Backlog | `closed`, `review` |
| Foresight Memory Architecture | 59 | Done, Todo, Duplicate, In Progress | `closed`, `review` |
| Data Governance & Compliance | 29 | Done, Backlog, Todo | `closed`, `in_progress`, `review` |
| Platform Foundations & Operations | 25 | Done, Duplicate, In Progress, Backlog | `closed`, `review` |
| Modern Dataset Project | 24 | Done, Canceled, Todo | `backlog`, `closed`, `in_progress`, `review` |
| AutoReview Workflow Improvements | 24 | Done, Triage, In Progress, Backlog | `closed`, `review` |
| Hybrid App Architecture Migration | 19 | Done, Backlog, Todo | `closed`, `in_progress`, `review` |
| Memory May-Hem Expansion | 19 | Todo, Done, Duplicate, Triage | `backlog`, `closed`, `in_progress`, `review` |
| Test Coverage & Security Baseline | 18 | Done, In Progress, Todo | `backlog`, `closed`, `review` |
| Discovery & Backlog | 16 | Backlog, Done, Todo, Duplicate | `closed`, `in_progress`, `review` |
| Data Pipeline Recovery & Ext | 11 | Done, Todo, In Progress, Backlog | `closed`, `review` |
| Checkmate | 8 | Done, Todo, Duplicate, Backlog | `closed`, `in_progress`, `review` |
| Churnmeon Reliability | 4 | Backlog | `closed`, `in_progress`, `review` |

### Gap: `review` canonical status is missing from STATUS_ALIASES
- Current: "review" → `in_progress` (line 59)
- Should: "review" → `review` (new canonical state)
- Impact: In Review issues sync as In Progress — reviewers can't distinguish

### Gap: `open` vs `backlog` naming
- Current: STATUS_ALIASES maps "backlog"/"todo" → `open`
- But Beads uses `open` correctly; Linear uses "Backlog"/"Todo"
- Issue: cross-system readback of `open` status creates ambiguity

## 2. Priority Mapping Gaps

### Current Code (tri_sync.py)

```python
PROVIDER_PRIORITY = {
    "beads": 4,
    "asana": 3,
    "github": 2,
    "linear": 2,
    "jira": 2,
}
```

- This is **provider trust priority** — not issue priority
- **No actual issue priority mapping exists** across providers
- Linear uses `priority: 0-4` (0=urgent, 1=high, 2=medium, 3=low, 4=none)
- Jira ADHD uses `priority: Highest/High/Medium/Low/Lowest`
- **Priority is never synced** between Linear and Jira

### Live Data

| Project | Priority Distribution | Notes |
|---|---|---|
| All 14 projects | `?` or `None` | Export format doesn't capture priority field |

### Gap: Priority sync is absent
- No bi-directional priority mapping between Linear (0-4 numeric) and Jira (named levels)
- No per-project priority normalization
- Priority changes in one system are never reflected in the other

## 3. Label Mapping Gaps

### Current Code
- **No label mapping exists** in `tri_sync.py` or `provider_bridge.py`
- Labels are not part of `TaskRecord` data model
- Labels are not extracted, normalized, or synced between providers

### Live Data
| Project | Distinct Labels | Notes |
|---|---|---|
| All 14 projects | 0 | Export format doesn't capture labels |

### Gap: Label system is entirely absent
- Linear supports labels per-issue
- Jira supports labels per-issue
- No taxonomy, no sync, no enforcement
- Cannot filter or route issues by label across systems

## 4. ADHD (Jira) Mapping Gaps

### Cross-Reference Status

| Status | Linear → ADHD | Notes |
|---|---|---|
| Mapped PIX issues | **223 of 385** (58%) | 162 issues are Linear-only |
| PIX-ADHD key map | 197 entries | One-directional: PIX→ADHD only |
| Jira → Linear mapping | **None** | No reverse map exists |

### Per-Project ADHD Coverage

| Project | Total | Mapped to ADHD | Unmapped | Coverage |
|---|---|---|---|---|
| Training Pipeline Improvements | 70 | 0 | 70 | **0%** ❌ |
| Memory May-Hem Expansion | 19 | 0 | 19 | **0%** ❌ |
| AutoReview Workflow Improvements | 24 | 24 | 0 | 100% ✅ |
| Churnmeon Reliability | 4 | 4 | 0 | 100% ✅ |
| CI Federation & Release Readiness | 59 | 42 | 17 | 71% |
| Foresight Memory Architecture | 59 | 39 | 20 | 66% |
| Data Governance & Compliance | 29 | 24 | 5 | 83% |
| Platform Foundations & Operations | 25 | 20 | 5 | 80% |
| Modern Dataset Project | 24 | 8 | 16 | 33% |
| Hybrid App Architecture Migration | 19 | 15 | 4 | 79% |
| Test Coverage & Security Baseline | 18 | 17 | 1 | 94% |
| Discovery & Backlog | 16 | 14 | 2 | 88% |
| Data Pipeline Recovery & Ext | 11 | 9 | 2 | 82% |
| Checkmate | 8 | 7 | 1 | 88% |

### Gap: 162 Linear-only issues have no Jira ADHD counterpart
- **Training Pipeline Improvements** (70 issues) and **Memory May-Hem Expansion** (19 issues) are entirely invisible to Jira
- These issues cannot be tracked through the ADHD project workflow

## 5. Architecture & Code Quality Gaps

### Circular Import Risk
- `tri_sync.py` imports 5 functions from `provider_bridge`
- `provider_bridge` imports `SyncMetadata`, `parse_sync_metadata`, `merge_body_with_sync_metadata` from `tri_sync`
- Circular dependency at module load time

### Duplicate API Layer
- `update_linear_progress.py` uses raw `urllib.request()` for Linear API
- `provider_bridge.py` has its own `_linear_graphql_query` with `_json_request`
- Same endpoint, same auth — duplicated code, no reuse

### No Per-Project Mapping
- STATUS_ALIASES is **global** — applies to all 14 projects equally
- No per-project override mechanism exists
- Different projects may need different status workflows (e.g., Churnmeon uses only Backlog; AutoReview uses Triage)

## 6. Infrastructure Gaps

| Component | Status | Notes |
|---|---|---|
| Sync daemon | ❌ None | Must run manually |
| Cron/scheduler | ❌ None | No automated sync |
| Export refresh | ❌ Stale (May 27) | 2 days old |
| Runtime state | ❌ Not created | `task-sync-state.json` doesn't exist |
| Monitoring | ⚠️ Docker stack defined | Not verified running |
| Drift detection | ❌ `check_mapping_drift.py` missing | File doesn't exist at expected path |

## Summary of Required Fixes

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | `review` canonical state missing | High | Add to STATUS_ALIASES |
| 2 | No priority sync | High | Add priority mapping in build_sync_action |
| 3 | No label sync | Medium | Add labels to TaskRecord + sync pipeline |
| 4 | No per-project mappings | High | Add PROJECT_MAPPINGS override dict |
| 5 | 162 unmapped issues | Medium | Bulk-map Training Pipeline + Memory May-Hem |
| 6 | No Jira→Linear reverse map | Low | Add reverse map to pix-to-adhd-key-map |
| 7 | Circular import | Low | Extract shared metadata types to new module |
| 8 | No automated sync | High | Add cron-able sync runner |
