# Availability and persistence re-measurement on the #6665 release — 2026-11-10

Measured on commit `f811440d6da0794c7462e1a89d94594001a383cd` / Worker
`af615b73-e951-4efe-99c1-84f7733f7902` at **100%** traffic (version created
2026-11-10T05:32:12.335Z, deployment created 05:32:14.248Z). The pin was read
live with `./node_modules/.bin/wrangler deployments status --name
pixelated-empathy` at 05:33Z and re-read at 06:23:18Z after the last
measurement: same commit, same Worker version, still 100%, and `git ls-remote
origin refs/heads/staging` returned `f811440d6…` at both reads. Full pin record:
`library/release-pin.md` §0.13.

This record replaces no earlier one. The `db9b63ed1` / Worker `2207d7a1` results
of the same day stay bound to that pin (`evidence/availability-remeasure-2026-11-10.md`);
nothing below is a restatement of them, and every comparison to them is labelled
**baseline**.

## 1. What this release is, and how it was produced

| Step                                                      | Record                                                                                                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PR #6665 (`mission/validation-cache-reuse-in-middleware`) | head `e3343d153c8590f5ebbec21fbc050a6fcef9bd72`; diff `apps/web/src/middleware.ts` + two test files (+473/−0)                                                                                                |
| PR-head `build-test`                                      | run `42758414629` — **success** on `e3343d153` itself, 04:58:35Z, ~7m37s                                                                                                                                     |
| PR checks that failed                                     | the documented non-blocking set only: `Vercel` and `Vercel Deployments - Wutang` ("Account is blocked"), `ai` submodule strict ratchet, `AI PR Code Review` (Cloudflare AI Gateway 401, no review generated) |
| Merge                                                     | `gh pr merge 6665 --squash` at 05:22:10Z → `f811440d6da0794c7462e1a89d94594001a383cd`, subject `fix(auth): reuse the validated-session cache in the middleware (#6665)`                                      |
| Exact-SHA `CI`                                            | run `42761700548` on `f811440d6` — `build-test` **success**. This pin has its own green CI; the `db9b63ed1` exact-SHA gap does not repeat here                                                               |
| Cloudflare deploy                                         | run `42762420068` (`workflow_run`) — **success**; jobs `Detect app-facing changes`, `Check deploy credentials`, `Build Cloudflare bundle`, `Deploy to Cloudflare` all **ran, none skipped**                  |
| Deploy run built SHA                                      | both build and deploy jobs logged `git log -1` = `f811440d6da0794c7462e1a89d94594001a383cd`                                                                                                                  |
| Deploy log version line                                   | `Current Version ID: af615b73-e951-4efe-99c1-84f7733f7902`                                                                                                                                                   |
| Health at the pin                                         | `https://pixelatedempathy.com/api/health` → **200** (1.30–1.55 s over three probes); apex `/` → **200** (1.29–1.31 s)                                                                                        |

`https://www.pixelatedempathy.com` answers **402** with
`x-vercel-error: DEPLOYMENT_DISABLED` because the Vercel standby account is
blocked. That is an environment condition, not a mission failure, and it was not
probed as a health claim.

**What the fix changes** (read from the merge, not measured): in
`apps/web/src/middleware.ts`, `resolveCookieSession` is now cache-first —
`readCachedSession()` before `getSession()` — so a warm validated session no
longer calls `validateToken`; only a cache miss does. The provider-outage
answer introduced by #6655 (503 + `Retry-After` on `/admin*`, `/training*` and
the session-bearing `/api/*` prefixes) is unchanged.

## 2. Verdicts

| Assertion      | Requirement                                                                                                                                   | Measured on this pin                                                                                                                                                                                                                                                                                | Verdict                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `VAL-HANG-001` | 20 of 20 authenticated navigations return HTTP 200, at most one backed-off retry each; a burst in which loads still exceed the deadline fails | **1 of 20 first-attempt session 200**; 19 first attempts exceeded the 8 s deadline (10 of them served a **503** document, 9 a 200 `/training?error=session-not-found` page); final after one retry each: **20 of 20 session 200**, 0 `/login` redirects, 0 no-response, 0 runtime-cancel exceptions | **FAIL** — 19 of 20 loads still exceed their deadline |
| `VAL-L03-011`  | zero hard failures across the 35-leg matrix                                                                                                   | 35 legs: 3 pass, 13 deny, 11 exclusion, 0 fail, **8 × 5xx**, 0 no-response, 0 transient 429 → **8 hard failures**; driver verdict **OPEN**, `--verify-result` recomputes OPEN and exits 1                                                                                                           | **FAIL (OPEN)**                                       |
| `VAL-L04-003`  | one UI message persists and is visible after reload                                                                                           | submission #2 → **201** in 618 ms, row `4bbced4d-34ff-46fc-9246-a80d1181d834`; separate post-run reload (06:09:19Z) returned 200 with 24 bubbles and all five run rows visible                                                                                                                      | **PASS**                                              |
| `VAL-POST-001` | ten consecutive UI submissions all succeed and persist                                                                                        | **5 of 10** 201 (603–3 737 ms) with 5 rows; **5 of 10** deadline 503 (`Retry-After: 1`, 8 387–11 529 ms elapsed) with no row; 0 runtime-cancel exceptions                                                                                                                                           | **FAIL**                                              |

## 3. `VAL-HANG-001` — the twenty-navigation authenticated burst

Method: one `agent-browser` process, one sign-in through the real `/login` form
as the synthetic org A user, twenty sequential fresh navigations to
`https://pixelatedempathy.com/training/session/33333333-3333-4333-8333-333333333333`,
document status read from
`performance.getEntriesByType('navigation')[0].responseStatus`, at most one
backed-off retry (3 s) per request, `auth-token` cookie checked before every
request. Window 05:45:23Z–05:50:18Z. Artifact:
`results/availability-release-and-remeasure/burst-requests-f811440d6.json`.

| #   | First attempt                                            | Document status | Final                   | Retried |
| --- | -------------------------------------------------------- | --------------- | ----------------------- | ------- |
| 1   | session rendered, 1 712 ms                               | 200             | 200, 14 bubbles         | no      |
| 2   | deadline → `/training?error=session-not-found`, 8 161 ms | 200             | 200, 364 ms, 14 bubbles | yes     |
| 3   | deadline redirect, 8 168 ms                              | 200             | 200, 398 ms, 14 bubbles | yes     |
| 4   | deadline redirect, 8 141 ms                              | 200             | 200, 725 ms, 14 bubbles | yes     |
| 5   | deadline redirect, 10 630 ms                             | **503**         | 200, 317 ms, 14 bubbles | yes     |
| 6   | deadline redirect, 8 895 ms                              | 200             | 200, 366 ms, 14 bubbles | yes     |
| 7   | deadline redirect, 8 149 ms                              | 200             | 200, 357 ms, 14 bubbles | yes     |
| 8   | deadline redirect, 10 556 ms                             | **503**         | 200, 432 ms, 14 bubbles | yes     |
| 9   | deadline redirect, 10 597 ms                             | **503**         | 200, 314 ms, 14 bubbles | yes     |
| 10  | deadline redirect, 8 924 ms                              | 200             | 200, 308 ms, 14 bubbles | yes     |
| 11  | deadline redirect, 8 157 ms                              | 200             | 200, 341 ms, 14 bubbles | yes     |
| 12  | deadline redirect, 10 560 ms                             | **503**         | 200, 454 ms, 14 bubbles | yes     |
| 13  | deadline redirect, 10 556 ms                             | **503**         | 200, 360 ms, 14 bubbles | yes     |
| 14  | deadline redirect, 10 183 ms                             | 200             | 200, 392 ms, 14 bubbles | yes     |
| 15  | deadline redirect, 10 560 ms                             | **503**         | 200, 373 ms, 14 bubbles | yes     |
| 16  | deadline redirect, 10 573 ms                             | **503**         | 200, 411 ms, 14 bubbles | yes     |
| 17  | deadline redirect, 10 559 ms                             | **503**         | 200, 363 ms, 14 bubbles | yes     |
| 18  | deadline redirect, 10 561 ms                             | **503**         | 200, 383 ms, 14 bubbles | yes     |
| 19  | deadline redirect, 10 562 ms                             | **503**         | 200, 377 ms, 14 bubbles | yes     |
| 20  | deadline redirect, 10 174 ms                             | 200             | 200, 389 ms, 14 bubbles | yes     |

Counts: **first-attempt session 200 = 1 of 20**; **final session 200 = 20 of
20**; retries 19; final 5xx 0; final `/login` redirects 0; no-response 0;
runtime-cancel exceptions 0. The auth cookie was present before all twenty
requests (`authCookieBefore: true` ×20), so no client-side cookie loss explains
any leg.

**Verdict: FAIL.** The contract is explicit that "a burst in which loads still
exceed their deadline is a bounded failure". Nineteen of twenty loads exceeded
the 8 000 ms deadline, and ten of those served a `503` document before the
retry succeeded. The 20-of-20 final figure is the retry's result, not the
release's; scoring it as a pass would defeat the assertion.

**Baseline comparison (`db9b63ed1`, not this pin):** 5 first-attempt 200, 12
first attempts that hit the deadline, 10 of 20 final 200, 6 final 5xx (all
provider, `Retry-After: 30`), 4 final deadline redirects. On this pin the final
5xx and the final redirects both fall to **0**, but the first-attempt picture is
worse: **19** first attempts hit the deadline against 12, and the 5xx that do
appear are `503` documents inside the deadline chain rather than provider
answers. The number of legs that miss the deadline did not improve.

**Tail of the same window** (`results/availability-release-and-remeasure/tail-20261110T0535Z.jsonl`,
127 events, 05:45:23Z–05:50:30Z, `scriptVersion: af615b73-…` in the first
captured event):

| Observation                                     | Value                                                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/training/session/<id>` responses              | 20 × 200, 19 × 302                                                                                   |
| Successful session loads, wall time             | 231–369 ms, plus one 1 583 ms (cold isolate)                                                         |
| Deadline legs, wall time                        | 7 998–8 001 ms (all 19)                                                                              |
| Successful loads that logged a Postgres connect | 20 of 20 (`New client connected to database`); `Database pool initialized` on 1 of 20 (cold isolate) |
| Deadline legs that logged a Postgres connect    | **0 of 19**                                                                                          |
| `/training` page loads                          | 19 (9 × 200, 10 × 503)                                                                               |
| Runtime-cancel exceptions                       | **0**                                                                                                |

## 4. `VAL-L03-011` — the 35-leg tenant matrix

Driver: `node <missionDir>/tools/l03-tenant-matrix.mjs --worker af615b73-… --commit f811440d6…`,
05:51:57Z–05:54:52Z. Artifact:
`results/l03-tenant-matrix-2026-11-10T05-54-52-501Z.json` (+ `.md`).
`--verify-result` on that file recomputes `OPEN` and exits **1**.

| Quantity                       | Value           |
| ------------------------------ | --------------- |
| Legs                           | 35              |
| Pass / deny / exclusion / fail | 3 / 13 / 11 / 0 |
| 5xx defects                    | **8**           |
| No response                    | 0               |
| Transient 429                  | 0               |
| **Hard failures**              | **8**           |
| Driver verdict                 | **OPEN**        |

Hard-failure legs, all `DEFECT_5XX`:

| Phase | Leg                                                        | Status |
| ----- | ---------------------------------------------------------- | ------ |
| org-a | spoofed-owner GET own session (must stay own)              | 503    |
| org-a | cross-organization message POST → org-b                    | 503    |
| org-a | cross-organization message POST with spoofed owner → org-b | 503    |
| org-a | excluded route `/api/session/progress`                     | 503    |
| org-a | excluded route `/api/session/skills`                       | 503    |
| org-a | excluded route `/api/session/analytics`                    | 503    |
| org-b | spoofed-owner GET own session (must stay own)              | 503    |
| org-b | own message POST                                           | 503    |

The boundary behaviour that completed still behaves as designed: all 7
unauthenticated legs returned **401**; every own-session read that completed
returned 200 with the caller's own id; cross-organization reads returned 404 and
cross-organization writes were denied; the legacy routes returned **410** on
every leg that answered (5 base legs plus 2 spoofed-parameter variants), and
`legacyRoutesIdentical410BothOrgs` is false only because three legacy legs
answered 503 instead of 410.

**Row integrity.** Org A went 14 → 15 messages (the matrix's own POST created
`d2e5f468-e416-45fe-abe2-18ed964c1c6c`); org B stayed at **4 messages with an
unchanged hash** (`2577c308…`); both session hashes are byte-identical
(`16c99c27…`, `f520f64c…`); `foreignBaselineMessagesUnchanged` is true for both
directions. `ownPostRowsOnly.orgB` is false only because org B's own POST
returned 503 and created no row — a missing row where one was expected, not a
foreign row.

**Baseline comparison (`db9b63ed1`, not this pin):** 13 hard failures (5 pass,
12 deny, 5 exclusion, 2 fail, 11 × 5xx). On this pin hard failures fall 13 → 8,
the two `fail` legs are gone (every legacy leg now answers 410 for both orgs),
and the 5xx mix moves from 8 provider + 1 session deadline + 2 message-POST
deadline to **5 provider + 2 session deadline + 1 message-POST deadline**.

## 5. `VAL-L04-003` and `VAL-POST-001` — trainee message round-trip and ten submissions

Run of record `20261110T0615Z`, 06:06:57Z–06:08:27Z, artifact
`results/availability-release-and-remeasure/ui-posts-f811440d6.json`. One
`agent-browser` process signed in as org A through the real `/login` form; ten
sequential UI submissions (`fill #message-input`, `click #send-message`). Status
scored from the **plain** `agent-browser network requests` listing (no `--json`,
no `request <id>`, no `har`), rows scored from `training_session_messages`.

| #   | Status  | Elapsed   | Row                                    | Bubble | Input after |
| --- | ------- | --------- | -------------------------------------- | ------ | ----------- |
| 1   | 503     | 8 387 ms  | —                                      | none   | retained    |
| 2   | **201** | 618 ms    | `4bbced4d-34ff-46fc-9246-a80d1181d834` | added  | cleared     |
| 3   | 503     | 11 515 ms | —                                      | none   | retained    |
| 4   | **201** | 3 737 ms  | `2c477393-a65e-4264-a1be-25380dfe0ad9` | added  | cleared     |
| 5   | 503     | 8 402 ms  | —                                      | none   | retained    |
| 6   | **201** | 603 ms    | `d3b213d4-1767-4b5d-a4ec-1acc57707ced` | added  | cleared     |
| 7   | 503     | 8 404 ms  | —                                      | none   | retained    |
| 8   | **201** | 621 ms    | `fffc422c-442a-4a24-8b58-324f3b8dc885` | added  | cleared     |
| 9   | 503     | 11 529 ms | —                                      | none   | retained    |
| 10  | **201** | 3 731 ms  | `2cb83e69-0301-4752-80b2-565c8341b439` | added  | cleared     |

All five 503s carried `Retry-After: 1` and the tail shows them as
`Training message post deadline exceeded` (8 001 ms), i.e. the bounded POST
deadline, not the provider path. The pattern is a strict alternation
(503, 201, 503, 201, …) — every submission that reached a warm isolate
succeeded, and every submission that landed on a cold one missed the deadline.

`VAL-L04-003` **passes**: submission #2 returned 201 in 618 ms, persisted row
`4bbced4d-…`, and the row was visible after a reload. The run's own in-page
reload landed on `/training` (a deadline redirect) and saw 0 bubbles; a separate
single reload 50 s later at 06:09:19Z returned 200 with 24 bubbles and all five
run contents visible (`results/availability-release-and-remeasure/reload-visibility-0615Z.json`,
`visibleCount: 5`). The separate reload is the confirmation; the in-run one is
recorded as a failure, not smoothed over.

`VAL-POST-001` **fails at 5 of 10** against a bar of ten. Zero requests were
runtime-cancelled.

**Baseline comparison (`db9b63ed1`, not this pin):** 3 of 10 (3 × 201, 4 deadline
503, 3 provider 503). On this pin persistence improves 3 → 5 of 10 and the
provider class disappears from the POST path; the deadline class still halves
every submission.

## 6. The cache, proven in production rather than inferred

The #6665 claim is that a warm validated session no longer calls the provider.
The tail records one `Failed to track security event` line per completed
`validateToken` (the Mongo security-event write always fails in the Worker), so
the line count is a per-request validation count.

| Surface                                          | Requests | Validations (security-event lines) |
| ------------------------------------------------ | -------- | ---------------------------------- |
| `/training/session/<id>` 200 (burst window)      | 20       | **0**                              |
| `/training` page (burst window)                  | 19       | 1 per request                      |
| `/sessions/<id>/events` poll (burst window, 404) | 39       | ~1.2 per request                   |
| Provider-503 legs (matrix window)                | 5        | **exactly 2** each                 |

**Per-request provider call count on the measured path: 0.** Every one of the
twenty successful authenticated session loads completed with no validation, so
the middleware served it from the validated-session cache. The cache miss path
still costs one or two validations, which is where the provider 503s come from.

**The provider 429 count.** The tail does not carry the provider's HTTP status —
it records validations, not `/userinfo` responses — so the 429 count comes from
the host-side probe in `results/diag/request-path-f811440d6.json` (same window):
`/userinfo` returned **8 × 200 then 12 × 429**, with the rate-limit headers
flipping from `x-ratelimit-limit: 300` to **`x-ratelimit-limit: 10`** and
`retry-after: 115–116`; the Auth0 Management API returned **10 × 200, 10 × 429**
(`limit: 10`, `retry-after: 1`). The bucket is ten per window, and two
validations per cold authenticated request exhausts it by construction. Zero
`429` strings appear in the tail window itself (the single textual match is a
timestamp's milliseconds).

## 7. Attribution of the surviving hard failures

Five provider legs and three deadline legs. Each is named against the request
path, not the environment.

**Five provider 503 legs → Auth0 `/userinfo` on the cache-miss branch.** Wall
time 5 001–5 003 ms, exactly two `Failed to track security event` lines, no
Redis error, no deadline line. That is the shape the code predicts: the
middleware misses the cache, `getSession` validates once, the classifying call
validates again, and each validation is bounded by `USERINFO_DEADLINE_MS =
2 500`, so the leg ends at 2 × 2 500 ms with
`{"error":"Authentication provider temporarily unavailable"}` and
`Retry-After: 30`. The stage is named: **the Auth0 `/userinfo` call**.

**Two session-deadline legs and one message-POST deadline leg → the pre-DB cache
read; the sub-step is unattributed.** All three ran to exactly 8 000–8 001 ms
with **zero** completed validations, exactly **one** Redis failure at offset
1–2 ms (`getaddrinfo ENOTFOUND witty-buffalo-119990.upstash.io`, then
`Redis connection closed`), **no** Postgres connect, and **no**
`Training session database unavailable` line. Three things follow, and one does
not:

- It is **not** the Postgres acquisition path: `acquireClient`'s bound would
  raise `DatabaseUnavailableError` at ≤5 s and log
  `Training session database unavailable`; that line never appears.
- It is **not** the provider: a validation that failed would still log, and
  there are zero validations; `/userinfo` is bounded at 2 500 ms anyway.
- It is **after** the Redis cache read was attempted — the failure is logged at
  offset 1–2 ms and the request then goes silent for the rest of the deadline.
- The stage is the cache read between request entry and the first validation.
  **I cannot name the sub-step from the tail**: `ensureConnected()` is bounded at
  3 000 ms, while the `service.get()` that follows it in `getFromCache` has no
  bound and, with ioredis's default offline queue, waits on a client that is
  reconnecting. Separating those two needs per-step instrumentation or a run
  with `USE_REDIS_SESSIONS=false`; neither was available here. Reported as
  **unattributed within that stage**, not as an environment blocker.

The correlation across the whole capture (695 lines, 06:19Z) supports the
placement: **all 81 deadline legs carry a Redis error line** (79 of them exactly
one), while 350 events carry neither a Redis error nor a deadline. A Redis error
alone is not sufficient — 89 fast requests log one too — so the failed read is a
necessary condition, not the whole mechanism.

**One further observation, recorded but not attributed.** The request-path
harness (`--mode all --n 20`, `results/diag/request-path-f811440d6.json`) saw
**3 of 20** navigations with a valid `auth-token` cookie redirect to `/login`
(5.2–7.1 s), a class the browser burst did not reproduce (0 of 20). It is a
remnant of the D1 `/login` redirect path and it is not explained here.

## 8. What moved, and what did not — latency and the 503 count, recorded separately

| Quantity                                       | Baseline (`db9b63ed1` / `2207d7a1`) | This pin (`f811440d6` / `af615b73`) | Moved?                                             |
| ---------------------------------------------- | ----------------------------------- | ----------------------------------- | -------------------------------------------------- |
| Successful session-load wall time              | 1 700–1 900 ms                      | **231–369 ms** (one 1 583 ms cold)  | **yes — ~5× faster**                               |
| `/login` redirects in the 20-navigation burst  | 0                                   | 0                                   | unchanged (already zero at baseline)               |
| First-attempt session 200                      | 5 of 20                             | **1 of 20**                         | **no — worse**                                     |
| First attempts that hit the deadline           | 12 of 20                            | **19 of 20**                        | **no — worse**                                     |
| Final deadline redirects                       | 4                                   | **0**                               | yes, the redirect is gone                          |
| Final session 200 after one retry              | 10 of 20                            | **20 of 20**                        | yes, but the retry carries it                      |
| Final 5xx in the burst                         | 6 (provider)                        | **0**                               | yes as a final status                              |
| `503` documents seen inside the deadline chain | 0                                   | **10** (first attempt)              | **no — a 503 in the chain is still a failed load** |
| Matrix hard failures                           | 13                                  | **8**                               | **yes — 13 → 8**                                   |
| POST successes                                 | 3 of 10                             | **5 of 10**                         | **yes — 3 → 5**                                    |
| Runtime-cancel exceptions                      | 0                                   | 0                                   | unchanged                                          |

**The latency number moved exactly where D3 predicted, and the 503 count did
not move with it.** Bounding Postgres client acquisition is visible in every
successful load (231–369 ms, and a Postgres connect on all 20). The deadline
class, however, did not shrink: 12 of 20 first attempts hit it at baseline and
**19 of 20** do here, and the attribution in §7 shows why it could not have been
fixed by D3 — those legs never reach Postgres at all. D2's estimate that a dead Redis cache costs "about
10 ms typical and at most 1.5 s worst case" does not hold for the
connect-failure path: in production the failed cache read is the entry point of
every 8 s stall observed here.

The cache fix did what it claims — zero provider calls on 20 of 20 warm
requests — and that is what removes the provider 429 from the POST path (3 → 0)
and takes the matrix from 8 provider 5xx to 5.

## 9. Rows this feature wrote

Org A held 14 message rows when the matrix started. Ten mission-marked rows were
added afterwards, all synthetic and all readable back:

| Row                                                                  | Content marker                                | Phase               |
| -------------------------------------------------------------------- | --------------------------------------------- | ------------------- |
| `d2e5f468-e416-45fe-abe2-18ed964c1c6c`                               | `L03 MATRIX own-write probe org-a`            | matrix (05:52:18Z)  |
| `50ee4a23-af7a-40f4-98ac-8f5ee8210cb3`                               | `VAL-POST-001 20261110T0559Z #1`              | superseded POST run |
| `ae0c550f-0baa-4180-aedf-7d14cf8706f8`                               | `DBG wrapper probe 2`                         | harness debug       |
| `f821e902-238a-4d70-8fc9-10863c2d6103`                               | `VAL-POST-001 20261110T0608Z #2`              | superseded POST run |
| `d1b9b2e7-bdb4-4431-a25c-86d8a590bd92`                               | `DBG composer probe 2`                        | harness debug       |
| `4bbced4d-…`, `2c477393-…`, `d3b213d4-…`, `fffc422c-…`, `2cb83e69-…` | `VAL-POST-001 20261110T0615Z #2/#4/#6/#8/#10` | run of record       |

Org B was not written to (4 → 4, hash unchanged). Row state read back at
06:20:50Z: org A 24, org B 4, 28 marked rows in total
(`results/availability-release-and-remeasure/row-state-2026-11-10T06-20Z.json`).
The two debug rows are harness artefacts from determining that the page
recreates `window.fetch` after a 201; they are recorded rather than deleted.

## 10. What this does not prove

- No launch-readiness claim: the decision stays **NO-GO**, and `VAL-HANG-001`,
  `VAL-L03-011` and `VAL-POST-001` remain failed on this pin.
- The pre-DB stall is located to a stage, not to a line (§7).
- The 3 `/login` redirects in the request-path harness are recorded and
  unexplained.
- The Auth0 tenant's `/userinfo` bucket of ten per window is a provider limit
  measured from the host; it was not changed, and any fix that keeps two
  validations per cold request will keep hitting it.
