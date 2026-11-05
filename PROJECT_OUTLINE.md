# Pixelated Empathy — Project Outline

Inventory snapshot: **2026-11-02**. Pilot readiness update: **2026-11-04**.
Decision: **NO-GO; enrollment and customer launch are not authorized.** The
bounded institutional training pilot remains a proposal and general
availability is not established. This is the consolidated
planning baseline for the application, AI engine, Foresight, documentation,
Linear, GitHub, and internal plans.

## Where we are

Pixelated has substantial implementation and research behind it. The remaining
problem is proving that a coherent, supported product works for the first
customer. A completed issue, a passing synthetic evaluation, and a released
customer workflow are three different states.

| Measure                       | Observed snapshot                                    | What it means                                                                     |
| ----------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| Linear PIX issues             | 1,073: 783 Done, 253 Canceled, 37 active             | Historical delivery record, not a product completion score                        |
| Linear PIX projects           | 18                                                   | Several project statuses disagree with their issue-level work                     |
| GitHub root issues            | 1,105: 102 open, 1,003 closed                        | Includes stale mirrors and work absent from the active Linear list                |
| Submodule GitHub issues       | Foresight: one closed; AI/docs: zero                 | All four feeds were queried to their terminal page                                |
| Code inventory                | Root plus AI, Foresight and docs; no nested gitlinks | All repository boundaries and tracked domains inventoried; critical paths sampled |
| Current model/policy evidence | Campaign handoff reaches v74, October 30             | Narrow consent/tool repairs progressed; candidates remain unpromoted              |
| Deployed launch readiness     | Not established by this audit                        | Technical training/auth fix shipped; customer, billing and clinical validation remain open |

Do **not** turn 783 Done issues into “73% product complete,” or remove canceled
work from the denominator and call the result “95% ready.” Neither number
measures a working release. Measure progress against the six launch gates below
and the selected customer journey.

**Pilot execution update (2026-11-04): NO-GO.** Production commit `f497d82ce`
ships session-route ownership checks, an authenticated same-origin
training-message API, and Postgres trainee-message storage/readback. Migration
017 is applied to the production app database. Session creation, approved scenarios,
automated client replies, transcript-grounded coaching, faculty review,
cross-organization verification and pinned-release evidence remain open. The
gate-by-gate record and verification are in
[`planning/pilot-readiness-2026-11-04/LAUNCH_DECISIONS.md`](planning/pilot-readiness-2026-11-04/LAUNCH_DECISIONS.md).

The [task ledger](planning/project-outline-2026-11-02/task-ledger.csv) retains
completed and canceled history alongside remaining work. The
[active task review](planning/project-outline-2026-11-02/ACTIVE_TASKS.md) covers
the live backlog;
[reconciliation](planning/project-outline-2026-11-02/RECONCILIATION.md) explains
matches, disagreements and pruning. These are a snapshot, not a replacement for
live issue states.

## Product and scope

The strongest consistent product direction is **supervised practice for
mental-health professionals in training**: a trainee rehearses a difficult
interaction, receives grounded feedback, retries the difficult turn, and a
supervisor reviews what happened. This follows the
[current landing page](apps/web/src/pages/index.astro) and
[Empathy Gym documentation](docs/product/empathy-gym.mdx).

**Proposed first customer:** one institutional program with a faculty champion,
a small named cohort, and a concrete teaching use case. This is a planning
assumption for focus, not evidence of a signed customer. Validate the buyer,
procurement path and willingness to pay before committing to a broad rollout.

**First-release journey:** invitation → sign-in → assigned synthetic scenario →
interaction → evidence-grounded feedback → supervised retry → saved session →
faculty review → support or deletion request. Each visible step must use the
released services and real persistence. Unsupported features must be disabled or
explicitly presented as demonstrations.

| Product lane                                             | Release treatment                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Training application and selected simulation scenarios   | Pilot critical path                                                                                |
| AI generation, evaluation, safety and source eligibility | Release dependencies; research progress alone does not pass them                                   |
| Foresight                                                | Verify the application's required memory behavior; keep its standalone roadmap separate            |
| Developer API/SDK                                        | Separate release with its own auth, quotas, docs and adopter gates                                 |
| Native EHR, prescribing, clearinghouse, HIE              | Separate product/release; exclude from the training pilot unless explicitly required and validated |
| Alexa/AWS Builder mini-challenge                         | Optional demonstration track; its 12 backlog issues do not determine training-pilot readiness      |
| CMS, marketplace tools, agent tooling, Churnmeon         | Adjacent capabilities; include only dependencies of the chosen release                             |
| VR travel, rewards, express checkout, Checkmate          | Deferred or separate-product work; remove from the launch critical path                            |

## What is already built or completed

“Implemented” below means source and tests exist. Historical reported test
results are attributed to their documents; this audit did not rerun the entire
application or training campaign.

| Area                               | Evidence and useful completed work                                                                                                                                                                                                                                              | Remaining release distinction                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Web platform                       | Application, session, workspace, auth, supervisor, consent and memory surfaces exist. [Session snapshots](apps/web/src/pages/api/session/snapshots.ts), [workspace guard](apps/web/src/pages/api/workspace/_lib.ts), [memory routes](apps/web/src/pages/api/v1/memory/index.ts) | Show the selected user journey working across services and roles                                                        |
| Training/data machinery            | Source acquisition, construction, curation, SFT, evaluation and inference tooling exist throughout `ai/`; selected v6 jobs completed and adapters were exported                                                                                                                 | Do not reopen “train/export the selected adapters” as if nothing ran; evaluate release suitability                      |
| Runtime policy                     | Contextual policy, style gate, tool/consent guards and targeted regression suites exist                                                                                                                                                                                         | Evaluate the exact combined model, policy and tool adapter that will ship                                               |
| Latest targeted research           | [Campaign handoff, v71–v74](docs/training/execution-2026-10-21/CAMPAIGN_HANDOFF.md), lines 338–360, records note-scope, lookup-retry and final-denial repairs                                                                                                                   | v74's final-denial path passed 16/16 checks; that narrow mocked pass is not a complete promotion or deployment approval |
| Foresight                          | MCP/CLI/TUI/SDK, hybrid retrieval, graph/temporal memory, auth and proof-benchmark implementations exist                                                                                                                                                                        | Trace actual application callers, persistence, isolation and deletion against the deployed backend                      |
| EHR                                | Linear records all 64 project issues Done; FHIR, RBAC, service and adapter code exists                                                                                                                                                                                          | Completed engineering tickets do not establish operational EHR, prescribing or payer readiness                          |
| Infrastructure and developer tools | Cloudflare Workers production, Vercel standby, Docker Hub image publish, local Docker compose, CI, SDKs, `px`, agents, audit tooling and runbooks exist (AWS EKS production retired)                                                                                                                                                         | A current release must still demonstrate successful deploy, rollback, alerts and support                                |
| Historical programs                | Linear marks enterprise-readiness, PAL, vertical fidelity, Nightmare Fuel, remediation and CLI projects completed                                                                                                                                                               | Preserve their artifacts as foundations; require current evidence for the capabilities the pilot promises               |

## The material gaps

1. **The complete product journey needs one release-level proof.** Breadth
   across repos is ahead of evidence that the customer workflow works as one
   product.
2. **Some user-facing surfaces are still demonstrations.**
   [Dashboard API](apps/web/src/pages/api/dashboard.ts), line 40, returns beta
   mock data; [audit metrics](apps/web/src/pages/api/audit/metrics.ts) are
   mocked;
   [patient export](apps/web/src/pages/api/patient-rights/download-export.ts),
   lines 101–120, infers readiness from an ID substring and generates sample
   content. Replace, exclude or gate these before promising real records or
   results.
3. **Model promotion remains open.** The full
   [campaign handoff](docs/training/execution-2026-10-21/CAMPAIGN_HANDOFF.md)
   contains later corrections and appendices; read its tail. v51 booking
   failures were followed by multiple repairs and later successful narrow
   diagnostics. Preserve that progress without treating old failures as current
   proof or narrow repairs as broad clearance. v72–v74 still end with an
   unpromoted candidate.
4. **Safety evidence and reviewer provenance need release-specific accounting.**
   The record includes qualified user-confirmed assessments and explicitly
   AI-generated or role-based assessments. They must retain their individual
   provenance. No clinical validation or deployment authorization follows merely
   from a packet name or a clean automated score.
5. **Tenant/privacy and memory behavior need real integration proof.** The
   [AI Foresight adapter](ai/memory/foresight_provider.py), line 50, can return
   a fabricated storage ID when the backend lacks a method. Determine whether
   released callers can reach that branch. Check tenant isolation, auth, consent
   and lifecycle across the actual services, not only helpers.
6. **Current CI and deployment incidents require evidence-based closure.**
   PIX-4751, PIX-4795 and PIX-4814 are failure reports. They may be historical;
   inspect a later successful equivalent run at the chosen release before
   retaining or closing them. Production deploys via
   [deploy-cloudflare.yml](.github/workflows/deploy-cloudflare.yml) after green
   staging CI; EKS deploy workflows are retired. Re-check the latest `staging`
   workflow runs (CI, Quality, Cloudflare deploy, image publish) on the release
   commit rather than stale sampled failures.
   [CI](.github/workflows/ci.yml), lines 95–101, currently allows the security
   bucket to fail with a warning.
7. **Commercial documents overstate what is proven.** Existing
   [pilot structure](content/business-strategy/pilot-program-structure.md) and
   [operational checklist](content/business-strategy/pilot-operations/operational-checklist.md)
   promise large improvements, broad support and substantial cohorts.
   [Pricing strategy](content/business-strategy/pricing-strategy.md) mixes many
   markets and ROI claims. These are hypotheses and draft offers, not observed
   outcomes or sold contracts.

## Consolidated work plan

The IDs below are **planning work packages**, not newly created Linear tickets.
Owner roles are proposed responsibilities; a named accountable person must
accept each package. Existing source tickets remain in the ledger and should be
linked to these packages rather than copied into another parallel backlog.

| ID  | Outcome / acceptance criterion                                                                                                                                                                                                              | Priority and proposed owner          | Depends on          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------- |
| L01 | Approve a one-page pilot contract: buyer, user roles, use case, included routes/scenarios, data boundaries, acceptance and stop conditions; name accountable owners                                                                         | P0 · Product/founder                 | None                |
| L02 | Select release commits across all four repos; deploy to the current production targets, demonstrate health and rollback, and tie each CI/deploy incident to a successful equivalent run or a reproduced blocker | P0 · Platform                        | L01                 |
| L03 | Prove invite/sign-in/role/tenant boundaries with two isolated organizations and a forbidden cross-tenant attempt; remove or disable pilot-exposed unfinished token/auth paths                                                               | P0 · Security + application          | L01, L02            |
| L04 | Run the full trainee → feedback → retry → persisted session → faculty review journey in a real browser with released APIs and database readback; include failure/reconnect behavior                                                         | P0 · Application + QA                | L02, L03, L07       |
| L05 | Replace pilot analytics with persisted session/cohort measurements; verify counts against source events. Gate mocked metrics, exports and simulated multimodal claims outside the supported journey                                         | P0 · Application/data                | L01, L02            |
| L06 | Freeze the scenario subset and supervisor rubric; bind feedback to transcript evidence and record disagreements. Validate evaluator calibration rather than requiring a particular old judge vendor                                         | P0 · Clinical education + evaluation | L01                 |
| L07 | Freeze the model/policy/tool bundle and provenance. Preserve v74 repairs and the campaign's unpromoted status until the full release decision is supported                                                                                  | P0 · ML/evaluation                   | L01, L06            |
| L08 | Lock fresh evaluations before further repair: broader scenario coverage, ordinary distress, role fidelity, task completion and safety. Record critical failures, missing outputs and reviewer provenance; make an explicit release decision | P0 · ML + qualified reviewer         | L06, L07            |
| L09 | If scheduling/tools are included, verify consent changes, exact slots, retries, unknown outcomes and truthful completion against a real sandbox service. If excluded, disable those tools and verify the boundary                           | P0 when included · Integration + QA  | L01, L03, L07       |
| L10 | Complete a release-specific source/rights manifest and leakage-resistant splits; version registry, decisions and artifacts. Resolve PIX-4583/4584 against current evidence; preserve research authorization and holdouts                    | P0 · Data governance                 | L01, L07            |
| L11 | Demonstrate the supported privacy lifecycle: scoped collection, retention, access/export and deletion, audit trail and actual memory deletion. Replace or exclude sample patient-export behavior                                            | P0 · Security/data                   | L01, L03            |
| L12 | Produce current security results, backup/restore proof, alert delivery and incident/rollback rehearsal; require launch-relevant security checks to block release                                                                            | P0 · Platform/security               | L02, L03            |
| L13 | Instrument completed sessions, retries, faculty review, errors, latency and model cost per completed session; define acceptable operating limits and test a usage cap                                                                       | P1 · Product analytics + platform    | L04, L05, L07       |
| L14 | Prepare a deliverable pilot offer: price hypothesis, seats/usage limits, onboarding, real support hours, procurement/data terms and renewal decision. Remove unsupported guarantees                                                         | P1 · Founder/commercial              | L01, L11, L13       |
| L15 | Align website, demo, docs and sales materials with the actual feature matrix and evidence. Review “zero risk,” live telemetry, airgap, accreditation and ROI/outcome statements individually                                                | P1 · Product/commercial              | L04–L08, L12, L14   |
| L16 | Recruit and onboard a small design-partner cohort; capture signed scope, faculty champion, baseline rubric, structured feedback and an explicit paid-continuation decision                                                                  | P1 · Founder + customer success      | G1–G5 (pilot entry) |

Existing active construction/versioning work maps to L10. Judge calibration maps
to L06/L08. CI-federation inventory, ownership and incident cleanup map to
L02/L12 with one owner per required lane. Data-retention work maps to L11. Human
escalation maps to a visible incident queue, accountable responder and tested
notification path under L12; adding three more notification channels is not the
acceptance criterion.

Do not mark L07/L08 complete because a job ended or a narrow diagnostic passed.
Do not keep old training-blocker epics open without enumerating which current
blockers they represent. Keep the multi-agent discussion channel as coordination
metadata rather than a deliverable.

## Milestones and launch gates

No launch date is supported by the present evidence. Schedule after L01
establishes scope and owners estimate the packages. The critical path is **scope
→ reproducible release + frozen scenario/model contract → integrated proof and
evaluation → pilot approval → customer learning**. Commercial discovery and
documentation can run alongside engineering.

| Gate                                  | Pass condition                                                                                        | Current assessment                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| G1 — Product boundary                 | L01 accepted; included/excluded features and named owners published                                   | Proposed scope; owner acceptance needed                                 |
| G2 — Working training journey         | L02–L05 pass on one pinned release; supported failure cases recorded                                  | Technical routes deployed; session creation, client replies, coaching, faculty review and integrated proof remain open |
| G3 — Evaluation and release decision  | L06–L10 pass for included AI/data/tools; explicit reviewer provenance and promotion decision recorded | Targeted progress through v74; candidate remains unpromoted             |
| G4 — Privacy, security and operations | L03/L11/L12 pass; support/incident ownership is real                                                  | Foundations exist; current release sign-off not established             |
| G5 — Honest, supportable offer        | L13–L15 complete; price/cost/support and customer-facing claims agree                                 | Draft business materials exist; validation and scope alignment needed   |
| G6 — Pilot learning and continuation  | L16 complete; measured results and a paid continuation or a documented no-go decision                 | Customer commitment and outcomes not established by inspected sources   |

**M0 — Reset the baseline:** accept scope/owners, resolve tracker discrepancies,
freeze commits and feature matrix. Exit at G1.

**M1 — Internal release rehearsal:** pass G2–G4 with synthetic training data and
the actual services; rehearse a failure and rollback. Exit with one reviewable
evidence bundle and a pilot go/no-go decision.

**M2 — Supervised design-partner pilot:** open a bounded offer after G5; onboard
one small cohort and measure teaching usefulness, task success, review effort,
support burden and cost. A suggested initial experiment is 5–10 trainees, one
faculty champion and 3–5 scenarios over 2–4 weeks. Those numbers are a proposed
learning scope, not a commitment or completed customer milestone.

**M3 — Paid expansion:** proceed only after G6. Expand seats/scenarios when
observed usage, faculty value, support capacity and unit economics support it.
Broad enterprise, clinical-care and EHR offerings each need their own release
evidence and commercial decision.

## What to merge, retire or defer

| Existing work                                                                    | Consolidated treatment                                                                                                                |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| March Asana-based ROADMAP/STATE and old sprint percentages                       | Historical snapshots. This outline is the current planning entry point; live Linear remains the execution tracker                     |
| Old P0–P23 unified acquisition/master plans                                      | Superseded by the [finish plan](.agent/internal/data/15-finish-the-game-plan.md), subject to later campaign evidence; keep provenance |
| Repeated copies in notes/archives and procedural checklists                      | One hash-canonical document; duplicates retain pointers. Workflow/runbook/template checkboxes are not product backlog                 |
| GitHub mirrors disagreeing with Linear                                           | Keep both source IDs and evidence; resolve linked state/title disputes before changing tracker statuses                               |
| Done issue plus new integration/release gap                                      | Preserve historical Done; specify the new acceptance gap under a launch package rather than silently reopening unrelated work         |
| Foresight project marked To Do despite all 18 issues Done                        | Reconcile project metadata; standalone product release proof remains separate from issue completion                                   |
| AI Training Pipeline project marked To Do despite substantial Done/Canceled work | Rewrite its charter around surviving construction/evaluation work and release evidence, rather than restart a greenfield pipeline     |
| Completed Stub/Technical Debt project containing open work                       | Keep completed history and separate the remaining scoped defect; avoid a misleading “all debt cleared” claim                          |
| CI federation across many providers                                              | Retain required production checks and owners; defer provider expansion without a current release dependency                           |
| Dual-judge ticket naming old models                                              | Preserve the calibration/disagreement requirement; use the campaign's approved evaluator configuration and measured evidence          |
| Alexa project, VR/rewards/checkout discovery and Checkmate                       | Optional or separate backlog. Avoid adding these to pilot completion arithmetic                                                       |
| Empty completed/canceled projects                                                | Archive candidates after checking retention needs; an empty container is not new work                                                 |

This audit organizes and prunes the **planning view**. Source issues and
historical documents are preserved. Bulk closure, deletion, reassignment and
irreversible archive operations have not been performed.

## Better ideas worth testing

These are new proposals, not completed features or existing customer
commitments.

- **Sell one teaching loop first.** Start with one difficult-conversation skill
  and a faculty review rubric; measure whether directed retries help the faculty
  member teach it.
- **Ship a release evidence card.** Record the exact model/policy/scenario
  versions, supported tools, known limitations, evaluation provenance and
  rollback target with each release. This makes future “are we ready?” reviews
  much smaller.
- **Build a faculty review queue before expanding dashboards.** Show the
  transcript turn, rubric dimension, evidence, retry and faculty override;
  measure agreement and review time.
- **Use a two-lane roadmap.** Keep the product reliability/pilot lane separate
  from model/data research. Bring research into the release only through a
  bounded promotion decision.
- **Add a usage budget to the pilot.** Track cost per completed session and
  stop/restrict gracefully at an agreed cap before promising unlimited access.
- **Make failed tasks visible.** One queue for incomplete sessions, uncertain
  tool outcomes and human escalations is more useful than silently
  successful-looking demos.

## How to maintain this outline

Use Linear for execution, this outline for scope/gates, GitHub for
implementation evidence, and the campaign handoff for model research chronology.
Give each launch package one owner and one canonical issue; attach existing
source IDs instead of importing duplicate task sets.

At each weekly review, record gate evidence, next blocker, owner and decision.
Close or merge only after verifying identity and current acceptance; keep
cancellations distinct from completed work. Re-run the reconciliation when
tracker state changes. Replace proposed scope/metrics with accepted customer
constraints as they become known.

Audit limits: the full file inventories and tracker feeds were scanned, with
selected semantic inspection of implementation, tests and plans. This is not a
line-by-line correctness or security audit. No clinical datasets, secret values
or private reviewer dialogues are reproduced. Current code, commercial
commitments, deployed health and assessments must be verified through their own
release gates. Repository work continued concurrently during the scan; see the
coverage snapshot and reconciliation for provenance.
