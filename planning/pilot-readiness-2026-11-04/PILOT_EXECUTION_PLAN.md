# Pixelated Empathy Pilot — Execution Plan

Status snapshot: **2026-11-04**. This plan turns the project outline's launch
packages into one execution sequence for the accepted bounded training pilot.
It is a local plan, not a release approval or customer offer. Current
decision: **NO-GO; enrollment and customer launch are not authorized.** See
[`LAUNCH_DECISIONS.md`](LAUNCH_DECISIONS.md) for the evidence-backed package
register and owner decisions.

## Accepted scope and remaining decisions

On 2026-11-04 the user accepted the starting scope: **one training program,
5–10 trainees, 3–5 synthetic scenarios, 2–4 weeks**. One faculty champion
remains a proposed requirement. The target institution and buyer, named owners,
scenario/rubric, data terms, measurement thresholds, support coverage and
commercial terms remain owner decisions. Recommended reversible defaults are
recorded in `LAUNCH_DECISIONS.md`; they are not customer or founder approvals.
No launch date is supported; estimate only after owners and scope details are
confirmed.

Training only. No clinical care, real patient data, diagnosis/treatment, or
emergency monitoring. EHR, prescribing, payer and scheduling tools stay outside
this pilot; their disabled boundary still needs verification. Do not enroll
until G1–G5 pass with current evidence. G6 is the post-pilot continuation
decision.

## Gate board

| Gate | Exit condition | Current state |
| --- | --- | --- |
| G1 — Product boundary | Accepted written scope names buyer/user roles and accountable owners; fixes the included route, 3–5 scenarios, synthetic-data boundary, measures and stop conditions. | **OWNER DECISION.** Cohort/scenario-count/duration envelope accepted; actual buyer, named owners, faculty champion, skill/rubric, data terms and thresholds remain unapproved. |
| G2 — Working journey | On one pinned release, L02–L05 pass: deploy/rollback evidence, two-organization access boundary, full trainee-to-faculty journey with persisted readback and failure recovery, and event-backed cohort measures. | **OPEN.** The page now uses an authenticated same-origin message API and Postgres message storage/readback; local route tests pass. Migration 017 is applied to the configured Neon database; its environment is unverified. Session creation/context population, client replies, evidence-grounded coaching, faculty access/review, production release, cross-organization verification, reconnect, and cohort measures remain unproven. |
| G3 — Evaluation and release | L06–L10 pass for the included bundle: frozen scenarios/rubric, model-policy-tool manifest, fresh evaluation, disabled-tool boundary, source rights/splits, and explicit promotion decision with reviewer provenance. | **OPEN.** October 25 handoff records narrow v74 synthetic mocked checks and review, while explicitly keeping the candidate unpromoted. No pilot-specific frozen bundle/rubric, broader fresh evaluation, tool-boundary proof, rights package or release decision is established. Reviewer availability for this candidate is unconfirmed. |
| G4 — Privacy, security and operations | L03/L11/L12 pass: tenant isolation, consent/retention/access/deletion, current security results, restore/alerts, named response owner and incident/rollback rehearsal. | **OPEN.** Local L03 fixes and tests exist; release-level tenant isolation, lifecycle, security, restore, alert, incident/rollback and named-owner evidence remain missing. |
| G5 — Honest, supportable offer | L13–L15 pass: measured operating limits/cap, written price/usage/support/data/procurement terms, and public/demo claims matched to evidence. | **OPEN / OWNER DECISION.** Reviewed homepage and Empathy Gym copy were corrected; full surface audit, operating limits, and offer terms/support owner remain unapproved. |
| G6 — Learning and continuation | After an approved pilot, L16 records agreed baseline, observed results, faculty feedback, support/cost and a paid-continuation or no-go decision. | **Not started.** Depends on G1–G5 and an actual customer pilot. |

## Work package crosswalk

The owner column contains proposed roles, not assigned people. Keep issue
identities and history in the existing task ledger and ACTION_MAP; these rows
are acceptance packages, not duplicate tickets. Dependencies come from
`PROJECT_OUTLINE.md`.

| ID | Gate | Proposed owner | Depends on | Exit evidence and current state |
| --- | --- | --- | --- | --- |
| L01 | G1 | Product/founder | — | Signed scope, named owners, buyer/users, routes/scenarios, data boundary, measures and stop rules. Scope size accepted; named buyer/owners and terms remain open. |
| L02 | G2 | Platform | L01 | Four-repo commit manifest; successful CI/EKS deploy, health and rollback; PIX-4751/4795/4814 linked to later equivalent success or reproduced blocker. Open; tracker details stale. |
| L03 | G2, G4 | Security + application | L01, L02 | **OPEN:** progress and snapshot handlers now require authentication and restrict reads/writes to `therapist_id`; focused tests cover unauthenticated and owner-scoped requests. Verify against two real isolated organizations and the pinned release; supervisor sharing still needs an explicit same-program policy. |
| L04 | G2 | Application + QA | L02, L03, L07 | **OPEN:** authenticated page read, owner-checked message POST, Postgres trainee-message persistence, and reload readback are implemented locally. Deploy the new migration; add approved session creation/context population, automated synthetic-client replies and transcript-grounded coaching, faculty access/review and failure/reconnect coverage; then prove the complete journey on a pinned release. |
| L05 | G2 | Application/data | L01, L02 | Persisted events and cohort metrics reconcile to source events; mocked metrics/exports are unavailable or clearly excluded. Open; no active task records mapped. |
| L06 | G3 | Clinical education + evaluation | L01 | Versioned 3–5 scenario subset and supervisor rubric; feedback points to transcript evidence; disagreement and calibration method recorded. Open. |
| L07 | G3 | ML/evaluation | L01, L06 | Frozen model/policy/tool and dataset/version manifest with provenance and reproducible run IDs; candidate remains unpromoted until decision. Open. |
| L08 | G3 | ML + qualified reviewer | L06, L07 | Fresh pre-specified evaluation covers ordinary distress, role fidelity, task success and safety; critical failures/missing outputs and reviewer provenance reported; explicit promote/hold decision. Open. |
| L09 | G3 | Integration + QA | L01, L03, L07 | Scheduling/external tools excluded from this offer; prove they are disabled and cannot report false completion. Exclusion alone does not pass the boundary test. Open; no active task records mapped. |
| L10 | G3 | Data governance | L01, L07 | Release-specific source/rights manifest, leakage-resistant split and registry/artifact links; resolve PIX-4583/4584 against current evidence and preserve research authorization/holdouts. Open. |
| L11 | G4 | Security/data | L01, L03 | Tested collection/access/retention/export/deletion and audit lifecycle, including actual memory deletion; sample patient-export path is excluded or replaced. Open; release-level evidence remains missing. |
| L12 | G4 | Platform/security | L02, L03 | Current blocking security results, backup/restore proof, alert delivery and incident/rollback rehearsal; named responder and escalation route. Open. |
| L13 | G5 | Product analytics + platform | L04, L05, L07 | Completed-session, retry, faculty review, error, latency and cost measures reconcile; accepted operating limits and usage cap tested. Open; no active task records mapped. |
| L14 | G5 | Founder/commercial | L01, L11, L13 | Written pilot offer with accepted price hypothesis, seats/usage, onboarding, support hours, procurement/data terms and renewal decision; unsupported guarantees removed. Open; only optional discovery source records mapped. |
| L15 | G5 | Product/commercial | L04–L08, L12, L14 | **OPEN:** homepage and Empathy Gym copy now state the verified training-only proposal and no enrollment offer. Audit remaining public/demo/sales material and approve a claim-to-evidence matrix. |
| L16 | G6 | Founder + customer success | G1–G5 | Signed scope, faculty champion, enrolled cohort, baseline rubric, structured feedback and measured results; document paid continuation or no-go. Not started; no active task records mapped. |

## Dependency order

1. **Finish G1:** record the accepted cohort/scenario-count/duration; name the
   target program/buyer and owners; confirm whether one faculty champion is
   available; freeze data boundaries, measures, stop rules and scenario rubric.
2. **Build one release baseline:** L02. Preserve incident identity; do not close
   a failure ticket from an unrelated green run.
3. **Run parallel readiness work against that baseline:** L03/L11/L12 for
   privacy/security/operations; L06/L07/L10 for scenario, bundle and data; L05
   for event-backed measurement. L04 consumes L02 + L03 + L07. L08 consumes
   L06 + L07; L09 verifies excluded integrations are disabled.
4. **Rehearse:** pass G2–G4 with synthetic data, actual services, a failure and
   rollback. Assemble one release evidence bundle and make a go/no-go decision.
5. **Prepare the offer:** L13–L15 after technical limits are measured; customer
   discovery and truthful messaging can run alongside engineering. Do not
   promise terms until support, data and procurement owners accept them.
6. **Enroll only after G1–G5 pass:** L16. After the cohort, evaluate learning,
   faculty value, support burden and unit cost; decide paid continuation or
   no-go (G6). Expansion requires that decision.

## Tracker freshness and source coverage

The local outline/task package is dated **2026-11-02**. A direct, read-only
Linear GraphQL refresh using the existing `LINEAR_API_KEY` in the project
`.env` completed on **2026-11-04**, without a browser or tracker writes. The
metadata-only snapshot contains **1,089 PIX issues across 11 pages**, including
**679 archived** issues. Current workflow states are 798 completed, 253
canceled, 22 backlog, 12 triage and 4 started. All 1,089 rows have an issue
identifier and status. Linear's `IssueConnection` does not expose `totalCount`;
pagination reached `hasNextPage: false` and the CSV contains the accumulated
page count. See `evidence/linear-status-2026-11-04.csv` and
`evidence/linear-refresh-review.md` for the snapshot and reconciliation.

Against the November 2 task ledger, all **1,073** recorded Linear issue IDs
remain present, UUIDs match, and none of their statuses changed. The live
tracker has **16** additional issues since that ledger snapshot (PIX-4824 to
PIX-4839). Against the narrower 139-row ACTION_MAP, all 104 candidate issue
statuses match; 985 current issues are outside that launch-task map. Those
records are not automatically pilot work: preserve the map's existing scope
and identity rules. The 16 recent issues should be reviewed for launch impact
only when their concrete acceptance evidence intersects L01-L16.

The 139-row ACTION_MAP snapshot includes **zero active source records for L05,
L09, L13 and L16**. L04/L15 references are limited and historical; L14 has only
optional discovery records. Source tickets are evidence/provenance, not proof
that these packages pass. Create or link execution records for these gaps only
after checking the refreshed snapshot and confirming there is no equivalent
existing task; do not duplicate work.

## No-go conditions

- Any real patient data, PHI or clinical-care use enters the pilot.
- Cross-tenant access succeeds, a consent/tool boundary fails, session deletion
  is not real, or a demo/mock is mistaken for a live result.
- The exact model/policy/tool bundle lacks a fresh evaluation and explicit
  qualified-reviewer decision.
- The technical fix is deployed, but rollback, backup/restore, release-specific
  security checks, alerting and incident response cannot yet be demonstrated
  on the pinned release.
- No named person accepts support coverage, data terms, customer-facing claims
  and the commercial offer.

Pause enrollment and require documented review before resuming. Do not infer a
launch date from this plan; owners must estimate after G1 and the release path
are confirmed.

## Route implementation status

`.github/copilot-instructions.md` requires prior approval for changes to
“authentication, security controls” and “public API contracts, routing
architectures, or CI/CD pipelines.” The user explicitly approved the scoped
session authorization and missing training-session read route changes. They
are covered by focused tests and deployed to production under commit
`f497d82ce`. The remaining G2/G4 proof still requires cross-organization and
release/operations verification. No enrollment or customer launch is
authorized.
