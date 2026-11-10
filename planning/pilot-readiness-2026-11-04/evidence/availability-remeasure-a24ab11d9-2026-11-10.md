# Availability and persistence re-measurement on the #6667 release — 2026-11-10

**Feature:** `availability-release-and-remeasure` (milestone
`availability-and-persistence-fixes`)
**Release under test:** `a24ab11d9604134788d13a60f018545e39b4242c` / Worker
`e9aed1a4-920a-4338-a163-55dcc60446cd` at 100%
**Measurement window:** 2026-11-10T07:31Z – 07:53Z
**Decision:** unchanged — **NO-GO**. L03 and L04 remain OPEN.

This record measures **one change only**: the Redis command bound (PR #6667).
`validation-double-call-collapse` is deliberately queued behind this feature so
the effect of a single change stays attributable.

## 1. Release under test

### 1.1 What was merged

| Step | Record |
| --- | --- |
| PR | [#6667](https://github.com/daggerstuff/pixelated/pull/6667) — `fix(cache): bound the Redis command path so a dead cache is a fast miss` |
| Head validated | `9fa4d26648d8aea0705c67788778900187b65f28` |
| PR-head `build-test` | run `42770195523` — **success**, 6m41s, on `9fa4d2664` itself |
| PR-head `CI` workflow | run `42770195523` — **success** |
| PR diff | 2 files, +177/−7: `apps/web/src/lib/redis.ts` and `apps/web/src/lib/redis-command-deadline.test.ts` |
| Merge | `gh pr merge 6667 --squash` at 07:18:20Z → `a24ab11d9604134788d13a60f018545e39b4242c` |
| Staging `CI` on the merge SHA | run `42774353571`, event `push`, **success**, 07:18:24Z → 07:25:51Z — this pin has its own green CI on its exact SHA |

The four failing PR checks were the documented non-blocking set and nothing
else: `Vercel` and `Vercel Deployments – Wutang` ("Account is blocked"), `ai
submodule strict ratchet`, and `AI PR Code Review` (no review generated). Every
other check passed, including `build-test`.

### 1.2 Deploy

| Item | Value |
| --- | --- |
| Cloudflare deploy run | `42775239565`, event `workflow_run`, **success** |
| Job list | `Detect app-facing changes` success, `Check deploy credentials` success, `Build Cloudflare bundle` success, `Deploy to Cloudflare` success — **none skipped** |
| Built SHA (both jobs, `git log -1 --format=%H`) | `a24ab11d9604134788d13a60f018545e39b4242c` |
| Deploy log version line | `Current Version ID: e9aed1a4-920a-4338-a163-55dcc60446cd` |
| Active Worker version (live read) | `e9aed1a4-920a-4338-a163-55dcc60446cd` |
| Traffic percentage | **100%** (single active version) |
| Worker version created | 2026-11-10T07:29:17.412Z |
| Deployment created | 2026-11-10T07:29:19.252Z |
| Wrangler CLI used | `4.158.0` via `./node_modules/.bin/wrangler` |
| `origin/staging` HEAD | `a24ab11d9…` before the window, during it, and at 07:53:39Z after it — the pin did not move |
| Health | `https://pixelatedempathy.com/api/health` → **200** (1.15–2.38 s across the window) |

The automatic deploy was **not** skipped: all four jobs ran. This pin therefore
does not repeat the "deploy run reports success and deploys nothing" trap, and
the serving version is the one the log names.

### 1.3 What the merged change does

`apps/web/src/lib/redis.ts` races each cache command (`get`, `set`, `del`)
against `REDIS_COMMAND_DEADLINE_MS = 250`. A timed-out read is a cache miss
served by the existing in-process fallback (`session:token:`, `identity:sub:`,
`auth0:role:`; 500 entries); a timed-out write returns `false`, which is
`setInCache`'s existing contract. `REDIS_CONNECT_DEADLINE_MS` (3 000 ms), the
fallback prefixes and cap, and `RedisService`'s ioredis options are untouched.
`USE_REDIS_SESSIONS` was not used as a remedy.

## 2. VAL-HANG-001 — the 20-navigation authenticated burst

Artifact: `results/availability-release-and-remeasure/burst-a24ab11d9-20261110T0731Z.json`
(`tools/request-path-diag.mjs --mode burst --n 20`: one sign-in through
`POST /api/auth/signin` with a real CSRF token, twenty sequential authenticated
document requests to the org A training-session URL, manual redirect handling,
at most one 2 s-backed-off retry per request).

| Quantity | Measured on this pin |
| --- | --- |
| Navigations | 20 |
| **First-attempt session `200`** | **3 of 20** |
| **Final session `200` after at most one retry** | **18 of 20** |
| First attempts that hit the 8 s deadline (302 at 7 993–8 044 ms) | 16 |
| Retries issued | 17 |
| Final non-200 | 1 × bounded `503` (leg 14, 6 079 ms), 1 × `/login` redirect (leg 16) |
| Runtime-cancelled requests / Cloudflare Error 1101 | 0 |
| First-attempt success latencies | 311 ms, 1 182 ms, 2 620 ms |

Per leg, first attempt → final:

| Legs | First attempt | Final (after ≤ 1 retry) |
| --- | --- | --- |
| 1, 15, 17 | `200` (1 182 / 2 620 / 311 ms) | `200` |
| 2–13, 18, 20 | `302` at 8 012–8 044 ms → `/training?error=session-not-found` `200` | `200` (262–2 623 ms) |
| 14 | `302` at 8 014 ms → `/training` `200` | `503` at 6 079 ms |
| 16 | `503` at 5 033 ms | `302` → `/login?redirect=…`, `200` login page |
| 19 | `302` at 8 032 ms → `/training` `503` at 4 048 ms | `200` at 448 ms |

Sixteen legs spent the 8 s deadline on the first attempt, and seventeen retries
were issued.

**Verdict: FAIL.** The contract requires 20 of 20 first attempts to return
`200`. A bounded `503` fails; a `/login` redirect counts against the twenty.
18 of 20 is the retry's result, not the release's.

## 3. VAL-L03-011 — the 35-leg tenant matrix

Artifact: `results/l03-tenant-matrix-2026-11-10T07-39-54-893Z.json` (written by
`tools/l03-tenant-matrix.mjs --worker e9aed1a4… --commit a24ab11d9…`).

| Phase | Pass | Deny | Exclusion | Fail | 5xx |
| --- | --- | --- | --- | --- | --- |
| org A | 0 | 2 | 7 | 0 | 5 |
| org B | 2 | 3 | 7 | 0 | 2 |
| unauthenticated | 0 | 7 | 0 | 0 | 0 |
| **Total (35 legs)** | **2** | **12** | **14** | **0** | **7** |

**Hard failures: 7** (any 5xx, any leg without a final response, any transient
429). Transient 429: 0. Verdict **OPEN**; the driver exited 1.
`--verify-result` re-applies the gate offline: recorded `OPEN`, recomputed
`OPEN`, `hardFailures: 7`, exit **1**.

The seven defect legs, all bounded `503`:

1. org A own training-session GET
2. org A spoofed-owner GET of the foreign org B session
3. org A spoofed-owner GET of its own session
4. org A own message POST
5. org A cross-organization message POST with a spoofed owner → org B
6. org B own training-session GET
7. org B cross-organization message POST with a spoofed owner → org A

The boundary itself held: every cross-organization read that received a
response was denied (`404`, and one `401` on the org A cross message POST), every
unauthenticated leg was `401`, and the five legacy routes returned an identical
`410` for both organizations. A `503` is still a hard failure under the
contract: a 5xx is not a denial.

Row integrity: both session hashes unchanged
(`16c99c27c729d95ce741ded2e8596d91`, `f520f64c6c53018fe13ac30a4e29fd46`), the
foreign baseline rows unchanged, and exactly one new message row for org B
(`ab3b38e5-c6d6-49c7-982f-a6450ccca73d`, its own POST). Org A's own POST was a
`503` and wrote no row, so org A's message count did not change.

**Verdict: FAIL.** The bar is zero hard failures.

## 4. VAL-L04-003 — one trainee message round-trip

Artifact: `results/availability-release-and-remeasure/ui-posts-a24ab11d9-20261110T0800Z.json`.
One agent-browser session, signed in as org A through the real `/login` form,
submission issued through the session UI (`#message-input` + `#send-message`).

| Step | Observed |
| --- | --- |
| Submission #2 | **201** in 1 030 ms |
| Row | `bf99e09a-71f3-4d3e-9d79-36d01fb08174`, content `VAL-POST-001 20261110T0800Z #2` |
| Initial page load, attempt 1 | `302` to `/training?error=session-not-found` — the page's translation of the deadline `503` |
| Initial page load, attempt 2 | **200** on the session URL, 48 bubbles |
| Reload attempt 1 | `302` to `/training?error=session-not-found` again |
| Reload attempt 2 | **200** on the session URL, `#message-input` present, **53** `.message-bubble` children (48 before the run, 5 new) |
| Visible after reload | `#2`, `#4`, `#6`, `#8`, `#10` all present in the rendered body |

Both page loads needed one retry because the first attempt hit the same 8 s
deadline as the burst. That is recorded as the load's behaviour, not as a pass:
the round-trip itself (submit → row → visible after a `200` reload) is
reproduced.

The driver's `visibleCount` on that reload reads **6**, not 5, because it tests
each content string for substring presence and `"… #1"` is a substring of
`"… #10"`. `#1` was a `503` and wrote no row, so the rendered DOM and the
database disagree only in the driver's naive matcher; the database is
authoritative and holds exactly five rows.

**Verdict: PASS** — a message submitted through the UI persisted to
`training_session_messages` and was visible after a reload, confirmed by both
the rendered DOM and a database read.

## 5. VAL-POST-001 — ten consecutive message submissions

Same artifact and surface. Statuses are scored from the plain
`agent-browser network requests` listing; rows are scored from
`training_session_messages` read-back, never from the client status.

| # | Status | Duration | Row |
| --- | --- | --- | --- |
| 1 | 503 | 8 082 ms | none |
| 2 | 201 | 1 030 ms | `bf99e09a-71f3-4d3e-9d79-36d01fb08174` |
| 3 | 503 | 8 068 ms | none |
| 4 | 201 | 1 023 ms | `8bf8e5ed-c85a-4875-90cc-5c1e7e65c2fa` |
| 5 | 503 | 8 062 ms | none |
| 6 | 201 | 1 028 ms | `184f0ee5-53bd-44f7-9dcb-432d1303438b` |
| 7 | 503 | 8 078 ms | none |
| 8 | 201 | 1 023 ms | `6ceb584b-008e-4114-8e21-fa2a343fd07c` |
| 9 | 503 | 8 068 ms | none |
| 10 | 201 | 1 031 ms | `2a06e4f8-7769-471b-88ba-ab7a91d87ad5` |

- **`201`: 5 of 10. Rows persisted: 5 of 10.** They agree, and the bubble count
  moves 48 → 53 exactly as the five rows appear.
- `503`: 5 of 10, all at 8.06–8.08 s — the message-POST deadline class, not the
  provider class (a provider `503` on this route lands at ~5.0 s with
  `Retry-After: 30`, and none did).
- Runtime-cancelled: 0.
- The failure is strictly alternating on this pin: odd submissions fail, even
  submissions succeed.
- Rows are visible after the reload described in §4.

**Verdict: FAIL.** The bar is ten consecutive successes, each with a row and a
reload-visible message; 5 of 10 succeeded.

### 5.1 A harness run that wrote rows but could not score them

An earlier run of the same driver (`ui-posts-a24ab11d9-20261110T0745Z.json`,
07:45Z) polled the network listing for the first `POST` line instead of for a
settled status. That listing prints a request line before it completes, so the
driver recorded the pending `(Fetch)` line, saw no status, and moved on. Of ten
submissions only `#3` was scored (`201`, 1 022 ms); `#1` and `#2` left their
text in the input box (`inputLenAfter: 30`) and were never confirmed. It
persisted **3** rows (`#3`, `#6`, `#9`, reload-visible on the first attempt with
48 bubbles) and is kept as an artifact for row accounting, not as a
measurement.

## 6. The Redis bound in the tail

Two redacted captures cover the whole window:
`tail-a24ab11d9-20261110T0731Z.jsonl` (167 events, 07:31–07:47Z: burst, matrix,
both UI runs) and `tail-a24ab11d9-20261110T0750Z.jsonl` (49 events, 07:50–07:53Z:
the endpoint bisect in §7). Both carry
`scriptVersion: e9aed1a4-920a-4338-a163-55dcc60446cd`, which independently
confirms the serving version.

`tools/tail-silence-report.mjs` on window 1:

```text
events=167 withRedis=136 silence>=7500ms=30 ofWhichDeadline=30
```

| Request class | Legs with ≥ 7 500 ms silence after a Redis error | Silence | Redis error offset |
| --- | --- | --- | --- |
| `GET /training/session/:id` → `302` (page deadline) | 18 | 7 993–7 999 ms | 1–134 ms |
| `GET /api/training/sessions/:id` → `503` | 2 | 7 993–7 999 ms | 2–3 ms |
| `POST /api/training/sessions/:id/messages` → `503` | 10 | 7 993–7 999 ms | 1–134 ms |

**The requested confirmation cannot be made: the 8 s silence after a Redis error
line is still present on this release.** Thirty legs show it and every one ends
in a deadline line.

The cache half of the request **is** confirmed. The Worker writes one
`Failed to track security event … Database not connected` line per completed
`validateToken`, so that line is a validation counter. Over the window's 53
requests to `/training/session/:id` the distribution was 0 validations → 44,
1 → 6, 2 → 2, 3 → 1 (`cache-validations-a24ab11d9.json`). Of the 28 successful
(`200`) page loads, **22 performed zero validations** — the middleware cache
still skips the provider on warm loads. The six that did validate are the
cold-isolate / cache-miss cases. Widening the filter to include `/training`
itself gives 71 requests with 44 zero-validation loads and 22 of 45 `200`s at
zero, the same picture.

## 7. Attribution — what the 8 s silence actually is

The Redis command bound was merged because the Redis command was the leading
suspect. It is not the cost, and this section says why with numbers rather than
re-asserting it.

This also **corrects** the §0.13 attribution, which left the stall
"unattributed within the pre-DB cache read" and suspected the unbounded
`service.get()`. That unbounded await is exactly what #6667 removed, and the
silence survived it, so the cache read is excluded as the cost. What is left is
the Postgres client path, and the tail separates it cleanly (§7.2).

### 7.1 The three named suspects

| Suspect | Evidence | Excluded? |
| --- | --- | --- |
| Middleware rate limiter awaits Redis | `apps/web/src/lib/middleware/rate-limit.ts` has no Redis import and keeps its counters in an in-memory `RateLimiter`; `rateLimitMiddleware` returns `next()` at its first branch for any URL without `/api/`, so it never runs on `/training/session/*`. On `/api/` paths it does `await getSession(request)` before the handler, but `USE_REDIS_SESSIONS` is unset on the Worker, so that is cookie/JWT work, and the API deadline legs show no session-store line. The Redis-backed `lib/middleware/enhanced-rate-limit.ts` is imported only by `lib/api/rate-limit.ts` and `pages/api/evaluation.ts`, never by `middleware.ts`. | **excluded** |
| Module-level `ensureConnected()` memo path | Bounded by `REDIS_CONNECT_DEADLINE_MS = 3 000` and cleared in `.finally()`. On a failing connect the whole cache stage costs ~90 ms in practice: successful legs log `Redis error` + `Redis connection closed` at 2–5 ms and reach `New client connected` at 94–263 ms. | **excluded as the 8 s cost** |
| A caller outside `lib/redis.ts` | There is one, and it is the stall: the Postgres client acquired in `lib/db/index.ts` (§7.2). | **this is the stall** |

### 7.2 Where the stall is

The last log line before every deadline leg is the identity cache read
(`Redis error` + `Redis connection closed`, 1–134 ms). The next statement on the
path is the slow-path transaction in `resolveIdentity`
(`apps/web/src/lib/auth/user-identity.ts`: `getCachedIdentity` at line 218, then
`transaction(...)` at line 228), which is `acquireClient()` →
`client.query('BEGIN')` → the `users` SELECT/INSERT → `COMMIT` in
`apps/web/src/lib/db/index.ts`. The `sessions` and
`training_session_messages` queries in `session-api.ts` come after it.

The tail separates the two outcomes perfectly. Classifying every session request
in both captures by whether the isolate opened a **new** Postgres connection
(`New client connected to database`, emitted on the pool's `connect` event):

| Class | Legs | With a new connection |
| --- | --- | --- |
| Session load that returned `200` | 35 | **35** |
| Leg that hit the 8 s deadline | 38 | **0** |

Not one success ran on a connection that already existed, and not one deadline
leg opened one. **A request that opens a Postgres connection succeeds in
~250–300 ms; a request that reuses a pooled one stalls for the full 8 s.** The
reuse is the discriminator, so the stall is on the reused client, not on
acquisition.

Across the 38 deadline legs:

| Marker | Deadline legs carrying it |
| --- | --- |
| `New client connected` | **0** |
| `Failed to acquire a database connection; rebuilding the pool and retrying once` | **0** |
| `Training session database unavailable` (`DatabaseUnavailableError`) | **0** |
| `Unexpected error on idle client; discarding the pool` | **0** |
| runtime-cancel exception | **0** |
| a completed validation (`Failed to track security event`) | 3 |

Read together:

- **`acquireClient()` did not fail.** Its only retry is guarded by
  `isTransientConnectionError`, and it logs the acquire warning when it fires.
  The warning never appears, and no `DatabaseUnavailableError` reaches the route,
  so no connection error was thrown.
- **The request was holding a pooled client** and its statement never answered.
- **Nothing bounds that statement.** `resolveDefaultConfig()` in
  `apps/web/src/lib/db/index.ts` sets `max: 20`,
  `idleTimeoutMillis: 30 000`, `connectionTimeoutMillis: 15 000` and SSL — and
  **no `query_timeout`**. The only `statement_timeout` in the tree is a
  per-query `SET` inside `lib/db/optimized-queries.ts`, which the session path
  does not call, so there is no server-side bound either. A `BEGIN` written to a
  socket that never answers therefore waits forever; the 8 s load deadline is
  the only thing that ends the request.
- **`acquireClient()`'s retry cannot help.** The failure is not in
  `connect()`, so `isTransientConnectionError` never matches. D3's acquisition
  self-heal is present and does its job; it does not cover a hung statement.

The pre-database path is bounded by measurement, not by assumption: the
`session-api-invalid-token` series (§7.3) completes `getSession` and its
validations in **2 319–2 447 ms** with no database access at all, and every
successful load reaches `New client connected` within 94–263 ms of its Redis
error. Nothing before the database costs more than ~2.5 s, so the remaining ~6 s
of an 8 s leg is the database call.

**Attribution:** the surviving 8 s silence is the **statement phase on a reused
pooled Postgres client** — `resolveIdentity`'s slow-path `transaction()` in
`apps/web/src/lib/auth/user-identity.ts:228`, executed by
`apps/web/src/lib/db/index.ts` (`acquireClient()` → `client.query()`). It is not
the Redis command, not the `ensureConnected()` memo, and not the middleware rate
limiter. The cache command bound of #6667 removed the one unbounded cache await
and the number did not move, which is itself the evidence that the cache was
never the cost.

**Residual, reported as unattributed:** two things the capture cannot settle.

1. *Which* database step waits. `acquireClient()` returning a client and the
   statement on it are not separately logged, so "`connect()` handed back a
   pooled client" and "`connect()` is still queued" cannot be told apart from the
   tail alone; both are inside `lib/db/index.ts`.
2. *Why* the socket never answers — a peer-side close the runtime never
   surfaces, a frozen-isolate socket, and a middlebox black-holing it are all
   consistent with the evidence.

Both are **unattributed**. Neither is an environment blocker and neither is
recorded as one. Three things would settle them, all source changes that belong
to a feature owning `lib/db/index.ts`: a client-side `query_timeout` (which turns
the hang into an error naming the stage), a `SELECT 1` probe logged before
`BEGIN` (so a dead socket fails at the first statement), and a log line on
`acquireClient()`'s success path (so a queued `connect()` is distinguishable from
a hung query).

### 7.3 The endpoint bisect

`tools/request-path-diag.mjs --mode endpoints --n 10` on the same pin, under the
second capture:

| Series | Statuses | Latency |
| --- | --- | --- |
| `health` | 10 × 200 | 11–1 913 ms (median 30 ms) |
| `session-api-invalid-token` | 10 × 401 | 2 319–2 447 ms (four validations each, ~580 ms apart) |
| `session-api-valid-token` | 6 × 200, 4 × 503 | 286–8 307 ms |
| `session-page-valid-token` | 6 × 200, 4 × 302 | 200–8 027 ms |

The JSON API route and the page route fail in the same proportion and with the
same signature, so the stall is in the shared service path, not in Astro page
rendering. The health route — which touches neither the session cache nor the
database — never exceeds 1.9 s.

The invalid-token legs are the one place the pre-database path is visible
end-to-end, and they show a second, separate cost: each `401` performs **four**
`validateToken` calls, at offsets 0 / ~580 / ~1 150 / ~1 740 ms, for ~2.3 s of
provider work on a request that touches no database. That is the
double-validation defect `validation-double-call-collapse` owns; it is recorded
here because it sets the floor under every session request, and it is **not**
attributed to the Redis bound.

## 8. Baselines and what moved

Baselines on the unchanged pre-fix pin `f811440d6` / Worker `af615b73`. The two
windows disagreed, so the comparison is against the **spread**, not a point.

| Quantity | Window A (`availability-remeasure-f811440d6-2026-11-10.md`, `54c0ec8cc`) | Window B (`results/redis-command-bounding/`) | **This pin** | Inside the spread? |
| --- | --- | --- | --- | --- |
| `VAL-HANG-001` first-attempt 200 | 1 of 20 | 4 of 20 | **3 of 20** | **yes** |
| `VAL-HANG-001` final 200 after one retry | 20 of 20 | 15 of 20 | **18 of 20** | **yes** |
| Deadline legs | 19 | 13 | **16** | **yes** |
| `VAL-L03-011` hard failures | 8 | 3 | **7** | **yes** |
| `VAL-POST-001` successes | 5 of 10 | 6 of 10 and 5 of 10 | **5 of 10** | **yes** |

**Nothing moved.** Every number falls inside the pre-fix spread. The Redis
command bound did not change the burst, the matrix, or the message-reliability
bar, and §7 explains why: the stall is in the Postgres client path on a reused
connection, not in the Redis command.

Latency and the 503 count, recorded independently as D2/D3 require:

| Quantity | This pin | Moved by #6667? |
| --- | --- | --- |
| Successful session-page load latency | 262–2 623 ms (warm ~300 ms; cold isolate ~1.8–2.6 s) | **no** — same range as the `f811440d6` baseline (231–369 ms warm, 1 583 ms cold) |
| Deadline legs in the burst | 16 of 20 | **no** — inside 13–19 |
| First-attempt `503` responses in the burst | 2 (leg 16 on the session route at 5 033 ms; leg 19 on the `/training` redirect target at 4 048 ms) | **no** |
| Final non-200 legs in the burst | 2 (1 × `503`, 1 × `/login`) | **no** — window B ended 5 of 20 non-200, window A 0 |
| Hard failures in the matrix | 7 | **no** — inside 3–8 |
| Message POST `201` | 5 of 10 | **no** — inside 5–6 |

D2 predicted that the cache migration would not move `VAL-HANG-001`; that holds
here. D3's fix (`acquireClient()` rebuilding the pool and retrying once on a
transient connection error) is already in the baseline pin and in this one; its
effect — 8–20 s loads becoming ~0.3 s warm loads — is visible on both, so it is
not attributable to #6667 either. What D3 does not cover is the hung statement
on a reused client (§7.2), which is why the deadline count sits still.

## 9. Rows this window wrote

All rows are synthetic, mission-marked, and reversible with
`tools/reverse-l03-identities.mjs`.

| Source | Org A | Org B |
| --- | --- | --- |
| Start of window (07:22:17Z) | 45 | 5 |
| Matrix own-write probes | +0 (`503`) | +1 |
| UI run 07:45Z (unscored harness run, §5.1) | +3 | 0 |
| UI run 08:00Z (VAL-POST-001) | +5 | 0 |
| **End of window (07:53:24Z)** | **53** | **6** |

Total messages in the two synthetic sessions at the end of the window: **59**
(org A 53, org B 6). Session hashes are unchanged from the start of the window.

Mission-marked row accounting from the incident: org A was at 24 before the
accidental `message-post-timing --help` run (24 → 33), and this window leaves it
at **53**. Org B is at **6**. Both counts come from
`tools/l03-row-state.mjs` (`row-state-before.json`, `row-state-after.json`).

## 10. Artifacts

| File (under `results/availability-release-and-remeasure/` unless noted) | What it holds |
| --- | --- |
| `burst-a24ab11d9-20261110T0731Z.json` | the 20-navigation burst, per-leg first and final chains |
| `l03-tenant-matrix-2026-11-10T07-39-54-893Z.json` / `.md` (in `results/`) | the 35-leg matrix and its row-integrity hashes |
| `matrix-run.log`, `matrix-verify-result.json` | driver output and the offline `--verify-result` recomputation (exit 1, OPEN) |
| `ui-posts-a24ab11d9-20261110T0800Z.json` | the scored ten-submission run, reload, and DB read-back |
| `ui-posts-a24ab11d9-20261110T0745Z.json` | the earlier unscored run that wrote 3 rows (§5.1) |
| `endpoints-a24ab11d9-20261110T0750Z.json` | the endpoint stage bisect (§7.3) |
| `cache-validations-a24ab11d9.json` | per-request `validateToken` counts behind §6, for both path filters |
| `tail-a24ab11d9-20261110T0731Z.jsonl` | redacted tail over the burst, matrix and UI windows (167 events) |
| `tail-a24ab11d9-20261110T0750Z.jsonl` | redacted tail over the endpoint bisect (49 events) |
| `tail-20261110T0731Z-silence.json`, `tail-20261110T0750Z-silence.json` | `tools/tail-silence-report.mjs` output for each capture |
| `row-state-before.json`, `row-state-after.json` | row counts and hashes at 07:22:17Z and 07:53:24Z |

## 11. Decision

**NO-GO is unchanged.** Three of the four assertions measured here still fail on
this release, and the fourth passes:

| Assertion | Requirement | Measured | Verdict |
| --- | --- | --- | --- |
| `VAL-HANG-001` | 20 of 20 first-attempt 200 | 3 first-attempt, 18 final, 16 deadline legs, 1 `/login` redirect | **FAIL** |
| `VAL-L03-011` | zero hard failures across 35 legs | 7 hard failures (7 × 503) | **FAIL (OPEN)** |
| `VAL-L04-003` | one UI message persists and is visible after reload | row `bf99e09a-…`, visible after a `200` reload | **PASS** |
| `VAL-POST-001` | ten consecutive successes with a row each | 5 of 10 `201`, 5 rows, 0 runtime-cancelled | **FAIL** |

No assertion is recorded as passed without a reproduced measurement, and no
pre-fix result is restated as taken on this pin.
