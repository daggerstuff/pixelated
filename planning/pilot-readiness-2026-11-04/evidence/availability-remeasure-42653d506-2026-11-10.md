# Availability and persistence re-measurement on the liveness-probe release — 2026-11-10

**Feature:** `availability-release-and-remeasure` (milestone
`availability-and-persistence-fixes`)
**Release under test:** `42653d506dc84277c3a53685a954e51a79b7df59` / Worker
`0f3d77e6-4360-4fc5-8d6f-91528fb222d9` at 100%
**Measurement window:** 2026-11-10T15:52Z – 16:20Z (three burst windows inside
it; see §2)
**Decision:** `VAL-HANG-001`, `VAL-L04-003` and `VAL-POST-001` **pass** on this
pin. `VAL-L03-011` **still fails (OPEN)** on a named, surviving mechanism. L03
remains the blocker.

This record measures **one release**: the two remaining repairs merged together
(§1.1). No pre-fix result is restated as if it were taken on this pin; earlier
pins appear only in the trend table in §7, labelled as trend.

## 1. Release under test

### 1.1 What was merged

Both PRs landed. Nothing was reverted, and nothing failed to land — there is no
"did not merge" residual to account for. What remains failing (§10) is the
behaviour the merged code does not reach, not a missing merge.

| Step | PR #6671 | PR #6672 |
| --- | --- | --- |
| Title | `fix(session): map legacy query timeouts to a retryable 503, not a 500` | `fix(db): probe a reused pooled client before handing it to a statement` |
| State at the 15:40Z read | already **MERGED** (15:34:15Z), not open as briefed | open, `MERGEABLE`, `mergeStateStatus: UNSTABLE` |
| Head | `63c800ad2a0518cdc3db6c2b0f9a0cb1b86cfd16` | `1b39b7fcc0c86adaa2d58cae8ff0393476f02f25` |
| Head `CI` run | `42844038876` (`pull_request`) — **success** | `42844034570` (`pull_request`, `headSha` matching) — **success** |
| Merge commit | `f89193647f3ad2306d9617c34649372b0ffd1ac4` | `42653d506dc84277c3a53685a954e51a79b7df59` (squash, 15:37:59Z) |
| Diff | 8 files, all under `apps/web/src/pages/api/session/**` (incl. `_legacy-surface.ts`, the four legacy routes, `snapshots.ts`, two test files) | 2 files: `apps/web/src/lib/db/index.ts` + new `apps/web/src/lib/db/__tests__/liveness-probe.test.ts` |

Both PRs were read again with `gh pr view` rather than trusted from the brief;
the head SHAs matched the brief exactly. The non-blocking check set was the
documented one (`AI PR Code Review`, `Quality` → `ai submodule strict ratchet`,
Vercel standby "Account is blocked"). Neither merge touched a file outside its
stated scope.

### 1.2 Deploy and pin

| Item | Value |
| --- | --- |
| Staging `CI` on the merge SHA | run `42846382789` (event `push`) — **success**, 15:38:02Z → 15:46:46Z |
| Deploy run that skipped the work | `42846448331` (`workflow_run`, created 15:38:25Z) — concluded **success** with `Build Cloudflare bundle` and `Deploy to Cloudflare` **skipped**. Its trigger was the superseded merge's `CI` `42845720781`, which was **cancelled** by the next push |
| Deploy run that deployed | `42847860190` (`workflow_run`, created 15:46:30Z) — **success**; `Detect app-facing changes`, `Check deploy credentials`, `Build Cloudflare bundle`, `Deploy to Cloudflare` all **ran, none skipped**. No `workflow_dispatch` was issued |
| Built SHA (both jobs, `git log -1 --format=%H`) | `42653d506dc84277c3a53685a954e51a79b7df59` |
| Deploy log version line | `Current Version ID: 0f3d77e6-4360-4fc5-8d6f-91528fb222d9` |
| Active Worker version (live read) | `0f3d77e6-4360-4fc5-8d6f-91528fb222d9` |
| Traffic percentage | **100%** (single active version) |
| Worker version created | 2026-11-10T15:50:07.533Z |
| Deployment created | 2026-11-10T15:50:10.554Z |
| Wrangler CLI used for the read | `4.158.0` via `./node_modules/.bin/wrangler deployments status` |
| `origin/staging` HEAD | `42653d506…` at 15:50Z and again at 16:20Z — the pin did not move through the window |
| Health | `https://pixelatedempathy.com/api/health` → **200** (1.40 s); apex `/` → **200** (2.30 s) |
| Tail `scriptVersion` | `0f3d77e6-4360-4fc5-8d6f-91528fb222d9` on **all 279** captured events |

The skipped deploy run is the AGENTS.md trap reproduced exactly: a deploy run
reports `success` while its build and deploy jobs are `skipped`. The job list,
not the conclusion, is what proves a deploy happened. A second automatic
`workflow_run` deploy followed the successful `CI` on the same SHA and ran all
four jobs; the live version read confirms it took effect.

`www.pixelatedempathy.com` was not probed as a health claim: it answers 402 with
`x-vercel-error: DEPLOYMENT_DISABLED` because the Vercel standby account is
blocked. That is an environment condition, not a product regression.

### 1.3 What the two merged changes do

**PR #6671 — legacy timeout mapping.** `_legacy-surface.ts` already documented
`DB_QUERY_TIMEOUT_MS` (4 000 ms, set on the pool as the statement timeout); the
change maps a bound trip to `503` with code
`LEGACY_SESSION_API_TEMPORARILY_UNAVAILABLE` instead of letting pg's
`Query read timeout` surface as `500 Internal server error`. On `249c558c4`
those legs returned `500`; on this pin they return `503`.

**PR #6672 — pooled-client liveness probe.** `acquireClient()` now runs
`SELECT 1` on a borrowed pooled client before handing it to a caller:

- `DB_LIVENESS_PROBE_TIMEOUT_MS = 300` (`DB_LIVENESS_PROBE_TIMEOUT`, `0`
  disables), a fraction of the 4 000 ms statement bound.
- A failed probe destroys the client and acquires a replacement, logging
  `Pooled database client failed its liveness probe (300ms bound); destroyed it
  and acquired a replacement`. The caller never sees the probe.
- `DB_LIVENESS_PROBE_TRIPS = 2`: two failed probes in one acquisition discard
  the pool and raise a retryable `DatabaseUnavailableError`.
- The probe is only on the `acquireClient()` path. A route that calls
  `getPool().connect()` directly is **not** probed — see §7.

## 2. VAL-HANG-001 — the 20-navigation authenticated burst

Requirement: **20 of 20 HTTP `200` on the first attempt**, a bounded `503` fails,
a `/login` redirect counts against the twenty, at most one backed-off retry per
request. The pin is not stable across windows (§7), so the burst was run **three
times** and is reported as three windows rather than one number.

Harness: `tools/request-path-diag.mjs --mode burst --n 20`, a real sign-in cookie
for org A, twenty sequential document `GET`s of
`/training/session/33333333-…` with manual redirect following. This is the
document-request path the assertion names; the rendered-browser path is covered
separately by §4 and §5, which were driven through the real `/login` form.

| Window (UTC start – end) | First-attempt `200` | Final `200` | Retries | `/login` | Runtime-cancel | First-attempt latency min / median / max |
| --- | --- | --- | --- | --- | --- | --- |
| w1 15:52:27.565 – 15:52:47.609 | **20 of 20** | 20 of 20 | 0 | 0 | 0 | 662 / 717 / 1 996 ms |
| w2 15:54:10.212 – 15:54:27.633 | **20 of 20** | 20 of 20 | 0 | 0 | 0 | 633 / 751 / 916 ms |
| w3 15:57:48.356 – 15:58:02.483 | **20 of 20** | 20 of 20 | 0 | 0 | 0 | 437 / 651 / 884 ms |

Every leg in every window answered `session-200` on the first attempt with
`hasMessageInput: true` and `hasLoginForm: false`; 60 of 60 navigations. The only
leg above one second is the cold first leg of w1 (1 996 ms). No leg was retried,
so the "at most one backed-off retry" allowance was never used.

**Verdict: PASS** (20 of 20 first attempt, in all three windows).

The spread matters. The same release `249c558c4` / `7542a5d3` measured 1 of 20
first-attempt at 08:46Z and 5 of 20 at 15:25Z, so a single window on this pin
would not have been evidence of a release property. Three consecutive windows at
20 of 20, with 0 retries and 0 `/login`, is what this record claims — and it is a
claim about these windows, not about every future window.

## 3. VAL-L03-011 — the 35-leg tenant matrix

Harness: `tools/l03-tenant-matrix.mjs --worker 0f3d77e6… --commit 42653d506…`,
driver log `matrix-run-42653d506.log`, result
`results/l03-tenant-matrix-2026-11-10T15-56-20-640Z.json` (+ `.md`). The verdict
is computed by the driver, not by hand.

| Summary field | Value |
| --- | --- |
| `totalLegs` | 35 |
| `passes` / `denials` / `exclusions` / `failures` | 6 / 15 / 8 / 0 |
| `defects5xx` | **6** |
| `hardFailures` | **6** |
| `noResponse` | 0 |
| `transient429` | 0 |
| `unauthenticatedAll401` | true |
| `legacyRoutesIdentical410BothOrgs` | **false** |
| `verdict` | **OPEN** |
| Driver exit code | **1** |
| Offline `--verify-result` recomputation | OPEN, `hardFailures: 6`, exit **1** |

**The boundary legs all held.** Own-org `GET` `200` in both orgs; cross-org `GET`
`404` in both directions; spoofed-owner `GET` `404`; own message `POST` `201` in
both orgs; cross-org `POST` `404` in both directions including the spoofed owner;
all 7 unauthenticated legs `401`. No leg returned another org's row, and no
boundary leg failed.

**The six hard failures are all legacy `/api/session/*` `503`s**, body
`{"error":"Legacy session analytics are temporarily unavailable","code":"LEGACY_SESSION_API_TEMPORARILY_UNAVAILABLE"}`:

| Phase | Leg | Status |
| --- | --- | --- |
| org-a | excluded route `/api/session/skills` | 503 |
| org-a | excluded route `/api/session/analytics` | 503 |
| org-a | spoofed `therapistId` on `/api/session/skills` | 503 |
| org-b | excluded route `/api/session/skills` | 503 |
| org-b | excluded route `/api/session/snapshots` | 503 |
| org-b | spoofed `therapistId` on `/api/session/skills` | 503 |

All six answered at the statement bound: the tail records the six `503`s at
**4 004–4 027 ms** (4 005, 4 008, 4 012, 4 018, 4 004, 4 027). The matrix result
does not store per-leg wall time, so the wall figures come from the tail capture
for the same requests.

`progress` (`410`), `comparison` (`410` × 2, including the spoofed leg) and
`analytics`/`snapshots` in the other phase returned their expected exclusions.
The matrix records these as `DEFECT_5XX`, not as denials: a `5xx` is not a denial
even when the boundary held, and a `500` on a legacy route is never acceptable.
The `500` class that `249c558c4` produced is gone; the `503` that replaced it is
still a defect.

**Verdict: FAIL (OPEN)** — 6 hard failures against a requirement of zero.

## 4. VAL-L04-003 — one trainee message round-trip

Harness: `tools/ab-ui-posts.mjs --mode roundtrip`, one agent-browser session,
signed in through the real `/login` form as org A, artifact
`ui-roundtrip-42653d506-20261110T161838Z.json`.

| Step | Observed |
| --- | --- |
| Sign-in | attempt 1 landed `/dashboard` (no retry needed) |
| Session page load | `200` on attempt 1, message input present |
| Submission | `201` in **657 ms**, issued by a selector click, input cleared |
| Row id | `e323287f-be53-4739-a0b7-155c48f23206` |
| Reload | `200` on attempt 1, 85 bubbles rendered |
| Post-reload visibility | content `VAL-L04-003 20261110T161838Z roundtrip` **visible** (1 of 1) |

**Verdict: PASS.**

Screenshot: `results/availability-release-and-remeasure/l04-verify-posts-20261110T162736Z.png`
(the harness's viewport capture of the reloaded page after scrolling the newest
bubble into view). The visibility claim itself rests on the DOM text read and the
database row, not on the screenshot; the capture is supplementary and was not
visually inspected by the operator.

## 5. VAL-POST-001 — ten consecutive message submissions

Two full runs, both scored from the `training_session_messages` read-back, not
from the button state.

| Run | Sign-in attempts | Submissions | `201` | Rows persisted | Rows before → after | Status-without-row / row-without-status |
| --- | --- | --- | --- | --- | --- | --- |
| `ui-posts-42653d506-20261110T160242Z.json` | 3 (two `401`s while `/userinfo` was rate-limited) | 10 | **10** | 10 | 64 → 74 | 0 / 0 |
| `ui-posts-42653d506-20261110T160549Z.json` | 2 | 10 | **10** | 10 | 74 → 84 | 0 / 0 |

Post-reload read-back: `--mode verify --verify-tag 20261110T160549Z` at 16:13:49Z
found **10 of 10** submitted rows visible in an 84-bubble transcript, and again at
16:27:48Z in an 85-bubble transcript (the extra bubble is the §4 round-trip row).
Screenshot of the 16:27Z reload:
`l04-verify-posts-20261110T162736Z.png`, captured after scrolling the newest
bubble into view; as in §4, the visibility claim rests on the DOM text read.

Latency: the tail's 23 `POST /api/training/sessions` `201`s range **470–713 ms**;
that is the authoritative request latency. Two harness entries report ~8.2 s and
~8.5 s because the harness waited ~7 s for the coordinate click to register
before falling back to the JS `el.click()`; the request itself was ~1 s. The
`issued` field records which path fired (`selector-click`, `js-click`,
`selector-click + js-click-fallback`), and a request line was asserted before
scoring in every submission.

**Verdict: PASS** — 10 of 10 twice, a row each, all visible after reload, 0
runtime-cancelled.

The two `401` sign-ins in the first run were the provider class, not bad
credentials: the response log carries `UserInfoError: Too Many Requests` (§7).

## 6. The tail — acquire line, probe trip, and outcome cross-tabulated

Capture: `tail-42653d506-20261110T1551Z.jsonl`, **279 events**,
15:51Z–16:17Z, `scriptVersion` `0f3d77e6…` on every event. Cross-tabulation:
`tools/acquire-cross-tab.mjs` → `cross-tab-42653d506.json`. Status histogram:
`200` × 119, `201` × 23, `401` × 21, `404` × 95, `410` × 8, `429` × 5, `503` × 6,
`null` × 2 (client aborts). 106 training events; **67 probe trips** in the window.

| Route and outcome | n | Wall min/median/max | `Acquired …: reused` | `…: new` | New client connected | Probe trips | Recycle | Read timeout | `DatabaseUnavailableError` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/training/session/*` **200** | 50 | 522 / 696 / 1 922 ms | 50 | 50 | 50 | **40** | 0 | 0 | 0 |
| `POST /api/training/sessions` **201** | 23 | 470 / 601 / 713 ms | 1 | 23 | 23 | **22** | 0 | 0 | 0 |
| `GET /api/training/sessions` **200** | 4 | 518 / 1 042 / 1 245 ms | 4 | 4 | 4 | 0 | 2 | 0 | 0 |
| cross-org `404` (message/API) | 8 | 515 / 898 / 1 035 ms | 7 | 8 | 8 | 3 | 0 | 0 | 0 |
| `/api/session/comparison` **410** | 4 | 412 / 775 / 1 062 ms | 2 | 4 | 4 | 2 | 0 | 0 | 0 |
| `/api/session/progress` **410** | 2 | 871 / 1 222 / 1 222 ms | 0 | 2 | 2 | 0 | 0 | 0 | 0 |
| `/api/session/analytics` **410** | 1 | 1 043 ms | 0 | 1 | 1 | 0 | 0 | 0 | 0 |
| `/api/session/snapshots` **410** | 1 | 857 ms | 0 | 1 | 1 | 0 | 0 | 0 | 0 |
| `/api/session/skills` **503** | 4 | 4 005 / 4 012 / 4 027 ms | **0** | **0** | **0** | **0** | 0 | 0 | 0 |
| `/api/session/analytics` **503** | 1 | 4 008 ms | **0** | **0** | **0** | **0** | 0 | 0 | 0 |
| `/api/session/snapshots` **503** | 1 | 4 004 ms | **0** | **0** | **0** | **0** | 0 | 0 | 0 |

How to read the `reused` / `new` columns: a session-page leg makes more than one
acquisition, so a leg that trips the probe logs the sequence

```text
Acquired database client: reused
Pooled database client failed its liveness probe (300ms bound); destroyed it and acquired a replacement
New client connected to database
Acquired database client: new
Acquired database client: reused        <- the later call in the same request gets the fresh client
```

which is why `reused` and `new` both equal the leg count while `probeTrips` is 40
of 50. The columns count legs that logged the line, not connections opened.

**The check the feature names — no failing leg may run on a reused client that
was neither probed nor replaced — holds on the probe's own paths and fails by
construction on the legacy routes.**

- Every session-page leg and every message `POST` that borrowed a pooled client
  either passed the probe or tripped it and got a replacement. **Zero** failures
  on those paths, and zero `readTimeout` / `DatabaseUnavailableError` markers.
- All six `503` legs carry **no `Acquired database client` line at all**, no probe
  trip, no read-timeout marker and no `DatabaseUnavailableError`. They never
  entered `acquireClient()`, so the probe never had a chance to run: they borrow
  with `getPool().connect()` (§7).
- The two `recycle` events are the 60 s lifetime bound firing on
  `GET /api/training/sessions`, not the probe.

**Probe cost in the window.** 40 of 50 session legs tripped the probe; those legs
completed in 543–915 ms (median **696 ms**), while the 10 that did not trip took
522–1 922 ms (median **712 ms**; the 1 922 ms is the cold first leg). A trip
appears at 404–538 ms into the leg (median 476 ms): the dead socket fails the
`SELECT 1` immediately rather than consuming the 300 ms bound, and the
replacement connects and answers well inside the 4 000 ms statement bound. The
leg that paid a probe trip is **not** slower than the leg that did not.

Host-side probe cost, measured earlier by the probe worker against the same Neon
database (`results/pooled-client-liveness-probe/probe-cost.json`, 50 samples,
read-only) and **not** re-measured here: `SELECT 1` on a warm reused client p50
**13.2 ms**, p95 **13.4 ms**, max **14.2 ms**; `pool.connect` + probe + release
p50 **13.2 ms**; a fresh connect plus `SELECT 1` p50 **153.3 ms**. The 300 ms
bound is ~22× the measured p95, so a healthy client never trips it.

**Tail silence.** `tools/tail-silence-report.mjs`:
`events=279 withRedis=184 silence>=7500ms=0`. The 8 s silence stays gone
(0 of 279, against 19 of 19 deadline legs on the pre-fix pin).

**Runtime cancellation.** Exactly one exception in 279 events —
`GET /sessions/<id>/events` `Network connection lost.` — a client abort, not a
runtime cancel. **0 runtime-cancelled requests.**

## 7. Attribution — three classes, recorded independently

Latency and the `503` count are recorded as separate quantities, as D2/D3
require. D2 (the dead-Redis cache) was expected to cost ~10 ms typical and at
most 1.5 s worst case and **not** to move `VAL-HANG-001`; D3 (Postgres client
acquisition) was expected to move it. The window confirms that split: the Redis
`ENOTFOUND` line appears on **every** legacy leg, both the `410` successes and
the `503` failures, so it is a constant condition and not the discriminator.

### 7.1 Class 1 — the reused dead socket, on `acquireClient()` paths: **removed**

Named by the acquire line and the probe-trip line. On `249c558c4` (08:46Z) 20 of
20 failing session pages logged `reused` and opened none, and every failure ended
at the 4 000 ms bound. On this pin the same stale client is detected **before**
the caller's statement: 40 of 50 legs tripped the probe, destroyed the socket,
connected a replacement, and answered `200` in 543–915 ms. First-attempt
availability moved from 1 of 20 and 5 of 20 on the previous pin to **20 of 20 in
three windows**. This is the class PR #6672 owns, and it is gone.

### 7.2 Class 2 — the legacy direct-pool borrow: **survives, named**

The six `503`s are not the provider class and not the probe class; they are the
probe's **blind spot**, and the code names it:

| Route | Client acquisition | Probe applies? | Result on this pin |
| --- | --- | --- | --- |
| `apps/web/src/pages/api/session/comparison.ts` | `acquireClient()` (lines 62, 149) | **yes** | `410` × 4, 2 probe trips, 412–1 062 ms |
| `apps/web/src/pages/api/session/progress.ts` | `getPool().connect()` (46, 109) | no | `410` × 2 |
| `apps/web/src/pages/api/session/skills.ts` | `getPool().connect()` (59, 199) | no | **`503` × 4** |
| `apps/web/src/pages/api/session/analytics.ts` | `getPool().connect()` (173, 291) | no | `410` × 1, **`503` × 1** |
| `apps/web/src/pages/api/session/snapshots.ts` | `getPool().connect()` (79, 148) | no | `410` × 1, **`503` × 1** |

`comparison.ts` is the only legacy route on `acquireClient()`, and it is the only
one with zero failures. The other four borrow straight from the pg pool, so a
stale socket is handed to the caller's statement with no probe; the statement
then waits out `DB_QUERY_TIMEOUT_MS = 4 000` and `_legacy-surface.ts` maps it to
the retryable `503`. The attribution rests on three things together: the wall
time sits on the 4 000 ms bound (4 004–4 027 ms), the tail shows no acquire line
and no probe trip for those legs, and the code path calls `getPool().connect()`
directly. **Fix direction (not done here): route those four handlers through
`acquireClient()`.**

### 7.3 Class 3 — the provider validation path: **survives, named**

This class did **not** touch the burst on this pin: 48 of 50 captured page loads
carried no validation line at all, i.e. the validated-session cache served them,
which is why 60 of 60 navigations succeeded.

It is still live elsewhere, and it is now **attributed rather than hypothesised**:

- **13** `/sessions/<id>/events` requests answered `404` at **5 004–5 065 ms**.
  Each carries exactly **two** completed validations **2 500 ms apart** (offsets
  `3 697 → 6 197 ms`, `2 500 → 5 000 ms`, `5 385 → 7 885 ms`, …). Two bounded
  Auth0 `/userinfo` calls at 2 500 ms each is the 5 s shape — the stage is named,
  not inferred from timing absence.
- Four sign-in attempts answered `401` with
  `Failed to fetch user info … UserInfoError: Too Many Requests` and
  `Auth0 sign in error UserInfoError: Too Many Requests` in the response log. The
  provider bucket is being hit; the app's sign-in route turns that into a `401`.
- The `/userinfo` stage probe (`tools/auth0-stage-timing.mjs`, 10 samples at
  16:26Z against the same tenant, same window) measured the stage directly:
  median **110 ms**, min 68 ms, and **one of ten samples answered `429` after
  spending 9 420 ms** in the app's retry path (`UserInfoError: Too Many
  Requests`). Management-API `getUser` stayed at 65–341 ms and
  `postgres_connect_and_select` at 19–161 ms across the same run, so neither the
  directory nor the database is the slow stage — `/userinfo` is.
- Five `429`s in the window are the app's **own** edge limiter
  (`Rate limit exceeded for anonymous at /api/auth/...`), on `/api/auth/*` only,
  not on the training or legacy routes. The matrix recorded `transient429: 0`.

The mechanism is the deferred feature **`validation-double-call-collapse`**:
multiple `validateToken` calls per authenticated request. This release removed
its own class (the reused socket) and did not remove the provider class. It is
not an environment blocker and it is not fixed.

### 7.4 What moved, and what did not

| Quantity | Trend on earlier pins (never current) | This pin `42653d506` / `0f3d77e6` | Moved? |
| --- | --- | --- | --- |
| `VAL-HANG-001` first-attempt `200` | `db9b63ed1` 10/20; `f811440d6` 1–4/20; `a24ab11d9` 3/20; `249c558c4` 1/20 (08:46Z) and 5/20 (15:25Z) | **20/20, 20/20, 20/20** | **yes** |
| `VAL-HANG-001` final `200` | 18/20 → 20/20 → 11/20 | 20/20 × 3 | yes (and no longer depends on retries) |
| First-attempt leg latency | 4 001–4 018 ms on the deadline legs | 437–1 996 ms (median 651–751) | **yes — an order of magnitude** |
| Retries needed | 15–19 per burst | **0** | yes |
| `/login` redirects | 13 → 0 | 0 | unchanged (already 0) |
| `VAL-L03-011` hard failures | 13 → 7 → 12 | **6** | **yes, but not to zero** |
| `500` on legacy routes | 7 legs on `249c558c4` | **0** (now `503`) | yes — class mapped |
| `503` on legacy routes | 0 | **6** | **no — the surviving defect** |
| `VAL-POST-001` | 3/10 → 5–6/10 → 5/10 | **10/10 twice** | **yes** |
| `VAL-POST-001` failure latency | 8.06–8.08 s → ~4.09 s | no failures | n/a |
| Silence ≥ 7 500 ms | 19 legs → 0 | **0 of 279** | unchanged (already 0) |
| Runtime-cancelled requests | 0 | 0 | unchanged |
| Probe cost on a healthy acquire (host-side, earlier) | p50 13.2 ms, p95 13.4 ms, max 14.2 ms | carried, not re-measured | n/a |

**Two independent numbers, two independent statements.** The `503` count moved
on the matrix (12 → 6 hard failures, `500` → `503`) and on the burst (19 deadline
legs → 0). The latency moved with it (4 001–4 018 ms → 437–1 996 ms first
attempt, median 651–751 ms). The probe is what moved both on the paths it
covers; it could not move the six legacy legs because they never reach it.

**What remains unattributed.** Nothing in the four assertions is left
unattributed. The one residual outside them is *why* a peer closes the socket in
the first place — a peer-side close the runtime never surfaces, a frozen-isolate
socket and a middlebox are all consistent with the capture. That is reported as
unattributed, not as an environment blocker, and the probe's job was to make it
harmless rather than to explain it.

## 8. Rows this window wrote

All rows are synthetic, mission-marked, and reversible with
`tools/reverse-l03-identities.mjs`.

| Source | Org A | Org B |
| --- | --- | --- |
| Start of window (matrix baseline, 15:56Z) | 60 | 7 |
| Matrix own-write probes | +1 (`201`) | +1 (`201`) |
| Round-trip `ui-roundtrip-…T1558Z` (partial run; row written, see note) | +1 | 0 |
| Round-trip `ui-roundtrip-…T160052Z` | +1 | 0 |
| Round-trip `ui-roundtrip-…T160130Z` | +1 | 0 |
| Round-trip `ui-roundtrip-…T161838Z` (scored, §4) | +1 | 0 |
| `VAL-POST-001` run `T160242Z` | +10 | 0 |
| `VAL-POST-001` run `T160549Z` | +10 | 0 |
| **End of window (row-state, 16:23Z)** | **85** | **8** |

Cross-org `POST` legs wrote nothing in either direction (each answered `404`; the
integrity hashes confirm org B gained only its own `201`). Both session hashes are
unchanged: `16c99c27c729d95ce741ded2e8596d91` (org A),
`f520f64c6c53018fe13ac30a4e29fd46` (org B).

Note on the 15:58Z partial round-trip: its artifact records **no** submission
entry, but the database holds the row it wrote at 15:58:17Z
(`21aea198-6cf2-4e69-aefb-2312ebb9d493`, content
`VAL-L04-003 20261110T1558Z-rt roundtrip`). The request was issued and persisted;
the harness lost the response record. It is counted as a row and **not** scored
as a round-trip, because there is no captured status or reload for it.

**Total mission-marked row count for close-out cleanup:** **93**
`training_session_messages` rows, plus 2 `workspaces`, 2 `users`, 2
`auth_accounts` and 2 `sessions` — **101 mission-marked rows across the five
tables**. That is **+26** on this window: 26 message rows (2 matrix own-writes,
4 round-trips, 20 posts) and no identity rows (the provisioner was not re-run).

## 9. Artifacts

| File (under `results/availability-release-and-remeasure/` unless noted) | What it holds |
| --- | --- |
| `burst-42653d506-20261110T1552Z-w1.json`, `…T1554Z-w2.json`, `…T1557Z-w3.json` | the three 20-navigation bursts, per-leg first and final chains with status and latency |
| `l03-tenant-matrix-2026-11-10T15-56-20-640Z.json` / `.md` (in `results/`) | the 35-leg matrix, per-leg bodies, and row-integrity hashes |
| `matrix-run-42653d506.log`, `/tmp/verify-result.txt` | driver output and the offline `--verify-result` recomputation (exit 1, OPEN, 6 hard failures) |
| `ui-roundtrip-42653d506-20261110T161838Z.json` | the scored round-trip: `201`, row id, reload, post-reload visibility |
| `ui-roundtrip-42653d506-20261110T1558Z.json`, `…T160052Z.json`, `…T160130Z.json` | earlier round-trips; the 15:58Z one recorded no submission but wrote row `21aea198-…` (§8) |
| `ui-posts-42653d506-20261110T160242Z.json`, `…T160549Z.json` | the two ten-submission runs with read-back |
| `ui-verify-posts-42653d506-20261110T161349Z.json`, `ui-verify-roundtrip-42653d506-20261110T161449Z.json`, `ui-verify-posts-42653d506-20261110T162736Z.json` | the authoritative post-reload visibility checks (10 of 10, 1 of 1, 10 of 10) |
| `l04-verify-posts-20261110T162736Z.png` | viewport screenshot of the 16:27Z reload, taken after scrolling the newest bubble into view (supplementary; the visibility claim rests on the DOM read) |
| `tail-42653d506-20261110T1551Z.jsonl` | redacted tail over the whole window (279 events) |
| `cross-tab-42653d506.json` | `tools/acquire-cross-tab.mjs` output behind §6 |
| `stages-42653d506-20261110T1625Z.json` | `tools/auth0-stage-timing.mjs`: `/userinfo`, management `getUser` and Postgres stage timings at 16:26Z (§7.3) |
| `tail-silence-42653d506.json` | `tools/tail-silence-report.mjs` output (0 silences ≥ 7 500 ms) |
| `row-state-final-20261110T1623Z.json` | final row counts and hashes |

The run tags in artifact names are labels, not clock times. The authoritative
times are the `startedAt` / `finishedAt` fields inside each file.

## 10. Decision

| Assertion | Requirement | Measured on this pin | Verdict |
| --- | --- | --- | --- |
| `VAL-HANG-001` | 20 of 20 first-attempt `200` | **20/20, 20/20, 20/20** in three windows; 0 retries, 0 `/login`, 0 runtime-cancel | **PASS** |
| `VAL-L03-011` | zero hard failures across 35 legs | **6 hard failures** (6 × `503`, all on probe-bypassing legacy routes); driver verdict OPEN, exit 1 | **FAIL (OPEN)** |
| `VAL-L04-003` | one message persists and is visible after reload | `201` in 657 ms, row `e323287f-…`, visible after a `200` reload | **PASS** |
| `VAL-POST-001` | ten consecutive successes with a row each | **10 of 10** twice, 10 rows each, 10 of 10 visible after reload | **PASS** |

**The surviving blocker is L03, and it is a wiring gap, not a probe failure.**
Four of the five legacy session routes call `getPool().connect()` directly, so
the liveness probe cannot run on them; the same stale-socket condition that the
probe now absorbs on the training and message paths still ends those legs at the
4 000 ms statement bound as a retryable `503`. The next repair is to route
`skills`, `analytics`, `progress` and `snapshots` through `acquireClient()`.

**What this release did and did not do.** It removed the reused-client class on
the paths that use the shared acquisition helper, mapped the legacy `500` class
to a retryable `503`, and took message reliability from 5 of 10 to 10 of 10. It
did **not** remove the provider validation class (four `validateToken` calls per
authenticated request, ~2.3 s, deferred as
`validation-double-call-collapse`), and it did **not** reach zero hard failures.
The probe removed its own class rather than the whole gap, and the two classes are
recorded independently above. No assertion is recorded as passed without a
reproduced measurement on this pin.
