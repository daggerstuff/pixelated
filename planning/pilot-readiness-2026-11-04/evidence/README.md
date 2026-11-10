# Pilot readiness evidence — index

What is in this directory, which release each document was measured on, and how
to review the go-to-market decision without reading everything.

**Decision: NO-GO.** L03 (tenant boundary) is now **PASS** on the release under
test; L04 (trainee-to-faculty journey) stays **OPEN** on one named mechanism.
No document here claims the platform is ready for a pilot, and none may be cited
as a launch-readiness claim. The decision was re-derived from the measurements,
not preserved by default, and the assertion that still fails it is recorded as a
blocker with an owner role, not reclassified.

## Read these first

| Order | Document                                                                                           | Why                                                                                                                                                                                                                    |
| ----- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | [`mission-decision-2026-11-10.md`](mission-decision-2026-11-10.md)                                 | **The current decision record.** Per-assertion outcome with pin and artifact, the trend across six pins, the one surviving mechanism, what would change the answer, the deferred tiers, and the phase invariants.      |
| 2     | [`availability-remeasure-8397bdff6-2026-11-10.md`](availability-remeasure-8397bdff6-2026-11-10.md) | **The newest measurement.** `8397bdff6` / Worker `7ea1640e`: the 35-leg matrix, six burst windows, one message round-trip, ten submissions, and the tail cross-tabulation.                                             |
| 3     | [`request-path-diagnosis-2026-11-09.md`](request-path-diagnosis-2026-11-09.md)                     | The diagnosis the fixes cite: the 8 s deadline, the reused-socket class, the legacy direct-pool borrows, and the provider class, each with numbers and a code branch. Carries a dated `round-2-corrections` amendment. |
| 4     | [`mission-decision-2026-11-09.md`](mission-decision-2026-11-09.md)                                 | The previous decision record. Still the state at `f475bcc4f`; superseded as the current decision, kept as the measurement it was.                                                                                      |
| 5     | [`l03-tenant-boundary-release.md`](l03-tenant-boundary-release.md)                                 | The tenant-boundary package: the 35-leg matrix per run, the legacy-route exclusions, the tracker state.                                                                                                                |
| 6     | [`l04-journey-release.md`](l04-journey-release.md)                                                 | The journey package: the eight-step proven/blocked map, the availability burst, the trainee-facing consequence.                                                                                                        |

`../LAUNCH_DECISIONS.md` carries the package rows. Its **L03 and L04 rows are
this mission's authored contribution**, and each now names `42653d506` and
`8397bdff6` rather than ending at an older pin. L03 moved from OPEN to **PASS**;
L04 stays **OPEN**. The G2 and G4 gate-summary rows were corrected where they
asserted that cross-organization verification and release-level tenant isolation
were unproven.

## Which release each measurement came from

`staging` moves under automated dependency merges, so a result is bound to the
release it was measured on. Nine pins were measured in this window:

| Release     | Worker     | What was measured on it                                                                                        |
| ----------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| `3bf2bf1b`  | `7315171c` | The first L03 matrix and the CSRF/sign-in probe                                                                |
| `5f7f7c74b` | `2b86c589` | The first L04 browser journey, blocked at the trainee UI                                                       |
| `f475bcc4f` | `a9d4e785` | The fix release. Both packages re-measured after the two authorized repairs                                    |
| `db9b63ed1` | `2207d7a1` | All three repair branches deployed; all four assertions re-measured                                            |
| `f811440d6` | `af615b73` | Validated-session reuse in the middleware (PR #6665); the 8 s deadline becomes dominant                        |
| `a24ab11d9` | `e9aed1a4` | The Redis command bound (PR #6667); a dead cache becomes a fast miss                                           |
| `249c558c4` | `7542a5d3` | The reused-pooled-client statement bound (PR #6669); legacy routes turn 500                                    |
| `42653d506` | `0f3d77e6` | The liveness probe and the legacy timeout mapping (PR #6671, #6672); burst passes three windows                |
| `8397bdff6` | `7ea1640e` | **The current pin.** Legacy handlers routed through `acquireClient()` (PR #6677): L03 PASS, three of four pass |

Cite the current pin for any current claim; cite the earlier pins only as
history, and label them as such.

## What moved

The phase opened with four failing assertions. On `8397bdff6` / Worker
`7ea1640e`:

- **`VAL-L03-011` PASS.** 35 legs: 6 pass / 15 deny / 14 exclusion / 0 fail,
  `defects5xx` 0, `hardFailures` 0, driver verdict PASS, `--verify-result`
  recomputed PASS with exit 0. Round 1 on `42653d506` had 6 hard failures, all
  legacy handlers borrowing straight from the pool. Those six legs now answer
  their documented `410`, which is why the exclusion count rose 8 → 14.
- **`VAL-L04-003` PASS.** Page `200` on the first attempt, submission `201` in
  660 ms, row `4448f28a-6cb1-429b-9afb-b55e7907cf30`, visible after reload in an
  87-bubble transcript.
- **`VAL-POST-001` PASS.** 10 of 10 `201`, 10 rows, 10 of 10 visible after a
  close/reopen reload, `statusWithoutRow` 0, `rowWithoutStatus` 0,
  `noRequest` 0.
- **`VAL-HANG-001` FAIL.** Six 20-navigation windows: 119 of 120 first-attempt
  `200`. Five windows were 20 of 20 with 0 retries; w4 (17:36:09–17:36:51Z) was
  19 of 20 — first attempt `503` at 5 048 ms, its single retry `302` to `/login`
  at 6 984 ms, `/login` `200` at 8 040 ms. The 8 s silence is gone (0 of 202 tail
  events at or above 7 500 ms, 0 exceptions, 0 runtime-cancel, 0 deadline
  exceeded), and the failing leg never entered `acquireClient()`, so this is the
  provider validation class, not the socket or deadline class.

## The one assertion that keeps the decision at NO-GO

- **Availability is not 20 of 20.** It moved from 1 of 20 first-attempt on
  `f811440d6` (5 of 20 on `db9b63ed1`, 3 of 20 on `a24ab11d9`) to 20 of 20 in
  three windows on `42653d506`, to **119 of 120 across six windows** on
  `8397bdff6`. The single
  failure is the Auth0 provider validation path: four `validateToken` calls per
  authenticated request exhaust the `/userinfo` bucket, and a bounded `503`
  followed by a `/login` landing both count against the twenty. That mechanism
  is **GAP-34** and its fix needs an owner grant extension to
  `apps/web/src/lib/auth/**`; the feature that owned it
  (`validation-double-call-collapse`) is cancelled by the 2026-11-10 scope
  reduction, so no feature in this mission owns the bar any more.

The provider class is live and window-dependent: a host-side probe measured 5 of
10 `/userinfo` samples at `429` (median 8 819 ms), and a 12-leg burst taken while
another validator was signed in produced 4 first-attempt `503`s with
`Retry-After: 30`. A clean window does not cure the failure, and a matrix run
taken inside such a window would record `defects5xx` and an OPEN verdict even
though the recorded matrix on this pin is clean.

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
- No customer contact, no enrollment, no pilot commitment, no launch readiness.

## Other files here

`charter-review.md`, `training-message-api-review.md`,
`session-route-authorization-review.md`, `EXECUTION_NOTEPAD.md` and
`ULW_NOTEPAD.md` predate this work and are not part of the L03/L04 evidence set.
The per-pin records `availability-remeasure-{2026-11-10,f811440d6,a24ab11d9,249c558c4,42653d506,8397bdff6}-*.md`
are the measurement chain behind the trend above.
