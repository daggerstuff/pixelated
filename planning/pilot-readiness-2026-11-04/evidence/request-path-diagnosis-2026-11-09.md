# Request-path diagnosis — the `/login` redirect and the 8 s read-path exceedance

**Read-only diagnosis. No source file, configuration, deployment, or database
row was changed by this feature.** It gates every fix in the gap-fix phase: each
fix feature cites the finding (`D1`…`D7`) it acts on, and §5.8 states which
finding authorises which fix.

Measured 2026-11-09 on the pinned release recorded in §1. The two questions were
recorded but never explained in `evidence/l04-journey-release.md` §7 and §7.1;
this record answers both with numbers and resolves the two competing hypotheses
rather than restating them.

## Amendment record — 2026-11-09, `diagnosis-attribution-correction`

The first revision of this report (commit `155234500`) attributed the 8 s
exceedance to the loader's second `validateToken`, and read the per-request
security-event count as proof that the loader's validation was pending. That
attribution is wrong for the legs it was applied to, and the instrument it
rested on cannot carry it. This revision corrects it, and changes nothing else
that still holds:

| Finding                | First revision                                                                                  | This revision                                                                                                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1**                 | `/login` is server-side; `validateToken` returns `valid:false` on a `/userinfo` `429`           | **unchanged** — VAL-DIAG-001 stands. Only the `retry-after` figure is corrected (114 → 113 → 112)                                                                                                                                                                            |
| **D2**                 | the dead Redis host is a material latency cost, 4 638–13 202 ms "cache span", 91% of `wallTime` | **narrowed** — that figure is an artefact of measuring across the `/userinfo` call. The measured cache cost is ~10 ms typical, ~1.5 s worst case, per request (§4.2)                                                                                                         |
| **D3**                 | the exceedance is inside the loader's second `validateToken` (`/userinfo`)                      | **rewritten and narrowed** — it covers the 22 distinct session-page document deadline legs only (23 raw, one cross-window duplicate), and names the Postgres client acquisition in `resolveIdentity` as the stall (§4.3). The API-read `503`s are no longer attributed by it |
| **D4**                 | 4–6 Auth0 calls per page load                                                                   | **narrowed** — 5–7, because `resolveCookieSession` also calls `getUserById` (§4.4)                                                                                                                                                                                           |
| **D5**, **D6**, **D7** | —                                                                                               | **unchanged**                                                                                                                                                                                                                                                                |

Three further corrections, all found while re-measuring:

- The per-isolate `Database pool initialized` line is **dropped as evidence**. It
  cannot support a per-request claim, and the first revision cited it while
  calling it not load-bearing. It is replaced by the pool's per-connection
  `New client connected` line (§4.1.3).
- The committed 169-event prefix of the first window holds **16** page-deadline
  legs. An earlier revision of this paragraph claimed "17, not 16"; that was
  inverted. 17 is the count in the full 170-event capture, and its 170th event is
  byte-identical to window 2's last event, so the sample is **22 distinct
  page-deadline legs and 38 distinct deadline legs, not 23 and 39** (§2,
  §3.2.2, §4.1.3). Deduplicate by `eventTimestamp` + `wallTime` + log count.
- §2's tail event count was **169 distinct, not 168**; the retained capture holds
  170 events because its 170th duplicates window 2's last event (§2).

Re-measurement ran on the same release (§1), in a second window
(`tail-20261109T2235Z.jsonl`, 62 events, plus
`endpoints-20261109T2236Z.json`), and the first window's artifacts are retained
and re-used. Every count below states its window.

## Amendment record — 2026-11-10, `round-2-corrections`

Scrutiny round 2 and the user-testing round re-read this report against the
retained artifacts. Six corrections follow. None changes the attribution, the
named cost, or which finding authorises which fix, and none needed a
re-measurement — each was recomputed from the artifacts already cited.

| #   | Correction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Where              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| a   | **Sample sizes.** Window 1's 170th tail event is byte-identical to window 2's last event, so the sample is **22 distinct page-deadline legs** (23 raw: 16 in the committed 169-event prefix, the duplicate, and 6 in window 2) and **38 distinct deadline legs** (39 raw: 22 + 16 API `503`s). The "17, not 16" claim is reverted — it is inverted. Deduplicate by `eventTimestamp` + `wallTime` + log count.                                                                                                 | §2, §3.2.2, §4.1.3 |
| b   | **Two API-`503` ranges.** The cache-attempt offset is **1–91 ms** (recorded 1–63 ms) and the silence to the deadline log is **7 983–7 999 ms** (recorded 7 983–8 157 ms).                                                                                                                                                                                                                                                                                                                                     | §4.1.3, §4.3, §6   |
| c   | **The 481 Redis error/close pairs span both windows** (338 + 143), not "the first window".                                                                                                                                                                                                                                                                                                                                                                                                                    | §4.2               |
| d   | **§7 cited a first-window row-state snapshot that does not exist.** Only `row-state-20261109T2252Z.json` (observed 22:55:13Z) is present; the 21:54:38Z reading has no retained artifact and is marked as such.                                                                                                                                                                                                                                                                                               | §7                 |
| e   | **The tampered-token control wording** "returned `401`, not a redirect" is true only of the API leg (`session-api-invalid-token` → `401`). The page route returns `302` to `/login` (`controls-20261109T215112Z.json`, `tampered-token` → `302` → `/login` `200`). Four citations were re-read against `bdee5c364` and corrected: `routeAuthConfig` `:72-96` → `:72-95`, the `/login` redirect `:243` → `:243-245`, `authenticateRequest` `:257-279` → `:261-281`, `writeCachedRole` `:504-518` → `:503-517`. | §3.2, §3.2.0, §4.4 |
| f   | **The `db/index.ts` grant is superseded.** §5.8 and D3 said that file is outside every granted area. The owner extended the grant on 2026-11-09 and `AGENTS.md` records it with a precedence rule; the report now cites the grant as it stands.                                                                                                                                                                                                                                                               | D3, §5.8           |

The withdrawn 4 638–13 202 ms "cache span" figure is **not** restated anywhere in
this revision; §4.2 keeps it only as a named withdrawal.

## 1. Release under test

Read live with `./node_modules/.bin/wrangler deployments status --name
pixelated-empathy` (exit 0, wrangler 4.158.0) at 2026-11-09T21:21Z, again at
2026-11-09T21:52Z, again at **2026-11-09T22:32Z** before this revision's
re-measurement, and once more at **2026-11-09T22:57Z** after it. All four reads
returned the same version, so every number below is bound to it:

| Item                               | Value                                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Commit built and deployed          | `bdee5c364ba2c54aa6759705d4fce3a4198c7d64` (`chore(submodules): bump ai to 393854547`)                                            |
| Active Worker version              | `547855bc-2669-4a44-932b-15aa3ea35983` at **100%**                                                                                |
| Worker version created             | 2026-11-09T13:34:31.976Z                                                                                                          |
| Deploy run                         | `42626174472` — success, `headSha=bdee5c364` (`gh run view 42626174472 --json headSha,conclusion`)                                |
| `origin/staging` HEAD at read time | `2254e962ec89473044ab2780e51b0c5533238412` — **one commit ahead of the deployed SHA and not deployed** (foresight submodule bump) |
| Mission pin record                 | `library/release-pin.md` §0.0 (matches the live read)                                                                             |

`apps/web` is byte-identical between `f475bcc4f` (the L03/L04 fix release) and
`bdee5c364` except ten `.bak` deletions, so the source read here is the code
that is actually deployed. Every `file:line` below was read with
`git show bdee5c364:<path>`.

The **three** repair constants the mission shipped are present in this bundle:

- `apps/web/src/lib/services/training/session-api.ts:29` `TRAINING_DATA_DEADLINE_MS = 8_000`
- `apps/web/src/lib/redis.ts:51` `REDIS_CONNECT_DEADLINE_MS = 3_000`
- `apps/web/src/lib/auth/user-identity.ts:74` `IDENTITY_CACHE_READ_DEADLINE_MS = 750`

(A fourth, `IDENTITY_CACHE_WRITE_DEADLINE_MS = 1_000` at
`user-identity.ts:82`, bounds the cache write after the transaction.)

## 2. Method, and its limits

No instrumentation was added to source. The measurement is external and
consists of six instruments, all run against the pin in §1:

1. **Controlled burst** — 20 sequential authenticated document navigations of
   the org A training session (`/training/session/33333333-…`), manual redirect
   handling, at most one 2 s-backed-off retry per request. The client is a Node
   `fetch` loop (`tools/request-path-diag.mjs`), **not a browser**, holding one
   in-memory `auth-token` cookie obtained from `POST /api/auth/signin` with a
   real CSRF token. First-attempt and final outcome are recorded separately.
2. **Worker-side correlation** — `./node_modules/.bin/wrangler tail
   pixelated-empathy --format json` spanning the measurement window, filtered
   through `tools/redact-tail.mjs`, which keeps `wallTime`, `cpuTime`, request
   path, header _presence_ booleans, response status, `Set-Cookie` attribute
   names with values redacted, exceptions, and logs. Two windows:
   `tail-20261109T212317Z.jsonl` (**170 events retained, 169 distinct**,
   2026-11-09T21:23:29Z → 21:51:17Z; the 170th event — `eventTimestamp`
   1794264057111, `wallTime` 12 320 ms, 8 log lines — is byte-identical to window
   2's last event and is counted once) and `tail-20261109T2235Z.jsonl` (62
   events, from 22:35Z).
3. **Endpoint decomposition** — same pin, same token: `/api/health` (no auth, no
   cache, no DB), `/api/training/sessions/{id}` with a tampered token (auth
   failure, no DB), with a valid token (full read path), and the session page
   document. Run in both windows (`endpoints-20261109T213757Z.json`,
   `endpoints-20261109T2236Z.json`).
4. **Direct dependency probes** — `/userinfo` and the Management API from this
   host, with the same tenant and the same Management client the Worker uses
   (`--mode auth0`), plus a DNS/TCP probe of the Worker's configured Redis host
   (`--mode redis`).
5. **Stage reproduction** — the same SDK versions the bundle pins (`auth0-legacy`
   = `auth0@4.37.1` for `UserInfoClient`, `auth0@7.5.0` for `ManagementClient`,
   `pg@8.23.1`) driven with the app's own retry shape
   (`tools/auth0-stage-timing.mjs`), so each named stage has a distribution.
6. **Per-request marker offsets** — for one event, each log line's `timestamp`
   is an epoch-ms number, so _offsets within a single event_ are one clock even
   though the base is not the request start. This instrument places every marker
   relative to `eventTimestamp` and to the other markers of the same request, and
   is what the corrected attribution in §4 rests on. Only the _order and spacing_
   of markers inside one event is used; no offset is compared across events, and
   no offset is read as an absolute duration.

**Limits, stated so no claim overreaches:**

- **The tail does not expose cookie contents.** Every event carries a `cookie`
  header (`cookie: true`) but `cookie-has-auth-token` is false on every page
  event, including requests the client provably sent with the token. Cloudflare
  redacts the value. The substitute correlation is the controlled client (one
  in-memory token, no browser, no relaunch, no cookie jar), the interleaving of
  `200`s and redirects on that same token, and the absence of any `Set-Cookie`
  on the redirect (§3.1).
- **Stage reproduction is not the Worker.** It runs from this host, so absolute
  network latency differs from Cloudflare's. It is used for _status and tail
  shape_ of the dependency, and every Worker-side claim is additionally anchored
  in the tail's `wallTime` and log markers.
- **The burst is part of the load it measures.** Each authenticated page load
  makes 3–5 Auth0 calls (§4.4); the burst therefore consumes the tenant's
  rate-limit bucket as it runs. That is not an artefact to apologise for — it is
  the mechanism (§3.3, D4).
- **Tail log timestamps are not aligned to request start.** An offset can
  exceed `wallTime`, so per-request _cost_ is taken from `wallTime` and from
  which markers are present, never from an offset read as a duration. Offsets
  are used only for _relative spacing inside one event_ (§2 instrument 6). The
  first revision additionally used the span between the first and last Redis
  line of an event as an "in-Worker cache span"; §4.2 shows why that metric
  measures the `/userinfo` call rather than the cache, and it is withdrawn.
- **The log markers are per-connection or per-isolate, not per-request.** A
  marker's presence is evidence; its absence is evidence only where the code
  guarantees it would fire on that path. `New client connected` is per
  connection (`apps/web/src/lib/db/index.ts:147-152`) and is used as such;
  `Database pool initialized` (`:154-156`) is per isolate and is **not used as
  per-request evidence anywhere in this report**.
- **Marker counts are a proxy for completed work, not for pending work.** See
  §4.1.3 — this is the instrument error that produced the first revision's D3.

## 3. Question 1 — why an authenticated load ends at `/login`

### 3.1 The discriminating observation

The burst is the discriminator, and it removes the browser-relaunch confounder
by construction: there is no browser. One `auth-token` cookie was minted once
(`POST /api/auth/signin` → 200) and sent on all 20 requests; its JWT `exp` was
decoded in memory and gave **86 400 s of remaining lifetime** at the first
request and at the last. No cookie was ever evicted by the client.

| Observation                                                                 | Value                                                          | Source                                                                    |
| --------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Navigations                                                                 | 20                                                             | `results/diag/burst-20261109T212357Z.json`                                |
| First-attempt session page rendered (`200` containing `id="message-input"`) | **6**                                                          | same                                                                      |
| First-attempt ended on the login page                                       | **12**                                                         | same                                                                      |
| First-attempt ended on `/training` (`200`, no trainee UI)                   | 2                                                              | same                                                                      |
| Final rendered after ≤1 retry                                               | **13**                                                         | same                                                                      |
| Final still on the login page                                               | 7                                                              | same                                                                      |
| Retries used                                                                | 14                                                             | same                                                                      |
| `Set-Cookie` on any `302`                                                   | **none**                                                       | tail: 0 of 48 `302`s carry a `set-cookie` header; client: `setCookie: []` |
| Cookie present on the redirecting requests                                  | header present on all; value redacted by the tail              | tail `request.headers.cookie: true`                                       |
| Same token produced a rendered page immediately before/after                | requests 1, 4, 11, 13, 17, 19 returned `200` between redirects | burst artifact                                                            |

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
`/login` redirect (`:243-245`, the `redirectPath` construction and the
`context.redirect` return) and it is guarded by `pathname.startsWith('/admin')`
(`:239`); no observed `Location` contains `/admin`.

#### 3.2.0 The middleware branches, enumerated and excluded

`apps/web/src/middleware.ts` can only reach a `/login` `302` through four paths.
All four are excluded for the observed URLs:

| Branch                                                   | Code                                     | Why it did not fire                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/admin` page guard, no session                          | `:239-252`                               | no observed `Location` contains `/admin`; the guard is unreachable for `/training*`                                                                                                                                                                                                                                |
| No cookie on a configured API route                      | `:225-231`, `routeAuthConfig` (`:72-95`) | `/api/training/sessions/*` and `/training*` match no pattern, so they take the `!routeConfig` branch (`:231`), which calls `resolveCookieSession` and then `next()` with no redirect                                                                                                                               |
| Token validation threw / caught as unauthenticated       | `:232` (`resolveCookieSession`)          | the same: the failure populates nothing in `locals` and the request still reaches the page, which is where the redirect is emitted                                                                                                                                                                                 |
| Role resolved to `guest` on a route that requires a role | `:261-281` (`authenticateRequest`)       | that path returns `401`/the Auth0 middleware response, not a `/login` `302`. The tampered-token control returned `401` on the **API** leg (`session-api-invalid-token`); on the **page** leg the same control returned `302` to `/login`, which is the page's own `getSession` branch (§3.2.1), not the middleware |

So every observed `/login` `302` is emitted by a page component, not by the
middleware.

| `Location` (observed)                                | Count in the 20 first attempts | Branch                                                                                                                        |
| ---------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `/training?error=session-not-found`                  | 12                             | `apps/web/src/pages/training/session/[sessionId].astro:78-80` — the data-load deadline returned non-ok, so the page redirects |
| `/login?redirect=/training`                          | 10                             | `apps/web/src/pages/training/index.astro:19` (`getCurrentUser` null)                                                          |
| `/login?redirect=%2Ftraining%2Fsession%2F33333333-…` | 2                              | `apps/web/src/pages/training/session/[sessionId].astro:49-51` — `getSession()` returned null                                  |

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
    {
      "status": 302,
      "location": "/training?error=session-not-found",
      "ms": 16542,
      "setCookie": []
    },
    {
      "status": 302,
      "location": "/login?redirect=/training",
      "ms": 15446,
      "setCookie": []
    },
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
    {
      "status": 302,
      "location": "/login?redirect=%2Ftraining%2Fsession%2F33333333-3333-4333-8333-333333333333",
      "ms": 19998,
      "setCookie": []
    },
    { "status": 200, "location": null, "ms": 3421, "setCookie": [] }
  ],
  "firstOutcome": "login-page-200"
}
```

**The Worker's own record of the `/training` hop** (trace A, second line),
redacted (`tail-20261109T212317Z.jsonl`):

```json
{
  "request": {
    "method": "GET",
    "path": "/training",
    "headers": { "cookie": true, "cookie-has-auth-token": false }
  },
  "response": { "status": 302, "location": null, "setCookie": [] },
  "wallTime": 13859,
  "cpuTime": 56,
  "outcome": "ok",
  "logLines": 12,
  "securityEventLines": 3,
  "deadlineLines": 0,
  "poolLines": 0,
  "scriptVersion": "547855bc-2669-4a44-932b-15aa3ea35983"
}
```

`cookie-has-auth-token: false` here is the tail's redaction of the cookie value,
not cookie absence (§2); `location` is redacted for the same reason, which is
why the `Location` values come from the client artifact. The load-bearing field
is `securityEventLines: 3`.

#### 3.2.2 Which branch, per event, from the marker counts

The tail's per-request security-event line count is one per `logSecurityEvent`
call, i.e. per **completed** `validateToken` (success at
`auth0-jwt-service.ts:689`, failure at `:736`). Read as a count of completed
validations it separates the branches without needing the redacted `Location`;
read as a _location_ it does not (§4.1.3).

| Request class (tail window)    | Marker composition         | n                                                                                                      | Branch                                                                                                                                                                                                                                        |
| ------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/training/session/{id}` `302` | `sec=1`, `deadline=1`      | **16** in the committed 169-event prefix (a 17th sits beyond it and is the cross-window duplicate; §2) | `[sessionId].astro:78-80` (deadline)                                                                                                                                                                                                          |
| `/training/session/{id}` `302` | `sec=2`, `deadline=0`      | 21                                                                                                     | `[sessionId].astro:49-51` (session null) when the data load was fine, or `:78-80` when it failed for a non-deadline reason; the client `Location` separates them (2 of the burst's 20 were `:49-51`, 0 were a non-deadline data-load failure) |
| `/training/session/{id}` `302` | `sec=0`, `deadline=0`      | 1                                                                                                      | `[sessionId].astro:49-51` (no token: neither the middleware nor `getSession` validates without one)                                                                                                                                           |
| `/training` `302`              | `sec=3`, `deadline=0`      | 10                                                                                                     | `training/index.astro:19`                                                                                                                                                                                                                     |
| `/training` `200`              | `sec=3`, `deadline=0`      | 3                                                                                                      | renders                                                                                                                                                                                                                                       |
| `/training/session/{id}` `200` | `sec=2` (16) / `sec=1` (2) | 18                                                                                                     | renders                                                                                                                                                                                                                                       |

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
const userInfo = await getAuth0UserInfo(token) // retry(fetchUserInfo, 2, 500) at :195
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

| Candidate                                                       | Code at the pin                                                                                   | Verdict                                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Issuer / audience / `sub` claim checks                          | `:641`, `:652-656`, `:673`                                                                        | **excluded** — the identical token validated successfully on 13 of 20 requests in the same window, so no claim is wrong |
| Management API (`resolveRoleFromManagementApi` → `getUserById`) | `:680` → `:535-596`, own `try` with a bare `catch` at `:588-591`                                  | **excluded** — a failure returns `null`, the role stays `guest`, and validation still returns `valid: true`             |
| Role cache read and write                                       | `readCachedRole` `:487-501`, `writeCachedRole` `:503-517`, each with its own `catch` and deadline | **excluded** — both swallow errors and fall through to the API                                                          |
| `/userinfo` (`getAuth0UserInfo`)                                | `:664` → `retry(fetchUserInfo, 2, 500)` at `:195`                                                 | **confirmed** — measured 17 of 20 `429`                                                                                 |

That leaves `/userinfo` as the only call in `validateToken` that can turn a
valid, unexpired token into `valid: false`.

The endpoint is rate-limited by the tenant. Direct probe, same tenant, same
token, 20 sequential calls (`--mode auth0`):

| Leg                                                      | Result                                                                           |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET https://dev-f3vkhvb6n52y7fre.us.auth0.com/userinfo` | **3 × `200`, 17 × `429`**                                                        |
| Latency of the `200`s (n = 3)                            | min 111 ms, median 115 ms, max 393 ms                                            |
| Latency of the `429`s (n = 17)                           | min 74 ms, median 93 ms, max 170 ms                                              |
| Rate-limit headers, first 3 calls                        | `x-ratelimit-limit: 300`, `remaining: 296 → 294`                                 |
| Rate-limit headers, calls 4–9 / 10–19 / 20               | **`retry-after: 114` / `113` / `112`** (`x-ratelimit-limit: 10`, `remaining: 0`) |
| Body on the `429`                                        | `UserInfoError: Too Many Requests`                                               |

The effective bucket is **10 requests**, and once it is empty every call is a
`429` with a ~114 s reset that steps down as the window drains (114 → 113 →
112 across the 17 rejected calls). The app's own volume reaches that bucket
quickly (D4): a session page load issues **2** `/userinfo` calls when both of its
validations run, the `/training` hop issues **3**, and a two-hop load therefore
costs 5 — so two of them exhaust a 10-request bucket.

Note the shape: a `429` normally returns in ~93 ms. The app still treats it as a
failed validation, so most `/login` redirects cost little — but see the tail
below, where the same `429` took 8 973 ms, which is the case that also blows the
8 s data deadline.

The same call also has a multi-second tail. Stage reproduction with the app's
exact retry shape (`retry(getUserInfo, 2, 500)`), n = 10:

| Sample  | Result                                                        |
| ------- | ------------------------------------------------------------- |
| 9 of 10 | `200`, 76–148 ms (median 103 ms)                              |
| 1 of 10 | **`429` after 8 973 ms** (`UserInfoError: Too Many Requests`) |

That is the same order as the 8 s deadline, and it is where the seconds on the
slow legs come from (§4.3). The `429` is not fast-failing: the request sat
~8.4 s before the response, then the app's second attempt returned `429` after
the 500 ms backoff.

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

### 4.1 The read path in order, and where the deadline legs actually sit

#### 4.1.1 The chain, at the pin

The session-page document request runs two separate `getSession` calls before it
reaches the data load:

| #   | Code                                                                                                           | What it can do                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/web/src/middleware.ts:231` → `resolveCookieSession` `:133-184`                                           | `validateToken` (`:142`, **does not populate the token cache**) + `auth0UserService.getUserById` (`:159`). Then `next()`                                                                    |
| 2   | `apps/web/src/pages/training/session/[sessionId].astro:46` `getSession(Astro.request)`                         | `lookupCachedSession` → in-process `tokenCache` (`session.ts:157-158`); on a miss, `validateToken` (`:408`) then `storeSession` (`:415`), whose `cacheSet` (`:185`) is **synchronous**      |
| 3   | `session-api.ts:122` `await getSession(request)` inside `loadTrainingSession`                                  | the same function; an L1 hit if step 2 stored, a validation if not                                                                                                                          |
| 4   | `session-api.ts:130` `await resolveInternalUserId(session.user)` → `internal-identity.ts:42` `resolveIdentity` | `getCachedIdentity` (`user-identity.ts:119-130`, bounded at 750 ms) → `transaction(...)` (`:228`) → `acquireClient` → `getPool().connect()` (`db/index.ts:266-278`) → `findInternalIdBySub` |
| 5   | `session-api.ts:136` `getPool().query(...)` sessions, `:150` messages                                          | two more queries on the same pool                                                                                                                                                           |

Every stage after step 3 is bounded except one: the cache read is capped at
750 ms (`user-identity.ts:74`) and the cache write at 1 000 ms (`:82`), while
`getPool().connect()` is bounded only by the pool's own
`connectionTimeoutMillis: 15000` (`db/index.ts:88`, hardcoded — `DB_MAX_CONNECTIONS`
and `DB_IDLE_TIMEOUT` are env-overridable, this one is not), and no
`statement_timeout` or `query_timeout` is configured anywhere in
`db/index.ts`. `acquireClient`'s single retry fires only when `connect()` _raises_
a transient error (`:269-277`); a call that never settles is never retried.
15 000 ms is 1.875× the 8 s deadline, so on this path the deadline always fires
first.

#### 4.1.2 The page's `getSession` is an in-process cache hit — confirmed

This is the correction that the first revision missed. On the session-page
document legs the loader's `getSession` (step 3) is **an L1 hit, never a
validation**, for two independent reasons:

1. **By code.** `resolveCookieSession` calls `validateToken` directly
   (`middleware.ts:142`) and never calls `storeSession`, so the middleware does
   not warm the cache; the page's `getSession` (step 2) therefore either
   validates, or returns `null` (`session.ts:409` → `[sessionId].astro:49-51`),
   or finds a cache entry. If it validates it calls `storeSession`
   (`session.ts:415`) and `cacheSet` (`:185`) writes the module-level
   `tokenCache` map (`:72`) **before the response is written** — so step 3 sees
   it. The first revision's own §4.4 said this; §4.3 contradicted it.
2. **By the tail, for the deadline legs specifically.** All 22 distinct
   session-page deadline legs (23 raw, one cross-window duplicate) log exactly
   **one** completed validation (§4.1.3). One
   completed validation cannot be step 2 _and_ step 3, and step 2 returning
   `null` would have produced the `:49-51` redirect instead of the deadline
   redirect at `:78-80`. So on these legs step 2 returned a cached session
   without validating, and step 3 was a hit on the entry it had just stored.

#### 4.1.3 What the deadline legs show, and why the security-event count cannot carry the old claim

Both windows, same pin. The markers are placed by offset within each event (§2
instrument 6).

| Class                                   | n                                                                                                                      | completed validations (`sec`) | Redis attempt after the last `sec`                      | silence to the deadline log | new Postgres client | pool init (per isolate — listed for completeness only, never used as per-request evidence) |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------- | --------------------------- | ------------------- | ------------------------------------------------------------------------------------------ |
| Session-page document, deadline `302`   | **22 distinct** (23 raw: 17 in window 1 — 16 in its committed 169-event prefix plus the duplicate — and 6 in window 2) | **1 on all 22**               | **1–81 ms** after it (16 legs 1–26 ms, 6 legs 63–81 ms) | **7 974–7 999 ms**          | **0 of 22**         | 0 of 22                                                                                    |
| API read `503`                          | **16** (7 + 9)                                                                                                         | **1 on all 16**               | **1–91 ms** after it (all 16 legs)                      | 7 983–7 999 ms              | **0 of 16**         | 0 of 16                                                                                    |
| Completing request (`200`, page or API) | **52**                                                                                                                 | 1, 2 or 3                     | —                                                       | —                           | **52 of 52**        | 42 of 52                                                                                   |

The `New client connected` line is emitted by the pool's `'connect'` event
(`db/index.ts:147-152`), so it is a **per-connection, per-request** fact: every
request that got as far as a Postgres client logs it, and no request that did not
does. **52 of 52 requests that returned data created a Postgres client; 0 of 38
distinct requests that hit the deadline did** (39 raw; the cross-window duplicate
is counted once). That is the discriminator that replaces the
per-isolate pool-init line, and it is what makes the two readings separable:

- **A cache hit and a pending validation are indistinguishable by the
  security-event count.** That count is one line per _completed_ `validateToken`.
  It distinguishes completed from not-completed; it cannot distinguish
  _not started_ (an L1 hit) from _started and pending_. `sec = 1` on a deadline
  leg is therefore compatible with both readings, which is exactly how the first
  revision's D3 came to be wrong. **The count cannot carry an attribution of
  where a request is stalled, and this report no longer uses it for that.**
- **A pending validation and a Postgres stall are separable by what happens
  after the last cache read.** On all 22 distinct session-page deadline legs the last
  cache read lands 1–81 ms after the last completed validation, and then nothing
  happens for ~8 s. A pending `validateToken` would have produced its
  `/userinfo` and role calls _before_ that read (the role read is at
  `auth0-jwt-service.ts:680`, after `getUserInfo` at `:664`), and a completed one
  would have logged a second line. Neither happens. The stage that follows the
  cache read is `resolveIdentity`'s transaction, and it never produces a client.
  On the page class this settles the question, because §4.1.2 shows the page's
  `getSession` cannot have been a validation; on the API class the same shape
  appears on all 16 legs but is not decisive (§4.3).

The `/userinfo` cost sits **before** that window, and it is what makes the
deadline legs long rather than the reason they stall. Pre-load time (deadline
log offset − 8 000 ms) on the 22 distinct page legs: `218, 220, 4 268, 4 318, 4 318,
4 797` and seventeen between `8 520` and `9 140` ms. Those three clusters are the
middleware's `/userinfo` call, and they match the Worker-side distribution of
the gap between two completed validations on completing requests (n = 42, min
183, **median 4 092**, p90 8 790, max **9 195** ms). So the decomposition is
exact:

```
wallTime ≈ (middleware's /userinfo call) + (the 8 s deadline window)
```

8.2 s legs = fast validation + 8 s; 12.2–12.8 s legs = ~4.3 s validation + 8 s;
16.5–17.1 s legs = ~8.8–9.1 s validation + 8 s. Measured page wallTimes:
`8 219 8 221 12 269 12 320 12 320 12 797 16 521 16 628 16 671 16 678 16 722
16 733 16 802 16 804 16 808 16 846 16 902 16 916 16 950 16 989 17 059 17 081
17 141`. The API `503`s follow the same shape (`8 188`–`8 254` and
`16 561`–`17 027`).

#### 4.1.4 The stage table, by leg class

Every row states the legs it covers. "Share" is of the 8 000 ms
`TRAINING_DATA_DEADLINE_MS` budget.

| Stage                                                    | Leg class it covers                        | Instrument                                                                    | n                                     | min      | median       | max                                   | Share of 8 s                            |
| -------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------- | -------- | ------------ | ------------------------------------- | --------------------------------------- |
| Middleware `resolveCookieSession` → `/userinfo` (step 1) | all authenticated legs                     | gap between two completed validations, Worker-side                            | 42                                    | 183 ms   | **4 092 ms** | **9 195 ms**                          | 51% median, 115% max                    |
| Page `getSession` (step 2)                               | session-page legs, cache-miss case         | `sec = 2` vs `sec = 1` on page `200`s                                         | 22 / 6                                | —        | —            | —                                     | 0 ms when an L1 hit                     |
| Loader `getSession` (step 3)                             | session-page deadline legs                 | `sec = 1` on 22 of 22 distinct (23 raw), plus §4.1.2's control-flow argument  | 22                                    | —        | —            | —                                     | **0 ms — L1 hit**                       |
| Loader `getSession` → `validateToken` (step 3)           | API-read legs, when L1 is cold             | `sec` ≥ 2 on 20 of 24 completing API reads, so the loader does validate there | 24                                    | —        | —            | —                                     | 2 calls, seconds when `/userinfo` tails |
| `getCachedIdentity` (step 4)                             | every leg that reaches step 4              | offset from the last `sec` line to the last Redis attempt                     | 22 page deadline legs                 | 1 ms     | ~4 ms        | **81 ms**                             | ≤ 1%                                    |
| `resolveIdentity` Postgres client acquisition (step 4)   | **session-page deadline legs**             | absence of `New client connected`; presence on 52 of 52 completing requests   | 22 vs 52                              | —        | —            | > 8 000 ms vs 133 ms                  | **> 100% vs 1.7%**                      |
| Normal Postgres client creation                          | completing requests                        | offset from the identity cache read to `New client connected`                 | 52                                    | 93 ms    | **133 ms**   | 1 188 ms                              | 1.7%                                    |
| `resolveRoleFromManagementApi` → `getUserById`           | inside every `validateToken`               | direct probe                                                                  | 20                                    | 34 ms    | 92 ms        | 272 ms; 8/20 `429` (`retry-after: 1`) | 1.2%                                    |
| Same, with the SDK's built-in 429 retry                  | inside every `validateToken`               | stage reproduction                                                            | 10                                    | 56 ms    | 74 ms        | 218 ms                                | 2.7%                                    |
| `cacheIdentity` write (step 4)                           | never reached on a deadline leg            | code bound (`:82`)                                                            | —                                     | —        | —            | ≤ 1 000 ms                            | ≤ 12.5%                                 |
| Edge + Worker baseline (`/api/health`)                   | control                                    | client timing                                                                 | 10                                    | 16 ms    | 45 ms        | 1 383 ms                              | 0.6%                                    |
| Tampered-token control (`401`)                           | control: auth cost with no DB and no cache | client timing                                                                 | 10                                    | 1 749 ms | 1 798 ms     | 1 915 ms; 0 Redis lines               | 22%                                     |
| Whole API read, valid token                              | API class                                  | client timing                                                                 | 11 × `200` / 9 × `503` (this window)  | 528 ms   | 8 260 ms     | 17 065 ms                             | —                                       |
| Session page document, valid token                       | page class                                 | client timing                                                                 | 10 × `200` / 10 × `302` (this window) | 698 ms   | 11 812 ms    | 21 656 ms                             | —                                       |

Two readings of this table matter:

- **Two complete validations are not inherently slow.** The fastest session page
  that logged two completed validations finished in **858 ms**, and the fastest
  API read that logged two in **811 ms**; five more two-validation page loads
  finished in 5 215–5 789 ms. The seconds on the slow legs come from the
  `/userinfo` _tail_ (§3.3), not from validation as such — so "the request
  validated twice" cannot be the explanation of an 8 s stall.
- **The deadline legs are the cheapest legs on Auth0.** They log one completed
  validation, against two on 22 of 28 rendered session pages and three on
  `/training` (§4.4). A request that makes the fewest Auth0 calls is the one that
  stalls longest, and it stalls in a stage that makes no Auth0 calls at all.

#### 4.1.5 The session-cache chain, timed

`getSession` → `lookupCachedSession` → `getFromCache` (`session.ts:398-423` →
`:153-176` → `redis.ts:507-523`), by leg class:

| Stage                                                        | Leg class it covers                                                   | Instrument                                                          | n                    | measured                                    | Share of 8 s       |
| ------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------- | ------------------------------------------- | ------------------ |
| `lookupCachedSession`, L1 (`cacheGet`, `session.ts:157-158`) | the 22 page deadline legs, 6 of 28 page `200`s, 4 of 24 API `200`s    | code path — this branch makes no network call at all                | 33                   | **0 ms** by construction                    | 0%                 |
| `lookupCachedSession` → `getFromCache` (L2)                  | taken only on an L1 miss, and only if `USE_REDIS_SESSIONS` is on (§6) | per-attempt host probe + the 481 same-millisecond error/close pairs | 481 pairs, 20 probes | **1–250 ms** per attempt, median 2 ms       | ≤ 3.1% per attempt |
| Whole chain, first-to-last Redis span                        | completing requests                                                   | **withdrawn** — §4.2 shows it measures `/userinfo`                  | 52                   | min 268, p50 534, p90 11 549, max 13 802 ms | —                  |

So the session cache costs **nothing** on the legs that hit the deadline (L1 hit,
no network) and at most a few hundred milliseconds when the L2 read is taken.

### 4.2 Is the unreachable Redis cache a material cost?

**No — not of the 8 s exceedance, and not at the multi-second scale the first
revision reported. That figure was an artefact, and it is withdrawn.**

1. **The first revision's "in-Worker cache span" measures `/userinfo`.** The
   metric was the span between an event's first and last Redis log line. On the
   52 completing requests it exceeds 2 000 ms on 19, and on **every one of those
   19 a single silent gap is 88–97% of the span**. Worked example (first
   window): a session page with `wallTime = 10 546 ms` has first-to-last Redis
   span `9 473 ms`, of which **8 955 ms (95%) is one gap with no Redis line in
   it** — that gap is the second `validateToken`'s `/userinfo` call sitting
   between two Redis attempts (the role work of the first validation and the
   cache work of the second). The metric therefore reports Auth0 latency under a
   cache label, and the "median 91% of `wallTime`" claim is Auth0's, not the
   cache's.
2. **The per-attempt cost of the dead host is small and is measured directly.**
   `witty-buffalo-119990.upstash.io` is NXDOMAIN: 20 of 20 DNS probes fail with
   `ENOTFOUND`, min 1 ms / median 2 ms / max 247 ms; the TCP probe is min 1 ms /
   median 2 ms / max 179 ms. Every one of the **481** `Redis error` →
   `Redis connection closed` pairs across both windows (338 in window 1, 143 in
   window 2) is in the **same
   millisecond**, i.e. the failure is synchronous, not a timeout wait. A
   completing request logs **4 or 6** attempts (20 of 28 page `200`s and 6 of 24
   API `200`s log 4; the rest log 6), each failing in ~1–250 ms with a median of
   2 ms — so the whole-request cache cost is **~10 ms typically and at most
   ~1.5 s**, and it is paid on the way to the database rather than blocking the
   request for seconds. `ensureConnected` (`redis.ts:73-86`) memoizes an
   in-flight connect promise, which is why two adjacent cache calls usually share
   one attempt and the attempt count is ±1 per request — another reason not to
   attribute by count.
3. **The legs that hit the deadline barely touch the cache at all.** On the 22
   page deadline legs the first-to-last Redis span is at most **172 ms**, and on
   the 16 API `503`s at most **160 ms** — against 19 of the 52 completing
   requests, where the same span exceeds 2 000 ms. The only cache read on a page
   deadline leg is the identity read, 1–81 ms after the last completed
   validation.
4. **A path with zero cache activity is still slow.** The tampered-token control
   returned `401` in 1 749–1 915 ms (median 1 798 ms, n = 10) with **no Redis
   lines at all** — pure Auth0 retry cost.

**How much of the 8 s deadline the cache accounts for:** on the 22 page deadline
legs, at most **172 ms of cache span — 2.2%** of the budget, on legs that spent
7 974–7 999 ms somewhere else. On a completing request, 4–6 attempts at a median
2 ms is **~10 ms (0.1%)**, and the observed worst case (6 attempts × 247 ms) is
~1.5 s (**18.5%**). None of that is the exceedance; §4.3 names what is.

So the dead host is a real but small latency cost (~10 ms typical, at most ~1.5 s
per request) and a correctness smell (every cache read is a guaranteed miss). It
is **not** the deadline cost, and no fix may cite D2 for the 8 s exceedance. What
it does buy is D4's amplifier: the role cache misses on every validation, so every
validation pays a Management round-trip and the tenant's 10-request `/userinfo`
bucket is drained faster.

### 4.3 What the cost is

**On the session-page document legs the stall is the first Postgres round-trip
inside `resolveIdentity`: `getPool().connect()` in `acquireClient`
(`apps/web/src/lib/db/index.ts:266-278`) never yields a client, and nothing on
the request path bounds it below the 8 s deadline.**

The evidence, in the order it rules things out:

- **Not the loader's validation.** `sec = 1` on 22 of 22 distinct page deadline legs
  (§4.1.3), and the one completed validation is the middleware's — the page's
  `getSession` must have been an L1 hit for the request to reach the data load at
  all (§4.1.2). A pending validation would also have produced its role read
  _after_ its `/userinfo` call, not 1–81 ms after the middleware's completion.
- **Not the cache read.** The identity cache read is the last thing the request
  does before the stall, and it lands 1–81 ms after the last completed
  validation — the same order as a single failed connect attempt against the
  dead host (§4.2), and bounded by 750 ms in code (`user-identity.ts:74`).
- **Not the Management call.** It runs inside `validateToken`
  (`auth0-jwt-service.ts:680`), i.e. before the identity cache read, and it is
  bounded by the SDK's retry policy (`auth0@7.5.0/lib/retry.js`: 3 retries,
  500 ms base, capped at 10 s) with a measured 56–218 ms in the reproduction.
- **The Postgres client is never created.** 0 of 22 page deadline legs and 0 of
  16 API `503`s log `New client connected`, against **52 of 52** completing
  requests (`db/index.ts:147-152`). Normal creation costs 93–1 188 ms, median
  **133 ms**, so the expected next event after the cache read is a client within
  a few hundred milliseconds. It never arrives, and the request sits for
  7 974–7 999 ms until `withDeadline` (`session-api.ts:40-56`) fires and logs
  `Training session load deadline exceeded` (`:191`) into the bounded `503` /
  `302`.
- **The bound that should have caught it is the wrong size.** pg's only bound is
  `connectionTimeoutMillis: 15000` (`db/index.ts:88`), 1.875× the route's 8 s
  deadline, and `acquireClient`'s single retry (`:269-277`) fires only on a
  raised transient error. A `connect()` that hangs — or a `BEGIN` on a pooled
  client whose socket died across an isolate freeze/thaw, which is the failure
  mode the pool's own comment at `:132-144` describes — is neither bounded by
  the deadline nor retried, and the checked-out client is never released
  (`transaction`'s `finally` at `:299-318` never runs), so the pool leaks a slot
  per stalled request against `max: 20` (`:86`).

**Where the report stops.** Without in-source instrumentation this measurement
cannot separate "`pool.connect()` never resolved" from "`pool.connect()` handed
out a pooled client and the first statement on it never returned". Both are the
same defect class on the same branch — the first Postgres round-trip inside
`resolveIdentity` — and both have the same fix target, but the evidence is a
missing client-creation line plus ~8 s of silence, not a stack. The isolate
topology that decides between them is also unmeasured (§6).

**The API read class is not attributed here.** All 16 API `503`s show the same
shape — one completed validation, a cache attempt 1–91 ms later, 7 983–7 999 ms
of silence, no Postgres client — so the same stall is the simplest reading. It is
not a forced reading: on that route nothing precedes the loader's `getSession`,
so if `USE_REDIS_SESSIONS` is enabled a session-cache miss also performs a Redis
read at exactly that offset (`session.ts:157-176`), and the loader's validation
would then be the pending call. The measurement cannot tell an identity read from
a session read by position alone, so D3 does not cover the API class (§6), and a
fix must not assume the two classes share its mechanism.

**What the `/userinfo` tail does explain.** It explains the _duration_ of every
deadline leg (§4.1.3's decomposition), the 16.5–17.1 s cluster, D1, and the
`/login` redirects. It does not explain the in-deadline cost on the 8.2 s legs:
those requests entered the 8 s window at 0.2 s, having spent almost nothing on
Auth0, and then stalled for the full 8 s in the Postgres stage.

### 4.4 Why the requests make 5–7 Auth0 calls each

One Auth0 call is one `/userinfo` or one Management `getUserById`. Each
`validateToken` makes 2 of them (one `/userinfo` at `:664`, one Management call
at `:680` while the role resolves to `guest`), and the middleware makes **3**:
`resolveCookieSession` calls `validateToken` (`middleware.ts:142`) _and_
`auth0UserService.getUserById` (`:159`), which is a `ManagementClient` call in
its own right (`auth0.service.ts:8`, `:195`, `:281`, `:345`). That extra call is
why the count is 5–7 and not 4–6.

| Route                         | `validateToken` calls per load                            | Auth0 calls per load                                                                         | Evidence                                                                                        |
| ----------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `/api/training/sessions/{id}` | 2 (middleware + loader, `session-api.ts:122`)             | **5** (middleware 3 + loader 2)                                                              | 1 security-event line on 4 of 24 `200`s, 2 on 14, 3 on 6 (the extra line is not identified, §6) |
| `/training/session/{id}`      | 2 (middleware + page `getSession`)                        | **5** when the page's `getSession` validates; **3** when it is an L1 hit (the deadline legs) | 2 security-event lines on 22 of 28 page `200`s, 1 on the other 6; 1 on all 23 deadline legs     |
| `/training`                   | **3** (middleware + `isAuthenticated` + `getCurrentUser`) | **7** (middleware 3 + 2 + 2)                                                                 | 3 security-event lines on **3 of 3** `/training` `200`s; `training/index.astro:12-20`           |

Two page loads at 5 calls each therefore exhaust the 10-request bucket, and one
`/training` hop costs 7 on its own. The role cache that would absorb the
Management half of every validation is on the dead Redis host: `readCachedRole`
(`auth0-jwt-service.ts:487-501`) calls `getFromCache` against the same NXDOMAIN
host, misses every time, and falls through to the Management API on every
validation. So the cache's unreachability buys two costs, neither of which is
the deadline leg: a Management call on every validation (which drives the call
count that exhausts the `/userinfo` bucket), and ~10 ms of dead-host
attempts per request (§4.2).

## 5. Findings

Each is citable by id, and each states the legs it covers. Every number is from
the pin in §1.

- **D1 — The `/login` redirect is server-side and is produced by
  `validateToken` returning `valid:false` on an Auth0 `429`.** Covers: all
  authenticated legs (`/login` hops, session-page `302`s, `/training` `302`s).
  `getAuth0UserInfo` (`apps/web/src/lib/auth/auth0-jwt-service.ts:664`) receives
  `429` from `/userinfo` (17 of 20 direct calls; `x-ratelimit-limit: 10`,
  `retry-after` stepping 114 → 113 → 112), the throw is caught at `:734-746`,
  and the redirect is emitted at `apps/web/src/pages/training/index.astro:19`
  (10 of 12 observed, all with three completed validations) or
  `apps/web/src/pages/training/session/[sessionId].astro:49-51` (2 of 12, two
  completed validations). H1 refuted, H2 confirmed. _Acts on: the redirect fix
  must make token validation tolerate a `/userinfo` `429` (or stop making the
  call per request) — not touch cookies._
- **D2 (narrowed) — The dead Redis host is a small, bounded latency cost, not a
  multi-second stall, and it is not the deadline cost.** Covers: every
  authenticated leg, at ~10 ms typical and at most ~1.5 s per request. Each cache
  attempt against the NXDOMAIN host fails synchronously in ~1–250 ms (481 of 481
  `Redis error` → `Redis connection closed` pairs in the same millisecond; DNS
  probe median 2 ms, max 247 ms), 4 or 6 attempts per completing request. The
  first revision's "4 638–13 202 ms cache span, 91% of `wallTime`" is withdrawn:
  88–97% of that span is a single gap containing the `/userinfo` call (§4.2). The
  deadline legs have first-to-last spans of at most 172 ms (page) and 160 ms
  (API). The residual cost that matters is indirect: the role cache misses on
  every validation, so every validation pays a Management round-trip and drains
  D4's bucket. _Acts on: the cache fix is authorised as a small latency and
  correctness improvement, and as D4's amplifier — never as the cause of the 8 s
  exceedance._
- **D3 (rewritten) — On the session-page document legs the 8 s exceedance is the
  Postgres client acquisition inside `resolveIdentity`, not a second
  `validateToken`.** Covers: the **22 distinct session-page document deadline
  legs** only (23 raw: 17 in the first window, one of them the cross-window
  duplicate, and 6 in the second). Excludes: the API-read `503`s
  (§6) and every `200`. On 22 of 22 legs `sec = 1` (one completed validation,
  the middleware's), the page's and loader's `getSession` return from the
  in-process `tokenCache` (`session.ts:157-158`, warmed by the page's
  `storeSession` at `:185`), the identity cache read completes 1–81 ms later,
  and **no Postgres client is ever created** (`New client connected`: 0 of 22,
  against 52 of 52 completing requests; normal cost 93–1 188 ms, median 133 ms).
  The request then sits 7 974–7 999 ms until `withDeadline`
  (`session-api.ts:40-56`) fires. The only bound on that stage is pg's
  `connectionTimeoutMillis: 15000` (`db/index.ts:88`), 1.875× the deadline, and
  `acquireClient`'s retry (`:269-277`) fires only on a raised error, so a hang
  is never bounded or retried; no statement timeout is configured. The
  security-event count cannot carry this finding — it counts completed
  validations and cannot distinguish an L1 hit from a pending one — so the
  finding rests on the per-connection client marker and the marker _order_
  (§4.1.3). _Acts on: bound and recover the first Postgres round-trip on the
  training read path. A fix confined to the granted areas can do this from
  `user-identity.ts` (bound `resolveIdentity`'s transaction; on timeout discard
  the pool via `closeDatabase()`, `db/index.ts:323`, and retry once). If the fix
  concludes the correct place is `db/index.ts`, that file is **inside the grant
  the owner extended on 2026-11-09** — `AGENTS.md` records the grant with a
  precedence rule, and the earlier statement here that the file was outside every
  granted area is superseded (§5.8, amendment f). Keep the change minimal and
  prove the other callers still pass with counts._
- **D4 (narrowed) — The request path makes 5–7 Auth0 calls per page load against
  a 10-request bucket.** Covers: page loads and API reads; not the message POST.
  Session page 2 validations × 2 calls + the middleware's extra `getUserById`
  (`middleware.ts:159`) = 5, or 3 when the page's `getSession` is an L1 hit;
  `/training` 3 validations × 2 + 1 = 7 (3 of 3 `/training` renders logged three
  completed validations); the role cache that would absorb the Management calls
  is on the dead Redis host (`auth0-jwt-service.ts:487-501`). Two page loads, or
  one `/training` hop plus one page load, exhaust the bucket, so the system
  rate-limits itself. _Acts on: cache the role somewhere reachable and/or
  validate once per request; this is the amplifier behind D1._
- **D5 — The `302` does not evict the session.** Covers: every redirect
  observed. No observed redirect carries a `Set-Cookie` (0 of 48 `302`s in the
  tail window; `setCookie: []` in the client), so the redirect is not a
  cookie-clearing mechanism and a retry on the same cookie can succeed — which
  is exactly what happened 13 of 20 times. _Acts on: do not "fix" the redirect
  by re-issuing or clearing cookies._
- **D6 — The deadline `302` and the `/login` `302` are distinct defects that
  compound.** Covers: the burst's first attempts. 12 of 20 hit the 8 s deadline
  and redirected to `/training?error=session-not-found`; 10 of those then had
  the third of `/training`'s three validations fail (D7) and landed on
  `/login`. A fix for the redirect alone would leave the deadline redirect (and
  the misleading "session not found" surface) in place, and a fix for the
  deadline alone would leave the `/login` hop. _Acts on: the availability fix
  and the redirect fix must both land before the burst can reach 20/20._
- **D7 — `/training` validates the same token three times per load, and the
  third call fails after the first two succeed.** Covers: `/training` legs. All
  10 observed `/training` redirects logged three completed validations and no
  deadline; the 3 renders in the same window logged three as well.
  `training/index.astro:12-20` calls `isAuthenticated(request)` and then
  `getCurrentUser(request)`, each of which runs its own `validateToken`
  (`auth/index.ts:116-121`, `:38-99`), on top of the middleware's. The page's
  own first two calls consume the `/userinfo` budget that its third call then
  needs, so a page that is one validation away from rendering sends the user to
  `/login`. _Acts on: the cheapest single fix in this report — one validation
  per request on `/training`._

### 5.8 Which finding authorises which fix

No fix may cite a finding for a cost that finding no longer covers. Each fix
cites **one** finding — the primary one in the second column — and may treat the
others only as amplifiers or constraints, not as its authority.

| Fix feature                          | Primary finding it cites                                                                  | Also acts on (amplifier / constraint)                                                                                 | Authorised scope                                                                                                                                                                                                              | Explicitly **not** authorised                                                                                                                                                                                                                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login-redirect-fix`                 | **D1**                                                                                    | D4 (amplifier: the call volume that drains the bucket), D7 (the `/training` hop), D5 (constraint: no cookie re-issue) | Make `validateToken` tolerate a `/userinfo` `429`; reduce validations per request; one validation per request on `/training`; do not re-issue or clear cookies (D5)                                                           | It may not widen session lifetime, disable a check, or treat the redirect as client-side cookie loss (H1 refuted)                                                                                                                                                                                                                   |
| `hot-path-cache-degradation`         | **D3**                                                                                    | D2 (residual cache cost), D4 (role cache)                                                                             | Bound and recover the first Postgres round-trip on the training read path (D3); make an unreachable cache a fast, bounded miss (D2); make role resolution happen at most once per request and carry a Management timeout (D4) | It may not cite D2 for the 8 s exceedance — the measured cache cost is ~10 ms typical, ~1.5 s worst case. It **may** edit `lib/db/index.ts`: the owner extended the grant on 2026-11-09 and `AGENTS.md` records it with a precedence rule (amendment f). Keep the change minimal and prove the other callers still pass with counts |
| `message-post-bounding`              | its own measurement (the 50–66 s runtime-cancels, VAL-L04-003) — **no diagnosis finding** | D4 (amplifier only)                                                                                                   | Bound the POST route with the deadline/`503`/`Retry-After` shape `session-api.ts` already uses, and act on `hot-path-cache-degradation` so the request completes inside the bound                                             | It may **not** cite **D3**. This report did not measure the POST path, and D3 covers session-page document GETs only. It may not cite D2 either, for the same reason                                                                                                                                                                |
| `trainee-error-surface`              | **D6**                                                                                    | —                                                                                                                     | Replace the silent `?error=session-not-found` bounce with an explicit temporary-unavailable message and a retry control                                                                                                       | It may not claim the deadline itself is fixed                                                                                                                                                                                                                                                                                       |
| `availability-release-and-remeasure` | **D6**                                                                                    | — (sequencing constraint only)                                                                                        | Land both the availability and redirect fixes before re-running the burst                                                                                                                                                     | It may not treat a bounded `503` as passing VAL-HANG-001                                                                                                                                                                                                                                                                            |

The one change of ownership this correction makes: the dominant cost of the
8 s exceedance now belongs to `hot-path-cache-degradation` (via D3), not to
`message-post-bounding`. `message-post-bounding` keeps its own measurement and
D4 as an amplifier, and loses D3 entirely.

Two notes on this table as it stands on 2026-11-10. The `db/index.ts` grant was
extended by the owner after this report was written, so the row above cites the
grant as it stands rather than the earlier exclusion (`AGENTS.md`, "Gap-fix source
areas", and its precedence rule; amendment f). And `hot-path-cache-degradation`
shipped as `hot-path-stall-reduction` — same granted area, same D3 authority.

## 6. What remains unproven

- **Whether the Postgres stall is acquisition or the first statement.** The
  missing `New client connected` line and ~8 s of silence fit both "`connect()`
  never resolved" and "a pooled client was handed out and its first statement
  never returned"; this measurement cannot separate them (§4.3). Both are the
  same branch and the same fix target.
- **Why the Postgres round-trip stalls on these legs.** The evidence shows it
  never produces a client; it does not show whether the socket connect stalled,
  the TLS handshake stalled, or the isolate was frozen mid-await.
- **The API read `503`s.** All 16 legs show the page legs' shape (one completed
  validation, a cache attempt 1–91 ms later, ~8 s of silence, no client), but
  nothing precedes the loader's `getSession` on that route, so a session-cache
  Redis read could occupy the same position and the loader's validation could be
  the pending call. The two readings cannot be separated from outside. D3
  excludes them; a fix must not assume they share its mechanism.
- **Whether `USE_REDIS_SESSIONS` is enabled in production.** It decides whether a
  session-cache miss also pays a Redis read, and therefore whether the API
  `503`s are separable at all (§4.3). Marker counts cannot settle it —
  `ensureConnected` memoizes an in-flight connect, so adjacent cache calls share
  one attempt and the count is ±1. The page attribution does not depend on it: an
  L1 hit returns at `session.ts:158` before the Redis branch is reached.
- **Why `/userinfo` took ~8.4 s to return a `429`.** The measurement shows the
  duration and the status; it does not show whether Auth0 queued the request or
  the connection stalled. Either way the app treats it as a failed validation.
- **Whether the 10-request bucket is per tenant, per client, or per source.**
  The headers show `x-ratelimit-limit: 10`; the scope is not exposed.
- **The isolate topology.** The L1 token cache and the pg pool are per isolate.
  The distribution is measured (a warm cache on some legs, a cold one on
  others); the assignment of legs to isolates is not, so the report does not
  claim which request warmed which isolate's cache — only that on the deadline
  legs the cache was already warm when the page's `getSession` ran (§4.1.2's
  control-flow argument holds either way).
- **The marker count is a proxy, and its own logging path is failing.** Every
  counted line is a `Failed to track security event` line, i.e. the security
  event itself did not reach its sink; the count of those lines is the count of
  `logSecurityEvent` calls, which is one per completed `validateToken`. If a call
  site logged twice or a line were dropped, a branch attribution would shift by
  one. The count is used in this revision only for _how many validations
  completed_, never for _where a request is stalled_ (§4.1.3).
- **The extra security-event line on 6 of 24 API reads.** The route performs two
  validations by code (middleware + `session-api.ts:122`) but logs three lines on
  6 of 24 `200`s. Some second emitter exists on that path and was not identified;
  it does not affect the `/training` attribution, where the code has three
  validations and the tail shows exactly three lines on 3 of 3.

## 7. Reproduction

Every argument the tools require is spelled out; `--worker` and `--commit` are
recorded into the artifact, and `--out` is required for the result to land.

```bash
cd /home/vivi/pixelated
./node_modules/.bin/wrangler deployments status --name pixelated-empathy

# 20 authenticated navigations, manual redirects, one retry each
node <missionDir>/tools/request-path-diag.mjs --mode burst --n 20 \
  --worker 547855bc-2669-4a44-932b-15aa3ea35983 \
  --commit bdee5c364ba2c54aa6759705d4fce3a4198c7d64 \
  --out <missionDir>/results/diag/burst-<iso>.json

# endpoint decomposition
node <missionDir>/tools/request-path-diag.mjs --mode endpoints --n 20 \
  --worker 547855bc-2669-4a44-932b-15aa3ea35983 \
  --commit bdee5c364ba2c54aa6759705d4fce3a4198c7d64 \
  --out <missionDir>/results/diag/endpoints-<iso>.json

# controls: tampered token, and the other non-DB paths
node <missionDir>/tools/request-path-diag.mjs --mode controls --n 20 \
  --worker 547855bc-2669-4a44-932b-15aa3ea35983 \
  --commit bdee5c364ba2c54aa6759705d4fce3a4198c7d64 \
  --out <missionDir>/results/diag/controls-<iso>.json

# direct Auth0 dependency probe (tenant + Management client the Worker uses)
node <missionDir>/tools/request-path-diag.mjs --mode auth0 --n 20 \
  --worker 547855bc-2669-4a44-932b-15aa3ea35983 \
  --commit bdee5c364ba2c54aa6759705d4fce3a4198c7d64 \
  --out <missionDir>/results/diag/auth0-<iso>.json

# dead Redis host DNS/TCP cost
node <missionDir>/tools/request-path-diag.mjs --mode redis --n 20 \
  --worker 547855bc-2669-4a44-932b-15aa3ea35983 \
  --commit bdee5c364ba2c54aa6759705d4fce3a4198c7d64 \
  --out <missionDir>/results/diag/redis-<iso>.json

# per-stage reproduction with the bundle's SDKs (takes --n and --out only)
node <missionDir>/tools/auth0-stage-timing.mjs --n 10 \
  --out <missionDir>/results/diag/stages-<iso>.json

# Worker-side correlation, redacted, across the whole window
# (wrangler emits nothing until the first event; send one /api/health probe,
# then check scriptVersion in the first event to prove the pin)
./node_modules/.bin/wrangler tail pixelated-empathy --format json \
  | node <missionDir>/tools/redact-tail.mjs \
  > <missionDir>/results/diag/tail-<iso>.jsonl
```

Artifacts (all under `<missionDir>/results/diag/`): `burst-20261109T212357Z.json`,
`auth0-20261109T213718Z.json`, `redis-20261109T213747Z.json`,
`endpoints-20261109T213757Z.json`, `stages-20261109T215028Z.json`,
`controls-20261109T215112Z.json`, `tail-20261109T212317Z.jsonl` (170 events
retained, 169 distinct; §2), `api-events.txt`, and from the second window
`endpoints-20261109T2236Z.json`, `tail-20261109T2235Z.jsonl` (62 events), plus
the single retained row-state snapshot `row-state-20261109T2252Z.json`.

No row was written by any of these commands: every probe is a `GET`, the only
`POST` is the sign-in that mints the cookie, the stage reproduction runs
`SELECT 1` and reads Auth0, and the read-only row-state tool
(`node <missionDir>/tools/l03-row-state.mjs`, 12 `SELECT`s and no write
statement) was run after each window:

| Snapshot                                                                                 | org A `sessionHash`                | org A `messagesHash`               | org A messages |
| ---------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------- | -------------- |
| `row-state-20261109T2252Z.json`, observed 2026-11-09T22:55:13Z (after the second window) | `16c99c27c729d95ce741ded2e8596d91` | `8f875826a017bb5d870a3627a25236e5` | 8              |

Only this snapshot is retained. An earlier revision also listed an "after the
first window, 2026-11-09T21:54:38Z" row with the same values; no artifact backs
that row — the file it cited does not exist — so it is withdrawn rather than
reproduced (amendment d). The retained snapshot is byte-identical to the values
recorded in `evidence/l03-tenant-boundary-release.md:239,252-253`, so the second
window changed no row. (The org B fixture reads 4 messages; it
is a different organization and was not touched by this feature either.)
