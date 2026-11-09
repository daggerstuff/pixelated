# L03 identity and tenant boundary — reconciled on the fix release

**Package status: OPEN. Mission decision: NO-GO.** This record reports what two
independent matrix runs on the same release actually observed. It makes no
launch-readiness claim and counts no 5xx as a denial.

Reconciled 2026-11-09 by feature `l04-gap-register-and-blockers` from two runs on
the same pin:

- **Run 1** — the mission's fix-release re-measurement, feature
  `l04-and-l03-remeasure-on-fix-release`, artifact
  `<missionDir>/results/l03-tenant-matrix-2026-11-09T08-14-57-342Z.json`,
  generated 2026-11-09T08:14:57Z.
- **Run 2** — the independent fix-release user-testing round, flow report
  `validation/fix-release/user-testing/flows/l03-matrix.json`, artifact
  `<missionDir>/results/l03-tenant-matrix-2026-11-09T09-38-52-911Z.json`,
  generated 2026-11-09T09:38:52Z.

The defect class reproduces in both runs; the failing leg set does not. Both
observations are recorded and neither is presented as the fixed result.

## 1. Release under test

Read live with `./node_modules/.bin/wrangler deployments status --name
pixelated-empathy` (exit 0) immediately before each run, and re-read during this
reconciliation at 2026-11-09T09:46:54Z with wrangler 4.158.0. All three reads
returned the same version:

| Item                                    | Value                                                                 |
| --------------------------------------- | --------------------------------------------------------------------- |
| Commit SHA                              | `f475bcc4f920c0d4fc5ff07254328ed2fae5209d`                            |
| Commit subject                          | `fix(auth): do not cache an unresolved Management API lookup (#6643)` |
| Worker version                          | `a9d4e785-39b1-4197-816a-432618c4c40e` at **100%**                    |
| Worker version created                  | 2026-11-09T07:00:15.803Z                                              |
| Deployment created                      | 2026-11-09T07:00:18.058Z                                              |
| Staging `CI` on this SHA                | run `42575536849` — success                                           |
| Cloudflare deploy                       | run `42576201750` — success                                           |
| `origin/staging` HEAD at reconciliation | `f475bcc4f920c0d4fc5ff07254328ed2fae5209d` (matches)                  |

This release carries both M1c repairs (role resolution and the bounded pre-pool
deadline). The earlier L03 PASS was measured on `3bf2bf1b` / Worker `7315171c`
and is **not** restated here; this is a fresh run on the fix release.

## 2. What was run

```console
# run 1
$ node <missionDir>/tools/l03-tenant-matrix.mjs \
    --worker a9d4e785-39b1-4197-816a-432618c4c40e \
    --commit f475bcc4f920c0d4fc5ff07254328ed2fae5209d
exit=1   verdict: OPEN

# run 2
$ node <missionDir>/tools/l03-tenant-matrix.mjs \
    --worker a9d4e785-39b1-4197-816a-432618c4c40e \
    --commit f475bcc4f920c0d4fc5ff07254328ed2fae5209d
exit=1   verdict: OPEN
```

Result artifacts:

- `<missionDir>/results/l03-tenant-matrix-2026-11-09T08-14-57-342Z.json`
- `<missionDir>/results/l03-tenant-matrix-2026-11-09T08-14-57-342Z.md`
- `<missionDir>/results/l03-tenant-matrix-2026-11-09T09-38-52-911Z.json`
- `<missionDir>/results/l03-tenant-matrix-2026-11-09T09-38-52-911Z.md`

Offline gate checks, run without contacting production:

```console
$ node <missionDir>/tools/l03-tenant-matrix.mjs --self-test
self-test: 24 checks, 24 passed, 0 failed   (exit 0)

# run 1
$ node <missionDir>/tools/l03-tenant-matrix.mjs --verify-result \
    <missionDir>/results/l03-tenant-matrix-2026-11-09T08-14-57-342Z.json
recordedVerdict: OPEN
recomputed: 35 legs, passes 5, denials 14, exclusions 14, failures 0,
            defects5xx 2, noResponse 0, transient429 0, hardFailures 2
exit=1

# run 2
$ node <missionDir>/tools/l03-tenant-matrix.mjs --verify-result \
    <missionDir>/results/l03-tenant-matrix-2026-11-09T09-38-52-911Z.json
recordedVerdict: OPEN
recomputed: 35 legs, passes 4, denials 14, exclusions 14, failures 0,
            defects5xx 3, noResponse 0, transient429 0, hardFailures 3
exit=1
```

## 3. Sign-in through the real endpoint

A CSRF token was reused within each run; each organization signed in through
`POST /api/auth/signin` with `X-CSRF-Token` and `Origin:
https://pixelatedempathy.com`, into its own cookie jar under `/tmp/l03-jars/`.
No sign-in response body was stored; only `success`, `user.id`, and cookie names.

| Run | Organization | Attempt 1             | Attempt 2 | Final | `user.id`                         |
| --- | ------------ | --------------------- | --------- | ----- | --------------------------------- |
| 1   | org A        | `429` edge rate limit | `200`     | `200` | `auth0\|6af0f3f3a68ee520ba8e046b` |
| 1   | org B        | `200`                 | —         | `200` | `auth0\|6af0f3f48c63f77d31d9bc63` |
| 2   | org A        | `200`                 | —         | `200` | `auth0\|6af0f3f3a68ee520ba8e046b` |
| 2   | org B        | `200`                 | —         | `200` | `auth0\|6af0f3f48c63f77d31d9bc63` |

Run 1's org A `429` body was the edge shape (`Rate limit exceeded. Please try
again later.`, no `retryAfter`); it was retried after backoff and is recorded as
a transient observation, neither a denial nor a pass. Run 2 saw no `429`
(`transient429 = 0`). Both identities authenticated on this pin in both runs.

## 4. Matrix result — the bounded-503 defect class, per run

The matrix is 35 legs in both runs. The **verdict is OPEN in both**, and the
failure is a **defect class**, not a fixed reproduced leg set: an authenticated
session read can exceed the 8 s deadline and return a bounded `503`. Because the
deadline is a per-request race against the pre-pool stall, which legs land on it
varies between runs.

| Metric                          | Run 1    | Run 2    |
| ------------------------------- | -------- | -------- |
| Total legs                      | 35       | 35       |
| Pass                            | 5        | 4        |
| Denial (401/403/404 by design)  | 14       | 14       |
| Exclusion (documented 410)      | 14       | 14       |
| Failure (driver classification) | 0        | 0        |
| **5xx defects**                 | **2**    | **3**    |
| No response after retries       | 0        | 0        |
| Transient 429 (hard failure)    | 0        | 0        |
| **Hard failures**               | **2**    | **3**    |
| **Verdict**                     | **OPEN** | **OPEN** |

**Reading the artifact: `summary.noResponse` is not the first-attempt count.**
These measure different things and both are correct. `summary.noResponse` counts
legs whose **final** verdict is `NO_RESPONSE` — a leg that ended without any HTTP
response after its retries — and it is **0 in both runs**. The first-attempt
no-response count is a different field: the number of legs whose
`legs[].attempts[0].status` is `0` (a curl transport failure, exit 28) that a
backed-off retry then recovered. That count is **6 legs in run 1** and **5 legs
in run 2**; on the earlier `3bf2bf1b` measurement it was 10 of 35. A recovered
first attempt is neither a denial nor a pass, and quoting `summary.noResponse: 0`
as though it contradicted a first-attempt count of 6 or 5 is a category error.

The two runs agree on the exclusion counts and on the shape of every denial that
returned a response. They disagree only on which authenticated reads hit the
deadline:

| Run | Failing leg                             | Status |
| --- | --------------------------------------- | ------ |
| 1   | org B own training session GET          | `503`  |
| 1   | org B spoofed-owner GET foreign → org A | `503`  |
| 2   | org A cross-organization GET → org B    | `503`  |
| 2   | org B own training session GET          | `503`  |
| 2   | org B spoofed-owner GET own session     | `503`  |

The legs that differ between runs are the same defect seen from different
angles: in run 1, org B's spoofed-owner own-session GET returned `200` and its
spoofed-owner foreign GET returned `503`; in run 2, the own-session variant
returned `503` and the foreign variant returned `404`. Neither run's exact set
may be quoted as "the reproduced failure".

**Per-leg observation (both runs, as observed):**

| Phase           | Leg                                                      | Run 1                | Run 2                |
| --------------- | -------------------------------------------------------- | -------------------- | -------------------- |
| org A           | own training session GET                                 | `200`, own id        | `200`, own id        |
| org A           | spoofed owner GET own session                            | `200`, own id        | `200`, own id        |
| org A           | own message POST                                         | `201`, created a row | `201`, created a row |
| org A           | cross-organization GET → org B                           | `404`                | `503` (defect)       |
| org A           | spoofed `ownerId`/`therapistId` GET foreign              | `404`                | `404`                |
| org A           | cross-organization message POST                          | `404`                | `404`                |
| org A           | cross message POST with spoofed body owner               | `404`                | `404`                |
| org B           | own training session GET                                 | `503` (defect)       | `503` (defect)       |
| org B           | cross-organization GET → org A                           | `404`                | `404`                |
| org B           | spoofed owner GET own session                            | `200`, own id        | `503` (defect)       |
| org B           | spoofed owner GET foreign → org A                        | `503` (defect)       | `404`                |
| org B           | own message POST                                         | `201`, created a row | `201`, created a row |
| org B           | cross-organization message POST                          | `404`                | `404`                |
| org B           | cross message POST with spoofed body owner               | `404`                | `404`                |
| unauthenticated | 4 legacy GETs, snapshots GET, training GET, message POST | `401` each (7 legs)  | `401` each (7 legs)  |

**Exclusions are exclusions, not denials.** The five documented legacy
`/api/session/*` routes (`progress`, `skills`, `comparison`, `analytics`,
`snapshots`) answer every authenticated caller with `410` and serve no
organization's data. Two spoofed-parameter variants (a spoofed `therapistId` on
`skills` and on `comparison`) were also exercised. That is 5 base legs plus 2
spoofed-parameter variants per organization, 14 legs in total, all `410` in both
runs. They are counted as exclusions; they are not
authorization denials and must not be described as such.

`503` is the bounded deadline introduced by `ssr-hang-repair`
(`TRAINING_DATA_DEADLINE_MS = 8_000` in
`apps/web/src/lib/services/training/session-api.ts:29`). The fix converts a
runtime-cancelled hang into a fast, bounded response — it does **not** make the
load succeed. The validation contract states that a bounded 503 fails the leg,
so it is recorded as a 5xx defect, not as "responded, therefore fine".

### 4.1 Worker log signature for run 1's two 503s

`wrangler tail pixelated-empathy --format json` captured both:

```text
GET /api/training/sessions/<id>                       -> 503
GET /api/training/sessions/<id>?ownerId=…&therapistId=… -> 503
```

Both events carry the Redis DNS errors (`getaddrinfo ENOTFOUND
witty-buffalo-119990.upstash.io`), **no** `Database pool initialized` line, and
**no** `New client connected to database` line. The deadline fired before the
Postgres pool was reached, which is the same pre-pool stall the repair bounded.
Run 2 captured no tail, so its three 503s are evidenced by the status and the
generic body only.

### 4.2 "Database not connected" — what the string actually is

The log line `Failed to track security event {"error":"Database not connected.
Call connect() first."}` is emitted by the **MongoDB** security-event path
(`apps/web/src/lib/security/monitoring.ts:243`), not by the Postgres pool. It
appears on successful `200` requests too. In run 1's burst window (45
training-page document requests) it appeared on 43 requests without a
pool-initialized line in the same event, while 16 of 18 successful requests also
had no pool-init line (the pool is initialized once per isolate and the line is
not repeated).

Consequence for the contract wording: `Database not connected` without a
pool-init line is **not** by itself evidence of the hang. The decisive signature
remains a runtime-cancelled request
(`The Workers runtime canceled this request…`) or a 503 from the deadline, and
the absence of any successful database activity in the same request.

## 5. Row integrity and inventory

Method: the runner's `md5` over the session row
(`id|therapist_id|session_type|context|state`) and over message rows
(`id|therapist_id|content|created_at`, ordered by id), computed before, between,
and after the phases.

### 5.1 Run 1 before/after (historical, per that run)

| Item                | Before                             | After                              |
| ------------------- | ---------------------------------- | ---------------------------------- |
| Org A session hash  | `16c99c27c729d95ce741ded2e8596d91` | `16c99c27c729d95ce741ded2e8596d91` |
| Org A messages hash | `bf4b0bc59e03cc23c2d57a0d06d3791c` | `b4e9a46c4de08c79ce0bd1b5556b10bd` |
| Org A message count | 4                                  | 5                                  |
| Org B session hash  | `f520f64c6c53018fe13ac30a4e29fd46` | `f520f64c6c53018fe13ac30a4e29fd46` |
| Org B messages hash | `dd83a8c5e1bea2668089e6d3ef0ba862` | `c0b562fec7efb306b41da515911b1a0a` |
| Org B message count | 2                                  | 3                                  |

### 5.2 Current live inventory (read 2026-11-09T09:46:54Z)

`node <missionDir>/tools/l03-row-state.mjs` (read-only) returned:

| Item                | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| Org A session hash  | `16c99c27c729d95ce741ded2e8596d91` (unchanged)                                 |
| Org A messages hash | `8f875826a017bb5d870a3627a25236e5`                                             |
| Org A message count | **8**                                                                          |
| Org B session hash  | `f520f64c6c53018fe13ac30a4e29fd46` (unchanged)                                 |
| Org B messages hash | `2577c308602f130875decd1145ee7040`                                             |
| Org B message count | **4**                                                                          |
| Table totals        | `workspaces=3 users=4 auth_accounts=2 sessions=2 training_session_messages=12` |

Both session hashes are byte-identical to every earlier read, so no session row
moved. The baseline message rows are unchanged: org A baseline hash
`1e58a842f51041a13642fd6eaa251ca7` (1 row), org B baseline hash
`04f84612d59bab9bba7b7bf7598db0fb` (1 row). No row was deleted at any point.

**Every mission-marked row, attributed by id:**

| Row                                    | Org | Origin                                                      |
| -------------------------------------- | --- | ----------------------------------------------------------- |
| `44444444-4444-4444-8444-444444444444` | A   | baseline provision                                          |
| `166a01e7-0504-4048-8d5a-56b7a83fa5f7` | A   | an earlier feature's aborted matrix run                     |
| `14340d23-8d05-4dd0-8cb2-44d2da4f49da` | A   | L03 matrix probe on the previous release                    |
| `0524366f-8c68-4d6f-9b91-c97b9d3ee261` | A   | run 1's accidental no-argument driver invocation, 07:07:20Z |
| `9e6d77bc-2ebe-4d7e-8366-218efef99f2d` | A   | run 1 matrix own message POST                               |
| `26533bce-0bd3-4a70-b9f1-24ebf1d6fe9d` | A   | run 2 browser validator trainee message POST                |
| `428e4c8b-6188-473e-9288-622775604f07` | A   | run 2 browser validator trainee message POST                |
| `206d4e9b-0792-4f7a-842d-8d5e4ba7ea26` | A   | run 2 matrix own message POST                               |
| `88888888-8888-4888-8888-888888888888` | B   | baseline provision                                          |
| `2d246bb4-b087-4d9b-86da-d4d03a6ecd8a` | B   | L03 matrix probe on the previous release                    |
| `ce57ea79-401b-4c08-a9ff-6f218ef261dc` | B   | run 1 matrix own message POST                               |
| `f8f23927-ab87-4da4-910a-4608380031d2` | B   | run 2 matrix own message POST                               |

Count reconciliation against the earlier record: run 1 ended at org A 5 / org B
3 / total 8. Run 2's browser validator then added two org A trainee messages
(org A 5 → 7, total 10), and run 2's matrix added one own-message row per
organization (org A 7 → 8, org B 3 → 4, total 12). The earlier record's
`4 → 5 / 2 → 3 / 8` is correct **for run 1 only** and is not the current state.

- Session rows unchanged for both organizations: **true** in both runs.
- Foreign baseline message rows unchanged in both directions: **true** in both
  runs.
- Exactly one new own-message row per organization per matrix run, attributable
  to its own POST: **true**.
- No cross-organization write created a row.

## 6. Database identity — proven

The Worker returned rows that exist only in the provisioned database
(`ep-spring-firefly-a5ka84py`), read as each organization's authenticated owner.
Run 1: org A own GET `200` with `returnedSessionId=33333333-…`, org B
spoofed-owner own GET `200` with `sessionId=77777777-…`. Run 2: org A own GET
`200` with its own id, and both organizations' own message POSTs returned `201`
and created a row in their own session — the insert predicate requires the
session id and the resolved owner UUID to match, so a row cannot be created
without reading the provisioned session. Database identity is therefore proven
for both organizations across the two runs. The `503` legs are the deadline, not
a database mismatch.

## 7. Foreign content

Every recorded response body was checked for the foreign session id, user id,
workspace id, baseline message ids, and foreign message text: 0 occurrences in
both runs. Run 2 scanned all 35 recorded excerpts (the driver truncates bodies
to 600 characters) and found none; the three `503` bodies are the generic
`{"error":"Session temporarily unavailable"}` and contain no identifiers.

## 8. Verdict and next action

**L03 remains OPEN.** The tenant-boundary legs that returned a response behaved
as designed on both runs of the fix release: every own-session read that
completed returned `200` with the caller's own id; every cross-organization read
and write that completed was denied with no foreign content; the five documented
legacy routes returned `410` for both organizations (10 base legs) and the four
spoofed-parameter variants on them also returned `410` (4 further legs) — those
14 legs are **exclusions**, not denials; all 7 unauthenticated legs returned
`401`; foreign rows were unchanged and both session hashes byte-identical.

The package cannot close because, in each run, some authenticated reads returned
the bounded deadline `503` — a 5xx defect, not a denial and not a pass. Run 1
recorded 2 such legs and run 2 recorded 3, with the leg set varying between runs.
The contract requires zero hard failures.

The next smallest closure action is to make the authenticated training read
complete inside its deadline on this release (the pre-pool stall is bounded but
not eliminated) and re-run the same 35-leg matrix. No leg may be recorded as a
pass on partial evidence, and the per-run leg table in §4 must be re-derived from
the new run rather than copied.

## 9. Residual risk and cleanup

- **The failing leg set is not stable.** Any claim of the form "the matrix fails
  on legs X and Y" is only true for the run it came from. Cite the run artifact.
- **Run 2 has no Worker tail.** Its three `503`s rest on status plus body; the
  runtime-cancel signature was not re-observed there.
- **Pre-existing extra rows.** `166a01e7-…` (an earlier feature's aborted matrix
  run) and `0524366f-…` (run 1's accidental no-argument driver invocation) are
  mission-marked and removable. Both are attributed above; neither affects the
  integrity comparison because the matrix's before/after window starts after
  them.
- **Email-keyed upsert coalescing path (pre-existing identity-bridge risk).**
  `resolveIdentity()` upserts a `users` row keyed by email when no
  `auth_accounts` link exists (`apps/web/src/lib/auth/user-identity.ts:112-121`).
  A token that carries no email claim inserts `''`, which is UNIQUE, so two
  distinct Auth0 `sub`s could coalesce onto one internal user. The provisioned
  pilot identities carry explicit `auth_accounts` links, so they take the
  `findInternalIdBySub` path and are unaffected. This is pre-existing bridge
  behaviour shared with `auth0-middleware`; fixing it would be an unapproved
  auth change, so it is carried forward as a residual identity-boundary risk,
  not fixed here.
- **Legacy-route UUID validation gap (accepted exclusion, residual risk).** The
  legacy `/api/session/*` routes do not validate that `sessionId` is a UUID
  before querying, so a non-UUID value still produces PostgreSQL `22P02` → `500`.
  Their happy path is unreachable by design (every authenticated caller gets the
  documented `410` exclusion), but `/api/session/snapshots` is reachable and
  carries the same gap: an unvalidated non-UUID `sessionId` reaches `id = $1`
  and `500`s. Recorded when the analytics contract is defined; not fixed in this
  mission.
- **Dev- tenant naming.** Both synthetic identities live in
  `dev-f3vkhvb6n52y7fre.us.auth0.com`, which is the tenant the production Worker
  actually uses for sign-in. Its `dev-` name is an unresolved identity-boundary
  naming risk for the owners, not a defect of this release.
- **Transient first-attempt no-responses.** See §4: 6 (run 1) and 5 (run 2) legs
  had a first attempt with no HTTP response and recovered on retry, while
  `summary.noResponse` is 0 in both runs.
- **Cleanup.** Reversal order is messages → sessions → `auth_accounts` → users →
  workspaces → Auth0 users, via
  `<missionDir>/tools/reverse-l03-identities.mjs` (dry run first). No row was
  deleted by this record.

## 10. Tracker status (status-only updates)

Updated on 2026-11-09 by feature `l03-evidence-register-and-tracker`, and re-read
read-only during the final integrity pass at 2026-11-09T10:47Z. Status only: no
comment was posted, no issue was created by the tracker step, and no issue was
closed. Identifiers and URLs are unchanged.

| Record                                                                                                                                        | Before                                                          | After (live read)                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linear `PIX-4809` — Phase 3: Auth Consolidation (Sprint 4), `https://linear.app/pixelated/issue/PIX-4809/phase-3-auth-consolidation-sprint-4` | Triage; labels `linear-synced`, `priority:none`, `status/stale` | **In Progress**; labels **`linear-synced`, `priority:none`, `status/in-progress`** — the full live label list; `status/stale` removed; identifier and URL unchanged; no comment |
| GitHub `#1892` — Phase 3: Auth Consolidation (Sprint 4), `https://github.com/daggerstuff/pixelated/issues/1892`                               | OPEN; labels `linear-synced`, `priority:none`, `status/stale`   | OPEN; labels `linear-synced`, `priority:none`, `status/in-progress`; identifier and URL unchanged                                                                               |
| GitHub `#1767` — Approval checkpoint: ownership and RFC, `https://github.com/daggerstuff/pixelated/issues/1767`                               | OPEN; labels `linear-synced`, `priority:none`                   | **Unchanged**: OPEN with the same labels. Its RFC/ownership approvals are unrelated to L03 and unmet, so no status change would be truthful.                                    |

**PR-merge automation issue mirrors.** Three GitHub issues were created and
closed within 1–2 seconds during the mission window: `#6606`
(2026-11-08T20:45:00Z → 20:45:02Z), `#6608` (2026-11-08T21:36:29Z → 21:36:30Z)
and `#6612` (2026-11-09T00:23:58Z → 00:23:59Z). Each carries a
`linear-code[bot]` comment containing `<!-- linear-linkback -->` pointing at a
Linear issue (`#6606` → PIX-4892, `#6608` → PIX-4893, `#6612` → PIX-4895). They
are Linear↔GitHub integration mirrors created at PR creation/merge time, **not
issues this mission created**, and none of them touches the L03 source records or
claims readiness. They are recorded so that a strict reading of "no new issue is
created" is not surprised by them.
