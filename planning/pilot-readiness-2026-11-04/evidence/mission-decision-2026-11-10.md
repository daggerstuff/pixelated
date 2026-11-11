# Pilot gate decision — L03/L04 gap-close verification, 2026-11-10

**Decision: NO-GO — re-derived from the 1580a719f measurements, not carried
forward.** The availability-and-persistence tier is **closed**: all four
assertions this phase opened with now pass on `1580a719f` / Worker `186b655f`,
including `VAL-HANG-001` at **60 of 60 first-attempt `200`** across three
windows, with the mechanism proven moved (one validation per cache miss, down
from two). The decision remains **NO-GO** because the pilot is now blocked by
conditions the availability work cannot close: the trainee-to-faculty journey
steps do not exist and were deferred by owner decision (the scenario catalog and
all clinical content are an owner blocker), the L02 standby origin is offline by
a billing soft block and its rollback rehearsal does not cross a migration, and
G1, G3 and G5 remain owner decisions or open. **No previously failing
availability assertion is still failing.** That is the change this record
records, and it is why the decision is a re-derivation rather than a restatement.

This record supersedes
[`mission-decision-2026-11-09.md`](mission-decision-2026-11-09.md) and replaces
the 2026-11-10 revision that restated NO-GO from `8397bdff6`. The `8397bdff6`
measurement is preserved in
[`availability-remeasure-8397bdff6-2026-11-10.md`](availability-remeasure-8397bdff6-2026-11-10.md)
as the measurement it was; nothing in it is restated as if taken on the current
pin.

## 1. Release under test

Every current number in this record was measured on one release. It was read
live during this pass, not taken from a brief.

| Item                          | Value                                                                                                                                                                                    | Source                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Commit built and deployed     | `1580a719f216ed7314dad0e8496eec17b5a88951`                                                                                                                                               | `gh run view 42914696184 --json headSha`; both deploy jobs logged `git log -1 --format=%H`            |
| Active Worker version         | `186b655f-093f-4224-86f1-b3e25646a3b7` at **100%**                                                                                                                                       | `./node_modules/.bin/wrangler deployments status --name pixelated-empathy` (wrangler 4.158.0, exit 0) |
| Worker version created        | 2026-11-10T22:30:33.588Z                                                                                                                                                                 | same read                                                                                             |
| Deployment created            | 2026-11-10T22:30:35.400Z                                                                                                                                                                 | same read                                                                                             |
| Staging `CI` on the exact SHA | `42913610181` (event `push`) — **success**                                                                                                                                               | `gh run view 42913610181`                                                                             |
| Deploy run                    | `42914696184` (event `workflow_run`) — **success**; `Detect app-facing changes`, `Check deploy credentials`, `Build Cloudflare bundle`, `Deploy to Cloudflare` all ran, **none skipped** | `gh run view 42914696184 --json jobs`                                                                 |
| Health, apex                  | `https://pixelatedempathy.com/api/health` → **200** (1.50 s); apex `/` → **200** (1.34 s)                                                                                                | `curl -s -o /dev/null -w '%{http_code}'`, re-run 2026-11-10T23:41Z                                    |
| Health, `www`                 | **402**, `x-vercel-error: DEPLOYMENT_DISABLED` — the Vercel standby is blocked; only the Worker apex serves                                                                              | same command                                                                                          |
| `origin/staging` HEAD         | `1580a719f…` — the pin did not move through the measurement window                                                                                                                       | `git rev-parse origin/staging`                                                                        |

Evidence record for this measurement:
[`availability-remeasure-1580a719f-2026-11-10.md`](availability-remeasure-1580a719f-2026-11-10.md)
(commit `5b0fd04c3`, corrected in this pass). Canonical pin record:
`library/release-pin.md` §0.18. Raw artifacts live under
`<missionDir>/results/provider-validation-remeasure/` and the two matrix results
`results/l03-tenant-matrix-2026-11-10T22-44-16-978Z.json` (OPEN) and
`results/l03-tenant-matrix-2026-11-10T22-50-47-128Z.json` (PASS).

## 2. Each previously failed assertion, on the release it was measured on

`VAL-HANG-001`, `VAL-L03-011` and `VAL-POST-001` are the assertions that failed
at the start of the gap-fix phase. `VAL-L04-003` passed on some pins and failed
on others; it is included because the phase's persistence tier owned it. Every
row states the pin the current verdict was measured on and links the artifact.

| Assertion      | Previously (pin, result)                                                                                                                                                           | Now (pin, result)                                                                                                                                                                                        | Verdict                               | Evidence                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `VAL-HANG-001` | `db9b63ed1` / `2207d7a1` — 5 of 20 first attempt (10 of 20 final) at the phase start; `8397bdff6` / `7ea1640e` — **119 of 120** first-attempt `200`, w4 19 of 20, `503` → `/login` | `1580a719f` / `186b655f` — **60 of 60** first-attempt `200` in three windows, 0 retries; mechanism 2 → 1 validation per cache miss                                                                       | **PASS**                              | [`availability-remeasure-1580a719f-2026-11-10.md`](availability-remeasure-1580a719f-2026-11-10.md) §2, §2.1 |
| `VAL-L03-011`  | `db9b63ed1` / `2207d7a1` — FAIL, 13 hard failures at the phase start; `8397bdff6` / `7ea1640e` — PASS, 0 hard failures                                                             | `1580a719f` / `186b655f` — 35 legs, 0 hard failures on the 22:50:47Z quiet-window run; the same pin's 22:44:16Z run returned OPEN with 6 provider `503`s                                                 | **PASS, provider-bucket conditional** | same record §3; both matrix JSONs cited there                                                               |
| `VAL-L04-003`  | `db9b63ed1` / `2207d7a1` — PASS at the phase start; `8397bdff6` / `7ea1640e` — PASS                                                                                                | `1580a719f` / `186b655f` — `201` in ~649 ms, row `6eb21b08-…`, visible after reload (99 bubbles)                                                                                                         | **PASS**                              | same record §4                                                                                              |
| `VAL-POST-001` | `db9b63ed1` / `2207d7a1` — 3 of 10 at the phase start; `8397bdff6` / `7ea1640e` — PASS, 10 of 10                                                                                   | `1580a719f` / `186b655f` — 10 of 10 `201`, 10 rows (99 → 109), 10 of 10 visible after reload; 7 of 10 used the JS click fallback; runtime-cancel leg has no tail of the submission window (stated in §7) | **PASS, with one evidence-item gap**  | same record §5                                                                                              |

**No previously failed assertion is still failing.** The only condition attached
to a pass is `VAL-L03-011`'s provider-bucket sensitivity, and it is a stability
property of the Auth0 tenant, not a missing measurement: both same-pin runs are
recorded and the failing one is a disclosed defect finding, never a denial or a
pass.

## 3. The trend — the core evidence, with the new pin appended

Each row is the verdict measured on that pin. Only the last row is the current
claim; the earlier rows are trend and are never restated as current.

| Pin / Worker                 | `VAL-L03-011`                                                                                               | `VAL-L04-003` | `VAL-POST-001`      | `VAL-HANG-001`                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------- | ------------------- | ----------------------------------------- |
| `db9b63ed1` / `2207d7a1`     | FAIL — 13 hard failures                                                                                     | PASS          | 3 of 10             | 5 of 20 first attempt (10 of 20 final)    |
| `f811440d6` / `af615b73`     | FAIL — 8 hard failures                                                                                      | PASS          | 5 of 10             | 1 of 20 first attempt                     |
| `a24ab11d9` / `e9aed1a4`     | FAIL — 7 hard failures                                                                                      | PASS          | 5 of 10             | 3 of 20 first attempt                     |
| `249c558c4` / `7542a5d3`     | FAIL — 12 hard failures                                                                                     | PASS          | 5 of 10             | 1 of 20 first attempt (5 of 20 at 15:25Z) |
| `42653d506` / `0f3d77e6`     | FAIL — 6 hard failures (legacy direct-pool borrows)                                                         | PASS          | 10 of 10            | PASS — 20 of 20 in three windows          |
| `8397bdff6` / `7ea1640e`     | PASS — 0 hard failures                                                                                      | PASS          | PASS — 10 of 10     | FAIL — 119 of 120                         |
| **`1580a719f` / `186b655f`** | **PASS, provider-bucket conditional — 0 hard failures (quiet run); 6 provider 503s (earlier same-pin run)** | **PASS**      | **PASS — 10 of 10** | **PASS — 60 of 60 across three windows**  |

Three statements follow, and each is load-bearing:

1. **The availability bar moved and then held.** It went from 1–5 of 20
   first-attempt on four consecutive pins, to 20 of 20 in three windows on
   `42653d506`, back to 119 of 120 on `8397bdff6` (one window reached by the
   provider class), and to **60 of 60** on `1580a719f`. The `8397bdff6` failure
   was the deferred double-validation: a cold request that could not be verified
   paid two `/userinfo` calls, spending two of the tenant's ten-request budget
   and two 2 500 ms bounds.
2. **The mechanism moved, not just the count.** On `1580a719f`, 47 captured
   session-page legs split **44 at zero completed validations (cache hit), 3 at
   exactly one (the cold first leg of each window), 0 at two or more**. The
   before-number was two. A signature-tampered token on `/admin/dashboard`,
   which the middleware redirects before the page renders, completed exactly one
   validation in two samples where the pre-collapse branch paid two.
3. **`VAL-L03-011` closed by fixing the cause it named, and it is conditional.**
   The six failures on `42653d506` were legacy handlers borrowing straight from
   the pool; PR #6677 routed all five through `acquireClient()` and mapped a
   failed acquisition to a retryable `503`, and the hard-failure count went
   6 → 0. On `1580a719f` the quiet-window run is clean, but the earlier run on
   the same pin returned OPEN with six provider `503`s after the `/userinfo`
   bucket was spent. Collapsing the double call **halved the budget spend per
   cold request; it did not remove the ceiling.**

## 4. What the new pin changed, and what it did not

| Quantity                             | `8397bdff6` / `7ea1640e` | `1580a719f` / `186b655f`                            | Moved?            |
| ------------------------------------ | ------------------------ | --------------------------------------------------- | ----------------- |
| `VAL-HANG-001` first-attempt `200`   | 119 of 120, six windows  | **60 of 60, three windows, 0 retries**              | **yes**           |
| Completed validations per cache miss | 2                        | **1** (47 legs: 44 at 0, 3 at 1, none at 2+)        | **yes**           |
| `VAL-L03-011` hard failures          | 0                        | 0 (quiet run); 6 provider `503`s (bucket-spent run) | unchanged in kind |
| `VAL-L04-003`                        | `201` in 660 ms          | `201` in ~649 ms                                    | unchanged         |
| `VAL-POST-001`                       | 10 of 10                 | 10 of 10                                            | unchanged         |
| First-attempt latency                | 594–2 784 ms             | 612–2 216 ms, upper medians 802 / 729 / 754 ms      | unchanged order   |

The release did **not** make the provider class disappear. It halves the number
of `/userinfo` calls a cold request spends, so the bucket is consumed at half
the rate and the same navigation now has one bounded call to fail in rather than
two. The independent stage probe (run last, after every scored window and the
matrix, at **22:50:58.282Z – 22:51:32.448Z** per the artifact's
`startedAt`/`finishedAt`) measured **2 of 10** `/userinfo` samples at `429`,
median 2 125 ms, max 9 187 ms, against 5 of 10 on the baseline pin.

## 5. The decision, derived

The decision is a gate decision, not an availability score. All four
availability-and-persistence assertions pass; the gates still do not.

| Gate / package | Status after this pass                | Why it still blocks a pilot                                                                                                                                                                                                                           |
| -------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G2 / L03       | **PASS, provider-bucket conditional** | Nothing left to prove on the boundary; the condition is an Auth0 tenant budget, carried and disclosed.                                                                                                                                                |
| G2 / L04       | **OPEN**                              | `VAL-L04-003` and `VAL-POST-001` pass and `VAL-HANG-001` passes, but approved session creation, the scenario catalog, synthetic-client replies, transcript-grounded coaching and faculty review do not exist. Deferred by owner decision, not passed. |
| G2 / L02       | **OPEN**                              | The standby origin is offline by a billing soft block; the four-repo commit manifest and the incident linkage are missing; no rollback has crossed a migration.                                                                                       |
| G1 / L01       | **OWNER DECISION**                    | Buyer, program, named owners, skill, scenarios, rubric, measures and stop thresholds are not accepted.                                                                                                                                                |
| G3 / L09, L15  | **OPEN**                              | The exact pilot bundle, a broad fresh evaluation, rights and the release decision are missing; the public-claims copy pass is not deployed.                                                                                                           |
| G5             | **OPEN / OWNER DECISION**             | Production still serves claims no artifact supports; product/commercial approval is missing.                                                                                                                                                          |
| G6             | **NOT STARTED**                       | Requires an authorized, completed pilot.                                                                                                                                                                                                              |

Stated plainly: **the availability work is done and the pilot is still not
authorized.** The NO-GO is now carried by the journey content, the owner
decisions, the standby origin, the evaluation/release bundle and the public
claims — not by a 503 count. A reader who compares this record with the previous
revision should see the difference in what blocks it, not merely the same verdict
with a newer pin.

## 6. What would change the answer

Only the conditions below would. The availability numbers would not: they pass,
and re-running the burst cannot flip the decision either way.

1. **The deferred journey steps built and measured** — session creation, an
   owner-approved scenario catalog, synthetic-client replies, transcript-grounded
   coaching, retry/attempt record and faculty review. Each needs its owner
   decision first (Faculty/clinical education; the scenario catalog and clinical
   content are the owner's, never the engineer's).
2. **L02 closed** — the Vercel invoice paid and the standby origin restored (or
   an owner decision that retires it), the four-repo commit manifest and the
   PIX-4751/4795/4814 incident linkage recorded, and a migration-crossing
   rollback rehearsed when a release ships a migration.
3. **G1 closed** — a signed scope and named owners.
4. **G3 closed** — the exact pilot bundle frozen, a broad fresh evaluation, the
   tool boundary, rights and a promote/hold decision.
5. **G5 closed** — the public-claims copy pass deployed and every remaining claim
   approved by product/commercial, including the HIPAA/BAA text.

The `VAL-L03-011` condition has its own owner action: reduce the `/userinfo`
budget further or raise the Auth0 tenant limit. Neither is a code change this
mission can make, and neither is required for the L03 verdict as recorded.

## 7. Evidence gaps and observations, stated where they exist

1. **`VAL-POST-001`'s runtime-cancel artifact does not exist.** The contract asks
   for "the tail showing zero runtime-cancel exceptions". The scored tail spans
   22:34:36–22:35:33Z while the posts run was 22:39:32–22:40:18Z, and none of the
   six recorded tails overlaps that window. The six tails cover the burst, the
   controls (22:37Z), two provider probes (22:41Z and 22:51–22:52Z) and two
   tamper probes (22:41Z, 22:43Z). The behaviour is evidenced — zero
   cancel signatures in all six tails and all three UI artifacts, and a
   runtime-cancelled request cannot answer `201` — but **the specific artifact is
   absent and this record does not claim it**. For any future posts run, start
   `wrangler tail` through `tools/redact-tail.mjs` **before** the submissions.
2. **The send control is covered at its click point.** The session page's
   `#send-message` is occluded by `<footer.footer>` at the point a pointer click
   would land. Submissions 2 and 5–10 (7 of 10) therefore used the harness's JS
   `el.click()` fallback; submissions 1, 3 and 4 used the pointer path.
   Submission 2 answered `201` in 6 992 ms and the other six fallback
   submissions in 646–654 ms. **A pointer click at the button's click point is
   refused as covered, which is an observation a human trainee could meet.** The
   JS fallback is why all ten still answered `201`; the persistence path works,
   the visual affordance is obstructed. It is recorded as a product observation,
   not scored as a pass for the pointer path.
3. **`VAL-L03-011` is provider-bucket conditional.** Both same-pin matrix runs
   are cited in §2 and in the register row. The status vocabulary has no
   conditional value, so the condition travels in prose.
4. **The page-level re-validation on an invalid token is a residual.** A
   `/training/session` load with an invalid token still totals two validations
   (middleware 1 + the page's own `getSession` 1). It is off the
   `VAL-HANG-001` path because a `provider-unavailable` verdict returns `503`
   from the middleware before `next()` runs. Recorded for the next round, not
   claimed fixed.
5. **GAP-34 is still open.** An Auth0 outage still maps to `401` on
   `routeAuthConfig` routes and to "unauthenticated" on `/dashboard` and
   `/sessions`. It is reachable now that `apps/web/src/lib/auth/**` is granted,
   but it is a different behaviour change and was not folded into the collapse.

## 8. Scope reduction — the hardening and journey tiers were deferred by owner decision

This mission now covers only the request-path fix chain and this record. On
2026-11-10 the owner moved the **hardening** and **journey-scaffolding**
milestones to a follow-up mission. Their **nine features are cancelled** and
their **seven assertions were removed** from `validation-contract.md` and
`validation-state.json`; the full text of both is preserved verbatim in
`<missionDir>/research/followup-mission-2026-11-10.md`.

- The hardening tier was **deferred**, not omitted, not passed, and not silently
  dropped. The trainee-facing `503` message, `400`-for-malformed-input,
  first-login provisioning, the email-keyed upsert risk, the CSRF middleware
  decision, the faculty role vocabulary and the duplicate Management lookup are
  all still open.
- The journey-scaffolding tier was **deferred** for the same reason, and it could
  not have completed here at all: the scenario catalog and all clinical content
  are an owner blocker.
- **No assertion that is no longer in the contract is claimed here.**

## 9. The six factual corrections applied to the 1580a719f evidence record

Scrutiny found six defects in
[`availability-remeasure-1580a719f-2026-11-10.md`](availability-remeasure-1580a719f-2026-11-10.md).
All six are corrected in that file; none changes a verdict or an aggregate.

| #   | Defect                                                                                                      | Correction applied                                                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a   | The per-window mechanism table's rows did not sum to its own totals (17+16+16 = 49, 16+15+15 = 46)          | Rows corrected to w1 17/16/1, w2 15/14/1, w3 15/14/1; the 47 / 44 / 3 aggregate and every verdict were already correct                                                                                                                                                                                                                           |
| b   | "The only leg above one second is the w1 cold first leg (2 216 ms)"                                         | Now says **two** legs exceeded one second: the w1 cold first leg (2 216 ms) and burst w2 request index 2 (1 172 ms), which is not a cold first leg                                                                                                                                                                                               |
| c   | "Rows added this round 13" contradicted 122 − 107 and its own components                                    | Corrected to **15** (1 round-trip + 10 posts + 2 matrix runs × 1 own-session row per org); the absolute 122 is unchanged                                                                                                                                                                                                                         |
| d   | The Auth0 stage probe was recorded at 22:58Z in four places                                                 | Corrected to **22:50:58.282Z – 22:51:32.448Z** in the evidence record, `library/release-pin.md` §0.18, the `provider-validation-release-and-remeasure` handoff and `validation-state.json`; the artifact file name keeps the old time and is not renamed retroactively. The ordering claim (after the scored windows and the matrix) still holds |
| e   | The `validation-double-call-collapse` handoff listed a `session-validation.test.ts` case that did not exist | The behaviour is real (`session.ts:421-426` swallows a store failure and returns the verified session) and is now asserted. See §10                                                                                                                                                                                                              |
| f   | `VAL-L03-011` was recorded as an unconditional PASS while a same-pin run returned OPEN with 6 provider 503s | Carried as **PASS, provider-bucket conditional** here, in the evidence record, in `library/release-pin.md` §0.18 and in the L03 register row, citing both runs                                                                                                                                                                                   |

## 10. The missing test case — added, not explained away

The `validation-double-call-collapse` handoff claimed a `session-validation.test.ts`
case, "a cache write failure still returns the verified session", that was absent
from the committed suite. The behaviour is genuinely worth asserting: the
collapse changed `validateSessionToken` so that a cache **write** failure no
longer discards a verified token (`apps/web/src/lib/auth/session.ts:421-426`),
and the committed suite only ever mocked `setInCache` to resolve, leaving the
fail-open path unasserted.

The case is added on branch `mission/session-validation-cache-write-test`
(commit **`fa9a0b88a`**, based on `1580a719f`), in the granted
`apps/web/src/lib/auth/**` area, using
`mockRedis.setInCache.mockRejectedValueOnce`. It asserts the verdict stays
`valid` with the verified session returned and exactly one provider call. It is
a real test, not a name on a list: removing the `try`/`catch` around
`storeSession` makes it fail (**1 failed / 6 passed**), and with the behaviour
in place the file passes **7 of 7**. The branch is reported rather than merged
here, because merging a test-only change could trigger the deploy workflow and
supersede the pin every number in this record was measured on.

## 11. Mission-marked rows

The owner decided to **keep** the synthetic rows for the follow-up mission. No
row was reversed in this pass.

| Point                                      | workspaces | users | auth_accounts | sessions | messages | total   |
| ------------------------------------------ | ---------- | ----- | ------------- | -------- | -------- | ------- |
| Round 1 close                              | 2          | 2     | 2             | 2        | 93       | 101     |
| Round 2 close (`8397bdff6`)                | 2          | 2     | 2             | 2        | 106      | 114     |
| User-testing close (2026-11-10T19:07Z)     | 2          | 2     | 2             | 2        | 107      | 115     |
| `1580a719f` round close, 22:55:23Z         | 2          | 2     | 2             | 2        | 122      | 130     |
| **Current read, 2026-11-10T23:42:36.276Z** | **2**      | **2** | **2**         | **2**    | **123**  | **131** |

`node <missionDir>/tools/l03-row-state.mjs` (read-only) returned `marked` 2 / 2 /
2 / 2 / **123** — **131 total** — with org A at 112 messages and org B at 11. The
one row beyond the 122 read at 22:55:23Z is
`cc5c96d9-510b-416c-87b2-5e5d82b37958`, created 23:28:58Z by the user-testing
round's live round-trip; both session hashes are unchanged
(`16c99c27c729d95ce741ded2e8596d91`, `f520f64c6c53018fe13ac30a4e29fd46`). Use
**131** as the current figure. A second read at 2026-11-10T23:54:58.768Z, taken
just before this commit, returned the same `marked` 2 / 2 / 2 / 2 / 123 and the
same message count for each organization (org A 112, org B 11), so nothing was
added or removed between the two reads; the `totals` block differs only because
it counts the database's non-mission rows too. The reversal tool and order still
exist (`tools/reverse-l03-identities.mjs`) and were not run.

## 12. `VAL-SCAF-002` — no clinical content was authored by this phase

Verified over the whole phase diff `bdee5c364..1580a719f`: **46 changed paths**,
listed here by class.

| Class                    | Paths                                                                                                                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth and validation      | `apps/web/src/lib/auth/{session.ts,auth0-jwt-service.ts,index.ts,internal-identity.ts}`, `apps/web/src/middleware.ts`, `apps/web/src/lib/auth/__tests__/*` (7 files)                                                                                     |
| Request path and storage | `apps/web/src/lib/db/index.ts` + 3 tests, `apps/web/src/lib/redis.ts` + 2 tests, `apps/web/src/lib/services/training/session-api.ts` + 1 test                                                                                                            |
| Routes and their tests   | `apps/web/src/pages/api/session/*` (5 handlers, `_legacy-surface.ts`, 5 tests), `apps/web/src/pages/api/training/sessions/[sessionId]/messages.ts` + 4 tests, `apps/web/src/tests/api/session/*` (2 files), `tests/unit/auth0/auth0-jwt-service.test.ts` |
| Pages                    | `apps/web/src/pages/training/index.astro` — an auth/availability change only (removes the duplicate `isAuthenticated` validation and answers `503` + `Retry-After` on a provider failure)                                                                |
| Dependency churn         | `foresight`, `package.json`, `pnpm-lock.yaml`, `uv.lock`, `apps/web/src/lib/ai/multimodal-bias-detection/python-service/uv.lock` — automated dependency merges in the same window, not this mission's PRs                                                |

Checks:

- `git diff bdee5c364 1580a719f -- 'apps/web/src' | rg '^\+' | rg -i
  "scenario|rubric|coaching|therapeutic"` → **0 matches**. No scenario text,
  therapeutic protocol or coaching rubric was authored.
- `git diff --name-only bdee5c364 1580a719f | rg "migration|\.github/workflows|\.sql$"`
  → **no matches**. No DDL, migration or CI-workflow change.
- **No content-dependent surface was added by this phase.** The only
  content-dependent surface in the diff is
  `apps/web/src/pages/training/index.astro`, and the phase's change to it is
  auth/availability only; at the pin its copy already states that "training
  scenarios, session creation, and supervisor review are not yet available in
  this portal" (lines 64-68). The owner roles for each missing step — faculty and
  clinical education for the catalog, ML/clinical content for replies and
  coaching, application for the creation path — are named in the L04 row of
  `LAUNCH_DECISIONS.md` and in `research/gap-register-2026-11-09.md` (GAP-21 to
  GAP-25). The journey-scaffolding features were cancelled before
  implementation, so no surface was stubbed with invented text.

## 13. Register reconciliation

`planning/pilot-readiness-2026-11-04/LAUNCH_DECISIONS.md` was reconciled to this
pin and this evidence:

- **Header `Last reconciled`** now names `1580a719f` / Worker `186b655f` and this
  record.
- **L03** is **PASS, provider-bucket conditional**: the 35-leg matrix is clean on
  the quiet-window run, both same-pin runs are cited, and the provider-bucket
  condition is stated with its owner action.
- **L04** stays **OPEN**. All four availability/persistence legs pass on this
  pin; the journey steps that do not exist are recorded as deferred by owner
  decision, not omitted and not passed.
- **L02** states the Vercel standby condition **by cause**: team `Wutang`
  `billing.status: "overdue"`, `softBlock.reason: "UNPAID_INVOICE"`,
  `blockedAt: 2026-11-09T09:34:18.794Z`; `www` answers **402** with
  `x-vercel-error: DEPLOYMENT_DISABLED`; "a decision on the standby origin" is
  still among the missing items. L02 stays **OPEN**.
- **G2 and G4** were corrected where they asserted an availability failure that
  no longer exists. Both gates stay **OPEN** for their remaining conditions.
- The rows keep the **local** content, per the integration note: origin's rows
  lack the `db9b63ed1`, `f811440d6`, `a24ab11d9`, `249c558c4`, `8397bdff6` and
  `1580a719f` sentences.

**The Vercel checks are never reported as passed and never as an unqualified
"non-blocking".** `Vercel` and `Vercel Deployments – Wutang` fail on every
`staging` head this phase produced because of the billing soft block, not
because of any diff — including the release that measured 60 of 60. The check
discriminates nothing about the code and cannot gate a merge; the merge gate is
the `CI` workflow green on the PR's own head. Clearing it needs the owner to pay
the invoice; it is an open product condition, outside this mission's grant.

**Tracker state: left untouched, deliberately.** The L03 source issues (Linear
`PIX-4809`, GitHub `#1767` and `#1892`) were not re-labelled in this pass. A
status write on an external tracker is an outward-facing action this feature did
not ask for. If the owner wants L03's tracker status to follow this measurement,
it is a one-label change against the same evidence.

## 14. Integrity checks performed

| Check                         | Command                                                                                                                                                   | Result                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Release pin reproduction      | `./node_modules/.bin/wrangler deployments status --name pixelated-empathy`                                                                                | exit 0, wrangler 4.158.0: `186b655f…` at 100%, created 2026-11-10T22:30:33.588Z — matches §1 |
| `origin/staging` reproduction | `git rev-parse origin/staging`                                                                                                                            | `1580a719f216ed7314dad0e8496eec17b5a88951`                                                   |
| Endpoint status reproduction  | `curl -s -o /dev/null -w '%{http_code}'` on apex and `www` health                                                                                         | apex `200` (1.50 s); `www` `402` with `DEPLOYMENT_DISABLED`                                  |
| Vercel cause                  | Vercel API read of team `Wutang`                                                                                                                          | `billing.status` `overdue`; `softBlock` `UNPAID_INVOICE` at `2026-11-09T09:34:18.794Z`       |
| Row state                     | `node <missionDir>/tools/l03-row-state.mjs`                                                                                                               | 131 marked rows; both session hashes unchanged                                               |
| Phase diff content            | `git diff bdee5c364 1580a719f` + `rg` over added lines                                                                                                    | 46 paths; 0 clinical-content terms; no migration or workflow change                          |
| Test case mutation check      | remove the `try`/`catch` around `storeSession`, run the suite, restore                                                                                    | new case fails (1 failed / 6 passed); with the behaviour, 7 of 7 pass                        |
| Markdown lint                 | `./node_modules/.bin/markdownlint --config .markdownlint.json planning/pilot-readiness-2026-11-04/*.md planning/pilot-readiness-2026-11-04/evidence/*.md` | exit 0, no findings                                                                          |
| Format                        | `./node_modules/.bin/oxfmt --write` on the changed records, then `--check`                                                                                | formatted; check exit 0                                                                      |
| Artifact integrity            | `node <missionDir>/tools/check-gate-artifacts.mjs`                                                                                                        | exit 0                                                                                       |
| Secret scan                   | the record's own `rg` patterns over the changed records                                                                                                   | zero matches                                                                                 |
| Internal links                | every relative link in this record resolved against its directory                                                                                         | zero broken links                                                                            |

## 15. No readiness claim

This record states a **NO-GO** decision. G1–G6 have not passed. Nothing here
authorizes enrollment, a customer launch, a pilot offer, or any claim that the
platform is available for pilot use. Four availability assertions passing on one
release is a measurement, not a launch decision, and the conditions that still
block a pilot are the journey content, the owner decisions, the standby origin,
the evaluation/release bundle and the public claims.

## 16. Durability

This record, the corrected evidence record, the evidence index, the gap register
and the register's L02/L03/L04 and G2/G4 rows are committed by **explicit path**
in `/home/vivi/pixelated` after `oxfmt --write` and markdownlint. Nothing is
staged with a wildcard, and no path belonging to the parallel session appears in
any of these commits. The test case is committed on
`mission/session-validation-cache-write-test` (`fa9a0b88a`), based on the pinned
release, and is reported rather than merged so the measured pin is not superseded.

The records are **local commits on this clone's `staging`**, which is behind
`origin/staging` by the merges this phase performed. Integration rebases them
onto `origin/staging` and keeps the **local** L03/L04 content. `results/` and
`validation/` live under `<missionDir>`, which is not a git repository; they are
cited by path and this record does not claim they were committed.
