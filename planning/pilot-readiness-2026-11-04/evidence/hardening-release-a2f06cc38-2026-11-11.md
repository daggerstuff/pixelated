# Hardening milestone: release `a2f06cc38` and re-measurement (2026-11-11)

Release record for the `hardening-and-named-defects` milestone's fix batch. This
is the first pin the milestone produced itself: the two earlier pins were merged
and deployed by a concurrent session while the milestone ran, and are recorded
in `library/release-pin.md` §0.19 and §0.20 rather than assumed away.

| Item                                | Value                                                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pin at feature start (live read)    | `99b44142783a985f4ed08579dceaf93a389ab25f` / Worker `1f1c7586-12a0-49f6-8418-f757e3500e49` (§0.20, the concurrent session's second intermediate pin) |
| **Pin this feature produced**       | **`a2f06cc38fe19f53c2788f79cfcff22d576dd5b1` / Worker `a6028a07-9534-4bcd-a9b8-47dc602d1dbc`** (§0.21)                                               |
| `origin/staging` HEAD at final read | `a2f06cc38fe19f53c2788f79cfcff22d576dd5b1` (this document was pushed on top of it as `e597fe6da`, docs-only, and did **not** redeploy the Worker)    |
| Worker traffic                      | **100%**                                                                                                                                             |
| Worker version created              | 2026-11-11T10:38:56.888Z                                                                                                                             |
| Deployment created                  | 2026-11-11T10:38:58.508Z                                                                                                                             |
| Pin read at                         | 2026-11-11T10:39:33Z, re-read 2026-11-11T10:53:20Z (unchanged)                                                                                       |
| Reader                              | `./node_modules/.bin/wrangler deployments status --name pixelated-empathy`, wrangler 4.158.0                                                         |

The pin was read **live before anything was merged**, not assumed to be
`1580a719f`. It returned §0.20's pin, so seven PRs were still open on top of it.

## 1. Merges, and the combined head

Seven milestone fix PRs were open at the start. Each was merged only after
reading **its own head** CI. All seven had green `CI` and `Quality`; the only
red was `Qodo Merge (PR-Agent)` on #6706/#6707/#6708/#6709/#6712, which is
infrastructure (`litellm.AuthenticationError: 401` through the Cloudflare AI
Gateway, `internalCode 2009`), not a finding.

| #     | Subject                                                   | Squash commit |
| ----- | --------------------------------------------------------- | ------------- |
| #6706 | first-login provider-email follow-up                      | `134226984`   |
| #6708 | provider outage is not a denial                           | `ae4a1e3be`   |
| #6711 | db knob guards + comment-aware build scanner              | `928ad7af3`   |
| #6710 | message POST idempotency, `MESSAGE_KEY_NAMESPACE` v1 → v2 | `ee449b20f`   |
| #6707 | faculty vocabulary + dead supervisor handler              | `040e30cb1`   |
| #6709 | one session validation per request                        | `cff23f463`   |
| #6712 | composer send-control hit target                          | `a2f06cc38`   |

**#6701 was already merged** as `45c4d9417` on the start pin and was not
re-merged. Its subject (the deleted `lib/middleware/csrf.ts` and the live
KV-backed CSRF path) was re-measured here, not re-merged.

**The #6709 conflict.** One conflict materialised, in the `apps/web/src/middleware.ts`
import block (lines 10–17), because #6708 and #6709 each added a named import
to the same region. It was resolved in the PR branch (worktree, branch
`mission/session-read-single-validation`), never by force-pushing `staging`, and
**both intents survived**: `PROVIDER_RETRY_AFTER_DEFAULT_SECONDS` +
`providerUnavailableResponse` from `./lib/auth/provider-unavailable` (#6708)
alongside `SESSION_VERDICT_LOCALS_KEY` + `validateSessionToken` from
`./lib/auth/session` (#6709). No hunk dropped either side. `index.astro` and
`session/[sessionId].astro` auto-merged. #6707's intents were re-verified after
the resolution (see VAL-L04-008). The resolved head ran 23 files / 335 tests
green across `lib/auth`, `pages/training` and `lib/middleware`, with oxlint
type-aware clean and oxfmt clean. #6712 merged `staging` cleanly twice (before
and after #6709) and needed no resolution.

**Combined-head check.** "Every PR is green on its own head" does not prove the
merged result is green, so staging CI was read on the resulting head before the
deploy was read:

| Item                             | Run           | Result                                                                                   |
| -------------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| Staging `CI` on `a2f06cc38`      | `43003930517` | **success** (`build-test`)                                                               |
| Staging `Quality` on `a2f06cc38` | `43003930578` | **success**, all 9 jobs                                                                  |
| Deploy run, first                | `43003953044` | conclusion **success**, `Build Cloudflare bundle` and `Deploy to Cloudflare` **skipped** |
| Deploy run, second               | `43004911424` | **success**, all four jobs ran                                                           |

`Quality`'s nine green jobs include `ai submodule strict ratchet`, which
confirms the `94a8deeb2` fix rather than the old "permanently red" reading.

**The skipped-deploy trap fired again.** Run `43003953044` concluded success
while its two decisive jobs were `skipped` (its triggering CI was cancelled by
the interleaved merges). It is **not** counted as a deploy. It was re-dispatched
(`gh workflow run deploy-cloudflare.yml --ref staging`) and `43004911424` then
ran `Check deploy credentials`, `Detect app-facing changes`, `Build Cloudflare
bundle` and `Deploy to Cloudflare` — all success. §0.20's pair
(`42966929123` / `42967587617`) is the first worked example of the same failure
mode.

## 2. Provider condition, as measured

Measured at 10:52Z, **after** every scored burst, because
`tools/auth0-stage-timing.mjs` spends the `/userinfo` budget. n = 10 per stage.

| Stage                            | min / median / max (ms) | Outcomes                 |
| -------------------------------- | ----------------------- | ------------------------ |
| `/userinfo` with app retry       | 62 / 82 / **8798**      | 9 × `200`, **1 × `429`** |
| Management `getUser` (SDK retry) | 46 / 73 / 185           | 10 × `200`               |
| Postgres connect + select        | 13 / 13 / 115           | 10 × `ok`                |

The `/userinfo` ceiling is real and was reached inside ten samples, with an
8.8 s tail. **The tenant was not touched**: the limit is the owner's action.
This is reported as the provider condition the measurements ran under, not as a
defect of this pin.

## 3. Assertion verdicts

Measured on `a2f06cc38` / Worker `a6028a07` unless stated otherwise. Every
status below is the status the command returned.

### VAL-IDENT-001 — First login produces a usable account — **PASS (live)**

The sub was put into the unmapped state deliberately: org A's
`auth_accounts` link was deleted (`linkDeleted: true`), leaving the user row
intact with no provider link.

| Step                                                              | Result                                                                         |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `POST /api/auth/signin` (attempt 1)                               | **200**, auth cookie set                                                       |
| `GET /api/training/sessions/33333333-3333-4333-8333-333333333333` | **200**, body keys `sessionId`, `clientProfile`, `difficultyLevel`, `messages` |
| `sessionIdInBody`                                                 | `33333333-3333-4333-8333-333333333333` — org A's own session                   |
| `messageCount` / `workspacePopulated`                             | 125 / `true`                                                                   |
| `auth_accounts` after                                             | one new row `8828b320-38b0-4580-a3f1-92d2a441c635`, same `provider_id`         |

No `403` loop: the unmapped sub signed in and reached its own trainee surface on
the first attempt. This is the live probe
(`library/first-login-provisioning-probe.mjs`), not a unit suite. The probe
restored the original link (`99999999-9999-4999-8999-999999999999`,
`auth0|6af0f3f3a68ee520ba8e046b`; `restored.rowCount: 1`).

Two observations, recorded rather than hidden:

- Provisioning sets `users.email_verified` to `false`. It was restored to `true`
  by SQL after the probe; the live value is `true` for both mission users.
- The first probe attempt answered signin **401** (a transient provider
  condition, consistent with the `/userinfo` 429 above) and was retried. The
  retry is the scored attempt.

### VAL-IDENT-002 — Two subs cannot coalesce on an absent email claim — **PASS (test + SQL)**

Focused test `apps/web/src/lib/auth/__tests__/user-identity-provisioning.test.ts`
— 10 cases, green on the deployed commit. Read-only SQL on the live database:

| `provider_id`                     | `user_id`                              | `workspace_id`                         |
| --------------------------------- | -------------------------------------- | -------------------------------------- |
| `auth0\|6af0f3f3a68ee520ba8e046b` | `22222222-2222-4222-8222-222222222222` | `11111111-1111-4111-8111-111111111111` |
| `auth0\|6af0f3f48c63f77d31d9bc63` | `66666666-6666-4666-8666-666666666666` | `55555555-5555-4555-8555-555555555555` |

Two distinct subs, two distinct users, two distinct workspaces. No coalescing.

### VAL-OUTAGE-002 — A provider outage is never a sign-out or a denial — **PASS (test for the outage mapping, live for the invalid-token half)**

Outage mapping is proven at test level, which is what the assertion's tool note
requires: `apps/web/src/lib/auth/__tests__/provider-unavailable-middleware.test.ts`,
14 cases, green on the deployed commit (503 + `Retry-After` per route class,
never `401`, never a `/login` redirect).

The invalid-token half was measured live so the two outcomes are visibly
distinct:

| Leg                                                         | Result                                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| invalid token, `GET /api/chat/messages` (`routeAuthConfig`) | **401** `No authorization header`                                                  |
| invalid token, `GET /training` (session-required page)      | **302** `Location: /login?redirect=/training`                                      |
| invalid token, `GET /dashboard`                             | **200** — renders signed out; `/dashboard` carries no page-level guard on this pin |

One **live provider-outage response was observed** while the bucket was
throttled (manual browser observation, 10:45Z): the body was
`Authentication is temporarily unavailable. Please retry shortly.` — the
plain-text 503 shape from `providerUnavailableResponse`, **not** a login
redirect and not a 401. The bucket recovered within the same minute and the same
cookie jar then returned `200` on the session page, `/dashboard` and `/training`.
The response headers were not captured, so the live `Retry-After` value is **not**
asserted from that observation; the header is proven at test level only.
`/sessions` is not scored as a page because no such page exists on this pin.

### VAL-AUTH-003 — One provider validation per cold request — **PASS (live, two UTC windows)**

Counted from `wrangler tail`, partitioned by `request.path`, using the tail line
`Failed to track security event` (emitted once per completed
`logSecurityEvent` in `validateToken`; MongoDB is unavailable on this pin, so
every completed validation logs exactly one).

Window 1, 2026-11-11T10:40:32.905Z → 10:40:38.740Z:

| Request                                       | Status | Wall   | Failed-track lines |
| --------------------------------------------- | ------ | ------ | ------------------ |
| `GET /api/auth/csrf`                          | 200    | 409 ms | 0                  |
| `POST /api/auth/signin`                       | 200    | 651 ms | **2**              |
| cold `GET /training`                          | 200    | 658 ms | **1**              |
| warm `GET /training` #1                       | 200    | 200 ms | 1                  |
| warm `GET /training` #2                       | 200    | 7 ms   | **0**              |
| invalid token, `GET /training/session/<uuid>` | 302    | 584 ms | **1**              |

Window 2, 2026-11-11T10:41:23.238Z → 10:41:28.801Z:

| Request                                       | Status | Wall                 | Failed-track lines |
| --------------------------------------------- | ------ | -------------------- | ------------------ |
| `GET /api/auth/csrf`                          | 200    | 324 ms               | 0                  |
| `POST /api/auth/signin`                       | 200    | 607 ms               | **2**              |
| cold `GET /training`                          | 200    | 543 ms               | **1**              |
| warm `GET /training` #1                       | 200    | 157 ms               | 1                  |
| warm `GET /training` #2–#6                    | 200    | 8 / 3 / 5 / 3 / 8 ms | **0 each**         |
| invalid token, `GET /training/session/<uuid>` | 302    | 581 ms               | **1**              |

| Leg                                  | Before (`1580a719f`) | After (`a2f06cc38`) |
| ------------------------------------ | -------------------- | ------------------- |
| cold `/training`                     | **2**                | **1**               |
| warm `/training`                     | 0                    | **0**               |
| invalid token on `/training/session` | **2**                | **1**               |

The partition is what makes this measurable: the whole-window count is 5 in
both windows, because the sign-in POST contributes 2 and is not a session
validation. A whole-file count would have overstated the session-page result.

**The first warm request still logs 1 in both windows**, at 200 ms and 157 ms
against 7–8 ms for the later ones. That is an isolate-boundary cache miss: a
fresh isolate performs the validation before its cache is warm. From the second
warm request on the count is 0, which is the assertion's warm requirement. This
is stated rather than smoothed out.

### VAL-CSRF-006 — The cookie double-submit module is wired or removed — **PASS**

`apps/web/src/lib/middleware/csrf.ts` is **deleted** (PR #6701, `45c4d9417`,
already on the start pin) and `git grep` finds no caller. The live KV-backed
contract still holds:

| Leg                                           | Result                                                              |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `GET /api/auth/csrf`                          | **200**, body carries `csrfToken` and `expiresAt` (token length 64) |
| `POST /api/auth/signin` with no token         | **403** `CSRF token required`                                       |
| `POST /api/auth/signin` with an invalid token | **403** `Invalid CSRF token`                                        |

### VAL-INPUT-001 — Malformed input is a 4xx, never a 5xx — **PASS (live)**

| Request                                                   | Status       | Body                                                                   |
| --------------------------------------------------------- | ------------ | ---------------------------------------------------------------------- |
| `GET /api/session/snapshots?sessionId=not-a-uuid`         | **400**      | `Invalid sessionId: expected a UUID`, `LEGACY_SESSION_INVALID_REQUEST` |
| `POST /api/session/snapshots` non-UUID                    | **400**      | `Invalid payload: require sessionId and up to 500 snapshots…`          |
| `POST /api/session/snapshots` invalid JSON                | **400**      | `Invalid JSON body`, `LEGACY_SESSION_INVALID_REQUEST`                  |
| `POST /api/session/snapshots` empty body                  | **400**      | `Invalid JSON body`, `LEGACY_SESSION_INVALID_REQUEST`                  |
| `GET /api/session/{progress,skills,comparison,analytics}` | **410** each | `LEGACY_SESSION_API_UNAVAILABLE`                                       |
| `POST /api/session/{progress,skills}` malformed           | **400** each | `LEGACY_SESSION_INVALID_REQUEST`                                       |

No leg produced a `5xx`, and no body leaked a Postgres error code or table name.
The `410` exclusion contract for the other four legacy routes is unchanged.

### VAL-POST-003 — The legacy POST never advertises a retry delay — **PASS (live + test)**

**No `Retry-After` header on any POST leg** — not on the identity-resolution
failure, not on the later malformed-payload failure — and none on the `410`
GETs either. The handler-level mapping and `resolveLegacyTherapistId()` agree;
`apps/web/src/pages/api/session/__tests__/legacy-surface.test.ts` (31 cases,
green) pins the identity-resolution branch that cannot be reached from outside
without a seeded mismatch.

### VAL-POST-002 — A retried submission produces exactly one row — **PASS (live retry half; test for the 503 ordering)**

Live, tag `VAL-POST-004 2026-11-11T10:42:40.798Z`: the same
`X-Message-Submission-Id` sent twice answered **201** twice and left **exactly
one** row (`7a8a5d6c-6a62-8c53-adbd-6c9957488f83`). The `503`-then-retry
ordering and "a late `INSERT` does not commit after the `503` was sent" are
proven at test level: `messages-deadline.test.ts` (8 cases) and
`messages-idempotency.test.ts` (14 cases), green on the deployed commit.

### VAL-POST-004 — A deliberate repeat is not a retry — **PASS (live, both halves)**

All three pairs sent in the same session within one measurement window
(10:42:40Z), entirely **after** the 10:38:58Z deploy.

| Pair                              | Submission identity                    | Rows                                        | Statuses |
| --------------------------------- | -------------------------------------- | ------------------------------------------- | -------- |
| deliberate repeat, identical text | two distinct `X-Message-Submission-Id` | **2** (`1ad9a67a…`, `5caa8b6b…`)            | 201, 201 |
| retry of one send action          | the **same** id twice                  | **1** (`7a8a5d6c…`)                         | 201, 201 |
| retry with no identity            | none                                   | **1** (`efd9fa43…`), payload-derived dedupe | 201, 201 |

Both halves are proven on the live pin: a retry persists one row **and** a
second deliberate send of identical text persists a second row. The first half
alone was already true before this change, which is why the pair is reported
together.

**The v1 → v2 namespace bump cost nothing in production.** `MESSAGE_KEY_NAMESPACE`
was introduced inside PR #6710 and bumped to `v2` on that branch: `1cfd9d96f`
rewrites `'training-message:v1'` to `'training-message:v2'` (the branch's other
named commit, `225a4e6f8`, only tidies the identity-bridge test assertions). The
PR landed on staging as one **squash commit**, `ee449b20f`, with a single parent
(`928ad7af3`) that contains no `training-message` literal at all — the squash
diff therefore adds the constant already at `v2`. Staging received `v2` only,
and the branch was never deployed to production, so there was never a live `v1`
to straddle: no send could be retried across a scheme change and the bump cannot
have produced a duplicate row. This corrects an earlier revision of this
section, which described the deploy as bounding a straddling-window duplicate;
that could not happen. Verified on `origin/staging`:

```console
$ git log -S "MESSAGE_KEY_NAMESPACE = 'training-message:v1'" --oneline origin/staging
$ # empty output — no commit on staging ever assigned a v1 namespace
$ git show ee449b20f^:apps/web/src/pages/api/training/sessions/'[sessionId]'/messages.ts | grep -c MESSAGE_KEY_NAMESPACE
0
$ git show 1cfd9d96f -- apps/web/src/pages/api/training/sessions/'[sessionId]'/messages.ts | grep -E "^[-+]const MESSAGE_KEY_NAMESPACE"
-const MESSAGE_KEY_NAMESPACE = 'training-message:v1'
+const MESSAGE_KEY_NAMESPACE = 'training-message:v2'
$ git log -S "training-message:v1" --oneline origin/staging -- apps/web
ee449b20f fix(training): make the message POST idempotent so a retry cannot double-write (#6710)
```

The last query returns exactly one commit — the squash commit that introduced
the idempotency helper and the `v2` constant together. The path filter is part
of the command because the unscoped form also matches the evidence documents
that quote the old string; it never matches a commit that shipped a `v1`
namespace. The bump is still worth keeping: a key derived under any future
scheme cannot collide with one derived here.

### VAL-UX-002 — The send control's click point is the send control — **PASS (live, pointer only)**

1440×900, `repeat8`, `elementFromPoint` at the centre of the send control:

| Cycle | `hit` before click              | POST status  | Rows persisted |
| ----- | ------------------------------- | ------------ | -------------- |
| 1–8   | `path` (the button's SVG child) | **201** each | 8              |

`hitIsButtonOrDescendant: true`, `gapButtonBottomToFooterTop: 16`, button top 679. Every cycle used a coordinate click, no `el.click()`, and every accepted
cycle persisted a row carrying the mission marker.

The 320×568 mobile leg is **supplementary and inconclusive**: at that viewport
the button sits below the fold (`hit: null` before scrolling, gap 243, the
document scrolls), the probe completed zero cycles, and it posted nothing. It is
not counted as evidence either way.

### VAL-CI-002 — The build-contract scanner ignores comments — **PASS**

`node scripts/ci/verify-build-contract.mjs` against three throwaway project
trees (the broken import sits under `apps/web/src/pages/` because the scanner
deliberately ignores relative imports from `apps/web/src/lib/` and
`apps/web/src/components/`):

| Fixture                                                     | Exit  | Last line                                                |
| ----------------------------------------------------------- | ----- | -------------------------------------------------------- |
| import-like text only in line, block, HTML and CSS comments | **0** | `✅ Build contract validation passed: imports resolved.` |
| the **same text as a real import** (non-vacuity pair)       | **1** | unresolved-import hint                                   |
| genuinely unresolved package import                         | **1** | unresolved-import hint                                   |

The second row is what makes the first meaningful: the comment case is not
passing because the file was skipped.

### VAL-DB-001 — The query-timeout knob cannot silently disable itself — **PASS**

| Input                | Resolved behaviour                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DB_QUERY_TIMEOUT=0` | `normalisePoolBound` returns `0` — the bound is **explicitly disabled**, documented at `apps/web/src/lib/db/index.ts:392–398` |
| negative             | normalised to `0` (disabled) rather than a truthy negative that would schedule `setTimeout(…, -N)` and fire on the next turn  |
| non-numeric          | `envInt` falls back to the default (`Number.isFinite` guard, `index.ts:289–294`)                                              |

Focused tests green on the deployed commit: `query-timeout-disable.test.ts`
(8 cases), `pool-option-contract.test.ts` (38), plus `query-timeout.test.ts`
(20), `acquire-timeout.test.ts` (14), `liveness-probe.test.ts` (7) and
`pool-recovery.test.ts` (8).

**Resolved configuration on the live Worker:** `wrangler secret list` shows
`DATABASE_URL`, `REDIS_URL`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN` and **no `DB_*` override**, and `wrangler.jsonc`'s
`vars` block carries only `DEPLOY_TARGET`, `NODE_ENV` and
`PILOT_EXCLUDED_SURFACE`. So `DB_QUERY_TIMEOUT_MS = 4_000`
(`index.ts:147`) is in force — positive, as the assertion requires.

### VAL-L04-008 — Faculty access uses one role name and no dead handler — **PASS**

- `userRole === 'admin'` is the single role name at
  `apps/web/src/pages/training/index.astro:109,184` and
  `apps/web/src/pages/training/session/[sessionId].astro:122`.
- `handleSupervisorIntervention` and `showSupervisorMessage` appear only inside
  the guard test `faculty-vocabulary.test.ts`; no runtime caller remains and no
  `id="supervisor-dashboard"` element exists.
- The faculty-review blocker survives the #6709 conflict resolution at
  `session/[sessionId].astro:611–622`.
- Browser, trainee surface: `#message-input`, `#send-message` and
  `#messages-container` present, 125 `.message-bubble`, title "Training Session -
  Synthetic Client A", body length 7976. **Console: no errors**, only the two
  expected log lines.

### VAL-UX-001 — An outage is not reported as a missing session — **PARTIAL: not-found live, outage at test level only**

**Not-found half, live:** `GET /training/session/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`
redirects to `/training?error=session-not-found`, which renders "That training
session could not be found. It may have been removed, or it may belong to
another account." The two states are distinguished in code, not by copy alone.

**Outage half, NOT live.** The in-page temporarily-unavailable surface could not
be induced on this pin without adding a production fault-injection control,
which the milestone forbids. `getTrainingSessionResponse` returns a `5xx` only
on a database-unavailable error or the 8 s deadline; a malformed or absent
session returns `404`. So the outage render is evidenced by the focused suite
only: `trainee-error-surface.test.ts`, 18 cases, green on the deployed commit
(cold load deadline → explicit temporary-unavailable message with a retry
control; absent session → not-found; "Pilot enrollment is not open" is not the
`503` response).

The one live `503` body observed on this pin
(`Authentication is temporarily unavailable. Please retry shortly.`) is the
**middleware's** plain-text provider-unavailable response, a different surface
from the page's in-page state. It is not counted as VAL-UX-001 evidence.

**Verdict:** the not-found half passes live; the outage half passes at test
level and is **not claimed as a live render**. This is reported as a limitation,
not reclassified as a pass.

## 4. Focused suites on the deployed commit

Run in a detached worktree at `a2f06cc38`, using `./node_modules/.bin/vitest`
(the worktree shares the primary tree's `node_modules`; no `pnpm` invocation).

| Scope                                                                                                                                                                                                                        | Files  | Tests    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| Milestone gate (`lib/auth`, `lib/middleware`, `lib/db`, `lib/services/training`, `lib/security`, `api/auth`, `api/session`, `api/training/sessions`, `pages/training`, `tests/api/session`, `tests/ci`, `redis-local-cache`) | **78** | **1109** |
| `pages/training/__tests__`                                                                                                                                                                                                   | 4      | 37       |
| `tests/ci`                                                                                                                                                                                                                   | 1      | 6        |
| `lib/db/__tests__`                                                                                                                                                                                                           | 9      | 134      |
| `api/training/sessions/__tests__`                                                                                                                                                                                            | 5      | 42       |
| `api/session/__tests__`                                                                                                                                                                                                      | 6      | 151      |
| `lib/auth` (3 assertion-owning suites)                                                                                                                                                                                       | 3      | 37       |
| `api/auth/__tests__/csrf.test.ts`                                                                                                                                                                                            | 1      | 4        |

All green, exit 0.

## 5. Row accounting (owner decision: keep the rows)

| Snapshot                 | UTC                      | Total messages | Mission-marked |
| ------------------------ | ------------------------ | -------------- | -------------- |
| Before any write         | 2026-11-11T10:17:06.996Z | **124**        | 124            |
| After the release window | 2026-11-11T10:51:51.453Z | **136**        | **136**        |

The +12 rows are the measurement's own writes: 8 from the VAL-UX-002 pointer
probe and 4 from the VAL-POST-004/VAL-POST-002 pairs. All 12 landed in org A
(org A 113 → 125; org B unchanged at 11). Every row carries the mission marker;
`training_session_messages` marked = total, so no unmarked row was created.

**No row was reversed.** The owner has decided to keep the mission-marked rows,
so this record does not delete them.

## 6. What this record does not claim

- It does not claim the `VAL-UX-001` outage render was observed live.
- It does not claim a live `Retry-After` value for the provider outage; the
  header is proven at test level only.
- It does not claim a straddling-window `v1`/`v2` duplicate for
  `VAL-POST-004`; `training-message:v1` existed only on the PR #6710 branch and
  never on `staging`, so it never reached production (see the namespace section
  above) and there was no straddle to duplicate.
- It does not claim `/sessions` as a rendered page; no such page exists.
- It does not claim a fix for the Auth0 `/userinfo` ceiling; that is the owner's
  action and the tenant was not touched.
- It does not treat the first deploy run `43003953044` as a deploy.

## 7. Artifacts

Raw measurement files live under
`<missionDir>/results/hardening-release-and-remeasure/`:

| File                                                                            | Contents                                |
| ------------------------------------------------------------------------------- | --------------------------------------- |
| `row-state-before-20261111.json`, `row-state-after-20261111.json`               | the two row snapshots                   |
| `tail-auth003-20261111T104005Z.jsonl`, `auth003-window-20261111T104005Z.json`   | window 1 tail and legs                  |
| `tail-auth003-w2-20261111T1042Z.jsonl`, `auth003-window-w2-20261111T1042Z.json` | window 2 tail and legs                  |
| `legacy-legs-20261111.json`                                                     | VAL-INPUT-001 / VAL-POST-003 legs       |
| `post-idempotency-20261111.json`                                                | VAL-POST-004 / VAL-POST-002 pairs       |
| `csrf-outage-legs-20261111.json`                                                | VAL-CSRF-006 and the invalid-token legs |
| `pointer-ux002-20261111.json`, `pointer-ux002-mobile-20261111.json`             | VAL-UX-002                              |
| `val-ident-001-20261111.json`                                                   | the first-login probe                   |
| `val-ci-002-20261111.json`                                                      | the three scanner fixtures              |
| `stage-timing-20261111.json`                                                    | the provider stage timings              |
| `provider-503-observation-20261111.json`                                        | the one live provider-503 body          |

The pin itself is recorded in `library/release-pin.md` §0.21, beside the two
concurrent-session intermediate pins (§0.19, §0.20) that this feature started
from.
