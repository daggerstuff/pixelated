# Hardening milestone: the regression repair and three residual fixes (2026-11-11)

Record for feature `hardening-regression-and-residual-fixes`. It repairs the one
regression the hardening milestone introduced and the three residuals scrutiny
found, and it stops at an **open PR** — nothing in this record is deployed.

| Item | Value |
| --- | --- |
| Release measured for the baseline | **`a2f06cc38fe19f53c2788f79cfcff22d576dd5b1` / Worker `a6028a07-9534-4bcd-a9b8-47dc602d1dbc`** (live read 2026-11-11T12:1xZ, 100% of traffic) |
| `origin/staging` HEAD at branch time | `aacae4c4459dc93b2ac95715da1c4fe231d3bee6` (docs-only on top of `a2f06cc38`) |
| Worktree | `/home/vivi/pixelated-worktrees/hardening-regression-and-residual-fixes`, branch `mission/hardening-regression-and-residual-fixes` |
| Baseline probe window | 2026-11-11T12:18:33Z–12:18:37Z (VAL-UX-003), 12:19:21Z (composer) |
| Post-fix measurement | **not possible here.** The repair is on an open PR; the release feature that merges and deploys owns the post-fix live re-measurement |
| Reader | `agent-browser` (Chromium) via `tools/probe-aside-focus.mjs` and `tools/probe-layout-candidate.mjs` |

The assertions this feature fulfils are `VAL-UX-003` and `VAL-IDENT-003`; it also
removes a second dead handler of the `VAL-L04-008` class and corrects a factual
error in `hardening-release-a2f06cc38-2026-11-11.md`.

## 1. VAL-UX-003 — the trainee aside is keyboard-reachable, not clipped

### 1.1 What was measured, and a correction to the premise

The contract describes the failing control as `#session-notes` and the
overflowing container as "the trainee aside". On this pin at these viewports the
overflow is in the **left** trainee column, and the focusable control it hides is
the vitals monitor's **Retry** button; `#session-notes` is in the **right**
trainee column, whose content fits at both viewports and is therefore already
visible. The mechanism is exactly the one the contract names — `overflow: clip`
on `.session-panes` removes the focus-scroll path, and an aside taller than the
row is clipped — so the repair is the same. The table records what was seen, not
what was expected.

Measured on `a2f06cc38` / Worker `a6028a07` with the page as served. Each aside
is a sibling of the transcript column; `visibleWhenFocused` requires the
control's rect to lie inside the aside's visible box **and** inside the viewport.

**1440×900** — aside visible box `162.8–822.6` (height 659.8)

| Aside | `overflow-y` | client / scroll height | Control | Rect before focus | Rect after focus | Focused | Visible when focused |
| --- | --- | --- | --- | --- | --- | --- | --- |
| left (client state) | `visible` | 660 / **1205** | `button` "Retry" | `1115.8–1137.8` | `1115.8–1137.8` | yes | **no** |
| right (guidance) | `visible` | 660 / 660 | `textarea#session-notes` | `596.8–724.8` | `596.8–724.8` | yes | yes |

**1024×900** — aside visible box `190.8–822.6` (height 631.8)

| Aside | `overflow-y` | client / scroll height | Control | Rect before focus | Rect after focus | Focused | Visible when focused |
| --- | --- | --- | --- | --- | --- | --- | --- |
| left (client state) | `visible` | 632 / **1205** | `button` "Retry" | `1143.8–1165.8` | `1143.8–1165.8` | yes | **no** |
| right (guidance) | `visible` | 632 / 632 | `textarea#session-notes` | `624.8–752.8` | `624.8–752.8` | yes | yes |

The left aside's `scrollHeight` (1205) against its `clientHeight` (660 at
1440×900, 632 at 1024×900) reproduces the ~660/~1205 shape the contract records.
Its control is focused (`document.activeElement` is the button) and painted
nowhere: 293–324px below the container's bottom edge and below the viewport.
`scrollTop` stays `0` after focus, which is the regression: with `overflow: clip`
on the row there is no scrollable ancestor to move.

### 1.2 The repair, and the same probe with it applied

The repair gives each trainee aside `min-height: 0; overflow-y: auto` inside the
existing `min-width: 769px` block, and leaves `.session-panes { overflow: clip }`
untouched. The probe applies exactly that — the `session-aside` class on both
asides plus the rule — to the same live page:

#### 1440×900

| Aside | `overflow-y` | min-height | Control | Rect after focus | Aside `scrollTop` after focus | Visible when focused |
| --- | --- | --- | --- | --- | --- | --- |
| left | `auto` | `0px` | `button` "Retry" | `570.8–592.8` | **545** | **yes** |
| right | `auto` | `0px` | `textarea#session-notes` | `596.8–724.8` | 0 | yes |

#### 1024×900

| Aside | `overflow-y` | min-height | Control | Rect after focus | Aside `scrollTop` after focus | Visible when focused |
| --- | --- | --- | --- | --- | --- | --- |
| left | `auto` | `0px` | `button` "Retry" | `570.8–592.8` | **573** | **yes** |
| right | `auto` | `0px` | `textarea#session-notes` | `624.8–752.8` | 0 | yes |

Every focusable control in both asides is now focused and visible at both
viewports (4 of 4; 2 of 4 before).

### 1.3 The composer is still the pointer's target (VAL-UX-002 preserved)

With the same repair applied, `tools/probe-layout-candidate.mjs` re-runs the
VAL-UX-002 measurement:

| Viewport | `elementFromPoint` at the send centre | Hit is the button or its child | Button bottom → footer top | Horizontal overflow | Transcript scrolls |
| --- | --- | --- | --- | --- | --- |
| 1440×900 | `path` (the button's SVG child) | **yes** | 16px | 0 | yes |
| 1024×900 | `path` (the button's SVG child) | **yes** | 16px | 0 | yes |

The row is still `overflow: clip` in the layout chain
(`div.flex-1.flex.session-panes … ov=clip`), the transcript still scrolls
(`scrollHeight 8716` vs `clientHeight 391`), and the send control keeps its
128px height. An aside is a sibling of the transcript column, so its scroll
cannot move the composer.

### 1.4 Structural guard

`apps/web/src/pages/training/__tests__/session-aside-keyboard-reach.test.ts`
pins the source: both asides carry `session-aside`, the desktop block declares
`overflow-y: auto` and `min-height: 0` for it, `.session-panes` still declares
`overflow: clip`, the mobile block does **not** make the aside a nested scroll
box, and the aside holding `#session-notes` carries the class. It fails against
the pinned source (4 of its 8 cases) and passes after the repair.

## 2. VAL-IDENT-003 — registration never fails because a workspace is missing

### 2.1 The defect, measured live

`db/migrations/011_add_workspace_id_to_users.sql` enforces
`users.workspace_id NOT NULL`. Read-only introspection of the target database
(`ep-spring-firefly-a5ka84py/pixelated`):

```console
users.workspace_id: [{"is_nullable":"NO","column_default":null,"data_type":"uuid"}]
personal workspace: [{"id":"00000000-0000-0000-0000-000000000001","slug":"personal"}]
```

The user-creation path inserts without that column. Executed against the
database inside a transaction that was rolled back (no row written):

```console
rows for probe email before: 0
INSERT failed: code=23502 column=workspace_id constraint=(none)
message=null value in column "workspace_id" of relation "users" violates not-null constraint
rows for probe email after rollback: 0
```

The route, measured on the live pin:

```console
$ curl -s -o /dev/null -w '%{http_code}\n' -X POST \
    https://pixelatedempathy.com/api/auth/register/route \
    -H 'Content-Type: application/json' -H 'Origin: https://pixelatedempathy.com' \
    --data '{"fullName":"Mission Probe","email":"mission-register-probe-20261111@example.test","password":"synthetic-probe-password","termsAccepted":true}'
500
$ # body: {"error":"Internal server error"}
```

A redacted `wrangler tail` window covering the request (`scriptVersion`
`a6028a07-9534-4bcd-a9b8-47dc602d1dbc`) shows the request at `status: 500`, the
pool initialising, and a client acquired — and **no** error line, because the
route's `catch` returned a generic 500 without logging. The `23502` therefore
does not appear in the route's logs on this pin; it is reproduced directly
against the database above instead. `users` gained no row for the probe email.

**Mount path, recorded as a finding rather than repaired.** The handler is
mounted at **`/api/auth/register/route`**, not `/api/auth/register`:
`apps/web/src/pages/api/auth/register/route.ts` is the repository's only
`route.ts` under `src/pages/api`, and Astro treats it as a page file named
`route` (`POST /api/auth/register` → 404; `POST /api/auth/register/route` →
400 on an empty body, 500 on a valid one). Renaming the file would change a
public route, which this mission's grant forbids, so it is left alone. No
front-end caller posts to `/api/auth/register`.

### 2.2 The repair

`UserManager.createUser()` now resolves the seeded `personal` workspace before it
inserts and supplies `workspace_id` on the INSERT. The resolution is the same one
`createUserWithLink()` performs, sharing one slug constant
(`apps/web/src/lib/db/workspace.ts`) so the two paths cannot drift. When the
workspace is absent the call throws `WorkspaceResolutionError` **before** any
INSERT, and the route answers `409` with
`{ error: <reason naming the workspace>, code: "WORKSPACE_UNAVAILABLE" }`. A
residual `23502` on `users.workspace_id` is mapped to the same `409` as a
backstop, so the opaque `500` cannot return through this path. No DDL, no
migration, no schema change.

### 2.3 Test proof

- `apps/web/src/lib/db/__tests__/create-user-workspace.test.ts` — a scripted fake
  pool observes the statements. It pins that the INSERT names `workspace_id` and
  carries the resolved id; that an absent workspace rejects with
  `WorkspaceResolutionError` naming `personal` and issues **no** INSERT; and the
  error message. Fails against the pinned source (3 of 3 cases: the code issued
  only the INSERT, so the scripted read returned the user id).
- `apps/web/src/pages/api/auth/register/__tests__/register-workspace.test.ts` —
  the route maps a workspace failure and a `23502` to a `4xx` with the code, and
  keeps `500 {"error":"Internal server error"}` for an unexpected failure. Fails
  against the pinned route (2 of 4 cases: both returned `500`).

## 3. VAL-L04-008 class — the second dead handler is gone

`apps/web/public/js/training-session.js` defined `handleSessionUpdate(data)`,
which called `this.updateSessionState(data.sessionState)` — a method the script
never defines. Nothing called the handler, so the `TypeError` was latent. The
handler and its body are removed; there was no other wiring to remove.

```console
$ grep -rn "handleSessionUpdate" . --exclude-dir=node_modules --exclude-dir=.git
apps/web/src/lib/documentation/DocumentationSystem.ts:74:    void this.handleSessionUpdate(sessionData.sessionId)
apps/web/src/lib/documentation/DocumentationSystem.ts:136:  private async handleSessionUpdate(sessionId: string): Promise<void> {
$ grep -rn "updateSessionState" apps/web/public/js apps/web/src/pages/training
(no output)
```

The two remaining hits are a private method of an unrelated class
(`DocumentationSystem`), not a call to the training script's removed handler.
`updateSessionState` survives only in `agents/session-agent` (a different module)
and `apps/web/src/lib/stores/appDataStore.ts` (a store action) — neither is
reachable from the training script. The guard cases live in
`apps/web/src/pages/training/__tests__/faculty-vocabulary.test.ts` (three new
cases: the handler is gone, the undefined method is not called, and the live
handlers that only call defined methods are kept).

## 4. The release-record correction

`planning/pilot-readiness-2026-11-04/evidence/hardening-release-a2f06cc38-2026-11-11.md`
claimed the `MESSAGE_KEY_NAMESPACE` `v1`→`v2` bump could produce a
straddling-window duplicate bounded by the deploy. It could not: the namespace
was introduced and bumped to `v2` on the PR #6710 branch (`1cfd9d96f` rewrites
`'training-message:v1'` to `'training-message:v2'`), and the PR landed as a
single squash commit (`ee449b20f`) whose parent contains no `training-message`
literal at all, so staging received `v2` only. The paragraph now says the bump
cost nothing and cites the commands that prove it (reproduced in §4 of that
document). The rest of the record is unchanged.

## 5. What this record does not claim

- It does not claim a post-fix live measurement of any of the four repairs. The
  branch is an open PR; the release feature that merges and deploys owns the
  post-fix probe, and must take it on the release it produces.
- It does not claim `#session-notes` was below the clip line on this pin at these
  viewports. It was not; the hidden control was the left aside's Retry button
  (§1.1). The repair covers both asides.
- It does not claim the registration route is mounted at `/api/auth/register`.
  It is mounted at `/api/auth/register/route` (§2.1); that path is recorded, not
  changed.
- It does not claim the `23502` appears in the deployed route's logs. The route
  does not log the error; the code is reproduced against the database instead.
- It does not claim a 2xx from a live registration after the fix. That needs the
  deployed release.

## 6. Artifacts

- `results/hardening-regression-and-residual-fixes/aside-focus-baseline-a2f06cc38.json`
- `results/hardening-regression-and-residual-fixes/aside-focus-fixed-a2f06cc38.json`
- `results/hardening-regression-and-residual-fixes/composer-with-aside-scroll-a2f06cc38.json`
- `tools/probe-aside-focus.mjs` (read-only; focuses controls and reads the DOM)
