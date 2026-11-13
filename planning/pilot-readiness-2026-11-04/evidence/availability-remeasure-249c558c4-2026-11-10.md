# Availability and persistence re-measurement on the pooled-client query-bound release — 2026-11-10

**Feature:** `availability-release-and-remeasure` (milestone
`availability-and-persistence-fixes`)
**Release under test:** `249c558c4a437952c1112805621ab4aad5e20969` / Worker
`7542a5d3-1f09-4167-8fc1-588dc2aea056` at 100%
**Measurement window:** 2026-11-10T08:42Z – 09:10Z
**Decision:** unchanged — **NO-GO**. L03 and L04 remain OPEN.

This record measures **one change only**: the pooled-client query bound (PR
`#6669`). `validation-double-call-collapse` is deliberately queued behind this
feature so the effect of a single change stays attributable. No pre-fix result is
restated as if it were taken on this pin.

## 1. Release under test

### 1.1 What was merged

| Step                          | Record                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| PR                            | [#6669](https://github.com/daggerstuff/pixelated/pull/6669) — `fix(db): bound a query on a reused pooled client and recycle stale sockets` |
| Head validated                | `bbac84ddbdc96ab6099da280a0a942e921c86298`                                                                                                 |
| PR-head `CI`                  | run `42781450367` — **success** (`pull_request`, 08:17:17Z → 08:24:58Z); `build-test` passed on the head itself                            |
| PR diff                       | 2 files, +284/−8: `apps/web/src/lib/db/index.ts` and the new `apps/web/src/lib/db/__tests__/query-timeout.test.ts`                         |
| Merge                         | `gh pr merge 6669 --squash` at 08:30:27Z → `249c558c4a437952c1112805621ab4aad5e20969`                                                      |
| Staging `CI` on the merge SHA | run `42783179026`, event `push`, **success**, 08:30:30Z → 08:36:15Z — this pin has its own green CI on its exact SHA                       |

The four failing PR checks were the documented non-blocking set and nothing
else: `Vercel` and `Vercel Deployments – Wutang` ("Account is blocked"), the `ai`
submodule strict ratchet, and `AI PR Code Review` (no review generated). Every
other check passed, including `build-test`. Nothing on the branch was reverted.

### 1.2 Deploy and pin

| Item                                            | Value                                                                                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare deploy run                           | `42783944799`, event `workflow_run`, **success**, 08:36:19Z → 08:40:10Z                                                                                                                   |
| Job list                                        | `Detect app-facing changes` success, `Check deploy credentials` success, `Build Cloudflare bundle` success, `Deploy to Cloudflare` success — **none skipped** (no re-dispatch was needed) |
| Built SHA (both jobs, `git log -1 --format=%H`) | `249c558c4a437952c1112805621ab4aad5e20969`                                                                                                                                                |
| Deploy log version line                         | `Current Version ID: 7542a5d3-1f09-4167-8fc1-588dc2aea056`                                                                                                                                |
| Active Worker version (live read)               | `7542a5d3-1f09-4167-8fc1-588dc2aea056`                                                                                                                                                    |
| Traffic percentage                              | **100%** (single active version)                                                                                                                                                          |
| Worker version created                          | 2026-11-10T08:39:47.799Z                                                                                                                                                                  |
| Deployment created                              | 2026-11-10T08:39:49.683Z                                                                                                                                                                  |
| Wrangler CLI used                               | `4.158.0` via `./node_modules/.bin/wrangler`                                                                                                                                              |
| `origin/staging` HEAD                           | `249c558c4…` before the window (08:40Z), during it, and at 09:11:33Z after it — the pin did not move                                                                                      |
| Health                                          | `https://pixelatedempathy.com/api/health` → **200** (1.19–2.40 s across the window); apex `/` → **200** (1.75 s)                                                                          |
| Tail `scriptVersion`                            | `7542a5d3-1f09-4167-8fc1-588dc2aea056` on all 250 captured events                                                                                                                         |

`www.pixelatedempathy.com` was not probed as a health claim: it answers 402 with
`x-vercel-error: DEPLOYMENT_DISABLED` because the Vercel standby account is
blocked, an environment condition unrelated to this release.

### 1.3 What the merged change does

`apps/web/src/lib/db/index.ts` now bounds the statement phase, not only client
acquisition:

- `DB_QUERY_TIMEOUT_MS = 4 000`, set on the pool as `query_timeout` and enforced
  by this module's own deadline race, so a statement on a socket that never
  answers rejects as a retryable `DatabaseUnavailableError` and the client is
  destroyed. `isDatabaseUnavailableError()` also recognises pg's
  `Query read timeout`.
- `DB_MAX_LIFETIME_SECONDS = 60`: `acquireClient()` destroys a client past the
  bound instead of handing it to a statement.
- `acquireClient()`'s success path logs `Acquired database client: new` or
  `Acquired database client: reused`.
- TCP `keepAlive` is declarative on the Worker (`pg-cloudflare` implements
  `setKeepAlive()` as a no-op); the lifetime bound is the mechanism that actually
  recycles a stale socket.

No deadline was widened: the route's 8 s bound, the 2 × 2 500 ms acquisition
bound and the 5 000 ms `statement_timeout` are untouched. A query timeout is not
turned into a `200`.

## 2. VAL-HANG-001 — the 20-navigation authenticated burst

Artifact: `results/availability-release-and-remeasure/burst-249c558c4-20261110T0846Z.json`.
One agent-browser session, signed in as org A through the real `/login` form,
twenty sequential document navigations of the org A training-session URL, manual
redirect handling, at most one 2 s-backed-off retry per request. Per-request
status comes from `PerformanceNavigationTiming.responseStatus` and the rendered
DOM; no network capture was used.

| Quantity                                                                             | Measured on this pin                                                    |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Navigations                                                                          | 20                                                                      |
| **First-attempt session `200`**                                                      | **1 of 20** (leg 1, 1 482 ms; server `wallTime` 1 060 ms, cold isolate) |
| **Final session `200` after at most one retry**                                      | **20 of 20**                                                            |
| First attempts that hit the query bound (302 to `/training?error=session-not-found`) | 19 (server `wallTime` 4 001–4 018 ms)                                   |
| Of those, redirect target `/training` answered `503`                                 | 11 (provider `503` after the 2 500 ms `/userinfo` bound)                |
| Retries issued                                                                       | 19, all final `200` (562–743 ms)                                        |
| Final non-`200`                                                                      | 0                                                                       |
| `/login` redirects                                                                   | 0                                                                       |
| Runtime-cancelled requests / Cloudflare Error 1101                                   | 0                                                                       |

Per leg, first attempt → final:

| Leg | First attempt                                           | First ms | Final | Final ms |
| --- | ------------------------------------------------------- | -------- | ----- | -------- |
| 1   | `200`                                                   | 1 482    | `200` | 1 482    |
| 2   | 302 → `/training?error=session-not-found`               | 4 431    | `200` | 562      |
| 3   | 302 → `/training?error=session-not-found`               | 4 402    | `200` | 699      |
| 4   | 302 → `/training?error=session-not-found`               | 4 434    | `200` | 634      |
| 5   | 302 → `/training?error=session-not-found`               | 4 456    | `200` | 743      |
| 6   | 302 → `/training?error=session-not-found`, target `503` | 6 841    | `200` | 690      |
| 7   | 302 → `/training?error=session-not-found`, target `503` | 6 840    | `200` | 725      |
| 8   | 302 → `/training?error=session-not-found`, target `503` | 6 852    | `200` | 697      |
| 9   | 302 → `/training?error=session-not-found`, target `503` | 6 844    | `200` | 635      |
| 10  | 302 → `/training?error=session-not-found`               | 4 429    | `200` | 709      |
| 11  | 302 → `/training?error=session-not-found`, target `503` | 6 844    | `200` | 673      |
| 12  | 302 → `/training?error=session-not-found`               | 4 455    | `200` | 601      |
| 13  | 302 → `/training?error=session-not-found`               | 4 510    | `200` | 623      |
| 14  | 302 → `/training?error=session-not-found`, target `503` | 6 840    | `200` | 701      |
| 15  | 302 → `/training?error=session-not-found`, target `503` | 6 836    | `200` | 687      |
| 16  | 302 → `/training?error=session-not-found`, target `503` | 6 839    | `200` | 656      |
| 17  | 302 → `/training?error=session-not-found`, target `503` | 6 844    | `200` | 674      |
| 18  | 302 → `/training?error=session-not-found`               | 5 025    | `200` | 637      |
| 19  | 302 → `/training?error=session-not-found`, target `503` | 6 849    | `200` | 624      |
| 20  | 302 → `/training?error=session-not-found`, target `503` | 6 853    | `200` | 679      |

The 4.4 s legs are a 4.0 s bounded session response followed by a fast `/training`
render; the 6.8 s legs are the same 4.0 s response followed by `/training`
answering `503` after its 2 500 ms provider bound.

**Verdict: FAIL.** The contract requires 20 of 20 first attempts to return `200`.
A bounded `503` fails; the page's `302` to `/training?error=session-not-found` is
its translation of that `503` and is scored as a deadline failure. 20 of 20 is
the retry's result, not the release's.

## 3. VAL-L03-011 — the 35-leg tenant matrix

Artifact: `results/l03-tenant-matrix-2026-11-10T08-48-33-234Z.json` (written by
`tools/l03-tenant-matrix.mjs --worker 7542a5d3… --commit 249c558c4…`), with the
driver log at `results/availability-release-and-remeasure/matrix-run-249c558c4.log`.

| Phase               | Pass  | Deny   | Exclusion | Fail  | 5xx    |
| ------------------- | ----- | ------ | --------- | ----- | ------ |
| org A               | 2     | 5      | 2         | 0     | 7      |
| org B               | 2     | 5      | 4         | 1     | 4      |
| unauthenticated     | 0     | 7      | 0         | 0     | 0      |
| **Total (35 legs)** | **4** | **13** | **6**     | **1** | **11** |

**Hard failures: 12** (11 × 5xx + 1 fail; no leg without a response, 0 transient
429). Verdict **OPEN**; the driver exited 1. `--verify-result` re-applies the
gate offline: recorded `OPEN`, recomputed `OPEN`, `hardFailures: 12`, exit **1**
(`matrix-verify-result-249c558c4.json`).

The twelve defect legs:

| Phase | Leg                                                | Status | Body                                       | Attribution                                                     |
| ----- | -------------------------------------------------- | ------ | ------------------------------------------ | --------------------------------------------------------------- |
| org A | own message POST                                   | 503    | `Training message temporarily unavailable` | query bound on a reused client (4 003 ms)                       |
| org A | excluded `/api/session/skills`                     | 500    | `Internal server error`                    | `Query read timeout` (4 004 ms)                                 |
| org A | excluded `/api/session/analytics`                  | 500    | `Internal server error`                    | `Query read timeout` (4 003 ms)                                 |
| org A | excluded `/api/session/snapshots`                  | 500    | `Internal server error`                    | `Query read timeout` (4 007 ms)                                 |
| org A | spoofed `therapistId` on `/api/session/skills`     | 500    | `Internal server error`                    | `Query read timeout` (4 003 ms)                                 |
| org A | spoofed `therapistId` on `/api/session/comparison` | 500    | `Internal server error`                    | `Query read timeout` (4 005 ms)                                 |
| org B | own training-session GET                           | 503    | `Session temporarily unavailable`          | `DatabaseUnavailableError` (4 130 ms)                           |
| org B | spoofed owner GET foreign → org A                  | 503    | `Session temporarily unavailable`          | `DatabaseUnavailableError` (4 144 ms)                           |
| org B | cross-organization message POST → org A            | 503    | `Training message temporarily unavailable` | query bound on a reused client (4 110 ms)                       |
| org B | excluded `/api/session/progress`                   | 500    | `Internal server error`                    | `Query read timeout` (4 003 ms)                                 |
| org B | excluded `/api/session/skills`                     | 403    | `User identity not resolved`               | identity resolution failed on the same reused client (4 137 ms) |
| org B | spoofed `therapistId` on `/api/session/skills`     | 500    | `Internal server error`                    | `Query read timeout` (4 001 ms)                                 |

Two things are new on this pin and must not be read as the old defect:

1. **The 503 legs are bounded at ~4.1 s, not ~8.0 s**, and they carry the route's
   retryable body plus a `DatabaseUnavailableError` log line — the query bound
   fired. They are still hard failures under the contract.
2. **A new `500` class appeared on the legacy `/api/session/*` routes.** Those
   routes map absent schema (`42P01`/`42703`) to the documented `410`, but a
   `Query read timeout` from the new 4 000 ms bound is not mapped, so it surfaces
   as `500 Internal server error`. On `a24ab11d9` the same legs returned `410`;
   this is an interaction introduced by this release, not a pre-existing defect.

The boundary legs that completed behaved as designed: own-session reads returned
`200` with the caller's own id, cross-organization reads returned `404`, all 7
unauthenticated legs returned `401`, and no body contained foreign content.
`Legacy routes identical 410 for both organizations: false` is caused by the
500/403 legs above, not by a boundary break.

Row integrity: both session hashes unchanged
(`16c99c27c729d95ce741ded2e8596d91`, `f520f64c6c53018fe13ac30a4e29fd46`), the
foreign baseline rows unchanged, and exactly one new message row for org B
(`65a38d90-0f77-4421-b024-3a7565bccdc5`, its own POST). Org A's own POST was a
`503` and wrote no row.

**Verdict: FAIL (OPEN).** The bar is zero hard failures.

## 4. VAL-L04-003 — one trainee message round-trip

Artifact: `results/availability-release-and-remeasure/ui-posts-249c558c4-20261110T0920Z.json`.
One agent-browser session, signed in as org A through the real `/login` form,
submission issued through the session UI (`#message-input` + `#send-message`).

| Step                 | Observed                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Submission #2        | **201** in 421 ms                                                                                                 |
| Row                  | `7faffb05-833e-4060-a962-8f36088dc9ac`, content `VAL-POST-001 20261110T0920Z #2`                                  |
| Initial page load    | **200** on the first attempt, 897 ms, 55 bubbles                                                                  |
| Reload attempt 1     | `302` to `/training?error=session-not-found` after 4 505 ms — the page's translation of the bounded session `503` |
| Reload attempt 2     | **200** on the session URL, 709 ms, `#message-input` present, **60** `.message-bubble` children                   |
| Visible after reload | `#2`, `#4`, `#6`, `#8`, `#10` present; `#1`, `#3`, `#5`, `#7`, `#9` absent                                        |

The driver's substring matcher reports `#1` as present because `"… #1"` is a
substring of `"… #10"`; `#1` was a `503` and wrote no row. The database is
authoritative and holds exactly five rows for the five `201` submissions.

**Verdict: PASS** — a message submitted through the UI persisted to
`training_session_messages` and was visible after a reload, confirmed by both
the rendered DOM and a database read.

## 5. VAL-POST-001 — ten consecutive message submissions

Same artifact and surface. Statuses are scored from the plain
`agent-browser network requests` listing; rows are scored from
`training_session_messages` read-back, never from the client status.

| #   | Status | Settled time | Row                                    |
| --- | ------ | ------------ | -------------------------------------- |
| 1   | 503    | 4 094 ms     | none                                   |
| 2   | 201    | 421 ms       | `7faffb05-833e-4060-a962-8f36088dc9ac` |
| 3   | 503    | ~4.4 s       | none                                   |
| 4   | 201    | ~0.75 s      | `4415b21d-720c-4683-9b0b-ced5de0f938b` |
| 5   | 503    | 4 094 ms     | none                                   |
| 6   | 201    | 426 ms       | `83ed2219-e30e-4257-beaf-9768a64e23fb` |
| 7   | 503    | 4 091 ms     | none                                   |
| 8   | 201    | 434 ms       | `502f5f63-c635-4c77-bde5-6638d9de8608` |
| 9   | 503    | ~4.4 s       | none                                   |
| 10  | 201    | ~0.75 s      | `7a64aef7-e625-46c5-a4fd-3a28999eedc6` |

- **`201`: 5 of 10. Rows persisted: 5 of 10.** They agree exactly
  (`statusWithoutRow: 0`, `rowWithoutStatus: 0`), and the bubble count moves
  55 → 60 as the five rows appear.
- `503`: 5 of 10 at ~4.09 s — the query-bound class, not the 8 s message-POST
  deadline (which never fired in this window).
- Runtime-cancelled: 0.
- The failure is strictly alternating on this pin: odd submissions fail, even
  submissions succeed.
- Rows are visible after the reload described in §4.

**Harness note (not a product finding).** After a successful `201`, a
coordinate-based `agent-browser click` on `#send-message` intermittently
produced no request at all while the button was reported enabled; a JS
`.click()` on the same element issued the request. Submissions 3, 4, 9 and 10
were issued that way, and their settled times above subtract the 12 s the
harness spent waiting before the fallback. The statuses and rows are unaffected.
The earlier run tagged `20261110T0905Z` (started 08:58:57Z, finished 09:02:34Z)
loaded the session page on its first attempt (`200`, 909 ms, 53 bubbles) and got
two submissions through — `503` at 4 088 ms, then `201` at 422 ms with row
`b9790c19-8459-416e-90de-7ed1cfb53e37` — after which submissions 3–10 issued **no
request at all** (25 s harness timeout each, input left uncleared): the click
defect described above, not the edge. That single row is counted in §8; the run
is otherwise kept only as an artifact. The scored run is tagged
`20261110T0920Z` (started 09:05:45Z, finished 09:09:15Z; that tag is also inside
the message content of its rows), and it needed five sign-in attempts with
10/15/20/30 s backoff before landing on `/dashboard`.

The edge `429` is confined to sign-in, and the tail dates it: 7 responses at
08:50:43–08:50:54Z on `/api/auth/csrf`, `/api/auth/signin` and
`/api/auth/auth0-profile` (the 08:50Z run, which therefore never left `/login`
and wrote nothing), and 21 more at 09:05:47–09:06:5xZ (the scored run's five
sign-in attempts). No `429` appears between 08:58Z and 09:02Z, so the
interrupted run's stall is the click defect and is not attributed to the edge.

**Verdict: FAIL.** The bar is ten consecutive successes, each with a row and a
reload-visible message; 5 of 10 succeeded.

## 6. The new acquire line and the query bound in the tail

One redacted capture covers the whole window:
`results/availability-release-and-remeasure/tail-249c558c4-20261110T0845Z.jsonl`,
**250 events**, 08:42:27Z – 09:10Z, `scriptVersion: 7542a5d3…` on every event.
The capture was stopped before counting.

`tools/tail-silence-report.mjs`:

```text
events=250 withRedis=148 silence>=7500ms=0 ofWhichDeadline=0
```

**The 8 s silence is gone.** No event in the window shows ≥ 7 500 ms of silence
after a Redis error line, and no `Training session load deadline exceeded` line
appears at all. Every failing leg now ends at the query bound:

| Request class                        | n   | wall time                 | `Acquired: reused` | `Acquired: new` | `New client connected` | `Training session database unavailable` | `Query read timeout` |
| ------------------------------------ | --- | ------------------------- | ------------------ | --------------- | ---------------------- | --------------------------------------- | -------------------- |
| session page `200`                   | 25  | 191–1 060 ms (median 315) | 25                 | 25              | 25                     | 0                                       | 0                    |
| session page `302` (bounded failure) | 20  | 4 001–4 018 ms            | 20                 | 0               | 0                      | 20                                      | 0                    |
| session API `503`                    | 2   | 4 130–4 144 ms            | 2                  | 0               | 0                      | 2                                       | 0                    |
| message POST `503`                   | 9   | 4 001–4 110 ms            | 9                  | 0               | 0                      | 0                                       | 0                    |
| message POST `201`                   | 8   | 178–835 ms                | 1                  | 8               | 8                      | 0                                       | 0                    |
| legacy `/api/session/*` `500`        | 7   | 4 001–4 007 ms            | 1                  | 0               | 0                      | 0                                       | 7                    |
| legacy `/api/session/*` `410`        | 6   | fast                      | 2                  | 6               | 6                      | 0                                       | 0                    |

**The new acquire line separates the two outcomes, which the previous window
could not show.** Every successful session-page load logged
`Acquired database client: reused` _and_ `Acquired database client: new` plus
`New client connected to database`: the stale client was detected, destroyed, and
replaced. Every failing session-page leg logged `Acquired database client:
reused` and nothing else — it ran its statement on the stale client, and the
4 000 ms query bound ended it. In the whole window: 20 of 20 failing session
pages reused a client and opened none; 25 of 25 successes opened a new one.

Five additional `302` events with `wallTime` 1–138 ms and no logs are
unauthenticated redirects to `/login` from the failed sign-in attempts; they are
not deadline legs and are excluded from the table.

## 7. Attribution — what moved and what did not

Latency and the 503 count are recorded independently, as D2/D3 require.

| Quantity                                              | Baseline `a24ab11d9` / `e9aed1a4` (same-day, pre-fix) | This pin `249c558c4` / `7542a5d3` | Moved?                                    |
| ----------------------------------------------------- | ----------------------------------------------------- | --------------------------------- | ----------------------------------------- |
| Failing-leg latency (session page, server `wallTime`) | 7 993–8 044 ms                                        | **4 001–4 018 ms**                | **yes — halved and bounded**              |
| Silence ≥ 7 500 ms after a Redis error line           | 30 legs in the recorded window                        | **0**                             | **yes — eliminated**                      |
| `Training session load deadline exceeded` lines       | present on every deadline leg                         | **0**                             | **yes — the deadline no longer fires**    |
| Successful session load latency                       | 262–2 623 ms (warm ~300 ms)                           | 191–1 060 ms (median 315 ms)      | no material change                        |
| `VAL-HANG-001` first-attempt `200`                    | 3 of 20                                               | **1 of 20**                       | inside the 1–4 spread; not an improvement |
| `VAL-HANG-001` final `200`                            | 18 of 20                                              | **20 of 20**                      | yes                                       |
| Deadline legs (first attempt)                         | 16                                                    | **19**                            | inside the 13–19 spread                   |
| `VAL-HANG-001` verdict                                | FAIL                                                  | **FAIL**                          | no                                        |
| `VAL-L03-011` hard failures                           | 7                                                     | **12**                            | **no — worse; a new 500 class appeared**  |
| `VAL-POST-001` successes                              | 5 of 10                                               | **5 of 10**                       | no                                        |
| `VAL-POST-001` failure latency                        | 8.06–8.08 s                                           | **~4.09 s**                       | yes — halved                              |
| Runtime-cancelled requests                            | 0                                                     | 0                                 | unchanged                                 |

**What the query bound bought.** The statement phase on a reused pooled client
is now bounded and named. A request that would previously hang for the full 8 s
route deadline now rejects at ~4.0 s as a retryable `DatabaseUnavailableError`
(session routes) or a `Query read timeout` (legacy routes), and the client is
destroyed so the next request opens a fresh connection and succeeds in
191–370 ms. That is why the burst's retries all succeeded and why the final
count rose from 18 to 20 of 20.

**What it did not buy.** `VAL-HANG-001` requires 20 of 20 on the _first_
attempt; the stale-socket condition still hits 19 of 20 first attempts, so the
assertion still fails. The 503 count did not fall: it halved in latency and the
class changed, but the matrix now records **12** hard failures against the
baseline's 7, because the bound surfaces as an unmapped `500` on the legacy
routes (7 legs) and as a `403 User identity not resolved` on one more. The
message-reliability bar is unchanged at 5 of 10.

**Attribution of every surviving class.** Nothing is recorded as an environment
blocker, and no leg is left unattributed:

- Session-page `302` (19 burst first attempts, 2 matrix GETs): query bound fired
  on a reused client — `DatabaseUnavailableError` logged, retryable `503` body.
- Message-POST `503` (5 UI + 2 matrix + 1 diagnostic + 1 earlier run): 4.0 s on a
  reused client, route's retryable `503` body, no 8 s deadline line. The bound
  fired; the route does not log the error itself, so the attribution rests on
  the wall time, the reused client and the absence of the 8 s deadline.
- Legacy `/api/session/*` `500` (7 matrix legs): `Query read timeout` logged at
  4.0 s; the route's exclusion mapping only recognises `42P01`/`42703`.
- Legacy `403 User identity not resolved` (1 matrix leg): identity resolution
  failed on the same reused client at 4 137 ms; the route answers a
  database-availability failure as a non-retryable `403` by design.
- Provider `503` on `/training` (11 burst redirect targets): `Failed to track
  security event` after a 2 500 ms `/userinfo` bound; the Auth0 `/userinfo`
  bucket is 10 per window and the app validates on the cache-miss branch. This
  is the known provider class, not the deadline.

**Why the socket never answers remains unattributed**, as it did before this
change: a peer-side close the runtime never surfaces, a frozen-isolate socket,
and a middlebox are all consistent with the capture. The new bound turns that
into a named, retryable failure; it does not explain it. That residual is
reported as unattributed, not as an environment blocker.

## 8. Rows this window wrote

All rows are synthetic, mission-marked, and reversible with
`tools/reverse-l03-identities.mjs`.

| Source                                                                | Org A      | Org B      |
| --------------------------------------------------------------------- | ---------- | ---------- |
| Start of window (`row-state-before-matrix-249c558c4.json`, 08:46:53Z) | 53         | 6          |
| Matrix own-write probes                                               | +0 (`503`) | +1 (`201`) |
| UI run `20261110T0905Z` (two submissions, one row)                    | +1         | 0          |
| Diagnostic submissions (`DIAG`, `DIAGSEQ`)                            | +1         | 0          |
| UI run `20261110T0920Z` (VAL-POST-001)                                | +5         | 0          |
| **End of window (`row-state-after-249c558c4.json`, 09:11:17Z)**       | **60**     | **7**      |

Total `training_session_messages` rows in the two synthetic sessions at the end
of the window: **67**. Both session hashes are unchanged
(`16c99c27c729d95ce741ded2e8596d91`, `f520f64c6c53018fe13ac30a4e29fd46`).

**Total mission-marked row count for close-out cleanup:** 67
`training_session_messages` rows, plus 2 `workspaces`, 2 `users`, 2
`auth_accounts` and 2 `sessions` — **75 mission-marked rows across the five
tables**. The 08:50Z run that stayed on `/login` wrote no row.

The run tags in these artifact names are labels, not clock times: the
`20261110T0905Z` file covers 08:58:57Z–09:02:34Z and the `20261110T0920Z` file
covers 09:05:45Z–09:09:15Z. The authoritative times are the `startedAt` /
`finishedAt` fields inside each file.

## 9. Artifacts

| File (under `results/availability-release-and-remeasure/` unless noted)           | What it holds                                                                                  |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `burst-249c558c4-20261110T0846Z.json`                                             | the 20-navigation burst, per-leg first and final chains with status and bubble counts          |
| `l03-tenant-matrix-2026-11-10T08-48-33-234Z.json` / `.md` (in `results/`)         | the 35-leg matrix, per-leg bodies, and row-integrity hashes                                    |
| `matrix-run-249c558c4.log`, `matrix-verify-result-249c558c4.json`                 | driver output and the offline `--verify-result` recomputation (exit 1, OPEN, 12 hard failures) |
| `ui-posts-249c558c4-20261110T0920Z.json`                                          | the scored ten-submission run (09:05:45Z–09:09:15Z), reload, and DB read-back                  |
| `ui-posts-249c558c4-20261110T0905Z.json`                                          | the interrupted run (08:58:57Z–09:02:34Z): two submissions, one row, then no request issued    |
| `ui-posts-249c558c4-20261110T0853Z.json`                                          | the first attempt, where the browser stayed on `/login` (no rows written)                      |
| `tail-249c558c4-20261110T0845Z.jsonl`                                             | redacted tail over the whole window (250 events)                                               |
| `tail-full-analysis.json`, `tail-through-matrix.json`, `tail-burst-analysis.json` | per-request marker analysis behind §6 and §7                                                   |
| `tail-249c558c4-silence.json`                                                     | `tools/tail-silence-report.mjs` output (0 silences ≥ 7 500 ms)                                 |
| `row-state-before-matrix-249c558c4.json`, `row-state-after-249c558c4.json`        | row counts and hashes at 08:46:53Z and 09:11:17Z                                               |

## 10. Decision

**NO-GO is unchanged.** Three of the four assertions measured here still fail on
this release, and the fourth passes:

| Assertion      | Requirement                                         | Measured on this pin                                                              | Verdict         |
| -------------- | --------------------------------------------------- | --------------------------------------------------------------------------------- | --------------- |
| `VAL-HANG-001` | 20 of 20 first-attempt 200                          | 1 first-attempt, 20 final, 19 bounded deadline legs, 0 `/login`, 0 runtime-cancel | **FAIL**        |
| `VAL-L03-011`  | zero hard failures across 35 legs                   | 12 hard failures (11 × 5xx, 1 fail)                                               | **FAIL (OPEN)** |
| `VAL-L04-003`  | one UI message persists and is visible after reload | row `7faffb05-…`, visible after a `200` reload                                    | **PASS**        |
| `VAL-POST-001` | ten consecutive successes with a row each           | 5 of 10 `201`, 5 rows, 0 runtime-cancelled                                        | **FAIL**        |

The pooled-client query bound did what it was designed to do — the 8 s silence is
gone, the failing legs are bounded at 4.0 s with a named, retryable error, and
the retry path now succeeds 20 of 20 — but it did not restore first-attempt
availability, did not change the message-reliability bar, and introduced a `500`
class on the legacy exclusion routes that the next hardening pass must map. No
assertion is recorded as passed without a reproduced measurement.
