# L04 trainee-to-faculty journey — reconciled on the fix release

**Package status: OPEN. Mission decision: NO-GO.** This record reports what two
independent measurement runs on the same release actually observed. It makes no
launch-readiness claim and marks no unproven step complete.

Reconciled 2026-11-09 by feature `l04-gap-register-and-blockers` from two runs on
the same pin:

- **Run 1** — the mission's fix-release re-measurement, feature
  `l04-and-l03-remeasure-on-fix-release`, browser session `a3353398c3e5`,
  artifacts under `<missionDir>/results/fix-release-remeasure/`.
- **Run 2** — the independent fix-release user-testing round, flow report
  `validation/fix-release/user-testing/flows/browser-journey.json`, artifacts
  under `<missionDir>/evidence/fix-release/browser-journey/`.

Where the two disagree, both observations are recorded. The verdicts do not
change: the journey is not complete on this release.

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

This is the release that carries the role-resolution and SSR-hang repairs. The
earlier L04 journey was measured on `5f7f7c74b` / Worker `2b86c589`; its
observation survives only as the before-state in §7.2 and is not restated as
current. Browser: `agent-browser` with `--args
"--no-sandbox,--disable-dev-shm-usage"`, viewport 1440x900. Captures were taken
to `/tmp`; only non-credential images were copied into the mission results and
evidence directories, and none were added to the repository.

## 2. Sign-in through the real login form — PROVEN

Both runs signed in as the synthetic org A user through
`https://pixelatedempathy.com/login` by filling `#email` / `#password` and
clicking `button[type=submit]`.

| Leg                     | Run 1                    | Run 2                    |
| ----------------------- | ------------------------ | ------------------------ |
| `GET /api/auth/csrf`    | `200`                    | `200`                    |
| `POST /api/auth/signin` | `200`                    | `200`                    |
| Landed page             | `/dashboard`             | `/dashboard`             |
| Console errors          | none                     | none                     |
| Cookie set              | `auth-token` (name only) | `auth-token` (name only) |

No credential value was written to any artifact. The helper reads the mission
secrets file by path and passes values as an argument array, and this record
names only the cookie. One `agent-browser network requests --json` invocation
during run 1 printed the sign-in request body to the agent's own console; that
console exposure is disclosed in
`<missionDir>/library/fix-release-remeasure-2026-11-09.md` § "Incidents to
disclose" item 2, nothing reached a file, screenshot, document, or handoff, and
the value is not restated here.

## 3. Trainee interaction surface (VAL-ROLE-003) — PASS

Navigated to `/training/session/33333333-3333-4333-8333-333333333333`. The
document returned `200` in both runs and the rendered DOM contained all three
required elements:

| Assertion                 | Observed                                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| message input             | `#message-input` present, `TEXTAREA`, placeholder `Type your therapeutic response...`, visible                                                                              |
| send control              | `#send-message` present, visible, disabled until text is entered, enabled afterwards                                                                                        |
| messages container        | `#messages-container` present with the session's persisted `.message-bubble` children (4 in run 1, 5 in run 2 — run 2 started after one additional own-message row existed) |
| not reduced to the header | client-information panel, client-state meters, and the vitals `astro-island` all rendered; body text 1,471 characters in run 1, 1,538 in run 2                              |
| console                   | `Session data loaded: {sessionId: "33333333-…", clientProfile: Object, difficultyLevel: "beginner", messages: Array(…)}`                                                    |
| screenshot                | `<missionDir>/results/fix-release-remeasure/l04-03-trainee-surface-final.png`; `<missionDir>/evidence/fix-release/browser-journey/VAL-ROLE-003-trainee-surface.png`         |

The role that drove the gate: both synthetic identities carry
`app_metadata.roles: ["therapist"]` (read-only Auth0 Management API probe, 200
for each). The gate at
`apps/web/src/pages/training/session/[sessionId].astro:86` is
`isTrainee = userRole === 'therapist' || userRole === 'user'`, and it evaluated
true. **The Worker exposes no endpoint that prints `session.user.role`**, so the
exact runtime string is not directly observable; run 2 confirmed
`/api/auth/profile` returns the Auth0-normalized `'user'`, which is **not** the
gate value. The DOM assertion is the primary evidence that the gate was true.

**Outcome of the former guest-role blocker: closed on this release.** Before the
role-resolution repair every role collapsed to `guest` and the page rendered its
header only.

## 4. Trainee message persistence (VAL-L04-003) — FAILED, intermittent

Message persistence on this release is **intermittent, not a total outage**. The
two runs disagree on the rate and both observations are recorded.

**Run 1 — 4 submissions, 4 failures, 0 rows.** A message was typed into
`#message-input` and submitted with `#send-message` four times:

| Attempt | Content prefix                                      | Observed                          |
| ------- | --------------------------------------------------- | --------------------------------- |
| 1       | `L04 REMEASURE — trainee message 2026-11-09T07:11Z` | request pending ~50 s, then `500` |
| 2       | `…2026-11-09T07:12Z`                                | pending ~65 s, then `500`         |
| 3       | `…attempt3 2026-11-09T07:17Z`                       | pending ~66 s, then `500`         |
| 4       | `…attempt4 2026-11-09T07:22Z`                       | pending ~65 s, then `500`         |

The page's handler only clears the input and appends a bubble on a 2xx; after
every attempt the input still held the text and `#messages-container` still had
4 bubbles. `wrangler tail pixelated-empathy --format json` captured three of the
four cancellations, identical each time:

```text
POST /api/training/sessions/<id>/messages  -> 500
exception: The Workers runtime canceled this request because it detected that
           your Worker's code had hung and would never generate a response.
logs:      Redis error getaddrinfo ENOTFOUND witty-buffalo-119990.upstash.io
           Failed to track security event {"error":"Database not connected…"}
           (no pool-initialized line, no new-client line)
```

No Postgres connection was established during any attempt
(`pg_stat_activity` showed no Worker sessions), so the stall is before the pool.
A read after the attempts found 0 rows for the `L04 REMEASURE%` prefix.

**Run 2 — 3 valid submissions: 2 persisted, 1 failed.** Two submissions returned
`201` in about 4 s, cleared the input, appended a bubble, and persisted rows
`26533bce-0bd3-4a70-b9f1-24ebf1d6fe9d` and
`428e4c8b-6188-473e-9288-622775604f07`; both messages were visible after a page
reload (7 bubbles, input present). A third submission returned `500` after 64 s,
left the 39-character text in the input, appended no bubble, and showed the UI
error `Message could not be saved; your text remains available to retry`. A
fourth attempt was lost to a browser relaunch before any request was made and is
excluded from the count. The tail window did not cover the 500, so its
runtime-cancel signature is unconfirmed in run 2; the observed 64 s duration and
`500` are the evidence.

**The defect is an unbounded message-POST path, not a total outage.**
`POST /api/training/sessions/{id}/messages`
(`apps/web/src/pages/api/training/sessions/[sessionId]/messages.ts:18`) has no
deadline. It calls `getSession` → `resolveInternalUserId`, whose
`resolveRoleFromManagementApi` Management API fetch is unbounded, and only then
reaches `getPool().query`. The 8 s deadline added by `ssr-hang-repair` covers the
page data load only (`apps/web/src/lib/services/training/session-api.ts:185-187`).
When the pre-pool stall exceeds the runtime's patience the request is cancelled;
when it does not, the insert at `messages.ts:63` succeeds and the row persists.

**Two trainee message rows exist** from run 2 (`26533bce-…`, `428e4c8b-…`); the
earlier record's zero-row claim is withdrawn.

**The leg stays FAILED.** A 5xx inside the leg is a defect under the contract
preamble, so two successful writes do not make it a clean pass. It is not
recorded as a denial and not as a pass.

## 5. Foreign session refused in the browser (VAL-L04-004) — PASS

While authenticated as org A, navigating to
`/training/session/77777777-7777-4777-8777-777777777777` returned a `302` to
`/training?error=session-not-found`, which itself redirected to
`/login?redirect=/training` and rendered the sign-in page (`200`, 276 chars of
body text). Observed in run 1; run 2 did not exercise this leg. Re-measured on
the same pin by the `l04-journey-verification` user-testing round, which
reproduced the same three-hop chain three times
(`results/l04-durability/foreign-session.png`). The earlier wording said
`/training?error=session-not-found` "rendered `200`"; that intermediate page is
not what the browser finally renders, and the `auth-token` cookie was present and
unexpired with the browser daemon pid unchanged throughout, so the extra hop is
not client-side cookie loss.

Rendered-text check: no `Synthetic Client B`, no `77777777` session id, no org A
name, and no trainee UI (`#message-input` absent, `.message-bubble` count 0). No
foreign session content or messages appeared.

## 6. Reload during an open session — observed, not functional

Reloading the org A session page was exercised repeatedly in run 1; run 2
reloaded once to verify the message readback. Observed states:

- `200` with the trainee surface and the persisted messages (most loads).
- `302` to `/training?error=session-not-found` when the data load failed,
  usually at the 8 s deadline.
- `302` to `/login?redirect=…` in some requests. **The cause is not
  established**; §7.1 records the two competing explanations.
- No WebSocket reconnect sequence: `/sessions/<id>/events` returns `404` on both
  plain and upgrade requests, and the vitals island does not open a working
  stream.

## 7. Availability burst — 20 authenticated document requests (VAL-HANG-001) — FAILED

Run in a single browser process after one sign-in; each request was a fresh
navigation to the org A session URL, with one backed-off retry allowed per
request. The per-request distribution **varies between runs**, so both runs are
recorded and neither is presented as the fixed result.

| Metric                                       | Run 1            | Run 2                |
| -------------------------------------------- | ---------------- | -------------------- |
| Requests                                     | 20               | 20                   |
| First-attempt `200`                          | 14               | 1                    |
| Final `200` on the session page              | **17**           | **18**               |
| `5xx`                                        | 0                | 0                    |
| Runtime-cancelled / Error 1101               | 0                | 0                    |
| Redirected to `/login` (no session document) | **3**            | **2**                |
| No response at all                           | 0                | 0                    |
| Retries used                                 | 6                | 17                   |
| `auth-token` cookie present                  | at start and end | before every request |

The contract requires **20/20** `200`, so the leg fails in both runs. The
failure mode also changed from the pre-fix release: the runtime no longer
cancels these page loads, and no request is left without a response — a redirect
is a `302`, so `noResponse` is 0 in both runs. What remains is a subset of
authenticated loads that end at `/login` instead of the session document.

The raw artifacts are
`<missionDir>/results/fix-release-remeasure/burst-requests.json` (run 1) and
`<missionDir>/evidence/fix-release/browser-journey/VAL-HANG-001-burst-summary.json`
(run 2). Run 1's recorded `noResponse: 3` was wrong for the three `302`
responses and has been corrected to `0` with `redirectedToLogin: 3`.

### 7.1 Why a load ends at `/login` — two competing hypotheses

Neither hypothesis is proven. They are recorded as competing explanations, and
no cause is asserted.

- **H1 — client-side cookie loss after a browser relaunch.** This is the
  explanation in `<missionDir>/library/verification-recipes.md` §8.2. The
  browser relaunched on its own three times during the run-2 session; a relaunch
  without `--args` dies, and a relaunch drops the `auth-token` cookie. One
  entire 20-request run was invalidated this way (all 20 unauthenticated) and is
  retained only to document the relaunch.
- **H2 — a server-side cause.** Run 2 checked the `auth-token` cookie (name
  only) before every one of the 20 requests. Both `/login` redirects happened
  with the cookie present, and requests 10–20 on the same cookie immediately
  afterwards returned `200` on the session page. That observation is not
  explained by cookie loss and points at the server.

Run 1 recorded the cookie only at the start and end of the burst, so it cannot
discriminate between the two. **The cause of the three (run 1) and two (run 2)
`/login` redirects is unresolved; both explanations remain open.**

A third independent observation points the same way as H2. In the
`l04-journey-verification` user-testing round, one reload of the org A session
page ended at `/login?redirect=/training` with the `auth-token` cookie present
and unexpired and the browser daemon pid unchanged across the request
(`results/l04-durability/`, recorded in
`validation/l04-journey-verification/user-testing/flows/browser-journey.json`).
That is a server-side shape, not a relaunch. It still does not identify the
cause, and the no-relaunch condition is exactly what H1 predicts would suppress
the redirect, so it narrows the search rather than settling it.

### 7.2 Before-state (history, not current)

On the pre-fix release `5f7f7c74b` / Worker `2b86c589`, the same burst produced
**11 × `500` (Cloudflare Error 1101, runtime-cancelled) against 9 × `200`**, and
the trainee gate resolved to `guest` so no trainee UI rendered at all. That is
the before-state for this leg. It is **not** the current state: on the fix
release the runtime cancels none of the twenty page loads.

### 7.3 The tenant matrix deadline 503s in the same window

The L03 matrix, run on the same release and in the same window, hit the 8 s
deadline and returned bounded `503` responses on authenticated session reads —
2 legs in run 1 and 3 legs in run 2, with the leg set varying between runs. The
full per-run detail is in `evidence/l03-tenant-boundary-release.md` §4. A
bounded `503` fails the availability leg and is a 5xx defect, not a denial and
not a pass; the body is `{"error":"Session temporarily unavailable"}` and carries
no identifiers.

## 8. Where the request hang came from — a regression this mission introduced

The request hang is **not pre-existing and not network flakiness**. It is a
regression the identity-bridge repair introduced.

- The repair added an identity-resolution await **in front of** the Postgres
  pool: `const therapistId = await resolveInternalUserId(session.user)` in
  `apps/web/src/lib/services/training/session-api.ts` — line 89 when the repair
  landed (`80273bd6a`) and line 130 on this release, because the deadline
  wrapper added lines above it.
- `ensureConnected` memoized its connect promise and did not clear it on
  failure, so one failed connect poisoned the isolate
  (`apps/web/src/lib/redis.ts:73-85` on this release; `:44-51` before the
  repair).
- The identity-cache read ran unconditionally against an unreachable Redis host
  (`apps/web/src/lib/auth/user-identity.ts:124-126` on this release; `:80`
  before the repair).

Before the identity-bridge repair the route failed **fast** with PostgreSQL
`22P02`; after it, the request could hang until the runtime cancelled it. The
`ssr-hang-repair` release bounds that stall for the page load (8 s deadline,
`session-api.ts:29`) and clears the memoized promise in `.finally()`, which is
why the burst now produces zero runtime cancellations. It does not remove the
stall: the matrix still hits the deadline on authenticated reads (§7.3), and the
message POST is not bounded at all (§4).

**Outcome of the former request-hang blocker: improved, not eliminated.** The
symptom changed from runtime-cancelled page loads (11 × `500` on `5f7f7c74b`) to
zero runtime cancellations with a residual `/login` redirect on a subset of
loads, and the message POST remains unbounded. The blocker is not closed.

## 9. Journey step map — proven and blocked

Each of the eight journey steps is listed with its state on this release, the
observation behind it, the route, a `file:line`, an owner role, and the next
smallest closure action. No step is marked complete without evidence.

| Step                   | State       | Observed on the fix release                                                                                                                                                                                                                              | Route / page                                           | `file:line`                                                                                                                                                                             | Owner role                                                            | Next smallest closure action                                                                                                                                                                                                                                                                                               |
| ---------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Sign-in             | **PROVEN**  | csrf `200`, signin `200`, lands `/dashboard`, in both runs                                                                                                                                                                                               | `/login` → `POST /api/auth/signin`                     | `apps/web/src/components/auth/LoginForm.tsx:331,362,396`; `apps/web/src/pages/api/auth/signin.ts:24`                                                                                    | none — closed                                                         | none                                                                                                                                                                                                                                                                                                                       |
| 2. Scenario assignment | **BLOCKED** | No approved scenario catalog and no session-creation path. `/training` serves empty mock arrays and states scenarios and session creation are not available; the only openable session is one provisioned directly in the database and addressed by URL. | `/training`                                            | `apps/web/src/pages/training/index.astro:24-26`, `:51`                                                                                                                                  | Faculty/clinical education (catalog) + Application/QA (creation path) | Faculty approves a frozen 3–5 scenario set; engineering adds a session-creation path that writes a `sessions` row with `session_type='training'`, `context.synthetic=true`, and a `context.clientProfile` the loader accepts (`apps/web/src/lib/services/training/session-api.ts:79-116`), then links it from `/training`. |
| 3. Interaction         | **BLOCKED** | The trainee surface renders and a message can be typed and submitted, but the POST is intermittently runtime-cancelled (§4) and no synthetic-client reply is produced.                                                                                   | `/training/session/{id}`                               | `[sessionId].astro:400` (input), `:419` (send), `:350` (container); `apps/web/src/pages/api/training/sessions/[sessionId]/messages.ts:18`; `apps/web/public/js/training-session.js:235` | Application/QA (POST bound) + ML/clinical content (client reply)      | Bound the message POST the way the page load is bounded, and name a synthetic-client reply source that emits to the page; `[sessionId].astro:164-166` currently states automated client replies are not active.                                                                                                            |
| 4. Feedback            | **BLOCKED** | The `#feedback-messages` panel exists but nothing populates it; `handleFeedbackUpdate` reacts to events no server sends; the page notice says coaching analysis is not active. No feedback cites a persisted message.                                    | `/training/session/{id}`                               | `[sessionId].astro:502`, `:165`; `training-session.js:285`                                                                                                                              | ML/clinical content + Application                                     | Define the coaching contract over the persisted transcript and prove at least one feedback item cites a persisted message id.                                                                                                                                                                                              |
| 5. Retry               | **BLOCKED** | No retry step and no attempt record. A failed POST leaves the text in the input so the trainee can resubmit manually, but a second attempt after feedback does not exist and no retry state is persisted.                                                | `/training/session/{id}`                               | `training-session.js:192-231` (no retry branch; keeps the input on failure)                                                                                                             | Application/QA + Faculty/clinical education                           | Define retry semantics (a second attempt on the same scenario after feedback) and prove both attempts persist and are distinguishable.                                                                                                                                                                                     |
| 6. Saved session       | **BLOCKED** | Persistence is intermittent: run 2 wrote and read back two rows after reload; run 1 wrote none across four submissions, and run 2's third submission returned `500` with no row. Not proven end to end.                                                  | `/training/session/{id}` + `training_session_messages` | `messages.ts:63` (INSERT); `session-api.ts:155` (readback)                                                                                                                              | Application/QA                                                        | Same closure as step 3: make the POST bounded and reliable, then prove write plus reload readback on consecutive submissions.                                                                                                                                                                                              |
| 7. Faculty review      | **BLOCKED** | Disabled. There is no session-to-workspace relation (an owner policy decision), the role vocabulary is inconsistent, and the supervisor handler is dead.                                                                                                 | `/training` and `/training/session/{id}`               | `training/index.astro:64` (checks `supervisor`), `[sessionId].astro:87` (checks `admin`), `:537` (empty `#supervisor-dashboard`); `training-session.js:293-295`                         | Faculty/clinical education + Application/security                     | Owner decides the session-to-workspace review policy and the single faculty role name; engineering then unifies the vocabulary and either implements or deletes the dead handler.                                                                                                                                          |
| 8. Failure/reconnect   | **BLOCKED** | The reconnect path has no endpoint: `/sessions/{id}/events` returns `404` on plain and upgrade requests, and the vitals island opens no working stream. A reload was observed (§6) but not a functional reconnect.                                       | `/training/session/{id}`                               | `apps/web/src/hooks/useScenarioEvents.ts:125`; vitals island in `[sessionId].astro`                                                                                                     | Application/platform                                                  | Provide a reachable events endpoint in the Worker bundle, or record reconnect out of scope for the pilot; then re-observe a reload mid-session.                                                                                                                                                                            |

### 9.1 Faculty review — contributing reasons

Three concrete reasons keep step 7 disabled, in addition to the owner policy:

1. **No session-to-workspace relation.** `sessions` has no `workspace_id`
   column, so a supervisor cannot be scoped to the trainees they may review.
   That is an owner policy decision, not an engineering ticket.
2. **Inconsistent faculty role vocabulary.** `apps/web/src/pages/training/index.astro:64`
   renders the supervisor entry point for `userRole === 'supervisor'`, while
   `apps/web/src/pages/training/session/[sessionId].astro:87` sets
   `isSupervisor = userRole === 'admin'`. The index comment at `:22` lists
   `'trainee', 'supervisor', 'admin'`, but the session page maps therapists to
   trainees (`:84-86`). An identity that reaches one surface does not
   automatically reach the other.
3. **Dead supervisor handler.** `handleSupervisorIntervention`
   (`apps/web/public/js/training-session.js:293-295`) calls
   `this.showSupervisorMessage(...)`, which is not defined anywhere in the
   script, and the method is never invoked. The `#supervisor-dashboard` element
   at `[sessionId].astro:537` is an empty div. The supervisor path cannot run.

## 10. The bounded 503 reads to a trainee as a missing session

The deadline's `503` does not surface as an outage to the trainee. The session
page catches any non-ok response, leaves `sessionData` undefined, and redirects:

```text
apps/web/src/pages/training/session/[sessionId].astro:71-80
  catch { sessionData = undefined }
  if (!sessionData) return Astro.redirect('/training?error=session-not-found')
```

`/training` never reads the `error` parameter, and for a trainee it renders "No
training sessions are available. Pilot enrollment is not open."
(`training/index.astro:57-63`). A bounded 503 therefore reaches the trainee as a
**missing session**, not as a temporary outage, and offers no retry.

## 11. What this record does not use as evidence

`/training-session` and `/TrainingSession` render
`apps/web/src/components/training/TrainingSessionComponent.tsx`, a client-side
demo that calls `/api/bias-detection/analyze` and `/api/ai/response`. It has no
ownership check and writes nothing to `training_session_messages`. It is **not**
evidence for any step above, and no step in this record is satisfied by it.

## 12. Findings

| Severity | Finding                                                                                                 | Reproduction                         |
| -------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| High     | The trainee message POST is unbounded and intermittently runtime-cancelled (`500`, Error 1101, 50–66 s) | §4; `messages.ts:18` has no deadline |
| High     | The 20-load availability bar is not met (17/20 in run 1, 18/20 in run 2; bar 20/20)                     | §7                                   |
| High     | The authenticated read can exceed the 8 s deadline and return a bounded `503`, which is a 5xx defect    | §7.3, and the L03 record             |
| Medium   | A bounded `503` is presented to a trainee as a missing session                                          | §10                                  |
| Medium   | Faculty review is disabled, with inconsistent role vocabulary and a dead handler                        | §9.1                                 |
| Low      | Run 2's `500` was not captured by the Worker tail, so its runtime-cancel signature is unconfirmed       | §4                                   |

## 13. Verdict and next action

**L04 remains OPEN.** The role-resolution repair works: the trainee interaction
surface renders and the foreign session is refused. The journey still cannot be
completed.

The three measured failures that keep the packages OPEN, each on
`f475bcc4f` / Worker `a9d4e785`:

| Failure                      | Run 1                                          | Run 2                                                                              |
| ---------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Trainee message POST         | 4 of 4 submissions `500` after 50–66 s, 0 rows | 2 of 3 `201` and persisted, 1 of 3 `500` after 64 s with no row — **intermittent** |
| 20 authenticated page loads  | 17 of 20 `200`, 3 redirected to `/login`       | 18 of 20 `200`, 2 redirected to `/login` — **variable**                            |
| Tenant matrix bounded `503`s | 2 legs                                         | 3 legs — **a defect class, per-run set** (L03 record)                              |

The next smallest closure action for L04 is to bound the message-POST path the
same way the page load is bounded (or remove the pre-pool stall it waits on),
then re-run this journey plus the burst. Separately: name the `/login` redirect
cause by discriminating §7.1's two hypotheses, and decide the faculty-review
policy in §9.1. No API call may be substituted for the UI assertion, no failed
leg may be recorded as a pass, and no missing step is marked complete.

## 14. Residual risk and cleanup

- **Residual rows.** Run 2 added two mission-marked rows to org A
  (`26533bce-0bd3-4a70-b9f1-24ebf1d6fe9d`,
  `428e4c8b-6188-473e-9288-622775604f07`). They are attributed and counted in
  `evidence/l03-tenant-boundary-release.md` §5. No row was deleted.
- **Unmeasured.** The exact runtime string of `session.user.role`; the cause of
  the `/login` redirects; the runtime-cancel signature behind run 2's single
  `500`; reconnect behaviour with a live events endpoint.
- **Reversal.** The two rows are removable by id under the mission's synthetic
  marker; the full reversal order is in
  `<missionDir>/library/l03-provisioned-identities.md`. This record changed no
  product data itself.
