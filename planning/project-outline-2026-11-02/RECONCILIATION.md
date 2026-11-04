# Task reconciliation — 2026-11-02

Accounted for **1073 Linear + 1106 GitHub = 2179 source records** exactly once
in **2082 canonical rows**. Linear: {'Done': 783, 'Triage': 11, 'Backlog': 22,
'Canceled': 253, 'In Review': 1, 'In Progress': 3}. GitHub: {'OPEN': 102,
'CLOSED/NOT_PLANNED': 257, 'CLOSED/COMPLETED': 712, 'CLOSED/DUPLICATE': 35}.
Completed means tracker-reported only; canceled and CLOSED/NOT_PLANNED are
distinct from completed.

## Identity and disagreement rules

Read source-id UUIDs only within pixelated-sync comment blocks, then inspect
explicit linear.app/…/issue/PIX-ID links. Merge only when IDs agree and
normalized titles agree (case-fold, punctuation to spaces). Conflicting IDs,
unknown UUIDs, or title mismatches remain separate canonical rows for manual
review. Exact normalized titles alone are candidate duplicates, never merges.
crosswalk.json retains every reference and comparison. Status comparison uses
completed → CLOSED/COMPLETED, canceled → CLOSED/NOT_PLANNED, other → OPEN;
ambiguous candidates are counted separately from valid merged disagreements.

Matching methods: {'source-uuid': 97, 'manual-review': 60, 'unlinked': 949}.
Identity conflicts: 49; title conflicts: 8; status disagreements among all
candidates: 50, among merged identities: 39. Missing any Linear reference: 949;
unresolved references: 47; exact-title candidate rows left separate: 913.

## Internal planning catalog

Recursively enumerated 892 files, including hidden/ignored folders; cataloged
488 safe planning documents (Markdown/MDX/CSV plus task-named JSON/TXT) and
recorded 404 exclusions without opening their content. Found 94 exact duplicate
documents by SHA-256. Extracted 4520 checklist rows (2248 checked, 2272
unchecked), of which 2433 occur in plan/status documents. Reusable procedures,
Checkmate, archives, and reference documents do not become product backlog.
Every row has path:line provenance and historical-only flags. File
classifications use directory/name heuristics:
workflow/runbook/template/skills/guides are reusable;
archive/sessions/comparisons/audits are historical; Checkmate/check2 are
separate product; plans/data/roadmaps/status/task documents are plan/status;
remainder requires reference triage.

March Asana and P0-P23 plans are historical and superseded by
`.agent/internal/data/15-finish-the-game-plan.md`; they remain cataloged for
traceability. Model authority is the tail of
`docs/training/execution-2026-10-21/CAMPAIGN_HANDOFF.md:338-360`: v74 remains
unpromoted. Old v45/v47 reports are not latest-status evidence. Narrow mocked
checks are not promotion or independent clinical clearance. Repository inventory
is a current snapshot; earlier unrecorded dirty files cannot be attested from
the later baseline.

## Consolidated action map

ACTION_MAP.json/CSV and ACTIVE_TASKS.md account for all 37 active Linear plus
all 102 open GitHub records once. Planning groups follow the 16 launch packages
in PROJECT_OUTLINE.md plus separate/optional/history groups. Unique
normalized-title matches may inherit Linear project context and planning
treatment while identity remains unmerged. A Done/Canceled title candidate
triggers historical reconciliation, not a new implementation task. Ambiguous
title candidates remain listed for triage. Extracted 53 CSV task rows and 316
allowlisted structured local task records with provenance; local statuses are
historical.

## Workstream heuristic

Ordered title/project keyword matching assigns foresight, alexa-optional,
ehr-adjacent, security-privacy, model-evaluation, corpus-data,
developer-api-memory, commercial-pilot, infrastructure-ci, developer-tooling,
governance, then core-training-product. Unmatched rows are deferred-offscope
with triage_required, not a decision to discard them. This is a conservative
planning aid, not an architectural dependency proof.

## Project dispositions

| Project                                                                                                                                                                                      | Tracker status | Issues | Recommendation                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -----: | -------------------------------------------------------------------------------------------------- |
| [alexa-submit](https://linear.app/pixelated/project/alexa-submit-f3e655ed7d06)                                                                                                               | To Do          |     12 | Separate workstream; defer from core training launch unless a concrete dependency is proved.       |
| [Steering & Adaptive Development Loop](https://linear.app/pixelated/project/steering-and-adaptive-development-loop-764dbea100df)                                                             | Completed      |      1 | Archive planning view after evidence review; preserve issue history and reopen only explicit gaps. |
| [EHR Module Add-On](https://linear.app/pixelated/project/ehr-module-add-on-78f290569157)                                                                                                     | Completed      |     64 | Separate workstream; defer from core training launch unless a concrete dependency is proved.       |
| [Stub & Technical Debt Remediation](https://linear.app/pixelated/project/stub-and-technical-debt-remediation-3b971b825d71)                                                                   | Completed      |     32 | Retain for core-product gate review; status does not prove delivery.                               |
| [AI Training Pipeline](https://linear.app/pixelated/project/ai-training-pipeline-44f334455738)                                                                                               | To Do          |    150 | Retain for core-product gate review; status does not prove delivery.                               |
| [Foresight](https://linear.app/pixelated/project/foresight-bf8c21fea3e8)                                                                                                                     | To Do          |     18 | Separate workstream; defer from core training launch unless a concrete dependency is proved.       |
| [px CLI + Git Hook Integration](https://linear.app/pixelated/project/px-cli-git-hook-integration-0681fb026edf)                                                                               | Completed      |      9 | Archive planning view after evidence review; preserve issue history and reopen only explicit gaps. |
| [Project Nightmare Fuel (V7 Scale)](https://linear.app/pixelated/project/project-nightmare-fuel-v7-scale-039c7a1d779c)                                                                       | Completed      |     15 | Archive planning view after evidence review; preserve issue history and reopen only explicit gaps. |
| [PAL Framework → 100% Roadmap](https://linear.app/pixelated/project/pal-framework-100percent-roadmap-41c9e00676bd)                                                                           | Completed      |      8 | Archive planning view after evidence review; preserve issue history and reopen only explicit gaps. |
| [ML & Platform Remediation Sprint](https://linear.app/pixelated/project/ml-and-platform-remediation-sprint-feac411ebbe1)                                                                     | Completed      |      9 | Archive planning view after evidence review; preserve issue history and reopen only explicit gaps. |
| [Vertical Fidelity Stack Implementation](https://linear.app/pixelated/project/vertical-fidelity-stack-implementation-940abc410664)                                                           | Completed      |     18 | Archive planning view after evidence review; preserve issue history and reopen only explicit gaps. |
| [Enterprise Readiness Program](https://linear.app/pixelated/project/enterprise-readiness-program-a3d18e977dfe)                                                                               | Completed      |     40 | Archive planning view after evidence review; preserve issue history and reopen only explicit gaps. |
| [Training Pipeline v2 — Audit Remediation](https://linear.app/pixelated/project/training-pipeline-v2-audit-remediation-5d8c8b65d816)                                                         | Completed      |      3 | Archive planning view after evidence review; preserve issue history and reopen only explicit gaps. |
| [AI Research-Clinical Integration](https://linear.app/pixelated/project/ai-research-clinical-integration-b7778f7f5d30)                                                                       | Completed      |      8 | Archive planning view after evidence review; preserve issue history and reopen only explicit gaps. |
| [Churnmeon Reliability](https://linear.app/pixelated/project/churnmeon-reliability-8d3df056b892)                                                                                             | Completed      |     17 | Retain for core-product gate review; status does not prove delivery.                               |
| [CPTSD Dataset Quality & Coverage Improvement](https://linear.app/pixelated/project/cptsd-dataset-quality-and-coverage-improvement-369106ad5d0b)                                             | Completed      |      0 | Archive planning view after evidence review; preserve issue history and reopen only explicit gaps. |
| [Phase 1 Completion: Final Dataset Assembly & Validation (85% → 100%)](https://linear.app/pixelated/project/phase-1-completion-final-dataset-assembly-and-validation-85percent-6b471d549bef) | Canceled       |      0 | Archive planning view after evidence review; preserve issue history and reopen only explicit gaps. |
| [Pixelated Empathy Model Training](https://linear.app/pixelated/project/pixelated-empathy-model-training-5b3895d8ad91)                                                                       | Canceled       |      0 | Archive planning view after evidence review; preserve issue history and reopen only explicit gaps. |

## Reproduction and limits

Run
`uv run python /home/vivi/.codex/task-runs/pixelated-outline-20261102/reconcile.py`
from the workspace. Input hashes are recorded in manifest.json; raw exports
remain in the global task-run evidence directory, not this package. Source
bodies/descriptions are never copied to tracker artifacts. Local checklist text
is retained from safe planning files. Repository status artifacts capture dirty
state without altering it.

- Local checklist marks are historical assertions, never implementation proof.
- Source exports are a sequential snapshot, not an atomic transaction.
- Linear descriptions can be truncated; identity uses GitHub sync metadata and
  explicit issue links.
- Title equality is required for identity merges; title drift remains separate
  pending human review.
- Keyword categories are provisional; deferred-offscope includes unclassified
  work requiring triage.
- Sensitive files and files outside Markdown/CSV or task-named JSON/TXT are
  excluded before content reads; no dataset payload or transcript inventory.
- CSV task descriptions and assignees omitted; remaining fields and row
  provenance extracted. Safe task/plan/roadmap/status/checklist JSON/TXT names
  are cataloged; JSON fields are allowlisted. Local source status remains
  historical.
