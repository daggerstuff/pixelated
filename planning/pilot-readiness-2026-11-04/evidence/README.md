# Pilot readiness evidence — index

What is in this directory, which release each document was measured on, and how
to review the go-to-market decision without reading everything.

**Decision: NO-GO.** The availability-and-persistence tier is **closed** on the
current pin: `VAL-L03-011` (provider-bucket conditional), `VAL-L04-003`,
`VAL-POST-001` and `VAL-HANG-001` all pass on `1580a719f` / Worker `186b655f`.
L03 is **PASS, provider-bucket conditional**; L04 stays **OPEN on journey
completeness, not on availability**. No document here claims the platform is
ready for a pilot, and none may be cited as a launch-readiness claim. The
decision was re-derived from the measurements, not preserved by default, and the
conditions that still block a pilot are named in the decision record.

## Read these first

| Order | Document                                                                                           | Why                                                                                                                                                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | [`mission-decision-2026-11-10.md`](mission-decision-2026-11-10.md)                                 | **The current decision record.** Re-derived NO-GO: per-assertion outcome with pin and artifact, the trend across seven pins, what would change the answer, the deferred tiers, the evidence gaps and the phase invariants. |
| 2     | [`availability-remeasure-1580a719f-2026-11-10.md`](availability-remeasure-1580a719f-2026-11-10.md) | **The current measurement.** `1580a719f` / Worker `186b655f`: three 20-navigation windows (60 of 60), the 2 → 1 validation mechanism, both same-pin matrix runs, the round-trip, the ten submissions and the tail.         |
| 3     | [`request-path-diagnosis-2026-11-09.md`](request-path-diagnosis-2026-11-09.md)                     | The diagnosis the fixes cite: the 8 s deadline, the reused-socket class, the legacy direct-pool borrows, and the provider class, each with numbers and a code branch. Carries a dated `round-2-corrections` amendment.     |
| 4     | [`availability-remeasure-8397bdff6-2026-11-10.md`](availability-remeasure-8397bdff6-2026-11-10.md) | **The preceding round.** `8397bdff6` / Worker `7ea1640e`: `VAL-HANG-001` failed at 119 of 120, the baseline the current pin is measured against.                                                                           |
| 5     | [`mission-decision-2026-11-09.md`](mission-decision-2026-11-09.md)                                 | The earlier decision record. Still the state at `f475bcc4f`; superseded as the current decision, kept as the measurement it was.                                                                                           |
| 6     | [`l03-tenant-boundary-release.md`](l03-tenant-boundary-release.md)                                 | The tenant-boundary package: the 35-leg matrix per run, the legacy-route exclusions, the tracker state.                                                                                                                    |
| 7     | [`l04-journey-release.md`](l04-journey-release.md)                                                 | The journey package: the eight-step proven/blocked map, the availability burst, the trainee-facing consequence.                                                                                                            |

`../LAUNCH_DECISIONS.md` carries the package rows. Its **L02, L03 and L04 rows
are reconciled to the current pin**: L03 is **PASS, provider-bucket conditional**;
L04 stays **OPEN** on the journey steps that do not exist; L02 stays **OPEN**
with the Vercel standby stated by cause (billing soft block) and "a decision on
the standby origin" still among its missing items. The G2 and G4 gate-summary
rows were corrected where they asserted an availability failure that no longer
exists.

## Which release each measurement came from

`staging` moves under automated dependency merges, so a result is bound to the
release it was measured on. Ten pins were measured in this window:

| Release         | Worker         | What was measured on it                                                                                                                  |
| --------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `3bf2bf1b`      | `7315171c`     | The first L03 matrix and the CSRF/sign-in probe                                                                                          |
| `5f7f7c74b`     | `2b86c589`     | The first L04 browser journey, blocked at the trainee UI                                                                                 |
| `f475bcc4f`     | `a9d4e785`     | The fix release. Both packages re-measured after the two authorized repairs                                                              |
| `db9b63ed1`     | `2207d7a1`     | All three repair branches deployed; all four assertions re-measured                                                                      |
| `f811440d6`     | `af615b73`     | Validated-session reuse in the middleware (PR #6665); the 8 s deadline becomes dominant                                                  |
| `a24ab11d9`     | `e9aed1a4`     | The Redis command bound (PR #6667); a dead cache becomes a fast miss                                                                     |
| `249c558c4`     | `7542a5d3`     | The reused-pooled-client statement bound (PR #6669); legacy routes turn 500                                                              |
| `42653d506`     | `0f3d77e6`     | The liveness probe and the legacy timeout mapping (PR #6671, #6672); burst passes three windows                                          |
| `8397bdff6`     | `7ea1640e`     | **The preceding round.** Legacy handlers routed through `acquireClient()` (PR #6677): L03 PASS, `VAL-HANG-001` fails at 119 of 120       |
| **`1580a719f`** | **`186b655f`** | **The current pin.** The provider-validation collapse (PR #6679): all four availability assertions pass, L03 provider-bucket conditional |

Cite the current pin for any current claim; cite the earlier pins only as
history, and label them as such.

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

## What keeps the decision at NO-GO now

The availability numbers no longer do. The decision stays NO-GO because:

- **The journey steps do not exist.** Approved session creation, the scenario
  catalog, synthetic-client replies, transcript-grounded coaching and faculty
  review were deferred by owner decision on 2026-11-10 to a follow-up mission.
  They are not omitted, not passed and not silently dropped. The scenario catalog
  and all clinical content are an owner blocker.
- **L02 is open.** The Vercel standby is offline by cause — team `Wutang`
  `billing.status: "overdue"`, `softBlock: UNPAID_INVOICE` at
  `2026-11-09T09:34:18.794Z` — so `www` answers 402
  `x-vercel-error: DEPLOYMENT_DISABLED`; the four-repo commit manifest and the
  incident linkage are missing; no rollback has crossed a migration; and "a
  decision on the standby origin" is still missing.
- **G1, G3 and G5 remain owner decisions or open.** Scope and owners, the frozen
  pilot bundle and evaluation, and the public-claims copy pass are not settled.

The provider class is still live and window-dependent: the stage probe measured
2 of 10 `/userinfo` samples at `429` (median 2 125 ms), and a matrix run taken
right after heavy validation traffic returned 6 provider `503`s. Collapsing the
double call halved the budget spend per cold request; it did not remove the
ceiling. A clean window does not cure the condition, and a matrix run taken
inside such a window records `defects5xx` and an OPEN verdict even though the
quiet-window run on this pin is clean.

## G3/G5 claim and boundary audits (2026-11-10)

Three packages that no availability measurement touches were measured
separately, because their register rows asserted things the release does not do.
None is closed; each now has the artifact its row was missing.

| Document                                                                       | Package  | What it establishes                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`l15-public-claims-release.md`](l15-public-claims-release.md)                 | L15 / G5 | The homepage was **not** corrected: the live apex still serves CACREP/APA/CSWE accreditation, zero-risk and zero-PHI claims. The demo funnel carries a fabricated university endorsement and four unsourced percentages. Full inventory: 132 non-admin pages, 28 live routes, 21 serving claim text. |
| [`l09-excluded-tools-release.md`](l09-excluded-tools-release.md)               | L09 / G3 | The excluded EHR/scheduling/payer surface is permission-gated, not disabled: 36 of 37 routes require auth + role, the client portal pages answer 200 unauthenticated, the public FHIR CapabilityStatement advertises `Appointment` and `Claim` as active, and no exclusion configuration exists.     |
| [`l02-rollback-rehearsal-2026-11-10.md`](l02-rollback-rehearsal-2026-11-10.md) | L02 / G2 | The rollback half of L02 is demonstrated: `7ea1640e` → `0f3d77e6` → restored, health 200 at every transition. A migration-crossing rollback is untested and the Vercel standby answers 402 by billing soft block.                                                                                    |

The L02, L09 and L15 rows in `../LAUNCH_DECISIONS.md` were corrected from these
measurements; the L15 and G5 rows had recorded a homepage rewrite that is absent
from the deployed release. The L15 copy pass is recorded in that document's §7
and lives in the working tree only — production still serves the pre-pass copy
until a deploy.

## What this evidence does not establish

- Nothing about session creation, the approved scenario catalog, synthetic-client
  replies, transcript-grounded coaching, or faculty review. Those steps do not
  exist in the product; they are recorded as blockers with owners. The hardening
  and journey-scaffolding tiers were **deferred by owner decision on 2026-11-10**
  to a follow-up mission — not omitted, not passed, and not silently dropped;
  the removed assertions are preserved in
  `<missionDir>/research/followup-mission-2026-11-10.md`.
- Nothing about any environment other than the pinned production Worker, the
  provisioned Neon database, and the two labelled synthetic organizations.
  `www.pixelatedempathy.com` answers `402 DEPLOYMENT_DISABLED`; only the Worker
  apex serves.
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
are the measurement chain behind the trend above.
