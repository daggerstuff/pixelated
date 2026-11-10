# Pilot gate decision — L03/L04 gap-close verification, 2026-11-10

**Decision: NO-GO. Preserved, and re-derived from the measurements rather than
carried forward by default.** The phase opened with four failing assertions. On
the release under test, three of them now pass and the fourth fails on **one
named mechanism**: the Auth0 provider validation path, which performs several
`validateToken` calls per authenticated request and turns a `/userinfo` rate
limit into a bounded `503` and, on the retry, a `/login` landing. The decision
stays NO-GO because `VAL-HANG-001` requires 20 of 20 first-attempt `200` and one
of six measured windows returned 19 of 20. No feature in this mission owns that
bar any more (its owning feature was cancelled by the owner's scope reduction,
and the fix needs a grant extension), so this record states the bar is unmet by
one mechanism, not by an open search and not by an environment condition.

This record supersedes
[`mission-decision-2026-11-09.md`](mission-decision-2026-11-09.md) as the current
decision record. The 2026-11-09 record stays in place as the measurement it was:
the state at `f475bcc4f`. Nothing in it is restated as if it had been measured
later.

## 1. Release under test

Every number in this record was measured on one release. It was read live during
this pass, not taken from a brief.

| Item                          | Value                                                                                                                                                                                    | Source                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Commit built and deployed     | `8397bdff6140d886af299762ddfaa10d892bfbfb`                                                                                                                                               | `gh run view 42864607424 --json headSha`; `git log -1 --format=%H` in both deploy jobs                |
| Active Worker version         | `7ea1640e-d8d6-4cb2-9da5-56621309a851` at **100%**                                                                                                                                       | `./node_modules/.bin/wrangler deployments status --name pixelated-empathy` (wrangler 4.158.0, exit 0) |
| Worker version created        | 2026-11-10T17:27:52.830Z                                                                                                                                                                 | same read                                                                                             |
| Deployment created            | 2026-11-10T17:27:54.864Z                                                                                                                                                                 | same read                                                                                             |
| Staging `CI` on the exact SHA | `42863424368` (event `push`) — **success**                                                                                                                                               | `gh run view 42863424368`                                                                             |
| Deploy run                    | `42864607424` (event `workflow_run`) — **success**; `Detect app-facing changes`, `Check deploy credentials`, `Build Cloudflare bundle`, `Deploy to Cloudflare` all ran, **none skipped** | `gh run view 42864607424 --json jobs`                                                                 |
| Health, apex                  | `https://pixelatedempathy.com/api/health` → **200**; apex `/` → **200**                                                                                                                  | `curl -s -o /dev/null -w '%{http_code}'`                                                              |
| Health, `www`                 | **402**, `x-vercel-error: DEPLOYMENT_DISABLED` — the Vercel standby account is blocked; only the Worker apex serves                                                                      | same command                                                                                          |
| `origin/staging` HEAD         | `8397bdff6…` — the pin did not move through the measurement window                                                                                                                       | `git rev-parse origin/staging`                                                                        |

Evidence record for this measurement:
[`availability-remeasure-8397bdff6-2026-11-10.md`](availability-remeasure-8397bdff6-2026-11-10.md)
(commit `ac8945dd7`). Canonical pin record: `library/release-pin.md` §0.17. Raw
artifacts live under `<missionDir>/results/availability-release-and-remeasure/`
and `<missionDir>/results/l03-tenant-matrix-2026-11-10T17-31-30-496Z.json`.

## 2. Per-assertion outcome

Each row states the verdict, the pin it was measured on, and the artifact. No
assertion is marked passed without a reproduced measurement on this pin.

| Assertion      | Requirement                                                                                                  | Measured on `8397bdff6` / `7ea1640e`                                                                                                                                                                                                                                                                      | Verdict  |
| -------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `VAL-L03-011`  | zero hard failures across the 35-leg matrix                                                                  | 35 legs: **6 pass / 15 deny / 14 exclusion / 0 fail**; `defects5xx` **0**, `hardFailures` **0**, `noResponse` 0, `transient429` 0, `unauthenticatedAll401` true, `legacyRoutesIdentical410BothOrgs` true; driver verdict **PASS**; `--verify-result` recomputed **PASS**, exit **0**; `--self-test` 24/24 | **PASS** |
| `VAL-L04-003`  | one trainee message persists and is visible after reload                                                     | page `200` on the first attempt; submission **`201` in 660 ms**; row `4448f28a-6cb1-429b-9afb-b55e7907cf30`; visible after reload in an 87-bubble transcript                                                                                                                                              | **PASS** |
| `VAL-POST-001` | ten consecutive submissions, a row each, visible after reload                                                | **10 of 10 `201`**, 10 rows, **10 of 10 visible** after a close/reopen reload; `statusWithoutRow` 0, `rowWithoutStatus` 0, `noRequest` 0                                                                                                                                                                  | **PASS** |
| `VAL-HANG-001` | 20 of 20 first-attempt `200` per window; a bounded `503` fails; a `/login` landing counts against the twenty | six 20-navigation windows: **five at 20 of 20** with 0 retries; **w4 19 of 20** (first attempt `503` at 5 048 ms, its single retry `302` to `/login` at 6 984 ms, `/login` `200` at 8 040 ms); **119 of 120 first-attempt overall**                                                                       | **FAIL** |

The 8 s silence is still gone on this pin: **0 of 202** tail events show
7 500 ms or more of silence, `exceptions` is empty on all 202, and there are
**0** `runtime canceled`, **0** `would never generate a response` and **0**
`Training session load deadline exceeded` lines. All five legacy routes answer
`410` in both organizations and carry acquire lines with probe trips
(`skills` 2, `analytics` 2, `progress` 1, `snapshots` 1, `comparison` 2).

## 3. What moved — the trend, not four unchanged assertions

The four assertions are not in the state the phase opened with. This table is
trend: each row is the verdict measured on that pin, and only the last row is the
current claim.

| Pin / Worker                 | `VAL-L03-011`                                       | `VAL-L04-003` | `VAL-POST-001`      | `VAL-HANG-001`                            |
| ---------------------------- | --------------------------------------------------- | ------------- | ------------------- | ----------------------------------------- |
| `db9b63ed1` / `2207d7a1`     | FAIL — 13 hard failures                             | PASS          | 3 of 10             | 5 of 20 first attempt (10 of 20 final)    |
| `f811440d6` / `af615b73`     | FAIL — 8 hard failures                              | PASS          | 5 of 10             | 1 of 20 first attempt                     |
| `a24ab11d9` / `e9aed1a4`     | FAIL — 7 hard failures                              | PASS          | 5 of 10             | 3 of 20 first attempt                     |
| `249c558c4` / `7542a5d3`     | FAIL — 12 hard failures                             | PASS          | 5 of 10             | 1 of 20 first attempt (5 of 20 at 15:25Z) |
| `42653d506` / `0f3d77e6`     | FAIL — 6 hard failures (legacy direct-pool borrows) | PASS          | 10 of 10            | PASS — 20 of 20 in three windows          |
| **`8397bdff6` / `7ea1640e`** | **PASS — 0 hard failures**                          | **PASS**      | **PASS — 10 of 10** | **FAIL — 119 of 120**                     |

Three statements follow from the table, and each is load-bearing:

1. **`VAL-L03-011` closed by fixing the cause it named.** The six failures on
   `42653d506` were legacy handlers borrowing straight from the pool, so the
   liveness probe never ran on them. PR #6677 routed all five handlers through
   `acquireClient()` and mapped a failed acquisition to a retryable `503`; the
   hard-failure count went **6 → 0** and the exclusion count **8 → 14** because
   those legs now answer their documented `410`. The six legs did not disappear
   by reclassification.
2. **Message persistence closed.** It moved from 3 of 10 to 5 of 10 to **10 of
   10** as the POST path was bounded and the acquisition path was fixed, and it
   holds at 10 of 10 twice on this pin.
3. **The availability bar moved from 1 of 20 first-attempt (its worst point, on
   two pins) to 119 of 120 and still fails.** That is a real movement — the
   deadline, socket and legacy-borrow classes are gone — and it is not a pass,
   because the contract scores a bounded `503` and a `/login` landing as failure.

## 4. The one failure, read honestly

Window 4 (17:36:09–17:36:51Z) answered **19 of 20** on the first attempt. Leg 1
returned `503` at 5 048 ms; its single backed-off retry returned `302` to
`/login` at 6 984 ms, and `/login` answered `200` at 8 040 ms. The tail records
the `503` at `wallTime` 5 001 ms carrying **exactly two** completed validations
(two bounded `/userinfo` calls at 2 500 ms), and the `302` at `wallTime` 6 945 ms
carrying **three**.

**The condition that produced it was induced by the operator, and that is stated
plainly.** w4 began about 70 seconds after this worker ran the host-side stage
probe at 17:34Z, which spent ten `/userinfo` samples and received **5 × 429**.
The probe's own guidance says to run it after a burst; this window was run
afterwards deliberately, to measure whether the provider class still reaches the
page path. It does.

**That condition does not reclassify the assertion.** The provider class is
independently evidenced in the same release: the host-side probe measured 5 of 10
`/userinfo` samples at `429`, median 8 819 ms, max 8 979 ms (management
`getUser` 55–549 ms, 10 of 10 `200`; Postgres connect+select 21–268 ms, 10 of 10
ok), and the capture's page-load histogram carries three `503`s at exactly
5 001 ms with two completed validations each. Only **one** of those three is a
burst leg (w4 leg 1); the other two are the 17:32:21Z and 17:32:30Z page loads of
a POST run that was aborted before it issued a submission, was scored by nothing,
and wrote no row. The single `302` in the capture is w4's retry, at 6 945 ms with
three validations. `VAL-HANG-001` requires 20 of 20 on the first attempt, a
bounded `503` fails, and a `/login` redirect counts against the twenty. The
honest statement is that **five of six windows met the bar and one did not,
because a live, deferred class reached the page path**.

The cross-tabulation is what rules out the classes this phase fixed. On the
`/training/session` legs that answered `200` (n = 86), every one logged
`reused` and `new` with a `New client connected` line, and **77** probe trips;
the three page `503` legs carried **`reused` 0, `new` 0, `connected` 0,
`probeTrips` 0**, so they never entered `acquireClient()`. The socket class is
gone; the surviving class is the provider.

## 5. The single surviving mechanism, and why it is not schedulable here

The provider validation path performs **four `validateToken` calls per
authenticated request** (about 2.3 s) — the middleware, the page's `getSession`,
the loader's `getSession`, and the `/training` hop's redundant check — each of
which calls Auth0 `/userinfo` and the Management API. Against the tenant's
10-request bucket, two page loads exhaust it.

Its owning feature, `validation-double-call-collapse`, is **cancelled** by the
owner's 2026-11-10 scope reduction. Implementing it needs a grant extension to
`apps/web/src/lib/auth/**`: `auth0-middleware.ts` and the validation path in
`apps/web/src/middleware.ts` are outside every granted area. That is **GAP-34**
in `research/gap-register-2026-11-09.md` (mission directory, not this repository,
so it is cited by path rather than linked).

So the availability bar is unmet by **one named mechanism whose fix needs an
owner grant extension**, not by an open search and not by an environment
condition. No feature in this mission owns it. This record does not create a
feature for it and does not describe it as fixed.

## 6. What would change the answer

One change, measured the same way: **the provider validation collapse, deployed
and re-measured with the same six-window method.** If one `validateToken` per
request holds, the `/userinfo` call count per load falls from 5–7 to 2–3, the
bucket is no longer exhausted by ordinary traffic, and w4's shape disappears. The
bar is still 20 of 20 first-attempt `200` in every window, with a bounded `503`
and a `/login` landing still counting against the twenty.

Everything else that remains before a pilot is a different tier and is listed in
§9 and §10: the deferred hardening and journey work, and the owner decisions on
the scenario catalog, clinical content, and faculty review.

## 7. User-testing round — independent confirmation, 2026-11-10T19:02Z

The milestone user-testing validator re-verified all four assertions on the same
pin (`8397bdff6` / Worker `7ea1640e`), independently of this mission's own
measurement. Its synthesis is at
`validation/availability-and-persistence-fixes/user-testing/synthesis.json`
(mission directory).

| Assertion      | Independent result                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VAL-L03-011`  | **PASS, twice over**: exact offline replay of the recorded 35-leg artifact (`--verify-result` recomputed PASS; `--self-test` 24/24) plus an uncontaminated live 23-leg pass at 18:57:28–18:59:22Z with nothing else active — 23 of 23 legs at the expected status, 0 retries, 0 `429`, 0 `5xx`, all 10 exclusion legs returning one identical 94-byte body (md5 `5fba5ab0ad6080d75a10bcf56e8ec607`), 7 unauthenticated legs `401`, health `200` |
| `VAL-L04-003`  | **PASS, fresh live round-trip**: `201` in 662 ms, row `2027e02d-a772-4866-8e84-51ed57a79e72` read back from `training_session_messages`, visible after a `200` reload in a 98-bubble transcript                                                                                                                                                                                                                                                 |
| `VAL-POST-001` | **PASS**: the recorded artifact reproduced (10 of 10 `201` with a request line each, rows 87 → 97, `statusWithoutRow` 0 / `rowWithoutStatus` 0 / `noRequest` 0), plus a live read-only verify (10 of 10 visible) and a live database read-back of all ten row ids with matching content                                                                                                                                                         |
| `VAL-HANG-001` | **FAIL, independently**: the six recorded windows re-derived to 119 of 120; w4's attribution reproduced from the tail (three page `503`s at `wallTime` exactly 5 001 ms with two completed validations each, one `302` at 6 945 ms with three, `exceptions` empty on all 202 events, cross-tab `reused` 0 / `new` 0 / `connected` 0 / `probeTrips` 0), and **one new clean window** at 18:42:15–18:42:35Z measured 20 of 20 with 0 retries      |

The clean window is recorded as one more window, **not as a cure**. The failure
is intermittent and the provider class is live; a clean window does not change
the verdict.

## 8. Two facts that change how the numbers are read

1. **The provider class also fires under concurrent load.** A back-to-back burst
   of 12 org-A legs taken while another validator was signed in produced **4
   first-attempt `503`s** with body
   `{"error":"Authentication provider temporarily unavailable","retryAfterSeconds":30}`
   and `Retry-After: 30`, plus one `401` on an authenticated caller; the same legs
   reproduced 23 of 23 at the expected status minutes later with nothing else
   running. Both the burst and the matrix are **window-dependent through this
   class**: a tenant-matrix run taken inside such a window would record
   `defects5xx` and an OPEN verdict even though the recorded matrix on this pin is
   clean. That is a property of the deferred provider class, not of the fixes, and
   it is why the user-testing round verified L03 by exact replay plus an
   uncontaminated live pass rather than by re-running the 35-leg driver.
2. **Two artifact conventions.** Burst latency "median" columns are **upper
   medians** (`sorted[n/2]`), not the mean of the two middle samples, and a
   deadline `503` is labelled `firstOutcome: "status-503"` rather than
   `"deadline-503"`. A later reader recomputing the numbers should expect a
   2–15 ms difference on the medians and should **count `503`s from
   `firstChain[].status`**, not from `firstOutcome`, or the count is undercounted.

## 9. Scope reduction — the hardening and journey tiers were deferred by owner decision

This mission now covers only the request-path fix chain and this record. On
2026-11-10 the owner moved the **hardening** and **journey-scaffolding**
milestones to a follow-up mission. Their **nine features are cancelled** and
their **seven assertions were removed** from `validation-contract.md` and
`validation-state.json`; the full text of both is preserved verbatim in
`<missionDir>/research/followup-mission-2026-11-10.md`.

Stated plainly, because a later reader must not infer otherwise:

- The hardening tier was **deferred**, not omitted, not passed, and not silently
  dropped. The trainee-facing `503` message, `400`-for-malformed-input, first-login
  provisioning, the email-keyed upsert risk, the CSRF middleware decision, the
  faculty role vocabulary and the duplicate Management lookup are all still open.
- The journey-scaffolding tier was **deferred** for the same reason, and it could
  not have completed here at all: the scenario catalog and all clinical content
  are an owner blocker.
- **No assertion that is no longer in the contract is claimed here**, and this
  record does not describe the mission as having covered either tier.

## 10. Residuals recorded as measured facts, not fixed here

These are recorded so the decision is complete. None is turned into a fix feature
in this mission.

1. **Provider outages still surface as authentication failures outside
   `/training` (GAP-34).** The API routes listed in `routeAuthConfig`
   (`/api/chat`, `/api/v1/*`, …) still answer **`401`** rather than `503` during
   an Auth0 provider outage, because `authenticateRequest` lives in
   `apps/web/src/lib/auth/auth0-middleware.ts`, which is outside every granted
   area. Other session-required pages (`/dashboard`, `/sessions`) likewise still
   treat an outage as unauthenticated. Recorded from the `login-redirect-fix`
   handoff (PR #6655) and in the gap register as GAP-34; it needs an owner grant
   extension.
2. **Only the Cloudflare Worker apex serves.** `https://www.pixelatedempathy.com/api/health`
   answers **402** with `x-vercel-error: DEPLOYMENT_DISABLED` because the Vercel
   standby account is blocked. This is an environment condition, not a product
   regression; never cite `www` as a passing host.
3. **Which fixes are in the release under test.** The Postgres client-acquisition
   bound (#6650, `be1d8e4e0`) and the message-POST bound (#6654, `c6392ee6a`) are
   in `8397bdff6`. The `/login` redirect fix (#6655, merged as `888bdd7ae` on
   2026-11-10T03:41:54Z) **is also in it**: it merged about fourteen hours before
   the pin was read at 2026-11-10T17:28Z, and `git merge-base --is-ancestor
   888bdd7ae 8397bdff6` exits 0. A `/login` landing still occurred in w4 on this
   release (§4), which is the provider class reaching the page path rather than a
   missing fix.

## 11. Phase invariants

| Invariant                                                                    | Check                                                                                                                  | Result                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No clinical content was invented (`VAL-SCAF-002`)                            | changed-path list of the phase window `bdee5c364..8397bdff6` (43 paths) and of the mission's local commits; file reads | **Holds.** No scenario catalog, therapeutic protocol, coaching rubric, or clinical text was authored. The journey-scaffolding features were cancelled before implementation, so the phase contains no scaffolding at all; the changed paths are the request-path fixes, their tests, and evidence documents          |
| No migration, DDL, or CI-workflow change                                     | `git diff --name-only bdee5c364 8397bdff6 \| grep -E 'migration\|\.github/workflows\|\.sql$'`                          | **No matches.** The phase's lockfile and `package.json` churn came from automated dependency merges in the same window, not from this mission's PRs                                                                                                                                                                  |
| The parallel session's working tree was never staged, committed, or reverted | `git status --porcelain` before and after this pass; every commit made with an explicit path                           | **Holds.** The pre-existing modifications (`LICENSE`, `ai`, `apps/web/src/components/base/Head.astro`, `docs`, `foresight`, `package.json`) and the untracked `apps/web/src/lib/ai/bias-detection/python-service/models/` directory are untouched; nothing outside `planning/pilot-readiness-2026-11-04/` was staged |
| No launch-readiness claim                                                    | `rg` over the records for readiness/launch language                                                                    | **Holds.** See §16                                                                                                                                                                                                                                                                                                   |

The phase window's changed paths include `apps/web/src/lib/auth/*`,
`apps/web/src/lib/db/index.ts`, `apps/web/src/lib/redis.ts`,
`apps/web/src/lib/services/training/session-api.ts`, `apps/web/src/middleware.ts`,
`apps/web/src/pages/api/session/*`, `apps/web/src/pages/api/training/*`,
`apps/web/src/pages/training/index.astro`, their tests, and the submodule and
lockfile pointers. Nothing else.

## 12. Register reconciliation

`planning/pilot-readiness-2026-11-04/LAUNCH_DECISIONS.md` rows 41 (L03) and 42
(L04) ended at `249c558c4` and contradicted this round. Both were reconciled to
the canonical pin and the current evidence:

- **L03** moved from **OPEN** to **PASS**: 0 hard failures on the 35-leg matrix on
  `8397bdff6`, with the round-1 six failures and the `42653d506` six
  direct-pool-borrow failures recorded as history in the same row.
- **L04** stays **OPEN**. `VAL-L04-003` and `VAL-POST-001` pass, the `/login`
  redirect half is fixed, but `VAL-HANG-001` fails 119 of 120 and the journey
  steps that do not exist were deferred, not built.
- The **G2** and **G4** gate-summary rows were corrected where they asserted that
  cross-organization verification and release-level tenant isolation were
  unproven; both gates stay OPEN for their remaining conditions.
- The rows keep the **local** content, per the integration note: origin's rows
  lack the `db9b63ed1`, `f811440d6`, `a24ab11d9` and `249c558c4` sentences.
  Verified after writing by grepping the committed file for each pin.
- The register still states **NO-GO**, and no row claims launch readiness.

**Tracker state: left untouched, deliberately.** The L03 source issues (Linear
`PIX-4809`, GitHub `#1767` and `#1892`) were **not** re-labelled in this pass.
The owner's 2026-11-10 scope reduction narrowed this mission to the request-path
fix chain and this record, and a status write on an external tracker is an
outward-facing action this feature did not ask for. The issues keep the state the
`l03-evidence-register-and-tracker` feature left them in. If the owner wants L03's
tracker status to follow this measurement, it is a one-line label change against
the same evidence — nothing here is blocked on it, and nothing here claims it was
done.

## 13. Mission-marked rows

The synthetic rows still exist and are reversible with
`tools/reverse-l03-identities.mjs`.

| Point                                        | workspaces | users | auth_accounts | sessions | messages | total   |
| -------------------------------------------- | ---------- | ----- | ------------- | -------- | -------- | ------- |
| Round 1 close                                | 2          | 2     | 2             | 2        | 93       | 101     |
| Round 2 close (`8397bdff6`)                  | 2          | 2     | 2             | 2        | 106      | **114** |
| User-testing close                           | 2          | 2     | 2             | 2        | 107      | **115** |
| Live read in this pass, 2026-11-10T19:07:25Z | 2          | 2     | 2             | 2        | 107      | **115** |

The live read (`node <missionDir>/tools/l03-row-state.mjs`, read-only) returned
`marked` 2 / 2 / 2 / 2 / 107 — **115** — with org A at 98 messages and org B at 9.
Both session hashes are unchanged: `16c99c27c729d95ce741ded2e8596d91` (org A) and
`f520f64c6c53018fe13ac30a4e29fd46` (org B). Use **115** as the final figure; the
rows are still present.

## 14. Report-text corrections folded in

The request-path diagnosis
([`request-path-diagnosis-2026-11-09.md`](request-path-diagnosis-2026-11-09.md))
carried six report-text errors found by scrutiny round 2 and the user-testing
round. All six were folded in there in a dated `round-2-corrections` amendment;
none changed the attribution, the named cost, or which finding authorises which
fix, and none needed a re-measurement.

| #   | Correction                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a   | Sample sizes: window 1's 170th tail event is byte-identical to window 2's last event, so the sample is **22 distinct page-deadline legs and 38 distinct deadline legs**, not 23 and 39. The "17, not 16" claim is reverted — it is inverted; the committed 169-event prefix holds 16. Deduplicate by `eventTimestamp` + `wallTime` + log count |
| b   | The two API-`503` ranges: cache-attempt offset **1–91 ms** (recorded 1–63 ms), silence to the deadline log **7 983–7 999 ms** (recorded 7 983–8 157 ms)                                                                                                                                                                                        |
| c   | The **481** Redis error/close pairs span **both** windows (338 + 143), not the first window                                                                                                                                                                                                                                                    |
| d   | Section 7 cited a first-window row-state snapshot that does not exist; only `row-state-20261109T2252Z.json` is present, and the withdrawn row is marked as such                                                                                                                                                                                |
| e   | The tampered-token control returns `401` only on the API leg; the page route returns `302` to `/login`. Four citations were re-read and corrected (`:72-96` → `:72-95`, `:243` → `:243-245`, `:257-279` → `:261-281`, `:504-518` → `:503-517`)                                                                                                 |
| f   | The report's §5.8 and D3 said `apps/web/src/lib/db/index.ts` is outside every granted area; that is superseded — the owner extended the grant on 2026-11-09 and `AGENTS.md` records it with a precedence rule. The report now cites the grant as it stands                                                                                     |

The withdrawn 4 638–13 202 ms "cache span" claim is **not** restated anywhere. The
measured cache cost stays what §4.2 says it is: about 10 ms typical and at most
1.5 s worst case, and not the deadline cost.

## 15. Integrity checks performed

| Check                         | Command                                                                                                                                                   | Result                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Release pin reproduction      | `./node_modules/.bin/wrangler deployments status --name pixelated-empathy`                                                                                | exit 0, wrangler 4.158.0: `7ea1640e…` at 100%, created 2026-11-10T17:27:52.830Z — matches §1 |
| CI and deploy provenance      | `gh run view 42863424368`; `gh run view 42864607424 --json jobs`                                                                                          | CI `success` on `8397bdff6`; deploy `success`, four jobs, none skipped                       |
| Endpoint status reproduction  | `curl -s -o /dev/null -w '%{http_code}'` on the five `/api/session/*` routes                                                                              | `401` each, reproducing the recorded unauthenticated guard result                            |
| Host probes                   | `curl` on apex and `www` health                                                                                                                           | apex `200`; `www` `402` with `DEPLOYMENT_DISABLED`                                           |
| Row state                     | `node <missionDir>/tools/l03-row-state.mjs`                                                                                                               | 115 marked rows; both session hashes unchanged                                               |
| Migration / CI-workflow check | `git diff --name-only bdee5c364 8397bdff6 \| grep -E 'migration\|\.github/workflows\|\.sql$'`                                                             | no matches                                                                                   |
| Markdown lint                 | `./node_modules/.bin/markdownlint --config .markdownlint.json planning/pilot-readiness-2026-11-04/*.md planning/pilot-readiness-2026-11-04/evidence/*.md` | exit 0, no findings                                                                          |
| Format                        | `./node_modules/.bin/oxfmt --write` on the changed records, then `--check`                                                                                | formatted; check exit 0                                                                      |
| Artifact integrity            | `node <missionDir>/tools/check-gate-artifacts.mjs`                                                                                                        | exit 0                                                                                       |
| Secret scan                   | `rg` with the twelve patterns in `mission-decision-2026-11-09.md` §10.1 over the changed records                                                          | zero matches                                                                                 |
| Internal links                | every relative link in this record resolved against its directory                                                                                         | zero broken links                                                                            |

## 16. No readiness claim

This record states a **NO-GO** decision. G1–G6 have not passed. Nothing here
authorizes enrollment, a customer launch, a pilot offer, or any claim that the
platform is available for pilot use. `VAL-HANG-001` fails, the hardening and
journey tiers are deferred, and the owner decisions on scenario content and
faculty review are unmade. Three assertions passing on one release is a
measurement, not a launch decision.

## 17. Durability

This record, the corrected diagnosis record, the corrected availability record,
the evidence index, and the register's L03/L04 and G2/G4 rows are committed by
**explicit path** in `/home/vivi/pixelated` after `oxfmt --write` and
markdownlint. Nothing is staged with a wildcard, and no path belonging to the
parallel session appears in any of these commits.

The register is committed because it carried **no other mission's uncommitted
rows** at the time of the commit: `git status --porcelain` showed it unmodified
before this pass, and the diff's content is confined to the L03 row, the L04 row,
the G2 and G4 gate-summary rows, and the `Last reconciled` lines under the
header. `oxfmt --write` additionally repadded the file's markdown table separator
rows and normalized emphasis markers; that is delimiter and whitespace formatting
only, and `git diff -w` against the committed blob shows no other content change.
The diff was reviewed before staging. If a future pass finds foreign uncommitted
rows in it, the register must be left uncommitted and said to be so.

The records are **local commits on this clone's `staging`**, which is behind
`origin/staging` by the merges this phase performed. Integration rebases them
onto `origin/staging` and keeps the **local** L03/L04 content; it does not take
origin's rows, which lack the `db9b63ed1`, `f811440d6`, `a24ab11d9` and
`249c558c4` sentences. Verified before committing by grepping the file for each
pin, and again after committing by reading the committed blob.

`results/` and `validation/` live under `<missionDir>`, which is not a git
repository; they are cited by path and this record does not claim they were
committed.
