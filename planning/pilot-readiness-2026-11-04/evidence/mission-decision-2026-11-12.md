# Pilot gate decision — follow-up milestone and journey scaffolding, 2026-11-12

**Decision: NO-GO — re-derived from the 2026-11-12 measurements, not carried
forward.** The follow-up milestone did what the 2026-11-10 decision said was
missing: the hardening tier now passes all sixteen assertions it owns, and the
five journey steps that did not exist now exist as scaffolds that name their
blocker instead of pretending to work. That moves the journey blocker from
**structure to content**. It does not make the journey ready: no scenario
catalog, client persona, coaching rubric or competency framework has been
approved, so the pilot still cannot run a trainee-to-faculty journey. The
decision remains **NO-GO** because of that content blocker, the unpaid standby
origin, and the G1/G3/G5 owner decisions — not because of availability, and not
because anything here was carried forward.

This record supersedes
[`mission-decision-2026-11-10.md`](mission-decision-2026-11-10.md) as the
current decision. The earlier record keeps its own measurements on `1580a719f`;
nothing in it is restated as if taken on this pin. The scaffolding evidence is
[`journey-scaffolding-release-e3f3a91da-2026-11-12.md`](journey-scaffolding-release-e3f3a91da-2026-11-12.md).

## 1. Release under test

Every current number in this record was measured on one release, read live
during this pass.

| Item                          | Value                                                                                                                                                             | Source                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Commit built and deployed     | `e3f3a91dadc0d3f481da508b5cde3f0cc49f7010`                                                                                                                        | `git rev-parse origin/staging`; deploy `headSha`            |
| Active Worker version         | `8dd9a8cb-60bb-458a-8021-53432e1c6b3d` at **100%**                                                                                                                | `./node_modules/.bin/wrangler deployments status` (4.158.0) |
| Worker version created        | 2026-11-12T05:29:51.108Z                                                                                                                                          | same read                                                   |
| Deployment created            | 2026-11-12T05:29:52.777Z                                                                                                                                          | same read                                                   |
| Staging `CI` on the exact SHA | `43160615925` — **success**                                                                                                                                       | `gh run list --workflow=CI`                                 |
| Deploy run                    | `43161408266` — **success**; `Detect app-facing changes`, `Check deploy credentials`, `Build Cloudflare bundle`, `Deploy to Cloudflare` all ran, **none skipped** | `gh run view 43161408266 --json jobs`                       |
| `Quality` on the exact SHA    | `43160616115` — **failure**, one job only (`ai submodule strict ratchet`); the other eight jobs succeed                                                           | `gh run view 43160616115 --json jobs`                       |
| Apex health                   | `https://pixelatedempathy.com/api/health` → **200**; `/` → **200**                                                                                                | `curl -D -`, 2026-11-12T06:06Z                              |
| `www`                         | **301** → `https://pixelatedempathy.com/`; `/training?x=1` **301** preserving path and query; `server: cloudflare`, no `x-vercel-id`                              | same command                                                |
| Vercel standby team           | `Wutang` — `billing.status: "overdue"`, `softBlock.reason: "UNPAID_INVOICE"` at `2026-11-09T09:34:18Z`, **zero** deployments                                      | Vercel API read 2026-11-12                                  |

Canonical pin record: `library/release-pin.md` §0.25.

## 2. What the follow-up milestone changed

Two tiers that the 2026-11-10 reduction deferred are now in the tree and
deployed:

- **Hardening (M5c).** Sixteen bounded source fixes landed across the training
  surfaces, the legacy session API, auth/middleware and one CI script, each as
  its own reviewed PR. Every assertion the tier owns now passes; §3 records each
  one with the pin it was measured on.
- **Journey scaffolding (M5d).** Three PRs (#6761, #6762, #6763) added the
  structure for session creation, the scenario catalog, synthetic-client replies,
  transcript-grounded coaching and faculty review. Four routes are reachable by
  product link on `/training`; the inline reply/coaching instances on the session
  page are reachable by URL only, because `/training` renders a hardcoded empty
  session list. Every scaffold renders an explicit not-yet-approved state naming
  an owner blocker, and session creation's control is disabled with a `409` POST
  branch.

The milestone changed **no clinical content**. Zero authored scenario names,
vignettes, personas, rubrics or competency frameworks appear in any rendered
surface, and the diff adds none.

## 3. Each assertion restored by the 2026-11-11 scope change

Eighteen assertions were restored or re-owned when the owner reopened the
deferred work. Each row states the verdict, the release it was measured on, and
the artifact. **No restored assertion is still failing.** One is `pending`, which
is not a pass and is reported as pending.

| Assertion        | Verdict                                                                          | Measured on                                                                                            | Evidence                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `VAL-UX-001`     | **PASS** — not-found half live; deadline half at test level                      | `f7bf2ec0b` / Worker `1faf5bcf`                                                                        | [`hardening-release-a2f06cc38-2026-11-11.md`](hardening-release-a2f06cc38-2026-11-11.md) §3; the assertion permits test-level for that half |
| `VAL-INPUT-001`  | **PASS** — 21-leg malformed-input matrix, 0 `5xx`, 0 Postgres-code leaks         | `540e83bdf` / Worker `95172197`                                                                        | same record §3                                                                                                                              |
| `VAL-POST-003`   | **PASS** — no `Retry-After` on the legacy POST                                   | `540e83bdf` / Worker `95172197`                                                                        | same record §3                                                                                                                              |
| `VAL-CSRF-006`   | **PASS** — module deleted; CSRF contract still 200/403                           | `5544661f4` / Worker `42310b03` (source byte-identical to `540e83bdf`; tests re-run in the pin-4 gate) | [`csrf-module-decision-2026-11-11.md`](csrf-module-decision-2026-11-11.md); same record §3                                                  |
| `VAL-IDENT-001`  | **PASS** — unmapped sub signs in and reaches its own surface                     | `540e83bdf` / Worker `95172197`                                                                        | [`hardening-release-a2f06cc38-2026-11-11.md`](hardening-release-a2f06cc38-2026-11-11.md) §3                                                 |
| `VAL-IDENT-002`  | **PASS** — two subs, two users, two workspaces                                   | `540e83bdf` / Worker `95172197`                                                                        | same record §3                                                                                                                              |
| `VAL-IDENT-003`  | **PASS** — registration provisions or refuses, never `23502`                     | `6dce02123` / Worker `b15510b2`                                                                        | [`hardening-residual-release-5544661f4-2026-11-11.md`](hardening-residual-release-5544661f4-2026-11-11.md)                                  |
| `VAL-L04-008`    | **PASS** — one role name; dead handler removed                                   | `f7bf2ec0b` / Worker `1faf5bcf`                                                                        | [`hardening-release-a2f06cc38-2026-11-11.md`](hardening-release-a2f06cc38-2026-11-11.md) §3                                                 |
| `VAL-OUTAGE-002` | **PASS** — outage maps to retryable `503` at test level; invalid-token half live | `540e83bdf` / Worker `95172197`                                                                        | same record §3                                                                                                                              |
| `VAL-AUTH-003`   | **PASS** — one provider validation per cold request                              | `540e83bdf` / Worker `95172197`                                                                        | same record §3                                                                                                                              |
| `VAL-POST-002`   | **PASS** — retried submission yields exactly one row                             | `5544661f4` / Worker `42310b03`                                                                        | same record §3                                                                                                                              |
| `VAL-POST-004`   | **PASS** — a deliberate repeat is not a retry                                    | `5544661f4` / Worker `42310b03`                                                                        | same record §3                                                                                                                              |
| `VAL-DB-001`     | **PASS** — the timeout knob cannot disable itself                                | `540e83bdf` / Worker `95172197`                                                                        | same record §3                                                                                                                              |
| `VAL-CI-002`     | **PASS** — the build-contract scanner ignores comments                           | `540e83bdf` / Worker `95172197`                                                                        | same record §3                                                                                                                              |
| `VAL-UX-002`     | **PASS** — pointer click reaches `#send-message` → `201`                         | `f7bf2ec0b`; **re-verified on `e3f3a91da`**                                                            | same record §3; [`journey-scaffolding-release-e3f3a91da-2026-11-12.md`](journey-scaffolding-release-e3f3a91da-2026-11-12.md) §4             |
| `VAL-UX-003`     | **PASS** — aside controls visible when focused, both viewports                   | `6dce02123` probe, `f7bf2ec0b`; **re-verified on `e3f3a91da`**                                         | [`hardening-residual-release-5544661f4-2026-11-11.md`](hardening-residual-release-5544661f4-2026-11-11.md); scaffolding record §4           |
| `VAL-SCAF-001`   | **PENDING — awaiting the milestone validator, not reported passed**              | `e3f3a91da` / Worker `8dd9a8cb` (rendered evidence exists)                                             | [`journey-scaffolding-release-e3f3a91da-2026-11-12.md`](journey-scaffolding-release-e3f3a91da-2026-11-12.md) §2                             |
| `VAL-SCAF-002`   | **PASS** — no clinical content authored by the phase                             | `1580a719f` for the gap-close phase; **re-verified on `e3f3a91da`**                                    | [`mission-decision-2026-11-10.md`](mission-decision-2026-11-10.md) §12; scaffolding record §3                                               |

The contract holds **67 assertions**: **66 `passed`**, **1 `pending`**
(`VAL-SCAF-001`). `VAL-INPUT-001` moved from `failed` to `passed` on `540e83bdf`;
it is the only status change from `failed` in this milestone. `VAL-SCAF-001` is
the assertion this milestone exists for, and it is **not** recorded as passed
here — the rendered evidence is captured, and the contract state waits on the
milestone validator.

## 4. What scaffolding does and does not change

**What it changes.** The journey surfaces now exist and are deployed:

| Route                      | Renders                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `/training/scenarios`      | `scenario-catalog-not-approved` — Clinical content owner                                                        |
| `/training/sessions/new`   | `scenario-catalog-not-approved` + `scenario-session-template-not-approved`; create control disabled, POST `409` |
| `/training/coaching`       | `synthetic-client-reply-not-approved`, `coaching-model-not-approved`, `coaching-transcript-one-sided`           |
| `/training/faculty-review` | four structural blockers + the proposed `018_add_workspace_id_to_sessions.sql`                                  |
| `/training/session/<id>`   | inline reply and coaching seams (direct URL; no product link to a session on this release)                      |

**What it does not change.** Journey completeness is blocked on **content**, not
on structure. The scenario catalog, client personas, coaching rubrics and
competency frameworks are still unapproved owner decisions. No scenario name,
vignette, persona, rubric or competency framework was invented, and every
scaffold says so in the UI. Session creation cannot write anything until the
catalog and the scenario-to-session template are approved. Faculty review is
scaffolded only to the boundary of the missing `sessions`→`workspace` relation;
no DDL was written, and the panel reads no session.

**The journey is not ready.** Having a surface that explains its blocker is not
the same as having a working step, and this record does not imply otherwise.

## 5. Two facts this record states rather than smooths over

### 5.1 The trainee surface lost chrome this milestone

PR #6762 (`b51c35301`) removed the word-list quality ladder and the "Get
Suggestions" control from the session page and
`apps/web/public/js/training-session.js`: `therapeuticWords`/`problematicWords`,
the `Excellent`/`Good`/`Fair`/`Poor` verdict, the `#response-quality` span, the
`#suggestions-button` and its handler, on the reading that a word-list verdict is
unapproved authored coaching content. **This is a user-visible removal and is
recorded here, not only in a PR body.** The removed chrome is absent on the pin;
its absence is expected, and finding it again would be a regression.

### 5.2 A pre-existing competency panel remains on the session page — open owner decision

The session page still renders a **`Response Type`** select
(`apps/web/src/pages/training/session/[sessionId].astro:445`) carrying the
six-value intervention taxonomy (`reflection`, `empathy`, `inquiry`,
`clarification`, `interpretation`, `confrontation`) and a **`Real-time
Guidance`** panel (`:505-535`) scoring **Rapport Building**, **Active
Listening** and **Empathy**, rendered at `0.0/5`. Both come from `fbe8e7e27`
(2026-08-26); the scaffolding diff does not touch them.

It is neither authored nor modified by this mission, but it is competency
vocabulary on a rendered trainee surface. **Whether it is approved content is an
owner decision, recorded here as open.** This record does not present the
rendered surface as free of competency vocabulary and does not claim it was
cleaned.

## 6. The tenant boundary, re-measured on the pin

The L03 matrix was run **three times** on `e3f3a91da` / Worker `8dd9a8cb`,
because the first two runs met a spent `/userinfo` bucket and the mission's rule
is to record both the failing and the clean run rather than pick one.

| Run (UTC)     | Legs | Pass | Deny | Exclusion | `defects5xx` | Hard failures | Verdict  |
| ------------- | ---- | ---- | ---- | --------- | ------------ | ------------- | -------- |
| 05:50:44.682Z | 35   | 6    | 15   | 13        | 1            | 1             | OPEN     |
| 05:55:46.036Z | 35   | 6    | 15   | 13        | 1            | 1             | OPEN     |
| 06:05:25.511Z | 35   | 6    | 15   | 14        | 0            | 0             | **PASS** |

Both failing runs failed the **same leg** — org A,
`GET /api/session/comparison?therapistId=<org B uuid>` — with the provider body
`{"error":"Authentication provider temporarily unavailable","retryAfterSeconds":30}`.
That is the documented provider-bucket class, not a boundary breach: it fires in
`getSession()` before the legacy handler runs. The clean run followed a
seven-minute window with no authenticated traffic, and `--verify-result`
recomputed **PASS** with exit 0.

What held in all three runs: own-session reads `200` with the caller's own id,
cross-organization reads and writes `404` with no foreign content, all seven
unauthenticated legs `401`, the five legacy routes `410` for both organizations
(13–14 exclusion legs including spoofed-parameter variants), foreign rows
unchanged and **both session hashes byte-identical**
(`16c99c27c729d95ce741ded2e8596d91`, `f520f64c6c53018fe13ac30a4e29fd46`).

**L03 is PASS, provider-bucket conditional, on this pin.** The condition is an
Auth0 tenant budget, not a missing measurement: the same pin fails one leg when
the bucket is spent and passes when it is not. Reducing the `/userinfo` spend
further or raising the tenant limit is an owner action.

The three runs added one own-session message row per organization each. Marked
rows went 144 → **150** (org A 133 → 136, org B 11 → 14); the owner decided the
synthetic rows stay and `reverse-l03-identities.mjs` was not run.

## 7. The standby origin and `www`

The Vercel standby is **unavailable by cause, not by verdict**. Read from the
Vercel API on 2026-11-12: team `Wutang` reports `billing.status: "overdue"` with
`softBlock: {reason: "UNPAID_INVOICE", blockedAt: 2026-11-09T09:34:18Z}`, and
`list_deployments` returns **zero** deployments for the team. `Production
(Vercel)` reporting "success" on a staging head does not contradict that; it
produced no deployment.

**The `www` symptom is gone.** Since `f6a787e05` / `1c6c62808` the Worker serves
`www` and `301`s it to the apex, so the old `402` `x-vercel-error:
DEPLOYMENT_DISABLED` no longer occurs. Measured on this pin: `www/` → `301`
`https://pixelatedempathy.com/`, `www/training?x=1` → `301` with the query
preserved, `server: cloudflare`, no `x-vercel-id`.

That fixes the routing, not the account. The standby origin is still unpaid,
still has zero deployments, and `pixelatedempathy.vercel.app` serves nothing
useful. L02 stays **OPEN** on "a decision on the standby origin"; clearing it
needs the owner to pay the invoice, not a code change. **This is never reported
as passing and never as an unqualified "non-blocking".**

## 8. The `ai submodule strict ratchet`

The ratchet was **fixed** on 2026-11-11 by `94a8deeb2` (ai `9052a91b6`, 36 strict
errors corrected at source with no `# type: ignore` and no baseline entry), and
`Quality` was **green** on `d54b8162b` (run `42961088504`, 9 of 9 jobs). It is not
"permanently red" and this record does not carry it as such.

It is **red again at this pin**, and the cause is named: two later ai pointer
bumps (`4f8048dc9`, `68b7d8eb5`) advanced the submodule from `9052a91b6` to
`d4e77f46b`, and the ratchet now reports **5 858 strict errors against a pinned
5 791**, with **25 new entries** under `ai/training/` (`build_agent_tool_sft_v20`
/ `v21` / `v22`, `test_wandb_sft_g04`, `test_crisis_register`,
`tinker_eval_shim`, and others). On `e3f3a91da` it is the **only** failing
`Quality` job.

None of the three journey-scaffolding PRs touches `ai/` — `git diff --stat
f76353df0 e3f3a91da -- ai` is empty. This is a pre-existing `Quality` condition
on the branch head, not a defect this milestone introduced, and it is not
suppressed or re-pinned here.

## 9. The decision, derived

| Gate / package | Status on this pin                    | Why it still blocks a pilot                                                                                                                                                                      |
| -------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G2 / L03       | **PASS, provider-bucket conditional** | Nothing left to prove on the boundary; the condition is an Auth0 tenant budget, disclosed with both runs.                                                                                        |
| G2 / L04       | **OPEN**                              | The scaffolds exist, but no scenario catalog, persona, rubric or competency framework is approved. The journey is blocked on content.                                                            |
| G2 / L02       | **OPEN**                              | The standby origin is unpaid with zero deployments; the four-repo manifest and incident linkage are incomplete; no rollback has crossed a migration; `Quality` is red at the pin on the ratchet. |
| G1 / L01       | **OWNER DECISION**                    | Buyer, program, named owners, skill, scenarios, rubric, measures and stop thresholds are not accepted.                                                                                           |
| G3 / L09, L08  | L09 **PASS**; G3 **OPEN**             | The exact pilot bundle, a broad fresh evaluation and the release decision are missing.                                                                                                           |
| G4 / L11, L12  | **OPEN**                              | Lifecycle, security, restore, alert, incident and owner proof remain missing. `GAP-34` is now fixed (`540e83bdf`, `VAL-OUTAGE-002`), which removes one residual, not the gate.                   |
| G5 / L15       | **OPEN / OWNER DECISION**             | The public-claims copy pass is deployed and verified on `7ce104894`; product/commercial approval of the replacement text is missing.                                                             |
| G6 / L16       | **NOT STARTED**                       | Requires an approved G1–G5 pilot and a completed cohort.                                                                                                                                         |

**The derived answer is NO-GO.** It is a different NO-GO from 2026-11-10: the
availability and persistence tier is closed, the hardening tier is closed, and
the journey now has structure. What remains is content the mission may not
author, an invoice the mission may not pay, and approvals only the owner can
give.

### The next smallest closure action for each blocker

1. **Journey content (L04).** Approve a scenario catalog, a client-persona
   policy, a coaching rubric and a competency framework — or approve the
   existing `Response Type` / `Real-time Guidance` panel explicitly. Each
   scaffold already renders the exact blocker id and owner.
2. **Standby origin (L02).** Pay the `Wutang` invoice, or decide to retire the
   account; then remove or keep the `www` route deliberately.
3. **Ratchet (`Quality`).** Bring `ai/training/` back under the pinned 5 791, or
   re-pin the baseline through the ratchet's own reviewed path. Neither is in
   this mission's grant.
4. **G1/G3/G5.** Name the buyer and owners, freeze the pilot bundle and
   evaluation, and approve the replacement public claims.

## 10. What this record does not establish

- Nothing about a working scenario catalog, session creation, synthetic-client
  replies, transcript-grounded coaching or faculty review. Those steps are
  scaffolds, not working features.
- `VAL-SCAF-001` is not claimed as passed. The rendered evidence exists and the
  contract state is `pending` pending the milestone validator.
- Nothing about any environment other than the pinned production Worker, the
  provisioned Neon database and the two labelled synthetic organizations.
- The provider bucket remains a live condition: a matrix run inside a spent
  window records `defects5xx` and an OPEN verdict on this pin, as §6 shows.
- No launch readiness, no enrollment, no customer commitment.

## 11. Integrity checks performed

| Check            | Command                                                                    | Result                                                                        |
| ---------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Release pin      | `./node_modules/.bin/wrangler deployments status --name pixelated-empathy` | exit 0: `8dd9a8cb…` at 100%, created 2026-11-12T05:29:51.108Z                 |
| Staging head     | `git rev-parse origin/staging`                                             | `e3f3a91da…` before and after the window                                      |
| Deploy jobs      | `gh run view 43161408266 --json jobs`                                      | four jobs, all success, none skipped                                          |
| Matrix self-test | `node tools/l03-tenant-matrix.mjs --self-test`                             | 24 checks, 24 passed, exit 0                                                  |
| Matrix gate      | `node tools/l03-tenant-matrix.mjs --verify-result <clean run>`             | recomputed PASS, exit 0                                                       |
| Row state        | `node tools/l03-row-state.mjs`                                             | 150 marked messages; both session hashes unchanged                            |
| `www` / apex     | `curl -D -` on four URLs                                                   | apex 200; `www` 301 to apex; no `x-vercel-id`                                 |
| Vercel cause     | Vercel API `list_teams` + `list_deployments`                               | `overdue`, `UNPAID_INVOICE`, zero deployments                                 |
| Ratchet cause    | `gh run view 43160616115 --log-failed`; `git ls-tree` on `ai`              | 5 858 vs 5 791, 25 new `ai/training/` entries; ai unchanged by this milestone |

## 12. No readiness claim

This record states a **NO-GO** decision. G1–G6 have not passed. Nothing here
authorizes enrollment, a customer launch, a pilot offer, or any claim that the
platform is available for pilot use. Sixteen hardening assertions passing and
five scaffolds existing are measurements, not a launch decision.
