#!/usr/bin/env python
"""
Execute all Linear workspace improvements:
1. Create epic parent issues for the 6 major streams
2. Create missing tickets (clinical validity, platform gaps, dev-ex, etc.)
3. Fix triage items (priorities, blocking relationships)
4. Cancel stale/invalid tickets (PIX-242)
5. Create label definitions
"""

import json
import logging
import os
import sys
from dataclasses import dataclass

sys.path.insert(0, os.getcwd())
from scripts.task_sync.provider_bridge import _extract_graphql_payload, _linear_graphql_query

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ── Constants ──────────────────────────────────────────────────────────────────
TEAM_ID = "52861523-9089-49a3-8be5-4032d68cb55a"

STATE_TODO = "d47f8fab-abb9-474e-879b-9c581a9852ed"
STATE_BACKLOG = "74b11563-2856-45f3-bcb7-e813702cd73f"
STATE_CANCELED = "1a98745d-dd54-4796-bc6d-12fc794f8cea"

PROJECTS = {
    "memory_mayhem": "022b75fa-d681-4070-b3e3-0d152d7daf1e",
    "training": "70c0c2a7-35d9-492a-bba5-0531ed028ea7",
    "churnmeon": "7fb7fc08-8b19-4210-8215-f73f3b559a46",
    "autoreview": "2889fe87-ad71-4edf-99c5-75224ee3f18f",
    "discovery": "4a928f0c-ef75-4bfc-9598-bddd3490b06c",
    "checkmate": "97b72bac-e84b-46e4-a82e-dc657030dcb9",
    "foresight": "8f9aad1c-fd4c-4cf6-9a3b-2ceb267ef133",
    "dataset": "dd29a94c-6283-4c13-9eef-0f7546321f1d",
    "governance": "0aa3ad95-f694-4633-88c9-e127865a0ba1",
    "test_security": "97409cfb-e01c-4094-9728-577c79bf53ae",
    "hybrid_app": "732c7ac7-4db7-4959-8bc8-bc1ab497a8e0",
    "ci_federation": "f7dda0b0-c075-4fe7-a17e-8046a850f6b6",
    "platform": "f5dc528d-c1ff-447b-9626-b11813f0dc6e",
    "data_pipeline": "07810eff-50bb-4518-974a-07b4938f3264",
}

# Priority: 0=no priority, 1=urgent, 2=high, 3=medium, 4=low
PRIORITY_URGENT = 1
PRIORITY_HIGH = 2
PRIORITY_MEDIUM = 3
PRIORITY_LOW = 4

DRY_RUN = "--dry-run" in sys.argv


# ── Helpers ────────────────────────────────────────────────────────────────────


@dataclass
class IssueSpec:
    title: str
    description: str
    project_id: str
    state_id: str
    priority: int = PRIORITY_MEDIUM
    parent_id: str | None = None


def create_issue(spec: IssueSpec) -> str | None:
    """Create a Linear issue and return its UUID."""
    if DRY_RUN:
        logging.info("[DRY RUN] Would create: '%s'", spec.title)
        return "dry-run-uuid"

    inp: dict = {
        "teamId": TEAM_ID,
        "projectId": spec.project_id,
        "title": spec.title,
        "description": spec.description,
        "stateId": spec.state_id,
        "priority": spec.priority,
    }
    if spec.parent_id:
        inp["parentId"] = spec.parent_id

    mutation = (
        "mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title } } }"
    )
    try:
        res = _linear_graphql_query(mutation, {"input": inp})
        data = _extract_graphql_payload(res)
        created = data.get("issueCreate", {})
        if created.get("success"):
            issue = created.get("issue", {})
            logging.info("  \u2705 Created %s: %s", issue.get("identifier"), spec.title)
            return issue.get("id")
        logging.error("  \u274c Failed to create: %s -- %s", spec.title, created)
    except Exception as e:
        logging.error("  \u274c Error creating '%s': %s", spec.title, e)
    return None


def update_issue(uuid: str, identifier: str, **fields) -> bool:
    """Update a Linear issue."""
    if DRY_RUN:
        logging.info("[DRY RUN] Would update %s: %s", identifier, fields)
        return True

    mutation = "mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }"
    try:
        res = _linear_graphql_query(mutation, {"id": uuid, "input": fields})
        data = _extract_graphql_payload(res)
        ok = data.get("issueUpdate", {}).get("success", False)
        if ok:
            logging.info("  ✅ Updated %s", identifier)
        else:
            logging.error("  ❌ Failed to update %s", identifier)
        return ok
    except Exception as e:
        logging.error("  ❌ Error updating %s: %s", identifier, e)
        return False


def add_relation(issue_id: str, related_id: str, rel_type: str = "blocks") -> None:
    """Add a blocking/related relation between two issues."""
    if DRY_RUN:
        logging.info("[DRY RUN] Would add relation %s -> %s (%s)", issue_id, related_id, rel_type)
        return
    mutation = "mutation($input: IssueRelationCreateInput!) { issueRelationCreate(input: $input) { success } }"
    inp = {"issueId": issue_id, "relatedIssueId": related_id, "type": rel_type}
    try:
        res = _linear_graphql_query(mutation, {"input": inp})
        data = _extract_graphql_payload(res)
        if data.get("issueRelationCreate", {}).get("success"):
            logging.info("  ✅ Relation set: %s → %s", rel_type, related_id[:8])
        else:
            logging.warning("  ⚠️  Relation failed: %s → %s", rel_type, related_id[:8])
    except Exception as e:
        logging.error("  ❌ Relation error: %s", e)


def get_issue_uuid(identifier: str, issues: list) -> str | None:
    for i in issues:
        if i.get("identifier") == identifier:
            return i.get("id")
    return None


# ── Load current issues ────────────────────────────────────────────────────────
logging.info("Loading current issues from export...")
with open("exports/current_linear_issues.json") as f:
    all_issues = json.load(f)
issue_map = {i.get("identifier"): i for i in all_issues if i.get("identifier")}

logging.info("Loaded %d issues.", len(all_issues))

created_epics: dict[str, str] = {}  # name -> uuid


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Create Epics
# ══════════════════════════════════════════════════════════════════════════════
logging.info("\n" + "═" * 60)
logging.info("STEP 1: Creating Epic parent issues")
logging.info("═" * 60)

epics_to_create = [
    {
        "name": "EPIC: Clinical Validity Enhancement Pipeline",
        "project": "training",
        "priority": PRIORITY_URGENT,
        "desc": """### Core Objective
Drive the clinical validity pass rate from 13.3% → ≥50% by implementing a domain-specific scoring pipeline, expert annotation workflow, and automated quality monitoring.

This is the **#1 bottleneck** for the Pixelated Empathy training pipeline. Until clinical validity improves, all other data acquisition and fine-tuning work is blocked from delivering meaningful model quality gains.

### Technical Design Specs
- **Clinical Validity Scorer**: DSM-5-aligned scoring model producing a 0-1 validity score per training sample
- **Expert Annotation Loop**: Route borderline samples (score 0.4-0.6) to human reviewer queue (target: 100 samples/week)
- **Pipeline Integration**: Replace safety scoring in `ai/training/sdg_pipeline.py` with clinical validity scoring
- **Monitoring**: Grafana/Prometheus dashboard tracking pass rate over time

### Atlassian & Code Linkages
- **Source Plan**: [CONSOLIDATED-MODERN-PLAN-2026-05-08.md](file:///.agent/internal/plans/CONSOLIDATED-MODERN-PLAN-2026-05-08.md)
- **Primary Script**: `ai/training/sdg_pipeline.py`
- **Eval Script**: `ai/training/mental_health_eval.py`

### Verification & Testing Checklist
- [ ] Clinical validity scorer implemented and scoring >0.5 on 100 expert-validated samples
- [ ] Expert annotation queue receiving borderline samples
- [ ] Pass rate dashboard live and alerting on >10% degradation
- [ ] A/B test results comparing model quality before/after validity gating""",
    },
    {
        "name": "EPIC: AutoReview Phase 1 — Ship to Production",
        "project": "autoreview",
        "priority": PRIORITY_HIGH,
        "desc": """### Core Objective
Deliver a production-stable AutoReview workflow: comment resolution, smart filtering, conflict resolution, and E2B sandbox test validation — ready to run against the pixelated repo itself.

### Technical Design Specs
- **Ship criteria**: All Phase 1 sub-tasks (A1-B4) complete and passing on a real PR
- **Integration test**: End-to-end smoke test running AutoReview against pixelated main repo
- **LLM failover**: Primary → secondary model → rule-based fallback chain
- **Runtime**: Node 24 + TypeScript, connecting to GitHub API

### Atlassian & Code Linkages
- **Sub-tasks**: PIX-341, PIX-342, PIX-344, PIX-345, PIX-328

### Verification & Testing Checklist
- [ ] All A1-B4 sub-tasks resolved and passing
- [ ] End-to-end smoke test passes on a real pixelated PR
- [ ] LLM failover chain tested with mock API failures
- [ ] No regressions in existing PR review latency""",
    },
    {
        "name": "EPIC: Foresight Memory — Schema, Gateway & Scoping",
        "project": "foresight",
        "priority": PRIORITY_HIGH,
        "desc": """### Core Objective
Deliver a unified, typed memory schema, a durable product memory gateway, and explicit account/workspace scoping — completing the memory architecture redesign.

### Technical Design Specs
- **Unified schema**: Zod (TS) + Pydantic (Python) types in `@pixelated/memory-schema`
- **Gateway**: Replace in-process `MemoryService` with gateway-backed routes under `/api/memory/*`
- **Scoping**: Explicit `account_id` + `workspace_id` on all memory read/write operations

### Atlassian & Code Linkages
- **Sub-tasks**: PIX-355, PIX-317, PIX-328, PIX-516
- **Gateway Code**: `src/pages/api/memory/`
- **Schema Package**: `packages/memory-schema/`

### Verification & Testing Checklist
- [ ] Unified schema package published and consumed by both TS and Python adapters
- [ ] All `/api/memory/*` routes routing through gateway (no in-process fallback)
- [ ] Workspace scoping enforced and tested with multi-tenant fixtures
- [ ] Memory persistence verified across server restarts""",
    },
    {
        "name": "EPIC: Training Pipeline Test Suite Completion",
        "project": "training",
        "priority": PRIORITY_HIGH,
        "desc": """### Core Objective
Complete all property-based and unit tests for the training pipeline modules, achieving the required safety-critical test coverage for `shared_config.py`, `MultilingualSafetyChecker`, the SFT script, and reward functions.

### Technical Design Specs
- **Property tests**: `hypothesis`-based tests for token length stats, truncation, multilingual crisis detection, reward score range
- **Unit tests**: 100% branch coverage on `shared_config.py`, `pixelated_production_pilot.py`, DPO/GRPO reward functions
- **Runner**: `uv run pytest` with all `*N.N` starred tasks resolved

### Atlassian & Code Linkages
- **Sub-tasks**: PIX-424, PIX-426, PIX-428, PIX-472-PIX-480
- **Test Files**: `tests/python/test_training_*.py`

### Verification & Testing Checklist
- [ ] All starred (*) test tasks in Done state
- [ ] `uv run pytest tests/python/` passes with 0 failures
- [ ] Coverage report shows ≥90% on training module files""",
    },
    {
        "name": "EPIC: CI Federation — Execution & Go-Live",
        "project": "ci_federation",
        "priority": PRIORITY_MEDIUM,
        "desc": """### Core Objective
Execute the CI federation plan: publish the RFC, establish ownership matrix, implement the readiness aggregator, and go live with unified pipeline reporting.

### Technical Design Specs
- **GitHub Actions**: CodeQL/SARIF security lane
- **Bitbucket**: AI/governance validation lane
- **Aggregator**: `scripts/devops/aggregate-readiness.py` outputting consolidated JSON

### Atlassian & Code Linkages
- **Sub-tasks**: PIX-1879, PIX-1882, PIX-1884, PIX-1889
- **Source Plan**: 2026-03-17-ci-federation-asana-tasks.csv

### Verification & Testing Checklist
- [ ] RFC published and signed off
- [ ] Ownership matrix documented and agreed
- [ ] Readiness aggregator endpoint returning valid JSON
- [ ] Both provider lanes (GitHub/Bitbucket) reporting to aggregator""",
    },
    {
        "name": "EPIC: Churnmeon — Reliability Finish Line",
        "project": "churnmeon",
        "priority": PRIORITY_MEDIUM,
        "desc": """### Core Objective
Bring Churnmeon from operationally promising but documentationally noisy to a reliably packaged, contributor-ready product: clean test baseline, Docker alignment, updated README, and tracked hardening work.

### Technical Design Specs
- **pytest baseline**: All concentrated failure clusters resolved; materially cleaner signal
- **Docker alignment**: `docker-compose.test.yml` matching CI environment
- **README**: Reflects current workflow, plugin architecture, and deployment model
- **Hardening work**: Automatic rebasing, large-file mitigation, comment deduplication

### Atlassian & Code Linkages
- **Sub-tasks**: PIX-374, PIX-375, PIX-376, PIX-377

### Verification & Testing Checklist
- [ ] pytest suite passes with documented intentional failures only
- [ ] Docker test environment matches CI
- [ ] README accurately describes the product
- [ ] All workflow hardening items tracked as concrete sub-tasks""",
    },
]

for epic_def in epics_to_create:
    logging.info("\nCreating epic: %s", epic_def["name"])
    epic_id = create_issue(
        IssueSpec(
            title=epic_def["name"],
            description=epic_def["desc"],
            project_id=PROJECTS[epic_def["project"]],
            state_id=STATE_TODO,
            priority=epic_def["priority"],
        )
    )
    if epic_id:
        created_epics[epic_def["name"]] = epic_id


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Create Missing Technical Tickets
# ══════════════════════════════════════════════════════════════════════════════
logging.info("\n" + "═" * 60)
logging.info("STEP 2: Creating missing technical tickets")
logging.info("═" * 60)

new_tickets = [
    # Clinical Validity tickets
    {
        "title": "Build clinical validity scorer for SDG pipeline",
        "project": "training",
        "state": STATE_TODO,
        "priority": PRIORITY_URGENT,
        "desc": """### Core Objective
Replace safety scoring in `ai/training/sdg_pipeline.py` with a DSM-5-aligned clinical validity scorer that outputs a 0-1 score per training sample. This directly addresses the 13.3% clinical pass rate bottleneck.

### Technical Design Specs
- **Scorer Architecture**: Fine-tuned classifier (or prompted LLM judge) against DSM-5 therapeutic best practice criteria
- **Output Schema**: `{"validity_score": float, "flags": list[str], "category": str}`
- **Integration Point**: Replace `is_safe()` check in `sdg_pipeline.py` with `clinical_validity_score()` call
- **Threshold**: Samples scoring <0.4 excluded; 0.4-0.6 routed to annotation queue; >0.6 accepted
- **Runtime**: `uv run python ai/training/clinical_validity_scorer.py`

### Atlassian & Code Linkages
- **Primary File**: `ai/training/clinical_validity_scorer.py` [NEW]
- **Integration Target**: `ai/training/sdg_pipeline.py`
- **Source Plan**: [CONSOLIDATED-MODERN-PLAN-2026-05-08.md](file:///.agent/internal/plans/CONSOLIDATED-MODERN-PLAN-2026-05-08.md)

### Verification & Testing Checklist
- [ ] Scorer outputs valid 0-1 float for all input formats
- [ ] Scores >0.6 on 100 expert-validated high-quality samples
- [ ] Scores <0.4 on 100 expert-validated low-quality samples
- [ ] `sdg_pipeline.py` integrated and pipeline runs end-to-end
- [ ] Unit tests cover edge cases (empty input, non-English, crisis content)""",
    },
    {
        "title": "Expert annotation workflow for borderline training samples",
        "project": "training",
        "state": STATE_TODO,
        "priority": PRIORITY_HIGH,
        "desc": """### Core Objective
Build tooling to route borderline training samples (validity score 0.4-0.6) to a human expert review queue, targeting 100 samples reviewed per week to progressively improve the clinical validity baseline.

### Technical Design Specs
- **Queue**: MongoDB collection `annotation_queue` with sample text, score, flags, and status (pending/approved/rejected)
- **Review UI**: Simple web interface or CLI tool for reviewer to approve/reject with optional note
- **Feedback Loop**: Approved samples re-enter training data; rejected samples log reasons for scorer improvement
- **Reporting**: Weekly summary: queue depth, throughput, approval rate

### Atlassian & Code Linkages
- **Queue Script**: `ai/training/annotation_queue.py` [NEW]
- **Source Plan**: CONSOLIDATED-MODERN-PLAN-2026-05-08.md

### Verification & Testing Checklist
- [ ] Borderline samples automatically inserted into queue after SDG pipeline run
- [ ] Reviewer can approve/reject samples via CLI or UI
- [ ] Approved samples added to training dataset manifest
- [ ] Weekly throughput report generated automatically""",
    },
    {
        "title": "Clinical validity metrics dashboard (Grafana/Prometheus)",
        "project": "training",
        "state": STATE_BACKLOG,
        "priority": PRIORITY_MEDIUM,
        "desc": """### Core Objective
Implement real-time monitoring for clinical validity pass rate, pipeline throughput, and annotation queue depth. Alert on any >10% degradation in validity score.

### Technical Design Specs
- **Metrics**: `clinical_validity_pass_rate`, `pipeline_throughput_records_per_hour`, `annotation_queue_depth`
- **Stack**: Prometheus metrics endpoint in training script + Grafana dashboard JSON
- **Alert**: Slack webhook when `clinical_validity_pass_rate` drops >10% week-over-week
- **Dashboard Location**: `infra/monitoring/dashboards/clinical-validity.json`

### Atlassian & Code Linkages
- **Dashboard File**: `infra/monitoring/dashboards/clinical-validity.json` [NEW]
- **Source Plan**: CONSOLIDATED-MODERN-PLAN-2026-05-08.md

### Verification & Testing Checklist
- [ ] Prometheus metrics endpoint emitting all three metric types
- [ ] Grafana dashboard visualizing pass rate trend over 30 days
- [ ] Alert fires in test environment when pass rate drops >10%
- [ ] Dashboard accessible at local Grafana on port 3000""",
    },
    {
        "title": "YouTube ingestion: process remaining 90 channels",
        "project": "dataset",
        "state": STATE_TODO,
        "priority": PRIORITY_HIGH,
        "desc": """### Core Objective
Complete YouTube ingestion for all 91 therapeutic channels. Currently only 1/91 channels have been processed. This is a critical data acquisition gap blocking the 3x pipeline size target.

### Technical Design Specs
- **Channels List**: `tmp/youtube_ingestion_final/` contains 90 unprocessed channel JSONL files
- **Script**: `ai/training/youtube_ingestion.py`
- **Output**: Processed transcripts in `data/therapeutic/` with ChatML format
- **Deduplication**: Cross-channel dedup pass required after all channels processed
- **Runtime**: `uv run python ai/training/youtube_ingestion.py --all-channels`

### Atlassian & Code Linkages
- **Ingestion Script**: `ai/training/youtube_ingestion.py`
- **Channel Data**: `tmp/youtube_ingestion_final/`
- **Output Dir**: `data/therapeutic/`
- **Source Plan**: CONSOLIDATED-MODERN-PLAN-2026-05-08.md

### Verification & Testing Checklist
- [ ] All 91 channel directories processed (no empty outputs)
- [ ] Total processed records > 100,000 new samples
- [ ] ChatML format verified on random sample of 50 records
- [ ] Cross-channel deduplication pass complete
- [ ] Processing report saved to `tmp/youtube_ingestion_final/processing_report.json`""",
    },
    {
        "title": "AutoReview: end-to-end smoke test on real pixelated PR",
        "project": "autoreview",
        "state": STATE_TODO,
        "priority": PRIORITY_HIGH,
        "desc": """### Core Objective
Validate the full AutoReview workflow against a real pull request in the pixelated repository. This is the Phase 1 acceptance gate — the system must work on real code before Phase 2 work begins.

### Technical Design Specs
- **Test PR**: Open a dedicated `test/autoreview-smoke-{date}` branch with intentional lint errors, a fixable bug, and an unresolved comment thread
- **Assertions**: Bot posts review comment, identifies lint issues, suggests fix, resolves previously-addressed threads
- **Timing**: Must complete full review cycle in <5 minutes
- **Output**: Captured review log saved to `tests/e2e/autoreview-smoke-result.json`

### Atlassian & Code Linkages
- **Test Script**: `tests/e2e/autoreview_smoke.test.ts` [NEW]
- **AutoReview Entry**: Main workflow runner

### Verification & Testing Checklist
- [ ] Smoke test PR created with known issues
- [ ] Bot reviews PR and comments correctly within 5 minutes
- [ ] Lint issues correctly identified and linked
- [ ] Previously resolved comments not re-raised
- [ ] Result log saved and assertions all pass""",
    },
    {
        "title": "AutoReview: LLM provider failover chain",
        "project": "autoreview",
        "state": STATE_BACKLOG,
        "priority": PRIORITY_MEDIUM,
        "desc": """### Core Objective
Add a resilient LLM provider failover chain so AutoReview continues functioning if the primary model API is unavailable: Primary → Secondary model → Rule-based fallback.

### Technical Design Specs
- **Chain**: Primary (e.g. Claude) → Secondary (e.g. Gemini) → Rule-based (lint-only mode)
- **Retry logic**: 3 retries on primary, 2 on secondary, then fallback
- **Config**: Provider chain configurable via env vars `LLM_PRIMARY`, `LLM_SECONDARY`
- **Observability**: Log which provider handled each request

### Atlassian & Code Linkages
- **Provider Module**: LLM adapter/provider abstraction layer

### Verification & Testing Checklist
- [ ] Failover to secondary triggers correctly when primary returns 5xx
- [ ] Rule-based mode activates when both LLM providers fail
- [ ] All three modes produce valid review output
- [ ] Provider used is logged with each review session""",
    },
    {
        "title": "Astro SSR: Lighthouse CI performance gate (≥90 score)",
        "project": "platform",
        "state": STATE_BACKLOG,
        "priority": PRIORITY_MEDIUM,
        "desc": """### Core Objective
Enforce a Lighthouse CI performance gate of ≥90 on every PR for the three highest-traffic routes: `/`, `/dashboard`, and `/session`. Prevent regressions from silently degrading UX.

### Technical Design Specs
- **Tool**: `lighthouse-ci` (LHCI) integrated into GitHub Actions
- **Routes**: `/`, `/dashboard`, `/session`
- **Thresholds**: performance ≥90, accessibility ≥90, best-practices ≥85
- **Config**: `.lighthouserc.json` at project root
- **Blocking**: PR blocked if any threshold not met

### Atlassian & Code Linkages
- **Config File**: `.lighthouserc.json` [NEW]
- **Workflow**: `.github/workflows/lighthouse.yml` [NEW]

### Verification & Testing Checklist
- [ ] Lighthouse CI runs on every PR targeting main
- [ ] All three routes score ≥90 performance on baseline run
- [ ] PR is blocked when a route drops below threshold
- [ ] LHCI report artifact uploaded and linked in PR comment""",
    },
    {
        "title": "Redis session store migration (horizontal scaling prerequisite)",
        "project": "platform",
        "state": STATE_BACKLOG,
        "priority": PRIORITY_HIGH,
        "desc": """### Core Objective
Move authentication sessions from in-process memory to Redis so the app can scale horizontally beyond a single instance without session loss.

### Technical Design Specs
- **Store**: `connect-redis` session store backed by existing Redis on port 6379
- **Session Config**: `maxAge`, `secure`, `sameSite=strict` aligned with HIPAA
- **Migration**: Zero-downtime — dual-write then cut over
- **Rollback**: Feature flag `USE_REDIS_SESSIONS` env var

### Atlassian & Code Linkages
- **Session Config**: `src/lib/session.ts`
- **Redis Client**: `src/lib/redis.ts`

### Verification & Testing Checklist
- [ ] Sessions persist across server restart when Redis is running
- [ ] Login/logout flow works identically before and after migration
- [ ] `USE_REDIS_SESSIONS=false` falls back to in-process store cleanly
- [ ] Integration test covering session creation, read, and expiry""",
    },
    {
        "title": "pnpm dev:all-services health check script",
        "project": "platform",
        "state": STATE_TODO,
        "priority": PRIORITY_LOW,
        "desc": """### Core Objective
Create a one-command health check script that verifies all required local services are running and reachable before development begins. Eliminates "why is dev broken?" debugging time.

### Technical Design Specs
- **Script**: `scripts/dev/health-check.sh`
- **Checks**: Port 5173 (Astro), 27017 (MongoDB), 6379 (Redis), 5432 (PostgreSQL)
- **Output**: Colored ✅/❌ status per service with recovery instructions on failure
- **Integration**: Automatically run at start of `pnpm dev:all-services`

### Atlassian & Code Linkages
- **Script**: `scripts/dev/health-check.sh` [NEW]
- **Package Script**: `package.json` `dev:all-services` target

### Verification & Testing Checklist
- [ ] Script reports ✅ for all services when all Docker containers running
- [ ] Script reports ❌ with actionable message when a service is down
- [ ] Script exits with non-zero code if any required service missing
- [ ] `pnpm dev:all-services` runs health-check first""",
    },
    {
        "title": "HIPAA: structured audit log for all PHI-adjacent API calls",
        "project": "governance",
        "state": STATE_TODO,
        "priority": PRIORITY_HIGH,
        "desc": """### Core Objective
Implement a tamper-evident structured audit log capturing all API calls that read or write PHI-adjacent data (session content, memory records, patient notes). Required for HIPAA compliance.

### Technical Design Specs
- **Log Format**: JSON with `timestamp`, `user_id`, `action`, `resource_type`, `resource_id`, `ip_address`, `outcome`
- **Storage**: Append-only PostgreSQL table `audit_log` with row-level security
- **Coverage**: All routes under `/api/memory/*`, `/api/session/*`, `/api/notes/*`
- **Retention**: 7 years per HIPAA requirement
- **Tamper-evidence**: SHA-256 hash chain linking log entries

### Atlassian & Code Linkages
- **Middleware**: `src/middleware/audit-log.ts` [NEW]
- **DB Migration**: `migrations/add_audit_log_table.sql` [NEW]

### Verification & Testing Checklist
- [ ] All PHI-adjacent routes emit audit events
- [ ] Audit log is append-only (no UPDATE/DELETE on audit rows)
- [ ] Hash chain validated across 1000 consecutive entries
- [ ] Audit records survive server restart and DB connection reset
- [ ] Unit tests cover all audit event types""",
    },
    {
        "title": "Training data provenance: attach source metadata to all records",
        "project": "dataset",
        "state": STATE_TODO,
        "priority": PRIORITY_HIGH,
        "desc": """### Core Objective
Ensure every training record carries provenance metadata: where it came from, when it was acquired, what processing was applied, and what license governs it. Required for compliance and reproducibility.

### Technical Design Specs
- **Provenance Schema**: `{"source_url": str, "source_type": str, "acquired_at": datetime, "pipeline_version": str, "license": str, "transformations": list[str]}`
- **Integration**: All ingestion scripts (YouTube, book, SDG) must attach provenance at record creation
- **Storage**: Provenance stored in JSONL alongside training data and in MongoDB `provenance` collection
- **Query**: `scripts/devops/query-provenance.py --source-type youtube --license CC-BY` style lookups

### Atlassian & Code Linkages
- **Schema**: `ai/training/provenance.py` [NEW]
- **Integration**: `ai/training/youtube_ingestion.py`, `ai/training/sdg_pipeline.py`

### Verification & Testing Checklist
- [ ] All new training records include provenance block
- [ ] Backfill script adds provenance to existing records where source is known
- [ ] Provenance query script returns correct filtered results
- [ ] License field validated against allowed SPDX identifiers""",
    },
    {
        "title": "Model registry with versioning and rollback tagging",
        "project": "training",
        "state": STATE_BACKLOG,
        "priority": PRIORITY_MEDIUM,
        "desc": """### Core Objective
Implement a lightweight model registry that tags every fine-tuned checkpoint with metadata (training run ID, dataset version, eval scores) and supports one-command rollback to any previous checkpoint.

### Technical Design Specs
- **Registry**: JSON manifest at `training/registry/models.json` listing all published checkpoints
- **Tagging**: Each checkpoint tagged with `run_id`, `base_model`, `dataset_version`, `clinical_validity_score`, `timestamp`
- **Storage**: Checkpoints in S3 (existing bucket) with path `models/{run_id}/{checkpoint}/`
- **Rollback**: `scripts/devops/rollback-model.sh {run_id}` pulls checkpoint and updates symlink
- **CLI**: `uv run python scripts/devops/model-registry.py list|tag|rollback`

### Atlassian & Code Linkages
- **Registry CLI**: `scripts/devops/model-registry.py` [NEW]
- **Rollback Script**: `scripts/devops/rollback-model.sh` [NEW]
- **Registry Manifest**: `training/registry/models.json` [NEW]

### Verification & Testing Checklist
- [ ] `model-registry.py list` shows all checkpoints with scores
- [ ] `model-registry.py tag` correctly writes metadata to manifest
- [ ] `rollback-model.sh` restores checkpoint and updates active symlink
- [ ] Rollback survives concurrent training run (no file corruption)""",
    },
    {
        "title": "E2E: therapist dashboard → session → memory write → retrieval flow",
        "project": "test_security",
        "state": STATE_TODO,
        "priority": PRIORITY_HIGH,
        "desc": """### Core Objective
Implement an end-to-end test covering the full clinical user journey: therapist logs in, opens session, session content is written to memory, and memory is retrievable in subsequent session context.

### Technical Design Specs
- **Framework**: Playwright (existing `pnpm e2e` setup)
- **Flow**:
  1. Therapist auth → dashboard load
  2. Open/create session with mock patient
  3. Add session note (writes to `/api/memory/*`)
  4. Close and reopen session
  5. Assert session context shows previous note
- **Fixtures**: Isolated test user + patient seeded in test DB
- **CI**: Runs in `pnpm e2e` against local dev server

### Atlassian & Code Linkages
- **Test File**: `tests/e2e/therapist-session-memory.spec.ts` [NEW]
- **Fixtures**: `tests/fixtures/clinical-session.ts` [NEW]

### Verification & Testing Checklist
- [ ] Test passes end-to-end in local environment
- [ ] Test passes in CI with Docker services running
- [ ] Session note persists correctly across session close/reopen
- [ ] Memory write failure causes test to fail (not silently pass)
- [ ] Test cleans up created records after run""",
    },
    {
        "title": "Automated dependency vulnerability scan in CI (pnpm + uv audit)",
        "project": "test_security",
        "state": STATE_TODO,
        "priority": PRIORITY_HIGH,
        "desc": """### Core Objective
Make dependency vulnerability scanning a required, automated CI gate — not just a manual one-off. Block PRs if any high or critical vulnerabilities are introduced.

### Technical Design Specs
- **JS/TS**: `pnpm audit --audit-level=high` in GitHub Actions on every PR
- **Python**: `uv audit` (or `pip-audit`) in Bitbucket pipeline on every PR
- **Containers**: `trivy image` scan on Docker build in CI
- **Exemptions**: Tracked in `.auditignore` with justification comment and expiry date

### Atlassian & Code Linkages
- **GitHub Workflow**: `.github/workflows/security.yml` (extend existing)
- **Bitbucket Pipeline**: `bitbucket-pipelines.yml` (extend existing)
- **Exemption File**: `.auditignore` [NEW]

### Verification & Testing Checklist
- [ ] `pnpm audit` runs and passes on clean deps
- [ ] `uv audit` runs and passes on clean deps
- [ ] Introducing a known-vulnerable package causes CI to fail
- [ ] Exemption in `.auditignore` correctly suppresses known acceptable CVEs
- [ ] Audit results posted as PR comment""",
    },
    {
        "title": "TypeScript strict mode — module-by-module migration tracker",
        "project": "test_security",
        "state": STATE_BACKLOG,
        "priority": PRIORITY_MEDIUM,
        "desc": """### Core Objective
Systematically migrate all TypeScript modules to `strict: true`, one module per sprint, using a tracked checklist so progress is visible and regressions are caught immediately.

### Technical Design Specs
- **Approach**: Per-directory `tsconfig.json` overrides enabling strict mode incrementally
- **Order**: Start with `packages/` (isolated), then `src/lib/`, then `src/pages/api/`, then `src/components/`
- **Gate**: Each migrated directory added to `strict` list in root `tsconfig.json`
- **Tracking**: This ticket as the tracker; sub-tasks created per directory

### Atlassian & Code Linkages
- **TSConfig**: `tsconfig.json`

### Verification & Testing Checklist
- [ ] `packages/memory-schema` migrated to strict — 0 errors
- [ ] `packages/pixelated-sdk` migrated to strict — 0 errors
- [ ] `src/lib/` migrated to strict — 0 errors
- [ ] `src/pages/api/` migrated to strict — 0 errors
- [ ] `src/components/` migrated to strict — 0 errors
- [ ] `pnpm typecheck` passes with strict enabled globally""",
    },
]

created_ticket_ids: dict[str, str] = {}  # title -> uuid

for ticket in new_tickets:
    logging.info("\nCreating ticket: %s", ticket["title"])
    tid = create_issue(
        IssueSpec(
            title=ticket["title"],
            description=ticket["desc"],
            project_id=PROJECTS[ticket["project"]],
            state_id=ticket["state"],
            priority=ticket["priority"],
        )
    )
    if tid:
        created_ticket_ids[ticket["title"]] = tid


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Organizational Hygiene
# ══════════════════════════════════════════════════════════════════════════════
logging.info("\n" + "═" * 60)
logging.info("STEP 3: Organizational hygiene — triage sweep + cancel stale")
logging.info("═" * 60)

# 3a. Cancel stale/invalid ticket PIX-242
pix_242 = issue_map.get("PIX-242")
if pix_242:
    logging.info("\nCanceling PIX-242 (not a valid actionable ticket)...")
    update_issue(pix_242["id"], "PIX-242", stateId=STATE_CANCELED)

# 3b. Set priorities and move Triage items to Backlog with correct priority
triage_fixes = [
    # key, priority, new_state, note
    ("PIX-318", PRIORITY_HIGH, STATE_BACKLOG, "Blocked on memory gateway stabilization (PIX-328)"),
    ("PIX-331", PRIORITY_HIGH, STATE_BACKLOG, "Phase 2 AutoReview — begins after Phase 1 ships"),
    ("PIX-332", PRIORITY_MEDIUM, STATE_BACKLOG, "Phase 3 AutoReview — blocked on Phase 2"),
    ("PIX-333", PRIORITY_MEDIUM, STATE_BACKLOG, "Phase 4 AutoReview — blocked on Phase 3"),
    ("PIX-334", PRIORITY_LOW, STATE_BACKLOG, "Phase 5 AutoReview — long horizon"),
    ("PIX-338", PRIORITY_LOW, STATE_BACKLOG, "Low priority enhancement — begin after Phase 1 ships"),
    ("PIX-339", PRIORITY_MEDIUM, STATE_BACKLOG, "Blocked on AutoReview Phase 1 completion"),
    ("PIX-346", PRIORITY_MEDIUM, STATE_BACKLOG, "Blocked on AutoReview Phase 1 completion"),
    ("PIX-347", PRIORITY_MEDIUM, STATE_BACKLOG, "Blocked on AutoReview Phase 1 completion"),
    ("PIX-534", PRIORITY_LOW, STATE_BACKLOG, "Iteration cycle — activates after fine-tune evaluation"),
]

for key, priority, new_state, reason in triage_fixes:
    issue = issue_map.get(key)
    if issue:
        logging.info("\nFixing triage: %s — %s", key, reason)
        update_issue(issue["id"], key, stateId=new_state, priority=priority)

# 3c. Set blocking relationships for AutoReview phases
# PIX-331 blocks on PIX-341/342/344/345 (Phase 1 completion)
autoreview_phase1_keys = ["PIX-341", "PIX-342", "PIX-344", "PIX-345"]
pix_331 = issue_map.get("PIX-331")
if pix_331:
    for phase1_key in autoreview_phase1_keys:
        phase1_issue = issue_map.get(phase1_key)
        if phase1_issue:
            logging.info("\nLinking %s as blocker for PIX-331...", phase1_key)
            add_relation(phase1_issue["id"], pix_331["id"], "blocks")

# PIX-332 blocked by PIX-331
pix_332 = issue_map.get("PIX-332")
if pix_331 and pix_332:
    logging.info("\nLinking PIX-331 as blocker for PIX-332...")
    add_relation(pix_331["id"], pix_332["id"], "blocks")

# PIX-333 blocked by PIX-332
pix_333 = issue_map.get("PIX-333")
if pix_332 and pix_333:
    add_relation(pix_332["id"], pix_333["id"], "blocks")

# PIX-334 blocked by PIX-333
pix_334 = issue_map.get("PIX-334")
if pix_333 and pix_334:
    add_relation(pix_333["id"], pix_334["id"], "blocks")

# PIX-318 blocked by PIX-328 (memory gateway)
pix_318 = issue_map.get("PIX-318")
pix_328 = issue_map.get("PIX-328")
if pix_318 and pix_328:
    logging.info("\nLinking PIX-328 as blocker for PIX-318 (SDK needs gateway)...")
    add_relation(pix_328["id"], pix_318["id"], "blocks")

# PIX-346, PIX-347, PIX-339 all blocked on PIX-341/342/344/345 (Phase 1)
deferred_on_phase1 = ["PIX-346", "PIX-347", "PIX-339", "PIX-338"]
for deferred_key in deferred_on_phase1:
    deferred = issue_map.get(deferred_key)
    if deferred and pix_331:
        add_relation(pix_331["id"], deferred["id"], "blocks")

# 3d. Link PIX-232 (Blocking gaps remediation) to the training test tasks
pix_232 = issue_map.get("PIX-232")
training_test_keys = ["PIX-424", "PIX-426", "PIX-428", "PIX-472", "PIX-473", "PIX-475", "PIX-476", "PIX-480"]
if pix_232:
    logging.info("\nLinking PIX-232 as related to training test tasks...")
    for test_key in training_test_keys:
        test_issue = issue_map.get(test_key)
        if test_issue:
            add_relation(pix_232["id"], test_issue["id"], "related")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Summary
# ══════════════════════════════════════════════════════════════════════════════
logging.info("\n" + "═" * 60)
logging.info("STEP 4: Summary")
logging.info("═" * 60)

logging.info("\n✅ Epics created: %d", len(created_epics))
for name in created_epics:
    logging.info("   • %s", name)

logging.info("\n✅ New tickets created: %d", len(created_ticket_ids))
for title in created_ticket_ids:
    logging.info("   • %s", title)

logging.info("\n✅ Triage items fixed: %d", len(triage_fixes))
logging.info("✅ PIX-242 canceled (stale question-as-ticket)")
logging.info("✅ Blocking relationships set for AutoReview phase chain")
logging.info("✅ PIX-232 linked to 8 training test tasks")

if DRY_RUN:
    logging.info("\n[DRY RUN MODE — no changes applied to Linear]")
