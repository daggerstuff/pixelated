# Pilot gate decision — L03/L04 mission integrity pass, 2026-11-09

**Decision: NO-GO. Preserved, not revised.** This record consolidates the
evidence the L03/L04 mission produced, states each package's gate status, names
the exact blockers, and gives the next smallest closure action for each. It
records blockers; it converts none of them into a ticket and makes no
launch-readiness or pilot-availability claim.

The mission measured two packages, L03 (identity and tenant boundary) and L04
(trainee-to-faculty journey), against a live Cloudflare release, after shipping
four owner-authorized source repairs. The repairs worked where they were aimed:
the identity bridge resolves the Auth0 `sub` to the internal UUID, CSRF tokens
are minted from KV with Redis gone, the trainee interaction surface renders, and
the foreign session is refused. Neither package can close, because on the fix
release the tenant matrix still returns bounded `503` defects on authenticated
reads and the trainee message POST still runtime-cancels on an unbounded path.
Every measurement in this record is bound to the release it was taken on.

## 1. Gate status

Only the gates this mission's packages belong to are restated here. Every other
row of `LAUNCH_DECISIONS.md` is unchanged by this mission and was not touched.

| Gate                                | Result                | Blocking packages                              | Basis                                                                                                                  |
| ----------------------------------- | --------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| G2 Working journey                  | **OPEN**              | L02 OPEN, **L03 OPEN**, **L04 OPEN**, L05 OPEN | L03 and L04 are re-measured on the fix release and fail their exit conditions; see §4 and §5                           |
| G4 Privacy, security and operations | **OPEN**              | **L03 OPEN**, L11 OPEN, L12 OPEN               | Tenant isolation is not proven with zero hard failures; lifecycle, security, restore and incident proof remain missing |
| G1 Product boundary                 | OWNER DECISION        | —                                              | Unchanged by this mission                                                                                              |
| G3 Evaluation and release           | OPEN                  | —                                              | Unchanged by this mission                                                                                              |
| G5 Honest, supportable offer        | OPEN / OWNER DECISION | —                                              | Unchanged by this mission                                                                                              |
| G6 Learning and continuation        | NOT STARTED           | —                                              | Unchanged by this mission                                                                                              |

| Package                          | Gate  | Status   | Owner role           |
| -------------------------------- | ----- | -------- | -------------------- |
| L03 Identity and tenant boundary | G2/G4 | **OPEN** | Application/security |
| L04 Trainee-to-faculty journey   | G2    | **OPEN** | Application/QA       |

The register rows for both packages carry the same status and cite the same
canonical pin as the evidence records (`LAUNCH_DECISIONS.md` lines for L03 and
L04). The register is internally consistent for L03 and L04.

## 2. Evidence

| Artifact                                                          | What it holds                                                                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [l03-tenant-boundary-release.md](l03-tenant-boundary-release.md)  | L03 release pin, the two fix-release matrix runs, sign-in legs, per-leg observations, row integrity, database identity, residual risks, tracker status |
| [l04-journey-release.md](l04-journey-release.md)                  | L04 release pin, sign-in, trainee surface, message persistence, foreign-session refusal, burst, journey step map, findings                             |
| [../LAUNCH_DECISIONS.md](../LAUNCH_DECISIONS.md)                  | Gate and package register; L03 and L04 rows and the G2/G4 summaries                                                                                    |
| [../PILOT_CHARTER.md](../PILOT_CHARTER.md)                        | Accepted planning envelope and owner-decision boundary                                                                                                 |
| `library/release-pin.md` §0                                       | Canonical pin, release lineage, CI provenance, measured-surface equivalence                                                                            |
| `library/l03-matrix-results.md`                                   | The `3bf2bf1b` matrix measurement and the fix-release re-run                                                                                           |
| `library/identity-bridge-repair.md`                               | Identity-bridge repair, its tests, and the residual observations                                                                                       |
| `library/ssr-hang-repair.md`, `library/role-resolution-repair.md` | The two M1c repairs and why each was needed                                                                                                            |
| `library/fix-release-remeasure-2026-11-09.md`                     | The fix-release run log, incidents to disclose, and the row inventory                                                                                  |
| `library/environment.md`, `library/l03-provisioned-identities.md` | Production configuration, the synthetic identities, and reversal                                                                                       |

Result and validation artifacts live under the mission directory
(`<missionDir>/results/`, `<missionDir>/validation/`, `<missionDir>/evidence/`).
That directory is not a git repository, so those artifacts cannot be committed;
this record does not claim they were.

## 3. Release lineage — three measured pins, not one frozen pin

The release under test advanced three times across the mission's measurement
window on 2026-11-09. The cause is outside this mission: automated dependency
merges landed on `staging` (for example `5f7f7c74b`, a Dependabot bump of
`docker/login-action`), alongside this mission's own authorized repair merges and
the parallel session's fix commits (`f475bcc4f`). A result is bound to the
release it was measured on, and no single pin served every measurement.

| Pin                                        | Worker version                         | Deploy run    | What was measured on it                                                                                                                                                        |
| ------------------------------------------ | -------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `3bf2bf1cbc1a60eda6d13396ee8c2137f5c14e56` | `7315171c-2451-41f3-bd8f-d071170996d0` | `42540567372` | L03 35-leg matrix (**PASS**: 6 pass, 15 deny, 14 exclusion, 0 failure, 0 5xx), foreign-row hashes, database readback, CSRF/sign-in probe (6 legs), unauthenticated guard probe |
| `5f7f7c74bb8995faee6e83fbada4b20a6bb378c4` | `2b86c589-6e18-4cff-bfa2-b397c7c2cb1e` | `42557801078` | L04 browser journey — blocked at the trainee UI (§7.1); L03 **carried forward**, not re-measured (§3.1)                                                                        |
| `f475bcc4f920c0d4fc5ff07254328ed2fae5209d` | `a9d4e785-39b1-4197-816a-432618c4c40e` | `42576201750` | The fix release. L03 matrix re-run twice (**OPEN**: 2 and 3 × `503`); L04 journey re-run twice (**OPEN**)                                                                      |

The current live pin, re-read during this integrity pass with
`./node_modules/.bin/wrangler deployments status --name pixelated-empathy`
(exit 0, wrangler 4.158.0), is `a9d4e785-39b1-4197-816a-432618c4c40e` at
**100%**, created 2026-11-09T07:00:15.803Z, deployment 2026-11-09T07:00:18.058Z,
on commit `f475bcc4f920c0d4fc5ff07254328ed2fae5209d`. The staging `CI` run on
that exact SHA is `42575536849` (success) and the deploy run is `42576201750`
(success). Both evidence records name the same pin.

### 3.1 How L03 got from its measured release to the canonical pin

L03 was **measured on `3bf2bf1b` / Worker `7315171c`**, then **carried forward**
to the then-canonical pin `5f7f7c74b` on a **byte-identical measured surface**:
the diff over every path the matrix and the CSRF/sign-in probe exercise
(`apps/web/src/lib/auth`, `lib/security`, `lib/middleware`, `pages/api/auth`,
`pages/api/session`, `pages/api/training`, `lib/services/training`,
`src/middleware.ts`, both `wrangler.jsonc` files, `pages/training`,
`pages/login.astro`, `components/auth`) is **empty** between the two commits.
L03 was **not re-measured on `5f7f7c74b`**, and this record does not present it
that way. The carry-forward ended at the fix release: the dependency graph of the
deployed bundle changed between `5f7f7c74b` and `f475bcc4f`, so L03 was
re-measured twice on `f475bcc4f` rather than carried forward again. That is the
measurement the L03 status rests on now.

## 4. L03 — exact blockers and next smallest closure action

**Status: OPEN.** Both 35-leg runs on the fix release recompute OPEN
(`--verify-result` exits 1). The boundary legs that returned a response behaved
as designed: every own-session read that completed returned `200` with the
caller's own id; every cross-organization read and write that completed was
denied with no foreign content in any body; the five documented legacy
`/api/session/*` routes returned `410` for both organizations (10 base legs) plus
4 spoofed-parameter variants, and those 14 legs are **exclusions, not denials**;
all 7 unauthenticated legs returned `401`; both session hashes are byte-identical
to every earlier read; database identity is proven by reading provisioned rows
back through the deployed Worker as their authenticated owner.

Blockers:

1. **Bounded-deadline `503` on authenticated session reads.** An authenticated
   read can exceed the 8 s deadline (`TRAINING_DATA_DEADLINE_MS = 8_000`,
   `apps/web/src/lib/services/training/session-api.ts:29`) and return `503`
   `{"error":"Session temporarily unavailable"}`. This is a 5xx defect, not a
   denial and not a pass. Run 1 recorded 2 such legs (org B own GET, org B
   spoofed-owner foreign GET); run 2 recorded 3 (org A cross-organization GET,
   org B own GET, org B spoofed-owner own GET). The deadline bounds the hang; it
   does not make the load succeed.
2. **The failing leg set is unstable.** The deadline is a per-request race
   against the pre-pool stall, so which legs land on it varies between runs. Any
   claim of the form "the matrix fails on legs X and Y" is true only for the run
   it came from.
3. **Accepted exclusions with residual risk.** The legacy routes are excluded
   from the pilot surface by design (`410`), and their analytics contract is
   undefined; `/api/session/snapshots` is reachable and carries the same
   unvalidated-UUID gap (§6).

**Next smallest closure action for L03:** eliminate the pre-pool stall on the
authenticated read — bound or remove the unbounded identity and cache work that
runs before `getPool()` is reached — then re-run the same 35-leg matrix on the
new release and re-derive the failing legs from that run rather than copying the
per-run table in the evidence record. Zero hard failures is the bar; a bounded
`503` does not meet it.

## 5. L04 — exact blockers and next smallest closure action

**Status: OPEN.** Sign-in through the real login form works, the trainee
interaction surface renders, and the foreign session is refused. The journey
still cannot be completed. On the same fix release the L03 matrix returns the
bounded `503` on **two matrix legs** in run 1 (three in run 2), so the journey
and the tenant boundary fail together.

Blockers:

1. **The trainee message POST is unbounded and intermittently runtime-cancelled.**
   `POST /api/training/sessions/{id}/messages`
   (`apps/web/src/pages/api/training/sessions/[sessionId]/messages.ts:18`) has no
   deadline. It calls `getSession` → `resolveInternalUserId`, whose
   `resolveRoleFromManagementApi` Management API fetch is unbounded, and only
   then reaches `getPool().query`. The 8 s deadline covers the page data load
   only. Run 1: 4 of 4 UI submissions hung 50–66 s then returned `500` with a
   runtime-cancel exception and wrote 0 rows. Run 2: 2 of 3 returned `201` in
   about 4 s and persisted rows visible after reload, while 1 of 3 reproduced the
   64 s runtime-cancelled `500` with no row. Intermittent is still failed: a 5xx
   inside the leg is a defect, so two successful writes do not make it a pass.
2. **The 20-load availability bar is not met.** The contract requires 20/20
   `200`. Run 1: 17/20 final `200` with **3 of 20 redirected to `/login`**; run
   2: 18/20 with 2 redirects. There are zero runtime-cancelled page loads and
   zero `5xx` in both runs. The `/login` redirect cause is unresolved: client-side
   cookie loss after a browser relaunch and a server-side cause are recorded as
   competing hypotheses, and run 2 saw both redirects with the `auth-token`
   cookie present.
3. **Six journey steps are missing, each with an owner role and none marked
   complete:** approved scenario catalog and session creation (Faculty/clinical
   education + Application/QA); synthetic-client replies (ML/clinical content);
   transcript-grounded coaching/feedback (ML/clinical content + Application);
   retry semantics (Application/QA + Faculty/clinical education); reliable saved
   session (Application/QA); faculty review policy and access (Faculty/clinical
   education + Application/security — disabled by the absent session-to-workspace
   relation, the `supervisor` vs `admin` role vocabulary split, and a dead
   `handleSupervisorIntervention` calling an undefined `showSupervisorMessage`);
   and a reachable reconnect/events endpoint (Application/platform).

**Next smallest closure action for L04:** bound the message-POST path the way the
page load is bounded (or remove the pre-pool stall it waits on), then re-run the
journey plus the 20-load burst on the new release. Separately, discriminate the
two `/login` hypotheses with a no-relaunch run that records the cookie before
every request and captures a Worker tail across the redirect, and decide the
faculty-review policy. No API call may be substituted for the UI assertion, no
failed leg may be recorded as a pass, and no missing step may be marked complete.

## 6. Residual identity-boundary risks and accepted exclusions

Carried forward verbatim in substance from
[l03-tenant-boundary-release.md](l03-tenant-boundary-release.md) §9. None is
fixed by this mission, and none is a launch-readiness claim.

- **The email-keyed upsert coalescing path.** `resolveIdentity()` upserts a `users`
  row keyed by email when no `auth_accounts` link exists
  (`apps/web/src/lib/auth/user-identity.ts:112-121`). A token carrying no email
  claim inserts `''`, which is UNIQUE, so two distinct Auth0 `sub`s could
  coalesce onto one internal user. The provisioned pilot identities carry
  explicit `auth_accounts` links and take the `findInternalIdBySub` path, so they
  are unaffected. This is pre-existing bridge behaviour shared with
  `auth0-middleware`; fixing it would be an unapproved auth change.
- **The legacy-route UUID validation gap.** The legacy `/api/session/*` routes do not
  validate that `sessionId` is a UUID before querying, so a non-UUID value still
  produces PostgreSQL `22P02` → `500`. Their happy path is unreachable by design
  (documented `410` exclusion), but `/api/session/snapshots` is reachable and
  carries the same gap: an unvalidated non-UUID `sessionId` reaches `id = $1` and
  `500`s. To be recorded when the analytics contract is defined.
- **Accepted exclusions.** `/api/session/progress`, `/skills`, `/comparison`,
  `/analytics` and `/snapshots` are excluded from the pilot surface and answer
  every authenticated caller with `410`. Their legs are exclusions, never
  authorization denials, and they serve no organization's data.
- **Dev- tenant naming.** Both synthetic identities live in
  `dev-f3vkhvb6n52y7fre.us.auth0.com`, which is the tenant the production Worker
  uses for sign-in. Its `dev-` name is an unresolved identity-boundary naming
  risk for the owners.
- **Transient first-attempt no-responses.** The matrix artifact's
  `summary.noResponse` (0 in both runs) counts legs that ended without a response
  after retries; the first-attempt no-response count in `legs[].attempts` is 6
  (run 1) and 5 (run 2). They measure different things and both are correct.

## 7. Release provenance

### 7.1 The trainee-UI blocker on the earlier pin — exact cause, since closed

On `5f7f7c74b` / Worker `2b86c589`, the synthetic access token carried no
`https://pixelated.empathy/app_metadata` claim. `extractRoleFromPayload`
(`apps/web/src/lib/auth/auth0-jwt-service.ts:391-427`) reads that namespaced
claim, so every role resolved to `guest`; the trainee gate at
`apps/web/src/pages/training/session/[sessionId].astro:85-87`
(`isTrainee = userRole === 'therapist' || userRole === 'user'`) was false, and
the session page rendered no `#message-input`. That made the
message-persistence leg unmeasurable without an owner-authorized auth change.
The owner authorized app-side role enrichment in the token-validation path (not
an Auth0 Action; the tenant was not modified), and on the fix release the gate
evaluated true for an identity whose `app_metadata.roles` is `["therapist"]` and
the trainee surface rendered. This blocker is closed; it is not the current
state.

### 7.2 The request hang — a regression this mission introduced

The intermittent request hang is **not pre-existing and not network flakiness**.
The identity-bridge repair added an identity-resolution await in front of the
Postgres pool: `const therapistId = await resolveInternalUserId(session.user)` at
`apps/web/src/lib/services/training/session-api.ts:89` when the repair landed
(line 130 on the fix release, after the deadline wrapper added lines above it).
It combined with `ensureConnected` (`apps/web/src/lib/redis.ts:44-51`)
memoizing a connect promise it never cleared on failure, and an unconditional
identity-cache read (`apps/web/src/lib/auth/user-identity.ts:80`) against an
unreachable Redis host. Before the repair the route failed **fast** with
PostgreSQL `22P02`; after it, a request could hang until the runtime cancelled it.

The observed symptom, in the corrected characterization: during a 20-request
authenticated browser burst on `5f7f7c74b`, **about half the training-page loads
failed with Cloudflare Error 1101** and the security log carried
`Database not connected. Call connect() first.` while the pool-init line was
absent — 11 × `500` (runtime-cancelled) against 9 × `200`. That is a runtime
cancellation, not benign network flakiness.

**One further correction, from the fix-release re-measurement:** the two log
lines first used as discriminators are not reliable per-request signals.
`Database not connected. Call connect() first.` originates in the MongoDB
security-event path (`apps/web/src/lib/security/monitoring.ts:243`) and appears
on successful requests too; `Database pool initialized` is a per-isolate event,
so its absence within one request proves nothing (16 of 18 successful `200`s had
no such line). The decisive signature is the **runtime-cancel exception**, or a
deadline `503` with no successful database activity in the same request. The
"about half / Error 1101 / not flakiness" facts stand; the discriminator reading
is superseded.

**Current state (post-fix), not the pre-fix symptom:** both 20-load bursts on
`f475bcc4f` produced **zero runtime-cancelled page loads** and zero `5xx`, but
17/20 and 18/20 final `200` with 3 and 2 `/login` redirects, and the message POST
still runtime-cancels on its own unbounded path. The availability defect is
improved and **not resolved**.

### 7.3 No `CI` run on the SHA cited as the canonical pin — cause and coverage

`5f7f7c74b` was cited as the canonical pin at 03:45Z. **No `CI` workflow run
exists on that SHA.** That is the path filter working as designed, not a broken
or missing pipeline: `ci.yml` triggers on `push` to `staging` only for a paths
allow-list (`apps/web/src/**`, `apps/web/public/**`, `ai/**`, `infra/docker/**`,
`scripts/**`, `config/**`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`,
`pyproject.toml`, `.editorconfig`, `.dockerignore`,
`.github/workflows/ci.yml`). `5f7f7c74b` changed exactly one file,
`.github/workflows/sentry-build.yml`, which matches none of them.

What did run on that SHA: two `push`-triggered workflows, both green —
`actionlint` run `42557171950` and `Security Scanning` run `42557171944`.
Reproduced in this integrity pass with the full 40-character SHA:

```console
$ gh api "repos/daggerstuff/pixelated/actions/runs?head_sha=5f7f7c74bb8995faee6e83fbada4b20a6bb378c4&per_page=50" --jq '.total_count'
13
$ # push-triggered runs on that SHA
[{"name":"actionlint","id":42557171950,"conclusion":"success"},
 {"name":"Security Scanning","id":42557171944,"conclusion":"success"}]
$ gh api "repos/daggerstuff/pixelated/actions/workflows/ci.yml/runs?head_sha=5f7f7c74bb8995faee6e83fbada4b20a6bb378c4" --jq '.total_count'
0
```

The workflow-scoped `0` is correct and must not be quoted as though it
characterised the commit: the all-workflow query returns **13** runs on the same
SHA. Two query traps produced the earlier wrong reading — `/workflows/CI/runs`
returns `404` (use the workflow id or `ci.yml`), and an abbreviated `head_sha`
returns empty rather than erroring.

### 7.4 Two SHAs in one deploy log — the serving bundle

The `5f7f7c74b` deploy log carries two SHAs. The build job fetched
`5f7f7c74b`; the deploy job checked out `8bfcc7605` for the wrangler CLI. The
serving bundle is the **`5f7f7c74b` build**.

| Job                         | SHA used                                                                                      | Why                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `Detect app-facing changes` | `8bfcc760529177a9f97d6c8f1fb2d86cfd46052d`                                                    | change detection only; it still returned `needed=true`                          |
| `Build Cloudflare bundle`   | `5f7f7c74bb8995faee6e83fbada4b20a6bb378c4`                                                    | runs `pnpm build`, packs `dist/server` + `dist/client` into the deploy artifact |
| `Deploy to Cloudflare`      | `8bfcc760529177a9f97d6c8f1fb2d86cfd46052d` (`ref: ${{ github.event.workflow_run.head_sha }}`) | downloads the artifact and runs `wrangler deploy`; it does not rebuild          |

This is a standing pipeline property: the build job's checkout carries no
`ref:`, so it builds the `staging` head at run time, and the run's `headSha` is
that branch head rather than a CI-validated commit.

### 7.5 CI coverage observation for the owners — the bare `ai` gitlink

`ci.yml` pushes on `ai/**` but **not** the bare `ai` gitlink. A
submodule-pointer-only commit therefore receives no `CI` run even though it
changes the deployed bundle. Observed on `9dff18df7`, whose only change was the
`ai` gitlink; its push workflows were `Security Scanning` `42574269925` (success)
and `Quality` `42574269887` (cancelled), and the covering CI run was
`42574070001` on `79a22e422`. Recorded as a CI coverage observation for the
owners, **not** as a mission defect; CI configuration is out of this mission's
scope.

## 8. Trainee-facing consequence of the unbounded paths

`/training` never reads the `error=session-not-found` query parameter, and for a
trainee it renders exactly "No training sessions are available. Pilot enrollment is not open."
(`apps/web/src/pages/training/index.astro:57-63`). The session page
catches any non-ok response, leaves `sessionData` undefined, and redirects to
`/training?error=session-not-found`
(`apps/web/src/pages/training/session/[sessionId].astro:71-80`). A bounded
deadline `503` therefore reaches a trainee as a **missing session**, with no
outage message and no retry control, and the unbounded message POST leaves the
text in the input after a runtime-cancelled failure. Neither path tells the
trainee that the platform is temporarily unavailable.

## 9. Incidents and disclosures

1. **Synthetic credential printed to the agent console.** One
   `agent-browser network requests --json` invocation during the fix-release
   journey printed the sign-in request body to the agent's own console
   transcript, including the synthetic organization password and the CSRF token.
   **No mission-authored artifact, evidence document, screenshot, result file, or
   commit contains them.** The mission artifact scan (pattern scan over the
   mission directory excluding the authorized `.secrets/` store and the
   harness-managed runtime files, plus fixed-string scans for both passwords and
   both emails) reports **zero matches**, and both committed evidence blobs
   contain no credential value. **One qualification, stated plainly:** the
   durable agent transcript store at `/home/vivi/.factory/sessions` still holds
   the synthetic organization A password **once**, in the fix-release
   browser-journey transcript
   `-home-vivi-pixelated/a3353398-c3e5-42e3-a1e9-af1c71d5579d.jsonl` (session
   title "Re-measure packages on fix release"), because
   `agent-browser network requests --json` printed the sign-in POST body to the
   console and the harness persists session transcripts. That is this disclosed
   incident itself; it is outside the mission directory and outside this
   mission's control, so the mission's own scan scope does not cover it. The
   credential was **not rotated**: the identity is synthetic, labelled, and
   reversible, and the value never reached a mission artifact or a commit. The
   operational rule that came out of it: use only the
   plain `network requests` listing, never `--json`, `network request <id>`, or
   `network har` against the sign-in POST.
2. **Stray mission-marked message row.** `tools/l03-tenant-matrix.mjs` has no
   usage handler; an unhandled `--help` invocation fell through to `main()` and
   performed a real run that left org A message row
   `0524366f-8c68-4d6f-9b91-c97b9d3ee261` at 2026-11-09T07:07:20Z. The row is
   mission-marked and removable. Each real matrix run also adds **one own-POST
   row per organization**, so re-running the matrix to re-read a gate mutates the
   row inventory; do not do it.
3. **Lockfile side effect, reverted.** A `corepack pnpm exec markdownlint`
   invocation triggered a deps-verification install that rewrote
   `pnpm-lock.yaml` with the pnpm 12.18.0 `pnpmfileChecksum` /
   `untrackedPnpmfileReadPackageHook` keys. The file was clean at session start
   and the change was reverted with `git restore --source=HEAD -- pnpm-lock.yaml`;
   no lockfile was staged or committed. Subsequent markdownlint runs used
   `./node_modules/.bin/markdownlint` directly.

## 10. Integrity checks performed

| Check                         | Command                                                                                                                                                                                                                                                                                                                                                         | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Changed paths                 | `git status --porcelain`; `git diff --stat`; `git diff --cached --stat`                                                                                                                                                                                                                                                                                         | Only `ai`, `docs`, `foresight` (the parallel session's submodule gitlinks, pre-existing and untouched) and `planning/pilot-readiness-2026-11-04/LAUNCH_DECISIONS.md` are modified; the register diff is confined to the L03 and L04 rows (2 lines). No source file is modified. The staged index was empty before this pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Parallel-session safety       | `git status`, `git diff --cached`, `git log origin/staging..HEAD`                                                                                                                                                                                                                                                                                               | The three gitlinks and the register's foreign rows were never staged, committed, or reverted. The only commit ahead of `origin/staging` before this pass was the parallel session's `97363bc95`; this mission's commits add the two evidence records and this decision record by explicit path.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Secret scan (patterns)        | `rg -n -f -` with the twelve patterns listed in §10.1, over `<missionDir>` (371 files at scan time, excluding `.secrets/` and the five harness-managed runtime files) and `planning/pilot-readiness-2026-11-04/` (11 files)                                                                                                                                     | **Zero matches in mission-authored artifacts.** The excluded files — `runtime-custom-models.json`, `model-settings.json`, `state.json`, `progress_log.jsonl`, `worker-transcripts.jsonl` — sit at the mission-directory root and are written by the agent harness, not by this mission; they hold the harness's own runtime state, so they are not mission artifacts and are out of the declared scan scope. Scanning them anyway, the provider-key pattern `sk-[A-Za-z0-9]{16,}` returns **8 matches, all in `runtime-custom-models.json`** (`customModels[0..7].apiKey`: eight 35-character `sk-` values for the local 9Router gateway at `http://127.0.0.1:20128/v1`). That file is a known harness artifact this mission did not create and does not own: the user-testing round observed mtime `2026-11-09T10:57:50Z` (`validation/mission-integrity/user-testing/synthesis.json`), this pass observed `2026-11-09T11:12:00Z` with birth `2026-11-08T20:17:47Z` because the harness rewrites it when a session starts, and it is present in three of the four mission directories on this host. No key value is reproduced here or anywhere in this record. |
| Secret scan (fixed strings)   | `rg -F` with both synthetic passwords and both synthetic emails                                                                                                                                                                                                                                                                                                 | **Zero matches.** The Auth0 `sub` identifiers appear in measurement records by design; they are identifiers, not credential material.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Secret scan (committed blobs) | `.github/hooks/secrets-scanner/scan-secrets.sh` (`SCAN_MODE=block SCAN_SCOPE=staged`, 16-pattern catalog) over both committed evidence blobs extracted from `44a0353f3e53b079bc1cf70a16ee99ec2436277a` (2 files) and `712b8ad85f224ce86a225aceab09a3730d38360f` (1 file); plus a fixed-string scan of the four synthetic identity values over both commit diffs | **Zero findings.** `No secrets found in 2 file(s)` and `No secrets found in 1 file(s)`, exit 0 for both commits. The four synthetic values return **0 hits** across both diffs (0 of 8 value/commit pairs). The empty staged index is **not** evidence of a clean staged scan: the scanner printed `No files to scan (scope=staged)` and read nothing, which is a no-op, so that scope is not claimed here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Internal links                | Link extraction over the two evidence records, the register, and this record; every relative target resolved against its containing directory                                                                                                                                                                                                                   | **Zero broken links.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Release pin reproduction      | `./node_modules/.bin/wrangler deployments status --name pixelated-empathy`                                                                                                                                                                                                                                                                                      | Exit 0, wrangler 4.158.0: `a9d4e785-39b1-4197-816a-432618c4c40e` at 100%, created 2026-11-09T07:00:15.803Z, deployment 2026-11-09T07:00:18.058Z — reproduces the value recorded in both evidence records                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Endpoint status reproduction  | `curl -s -o /dev/null -w '%{http_code}'`                                                                                                                                                                                                                                                                                                                        | `https://pixelatedempathy.com` → `200`; `/api/health` → `200`; `/api/session/progress`, `/skills`, `/comparison`, `/analytics` → `401` each — reproduces the recorded unauthenticated guard result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| CI provenance reproduction    | `gh api` with the full 40-character SHA                                                                                                                                                                                                                                                                                                                         | `13` all-workflow runs on `5f7f7c74b`; the two push runs are `actionlint` `42557171950` and `Security Scanning` `42557171944`, both success; the `ci.yml`-scoped query is `0`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Artifact integrity            | `node <missionDir>/tools/check-gate-artifacts.mjs --final`                                                                                                                                                                                                                                                                                                      | Exit 0 (assertion coverage, skill presence, links, secret patterns, NO-GO presence, Worker version, shared release commit)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Markdown lint                 | `./node_modules/.bin/markdownlint --config .markdownlint.json` on the register, both evidence records, and this record                                                                                                                                                                                                                                          | Exit 0, no findings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Format                        | `./node_modules/.bin/oxfmt --check` on both evidence records and this record                                                                                                                                                                                                                                                                                    | Exit 0, all files correctly formatted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Focused milestone suite       | `TMPDIR=/home/vivi/tmp/vitest ./node_modules/.bin/vitest run -c config/vitest.config.ts --coverage.enabled=false` over the 14 files in `services.yaml` → `test`                                                                                                                                                                                                 | **14 test files passed, 181 tests passed**, exit 0. No source changed in this pass; the suite confirms the repair surface still passes on the committed tree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### 10.1 Secret-scan scope and exact patterns

The pattern scan covers two scopes: `<missionDir>` (371 files at scan time,
excluding the authorized credential store `.secrets/` and five harness-managed
runtime files that sit at the mission-directory root) and
`planning/pilot-readiness-2026-11-04/` (11 files). The five excluded files —
`runtime-custom-models.json`, `model-settings.json`, `state.json`,
`progress_log.jsonl`, `worker-transcripts.jsonl` — are written by the agent
harness, not by this mission, and carry the harness's own runtime state (model
routing, session state, progress log, worker transcripts). They are not mission
artifacts, so they are outside the mission-artifact scope; the row above records
what they do contain.

Applied with `rg -n -f -` (one regex per line):

```text
postgres(ql)?://[^[:space:]<][^[:space:]/]*:[^[:space:]@<][^[:space:]@]*@
rediss?://[^[:space:]<][^[:space:]/]*:[^[:space:]@<][^[:space:]@]*@
Bearer [A-Za-z0-9._-]{24,}
eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}
auth-token=[A-Za-z0-9._-]{20,}
(?i)(password|passwd|pwd)[[:space:]]*[:=][[:space:]]*["'][^"'[:space:]]{8,}["']
sk-[A-Za-z0-9]{16,}
AKIA[0-9A-Z]{16}
ghp_[A-Za-z0-9]{36}
AIza[0-9A-Za-z_-]{35}
xox[baprs]-[0-9a-zA-Z]{10,48}
-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----
```

The two URI patterns require a non-`<` first character in both the user and the
password segment, so documentation placeholders such as
`rediss://<user>:<pass>@<host>` do not match while a real credentialed URI does.
Both scopes return **zero matches** (exit 1, which is `rg`'s no-match status).
The same run without the five-file exclusion returns exactly the 8 `sk-` matches
recorded in the table row and zero matches for every other provider pattern.

The committed-blob scope extracts each commit's changed files with
`git show <sha>:<path>` into a scratch repository and scans them with the
repository's own catalog, `.github/hooks/secrets-scanner/scan-secrets.sh`
(16 patterns, `SCAN_MODE=block SCAN_SCOPE=staged`). The fixed-string scope reads
both organization emails and both passwords from `.secrets/l03-identities.json`
by path, never prints them, and searches them as literal strings over the
mission directory (371 files, runtime files included — 0 hits), both commit
diffs from `git show --patch` (0 of 8 value/commit pairs), and
`planning/pilot-readiness-2026-11-04/` (0 hits).

## 11. Durability — what is committed and what is not

- The two evidence records are formatted with `oxfmt --write`, re-verified
  (markdownlint, credential scan, artifact check) and **committed to
  `/home/vivi/pixelated` by explicit path** in commit `44a0353f3`, so the
  deliverable survives a working-tree clean. They were previously untracked, and
  an uncommitted evidence artifact does not exist.
- This decision record is committed by explicit path in a separate commit on the
  same branch.
- **`LAUNCH_DECISIONS.md` is deliberately left uncommitted.** It is shared
  mutable state that carries other missions' uncommitted rows, and the mission's
  `AGENTS.md` forbids committing another mission's rows. Its **L03 and L04 rows
  are this mission's authored contribution** and remain in the working tree by
  that rule, alongside the unchanged foreign rows.
- The `results/` and `validation/` artifacts live under `<missionDir>`, which is
  **not a git repository**. They cannot and need not be committed, and this
  record does not claim they were.

## 12. No readiness claim

This record states a NO-GO decision. G1–G6 have not passed. Nothing here
authorizes enrollment, a customer launch, a pilot offer, or any claim that the
platform is available for pilot use. L03 and L04 remain OPEN, the two blockers in
§4 and §5 are unresolved, and the residual risks in §6 remain accepted only as
recorded risks.
