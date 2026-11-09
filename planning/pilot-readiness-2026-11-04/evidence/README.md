# Pilot readiness evidence — index

What is in this directory, which release each document was measured on, and how
to review the go-to-market decision without reading everything.

**Decision: NO-GO.** L03 (tenant boundary) and L04 (trainee-to-faculty journey)
are both **OPEN**. No document here claims the platform is ready for a pilot, and
none may be cited as a launch-readiness claim. The decision was preserved rather
than revised, and the assertions that fail it are recorded as blockers, not
reclassified.

## Read these first

| Order | Document                                                           | Why                                                                                                                                                                                            |
| ----- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | [`mission-decision-2026-11-09.md`](mission-decision-2026-11-09.md) | The decision record. Gate status, exact blockers with an owner role and the next smallest closure action, release provenance, residual risks, incidents, and what is deliberately uncommitted. |
| 2     | [`l03-tenant-boundary-release.md`](l03-tenant-boundary-release.md) | The tenant-boundary package: the 35-leg matrix per run, the legacy-route exclusions, the tracker state.                                                                                        |
| 3     | [`l04-journey-release.md`](l04-journey-release.md)                 | The journey package: the eight-step proven/blocked map, the availability burst, the trainee-facing consequence.                                                                                |

`../LAUNCH_DECISIONS.md` carries the package rows; its L03 and L04 rows are this
mission's authored contribution and are deliberately left uncommitted because
that file also holds other missions' rows.

## Which release each measurement came from

`staging` moves under automated dependency merges, so a result is bound to the
release it was measured on. Three pins were measured in this window:

| Release     | Worker     | What was measured on it                                                         |
| ----------- | ---------- | ------------------------------------------------------------------------------- |
| `3bf2bf1b`  | `7315171c` | The first L03 matrix and the CSRF/sign-in probe                                 |
| `5f7f7c74b` | `2b86c589` | The first L04 browser journey, blocked at the trainee UI                        |
| `f475bcc4f` | `a9d4e785` | **The fix release.** Both packages re-measured after the two authorized repairs |

The fix release is the current pin. It measurably improved availability — the
runtime no longer cancels authenticated page loads, and the trainee interaction
surface now renders — but it did not close either package. Cite the fix release
for any current claim; cite the earlier pins only as history.

## The three assertions that keep the decision at NO-GO

Measured twice on the fix release, with the same verdicts:

- **Message persistence is intermittent.** A trainee message POST sometimes
  returns `201` in about four seconds and persists; sometimes it hangs for 50–66
  seconds and is runtime-cancelled with no row written. The 8 s deadline covers
  the page data load only, not the POST path.
- **Availability is not 20/20.** Of twenty sequential authenticated navigations,
  17 and then 18 reached the session page; the rest ended at `/login`. The bar is
  20/20.
- **The tenant matrix has bounded-503 legs.** 2 and then 3 authenticated legs
  returned the deadline `503`, with the leg set varying between runs. The verdict
  is OPEN in both runs.

## What this evidence does not establish

- Nothing about session creation, the approved scenario catalog, synthetic-client
  replies, transcript-grounded coaching, or faculty review. Those steps do not
  exist in the product; they are recorded as blockers with owners.
- Nothing about any environment other than the pinned production Worker, the
  provisioned Neon database, and the two labelled synthetic organizations.
- No customer contact, no enrollment, no pilot commitment.

## Other files here

`charter-review.md`, `training-message-api-review.md`,
`session-route-authorization-review.md`, `EXECUTION_NOTEPAD.md` and
`ULW_NOTEPAD.md` predate this work and are not part of the L03/L04 evidence set.
