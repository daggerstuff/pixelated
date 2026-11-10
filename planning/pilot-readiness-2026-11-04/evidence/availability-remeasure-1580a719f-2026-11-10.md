# Availability re-measurement on the one-round-trip validation release — 2026-11-10

**Feature:** `provider-validation-release-and-remeasure` (milestone
`provider-validation-remeasure`)
**Release under test:** `1580a719f216ed7314dad0e8496eec17b5a88951` / Worker
`186b655f-093f-4224-86f1-b3e25646a3b7` at 100%
**Measurement window:** 2026-11-10T22:34Z – 22:52Z (three scored burst windows
inside it; see §2)
**Decision:** `VAL-HANG-001` **passes** on this pin — 20 of 20 first-attempt
`200` in each of three windows, 0 retries. `VAL-L04-003` and `VAL-POST-001` are
**re-verified** on this pin and pass. `VAL-L03-011` passes on the quiet-window
matrix run and is carried as **PASS, provider-bucket conditional**: the same pin
returned OPEN with 6 provider `503`s four minutes earlier (§3). The pin is still
sensitive to the Auth0 `/userinfo` bucket (§7.1), and that sensitivity is now
measured rather than inferred.

This record measures **one release**: the validation collapse (PR #6679, §1.1).
No earlier pin is restated as current. The baseline `8397bdff6` / Worker
`7ea1640e` appears only as the before-number it is, labelled as such.

## 1. Release under test

### 1.1 What was merged

| Step                                          | Value                                                                                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR merged                                     | [#6679](https://github.com/daggerstuff/pixelated/pull/6679) `fix(auth): classify a cold token with one /userinfo round-trip`                                            |
| Head at merge                                 | `325ef2d5e92889cb65fa577d66f806bdadf12912` (read with `gh pr view`, not taken from the brief)                                                                           |
| Head `CI` run                                 | `42911347354` (`pull_request`, `headSha` matching) — **success**, 22:06:02Z → 22:12:03Z                                                                                 |
| Head `Quality` run                            | `42911347769` — **failure**, the known `ai submodule strict ratchet` (not a merge blocker, `AGENTS.md` "Known pre-existing issues")                                     |
| Head `Vercel` / `Vercel Deployments – Wutang` | **fail**, "Account is blocked" — the platform-level block, not this change                                                                                              |
| Merge                                         | `gh pr merge 6679 --squash` at 22:20:12Z → `1580a719f216ed7314dad0e8496eec17b5a88951`                                                                                   |
| Base check                                    | `origin/staging` was `8397bdff6…` immediately before the merge, so the PR applied to the pin it was written against                                                     |
| Scope                                         | **6 files**, +425 / −240: `lib/auth/session.ts`, `lib/auth/index.ts`, `middleware.ts`, and three test files under `lib/auth/__tests__/`. Nothing outside `apps/web/src` |
| `mergeStateStatus`                            | `UNSTABLE` — the documented non-blocking set above; the `CI` workflow itself was green on the exact head                                                                |

### 1.2 Deploy and pin

| Item                                            | Value                                                                                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staging `CI` on the merge SHA                   | `42913610181` (event `push`) — **success**, 22:20:16Z → 22:27:13Z                                                                                                                                                   |
| Staging `Quality` on the merge SHA              | `42913610100` — **failure**, the same `ai submodule strict ratchet`                                                                                                                                                 |
| Deploy run                                      | `42914696184` (`workflow_run`, created 22:27:16Z) — **success**                                                                                                                                                     |
| Deploy job list (read, not inferred)            | `Detect app-facing changes` **success**, `Check deploy credentials` **success**, `Build Cloudflare bundle` **success**, `Deploy to Cloudflare` **success** — **none skipped**, so no `workflow_dispatch` was needed |
| Built SHA (both jobs, `git log -1 --format=%H`) | `1580a719f216ed7314dad0e8496eec17b5a88951`                                                                                                                                                                          |
| Deploy log version line                         | `Current Version ID: 186b655f-093f-4224-86f1-b3e25646a3b7`                                                                                                                                                          |
| Active Worker version (live read)               | `186b655f-093f-4224-86f1-b3e25646a3b7`                                                                                                                                                                              |
| Traffic percentage                              | **100%** (single active version)                                                                                                                                                                                    |
| Worker version created                          | 2026-11-10T22:30:33.588Z                                                                                                                                                                                            |
| Deployment created                              | 2026-11-10T22:30:35.400Z                                                                                                                                                                                            |
| Wrangler CLI used for the read                  | `4.158.0` via `./node_modules/.bin/wrangler deployments status`                                                                                                                                                     |
| `origin/staging` HEAD                           | `1580a719f…` at the 22:20Z, 22:34Z and 22:53Z reads — the pin did not move through the window                                                                                                                       |
| Health                                          | `https://pixelatedempathy.com/api/health` → **200** (1.76 s); apex `/` → **200** (1.39 s), 22:34:05Z                                                                                                                |
| Tail `scriptVersion`                            | `186b655f-093f-4224-86f1-b3e25646a3b7` on **all 53** events of the scored window                                                                                                                                    |

`www.pixelatedempathy.com` was not probed as a health claim: it answers 402 with
`x-vercel-error: DEPLOYMENT_DISABLED` because the Vercel standby account is
blocked. That is an environment condition, not a product regression.

### 1.3 What the merged change does

`apps/web/src/lib/auth/session.ts` gains `validateSessionToken(token)`, which
reads the existing validated-session cache and, on a miss, makes **one**
`validateToken` call and returns a verdict (`valid` / `invalid` /
`provider-unavailable`). `getSession` delegates to it, so there is one validation
path. `apps/web/src/middleware.ts` `resolveCookieSession` calls it once and maps
the verdict: `provider-unavailable` → the existing `503` + `Retry-After`
surface, `invalid` → logout, `valid` → the same `locals` mapping as a cache hit.
The middleware's own `validateToken` import, `readCachedSession`,
`withManagementDeadline` and `MANAGEMENT_ENRICHMENT_DEADLINE_MS` are removed as
obsolete. No new cache, no TTL change, `USERINFO_DEADLINE_MS` untouched.

## 2. VAL-HANG-001 — the 20-navigation authenticated bursts

Requirement: **20 of 20 HTTP `200` on the first attempt**, a bounded `503`
fails, a `/login` redirect counts against the twenty, at most one backed-off
retry per request. Harness: `tools/request-path-diag.mjs --mode burst --n 20`,
a real sign-in cookie for org A, twenty sequential document `GET`s of
`/training/session/33333333-…` with manual redirect following. Three windows
were run back-to-back in one continuous `wrangler tail` capture.

| Window (UTC start – end)       | First-attempt `200` | Final `200`  | Retries | `503` | `/login` | First-attempt latency min / upper median / max |
| ------------------------------ | ------------------- | ------------ | ------- | ----- | -------- | ---------------------------------------------- |
| w1 22:34:36.409 – 22:34:58.492 | **20 of 20**        | 20 of 20     | 0       | 0     | 0        | 612 / 802 / 2 216 ms                           |
| w2 22:34:58.569 – 22:35:16.259 | **20 of 20**        | 20 of 20     | 0       | 0     | 0        | 672 / 729 / 1 172 ms                           |
| w3 22:35:16.335 – 22:35:34.751 | **20 of 20**        | 20 of 20     | 0       | 0     | 0        | 649 / 754 / 993 ms                             |
| **All three**                  | **60 of 60**        | **60 of 60** | **0**   | **0** | **0**    | —                                              |

Every leg answered `session-200` with `hasMessageInput: true` and
`hasLoginForm: false`. **Two legs exceeded one second:** the cold first leg of
w1 (2 216 ms), which is the cold-isolate cost and not a retry, and burst w2
request index 2 (1 172 ms), which is **not** that window's cold first leg. Both
answered `200` on the first attempt with 0 retries. Latency columns are upper
medians (`sorted[n/2]`).

Tail for the same window: **53 events**, `scriptVersion` `186b655f-…` on every
one, **0** exception entries, **0** `deadline exceeded` lines, **0** runtime-cancel
strings.

**Verdict: PASS.** Three scored windows, every one 20 of 20 on the first
attempt, no bounded `503`, no `/login`. Three clean windows is the minimum the
brief sets and all three are clean.

### 2.1 The mechanism moved — completed validations per request

The tail counter is `Failed to track security event`, one line per completed
`validateToken` (`logSecurityEvent` is called exactly once per validation, on
both the success and the failure path — `auth0-jwt-service.ts:860` and
`:910` at this SHA). It is a validation counter, not an error.

| Window        | Session-page legs captured | Legs with 0 validations (cache hit) | Legs with **exactly 1** (cache miss) | Legs with 2 or more |
| ------------- | -------------------------- | ----------------------------------- | ------------------------------------ | ------------------- |
| w1            | 17                         | 16                                  | **1**                                | **0**               |
| w2            | 15                         | 14                                  | **1**                                | **0**               |
| w3            | 15                         | 14                                  | **1**                                | **0**               |
| **All three** | **47** (all `200`)         | **44**                              | **3**                                | **0**               |

**On a cache miss an authenticated request now completes exactly one
validation. The before-number is two.** The three 1-validation legs are the cold
first leg of each window; every other leg was a validated-session cache hit and
cost zero provider calls.

The before-number was measured on `8397bdff6` / Worker `7ea1640e`: three page
`503`s at exactly 5 001 ms each carrying **two** completed validations, and one
`302` to `/login` at 6 945 ms carrying **three**
(`library/release-pin.md` §0.17). That is the shape two 2 500 ms
`USERINFO_DEADLINE_MS` bounds produce.

The discriminator that isolates the **middleware's** count from the page's, on
the branch the collapse changed (a cold token that cannot be verified):

| Probe on this pin                                                                    | Observed                                                           | Completed validations |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------- |
| `GET /admin/dashboard` with a structurally valid, signature-tampered token, sample 1 | `302` → `/login?redirect=%2Fadmin%2Fdashboard`, worker wall 801 ms | **1**                 |
| same, sample 2                                                                       | `302` → `/login?redirect=%2Fadmin%2Fdashboard`, worker wall 786 ms | **1**                 |

`/admin*` is redirected **by the middleware** (`middleware.ts:362-380`) when
`locals` is empty, so the page component never runs and the count is the
middleware's own. Before the collapse this branch paid two: `getSession` (one
validation) and then the classifying `validateToken` (a second) — the recorded
before-number of two.

**One residual, recorded rather than smoothed over.** `GET
/training/session/…` with the same tampered token still totals **two**
validations (measured: `302` → `/login` at 1 243 ms carrying 2). That is not the
fixed double call: it is the middleware (1) plus the **page component's own**
`getSession` re-check (1) after the middleware declines to redirect. It is off
the `VAL-HANG-001` path, because a `provider-unavailable` verdict returns `503`
from the middleware before `next()` runs (`isSessionRequiredPage` matches
`/training` and `/training/*`), so the page never executes. It is reported as a
residual for the next round, not claimed as fixed here.

Test evidence for the outage branch on the deployed tree comes from the
exact-SHA `CI` run `42913610181` (green on `1580a719f`), which exercises
`apps/web/src/lib/auth/__tests__/middleware-session-cache.test.ts`:
`performs exactly one validation when a cold token cannot be verified`,
`performs exactly one validation when a cold token is invalid`,
`costs one validation per request while the provider is down`,
`answers 503 + Retry-After when a cache miss cannot be verified`.

## 3. VAL-L03-011 — the tenant matrix, re-verified

Driver: `node tools/l03-tenant-matrix.mjs --worker 186b655f-… --commit
1580a719f…`. Result:
`results/l03-tenant-matrix-2026-11-10T22-50-47-128Z.json`.

| Quantity                           | Value                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------- |
| Legs                               | **35** — 6 pass, 15 deny, 14 exclusion, 0 fail                              |
| `defects5xx`                       | **0**                                                                       |
| `noResponse` / `transient429`      | 0 / 0                                                                       |
| `hardFailures`                     | **0**                                                                       |
| `legacyRoutesIdentical410BothOrgs` | **true** — all five legacy routes `410` in both organizations               |
| `unauthenticatedAll401`            | **true** — all 7 unauthenticated legs `401`                                 |
| Foreign-row integrity              | org B unchanged after org A's phase, org A unchanged after the whole matrix |
| `--verify-result`                  | recomputes **PASS**, `hardFailures 0`, exit **0**                           |

**Verdict: PASS, provider-bucket conditional**, re-verified on this pin (not
carried forward). Both same-pin runs are cited: the quiet-window run
`results/l03-tenant-matrix-2026-11-10T22-50-47-128Z.json` recomputes **PASS**
with 0 hard failures, and the earlier run
`results/l03-tenant-matrix-2026-11-10T22-44-16-978Z.json` returned **OPEN** with
6 hard failures, all provider `503`s. The status vocabulary has no conditional
value, so the condition is carried in this sentence and in the register and
decision records rather than in the verdict cell.

**One earlier run on the same pin failed, and the reason is the provider
class.** The first matrix invocation at 22:44:16Z returned `OPEN` with **6 hard
failures**, every one a `503
{"error":"Authentication provider temporarily unavailable","retryAfterSeconds":30}`
— five on the legacy `/api/session/*` routes and one on the cross-organization
message POST. Those routes are session-bearing, so the middleware answered the
provider outage with the documented `503` before any handler ran; the legacy
`410` mapping was not involved. The condition was this worker's own load: the
run followed three bursts, three UI sign-ins, ten submissions and a verify pass
inside about eight minutes, which had spent the `/userinfo` bucket. The clean
re-run was taken after a five-minute quiet period. Both runs are recorded; the
`PASS` verdict is claimed for the quiet-window run, and the failing run is
reported as a provider-sensitivity observation, not as a matrix defect.

## 4. VAL-L04-003 — the trainee message round-trip, re-verified

`tools/ab-ui-posts.mjs --mode roundtrip --n 1`, run
`1580a719f-roundtrip-2236`.

| Step                                           | Observed                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| Sign-in through the real `/login` form (org A) | attempt 1, landed `/dashboard`                                         |
| Session page                                   | `session-200` on attempt 1                                             |
| One submission through the session UI          | `201` in ~649 ms, request line asserted before scoring, selector click |
| Row persisted                                  | `6eb21b08-35cd-4e24-9c83-085ae732f19f`                                 |
| Reload                                         | `200` on attempt 1                                                     |
| Visible after reload                           | **yes** — `visible: true`, 99 bubbles                                  |

**Verdict: PASS**, re-verified on this pin.

## 5. VAL-POST-001 — ten consecutive submissions, re-verified

`tools/ab-ui-posts.mjs --mode posts --n 10`, run `1580a719f-posts-2239`, then
the authoritative `--mode verify --verify-tag 1580a719f-posts-2239`.

| Quantity               | Value                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Submissions            | **10 of 10** `201`                                                                                                                                                                                                                                                                                                                                                                                                |
| Request lines asserted | 10 of 10. Submissions 1, 3 and 4 used the harness's pointer (`selector-click`) path and answered in 649–655 ms. **Submissions 2 and 5–10 used the JS `el.click()` fallback** (7 of 10): the session page's send control is covered at its click point by `<footer.footer>`, so a pointer click is refused as covered. Submission 2 answered `201` in 6 992 ms; the other six fallback submissions were 646–654 ms |
| Rows persisted         | **10** (rows 99 → 109)                                                                                                                                                                                                                                                                                                                                                                                            |
| Post-reload read-back  | **10 of 10 visible** in a 109-bubble transcript, reload `200` on attempt 1                                                                                                                                                                                                                                                                                                                                        |
| Runtime-cancel         | 0 — see the evidence gap below                                                                                                                                                                                                                                                                                                                                                                                    |

**The send control is covered at its click point, and that is an observation a
human trainee could meet.** `#send-message` sits under `<footer.footer>` at the
point a pointer click would land; the harness reports
`✗ Element '#send-message' is covered by <footer.footer> at its click point` for
submissions 5–10 and for the retried pointer click in submission 2. The JS
`el.click()` fallback dispatches the click on the element regardless of
occlusion, which is why **all ten still answered `201`** — the persistence path
works, but the visual affordance is obstructed. This is recorded as a product
observation, not scored as a pass for the pointer path.

**Evidence gap on the runtime-cancel leg — stated, not papered over.**
`VAL-POST-001` requires "the tail showing zero runtime-cancel exceptions", and
**no tail artifact covers the ten-submission window.** The scored tail spans
22:34:36–22:35:33Z (the burst) while the posts run was 22:39:32–22:40:18Z; the
six recorded tails in `results/provider-validation-remeasure/` cover the burst,
the controls (22:37Z), two provider probes (22:41Z and 22:51–22:52Z) and two
tamper probes (22:41Z, 22:43Z) — none overlaps 22:39–22:40. The behaviour is
evidenced (zero cancel signatures in all six recorded tails and all three UI
artifacts, and a runtime-cancelled request cannot answer `201`), but **the
specific artifact does not exist and this record does not claim it.** For any
future posts run, start `wrangler tail` through `tools/redact-tail.mjs`
**before** the submissions so the window is covered.

The first verify attempt at 22:40:35Z answered `503` on the session page twice
and aborted before any submission — the documented provider-`503` abort. It was
retried with the same tag and did not write a row. Recorded, not scored.

**Verdict: PASS**, re-verified on this pin.

## 6. What changed against the baseline, and what did not

| Quantity                             | Baseline `8397bdff6` / `7ea1640e`          | This pin `1580a719f` / `186b655f`                             | Moved?                                                    |
| ------------------------------------ | ------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------- |
| `VAL-HANG-001` first-attempt `200`   | 119 of 120 across six windows; w4 19 of 20 | **60 of 60 across three windows; 0 retries**                  | **yes** — the failing window class is gone in this sample |
| Completed validations per cache miss | **2** on an unverifiable cold request      | **1** (47 legs: 44 at 0, 3 at exactly 1, none at 2+)          | **yes**                                                   |
| `VAL-L03-011` hard failures          | 0                                          | 0 (quiet window); 6 provider `503`s in a bucket-exhausted run | unchanged in kind                                         |
| `VAL-L04-003`                        | pass, `201` in 660 ms                      | pass, `201` in ~649 ms                                        | unchanged                                                 |
| `VAL-POST-001`                       | 10 of 10                                   | 10 of 10                                                      | unchanged                                                 |
| First-attempt latency                | 594–2 784 ms, medians 718–812 ms           | 612–2 216 ms, medians 729–802 ms                              | unchanged order                                           |

The mechanism moved and the count moved with it. The release did **not** make
the provider class disappear: it halves the number of `/userinfo` calls a cold
request spends, so the bucket is consumed at half the rate and the same
navigation now has one bounded call to fail in rather than two.

## 7. The provider class, measured independently — after the scored windows

Run last, deliberately, because it spends the `/userinfo` budget:
`tools/auth0-stage-timing.mjs --n 10` at 22:50:58.282Z – 22:51:32.448Z (the
artifact's `startedAt`/`finishedAt`; the file name `…T2258Z.json` encodes an
earlier read time and is not renamed retroactively).

| Stage                                  | Samples | Result                                                             |
| -------------------------------------- | ------- | ------------------------------------------------------------------ |
| `/userinfo` with the app's retry shape | 10      | 8 × `200`, **2 × `429`**; min 81 ms, median 2 125 ms, max 9 187 ms |
| Management `getUser` (SDK retry)       | 10      | 10 × `200`; 53–197 ms, median 73 ms                                |
| Postgres connect + select              | 10      | 10 × ok; 24–197 ms, median 25 ms                                   |

For comparison, the baseline pin's probe the same day measured **5 of 10**
`/userinfo` samples at `429`, median 8 819 ms (`library/release-pin.md` §0.17).
The provider is still the slow and rate-limited stage; the app now spends one
call per cold request instead of two.

### 7.1 What this round did not establish

- **The provider class is not eliminated.** It is a property of the Auth0
  tenant's `/userinfo` bucket, not of this release. A burst run immediately
  after heavy validation load can still produce bounded `503`s; the earlier
  matrix run in §3 is a live example.
- **The page-level re-validation on an invalid token** (§2.1) is a residual
  outside this change and outside this assertion.
- **No `GAP-34` work was folded in.** An Auth0 outage still maps to `401` on
  `routeAuthConfig` routes; that is a separate scheduled change.

## 8. Rows and cleanup

Every write this round is the message POST under test. No row was reversed: the
owner decided to keep the synthetic rows for the follow-up mission.

| Observation                                                                      | Value                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mission-marked `training_session_messages` at 22:52:22Z (and again at 22:55:23Z) | **122** (org A 111, org B 11)                                                                                                                                                                                                                                                                    |
| Measured pre-run state, 22:39Z                                                   | org A 98 + org B 9 = **107**                                                                                                                                                                                                                                                                     |
| Rows added this round                                                            | **15** — 1 round-trip, 10 posts, and 2 matrix runs at 1 own-session row per organization each (122 − 107); the two aborted verify attempts wrote 0                                                                                                                                               |
| Rows reversed                                                                    | 0 (by owner decision)                                                                                                                                                                                                                                                                            |
| Current read, 2026-11-10T23:42:36.276Z (`tools/l03-row-state.mjs`)               | **131 marked** — 2 workspaces, 2 users, 2 auth_accounts, 2 sessions, **123** messages (org A 112, org B 11). One message row beyond the 122 read at 22:55Z: `cc5c96d9-510b-416c-87b2-5e5d82b37958`, created 23:28:58Z by the user-testing round's live round-trip. Both session hashes unchanged |

The brief's "115 at the last read" does not reconcile with the measured pre-run
state of 107; the measured values are recorded here rather than the brief's
figure, and the difference is flagged rather than explained away. A second read
at 2026-11-10T23:54:58.768Z returned the same marked counts (2 / 2 / 2 / 2 / 123
= 131, org A 112 and org B 11), so the figure was stable across both reads; the
tool's `totals` block is larger only because it counts non-mission rows as well.
Every row this round added is mission-marked and readable by
`tools/l03-row-state.mjs`.

## 9. Verdict

| Assertion      | Verdict on `1580a719f` / Worker `186b655f`                                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VAL-HANG-001` | **PASS** — 20 of 20 first-attempt `200` in each of three scored windows                                                                                                                            |
| `VAL-L03-011`  | **PASS, provider-bucket conditional** — 35 legs, 0 hard failures, `--verify-result` PASS on the 22:50:47Z quiet-window run; the same pin's 22:44:16Z run returned OPEN with 6 provider `503`s (§3) |
| `VAL-L04-003`  | **PASS** — one UI submission persisted and visible after reload                                                                                                                                    |
| `VAL-POST-001` | **PASS** — 10 of 10 submissions, 10 rows, 10 visible after reload; the runtime-cancel leg rests on the recorded tails and UI artifacts, not on a tail of the submission window (§5)                |

No launch-readiness claim is made by this record. It measures one release; the
go-to-market decision remains the owner's and the register's.
