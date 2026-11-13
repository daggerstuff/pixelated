# Hardening residual repairs: release `5544661f4` and the two new assertions (2026-11-11)

Release record for the `hardening-regression-release` feature. It merges the
regression-and-residual fix PR, deploys it, and proves `VAL-UX-003` and
`VAL-IDENT-003` on the release it produces. It is not a re-measurement of the
whole milestone: the other assertions were measured on `a2f06cc38` and keep that
attribution (`evidence/hardening-release-a2f06cc38-2026-11-11.md`,
`library/release-pin.md` §0.21).

| Item                                | Value                                                                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Pin at feature start (live read)    | `a2f06cc38fe19f53c2788f79cfcff22d576dd5b1` (+ docs-only `e597fe6da`, `aacae4c44`) / Worker `a6028a07-9534-4bcd-a9b8-47dc602d1dbc` (§0.21) |
| **Pin this feature produced**       | **`5544661f4710ee660fe11f4c51c614adf6e6a3ee` / Worker `42310b03-63c5-4750-81b3-a756ad1cc02f`** (§0.22)                                    |
| `origin/staging` HEAD at final read | `5544661f4710ee660fe11f4c51c614adf6e6a3ee`                                                                                                |
| Worker traffic                      | **100%**                                                                                                                                  |
| Worker version created              | 2026-11-11T12:57:08.848Z                                                                                                                  |
| Deployment created                  | 2026-11-11T12:57:10.833Z                                                                                                                  |
| Pin read at                         | 2026-11-11T12:57Z, re-read 2026-11-11T13:01Z (unchanged)                                                                                  |
| Reader                              | `./node_modules/.bin/wrangler deployments status --name pixelated-empathy`, wrangler 4.158.0                                              |

The pin was read **live before anything was merged**. It returned §0.21's
release, so the PR was merged on top of the pin that was actually serving, not
on an assumed one.

## 1. The merge, and the combined head

| #     | Subject                                                                                                 | Head        | Own head CI                                                                                                                                                                                                                                                                                                                           | Merged                                     |
| ----- | ------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| #6720 | `fix(training): scroll the trainee aside, provision registration with a workspace, drop a dead handler` | `845b284e1` | **green**: `CI`, `Quality`, `Security Scanning`, `Bundle size`, `Advisory Tests — Core + Lib`, `Advisory Tests — Frontend`, `Advisory Tests — Agents`, `Smoke Tests`, `Usability / Accessibility Tests`, `Browser Compatibility Tests`, `Lighthouse CI`, `px Agent CI`, `Vercel Deploy`, `Qodo Merge` — 15 runs, 0 failing, 0 pending | 2026-11-11T12:48:07Z, squash → `5544661f4` |

It was merged only after reading **its own head** CI. Its diff is confined to the
2026-11-11 owner grant:

| File                                                     | Change                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/web/src/pages/training/session/[sessionId].astro`  | `+15 −2` — `session-aside` class on both asides, desktop scroll rule       |
| `apps/web/public/js/training-session.js`                 | `+0 −12` — dead `handleSessionUpdate` removed                              |
| `apps/web/src/lib/db/index.ts`                           | `+30 −2` — `createUser` resolves the workspace before inserting            |
| `apps/web/src/lib/db/workspace.ts`                       | new — shared `DEFAULT_WORKSPACE_SLUG`, `WorkspaceResolutionError`          |
| `apps/web/src/pages/api/auth/register/route.ts`          | `+43 −1` — named 409 for a workspace failure, `unknown` catch              |
| `apps/web/src/lib/auth/user-identity.ts`                 | `+4 −2` — uses the shared slug constant                                    |
| four test files                                          | `+536` — aside reach, workspace resolution, register mapping, dead handler |
| `planning/.../hardening-release-a2f06cc38-2026-11-11.md` | `+34 −9` — the v1→v2 namespace correction                                  |
| `planning/.../hardening-residual-repairs-2026-11-11.md`  | new — the repair feature's own record                                      |

No workflow, migration, DDL, Auth0 object, public route or clinical gate changed.

**Combined-head check.** "Every PR green on its own head" does not prove the
merged result is green, so staging CI was read on the resulting head before the
deploy was read:

| Item                                             | Run                                                            | Result                                             |
| ------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------- |
| Staging `CI` on `5544661f4`                      | `43023487504`                                                  | **success** (`build-test`, 240 s)                  |
| Staging `Quality` on `5544661f4`                 | `43023487362`                                                  | **success**, all jobs                              |
| Milestone gate re-run locally on the merged head | detached worktree at `5544661f4`, `./node_modules/.bin/vitest` | **81 files / 1 127 tests passed**, exit 0, 21.36 s |
| The four new/updated suites alone                | same worktree, `VITEST_TARGET_TESTS`                           | **4 files / 25 tests passed**, exit 0              |

The worktree was removed and `git worktree prune` run afterwards; `vitest
4.1.12` and `wrangler 4.158.0` still resolve from the primary tree. No `pnpm`
command ran inside the worktree.

## 2. The deploy, read as a job list

| Job                         | Status                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `Detect app-facing changes` | completed **success**                                                                         |
| `Check deploy credentials`  | completed **success**                                                                         |
| `Build Cloudflare bundle`   | completed **success** — `git log -1 --format=%H` = `5544661f4710ee660fe11f4c51c614adf6e6a3ee` |
| `Deploy to Cloudflare`      | completed **success** — `git log -1` = `5544661f4710ee660fe11f4c51c614adf6e6a3ee`             |

Run `43024336642`, conclusion **success**, event `workflow_run`,
`headSha=5544661f4`. **No job was skipped**, so the §0.20/§0.21 skipped-deploy
trap did not fire and no re-dispatch was needed.

The deploy log's `Current Version ID:
42310b03-63c5-4750-81b3-a756ad1cc02f` matches the live read, and the live read
**changed** from `a6028a07-9534-4bcd-a9b8-47dc602d1dbc`. Both facts are required:
a green conclusion alone has already been wrong twice in this milestone.

Production after the deploy: apex `/` and `/api/health` **200**; `www` root
**301** → `https://pixelatedempathy.com/`.

## 3. `VAL-UX-003` — the trainee aside is keyboard-reachable — **PASS (deployed DOM)**

Tool: `tools/probe-aside-focus.mjs`, which signs org A in through the real login
form, opens `/training/session/33333333-3333-4333-8333-333333333333`, and for
**every** focusable control in **each** aside records its rect before and after
`focus()`, the aside's visible box, and whether the control lies inside both that
box and the viewport.

Two runs on this pin: `--mode baseline` (the page **as served**) and `--mode
fixed` (the shipped rules injected). Both produced identical results, which is
the point of re-probing: the deployed DOM carries the fix, not only the
injection.

| Viewport | Aside          | client / scroll | `overflow-y` / `min-height` | Control                  | Focused | Visible when focused | After-focus rect | Aside box   | `scrollTop` after focus |
| -------- | -------------- | --------------- | --------------------------- | ------------------------ | ------- | -------------------- | ---------------- | ----------- | ----------------------- |
| 1440x900 | left (aside0)  | 660 / **1 205** | `auto` / `0px`              | `button` "Retry"         | yes     | **yes**              | 570.8–592.8      | 162.8–822.6 | **545**                 |
| 1440x900 | right (aside1) | 660 / 660       | `auto` / `0px`              | `textarea#session-notes` | yes     | **yes**              | 596.8–724.8      | 162.8–822.6 | 0                       |
| 1024x900 | left (aside0)  | 632 / **1 205** | `auto` / `0px`              | `button` "Retry"         | yes     | **yes**              | 570.8–592.8      | 190.8–822.6 | **573**                 |
| 1024x900 | right (aside1) | 632 / 632       | `auto` / `0px`              | `textarea#session-notes` | yes     | **yes**              | 624.8–752.8      | 190.8–822.6 | 0                       |

Summary, both modes: `probedViewports: 2`, `controlsMeasured: 4`,
`focusable: 4`, `visibleWhenFocused: 4`, `notVisible: []`,
`asideOverflowY` = `auto` on all four aside/viewport pairs.

**Before-numbers, measured with the same tool on `a2f06cc38` / Worker
`a6028a07`** (`results/hardening-regression-and-residual-fixes/aside-focus-baseline-a2f06cc38.json`):

|                               | Before (`a2f06cc38`, served) | After (`5544661f4`, served) |
| ----------------------------- | ---------------------------- | --------------------------- |
| Controls measured             | 4                            | 4                           |
| Visible when focused          | **2**                        | **4**                       |
| `notVisible`                  | `button "Retry"` ×2          | `[]`                        |
| Aside `overflow-y`            | `visible`                    | `auto`                      |
| Retry `scrollTop` after focus | **0** (stuck)                | 545 / 573                   |

The overflowing column is the **left** (client-state) aside, as the corrected
assertion says. `#session-notes` lives in the **right** aside, which fits at both
viewports and was never the defective control; it is measured and reported
anyway because the assertion says "every focusable control in both asides".

One observation recorded rather than smoothed over: the code comment shipped with
the fix still says the focusable `#session-notes` textarea "sits entirely below
the clip line". That is the element-naming mistake the assertion was corrected
for — the left aside's Retry button is the hidden control. The comment is wrong
prose, not wrong behaviour, and it is not repaired here because the release
feature owns no source change.

## 4. `VAL-IDENT-003` — registration never fails because a workspace is missing — **PASS (live)**

### 4.1 The handler is mounted at `/route`

`apps/web/src/pages/api/auth/register/route.ts` is the only `route.ts` under
`src/pages/api`, so Astro treats it as a page file named `route`.

| Request                                     | Status  | Body                                                                                         |
| ------------------------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `POST /api/auth/register` (documented path) | **404** | the site's 404 page HTML                                                                     |
| `POST /api/auth/register/route`, empty body | **400** | `{"error":"Invalid input: expected string, received undefined"}`                             |
| `POST /api/auth/register/route`, valid body | **201** | `{"message":"User registered successfully","userId":"2c5513f4-dd73-4b73-ba17-9cb7ecc356e1"}` |

The `404` on the documented path is a **pre-existing routing defect and out of
grant** (the mission forbids public routing changes). It is recorded, not fixed,
and it is **not** scored as `VAL-IDENT-003` passing or failing. The `/route` path
is the one probed.

The valid body was `{"fullName":"L03 Probe","email":"l03-register-probe-20261111T125902Z@example.invalid","password":"…","termsAccepted":true}`,
sent with `Origin: https://pixelatedempathy.com`. The password is a throwaway
literal for a synthetic account and is not a credential of any real identity.

### 4.2 The 2xx provisions a workspace

Read-back on the configured Neon database for the returned `userId`:

| Column         | Value                                                 |
| -------------- | ----------------------------------------------------- |
| `id`           | `2c5513f4-dd73-4b73-ba17-9cb7ecc356e1`                |
| `email`        | `l03-register-probe-20261111T125902Z@example.invalid` |
| `role`         | `user`                                                |
| `workspace_id` | `00000000-0000-0000-0000-000000000001`                |
| `created_at`   | 2026-11-11T12:59:06.041Z                              |

`workspaces` holds exactly one row with slug `personal`
(`00000000-0000-0000-0000-000000000001`, name `Personal`), so the created user
landed on the seeded default workspace rather than on `NULL`.

The probe row was then deleted by its synthetic email — `deleted:
[2c5513f4-…]`, `remainingAfterDelete: 0`. `users` is back to 4 rows.

### 4.3 The before-state, stated alongside the after-state

On `a2f06cc38`, `POST /api/auth/register/route` with a valid body returned
**`500 {"error":"Internal server error"}`** and the route emitted **no error log
line at all** — it swallowed the failure. A rolled-back `INSERT` of the old shape
reproduced the cause.

Re-measured on this pin inside a transaction that was rolled back, to prove the
fix is in code and not a schema relaxation:

```json
{
  "columnNullable": "NO",
  "oldShapeInsert": {
    "code": "23502",
    "column": "workspace_id",
    "message": "null value in column \"workspace_id\" of relation \"users\" violates not-null constraint"
  },
  "residualRows": 0
}
```

So the constraint is still `NOT NULL`, the old shape still raises `23502`, and
the live route no longer reaches that shape because `createUser` supplies
`workspace_id`. **No DDL and no migration was used.**

### 4.4 The deliberate-4xx half

The 409 `{code:"WORKSPACE_UNAVAILABLE"}` branch cannot be induced live without
deleting the seeded workspace, which is destructive and out of scope. It is
proven at test level: `apps/web/src/pages/api/auth/register/__tests__/register-workspace.test.ts`
— 4 cases, green on the deployed commit (2 of them failed before the fix), and
`apps/web/src/lib/db/__tests__/create-user-workspace.test.ts` — 3 cases, green
(3 failed before the fix).

## 5. The fix did not undo the milestone's other work

### 5.1 Pointer-only click still reaches `#send-message` at 1440x900 — **PASS**

`tools/probe-pointer-click.mjs --configs 1440x900:none` drives the same
coordinate `agent-browser click '#send-message'` the submission harness uses.

| Field                          | Value                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `click.accepted`               | **true** (not refused, no covering element)                                                                           |
| `status`                       | **201**                                                                                                               |
| Request line                   | `POST …/api/training/sessions/33333333-…/messages (Fetch) 201`                                                        |
| DOM hit at the click point     | `path` (the button's SVG child)                                                                                       |
| Gap button-bottom → footer-top | 16 px                                                                                                                 |
| Row persisted                  | `6d08079d-180c-8ebc-b6ef-92bebf448332`, content `L03 SYNTHETIC — DO NOT USE VAL-UX-002 pointer probe 1440x900:none …` |

The row is scored, not the status: the mission has already seen a `503` for a
submission that did persist, and the reverse. Here both agree.

### 5.2 The 320px layout still has no horizontal overflow — **PASS**

`tools/probe-send-control.mjs --widths 320,1440 --heights 900`:

| Viewport | `scrollWidth − innerWidth` | Send control hit test                                                                                                  |
| -------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 320x900  | **0**                      | `null` — the button is at document `y` 9 445 with `scrollY` 2 166, i.e. far below the fold; the document scrolls to it |
| 1440x900 | **0**                      | `path`, `hitIsButtonOrDescendant: true`                                                                                |

The 320 result is a pre-existing mobile property, not a regression from this
release: the previous record observed the same below-the-fold geometry at
320x568. The requirement is the overflow number, and it is 0 at both widths.

## 6. Rows and cleanup

| Snapshot                     | UTC                              | `training_session_messages` | org A   | org B  |
| ---------------------------- | -------------------------------- | --------------------------- | ------- | ------ |
| Before this feature's writes | 2026-11-11T10:51Z (prior record) | 136                         | 125     | 11     |
| After this feature's writes  | 2026-11-11T13:01:02Z             | **137**                     | **126** | **11** |

The +1 is the pointer probe's message. Org B is untouched. Session hashes are
unchanged from the prior record (org A `16c99c27c729d95ce741ded2e8596d91`, org B
`f520f64c6c53018fe13ac30a4e29fd46`). The registration probe's `users` row was
deleted; `users` totals 4, `workspaces` 3, `auth_accounts` 2, `sessions` 2.

**No mission-marked message row was reversed** — the owner has decided to keep
them. Nothing outside the mission's synthetic marker was written, updated or
deleted.

## 7. What this record does not claim

- It does not re-measure the milestone's other assertions; they keep their
  `a2f06cc38` attribution.
- It does not claim the `409 WORKSPACE_UNAVAILABLE` branch was observed live; it
  is proven at test level, and the live 2xx branch is the one measured.
- It does not claim the documented `/api/auth/register` path works; it answers
  404 by a pre-existing routing defect that is out of grant.
- It does not claim the Auth0 `/userinfo` ceiling is fixed; the tenant was not
  touched and that is the owner's action.
- It does not treat the Vercel standby as available; it is still unavailable by
  cause (`UNPAID_INVOICE`) and nothing here changes that.
- It does not claim the 320px send control is reachable without scrolling; it is
  below the fold, as before. The overflow requirement passes.

## 8. Artifacts

Under `<missionDir>/results/hardening-regression-release/`:

| File                                   | Contents                                                          |
| -------------------------------------- | ----------------------------------------------------------------- |
| `aside-focus-baseline-5544661f4.json`  | `VAL-UX-003` on the served DOM, both viewports, per-control rects |
| `aside-focus-fixed-5544661f4.json`     | the same with the shipped rules injected (parity check)           |
| `pointer-send-1440-5544661f4.json`     | the pointer-only click, its hit test and the persisted row        |
| `send-control-overflow-5544661f4.json` | hit test and `horizontalOverflow` at 320x900 and 1440x900         |
| `row-state-after-5544661f4.json`       | table totals, per-org counts and hashes                           |

The before-state artifacts stay under
`results/hardening-regression-and-residual-fixes/` (`aside-focus-baseline-a2f06cc38.json`,
`aside-focus-fixed-a2f06cc38.json`, `composer-with-aside-scroll-a2f06cc38.json`).

The pin is recorded in `library/release-pin.md` §0.22.
