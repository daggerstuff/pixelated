# Master Plan — PRUNED & VERIFIED

> Generated: 2026-08-01 · Re-audited: 2026-08-24 Method: Every item verified
> against live codebase (file existence + code content) Items marked DONE
> confirmed by files/content. OPEN confirmed missing or incomplete.

---

## STATUS LEGEND

- ✅ DONE — Verified in codebase
- ⚠️ PARTIAL — In progress / incomplete plumbing
- 🔲 OPEN — Confirmed not yet implemented
- ⏸ BLOCKED — External dependency
- 🗑 STALE — No longer relevant (superseded, canceled, never actionable)
- 📋 STRATEGIC — Business/compliance roadmap, not code

---

## CATEGORY A: CODEBASE — OPEN WORK

### A1. CI Federation (RFC §8)

| #    | Item                            | Source | Status  | Notes                                                                               |
| ---- | ------------------------------- | ------ | ------- | ----------------------------------------------------------------------------------- |
| A1.1 | ci.yml SOFT→HARD gates          | RFC §8 | ✅ DONE | `continue-on-error` removed from submodule init step (lint/test/Trivy already HARD) |
| A1.2 | Weekly CI review                | RFC §8 | 🔲 OPEN | No weekly review workflow                                                           |
| A1.3 | Readiness aggregator pre-deploy | RFC §8 | ✅ DONE | `aggregate-readiness.py` wired into `promotion-gate-test.yml`                       |

### A2. Session Progress Tracking

| #    | Item                | Source | Status  | Notes                                                                                                                                 |
| ---- | ------------------- | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| A2.1 | DB Pool Integration | docs   | ✅ DONE | `src/lib/database/connection.ts` now reuses shared pool from `src/lib/db`; no duplicate Pool                                          |
| A2.2 | Defense Metrics API | docs   | ✅ DONE | `src/pages/api/defense.ts` exists                                                                                                     |
| A2.3 | React Components    | docs   | ✅ DONE | All 5 exist: `MultiSessionProgression`, `BeliefChangeTracker`, `DefenseMechanismAdaptation`, `GoalAttainmentScale`, `SessionTimeline` |
| A2.4 | Dashboard Page      | docs   | ✅ DONE | `src/pages/dashboard/session-progress.astro` exists                                                                                   |

### A3. Task Sync Gaps (`scripts/task_sync/GAP_MATRIX.md`)

| #    | Item                      | Severity | Status  | Notes                                                                                                                |
| ---- | ------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| A3.1 | review canonical state    | High     | ✅ DONE | `tri_sync.py` maps "in review"/"review" → `review`                                                                   |
| A3.2 | Priority sync Linear↔Jira | High     | ✅ DONE | Fixed inverted `get_priority_label` + added missing `Lowest` in `JIRA_PRIORITY_TO_CANONICAL`; bidirectional verified |
| A3.3 | Label sync                | Medium   | ✅ DONE | Labels fetched from Linear + wired into GitHub/Jira/Linear apply paths                                               |
| A3.4 | Per-project mappings      | High     | ✅ DONE | `PROJECT_STATUS_WORKFLOWS` dict exists                                                                               |
| A3.5 | Map 162 issues to Jira    | Medium   | 🔲 OPEN | Backfill only (not worth live-write risk). Linear now 532 issues, Jira 399 — gap grew beyond doc snapshot            |
| A3.6 | Jira→Linear reverse       | Low      | 🔲 OPEN | One-way only; no reverse map                                                                                         |
| A3.7 | Fix circular import       | Low      | ✅ DONE | `provider_bridge` no longer imports `tri_sync`                                                                       |
| A3.8 | Sync daemon / cron        | High     | ✅ DONE | `sync_daemon.py` + cron example + systemd service exist                                                              |

### A4. Deterministic Batching

| #    | Item                    | Status  | Notes                                                                               |
| ---- | ----------------------- | ------- | ----------------------------------------------------------------------------------- |
| A4.1 | surgical_fix_2025_09.py | 🗑 STALE | Confirmed absent; one-off for old batch, no action needed                           |
| A4.2 | monthly_pipeline.py     | ✅ DONE | Relocated to `scripts/corpus/pixelated_empathy/`; package promoted out of hackathon |
| A4.3 | Modify LLM prompts      | 🔲 OPEN | No `monthly_llm_prompt` found; depends A4.2                                         |

### A5. Integration Test Plan (`src/content-store/docs/testing/integration-test-plan.md`)

| #    | Item                 | Status  | Notes         |
| ---- | -------------------- | ------- | ------------- |
| A5.1 | Test framework setup | 🔲 OPEN | Plan doc only |
| A5.2 | Test scenarios       | 🔲 OPEN |               |
| A5.3 | CI/CD integration    | 🔲 OPEN |               |
| A5.4 | Test data mgmt       | 🔲 OPEN |               |
| A5.5 | Performance testing  | 🔲 OPEN |               |
| A5.6 | Security testing     | 🔲 OPEN |               |
| A5.7 | HIPAA validation     | 🔲 OPEN |               |

### A6. Test Coverage Baseline (`docs/plans/PIX-1901-test-coverage-baseline-plan-02.md`)

| #    | Item                   | Status  | Notes               |
| ---- | ---------------------- | ------- | ------------------- |
| A6.1 | Phase 1 Infrastructure | 🔲 OPEN | Ready, not executed |
| A6.2 | Phase 2 Critical Path  | 🔲 OPEN |                     |
| A6.3 | Phase 3 Supporting     | 🔲 OPEN |                     |
| A6.4 | Phase 4 Scale          | 🔲 OPEN |                     |
| A6.5 | Phase 5 Baseline Lock  | 🔲 OPEN |                     |

---

## CATEGORY B: COMPLIANCE REMEDIATION ROADMAPS

### B1. HIPAA Compliance — 16-week plan, ~$62-110K first year

| Phase | Weeks | Focus                 | Status  |
| ----- | ----- | --------------------- | ------- |
| B1.1  | 1-4   | Governance & Risk     | 🔲 OPEN |
| B1.2  | 5-8   | Breach & BAA          | 🔲 OPEN |
| B1.3  | 9-12  | Procedures & Training | 🔲 OPEN |
| B1.4  | 13-16 | Documentation & Audit | 🔲 OPEN |

### B2. SOC2 Readiness — 16-week plan, ~$120-170K first year

| Phase | Weeks | Focus               | Status  |
| ----- | ----- | ------------------- | ------- |
| B2.1  | 1-4   | Foundation          | 🔲 OPEN |
| B2.2  | 5-8   | Data & Privacy      | 🔲 OPEN |
| B2.3  | 9-12  | Vendor & Monitoring | 🔲 OPEN |
| B2.4  | 13-16 | Audit Prep          | 🔲 OPEN |

---

## CATEGORY C: BUSINESS STRATEGY (Non-Code)

### C1. Expansion Roadmap — 4-phase, 48-month market plan

| Phase | Timeline     | Focus             | Status       |
| ----- | ------------ | ----------------- | ------------ |
| C1.1  | Months 1-12  | Market Validation | 📋 STRATEGIC |
| C1.2  | Months 13-24 | Market Expansion  | 📋 STRATEGIC |
| C1.3  | Months 25-36 | Market Leadership | 📋 STRATEGIC |
| C1.4  | Months 37-48 | Global Leadership | 📋 STRATEGIC |

---

## CATEGORY D: VERIFIED DONE

| Item                             | Source                                | Verification                                                                                                                      |
| -------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| D1. Vertical Fidelity Stack      | IMPLEMENTATION_PLAN.md                | `receipt.py`, `event_bus.py`, `jit_scenario_injector.py`, `persistence.py` exist. ⚠️ `triggers.py` NOT found (only site-packages) |
| D2. PAL Framework                | ai/PAL_MEDDIES_IMPLEMENTATION_PLAN.md | All 6 files exist under `ai/data/synthetic/wrapper/pal_framework/` + `ai/training/`                                               |
| D3. Unified Backend              | .omo/plans/unify-pixelated-backend.md | `docker/docker-compose.backend.yml` + `scripts/devops/backend-health-check.sh` exist. ⚠️ `.env.backend.example` NOT found         |
| D4. Enterprise Readiness         | Linear                                | Done                                                                                                                              |
| D5. CI Federation                | Linear                                | Done                                                                                                                              |
| D6. ML Remediation               | Linear                                | Done                                                                                                                              |
| D7. Training Pipeline v2         | Linear                                | Completed                                                                                                                         |
| D8. AI Research-Clinical         | Linear                                | Completed                                                                                                                         |
| D9. Foresight Memory             | Linear                                | Completed                                                                                                                         |
| D10. Churnmeon Reliability       | Linear                                | Completed                                                                                                                         |
| D11. Monitoring FIXME (PIX-4100) | monitoring/FIXME.md                   | Exists; 5 items triaged                                                                                                           |
| D12. Linear Workspace Audit      | docs/linear-audit/linear_audit.md     | Exists (final: `linear_audit_final.md`)                                                                                           |
| D13. Task sync `review` state    | scripts/task_sync/GAP_MATRIX.md       | `tri_sync.py` maps "review" → `review`                                                                                            |
| D14. aggregate-readiness.py      | docs/rfc/CI-OPERATING-MODEL.md        | Exists AND wired into promotion gate                                                                                              |

---

## CATEGORY E: BLOCKED (External Dependencies)

| Item                                          | Linear   | Blocker                     |
| --------------------------------------------- | -------- | --------------------------- |
| E1. Remove @babel/core override               | PIX-4164 | Waiting for ecosystem patch |
| E2. Remove react-router monitoring workaround | PIX-4165 | Waiting for upstream fix    |
| E3. Remove accepted localstack risk           | PIX-4166 | Waiting for patched release |

---

## CATEGORY F: STALE / SUPERSEDED

| Item                                        | Source                                 | Reason                                |
| ------------------------------------------- | -------------------------------------- | ------------------------------------- |
| F1. IMPLEMENTATION_PLAN.md "Remaining Work" | IMPLEMENTATION_PLAN.md §Remaining Work | All items DONE; section never updated |
| F2. surgical_fix_2025_09.py                 | docs/superpowers/specs/2026-06-29      | One-off fix, old batch                |
| F3. 26 Linear issues w/o project            | docs/linear-audit/linear_audit.md      | Hygiene follow-up, low priority       |

---

## PRIORITY SUMMARY

### Immediate Code Work (A items)

- **HIGH**: (none — remaining items are backfill/compliance)
- **MEDIUM**: A1.2 weekly review · A4.2 relocate pipeline · A5.1-A5.7 group ·
  A6.1-A6.5 group
- **LOW**: A3.6 reverse map

### Compliance (B) — human-driven

- HIPAA: 16-week, $62-110K
- SOC2: 16-week, $120-170K

### Strategic (C) — business execution

- 48-month expansion roadmap

### Blocked (E) — 3 dependency waits

### Stale (F) — 3 cleanup items

---

## RECOMMENDED NEXT ACTIONS

1. **Relocate `monthly_pipeline.py` (A4.2)** — Move from `hackathon/` to
   `scripts/corpus/`.
2. **Weekly CI review (A1.2)** — Establish recurring CI operations review (RFC
   §8).
3. **Correct stale D1/D3 notes** — `triggers.py` and `.env.backend.example`
   claimed present but not found.
4. **Test coverage baseline (A6)** — 9-week plan, "Implementation Ready",
   unexecuted.
