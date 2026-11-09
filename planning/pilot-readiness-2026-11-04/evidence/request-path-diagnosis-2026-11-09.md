# Request-path diagnosis — the `/login` redirect and the 8 s read-path exceedance

**Read-only diagnosis. No source file, configuration, deployment, or database
row was changed by this feature.** It gates every fix in the gap-fix phase: each
fix feature cites the finding (`D1`…`D7`) it acts on.

Measured 2026-11-09 on the pinned release recorded in §1. The two questions were
recorded but never explained in `evidence/l04-journey-release.md` §7 and §7.1;
this record answers both with numbers and resolves the two competing hypotheses
rather than restating them.

## 1. Release under test

Read live with `./node_modules/.bin/wrangler deployments status --name
pixelated-empathy` (exit 0, wrangler 4.158.0) at 2026-11-09T21:21Z and again at
2026-11-09T21:52Z. Both reads returned the same version, so every number below
is bound to it:

| Item | Value |
| --- | --- |
| Commit built and deployed | `bdee5c364ba2c54aa6759705d4fce3a4198c7d64` (`chore(submodules): bump ai to 393854547`) |
| Active Worker version | `547855bc-2669-4a44-932b-15aa3ea35983` at **100%** |
| Worker version created | 2026-11-09T13:34:31.976Z |
| Deploy run | `42626174472` — success, `headSha=bdee5c364` (`gh run view 42626174472 --json headSha,conclusion`) |
| `origin/staging` HEAD at read time | `2254e962ec89473044ab2780e51b0c5533238412` — **one commit ahead of the deployed SHA and not deployed** (foresight submodule bump) |
| Mission pin record | `library/release-pin.md` §0.0 (matches the live read) |

`apps/web` is byte-identical between `f475bcc4f` (the L03/L04 fix release) and
`bdee5c364` except ten `.bak` deletions, so the source read here is the code
that is actually deployed. Every `file:line` below was read with
`git show bdee5c364:<path>`.

The two repair constants the mission shipped are present in this bundle:

- `apps/web/src/lib/services/training/session-api.ts:29` `TRAINING_DATA_DEADLINE_MS = 8_000`
- `apps/web/src/lib/redis.ts:51` `REDIS_CONNECT_DEADLINE_MS = 3_000`
- `apps/web/src/lib/auth/user-identity.ts:74` `IDENTITY_CACHE_READ_DEADLINE_MS = 750`

## 2. Method, and its limits

No instrumentation was added to source. The measurement is external and
consists of five instruments, all run against the pin in §1:

1. **Controlled burst** — 20 sequential authenticated document navigations of
   the org A training session (`/training/session/33333333-…`), manual redirect
   handling, at most one 2 s-backed-off retry per request. The client is a Node
   `fetch` loop (`tools/request-path-diag.mjs`), **not a browser**, holding one
   in-memory `auth-token` cookie obtained from `POST /api/auth/signin` with a
   real CSRF token. First-attempt and final outcome are recorded separately.
2. **Worker-side correlation** — `./node_modules/.bin/wrangler tail
   pixelated-empathy --format json` spanning the whole measurement window
   (2026-11-09T21:23:29Z → 21:51:17Z), filtered through
   `tools/redact-tail.mjs`, which keeps `wallTime`, `cpuTime`, request path,
   header *presence* booleans, response status, `Set-Cookie` attribute names
   with values redacted, exceptions, and logs; the file is
   `<missionDir>/results/diag/tail-20261109T212317Z.jsonl` (168 events).
3. **Endpoint decomposition** — same pin, same token, same window: `/api/health`
   (no auth, no cache, no DB), `/api/training/sessions/{id}` with a tampered
   token (auth failure, no DB), with a valid token (full read path), and the
   session page document.
4. **Direct dependency probes** — `/userinfo` and the Management API from this
   host, with the same tenant and the same Management client the Worker uses
   (`tools/request-path-diag.mjs --mode auth0`), plus a DNS/TCP probe of the
   Worker's configured Redis host (`--mode redis`).
5. **Stage reproduction** — the same SDK versions the bundle pins (`auth0-legacy`
   = `auth0@4.37.1` for `UserInfoClient`, `auth0@7.5.0` for `ManagementClient`,
   `pg@8.23.1`) driven with the app's own retry shape
   (`tools/auth0-stage-timing.mjs`), so each named stage has a distribution.

**Limits, stated so no claim overreaches:**

- **The tail does not expose cookie contents.** Every event carries a `cookie`
  header (`cookie: true`) but `cookie-has-auth-token` is false on every page
  event, including requests the client provably sent with the token. Cloudflare
  redacts the value. The substitute correlation is the controlled client (one
  in-memory token, no browser, no relaunch, no cookie jar), the interleaving of
  `200`s and redirects on that same token, and the absence of any `Set-Cookie`
  on the redirect (§3.1).
- **Stage reproduction is not the Worker.** It runs from this host, so absolute
  network latency differs from Cloudflare's. It is used for *status and tail
  shape* of the dependency, and every Worker-side claim is additionally anchored
  in the tail's `wallTime` and log markers.
- **The burst is part of the load it measures.** Each authenticated page load
  makes 4 Auth0 calls (2 validations × 2 calls); the burst therefore consumes
  the tenant's rate-limit bucket as it runs. That is not an artefact to
  apologise for — it is the mechanism (§3.3, D4).
- **Tail log timestamps are not aligned to request start** (they can precede or
  follow `eventTimestamp`), so per-request cost is taken from `wallTime` and from
  *which* markers are present, not from subtracting log timestamps. The one
  exception is the span between the first and last Redis log line *within a
  single event*, which uses one clock and is reported as the in-Worker cache
  span.

## 3. Question 1 — why an authenticated load ends at `/login`

### 3.1 The discriminating observation

The burst is the discriminator, and it removes the browser-relaunch confounder
by construction: there is no browser. One `auth-token` cookie was minted once
(`POST /api/auth/signin` → 200) and sent on all 20 requests; its JWT `exp` was
decoded in memory and gave **86 400 s of remaining lifetime** at the first
request and at the last. No cookie was ever evicted by the client.

| Observation | Value | Source |
| --- | --- | --- |
| Navigations | 20 | `results/diag/burst-20261109T212357Z.json` |
| First-attempt session page rendered (`200` containing `id="message-input"`) | **6** | same |
| First-attempt ended on the login page | **12** | same |
| First-attempt ended on `/training` (`200`, no trainee UI) | 2 | same |
| Final rendered after ≤1 retry | **13** | same |
| Final still on the login page | 7 | same |
| Retries used | 14 | same |
| `Set-Cookie` on any `302` | **none** | tail: 0 of 48 `302`s carry a `set-cookie` header; client: `setCookie: []` |
| Cookie present on the redirecting requests | header present on all; value redacted by the tail | tail `request.headers.cookie: true` |
| Same token produced a rendered page immediately before/after | requests 1, 4, 11, 13, 17, 19 returned `200` between redirects | burst artifact |

The redirecting navigation and the succeeding navigation differ in nothing the
client controls: same URL, same cookie, same headers, seconds apart. The
decision is made on the server. **H1 (client-side cookie loss after a browser
relaunch) is refuted for these redirects: there was no browser and no relaunch,
the cookie was sent every time, and the server returned no `Set-Cookie` that
could have evicted it.**

This run failed harder than the two runs recorded in
`evidence/l04-journey-release.md` §7 (17/20 and 18/20 final `200`; 3 and 2
redirects). The difference is consistent with the rate-limit mechanism in §3.3
and D4: the burst ran first in this window (21:23:57Z, before every probe), so
its rate reflects the `/userinfo` bucket state left by preceding traffic, not a
different defect. The mission's "roughly one in ten" is the low end of a range
whose top end is this run's six in ten, and the bucket's state — not the
cookie — sets where in that range a run lands.

### 3.2 The branch that produced the redirect

Three `Location` shapes appear, and each maps to one code branch. None is the
middleware `/admin` redirect: `apps/web/src/middleware.ts` contains exactly one
`/login` redirect (`:243`) and it is guarded by `pathname.startsWith('/admin')`
(`:239`); no observed `Location` contains `/admin`.

#### 3.2.0 The middleware branches, enumerated and excluded

`apps/web/src/middleware.ts` can only reach a `/login` `302` through four paths.
All four are excluded for the observed URLs:

| Branch | Code | Why it did not fire |
| --- | --- | --- |
| `/admin` page guard, no session | `:239-252` | no observed `Location` contains `/admin`; the guard is unreachable for `/training*` |
| No cookie on a configured API route | `:225-231`, `routeAuthConfig` (`:72-96`) | `/api/training/sessions/*` and `/training*` match no pattern, so they take the `!routeConfig` branch (`:231`), which calls `resolveCookieSession` and then `next()` with no redirect |
| Token validation threw / caught as unauthenticated | `:232` (`resolveCookieSession`) | the same: the failure populates nothing in `locals` and the request still reaches the page, which is where the redirect is emitted |
| Role resolved to `guest` on a route that requires a role | `:257-279` (`authenticateRequest`) | that path returns `401`/the Auth0 middleware response, not a `/login` `302`; the tampered-token control returned `401`, not a redirect |

So every observed `/login` `302` is emitted by a page component, not by the
middleware.

| `Location` (observed) | Count in the 20 first attempts | Branch |
| --- | --- | --- |
| `/training?error=session-not-found` | 12 | `apps/web/src/pages/training/session/[sessionId].astro:78-80` — the data-load deadline returned non-ok, so the page redirects |
| `/login?redirect=/training` | 10 | `apps/web/src/pages/training/index.astro:19` (`getCurrentUser` null) |
| `/login?redirect=%2Ftraining%2Fsession%2F33333333-…` | 2 | `apps/web/src/pages/training/session/[sessionId].astro:49-51` — `getSession()` returned null |

So the user-visible "load ends at `/login`" is, in 10 of 12 cases, a **two-hop
chain**: the session page's data load exceeded its 8 s deadline and redirected
to `/training?error=session-not-found`, and then `/training`'s own auth check
failed and redirected to `/login?redirect=/training`. In the other 2 cases the
session page itself failed its session check.

#### 3.2.1 Instrumentation output for a redirecting navigation

**Trace A — request 5 of 20, the two-hop chain.** The client harness records
every hop with its own clock (`results/diag/burst-20261109T212357Z.json`):

```json
{
  "index": 5,
  "firstChain": [
    { "status": 302, "location": "/training?error=session-not-found", "ms": 16542, "setCookie": [] },
    { "status": 302, "location": "/login?redirect=/training", "ms": 15446, "setCookie": [] },
    { "status": 200, "location": null, "ms": 2297, "setCookie": [] }
  ],
  "firstOutcome": "login-page-200"
}
```

**Trace B — request 9 of 20, the direct branch.**

```json
{
  "index": 9,
  "firstChain": [
    { "status": 302, "location": "/login?redirect=%2Ftraining%2Fsession%2F33333333-3333-4333-8333-333333333333", "ms": 19998, "setCookie": [] },
    { "status": 200, "location": null, "ms": 3421, "setCookie": [] }
  ],
  "firstOutcome": "login-page-200"
}
```

**The Worker's own record of the `/training` hop** (trace A, second line),
redacted (`tail-20261109T212317Z.jsonl`):

```json
{
  "request": { "method": "GET", "path": "/training",
               "headers": { "cookie": true, "cookie-has-auth-token": false } },
  "response": { "status": 302, "location": null, "setCookie": [] },
  "wallTime": 13859, "cpuTime": 56, "outcome": "ok",
  "logLines": 12, "securityEventLines": 3, "deadlineLines": 0, "poolLines": 0,
  "scriptVersion": "547855bc-2669-4a44-932b-15aa3ea35983"
}
```

`cookie-has-auth-token: false` here is the tail's redaction of the cookie value,
not cookie absence (§2); `location` is redacted for the same reason, which is
why the `Location` values come from the client artifact. The load-bearing field
is `securityEventLines: 3`.

#### 3.2.2 Which branch, per event, from the marker counts

The tail's per-request security-event line count is one per `logSecurityEvent`
call, i.e. per completed `validateToken`. That count separates the branches
without needing the redacted `Location`:

| Request class (tail window) | Marker composition | n | Branch |
| --- | --- | --- | --- |
| `/training/session/{id}` `302` | `sec=1`, `deadline=1` | 16 | `[sessionId].astro:78-80` (deadline) |
| `/training/session/{id}` `302` | `sec=2`, `deadline=0` | 21 | `[sessionId].astro:49-51` (session null) when the data load was fine, or `:78-80` when it failed for a non-deadline reason; the client `Location` separates them (2 of the burst's 20 were `:49-51`, 0 were a non-deadline data-load failure) |
| `/training/session/{id}` `302` | `sec=0`, `deadline=0` | 1 | `[sessionId].astro:49-51` (no token: neither the middleware nor `getSession` validates without one) |
| `/training` `302` | `sec=3`, `deadline=0` | 10 | `training/index.astro:19` |
| `/training` `200` | `sec=3`, `deadline=0` | 3 | renders |
| `/training/session/{id}` `200` | `sec=2` (16) / `sec=1` (2) | 18 | renders |

The `/training` row is the precise attribution. `isAuthenticated`
(`apps/web/src/lib/auth/index.ts:116-121`) is `!!(await getCurrentUser(...))`,
and `getCurrentUser` validates the token (`:38-99`). A redirect at `:14` would
require `isAuthenticated` to fail, which would leave **two** completed
validations (middleware + `isAuthenticated`) and no third call. All 10 observed
`/training` redirects show **three** completed validations, so `isAuthenticated`
returned true and `getCurrentUser` — the second, redundant check of the same
token in the same request — returned null. The redirect is therefore emitted at
`training/index.astro:19`, not `:14`.

That is the sharpest form of the defect: on `/training` the same token is
validated three times in one request, and the third validation fails after the
first two succeed. The three `/training` `200`s in the same window show all
three passing when the rate-limit bucket has room, which is why the failure is
intermittent rather than constant.

The common cause is the same in all three branches:

```ts
// apps/web/src/lib/auth/session.ts:398-423  (getSession)
const cached = await lookupCachedSession(token)      // :403
if (cached) return cached.session
try {
  const result = await validateToken(token, 'access') // :408
  if (!result.valid || !result.userId) return null    // :409  ← redirect source
  ...
} catch {
  return null                                         // :418-421
}
```

`getCurrentUser` and `isAuthenticated` call `validateToken` directly and return
`null` on `valid:false`, so `training/index.astro:19` fires for the same reason
`session.ts:409` does.

### 3.3 What makes `validateToken` return `valid: false`

`validateToken` calls the Auth0 `/userinfo` endpoint on every invocation:

```ts
// apps/web/src/lib/auth/auth0-jwt-service.ts:664
const userInfo = await getAuth0UserInfo(token)   // retry(fetchUserInfo, 2, 500) at :195
```

Any throw from that call is caught and converted to an unauthenticated result,
which is what surfaces as the redirect:

```ts
// apps/web/src/lib/auth/auth0-jwt-service.ts:734-746
} catch (error: unknown) {
  logSecurityEvent(SecurityEventType.TOKEN_VALIDATION_FAILED, ...)
  return { valid: false, error: ... }
}
```

**The other candidates inside `validateToken` are excluded, not assumed.** The
skill's brief names the Management call as a plausible server-side mechanism
that could be caught and converted into "invalid token", and the role cache is
the same class of risk. Read at the pin, both are wrapped in their own
error-swallowing handlers:

| Candidate | Code at the pin | Verdict |
| --- | --- | --- |
| Issuer / audience / `sub` claim checks | `:641`, `:652-656`, `:673` | **excluded** — the identical token validated successfully on 13 of 20 requests in the same window, so no claim is wrong |
| Management API (`resolveRoleFromManagementApi` → `getUserById`) | `:680` → `:535-596`, own `try` with a bare `catch` at `:588-591` | **excluded** — a failure returns `null`, the role stays `guest`, and validation still returns `valid: true` |
| Role cache read and write | `readCachedRole` `:487-501`, `writeCachedRole` `:504-518`, each with its own `catch` and deadline | **excluded** — both swallow errors and fall through to the API |
| `/userinfo` (`getAuth0UserInfo`) | `:664` → `retry(fetchUserInfo, 2, 500)` at `:195` | **confirmed** — measured 17 of 20 `429` |

That leaves `/userinfo` as the only call in `validateToken` that can turn a
valid, unexpired token into `valid: false`.

The endpoint is rate-limited by the tenant. Direct probe, same tenant, same
token, 20 sequential calls (`--mode auth0`):

| Leg | Result |
| --- | --- |
| `GET https://dev-f3vkhvb6n52y7fre.us.auth0.com/userinfo` | **3 × `200`, 17 × `429`** |
| Latency of the `200`s (n = 3) | min 111 ms, median 115 ms, max 393 ms |
| Latency of the `429`s (n = 17) | min 74 ms, median 93 ms, max 170 ms |
| Rate-limit headers, first 3 calls | `x-ratelimit-limit: 300`, `remaining: 296 → 294` |
| Rate-limit headers, every `429` | `x-ratelimit-limit: 10`, `remaining: 0`, **`retry-after: 114`** |
| Body on the `429` | `UserInfoError: Too Many Requests` |

The effective bucket is **10 requests**, and once it is empty every call is a
`429` with a ~114 s reset. The app's own volume reaches that bucket quickly
(D4): a session page load issues 2 `/userinfo` calls, and the `/training` hop
issues 3 more, so two to three page loads exhaust a 10-request bucket.

Note the shape: a `429` normally returns in ~93 ms. The app still treats it as a
failed validation, so most `/login` redirects cost little — but see the tail
below, where the same `429` took 8 973 ms, which is the case that also blows the
8 s data deadline.

The same call also has a multi-second tail. Stage reproduction with the app's
exact retry shape (`retry(getUserInfo, 2, 500)`), n = 10:

| Sample | Result |
| --- | --- |
| 9 of 10 | `200`, 76–148 ms |
| 1 of 10 | **`429` after 8 973 ms** (`UserInfoError: Too Many Requests`) |

That is the same order as the 8 s deadline and it is the mechanism behind
Question 2 (§4.3). The `429` is not fast-failing: the request sat ~8.4 s before
the response, then the app's second attempt returned `429` after the 500 ms
backoff.

### 3.4 Verdicts

- **H1 — client-side cookie loss after a browser relaunch: REFUTED.** No browser
  was involved; one in-memory cookie was sent on all 20 requests with 86 400 s
  of remaining validity; the same token rendered 13 pages in the same burst; and
  no redirect carried a `Set-Cookie` that could clear it.
- **H2 — a server-side cause: CONFIRMED.** The server rejects a valid, unexpired
  token because `validateToken` → `getAuth0UserInfo`
  (`apps/web/src/lib/auth/auth0-jwt-service.ts:664`) receives HTTP `429` from
  the tenant's `/userinfo` endpoint, is caught at `:734-746`, and is reported as
  `valid:false`. `getSession` (`session.ts:409`) then returns `null`, and the
  page redirects at `training/index.astro:19` or
  `training/session/[sessionId].astro:49-51` (§3.2.2 fixes each branch).

## 4. Question 2 — why authenticated reads exceed the 8 s deadline

### 4.1 Per-stage timing

All numbers on the pin in §1. "Share" is of the 8 000 ms
`TRAINING_DATA_DEADLINE_MS` budget. Two notes on the call graphs, both read at
the pin: the session chain is `getSession` → `lookupCachedSession` →
`getFromCache` (`session.ts:398-423`, `:153-176`); the identity chain is
`resolveInternalUserId` → `resolveIdentity` → `getCachedIdentity` →
`getFromCache`, with a Postgres transaction on a miss and a cache write after it
(`internal-identity.ts:35-58`, `user-identity.ts:211-257`), while
`resolveRoleFromManagementApi` → `getUserById` runs *inside* `validateToken`
(`auth0-jwt-service.ts:545`, `:680`) rather than inside `resolveInternalUserId`.
Every named stage is timed below.

#### Chain A — session cache (`getSession` → `lookupCachedSession` → `getFromCache`)

| Stage | Instrument | n | min | median | max | Share of 8 s |
| --- | --- | --- | --- | --- | --- | --- |
| Whole chain, successful reads, short regime | in-Worker span between first and last Redis log line | 19 | 268 ms | **354 ms** | 895 ms | **4.4%** |
| Whole chain, successful reads, long regime | same | 12 | 4 638 ms | **9 473 ms** | 13 202 ms | **118%** (91% of the request's own `wallTime`) |
| Whole chain, legs that hit the deadline | same | 23 (7 × `503`, 16 × deadline `302`) | 0 ms | **0 ms** | 172 ms | **≤ 2.2%** |
| One `getFromCache` attempt against the dead host (`witty-buffalo-119990.upstash.io`, NXDOMAIN), per connection attempt | host DNS + TCP probe | 20 | 1 ms | 2 ms | 247 ms | 0.03% |
| In-process (L1) hit instead of a Redis read | security-event count per rendered page | 2 of 18 pages | — | — | — | 0% |

#### Chain B — identity (`resolveInternalUserId` → `resolveIdentity` → `getCachedIdentity`, and `resolveRoleFromManagementApi` → `getUserById`)

| Stage | Instrument | n | min | median | max | Share of 8 s |
| --- | --- | --- | --- | --- | --- | --- |
| `getCachedIdentity` cache read | code bound (`IDENTITY_CACHE_READ_DEADLINE_MS`, `user-identity.ts:74`, `:104`) + measured inside the Chain A span | 16 deadline legs | 0 ms | 0 ms | 146 ms | ≤ 1.8% |
| `resolveIdentity` Postgres transaction (`findInternalIdBySub`) | stage reproduction | 10 | 11 ms | 11 ms | 252 ms (239 ms cold connect) | 0.14% |
| `cacheIdentity` write | code bound (`IDENTITY_CACHE_WRITE_DEADLINE_MS = 1_000`, `:82`) | — | — | — | ≤ 1 000 ms | ≤ 12.5% |
| `resolveRoleFromManagementApi` → `getUserById` | direct probe | 20 | 34 ms | 92 ms | 272 ms; 8/20 `429` (`retry-after: 1`) | 1.2% |
| Same, with the SDK's built-in 429 retry | stage reproduction | 10 | 56 ms | 74 ms | 218 ms | 2.7% |

#### Context and whole-request

| Stage | Instrument | n | min | median | max | Share of 8 s |
| --- | --- | --- | --- | --- | --- | --- |
| Edge + Worker baseline (`/api/health`, no auth/cache/DB) | client timing | 10 | 19 ms | 56 ms | 1 552 ms | 0.7% |
| `getAuth0UserInfo` → `/userinfo` | direct probe | 20 | 74 ms | 96 ms | 393 ms; 17/20 `429` | — |
| Same, with the app's `retry(…, 2, 500)` | stage reproduction | 10 | 76 ms | 103 ms | **8 973 ms** | **112%** |
| Whole API read path, valid token | client timing | 13 × `200` | 693 ms | 8 254 ms | 23 787 ms | 103% |
| Whole API read path, deadline hit | client timing | 7 × `503` | 8 204 ms | 16 776 ms | 16 947 ms | — |
| Session page document, valid token | client timing | 5 × `200` / 15 × `302` | 669 ms | 12 828 ms (302s) | 20 794 ms | — |

Three details matter for reading these tables:

- **Chain B never runs on a deadline leg.** The loader performs no cache read or
  query before `getSession` returns (`session-api.ts:122` → `:130`), and the
  deadline legs show a single completed validation, i.e. the loader was still
  inside `getSession`. Its identity cache span is therefore 0 ms on those legs
  (Chain A's third row) and no Chain B stage can be the cost of the exceedance.
  The pool-initialization line agrees (absent on all 7 `503`s, present on 12 of
  13 successful API reads) but, being per-isolate, it is corroboration only.
- The **503 legs cluster at exactly 1× and 2× the deadline**: 8 204 and 8 219 ms
  (1× 8 s plus overhead) and 16 681, 16 776, 16 905, 16 940, 16 947 ms
  (≈8.9 s of pre-deadline token work + the 8 s deadline). That is the signature
  of a deadline firing, not of a variable cache cost.
- Every `503` carries `Retry-After: 1`, and the deadline log
  (`Training session load deadline exceeded`, `session-api.ts:191`) appears on
  all seven and on the 16 session-page `302`s of the deadline class (§3.2.2).

### 4.2 Is the unreachable Redis cache a material cost?

**Not of the 8 s exceedance — it is absent on exactly the legs that exceed. It
is, however, a material cost of latency on successful reads, and the two answers
must not be confused.**

1. **The legs that hit the deadline barely touch Redis.** In-Worker cache span on
   the 23 deadline legs (7 × `503` + 16 deadline `302`s): min 0 ms, **median
   0 ms**, max 172 ms. Five of the seven `503`s log only two Redis lines — a
   single failed attempt. Those requests die inside `validateToken` before the
   loader's cache work begins, so the cache cannot be what pushed them over.
2. **On successful reads the cost is bimodal, and the upper mode is large.**
   Of 31 read-path `200`s, 19 paid 268–895 ms of cache span (median **354 ms**,
   4.4% of the budget) and **12 paid 4 638–13 202 ms (median 9 473 ms), which is
   a median 91% of those requests' own `wallTime`**. When the ioredis client is
   in its reconnect loop, each cache operation blocks until its deadline and the
   request pays seconds; when it is not, the same operations cost ~0.3 s.
3. **A path with zero Redis cost is still slow.** The tampered-token control
   (`/api/training/sessions/{id}` with a cryptographically invalid cookie)
   returned `401` in **1 766–1 862 ms (median 1 808 ms, n = 10) with
   `redis = 0` log lines** — no cache activity at all. That 1.8 s is pure Auth0
   retry cost: two failed `validateToken` calls, each two `/userinfo` attempts
   plus a 500 ms backoff.

So: a fix that only moves the session cache to KV will not move the deadline
number (0–2.2% of the budget on the legs that fire it), but the dead host is a
real multi-second cost on 12 of 31 successful reads and remains a latent budget
risk — the observed 13 202 ms span exceeds the entire 8 s deadline on its own.
The measured cost of the exceedance is in §4.3.

### 4.3 What the cost is

The cost is the **Auth0 call chain inside `validateToken`**, specifically the
`/userinfo` call, and the deadline is hit inside the *second* validation of the
same request. Evidence:

- **The deadline fired inside the auth stage, not the query.** All 7 `503`s carry
  the deadline log (`Training session load deadline exceeded`,
  `session-api.ts:191`), and the loader's own validation had not completed (next
  bullet). The loader does its cache and database work only after `getSession`
  returns (`session-api.ts:122` → `:130`), so the pending await was the
  validation. The pool-initialization line is **corroboration only**: it is a
  per-isolate event, so its absence on a request proves nothing by itself (it is
  present on 12 of 13 successful API reads and 16 of 18 rendered pages and
  absent on all 7 `503`s — consistent, but not load-bearing).
- **The loader's own validation had not completed.** The tail's per-request
  security-event line count (`Failed to track security event`, one per
  `logSecurityEvent` call) is **1 on all 7 `503`s** but **2 on 16 of 18 rendered
  session pages** (1 on the other two, when the in-process cache absorbed the
  page's own `getSession`) and **3 on all 3 `/training` renders**. One completed
  validation on a deadline leg is the middleware's; the loader's
  `getSession` → `validateToken` (`session-api.ts:122`) was still pending. That
  await sits inside `loadTrainingSession`, which is the work the deadline wraps
  (`session-api.ts:185-188`).
- Inside `validateToken` the only network calls are `getAuth0UserInfo`
  (`:664`) and, when the role resolves to `guest`,
  `resolveRoleFromManagementApi` → `getUserById` (`:680`, `:545`). The role is
  always `guest` for a password-grant access token (the grant carries no
  `app_metadata` claim, per the function's own comment at `:520-534`), so both
  are on the path. Only the first can invalidate the token; the second can only
  add latency, because its failure is swallowed (§3.3).
- The measured tail of `/userinfo` with the app's retry is **8 973 ms**, which
  alone exceeds the 8 s budget; the Management call measured 56–218 ms in the
  same window and is bounded by the SDK's own 3-retry policy
  (`auth0@7.5.0/lib/retry.js`: 3 retries, 500 ms base, exponential, capped at
  10 s), so it is the secondary contributor, not the primary one.
- The Postgres stage is not the cost in this window: connect + `SELECT` measured
  11 ms median, 252 ms max (n = 10), and no deadline leg shows any pool activity
  at all.

So the named cost is: **`getAuth0UserInfo` (`auth0-jwt-service.ts:664`) with
`retry(…, 2, 500)` (`:195`), called twice per authenticated request, against a
tenant `/userinfo` bucket of 10 requests whose exhausted state returns `429`
after up to ~8.4 s.** The 8 s deadline cuts that stall off and converts it into
the bounded `503`; it does not remove the stall.

### 4.4 Why the requests do 2–6 Auth0 calls each

| Route | `validateToken` calls per load | Auth0 calls per load | Evidence |
| --- | --- | --- | --- |
| `/api/training/sessions/{id}` | 2 (middleware + loader, `session-api.ts:122`) | 4 (`/userinfo` ×2, Management ×2) | 2 security-event lines on 7 of 13 `200`s, 3 on 5, 1 on 1 (the extra line is not identified, §6); 1 on all 7 `503`s |
| `/training/session/{id}` | 2 (middleware + page `getSession`); the loader's third `getSession` is an in-process cache hit | 4 | 2 security-event lines on 16 of 18 page `200`s, 1 on the other 2 |
| `/training` | **3** (middleware + `isAuthenticated` + `getCurrentUser`) | **6** | 3 security-event lines on **3 of 3** `/training` `200`s; `training/index.astro:12-20` |

The role cache that would absorb the Management lookups is on the dead Redis
host: `readCachedRole` (`auth0-jwt-service.ts:487-501`) calls `getFromCache`
against the same NXDOMAIN host, misses every time, and falls through to the
Management API on every validation. So the cache's unreachability buys two
costs, neither of which is the deadline leg: a Management call on every
validation (which drives the request count that exhausts the `/userinfo`
bucket), and the multi-second cache spans on a third of successful reads
(§4.2).

## 5. Findings

Each is citable by id. Every number is from the pin in §1.

- **D1 — The `/login` redirect is server-side and is produced by
  `validateToken` returning `valid:false` on an Auth0 `429`.**
  `getAuth0UserInfo` (`apps/web/src/lib/auth/auth0-jwt-service.ts:664`) receives
  `429` from `/userinfo` (17 of 20 direct calls; `x-ratelimit-limit: 10`,
  `retry-after: 114`), the throw is caught at `:734-746`, and the redirect is
  emitted at `apps/web/src/pages/training/index.astro:19` (10 of 12 observed,
  all with three completed validations) or
  `apps/web/src/pages/training/session/[sessionId].astro:49-51` (2 of 12, two
  completed validations). H1 refuted, H2 confirmed. *Acts on: the redirect fix
  must make token validation tolerate a `/userinfo` `429` (or stop making the
  call per request) — not touch cookies.*
- **D2 — The dead Redis cache is not the cost of the deadline legs, but it is a
  material cost of latency.** On the 23 legs that hit the deadline the in-Worker
  cache span is 0 ms median and 172 ms max, and 5 of the 7 `503`s log a single
  failed attempt — the loader never reaches its cache work because it dies in
  the Auth0 call first. On successful read-path requests the cost is bimodal:
  19 of 31 paid 268–895 ms (median 354), 12 of 31 paid 4 638–13 202 ms (median
  9 473 ms, a median 91% of their own `wallTime`). So a KV migration of the
  session cache alone will not move the `503` count or `VAL-HANG-001`, while the
  dead host remains a real multi-second cost on successful reads and a latent
  budget risk. *Acts on: both fixes are needed, but neither is the other.*
- **D3 — The 8 s exceedance happens inside the second `validateToken` of the
  request, in the Auth0 `/userinfo` call.** All 7 `503`s carry the deadline log,
  and each logs one security event (one completed validation) versus two on a
  rendered session page, so the loader's `getSession` was the pending await;
  `/userinfo` with the app's retry measured 8 973 ms (n = 10, median 103 ms),
  the only call in `validateToken` that can fail this way (D1's exclusion table).
  The 503s cluster at 8 204–8 219 ms and 16 681–16 947 ms, i.e. 1× and 2× the
  deadline. *Acts on: bound or remove the per-request `/userinfo` call inside the
  data load; the deadline already bounds the symptom.*
- **D4 — The request path makes 4–6 Auth0 calls per page load against a
  10-request bucket.** Session page 2 validations × (1 `/userinfo` + 1
  Management); `/training` 3 validations × 2 (3 of 3 `/training` renders logged
  three completed validations); the role cache that would absorb the Management
  calls is on the dead Redis host (`auth0-jwt-service.ts:487-501`). Two to three
  page loads exhaust the bucket, so the system rate-limits itself. *Acts on:
  cache the role somewhere reachable and/or validate once per request; this is
  the amplifier behind D1 and D3.*
- **D5 — The `302` does not evict the session.** No observed redirect carries a
  `Set-Cookie` (0 of 48 `302`s in the tail window; `setCookie: []` in the
  client), so the redirect is not a cookie-clearing mechanism and a retry on the
  same cookie can succeed — which is exactly what happened 13 of 20 times.
  *Acts on: do not "fix" the redirect by re-issuing or clearing cookies.*
- **D6 — The deadline `302` and the `/login` `302` are distinct defects that
  compound.** 12 of 20 first attempts hit the 8 s deadline and redirected to
  `/training?error=session-not-found`; 10 of those then had the third of
  `/training`'s three validations fail (D7) and landed on `/login`. A fix for the
  redirect alone would leave the deadline redirect (and the misleading "session
  not found" surface) in place, and a fix for the deadline alone would leave the
  `/login` hop. *Acts on: the availability fix and the redirect fix must both
  land before the burst can reach 20/20.*
- **D7 — `/training` validates the same token three times per load, and the
  third call fails after the first two succeed.** All 10 observed `/training`
  redirects logged three completed validations and no deadline; the 3 renders in
  the same window logged three as well. `training/index.astro:12-20` calls
  `isAuthenticated(request)` and then `getCurrentUser(request)`, each of which
  runs its own `validateToken` (`auth/index.ts:116-121`, `:38-99`), on top of the
  middleware's. The page's own first two calls consume the `/userinfo` budget
  that its third call then needs, so a page that is one validation away from
  rendering sends the user to `/login`. *Acts on: the cheapest single fix in this
  report — one validation per request on `/training`.*

## 6. What remains unproven

- **The split between the `/userinfo` stall and the Management retry on the
  8.2 s legs.** The one-completed-validation marker proves the loader's
  validation did not finish, and `/userinfo` has the demonstrated 8 973 ms tail,
  but without in-source instrumentation the two calls inside that validation
  cannot be separated on a single leg. The bound is: `/userinfo` is the only
  measured call that can exceed 8 s; Management is bounded to a few seconds by
  the SDK's retry policy.
- **Why `/userinfo` took ~8.4 s to return a `429`.** The measurement shows the
  duration and the status; it does not show whether Auth0 queued the request or
  the connection stalled. Either way the app treats it as a failed validation.
- **Whether the 10-request bucket is per tenant, per client, or per source.**
  The headers show `x-ratelimit-limit: 10`; the scope is not exposed.
- **Why the cache span is bimodal.** 12 of 31 successful reads show a 4 638–13
  202 ms span and 19 show 268–895 ms, with the same 12 Redis lines in both
  regimes. The tail shows the distribution and that the long regime is absent on
  every deadline leg, but not whether it is a reconnect loop reaching
  per-operation deadlines or queued commands on a half-open client. The
  per-attempt figure is inferred from the host probe (2 ms) plus ioredis
  teardown, not measured in isolation.
- **The isolate topology.** The L1 token cache is per isolate, which is why the
  same cookie alternates between fast `200`s (cache hit) and slow failures
  (cache miss). The distribution is measured; the assignment is not.
- **The marker count is a proxy, and its own logging path is failing.** Every
  counted line is a `Failed to track security event` line, i.e. the security
  event itself did not reach its sink; the count of those lines is the count of
  `logSecurityEvent` calls, which is one per `validateToken` on this path. If a
  call site logged twice or a line were dropped, a branch attribution would
  shift by one. The three-way split in §3.2.2 is consistent across 48 redirects
  and 21 renders, which is why it is reported as an attribution rather than a
  guess.
- **The extra security-event line on 5 of 13 API reads.** The route performs two
  validations by code (middleware + `session-api.ts:122`) but logs three lines on
  5 of 13 `200`s. Some second emitter exists on that path and was not identified;
  it does not affect the `/training` attribution, where the code has three
  validations and the tail shows exactly three lines on 3 of 3.

## 7. Reproduction

```bash
cd /home/vivi/pixelated
./node_modules/.bin/wrangler deployments status --name pixelated-empathy

# 20 authenticated navigations, manual redirects, one retry each
node <missionDir>/tools/request-path-diag.mjs --mode burst --n 20 \
  --worker 547855bc-2669-4a44-932b-15aa3ea35983 \
  --commit bdee5c364ba2c54aa6759705d4fce3a4198c7d64 \
  --out <missionDir>/results/diag/burst-<iso>.json

# endpoint decomposition
node <missionDir>/tools/request-path-diag.mjs --mode endpoints --n 20 …

# direct Auth0 dependency probe (tenant + Management client the Worker uses)
node <missionDir>/tools/request-path-diag.mjs --mode auth0 --n 20 …

# dead Redis host DNS/TCP cost
node <missionDir>/tools/request-path-diag.mjs --mode redis --n 20 …

# per-stage reproduction with the bundle's SDKs
node <missionDir>/tools/auth0-stage-timing.mjs --n 10 …

# Worker-side correlation, redacted, across the whole window
./node_modules/.bin/wrangler tail pixelated-empathy --format json \
  | node <missionDir>/tools/redact-tail.mjs \
  > <missionDir>/results/diag/tail-<iso>.jsonl
```

Artifacts (all under `<missionDir>/results/diag/`): `burst-20261109T212357Z.json`,
`auth0-20261109T213718Z.json`, `redis-20261109T213747Z.json`,
`endpoints-20261109T213757Z.json`, `stages-20261109T215028Z.json`,
`controls-20261109T215112Z.json`, `tail-20261109T212317Z.jsonl`,
`api-events.txt`.

No row was written by any of these commands: every probe is a `GET`, the only
`POST` is the sign-in that mints the cookie, the stage reproduction runs
`SELECT 1` and reads Auth0, and the read-only row-state snapshot after the whole
window (`node <missionDir>/tools/l03-row-state.mjs`, 2026-11-09T21:54:38Z)
returns org A's session hash `16c99c27c729d95ce741ded2e8596d91`, messages hash
`8f875826a017bb5d870a3627a25236e5`, and 8 messages — byte-identical to the
values recorded in `evidence/l03-tenant-boundary-release.md:239,252-253`.
