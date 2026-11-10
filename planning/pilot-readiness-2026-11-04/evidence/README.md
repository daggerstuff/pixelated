# Pilot readiness evidence — index

What is in this directory, which release each document was measured on, and how
to review the go-to-market decision without reading everything.

**Decision: NO-GO.** L03 (tenant boundary) and L04 (trainee-to-faculty journey)
are both **OPEN**. No document here claims the platform is ready for a pilot, and
none may be cited as a launch-readiness claim. The decision was preserved rather
than revised, and the assertions that fail it are recorded as blockers, not
reclassified.

## Read these first

| Order | Document                                                                       | Why                                                                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | [`mission-decision-2026-11-09.md`](mission-decision-2026-11-09.md)             | The decision record. Gate status, exact blockers with an owner role and the next smallest closure action, release provenance, residual risks, incidents, and what is deliberately uncommitted. |
| 2     | [`availability-remeasure-2026-11-10.md`](availability-remeasure-2026-11-10.md) | **The newest measurement.** All three repair branches deployed; the burst, the 35-leg matrix, one message round-trip and ten submissions re-measured on `db9b63ed1`, with what moved and what did not. |
| 3     | [`l03-tenant-boundary-release.md`](l03-tenant-boundary-release.md)             | The tenant-boundary package: the 35-leg matrix per run, the legacy-route exclusions, the tracker state.                                                                                        |
| 4     | [`l04-journey-release.md`](l04-journey-release.md)                             | The journey package: the eight-step proven/blocked map, the availability burst, the trainee-facing consequence.                                                                                |

`../LAUNCH_DECISIONS.md` carries the package rows; its L03 and L04 rows are this
mission's authored contribution. They are committed, and the 2026-11-10
re-measurement appended to each of them names the newer pin rather than
restating an older result on it.

## Which release each measurement came from

`staging` moves under automated dependency merges, so a result is bound to the
release it was measured on. Four pins were measured in this window:

| Release     | Worker     | What was measured on it                                                         |
| ----------- | ---------- | ------------------------------------------------------------------------------- |
| `3bf2bf1b`  | `7315171c` | The first L03 matrix and the CSRF/sign-in probe                                 |
| `5f7f7c74b` | `2b86c589` | The first L04 browser journey, blocked at the trainee UI                        |
| `f475bcc4f` | `a9d4e785` | **The fix release.** Both packages re-measured after the two authorized repairs |
| `db9b63ed1` | `2207d7a1` | **The current pin.** All three repair branches deployed; all four assertions re-measured |

The fix release measurably improved availability — the runtime no longer cancels
authenticated page loads, and the trainee interaction surface now renders — but
it did not close either package. The current pin moves two numbers and leaves the
verdicts alone: successful session loads fell from 8.3–19.9 s to 1.7–1.9 s and
the `/login` redirect went from 13 of 20 to 0, while the burst is still 10 of 20,
the matrix is still OPEN (13 hard failures, now dominated by the Auth0
`/userinfo` limit rather than the 8 s deadline), and message POSTs succeed 3 of
10 with no runtime-cancel exceptions. Cite the current pin for any current
claim; cite the earlier pins only as history.

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

On the current pin (`db9b63ed1` / Worker `2207d7a1`) the same three assertions
still fail, with the mix changed: the burst is 10 of 20 (6 bounded `503`, 4
deadline redirects, 0 `/login` redirects), the matrix is OPEN with 13 hard
failures (8 provider `503`, 1 session deadline, 2 message-POST deadline, 2
`401`), and message POSTs succeed 3 of 10 with no runtime-cancel exceptions.
Successful page loads are 1.7–1.9 s. None of that closes a package; the decision
stays NO-GO.

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
