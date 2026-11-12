# Pilot readiness evidence — index

What is in this directory, which release each document was measured on, and how
to review the go-to-market decision without reading everything.

**Decision: NO-GO.** The availability-and-persistence tier is **closed**, and so
is the hardening tier: all sixteen assertions it owns pass, each on the pin
recorded in [`mission-decision-2026-11-12.md`](mission-decision-2026-11-12.md)
§3. On the current pin, `e3f3a91da` / Worker `8dd9a8cb`, the tenant-boundary
matrix passes on the quiet-window run (L03 **PASS, provider-bucket conditional**)
and the five journey steps exist as **scaffolds that render their blocker**. L04
stays **OPEN on journey content, not on structure and not on availability**: no
scenario catalog, client persona, coaching rubric or competency framework has
been approved, so the journey is not ready. No document here claims the platform
is ready for a pilot, and none may be cited as a launch-readiness claim. The
decision was re-derived from the measurements, not preserved by default.

## Read these first

| Order | Document                                                                                                     | Why                                                                                                                                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | [`mission-decision-2026-11-12.md`](mission-decision-2026-11-12.md)                                           | **The current decision record.** Re-derived NO-GO on `e3f3a91da` / Worker `8dd9a8cb`: the eighteen restored assertions with their pins, what scaffolding does and does not change, the three same-pin matrix runs, the standby by cause, the ratchet, and the two facts it states rather than smooths over. |
| 2     | [`journey-scaffolding-release-e3f3a91da-2026-11-12.md`](journey-scaffolding-release-e3f3a91da-2026-11-12.md) | **The journey-scaffolding evidence.** Rendered text and `file:line` per scaffold, the clinical-content scan, the `VAL-UX-002`/`VAL-UX-003` re-probes, the removed quality ladder, and the pre-existing competency panel recorded as an open owner decision.                                                 |
| 3     | [`hardening-release-a2f06cc38-2026-11-11.md`](hardening-release-a2f06cc38-2026-11-11.md)                     | **The hardening-tier verdicts.** Each restored assertion with the command and the observed status on `a2f06cc38` / Worker `a6028a07`.                                                                                                                                                                       |
| 4     | [`mission-decision-2026-11-10.md`](mission-decision-2026-11-10.md)                                           | The previous decision record. Still the state at `1580a719f`; superseded as the current decision, kept as the measurement it was.                                                                                                                                                                           |
| 5     | [`availability-remeasure-1580a719f-2026-11-10.md`](availability-remeasure-1580a719f-2026-11-10.md)           | The availability measurement the closed tier rests on: three 20-navigation windows (60 of 60), the 2 → 1 validation mechanism, both same-pin matrix runs, the round-trip and the ten submissions.                                                                                                           |
| 6     | [`request-path-diagnosis-2026-11-09.md`](request-path-diagnosis-2026-11-09.md)                               | The diagnosis the fixes cite: the 8 s deadline, the reused-socket class, the legacy direct-pool borrows, and the provider class, each with numbers and a code branch. Carries a dated `round-2-corrections` amendment.                                                                                      |
| 7     | [`l03-tenant-boundary-release.md`](l03-tenant-boundary-release.md)                                           | The tenant-boundary package: the 35-leg matrix per run, the legacy-route exclusions, the tracker state.                                                                                                                                                                                                     |
| 8     | [`l04-journey-release.md`](l04-journey-release.md)                                                           | The journey package before the scaffolds: the eight-step proven/blocked map, the availability burst, the trainee-facing consequence.                                                                                                                                                                        |

`../LAUNCH_DECISIONS.md` carries the package rows. Its **L02, L03 and L04 rows
are reconciled to the current pin**: L03 is **PASS, provider-bucket conditional**
on `e3f3a91da`; L04 stays **OPEN** on journey content — the scaffolds exist and
say so, but no catalog, persona, rubric or competency framework is approved. L02
stays **OPEN** with the standby stated by cause (unpaid, zero deployments) and
"a decision on the standby origin" still among its missing items; its old `www`
`402 DEPLOYMENT_DISABLED` symptom is recorded as **gone**, because the Worker
serves `www` and `301`s it to the apex. The G2 and G4 gate-summary rows were
re-derived where the new evidence contradicted them.

## Which release each measurement came from

`staging` moves under automated dependency merges, so a result is bound to the
release it was measured on. Ten pins were measured in the availability window;
the follow-up milestone added four more:

| Release         | Worker         | What was measured on it                                                                                                              |
| --------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `3bf2bf1b`      | `7315171c`     | The first L03 matrix and the CSRF/sign-in probe                                                                                      |
| `5f7f7c74b`     | `2b86c589`     | The first L04 browser journey, blocked at the trainee UI                                                                             |
| `f475bcc4f`     | `a9d4e785`     | The fix release. Both packages re-measured after the two authorized repairs                                                          |
| `db9b63ed1`     | `2207d7a1`     | All three repair branches deployed; all four assertions re-measured                                                                  |
| `f811440d6`     | `af615b73`     | Validated-session reuse in the middleware (PR #6665); the 8 s deadline becomes dominant                                              |
| `a24ab11d9`     | `e9aed1a4`     | The Redis command bound (PR #6667); a dead cache becomes a fast miss                                                                 |
| `249c558c4`     | `7542a5d3`     | The reused-pooled-client statement bound (PR #6669); legacy routes turn 500                                                          |
| `42653d506`     | `0f3d77e6`     | The liveness probe and the legacy timeout mapping (PR #6671, #6672); burst passes three windows                                      |
| `8397bdff6`     | `7ea1640e`     | The preceding round. Legacy handlers routed through `acquireClient()` (PR #6677): L03 PASS, `VAL-HANG-001` fails at 119 of 120       |
| `1580a719f`     | `186b655f`     | The provider-validation collapse (PR #6679): all four availability assertions pass, L03 provider-bucket conditional                  |
| `a2f06cc38`     | `a6028a07`     | The hardening release: nine of the restored assertions measured live or at test level                                                |
| `5544661f4`     | `42310b03`     | The hardening residual release: `VAL-UX-003`, `VAL-IDENT-003`, `VAL-CSRF-006`, `VAL-POST-002`, `VAL-POST-004`                        |
| `540e83bdf`     | `95172197`     | The round-3 final pin: `VAL-INPUT-001` moves `failed` → `passed`; `VAL-OUTAGE-002`, `VAL-AUTH-003`, `VAL-DB-001`, `VAL-CI-002`       |
| **`e3f3a91da`** | **`8dd9a8cb`** | **The current pin.** The journey-scaffolding release (#6761–#6763): `VAL-SCAF-001` rendered evidence, three same-pin L03 matrix runs |

Cite the current pin for any current claim; cite the earlier pins only as
history, and label them as such. Each restored assertion's pin is listed in
[`mission-decision-2026-11-12.md`](mission-decision-2026-11-12.md) §3.

## What moved

The phase opened with four failing assertions. On `1580a719f` / Worker
`186b655f`:

- **`VAL-HANG-001` PASS.** 60 of 60 first-attempt `200` across three windows
  (w1 22:34:36.409–22:34:58.492Z, w2 22:34:58.569–22:35:16.259Z, w3
  22:35:16.335–22:35:34.751Z), 0 retries, 0 bounded `503`, 0 `/login`. The
  mechanism moved: 47 captured session-page legs split 44 at zero completed
  validations, 3 at exactly one (the cold first leg of each window), 0 at two or
  more — against a before-number of two.
- **`VAL-L03-011` PASS, provider-bucket conditional.** 35 legs: 6 pass / 15 deny
  / 14 exclusion / 0 fail, `defects5xx` 0, `hardFailures` 0 on the 22:50:47Z
  quiet-window run. A matrix run on the same pin at 22:44:16Z returned OPEN with
  6 provider `503`s after the `/userinfo` bucket was spent; both runs are cited.
- **`VAL-L04-003` PASS.** Page `200` on the first attempt, submission `201` in
  ~649 ms, row `6eb21b08-35cd-4e24-9c83-085ae732f19f`, visible after reload.
- **`VAL-POST-001` PASS, with one evidence-item gap.** 10 of 10 `201`, 10 rows
  (99 → 109), 10 of 10 visible after reload. The runtime-cancel leg has no tail
  covering the submission window; that gap is stated, not papered over.

### The follow-up milestone, on `e3f3a91da` / Worker `8dd9a8cb`

- **The hardening tier is closed.** Sixteen assertions now pass, each on the pin
  it was measured on: `VAL-UX-001`, `VAL-INPUT-001`, `VAL-POST-003`,
  `VAL-CSRF-006`, `VAL-IDENT-001/002/003`, `VAL-L04-008`, `VAL-OUTAGE-002`,
  `VAL-AUTH-003`, `VAL-POST-002`, `VAL-POST-004`, `VAL-DB-001`, `VAL-CI-002`,
  `VAL-UX-002` and `VAL-UX-003`. `VAL-INPUT-001` is the one that moved from
  `failed` to `passed` (`540e83bdf`: 21-leg malformed-input matrix, 0 `5xx`,
  0 Postgres-code leaks).
- **The journey steps exist as scaffolds.** `/training/scenarios`,
  `/training/sessions/new`, `/training/coaching` and `/training/faculty-review`
  are reachable by product link and each renders its blocker; the inline
  reply/coaching seams on the session page are reachable by URL only, because
  `/training` renders a hardcoded empty session list. Zero authored clinical
  content appears. `VAL-SCAF-001` is measured with rendered evidence and remains
  **`pending`** in the contract, awaiting the milestone validator.
- **L03 re-measured on the pin.** Three 35-leg runs: two bucket-spent runs
  returned OPEN with one provider `503` on the same leg, and the quiet-window run
  returned 6 pass / 15 deny / 14 exclusion / 0 fail. L03 is **PASS,
  provider-bucket conditional**.
- **The trainee surface lost chrome.** #6762 removed the word-list quality ladder
  (`therapeuticWords`/`problematicWords`, the Excellent/Good/Fair/Poor verdict,
  `#response-quality`) and the "Get Suggestions" control, as unapproved authored
  coaching content.
- **A pre-existing competency panel remains.** The session page still renders the
  `Response Type` six-value intervention taxonomy and the `Real-time Guidance`
  panel scoring Rapport Building / Active Listening / Empathy at `0.0/5`, both
  from `fbe8e7e27` (2026-08-26). Whether that is approved content is an **open
  owner decision**, and the surface is not claimed clean.

## What keeps the decision at NO-GO now

The availability numbers no longer do. The decision stays NO-GO because:

- **The journey is blocked on content, not structure.** The scaffolds exist and
  say so, but no scenario catalog, client persona, coaching rubric or competency
  framework has been approved. Session creation cannot write until the catalog
  and the scenario-to-session template are approved, and faculty review stops at
  the missing `sessions`→`workspace` relation. The journey is not ready, and a
  surface that explains its blocker is not a working step.
- **L02 is open.** The standby origin is unpaid with **zero** deployments — team
  `Wutang` `billing.status: "overdue"`, `softBlock: UNPAID_INVOICE` at
  `2026-11-09T09:34:18Z` (Vercel API read 2026-11-12). The old `www` `402`
  `DEPLOYMENT_DISABLED` symptom is **gone**: the Worker serves `www` and `301`s
  it to the apex. The four-repo commit manifest and incident linkage are
  incomplete, no rollback has crossed a migration, `Quality` is red on the pin on
  the `ai` ratchet, and "a decision on the standby origin" is still missing.
- **G1, G3 and G5 remain owner decisions or open.** Scope and owners, the frozen
  pilot bundle and evaluation, and product/commercial approval of the
  public-claims replacement text are not settled; the copy pass itself is
  deployed and verified on `7ce104894`.

The provider class is still live and window-dependent: the stage probe measured
2 of 10 `/userinfo` samples at `429` (median 2 125 ms), and a matrix run taken
right after heavy validation traffic returned 6 provider `503`s. Collapsing the
double call halved the budget spend per cold request; it did not remove the
ceiling. A clean window does not cure the condition, and a matrix run taken
inside such a window records `defects5xx` and an OPEN verdict even though the
quiet-window run on this pin is clean. On `e3f3a91da` the condition reproduced
twice — the 05:50:44Z and 05:55:46Z matrix runs each recorded one provider `503`
on the same leg — and cleared after a seven-minute window with no authenticated
traffic (06:05:25Z).

## G3/G5 claim and boundary audits (2026-11-10)

Three packages that no availability measurement touches were measured
separately, because their register rows asserted things the release does not do.
None is closed; each now has the artifact its row was missing.

| Document                                                                       | Package  | What it establishes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`l15-public-claims-release.md`](l15-public-claims-release.md)                 | L15 / G5 | The public-claims copy pass was **deployed and verified on `7ce104894`**: `/`, `/demo/clinical-vault-trainer`, `/demo/bias-detection`, `/demo/crisis-detection`, `/demo/psychology-pipeline`, `/demo/chat`, `/privacy`, `/terms` and `/components/security-demo` return no match for any removed claim (the fabricated university endorsement, the 78%/95%+/94.7%/10k+ figures, "24/7 Emergency Resources", "Zero-Risk Clinical Mastery", the SOC 2 / ISO 27001 / HITRUST table). A 2026-11-12 spot check of the live apex finds no CACREP/APA/CSWE accreditation and no removed figure; "Zero PHI Ingestion" remains as a boundary statement. What remains is product/commercial approval of the replacement text — an owner decision, so G5 stays open. Full inventory: 132 non-admin pages, 28 live routes, 21 serving claim text before the pass. |
| [`l09-excluded-tools-release.md`](l09-excluded-tools-release.md)               | L09 / G3 | The excluded EHR/scheduling/payer surface is permission-gated, not disabled: 36 of 37 routes require auth + role, the client portal pages answer 200 unauthenticated, the public FHIR CapabilityStatement advertises `Appointment` and `Claim` as active, and no exclusion configuration exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [`l02-rollback-rehearsal-2026-11-10.md`](l02-rollback-rehearsal-2026-11-10.md) | L02 / G2 | The rollback half of L02 is demonstrated: `7ea1640e` → `0f3d77e6` → restored, health 200 at every transition. A migration-crossing rollback is untested and the Vercel standby origin is unpaid with zero deployments (by cause, not a code verdict).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [`l02-release-manifest-2026-11-11.md`](l02-release-manifest-2026-11-11.md)     | L02 / G2 | Four-repo pins for release `751a28420` (all published on the mirror), deploy/health records for three releases, and the incident linkage: PIX-4751 and PIX-4795 are supported, **PIX-4814 reproduces** — `Quality` still fails on the `ai` strict-typing ratchet, so G2 stays red.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

The L02, L09 and L15 rows in `../LAUNCH_DECISIONS.md` were corrected from these
measurements. An earlier revision of this index said the homepage had not been
corrected and that the copy pass lived only in the working tree; both statements
were true before `7ce104894` and are superseded. The pass is deployed and
verified, and what remains is product/commercial approval, which is why G5 stays
open.

## What this evidence does not establish

- Nothing about a working session creation, an approved scenario catalog,
  synthetic-client replies, transcript-grounded coaching or faculty review. The
  scaffolds exist and render their blocker, but no step works, and the catalog,
  personas, rubrics and competency frameworks remain owner decisions.
  `VAL-SCAF-001` is measured with rendered evidence and remains `pending` in the
  contract, awaiting the milestone validator.
- Nothing about any environment other than the pinned production Worker, the
  provisioned Neon database, and the two labelled synthetic organizations.
  `www.pixelatedempathy.com` is served by the Worker and `301`s to the apex; the
  Vercel standby origin itself is unpaid with zero deployments and serves nothing
  useful.
- The `VAL-POST-001` runtime-cancel leg has no tail artifact covering the
  ten-submission window. The behaviour is evidenced by the absence of cancel
  signatures in every recorded artifact and by the ten `201`s, but the specific
  evidence item is absent and is reported as absent. Future posts runs must start
  `wrangler tail` through `tools/redact-tail.mjs` before the submissions.
- No customer contact, no enrollment, no pilot commitment, no launch readiness.

## Other files here

`charter-review.md`, `training-message-api-review.md`,
`session-route-authorization-review.md`, `EXECUTION_NOTEPAD.md` and
`ULW_NOTEPAD.md` predate this work and are not part of the L03/L04 evidence set.
The per-pin records
`availability-remeasure-{2026-11-10,f811440d6,a24ab11d9,249c558c4,42653d506,8397bdff6,1580a719f}-*.md`
are the measurement chain behind the availability trend above. The follow-up
milestone's records are
[`hardening-release-a2f06cc38-2026-11-11.md`](hardening-release-a2f06cc38-2026-11-11.md),
[`hardening-residual-release-5544661f4-2026-11-11.md`](hardening-residual-release-5544661f4-2026-11-11.md),
[`csrf-module-decision-2026-11-11.md`](csrf-module-decision-2026-11-11.md),
[`journey-scaffolding-release-e3f3a91da-2026-11-12.md`](journey-scaffolding-release-e3f3a91da-2026-11-12.md)
and the current decision
[`mission-decision-2026-11-12.md`](mission-decision-2026-11-12.md).
