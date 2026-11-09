# Pilot launch decisions and gates

**Decision date:** 2026-11-04
**Status:** **NO-GO. Enrollment and customer launch are not authorized.**
**Scope accepted:** one training program, 5–10 trainees, 3–5 synthetic
scenarios, 2–4 weeks. This is an internal planning envelope, not an offer.

This register separates decisions that can be set as reversible planning
defaults from approvals that only the accountable owner, reviewer, or customer
can make. Source presence, a completed issue, a passing narrow test, or an
offline evaluation is not release approval.

## Proposed pilot defaults

| Decision | Recommended default | Decision maker / evidence to close |
| --- | --- | --- |
| Product and audience | Training-only practice for one academic or professional mental-health training program. | Founder/product accepts; identify the actual program and buyer before external proposal. |
| Learning objective | Practice one supervisor-selected difficult-conversation skill using synthetic scenarios; feedback must cite transcript evidence. | Faculty champion selects skill and approves rubric/scenarios. |
| Journey | Invite, sign in, complete a scenario, review feedback, retry, save, and faculty review; exclude any step that is not functional on the pinned release. | Product + engineering + QA produce end-to-end release evidence. |
| Data | Synthetic scenario and trainee-authored practice content only; minimum account/session data; no patient records, PHI, clinical care, research collection, or external integrations. | Privacy/data owner and institution approve written collection, access, retention, deletion, consent, and incident terms. Any research use requires separate institutional determination. |
| Measurement | Report completion, retry, transcript-grounded feedback, faculty usefulness, defects, support load, latency, and cost as descriptive pilot measures. No efficacy or clinical outcome claim. | Faculty and product agree baseline, rubric, thresholds, missing-data rules, and stop conditions before enrollment. |
| Support | Named business-hours responder and escalation path, only after capacity is demonstrated. No 24/7 commitment. | Founder names responder and accepts coverage; run incident and rollback rehearsal. |
| Commercial posture | No price, refund, renewal, SLA, staffing, publicity, IP, or publication commitment in the current draft. Do not send a customer offer until a written term sheet is approved. | Founder/commercial plus institution procurement/privacy owners approve actual terms. |
| Target and cohort | Keep the accepted one-program / 5–10 trainee envelope; do not name or imply a partner. | Founder identifies buyer; customer confirms cohort, dates, faculty lead, and procurement path. |

These defaults narrow the proposal and can guide readiness work. They do not
substitute for the named approvals above.

## Gate and package register

Status meanings: **PASS** means current release evidence satisfies the full
exit condition; **FAIL** means inspected evidence shows a concrete defect;
**OPEN** means the required proof is missing; **OWNER DECISION** means an
authorized person must accept a scope or commercial choice. A gate passes only
when all its packages pass and required owner decisions are recorded.

| Package | Gate | Status | Owner role | Evidence / reason and closure proof |
| --- | --- | --- | --- | --- |
| L01 Scope and owners | G1 | OWNER DECISION | Founder/product + customer + faculty | Accepted cohort/duration/scenario-count envelope exists. Buyer, program, named owners, skill, scenarios, rubric, measures and stop thresholds are not accepted. Close with signed scope and named owners. |
| L02 Release/deploy/rollback | G2 | OPEN | Platform/release | No pinned release bundle with CI, EKS health, rollback, and current incident linkage was verified in this review. Close with commit/repo manifest and release-specific deployment, health, rollback records. |
| L03 Identity and tenant boundary | G2/G4 | OPEN | Application/security | Re-measured twice on 2026-11-09 on commit `f475bcc4f920c0d4fc5ff07254328ed2fae5209d` / Worker `a9d4e785-39b1-4197-816a-432618c4c40e` (100%). On both 35-leg runs, the boundary legs that returned a response behaved as designed: every own-session read that completed returned 200 with the caller's own id (org A's own GET in both runs; org B's own GET returned the 503 defect in both); cross-organization reads and writes that completed were denied with no foreign content; the five documented legacy routes returned 410 for both organizations (10 base legs) plus 4 spoofed-parameter variants, and those 14 legs are **exclusions, not denials**; all 7 unauthenticated legs returned 401; foreign rows were unchanged and both session hashes byte-identical. The package stays **OPEN** because a bounded 8 s deadline `503` — a 5xx defect, not a denial — hit authenticated reads in each run: **2 legs in run 1** and **3 legs in run 2**, with the leg set varying between runs (run 1: org B own GET, org B spoofed-owner foreign GET; run 2: org A cross-org GET, org B own GET, org B spoofed-owner own GET). `--verify-result` recomputes OPEN and exits 1 in both runs. Evidence: `evidence/l03-tenant-boundary-release.md`. Close by eliminating the pre-pool stall on authenticated reads and re-running the matrix, then re-deriving the failing legs from that run. — reconciled by `l04-gap-register-and-blockers` 2026-11-09 from both fix-release runs. |
| L04 Trainee-to-faculty journey | G2 | OPEN | Application/QA | Re-measured twice on 2026-11-09 on commit `f475bcc4f920c0d4fc5ff07254328ed2fae5209d` / Worker `a9d4e785-39b1-4197-816a-432618c4c40e` (100%). The role-resolution repair works: signing in through the real login form as the synthetic org A user renders `#message-input`, `#send-message`, and `#messages-container`, and the org B session URL is refused (302 to `/training?error=session-not-found`, no foreign content). The journey still fails. Trainee message persistence is **intermittent, not a total outage**: run 1 saw 4 of 4 submissions return 500 after 50–66 s with 0 rows, while run 2 saw 2 of 3 return 201 in about 4 s and persist rows visible after reload, with 1 of 3 reproducing the 64 s runtime-cancelled 500 and no row; the leg stays FAILED on the 5xx defect, which is an unbounded message-POST path. The 20-load burst is **variable and fails the 20/20 bar**: 17/20 final 200 with 3 `/login` redirects in run 1, 18/20 with 2 redirects in run 2, 0 runtime-cancelled in both; the redirect cause is unresolved, with client-side cookie loss after a browser relaunch and a server-side cause recorded as competing hypotheses (run 2 saw both redirects with the auth-token cookie present). Still blocked, each with an owner role and no step marked complete: approved scenario catalog and session creation (Faculty/clinical education + Application/QA), synthetic-client replies and transcript-grounded coaching (ML/clinical content + Application), and faculty review policy and access (Faculty/clinical education + Application/security — disabled by the absent session-to-workspace relation, the `supervisor` vs `admin` role vocabulary split, and a dead `handleSupervisorIntervention` calling an undefined `showSupervisorMessage`). Evidence: `evidence/l04-journey-release.md`. Close by bounding the message POST, naming the redirect cause, and deciding the faculty-review policy. — reconciled by `l04-gap-register-and-blockers` 2026-11-09 from both fix-release runs. |
| L05 Persisted cohort measures | G2 | OPEN | Application/data | No event-to-cohort reconciliation was verified; existing task map has no active primary record. Close with persisted event definitions, representative source rows, and reproducible reconciliation; mark unsupported exports/mock metrics unavailable. |
| L06 Scenarios and rubric | G3 | OWNER DECISION | Faculty/clinical education | No pilot-specific frozen 3–5 scenario set or accepted supervisor rubric found. Faculty selects/approves and records calibration/disagreement handling and transcript evidence rules. |
| L07 Model/policy/tool bundle | G3 | OPEN | ML/release | `docs/training/execution-2026-10-21/CAMPAIGN_HANDOFF.md` documents v74 narrow synthetic mocked follow-up and explicitly says the candidate is unpromoted. Close with exact included bundle hashes/config and reproducible run IDs on the release; no candidate promotion is inferred. |
| L08 Evaluation and release decision | G3 | OPEN | ML/evaluation + qualified reviewer + release owner | v74's 16/16 deterministic checks and blinded review of 19 cases/38 responses are narrow development evidence, not broad pilot-bundle evaluation or launch approval. Paige Taylor, LPCC-S, is established in Foresight context; availability and this candidate-specific assessment are unconfirmed. Close with pre-specified fresh coverage, complete failures/missing outputs, reviewer provenance, and explicit promote/hold decision. |
| L09 Excluded tools boundary | G3 | OPEN | Integration/QA | Scheduling and external tools are proposed out of scope, but disabled behavior was not demonstrated. Close with configuration and negative tests showing excluded tools cannot execute or claim completion. |
| L10 Data rights and splits | G3 | OPEN | Data governance | No current pilot-release source/rights manifest and split/holdout evidence verified. Close with release-specific provenance, rights, leakage-resistant split, registry/artifact links, and resolution of current source tasks. |
| L11 Privacy/data lifecycle | G4 | OPEN | Privacy/data + application | No current release proof for consent, access, retention, export, deletion and audit lifecycle verified. The local L03 source defect is addressed but not deployed or independently verified. Close with policy and tested lifecycle, including actual deletion semantics, before institution approval. |
| L12 Security and operations | G4 | OPEN | Security/platform + incident responder | No pinned-release current blocking security report, restore, alert-delivery, or incident/rollback rehearsal verified. Close with run records, named responder, escalation route, and approved incident procedure. |
| L13 Measured operating limits | G5 | OPEN | Product analytics/platform | Usage, latency, failure, and cost limits are unmeasured for the proposed journey; historical model-cost estimates explicitly note billing unverified. Close with release-backed measurements and tested caps. |
| L14 Offer and support terms | G5 | OWNER DECISION | Founder/commercial + customer procurement/privacy | No approved price, payment, usage cap, support window, procurement, data terms, refunds, renewal or SLA. Default is no binding term and no customer offer. Close with an approved written term sheet after L11/L13. |
| L15 Truthful public/demo claims | G5 | OPEN | Product/commercial | The reviewed homepage and Empathy Gym product page were rewritten to describe a proposed training concept, synthetic-only boundaries, and no current pilot availability. The rest of the public/demo/sales surface has not received a complete claim-to-evidence audit. Close with a full inventory and product/commercial approval of each remaining claim. |
| L16 Outcomes and continuation | G6 | OPEN / NOT STARTED | Founder + customer success + faculty | Depends on an authorized completed pilot. Close after the cohort with agreed baseline/results, faculty feedback, support/cost and paid-continuation or no-go decision. |

### Gate result

| Gate | Result | Blocking conditions |
| --- | --- | --- |
| G1 Product boundary | **OWNER DECISION** | Scope envelope accepted; actual buyer/program, named owners, faculty champion, rubric, data terms and thresholds are not. |
| G2 Working journey | **OPEN** | Session authorization, the authenticated message API, and Postgres trainee-message persistence/readback are deployed; migration 017 is applied to the production app database. Approved session creation, synthetic-client replies, evidence-grounded coaching, faculty review, cross-organization verification, reconnect and cohort measures remain unproven. |
| G3 Evaluation and release | **OPEN** | Candidate remains unpromoted; exact pilot bundle, broad fresh evaluation, tool boundary, rights and release decision are missing. |
| G4 Privacy, security and operations | **OPEN** | Local route authorization fixes are covered by focused tests; release-level tenant isolation, lifecycle, security, restore, alert, incident and owner proof remain missing. |
| G5 Honest, supportable offer | **OPEN / OWNER DECISION** | Reviewed public copy was corrected; remaining public/demo claims, measurements and written terms/support owner are not verified or approved. |
| G6 Learning and continuation | **NOT STARTED** | Requires an approved G1–G5 pilot and completed cohort. |

## Verification performed

- Linear was refreshed read-only on 2026-11-04 using the repository `.env`
  credential, without browser use or tracker writes. See
  `evidence/linear-refresh-review.md` and
  `evidence/linear-status-2026-11-04.csv`.
- An earlier targeted run passed 3 files / 54 tests. It did not cover the
  session progress or snapshot routes; the focused route verification below
  does.

  ```sh
  pnpm vitest run -c config/vitest.config.ts apps/web/src/pages/api/workspace/__tests__/routes.test.ts apps/web/src/lib/auth/__tests__/session.test.ts apps/web/src/pages/api/v1/memory/__tests__/v1-memory-routes.test.ts --coverage.enabled=false
  ```

- The focused route verification passed 3 files / 19 tests.

  ```sh
  pnpm vitest run -c config/vitest.config.ts apps/web/src/tests/api/session/progress-api.test.ts apps/web/src/pages/api/session/__tests__/snapshots.test.ts apps/web/src/pages/api/training/sessions/__tests__/session.test.ts --coverage.enabled=false
  ```
- Targeted `pnpm exec oxlint` over the changed route, service, and test files
  passed. `pnpm build` and the production Vercel deployment completed. The
  message endpoint returned 401 without authentication; integrated journey,
  cross-organization and end-to-end pilot proof remain open.
- `pnpm lint` ran repository-wide and exited **123** after reporting numerous
  warnings in unrelated files across the monorepo. Treat the lint gate as
  unresolved; this run did not provide a clean project-wide result.
- Static inspection and `rg` established the owner-only behavior, remaining
  mock-backed training index, and absent session-creation flow. No customer
  contact, tracker write, or patient data use occurred.
- The October 25 campaign handoff reports narrow v74 development evidence and
  explicitly withholds promotion/deployment. It does not satisfy G3 for a
  chosen pilot release.

## Required owner decisions to unblock planning

1. Founder: identify the target program/buyer and assign product, release,
   privacy/data, support and commercial owners. Confirm whether the proposed
   business-hours support model is feasible.
2. Faculty/customer: identify the faculty champion; select the learning skill,
   scenarios and rubric; accept measures, thresholds, stop rules, data terms,
   cohort dates and procurement path.
3. Qualified reviewer and release owner: confirm candidate-specific review,
   freeze the exact bundle, and record a promote/hold decision from fresh
   release-relevant evidence.
4. Founder/procurement/privacy: approve price and all written terms only after
   measured limits and data lifecycle are known. Until then, the offer remains
   unpriced and unsent.
5. Product: complete the remaining public/demo/sales claim audit and approve
   each claim against evidence. The homepage and Empathy Gym product page have
   already been corrected.

## Approval boundary

**Current decision: no enrollment, customer launch, or launch-ready claim.**
G1–G5 have not passed. This document is a local readiness assessment, not an
offer, safety determination, institutional approval, legal advice, or release
authorization. Authentication, ownership and synthetic training message
persistence were deployed to production after explicit user direction; the
production database migration and Vercel deployment both completed. This
technical rollout does not pass G1–G5. Reassess every gate against the pinned
production release after the remaining journey, operations and owner decisions
are closed.
