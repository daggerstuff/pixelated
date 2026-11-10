# Availability and persistence re-measurement — 2026-11-10

Measured on commit `db9b63ed1199b78bac3a5a3489159f9b2b551c13` / Worker
`2207d7a1-5393-42d7-9ad2-507c96622a46` at **100%** traffic (created
2026-11-10T03:50:18.132Z). Pin read live with
`./node_modules/.bin/wrangler deployments status --name pixelated-empathy`
before the window (04:25Z) and after it; `origin/staging` HEAD was the same
commit at both reads. Full pin record: `library/release-pin.md` §0.0.

This record replaces no earlier one. The L03 and L04 results from 2026-11-09 stay
bound to `f475bcc4f` / Worker `a9d4e785`; nothing below is a restatement of them.

## 1. What this release is, and how it was produced

| Step                                       | Record                                                                                                                                                                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR #6655 (`mission/login-redirect-fix`)    | head `780bbde67319d33b7ecf2eec5a07cb14269af716`, 7 files; PR `CI` `42749889785` **success**                                                                                                    |
| Head move after handoff                    | the worker handoff recorded `97ce70d0c`; the real head was `780bbde67` (three files, +54/−10: `auth0-jwt-service.ts`, `middleware.ts`, one test). Validated as in-scope; nothing reverted      |
| Merge                                      | `888bdd7ae87375892965f4afba879e183097782d`, 2026-11-10T03:41:54Z; merged tree contains the identical auth/middleware/training blobs as `780bbde67`                                             |
| Merge-commit `CI`                          | `42751115317` — **cancelled** by newer pushes, so the merge commit has no green staging CI                                                                                                     |
| Automatic deploy for the merge             | `42751302349` — concluded success with `Build Cloudflare bundle` and `Deploy to Cloudflare` **skipped**, because its triggering `CI` run was `cancelled`. The live Worker stayed on `87c25a28` |
| Deploy used                                | `42751457382` — `gh workflow run deploy-cloudflare.yml --ref staging`, **success**; both jobs logged `git log -1` = `db9b63ed1`; `Current Version ID: 2207d7a1-…`                              |
| Deployed SHA                               | `db9b63ed1`; tree identical to `78ca818f9` (`275c1e0a…`), which carries `CI` `42751425428` **success**                                                                                         |
| Exact-SHA `CI`                             | **none** on `db9b63ed1` (or `c4d4129d8`) — a provenance gap, recorded in `library/release-pin.md` §0.0a, not a green-CI claim                                                                  |
| Health                                     | `https://pixelatedempathy.com/api/health` → **200** (1.66 s); apex `/` → **200** (1.53 s)                                                                                                      |
| Pin re-read at the end of the run (04:32Z) | `origin/staging` still `db9b63ed1`; `wrangler deployments status` still `2207d7a1-…` at 100% — the pin did not move during the measurement window                                              |

`https://www.pixelatedempathy.com` answers **402** with
`x-vercel-error: DEPLOYMENT_DISABLED` because the Vercel standby account is
blocked. That is an environment condition and is **not** recorded as a mission
failure; it was not probed as a health claim.

## 2. Verdicts

| Assertion      | Requirement                                         | Measured                                                                                                                                            | Verdict  |
| -------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `VAL-HANG-001` | 20 of 20 authenticated navigations return HTTP 200  | 5 first-attempt 200; **10 of 20 final 200**; 6 final 503; 4 final deadline redirects; 0 `/login` redirects; 15 retries; 0 runtime-cancel exceptions | **FAIL** |
| `VAL-L03-011`  | zero hard failures across the 35-leg matrix         | 5 pass, 12 deny, 5 exclusion, 2 fail, **11 × 5xx**; hard failures **13**; transient 429 **0**; driver verdict **OPEN**                              | **FAIL** |
| `VAL-L04-003`  | one UI message persists and is visible after reload | submission #2: **201** in 2 553 ms, row `12213747-de82-49ad-938d-46e61913bba7`, visible after reload                                                | **PASS** |
| `VAL-POST-001` | ten consecutive UI submissions all succeed          | **3 of 10** 201; 4 deadline 503; 3 provider 503; 3 rows; 0 runtime-cancel exceptions                                                                | **FAIL** |

## 3. `VAL-HANG-001` — the twenty-navigation authenticated burst

Method: one `agent-browser` process, one sign-in through the real `/login` form
as the synthetic org A user, twenty sequential fresh navigations to
`https://pixelatedempathy.com/training/session/33333333-3333-4333-8333-333333333333`,
document status read from
`performance.getEntriesByType('navigation')[0].responseStatus`, at most one
backed-off retry (3 s) per request. Artifact:
`results/availability-release-and-remeasure/burst-requests.json`.

| #   | First attempt                      | Final                              | Final path                          | Retried |
| --- | ---------------------------------- | ---------------------------------- | ----------------------------------- | ------- |
| 1   | 503 (deadline redirect, 12 204 ms) | 503                                | session URL                         | yes     |
| 2   | 200 (1 757 ms)                     | 200, 9 bubbles                     | session URL                         | no      |
| 3   | 503 (3 856 ms)                     | 503                                | session URL                         | yes     |
| 4   | 503 (deadline redirect, 12 004 ms) | 200 (1 780 ms)                     | session URL                         | yes     |
| 5   | 503 (3 865 ms)                     | 503 (deadline redirect, 12 021 ms) | `/training?error=session-not-found` | yes     |
| 6   | 200 (1 903 ms)                     | 200, 9 bubbles                     | session URL                         | no      |
| 7   | 503 (3 841 ms)                     | 503                                | session URL                         | yes     |
| 8   | 503 (deadline redirect, 12 015 ms) | 200 (1 787 ms)                     | session URL                         | yes     |
| 9   | 503 (3 845 ms)                     | 503 (deadline redirect, 12 081 ms) | `/training?error=session-not-found` | yes     |
| 10  | 200 (1 758 ms)                     | 200, 9 bubbles                     | session URL                         | no      |
| 11  | 503 (3 842 ms)                     | 503                                | session URL                         | yes     |
| 12  | 503 (deadline redirect, 12 001 ms) | 200 (1 806 ms)                     | session URL                         | yes     |
| 13  | 503 (3 848 ms)                     | 503 (deadline redirect, 11 997 ms) | `/training?error=session-not-found` | yes     |
| 14  | 200 (1 847 ms)                     | 200, 9 bubbles                     | session URL                         | no      |
| 15  | 503 (3 847 ms)                     | 503                                | session URL                         | yes     |
| 16  | 503 (deadline redirect, 12 009 ms) | 200 (1 735 ms)                     | session URL                         | yes     |
| 17  | 503 (3 847 ms)                     | 503 (deadline redirect, 11 999 ms) | `/training?error=session-not-found` | yes     |
| 18  | 200 (1 863 ms)                     | 200, 9 bubbles                     | session URL                         | no      |
| 19  | 503 (3 845 ms)                     | 503                                | session URL                         | yes     |
| 20  | 503 (deadline redirect, 12 034 ms) | 200 (1 826 ms)                     | session URL                         | yes     |

Counts: first-attempt 200 **5**, final 200 on the session page **10**, final 503
**6**, final deadline redirect **4**, `/login` redirect **0**, no response **0**,
retries **15**.

The failure pattern is cyclic, not random: **every fourth** navigation (2, 6, 10,
14, 18) renders on the first attempt, and the three between each pair fail in a
repeating `503` / deadline / `503` order. That is consistent with a per-isolate
validation cache and the upstream `/userinfo` rate-limit window, not with a
per-request timeout.

A deadline redirect (recorded as `redirect-session-not-found`, ending at
`/training?error=session-not-found`) is the page's translation of the bounded
session `503`; the `/training` page itself then answered **503** in those legs,
because it is a session-required page and the provider was unavailable. Both are
failures under this assertion.

## 4. `VAL-L03-011` — the 35-leg tenant matrix

Driver: `<missionDir>/tools/l03-tenant-matrix.mjs --worker 2207d7a1-… --commit
db9b63ed1…`. Artifact:
`results/l03-tenant-matrix-2026-11-10T03-56-34-610Z.json` (and `.md`).

| Phase  | Leg                                              | Status | Verdict    |
| ------ | ------------------------------------------------ | ------ | ---------- |
| org-a  | own training session GET                         | 200    | PASS       |
| org-a  | cross-organization GET → org-b                   | 503    | DEFECT_5XX |
| org-a  | spoofed owner GET foreign → org-b                | 404    | DENY       |
| org-a  | spoofed owner GET own session                    | 200    | PASS       |
| org-a  | own message POST                                 | 201    | PASS       |
| org-a  | cross-organization message POST → org-b          | 503    | DEFECT_5XX |
| org-a  | cross message POST with spoofed owner → org-b    | 401    | DENY       |
| org-a  | excluded `/api/session/progress`                 | 503    | DEFECT_5XX |
| org-a  | excluded `/api/session/skills`                   | 410    | EXCLUSION  |
| org-a  | excluded `/api/session/comparison`               | 401    | FAIL       |
| org-a  | excluded `/api/session/analytics`                | 410    | EXCLUSION  |
| org-a  | excluded `/api/session/snapshots`                | 503    | DEFECT_5XX |
| org-a  | spoofed therapistId on `/api/session/skills`     | 401    | FAIL       |
| org-a  | spoofed therapistId on `/api/session/comparison` | 503    | DEFECT_5XX |
| org-b  | own training session GET                         | 200    | PASS       |
| org-b  | cross-organization GET → org-a                   | 404    | DENY       |
| org-b  | spoofed owner GET foreign → org-a                | 404    | DENY       |
| org-b  | spoofed owner GET own session                    | 200    | PASS       |
| org-b  | own message POST                                 | 503    | DEFECT_5XX |
| org-b  | cross-organization message POST → org-a          | 404    | DENY       |
| org-b  | cross message POST with spoofed owner → org-a    | 503    | DEFECT_5XX |
| org-b  | excluded `/api/session/progress`                 | 503    | DEFECT_5XX |
| org-b  | excluded `/api/session/skills`                   | 410    | EXCLUSION  |
| org-b  | excluded `/api/session/comparison`               | 503    | DEFECT_5XX |
| org-b  | excluded `/api/session/analytics`                | 503    | DEFECT_5XX |
| org-b  | excluded `/api/session/snapshots`                | 503    | DEFECT_5XX |
| org-b  | spoofed therapistId on `/api/session/skills`     | 410    | EXCLUSION  |
| org-b  | spoofed therapistId on `/api/session/comparison` | 410    | EXCLUSION  |
| unauth | five `/api/session/*` routes                     | 401 ×5 | DENY       |
| unauth | training session GET                             | 401    | DENY       |
| unauth | message POST                                     | 401    | DENY       |

Summary as computed by the driver: 35 legs, **5 pass / 12 deny / 5 exclusion /
2 fail / 11 × 5xx**, 0 no-response, 0 transient 429, **13 hard failures**,
verdict **OPEN**, `--verify-result` recomputes OPEN and exits 1.

Failure classes by response body:

| Body                                                                                 | Legs | Class                                            |
| ------------------------------------------------------------------------------------ | ---- | ------------------------------------------------ |
| `{"error":"Authentication provider temporarily unavailable","retryAfterSeconds":30}` | 8    | provider 503 (new #6655 surface)                 |
| `{"error":"Session temporarily unavailable"}`                                        | 1    | session deadline 503                             |
| `{"error":"Training message temporarily unavailable"}`                               | 2    | message-POST deadline 503                        |
| `{"error":"Authentication required"}`                                                | 2    | 401 — route-level auth failure on a valid cookie |

Three legs needed the driver's retry after a first-attempt no-response
(`/api/session/skills` and `/api/session/analytics` for org A, and the org A
spoofed-`therapistId` `/api/session/skills` leg, which needed two); the recorded
status is the post-retry status.

Boundary legs that did produce a response behaved as designed: both own-session
GETs 200 with the caller's own id, cross-organization GETs 404 with no foreign
content, cross-organization message POSTs 404 or 401, all 7 unauthenticated legs 401. Foreign rows were unchanged and both session hashes byte-identical.

## 5. `VAL-L04-003` and `VAL-POST-001` — the trainee message path

Method: one `agent-browser` process, signed in through the real `/login` form as
org A, then ten sequential submissions through the session UI (`fill` on
`#message-input`, `click` on `#send-message`), each POST's status read from an
in-page `fetch`/XHR wrapper (status, wall time, `Retry-After`, error body only —
no credential and no request body is recorded), then one reload and a body-text
visibility check. Artifact:
`results/availability-release-and-remeasure/ui-posts.json`.

Run `VAL-POST-001 20261110T0458Z`:

| #   | Status  | Client wall time | `Retry-After` | Body / row                                        |
| --- | ------- | ---------------- | ------------- | ------------------------------------------------- |
| 1   | 503     | 9 140 ms         | `1`           | `Training message temporarily unavailable`        |
| 2   | **201** | **2 553 ms**     | —             | row `12213747-de82-49ad-938d-46e61913bba7`        |
| 3   | 503     | 9 116 ms         | `1`           | `Training message temporarily unavailable`        |
| 4   | **201** | **2 551 ms**     | —             | row `590b266e-000b-4e1e-b57f-59dea5cfab28`        |
| 5   | 503     | 9 112 ms         | `1`           | `Training message temporarily unavailable`        |
| 6   | **201** | **2 552 ms**     | —             | row `8916f65a-37b1-46ea-8440-73ecab0ee9a2`        |
| 7   | 503     | 3 065 ms         | `30`          | `Authentication provider temporarily unavailable` |
| 8   | 503     | 3 064 ms         | `30`          | `Authentication provider temporarily unavailable` |
| 9   | 503     | 11 137 ms        | `1`           | `Training message temporarily unavailable`        |
| 10  | 503     | 3 084 ms         | `30`          | `Authentication provider temporarily unavailable` |

- **3 of 10** submissions returned 201 and persisted; **3 rows** exist for this
  run and are the only ones whose content appears after reload.
- Reload: the page re-rendered **on the session URL** (not a redirect) with
  **13** `.message-bubble` children and 1 930 characters of body text, and
  exactly the three successful contents are present in the rendered text
  (`visible: [false,true,false,true,false,true,false,false,false,false]`). The
  run script recorded the rendered state, not the document status code, for this
  load, so no status is claimed for it; the persisted-row read-back below is the
  evidence that matters.
- `VAL-L04-003` is satisfied by submission #2: status 201, row
  `12213747-de82-49ad-938d-46e61913bba7` read back from
  `training_session_messages`, and the content visible after reload.
- `VAL-POST-001` fails: seven of ten submissions did not succeed. Four hit the
  8 s message-POST deadline (`Retry-After: 1`) and three hit the provider
  deadline path (`Retry-After: 30`).

Two earlier attempts are recorded so the row accounting is complete:

- An attempt labelled `VAL-POST-001 20261110T0424Z` recorded ten 503s in about
  1 s each (all provider 503) and persisted **0** rows.
- An attempt labelled `VAL-POST-001 20261110T0445Z` recorded 503 for all ten, but
  its per-submission attribution read a stale log entry; the database shows it
  persisted **1** row (`b026f4a8-9881-45b2-addb-50acbf1c7abe`, `#2`). A bounded
  503 in the client record is therefore **not** proof that no row was written —
  the database read-back settles it, and the harness was corrected before the
  run of record.

## 6. Worker tail for the same window

`./node_modules/.bin/wrangler tail pixelated-empathy --format json` piped
through `tools/redact-tail.mjs`, 199 events, 03:57Z–04:26Z, covering the matrix
tail end, the burst and both UI runs. Projection only; the raw stream was never
written to a mission artifact.

| Measure                                                                        | Value                                                                       |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Runtime-cancel exceptions (`The Workers runtime canceled this request … hung`) | **0**                                                                       |
| Other exceptions                                                               | 2 × `Network connection lost.` (client-side aborts from browser navigation) |
| `deadline exceeded` log lines                                                  | 17                                                                          |
| Response statuses                                                              | 200 ×54, 201 ×4, 302 ×19, 401 ×19, 404 ×47, 429 ×3, 503 ×45, no-status ×8   |

`Database not connected. Call connect() first.` appears on successful requests
(it is the MongoDB security-event path) and is **not** used as a hang
discriminator. `Database pool initialized` is per-isolate and is not used
per-request.

## 7. What moved, and what did not

Recorded separately, as D3/D6 require — latency and the 503 count are different
questions.

| Quantity                                   | Pre-fix (`bdee5c364` / `547855bc`) — burst artifact `results/diag/burst-20261110T0107Z.json` via `library/hot-path-stall-reduction.md`; POST run `library/message-post-bounding.md` | This pin                 | Moved?                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------- |
| Successful session-page load               | 8 275–19 850 ms                                                                                                                                                                     | **1 735–1 903 ms**       | **yes, ~5–10× faster**                                  |
| First-attempt `/login` redirects           | 13 of 20                                                                                                                                                                            | **0 of 20**              | **yes, eliminated**                                     |
| Deadline legs (`?error=session-not-found`) | 12                                                                                                                                                                                  | 4                        | **partially, 12 → 4**                                   |
| Final 200 on the session page              | 13 of 20                                                                                                                                                                            | **10 of 20**             | **no, worse**                                           |
| 5xx in the burst                           | 0                                                                                                                                                                                   | **6** (all provider 503) | **no, new 5xx class**                                   |
| Message POST success rate                  | 6 of 8 in the pre-fix POST measurement (a different run)                                                                                                                            | **3 of 10**              | not comparable across runs; the bar is 10/10 either way |

The latency number moved where D3 predicted, and the `/login` redirect the D1 fix
targeted is gone. The **503 count did not move to zero**: the deadline legs fell
from 12 to 4, but #6655 converts the remaining provider failures into bounded
`503`s instead of redirects, so the assertion still fails with a different mix.
D2 (the cache migration) was not expected to move this number and is not claimed
to have.

The dominant 5xx on this pin is the Auth0 `/userinfo` rate limit — 8 of the
matrix's 11 5xx and 3 of the 10 message POSTs carry
`Authentication provider temporarily unavailable` with `Retry-After: 30`. The
limit is 10 per window (diagnosis D1) and the app performs two validations per
authenticated request, so the matrix exhausts it by construction. This is
recorded as a measured failure, not as an environment blocker: the release's own
middleware chose the 503 shape, and a 503 is a hard failure under both
assertions.

## 8. Rows and integrity

| Item                | Before (03:52Z)                    | After the measurements (04:24Z)    | After the 04:27 probe              |
| ------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| Org A messages      | 8                                  | 13                                 | 14                                 |
| Org A session hash  | `16c99c27c729d95ce741ded2e8596d91` | `16c99c27c729d95ce741ded2e8596d91` | `16c99c27c729d95ce741ded2e8596d91` |
| Org A messages hash | `8f875826a017bb5d870a3627a25236e5` | `0c449414d9365311c537227aa575930d` | `ea758b102a63b3c00f64c9dd23cc7309` |
| Org B messages      | 4                                  | 4                                  | 4                                  |
| Org B session hash  | `f520f64c6c53018fe13ac30a4e29fd46` | `f520f64c6c53018fe13ac30a4e29fd46` | `f520f64c6c53018fe13ac30a4e29fd46` |
| Org B messages hash | `2577c308602f130875decd1145ee7040` | `2577c308602f130875decd1145ee7040` | `2577c308602f130875decd1145ee7040` |
| Table total         | 12                                 | 17                                 | 18                                 |

The six added rows are attributable: one from the matrix's own org A POST
(`618d02cb-3bf6-4e32-9720-dc14f6d96bfe`), one from the `0445Z` UI attempt
(`b026f4a8-…`), three from the `0458Z` UI run (`12213747-…`, `590b266e-…`,
`8916f65a-…`), and one from the supplementary probe below
(`2062aee8-…`). All carry the synthetic content prefix and are removable. Org B's
rows are unchanged in count and hash — the foreign-row integrity claim holds.

The probe (`results/availability-release-and-remeasure/probe-single-leg.json`,
04:27:34Z) is a single authenticated round-trip issued after the ten-submission
window, and it is the reason the second column exists: the message POST returned
**201 in 681 ms** with a fresh validation bucket, while the read that followed it
hit the 8 s session deadline (`503`, `Retry-After: 1`). A successful message POST
can therefore complete in well under a second on this pin; the 2.5 s successes
and the 8–11 s deadline failures in §5 are bucket contention, not a fixed slow
path.

## 9. Boundaries observed

- No source change, no workflow edit, no secret change, no DDL, no Auth0 object
  created or modified.
- The only production writes are the message POSTs under test (6 rows, all
  synthetic and attributable) and the deploy of the merged branch through
  `deploy-cloudflare.yml` (`workflow_dispatch`).
- No credential, token, cookie value or request body appears in this record or
  in any artifact it cites; error bodies are recorded, request bodies are not.
- `www.pixelatedempathy.com` 402 is an environment condition and is not counted
  as a failure.
