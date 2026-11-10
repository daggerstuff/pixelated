# Availability and persistence re-measurement on the legacy-acquisition release — 2026-11-10

**Feature:** `availability-release-and-remeasure` (milestone
`availability-and-persistence-fixes`)
**Release under test:** `8397bdff6140d886af299762ddfaa10d892bfbfb` / Worker
`7ea1640e-d8d6-4cb2-9da5-56621309a851` at 100%
**Measurement window:** 2026-11-10T17:29Z – 17:46Z (six burst windows inside it;
see §2)
**Decision:** `VAL-L03-011`, `VAL-L04-003` and `VAL-POST-001` **pass** on this
pin. `VAL-HANG-001` **fails in one of six measured windows** and is recorded as
failed on the provider class (§2.2, §7.3). L03's matrix is now clean; the
availability bar is not uniformly met.

This record measures **one release**: the legacy-session acquisition wiring
(PR #6676) plus its unavailable mapping (PR #6677), merged together as #6677
(§1.1). No earlier pin is restated as current; earlier pins appear only in the
trend table in §7.4, labelled as trend.

## 1. Release under test

### 1.1 What was merged

| Step                    | Value                                                                                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR merged               | [#6677](https://github.com/daggerstuff/pixelated/pull/6677) `fix(session): map legacy client-acquisition failures to a retryable 503`                                                                                                                                                         |
| Head at merge           | `c7488f0d5411a03c0cf193c68f39e3df556d6556` (read again with `gh pr view`, not taken from the brief)                                                                                                                                                                                           |
| Head `CI` run           | `42861133771` (`pull_request`, `headSha` matching) — **success**, 17:04:33Z → 17:10:29Z                                                                                                                                                                                                       |
| Merge                   | `gh pr merge 6677 --squash` at 17:17:27Z → `8397bdff6140d886af299762ddfaa10d892bfbfb`                                                                                                                                                                                                         |
| PR closed as superseded | [#6676](https://github.com/daggerstuff/pixelated/pull/6676) `fix(session): acquire the legacy session routes' clients through the liveness probe`, closed 17:17:33Z, **not merged**, **no comment posted** (the reason is recorded here and in the handoff)                                   |
| Ancestry check          | `git merge-base --is-ancestor refs/remotes/pr/6676 refs/remotes/pr/6677` → exit 0, so #6676's head `1c1441738ae7bec2dab9b897d2ae5bd0898d7179` is the first commit of #6677; merging both would have re-applied the wiring on top of the squash                                                |
| Base check              | `git merge-base --is-ancestor origin/staging refs/remotes/pr/6677` → exit 0 at `42653d506…`                                                                                                                                                                                                   |
| Scope                   | **13 files**, +1 074 / −37: the five handlers (`progress`, `skills`, `comparison`, `analytics`, `snapshots`), `_legacy-surface.ts`, five files under `apps/web/src/pages/api/session/__tests__/`, and `progress-api`/`skills-api` under `apps/web/src/tests/api/session/`. Nothing outside it |

`mergeStateStatus` was `UNSTABLE`, which is the documented non-blocking set
(`AI PR Code Review`, `Quality` → `ai submodule strict ratchet`). The `CI`
workflow itself was green on the exact head.

### 1.2 Deploy and pin

| Item                                            | Value                                                                                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staging `CI` on the merge SHA                   | `42863424368` (event `push`) — **success**, 17:17:31Z → ~17:24Z                                                                                                                                                     |
| Deploy run                                      | `42864607424` (`workflow_run`, created 17:24:21Z) — **success**                                                                                                                                                     |
| Deploy job list (read, not inferred)            | `Detect app-facing changes` **success**, `Check deploy credentials` **success**, `Build Cloudflare bundle` **success**, `Deploy to Cloudflare` **success** — **none skipped**, so no `workflow_dispatch` was needed |
| Built SHA (both jobs, `git log -1 --format=%H`) | `8397bdff6140d886af299762ddfaa10d892bfbfb`                                                                                                                                                                          |
| Deploy log version line                         | `Current Version ID: 7ea1640e-d8d6-4cb2-9da5-56621309a851`                                                                                                                                                          |
| Active Worker version (live read)               | `7ea1640e-d8d6-4cb2-9da5-56621309a851`                                                                                                                                                                              |
| Traffic percentage                              | **100%** (single active version)                                                                                                                                                                                    |
| Worker version created                          | 2026-11-10T17:27:52.830Z                                                                                                                                                                                            |
| Deployment created                              | 2026-11-10T17:27:54.864Z                                                                                                                                                                                            |
| Wrangler CLI used for the read                  | `4.158.0` via `./node_modules/.bin/wrangler deployments status`                                                                                                                                                     |
| `origin/staging` HEAD                           | `8397bdff6…` at the 17:28Z read, the 17:47Z read and the 17:56Z read — the pin did not move through the window                                                                                                      |
| Health                                          | `https://pixelatedempathy.com/api/health` → **200** (1.43 s); apex `/` → **200** (2.91 s)                                                                                                                           |
| Tail `scriptVersion`                            | `7ea1640e-d8d6-4cb2-9da5-56621309a851` on **all 202** events of the main window and all **18** of the second                                                                                                        |

`www.pixelatedempathy.com` was not probed as a health claim: it answers 402 with
`x-vercel-error: DEPLOYMENT_DISABLED` because the Vercel standby account is
blocked. That is an environment condition, not a product regression.

### 1.3 What the merged change does

- **PR #6676 (first commit of #6677) — acquisition wiring.**
  `progress.ts`, `skills.ts`, `analytics.ts` and `snapshots.ts` called
  `getPool().connect()` directly, so the pooled-client liveness probe added by
  PR #6672 could not run on them. All five legacy handlers now import
  `acquireClient` and call it twice each (`rg -c acquireClient` → 3 on every
  handler at `origin/staging`, i.e. the import plus two call sites).
- **PR #6677 (second commit) — unavailable mapping.** Every handler catch maps
  `isQueryTimeout(error) || isDatabaseUnavailableError(error)` to
  `legacySessionRetryableResponse()` (`503` + `Retry-After`), so a failed
  acquisition can no longer answer `500`. The `42P01`/`42703` → `410` exclusion
  is unchanged.

## 2. VAL-HANG-001 — the 20-navigation authenticated bursts

Requirement: **20 of 20 HTTP `200` on the first attempt**, a bounded `503`
fails, a `/login` redirect counts against the twenty, at most one backed-off
retry per request. The pin is not stable across windows, so the burst was run
**six times** and is reported as six windows.

Harness: `tools/request-path-diag.mjs --mode burst --n 20`, a real sign-in
cookie for org A, twenty sequential document `GET`s of
`/training/session/33333333-…` with manual redirect following.

| Window (UTC start – end)       | First-attempt `200` | Final `200`    | Retries | First-attempt `503` | `/login` | First-attempt latency min / median / max |
| ------------------------------ | ------------------- | -------------- | ------- | ------------------- | -------- | ---------------------------------------- |
| w1 17:29:10.528 – 17:29:29.231 | **20 of 20**        | 20 of 20       | 0       | 0                   | 0        | 594 / 718 / 2 784 ms                     |
| w2 17:29:32.753 – 17:29:53.408 | **20 of 20**        | 20 of 20       | 0       | 0                   | 0        | 711 / 812 / 955 ms                       |
| w3 17:29:56.381 – 17:30:13.687 | **20 of 20**        | 20 of 20       | 0       | 0                   | 0        | 603 / 728 / 891 ms                       |
| w4 17:36:09.134 – 17:36:51.361 | **19 of 20**        | 19 of 20       | 1       | **1**               | **1**    | 640 / 734 / 5 048 ms                     |
| w5 17:44:20.534 – 17:44:39.744 | **20 of 20**        | 20 of 20       | 0       | 0                   | 0        | 684 / 782 / 1 574 ms                     |
| w6 17:45:37.679 – 17:45:56.119 | **20 of 20**        | 20 of 20       | 0       | 0                   | 0        | 677 / 760 / 950 ms                       |
| **All six**                    | **119 of 120**      | **119 of 120** | **1**   | **1**               | **1**    | —                                        |

Every successful leg in every window answered `session-200` with
`hasMessageInput: true` and `hasLoginForm: false`. The only leg above one second
outside w4 is the cold first leg of w1 (2 784 ms). Five windows used no retry at
all.

**Verdict: FAIL.** Five of six windows met the 20/20 bar; w4 did not. Under the
contract's own scoring a bounded `503` fails and a `/login` landing counts
against the twenty, so the assertion is not recorded as passed.

### 2.1 The w4 failure, exactly

| Leg  | First attempt         | Retry (one, backed off)                                                                                    |
| ---- | --------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1    | `503` at **5 048 ms** | `302` to `/login?redirect=%2Ftraining%2Fsession%2F33333333-…` at 6 984 ms, then `/login` `200` at 8 040 ms |
| 2–20 | `200` at 640–2 381 ms | not needed                                                                                                 |

Tail events for the same two requests: the `503` is `wallTime` **5 001 ms** and
carries **exactly two** completed validations (two
`Failed to track security event … Database not connected` lines — a validation
counter, not an error, per `library/verification-recipes.md` §16); the `302` is
`wallTime` **6 945 ms** and carries **three**. Two to three bounded Auth0
`/userinfo` calls at 2 500 ms each is the 5 s and 7 s shapes.

**The condition that produced it was induced by the operator.** w4 began at
17:36:09Z, about 70 seconds after this worker ran
`tools/auth0-stage-timing.mjs` (17:34:58Z, §7.3), which spent ten `/userinfo`
samples and received **5 × 429**. The tool's own doc says it adds load and
should run _after_ a burst; this window was deliberately run afterwards to
measure whether the provider class still reaches the page path. It does.

This is **not** the reused-socket class and **not** the deadline class: the
cross-tabulation (§6) shows `reused=0 new=0 connected=0 probeTrips=0
readTimeout=0 dbUnavailable=0` for all four failing page loads — they never
acquired a database client at all. It is the deferred provider class
(`validation-double-call-collapse`, §7.3).

## 3. VAL-L03-011 — the 35-leg tenant matrix

Harness: `tools/l03-tenant-matrix.mjs --worker 7ea1640e… --commit 8397bdff6…`,
driver log `matrix-run-8397bdff6.log`, result
`results/l03-tenant-matrix-2026-11-10T17-31-30-496Z.json` (+ `.md`). The verdict
is computed by the driver, not by hand. `--self-test` → **24 checks, 24 passed,
exit 0**.

| Summary field                                    | Value                               |
| ------------------------------------------------ | ----------------------------------- |
| `totalLegs`                                      | 35                                  |
| `passes` / `denials` / `exclusions` / `failures` | 6 / 15 / 14 / 0                     |
| `defects5xx`                                     | **0**                               |
| `hardFailures`                                   | **0**                               |
| `noResponse`                                     | 0                                   |
| `transient429`                                   | 0                                   |
| `unauthenticatedAll401`                          | true (all 7 legs)                   |
| `legacyRoutesIdentical410BothOrgs`               | **true**                            |
| `verdict`                                        | **PASS**                            |
| Driver exit code                                 | **0**                               |
| Offline `--verify-result` recomputation          | PASS, `hardFailures: 0`, exit **0** |

**Every leg, as recorded:**

| Phase           | Leg                                                                      | Status  | Class     |
| --------------- | ------------------------------------------------------------------------ | ------- | --------- |
| org-a           | own training session GET                                                 | 200     | PASS      |
| org-a           | cross-organization GET → org-b                                           | 404     | DENY      |
| org-a           | spoofed owner GET foreign → org-b                                        | 404     | DENY      |
| org-a           | spoofed owner GET own session                                            | 200     | PASS      |
| org-a           | own message POST                                                         | 201     | PASS      |
| org-a           | cross-organization message POST → org-b                                  | 404     | DENY      |
| org-a           | cross-organization message POST with spoofed owner → org-b               | 404     | DENY      |
| org-a           | excluded `/api/session/{progress,skills,comparison,analytics,snapshots}` | 410 × 5 | EXCLUSION |
| org-a           | spoofed `therapistId` on `/api/session/skills`, `/comparison`            | 410 × 2 | EXCLUSION |
| org-b           | own training session GET                                                 | 200     | PASS      |
| org-b           | cross-organization GET → org-a                                           | 404     | DENY      |
| org-b           | spoofed owner GET foreign → org-a                                        | 404     | DENY      |
| org-b           | spoofed owner GET own session                                            | 200     | PASS      |
| org-b           | own message POST                                                         | 201     | PASS      |
| org-b           | cross-organization message POST → org-a                                  | 404     | DENY      |
| org-b           | cross-organization message POST with spoofed owner → org-a               | 404     | DENY      |
| org-b           | excluded `/api/session/{progress,skills,comparison,analytics,snapshots}` | 410 × 5 | EXCLUSION |
| org-b           | spoofed `therapistId` on `/api/session/skills`, `/comparison`            | 410 × 2 | EXCLUSION |
| unauthenticated | five `/api/session/*` + training session GET + message POST              | 401 × 7 | DENY      |

- Own reads returned the caller's own id with content: org A
  `33333333-…` (85 messages at that read), org B `77777777-…` (8).
- Own message POSTs: org A `201`, row `f5457dda-5898-4dc5-a180-20afc39b3c10`;
  org B `201`, row `fb9449dd-cd6d-4284-b343-6440d6be9517`.
- `foreignContentFound` is false on all 35 legs.
- Both orgs signed in on the first attempt (`200`, `auth-token` cookie present);
  CSRF `GET` `200` on the first attempt.

**Row integrity (driver-computed, before → after):**

| Item                | Before                                  | After                                   |
| ------------------- | --------------------------------------- | --------------------------------------- |
| Org A session hash  | `16c99c27c729d95ce741ded2e8596d91`      | `16c99c27c729d95ce741ded2e8596d91`      |
| Org A messages hash | `7032697dc6028c1f26b3bce8df607221` (85) | `ba73162b3cce34af72eb50efb1e0bde0` (86) |
| Org B session hash  | `f520f64c6c53018fe13ac30a4e29fd46`      | `f520f64c6c53018fe13ac30a4e29fd46`      |
| Org B messages hash | `edc354041df7e35fa0a2f024f782caa3` (8)  | `2c7c4a4555df732bd02f473579c4105d` (9)  |

Each org gained exactly its own `201` probe row and nothing else; both session
rows are byte-identical.

**Verdict: PASS** — zero hard failures, zero 5xx, all five legacy routes answer
their documented `410` exclusion in both organizations, all unauthenticated legs
`401`, foreign rows unchanged.

**What moved against round 1 on the same harness:** 6 pass / 15 deny / 8
exclusion / **6 × 5xx** / 6 hard failures → 6 / 15 / **14** / **0** / **0**. The
six `503` legs did not disappear by being reclassified; they now return `410`,
which is why the exclusion count rose by exactly six.

## 4. VAL-L04-003 — one trainee message round-trip

Harness: `tools/ab-ui-posts.mjs --mode roundtrip`, one agent-browser session,
signed in through the real `/login` form as org A, artifact
`ui-roundtrip-8397bdff6-20261110T1735Z.json` (actual window 17:31:50–17:32:04).

| Step                   | Observed                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Sign-in                | attempt 1 landed `/dashboard` (no retry)                                            |
| Session page load      | `200` on attempt 1, message input present                                           |
| Submission             | `201` in **660 ms**, issued by a selector click, input cleared (`inputLenAfter: 0`) |
| Row id                 | `4448f28a-6cb1-429b-9afb-b55e7907cf30`                                              |
| Reload                 | `200` on attempt 1, 87 bubbles rendered                                             |
| Post-reload visibility | content `VAL-L04-003 20261110T1735Z roundtrip` **visible** (1 of 1)                 |
| Rows                   | 86 before → 87 after; `statusWithoutRow` 0, `rowWithoutStatus` 0                    |

**Verdict: PASS.**

## 5. VAL-POST-001 — ten consecutive message submissions

Scored from the `training_session_messages` read-back, not from the button
state. Harness `tools/ab-ui-posts.mjs --mode posts`, artifact
`ui-posts-8397bdff6-20261110T1739Z.json` (actual window 17:33:01–17:34:29).

| Step                                                  | Observed                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in                                               | attempt 1 answered **`429`** (the app's own edge limiter — tail log `Rate limit exceeded for anonymous at /api/auth/signin` at 17:33:03Z); retried with backoff, attempt 2 landed `/dashboard`. A `429` is recorded and retried, never scored |
| Session page load                                     | `200` on attempt 1                                                                                                                                                                                                                            |
| Submissions                                           | **10 of 10 `201`**; every one asserted a `POST …/messages (Fetch) 201` line before scoring                                                                                                                                                    |
| Rows                                                  | 87 before → **97** after; 10 new rows, one per submission                                                                                                                                                                                     |
| `statusWithoutRow` / `rowWithoutStatus` / `noRequest` | 0 / 0 / 0                                                                                                                                                                                                                                     |
| Reload (inline)                                       | `200` on attempt 1                                                                                                                                                                                                                            |
| Authoritative post-reload check                       | `--mode verify --verify-tag 20261110T1739Z` (`ui-verify-posts-8397bdff6-20261110T1741Z.json`, 17:34:34–17:34:43): **10 of 10 visible** in a 97-bubble transcript, reload `200` on attempt 1                                                   |

Row ids, in submission order: `79313f05-cfb7-4b32-8aa6-2afd5e7a1745`,
`a284eb0c-7de3-4ff5-8b56-29bdb7cb4c53`,
`14084f62-30f2-468f-8970-2b26ab752c04`,
`ea624e61-bbda-4368-8230-237c73b600ee`,
`755924ab-d544-4ecc-b90f-a81ec56dc7d6`,
`2391c9f5-d744-47c2-a246-d5ea63deeb40`,
`d4b44da8-6a44-475f-ac65-fe3c1f457764`,
`64ebd0ca-a304-4f04-865c-d4ced8112361`,
`bb64d2aa-6bcd-490f-95fe-732cabb8c087`,
`cb4da860-bb20-46fa-b5c3-75e61bd74764`.

Harness latency: 665, 7 489, 868, 660, 867, 654, 658, 657, 876, 656 ms. The
7 489 ms entry is the harness waiting about seven seconds for the coordinate
click before falling back to the JS `el.click()`; the request itself was ~1 s
and the artifact records `issued: selector-click + js-click-fallback`. The
authoritative request latency is the tail: **13 × `201` on
`/api/training/sessions`, 448–847 ms, median 577 ms**.

**One earlier attempt was aborted and wrote nothing.** Run
`ui-posts-8397bdff6-20261110T1737Z.json` (17:32:12–17:32:37) could not load the
session page: two consecutive `503`s at 5 001 ms (tail events 17:32:21Z and
17:32:30Z, two validations each). That is the provider class, not a submission
failure; no submission was issued and no row was written. It is recorded and not
scored.

**Verdict: PASS** — 10 of 10, a row each, 10 of 10 visible after reload, zero
runtime-cancelled.

## 6. The tail — acquire line, probe trip, and outcome cross-tabulated

Main capture: `tail-8397bdff6-20261110T1729Z.jsonl`, **202 events**,
17:29:10.729Z–17:44:38.382Z, `scriptVersion` `7ea1640e…` on every event.
Second capture: `tail-8397bdff6-20261110T1745Z.jsonl`, **18 events**,
17:45:37.816Z–17:45:55.452Z, all `200`, same `scriptVersion`. Cross-tabulation:
`tools/acquire-cross-tab.mjs` → `cross-tab-8397bdff6.json`.

Status histogram over the 202 events: `200` × 124, `404` × 33, `410` × 14,
`201` × 13, `401` × 12, `503` × 3, `302` × 1, `429` × 1, `null` × 1 (a client
abort). 136 training events; **97 probe trips** in the window.

| Route and outcome                     | n   | Wall min/median/max      | `Acquired …: reused` | `…: new` | New client connected | Probe trips | Recycle | Read timeout | `DatabaseUnavailableError` |
| ------------------------------------- | --- | ------------------------ | -------------------- | -------- | -------------------- | ----------- | ------- | ------------ | -------------------------- |
| `/training/session/*` **200**         | 86  | 502 / 698 / 1 568 ms     | 86                   | 86       | 86                   | **77**      | 0       | 0            | 0                          |
| `POST /api/training/sessions` **201** | 13  | 448 / 577 / 847 ms       | 2                    | 13       | 13                   | 11          | 0       | 0            | 0                          |
| `GET /api/training/sessions` **200**  | 4   | 893 / 1 216 / 1 273 ms   | 4                    | 4        | 4                    | 0           | 0       | 0            | 0                          |
| cross-org `404` (message/API)         | 8   | 840 / 889 / 1 330 ms     | 8                    | 8        | 8                    | 1           | 0       | 0            | 0                          |
| `/api/session/comparison` **410**     | 4   | 332 / 897 / 1 051 ms     | 2                    | 4        | 4                    | 2           | 1       | 0            | 0                          |
| `/api/session/skills` **410**         | 4   | 494 / 755 / 915 ms       | 2                    | 4        | 4                    | 2           | 0       | 0            | 0                          |
| `/api/session/analytics` **410**      | 2   | 565 / 672 / 672 ms       | 0                    | 2        | 2                    | 2           | 0       | 0            | 0                          |
| `/api/session/progress` **410**       | 2   | 515 / 923 / 923 ms       | 1                    | 2        | 2                    | 1           | 0       | 0            | 0                          |
| `/api/session/snapshots` **410**      | 2   | 568 / 965 / 965 ms       | 1                    | 2        | 2                    | 1           | 0       | 0            | 0                          |
| `/training/session/*` **503**         | 3   | 5 001 / 5 001 / 5 001 ms | **0**                | **0**    | **0**                | **0**       | 0       | 0            | 0                          |
| `/training/session/*` **302**         | 1   | 6 945 ms                 | **0**                | **0**    | **0**                | **0**       | 0       | 0            | 0                          |

How to read the `reused` / `new` columns: a page leg makes more than one
acquisition, so a leg that trips the probe logs
`Acquired database client: reused` →
`Pooled database client failed its liveness probe (300ms bound); destroyed it and acquired a replacement`
→ `New client connected` → `Acquired database client: new`. The columns count
legs that logged the line, not connections opened.

**The check this feature names — no failing leg may run on a reused client that
was neither probed nor replaced — holds.**

- Every one of the 86 successful page loads borrowed a pooled client, passed the
  probe or tripped it and got a replacement (77 trips), and answered `200` in
  502–1 568 ms (median 698 ms).
- The four failing page loads (3 × `503`, 1 × `302`) carry **no acquire line at
  all**: `reused=0`, `new=0`, `connected=0`, `probeTrips=0`, no read-timeout
  marker, no `DatabaseUnavailableError`. They never entered `acquireClient()`,
  so they did not run on a reused client and the probe had nothing to fix. Their
  failure is in the provider path (§7.3), not the database path.
- **The legacy routes are now on the probed path.** All five log acquire lines
  and probe trips (`skills` 2, `analytics` 2, `progress` 1, `snapshots` 1,
  `comparison` 2) and all five answer `410` in both organizations. In round 1
  four of them logged no acquire line and answered `503`.

**Tail silence and cancellation.** `tools/tail-silence-report.mjs`:
`events=202 withRedis=154 silence>=7500ms=0 ofWhichDeadline=0`. The 8 s silence
stays gone. The `exceptions` array is empty on all 202 events, and a grep for
`runtime canceled` / `would never generate a response` returns **0**;
`Training session load deadline exceeded` returns **0**. **Zero runtime-cancelled
requests.**

## 7. Attribution — three classes, recorded independently

D2 (the dead-Redis cache) was expected to cost ~10 ms typical and at most 1.5 s
worst case and **not** to move the burst; D3 (Postgres client acquisition) was
expected to move it. Latency and the `5xx` count are recorded as separate
quantities below. The Redis `getaddrinfo ENOTFOUND` line appears on 154 of 202
events, successes and failures alike, so it remains a constant condition and not
a discriminator.

### 7.1 Class 1 — the reused dead socket on `acquireClient()` paths: **removed**

86 of 86 successful page loads logged `reused` + `new` + `New client connected`,
with 77 probe trips; message `POST`s split the same way (11 trips of 13). The
probe destroys the dead socket before the caller's statement, and the leg
completes in 502–1 568 ms. Five of six burst windows were 20 of 20 first-attempt
`200`, and the sixth's failure is not this class.

### 7.2 Class 2 — the legacy direct-pool borrow: **removed**

The class that produced round 1's six `503`s at the 4 000 ms statement bound is
gone. All five handlers now call `acquireClient()` (three `acquireClient`
occurrences each at `origin/staging`), the tail shows acquire lines and probe
trips on all five routes, and the matrix returns `0 × 5xx` with all 14 legacy
legs at `410`. The `500` class that `249c558c4` produced and the `503` class that
`42653d506` produced are both absent.

### 7.3 Class 3 — the provider validation path: **survives, measured, not fixed**

This is the deferred feature `validation-double-call-collapse` and it is recorded
here as measured, never conflated with the reused-socket class.

- **Three page `503`s at exactly 5 001 ms**, each carrying **two** completed
  validations (two bounded `/userinfo` calls at 2 500 ms). Timestamps 17:32:21Z,
  17:32:30Z (the aborted posts attempt) and 17:36:13Z (burst w4 leg 1).
- **One page `302` to `/login` at 6 945 ms** carrying **three** completed
  validations (burst w4 leg 1's single retry).
- **Host-side stage probe** (`tools/auth0-stage-timing.mjs`, 10 samples,
  17:34:58Z, same tenant, same window): `userinfo_with_app_retry` — **5 of 10
  samples answered `429`** (`UserInfoError: Too Many Requests`), median
  **8 819 ms**, max 8 979 ms; the five that succeeded took 1 924–4 092 ms.
  `management_get_user_with_sdk_retry` stayed at 55–549 ms (10 of 10 `200`) and
  `postgres_connect_and_select` at 21–268 ms, so neither the directory nor the
  database is the slow stage — `/userinfo` is.
- **One `429` on `/api/auth/signin`** at 17:33:03Z, from the app's own edge
  limiter (`Rate limit exceeded for anonymous at /api/auth/signin`). That is not
  a provider `429` and not a credential problem; it was retried with backoff and
  the next attempt returned `200`.
- Five `401`s on `/api/auth/auth0-profile` are 3–5 ms pre-sign-in calls, not
  provider failures.

**What it costs on this pin.** It did not touch five of the six burst windows,
because the validated-session cache served those page loads. It did cost one
first-attempt `200` and one `/login` landing in w4, immediately after this worker
had spent the `/userinfo` budget on the stage probe. **A fix is out of scope
here and was not attempted.**

### 7.4 What moved, and what did not

| Quantity                           | Trend on earlier pins (never current)   | This pin `8397bdff6` / `7ea1640e`        | Moved?                                |
| ---------------------------------- | --------------------------------------- | ---------------------------------------- | ------------------------------------- |
| `VAL-L03-011` hard failures        | 13 → 7 → 12 → 6                         | **0**                                    | **yes**                               |
| `5xx` on legacy routes             | 7 × `500` → 6 × `503`                   | **0**                                    | **yes**                               |
| Legacy exclusions at `410`         | 8                                       | **14**                                   | yes (the six `503` legs became `410`) |
| `VAL-HANG-001` first-attempt `200` | 1/20 → 3/20 → 1–4/20 → 10/20 → 20/20 ×3 | **20/20 in 5 of 6 windows; 19/20 in w4** | no change from round 1                |
| First-attempt leg latency          | 4 001–4 018 ms on deadline legs         | 594–2 784 ms (medians 718–812)           | unchanged from round 1 (same order)   |
| Retries needed                     | 15–19 per burst → 0                     | **0 in five windows, 1 in w4**           | unchanged                             |
| `/login` redirects                 | 13 → 0                                  | **1 in w4 (provider class)**             | regressed in that window only         |
| `VAL-POST-001`                     | 3/10 → 5/10 → 10/10                     | **10/10**                                | unchanged from round 1                |
| Message `POST` latency (tail)      | 470–713 ms                              | 448–847 ms, median 577 ms                | unchanged                             |
| Silence ≥ 7 500 ms                 | 19 legs → 0                             | **0 of 202**                             | unchanged                             |
| Runtime-cancelled requests         | 0                                       | 0                                        | unchanged                             |
| Probe trips                        | 67 of 279 events                        | **97 of 202 events**                     | more legs on the probed path          |

**Two independent numbers, two independent statements.** The hard-failure count
moved **6 → 0** and the legacy-route class moved from `503` to `410`; the latency
of a successful leg did **not** move again (it was already 437–1 996 ms in round
1). The acquisition wiring is what closed the matrix; it did not change the
burst's per-leg latency, because the probe was already serving every other path.
The provider class is what produced the single failing burst window.

**What remains unattributed.** Nothing in the four assertions is left
unattributed. The one residual outside them is _why_ a peer closes the pooled
socket in the first place; that remains unattributed (a peer-side close, a
frozen-isolate socket and a middlebox are all consistent with the capture) and is
reported as unattributed, not as an environment blocker.

## 8. Rows this window wrote

All rows are synthetic, mission-marked, and reversible with
`tools/reverse-l03-identities.mjs`.

| Source                                   | Org A      | Org B      |
| ---------------------------------------- | ---------- | ---------- |
| Start of window (row-state, 17:18:54Z)   | 85         | 8          |
| Matrix own-write probes                  | +1 (`201`) | +1 (`201`) |
| Round-trip `T1735Z`                      | +1         | 0          |
| `VAL-POST-001` run `T1739Z`              | +10        | 0          |
| Aborted posts attempt `T1737Z`           | 0          | 0          |
| **End of window (row-state, 17:46:57Z)** | **97**     | **9**      |

Cross-org `POST` legs wrote nothing in either direction (each answered `404`).
Both session hashes are unchanged: `16c99c27c729d95ce741ded2e8596d91` (org A),
`f520f64c6c53018fe13ac30a4e29fd46` (org B).

**Total mission-marked row count for close-out cleanup:** **106**
`training_session_messages` rows, plus 2 `workspaces`, 2 `users`, 2
`auth_accounts` and 2 `sessions` — **114 mission-marked rows across the five
tables**. That is **+13** on this window: 13 message rows and no identity rows
(the provisioner was not re-run). Round 1 closed at 101; this window's close-out
figure is 114.

## 9. Artifacts

| File (under `results/availability-release-and-remeasure/` unless noted)           | What it holds                                                                                                          |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `burst-8397bdff6-20261110T1729Z-w1.json` … `…T1752Z-w6.json`                      | the six 20-navigation bursts, per-leg first and final chains with status and latency                                   |
| `l03-tenant-matrix-2026-11-10T17-31-30-496Z.json` / `.md` (in `results/`)         | the 35-leg matrix, per-leg bodies, and row-integrity hashes                                                            |
| `matrix-run-8397bdff6.log`, `verify-result-8397bdff6.txt`, `matrix-self-test.log` | driver output, the offline `--verify-result` recomputation (exit 0, PASS, 0 hard failures), and the 24-check self-test |
| `ui-roundtrip-8397bdff6-20261110T1735Z.json`                                      | the scored round-trip: `201`, row id, reload, post-reload visibility                                                   |
| `ui-posts-8397bdff6-20261110T1739Z.json`                                          | the ten-submission run with read-back and row ids                                                                      |
| `ui-posts-8397bdff6-20261110T1737Z.json`                                          | the aborted attempt: two provider `503`s on the page load, no submission, no row                                       |
| `ui-verify-posts-8397bdff6-20261110T1741Z.json`                                   | the authoritative post-reload visibility check (10 of 10, 97 bubbles)                                                  |
| `tail-8397bdff6-20261110T1729Z.jsonl`                                             | redacted tail over the main window (202 events)                                                                        |
| `tail-8397bdff6-20261110T1745Z.jsonl`                                             | redacted tail over the w6 window (18 events, all `200`)                                                                |
| `cross-tab-8397bdff6.json`                                                        | `tools/acquire-cross-tab.mjs` output behind §6                                                                         |
| `tail-silence-8397bdff6.json`                                                     | `tools/tail-silence-report.mjs` output (0 silences ≥ 7 500 ms)                                                         |
| `stages-8397bdff6-20261110T1743Z.json`                                            | `tools/auth0-stage-timing.mjs`: `/userinfo`, management `getUser` and Postgres stage timings at 17:34:58Z (§7.3)       |
| `row-state-final-8397bdff6.json`                                                  | final row counts and hashes (17:46:57Z)                                                                                |

The run tags in artifact names are labels; the authoritative times are the
`startedAt` / `finishedAt` fields inside each file.

## 10. Decision

| Assertion      | Requirement                                      | Measured on this pin                                                                                                                                       | Verdict  |
| -------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `VAL-HANG-001` | 20 of 20 first-attempt `200`                     | **20/20 in w1, w2, w3, w5, w6; 19/20 in w4** (one `503` at 5 048 ms, its single retry landed `/login`); 119 of 120 first-attempt overall, 0 runtime-cancel | **FAIL** |
| `VAL-L03-011`  | zero hard failures across 35 legs                | **0 hard failures** (6 pass, 15 deny, 14 exclusion, 0 × 5xx, 0 no-response, 0 transient `429`); driver verdict PASS, `--verify-result` exit 0              | **PASS** |
| `VAL-L04-003`  | one message persists and is visible after reload | `201` in 660 ms, row `4448f28a-…`, visible after a `200` reload                                                                                            | **PASS** |
| `VAL-POST-001` | ten consecutive successes with a row each        | **10 of 10** `201`, 10 rows, 10 of 10 visible after reload, 0 runtime-cancel                                                                               | **PASS** |

**The legacy-session wiring closed the matrix and did not close the availability
bar.** Routing the five handlers through `acquireClient()` plus mapping the
acquisition failure took `VAL-L03-011` from 6 hard failures to 0 and turned every
legacy leg into its documented `410`; the matrix is now reproducible end to end.
The burst's remaining failure is a different defect: two to three bounded
`/userinfo` validations per authenticated request, which the provider rate limit
turns into a 5 s `503` and, on its retry, a `/login` landing. That class is
recorded, attributed and **not fixed** here. No assertion is recorded as passed
without a reproduced measurement on this pin.
