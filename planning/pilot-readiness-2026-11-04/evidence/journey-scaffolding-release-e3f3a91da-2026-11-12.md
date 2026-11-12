# Journey scaffolding — release `e3f3a91da` and rendered verification (2026-11-12)

**Package:** L04 · **Gate:** G2 · **Owner role:** Application/QA ·
Measured 2026-11-12 on `e3f3a91da` / Worker `8dd9a8cb`.

This is the evidence record for the three journey-scaffolding PRs. It records
what renders, what the scaffolds refuse to do, and what they deliberately do not
decide. `VAL-SCAF-001` is **measured here and is not reported as passed by this
record**: at the time of writing `validation-state.json` still carries it as
`pending`, awaiting the milestone validator. Everything else in this document is
a rendered observation, not an inference.

**Journey completeness is still blocked, and now on content rather than on
structure.** The five surfaces exist and each names its blocker. No scenario
catalog, client persona, coaching rubric or competency framework has been
approved, so the journey cannot be called ready.

## 1. Release under test

| Item                   | Value                                                                                                                                                                              | Source                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Commit built/deployed  | `e3f3a91dadc0d3f481da508b5cde3f0cc49f7010`                                                                                                                                         | `git rev-parse origin/staging`; deploy `headSha`            |
| Active Worker          | `8dd9a8cb-60bb-458a-8021-53432e1c6b3d` at **100%**                                                                                                                                 | `./node_modules/.bin/wrangler deployments status` (4.158.0) |
| Worker version created | 2026-11-12T05:29:51.108Z                                                                                                                                                           | same read                                                   |
| Deployment created     | 2026-11-12T05:29:52.777Z                                                                                                                                                           | same read                                                   |
| Staging `CI`           | `43160615925` — **success** on the exact SHA                                                                                                                                       | `gh run list --workflow=CI`                                 |
| Deploy run             | `43161408266` — **success**; `Detect app-facing changes`, `Check deploy credentials`, `Build Cloudflare bundle`, `Deploy to Cloudflare` all ran, **none skipped**                  | `gh run view 43161408266 --json jobs`                       |
| Quality on the SHA     | `43160616115` — **failure**, one job only: `ai submodule strict ratchet`; the other eight jobs succeed                                                                             | `gh run view 43160616115 --json jobs`                       |
| `www` / apex           | apex `/` and `/api/health` **200**; `www/` **301** → `https://pixelatedempathy.com/`; `www/training?x=1` **301** preserving path and query; `server: cloudflare`, no `x-vercel-id` | `curl -D -` 2026-11-12T06:06Z                               |

The pin was re-read before and after the measurement window; `origin/staging`
did not move. Canonical pin record: `library/release-pin.md` §0.25.

## 2. What was verified, and how it was reached

Method: signed in through the real `/login` form as synthetic org A, opened
`/training`, then **clicked each product link**. No scaffold URL was typed. The
inline reply/coaching instances live on the session page, which has **no product
link on this release** (`/training` renders a hardcoded empty
`activeTrainingSessions` list); that page was opened by URL and is labelled that
way. Both seams are also rendered by the linked `/training/coaching` route.

Raw captures: `<missionDir>/results/journey-scaffolding-release-and-verify/`
(`navigation-capture.json`, `aside-focus-baseline-e3f3a91.json`,
`pointer-send-1440-e3f3a91.json`, `row-state.json`, `row-state-after.json`).

### 2.1 `/training/scenarios` — scenario catalog

Reached by **"Open the scenario catalog"**. Rendered:

> CLINICAL CONTENT OWNER
> **Awaiting the approved scenario catalog**
> No approved scenario catalog exists as an artefact. Scenario names, clinical
> vignettes, difficulty levels, and learning objectives are the clinical content
> owner's decision, so this surface deliberately lists none of them.
> Blocker `scenario-catalog-not-approved`
> **Approved scenarios** — No approved scenarios are listed. Nothing appears here
> until the clinical content owner approves a catalog.

Rendered by `apps/web/src/pages/training/scenarios/index.astro:70-88`; the
blocker is declared at `apps/web/src/pages/training/_scaffold-blockers.ts:36`.

### 2.2 `/training/sessions/new` — session creation

Reached by **"Open session creation"**. Rendered:

> **Blocking decisions**
> CLINICAL CONTENT OWNER — **Awaiting the approved scenario catalog** … Blocker
> `scenario-catalog-not-approved`
> PRODUCT OWNER — **Awaiting the approved scenario-to-session template** … Blocker
> `scenario-session-template-not-approved`
> **Create training session** — "Session creation is disabled while the blockers
> above stand."

The create control is **disabled**, and the POST branch answers `409` with the
same refusal, so no dead control is presented as working. Rendered by
`apps/web/src/pages/training/sessions/new.astro:48,93-101`; blockers declared at
`_scaffold-blockers.ts:36` and `:53`.

### 2.3 `/training/coaching` — replies and coaching

Reached by **"Open session coaching"**. Rendered:

> AUTOMATED CLIENT REPLIES — **Awaiting the approved synthetic-client model** …
> Owner: Clinical content owner · Blocker `synthetic-client-reply-not-approved`
> SESSION COACHING — **Awaiting the approved coaching model** … Owner: Clinical
> content owner · Blocker `coaching-model-not-approved`
> **The transcript is one-sided** … Blocker `coaching-transcript-one-sided`
> 0 messages in the transcript · 0 client turns

Rendered by `apps/web/src/pages/training/coaching/index.astro:203-221`; blockers
declared at `apps/web/src/pages/training/_reply-and-coaching.ts:53,68,84`.

### 2.4 `/training/faculty-review` — faculty review

Reached by **"Open faculty review"**. Rendered:

> NOT AVAILABLE YET
> Access path — "This account does not carry the faculty role, so this surface is
> read-only for it. Faculty access requires `admin`."
> Four structural blockers, each with an owner:
> `faculty-review-sessions-workspace-relation-missing` (Platform data owner),
> `faculty-review-role-vocabulary-disjoint` (Identity owner),
> `faculty-review-session-schema-divergent` (Platform data owner),
> `faculty-review-migration-number-collision` (Platform data owner).
> What would close it: `018_add_workspace_id_to_sessions.sql` — "This mission may
> not write it: no DDL and no migration are permitted here."

Faculty review is scaffolded **only to the missing `sessions`→`workspace`
relation**. No DDL was written and the panel reads no session. Rendered by
`apps/web/src/pages/training/faculty-review/index.astro:126-133`; blockers
declared at `apps/web/src/pages/training/_faculty-review.ts:83,92,101,110`.

### 2.5 `/training/session/<orgA>` — inline reply and coaching scaffolds

Opened by direct URL (see the navigation limitation above). Rendered:

> Composer aside: **AUTOMATED CLIENT REPLIES** — "Awaiting the approved
> synthetic-client model" … Owner: Clinical content owner · Blocker
> `synthetic-client-reply-not-approved`
> Right aside, "Session status" heading: `#feedback-messages` present, rendering
> "Session message service is ready / No status updates."
> Below it: **Session coaching** — "Awaiting the approved coaching model" ·
> Owner: Clinical content owner · Blocker `coaching-model-not-approved` ·
> "Open coaching" link to `/training/coaching`

Rendered by `apps/web/src/pages/training/session/[sessionId].astro:477`
(`ClientReplyState`) and `:563` (`SessionGuidancePanel`); the panel's
`#feedback-messages` container is at `_SessionGuidancePanel.astro:44`, and the
coaching heading at `:50`.

## 3. Clinical content was not authored

Scanned every captured `main` text for the six authored scenario names in
`apps/web/src/data/scenarios.ts` (`Resistant Client`, `Trauma Survivor`, `Crisis
Situation`, `Boundary Testing`, `Depression Management`, `Anxiety Support`) and
for vignette/persona/rubric/competency/learning-objective vocabulary.

- **Zero** authored scenario names in any rendered surface.
- **Zero** vignette, persona, rubric, competency-framework or learning-objective
  text authored by the scaffolds. The only occurrences of those words are in
  blocker copy that _names_ the decision as the owner's.
- The milestone diff adds no clinical text; the added lines that match those
  terms are comments and tests that assert their absence.

This is the `VAL-SCAF-002` property: structure only, and every content-dependent
surface names the owner blocker.

## 4. Regression checks moved by #6762

### VAL-UX-003 — the trainee aside is keyboard-reachable

`probe-aside-focus.mjs --mode baseline` on the pin:

| Viewport | Controls | Focusable | Visible when focused | Not visible |
| -------- | -------- | --------- | -------------------- | ----------- |
| 1440x900 | 3        | 3         | 3                    | none        |
| 1024x900 | 3        | 3         | 3                    | none        |

The left (client-state) aside measured `clientHeight 660` against
`scrollHeight 1205`; VitalsMonitor's **Retry** focused to `570.8–592.8` inside a
visible box of `162.8–822.6` with `scrollTop` **545** (1440x900) and
`190.8–822.6` with `scrollTop` **573** (1024x900). Both asides report
`overflow-y: auto`. **PASS** — no regression from the aside extraction.

### VAL-UX-002 — the send control is the pointer target

`probe-pointer-click.mjs --configs 1440x900:none`:

- `document.elementFromPoint` at the button centre resolved to
  `path → svg → button#send-message` — the button or its descendant.
- Coordinate click **accepted**; `POST …/messages` returned **201**; one row
  created (`9714d5e5-1835-83a4-a758-ac2da168f605`).
- Button bottom 807, footer top 823, gap 16px; `horizontalOverflow` 0. **PASS**

### `#feedback-messages` and the failure affordance

The container exists in the rendered DOM (under the "Session status" heading in
`_SessionGuidancePanel.astro`) and the live connected path wrote into it
("Session message service is ready"). `apps/web/public/js/training-session.js`
(`addFeedbackMessage`, `:588-608`) still resolves
`document.getElementById('feedback-messages')` and inserts into it;
`showConnectionStatus(false)` writes "Message could not be saved; your text
remains available to retry" through that path. **Intact.**

## 5. Two facts this record states rather than smooths over

### 5.1 The trainee surface lost chrome this milestone

PR #6762 (`b51c35301`) removed the word-list quality ladder from the session page
and `apps/web/public/js/training-session.js`:

| Removed                                                   | Where it was                        |
| --------------------------------------------------------- | ----------------------------------- |
| `updateMessageQuality()` and the `#response-quality` span | `training-session.js`, session page |
| `therapeuticWords` / `problematicWords` word lists        | `training-session.js`               |
| The `Excellent` / `Good` / `Fair` / `Poor` verdict        | `training-session.js`               |
| `#suggestions-button` and the "Get Suggestions" control   | session page markup                 |

The reading behind the removal is that a word-list verdict is unapproved
authored coaching content. **This is a user-visible removal and belongs in the
record**, not only in a PR body. On the pin the rendered page has no
`#response-quality`, no `#suggestions-button`, no "Get Suggestions" text and no
`Excellent/Good/Fair/Poor` label, and the pin's `training-session.js` has no
`updateMessageQuality`, `showSuggestions`, `therapeuticWords` or
`problematicWords`.

### 5.2 A pre-existing competency panel is still on the session page — an open owner decision

The session page still renders chrome that predates this mission by months, from
`fbe8e7e27` (2026-08-26):

- a **`Response Type`** select (`[sessionId].astro:445`) carrying the six-value
  intervention taxonomy — `reflection`, `empathy`, `inquiry` (Open-ended
  Question), `clarification`, `interpretation`, `confrontation` (Therapeutic
  Confrontation);
- a **`Real-time Guidance`** panel (`[sessionId].astro:505-535`) scoring
  **Rapport Building**, **Active Listening** and **Empathy**, each initialised at
  `0/5` and rendered as `0.0/5`.

It was neither authored nor modified by this mission: `git show fbe8e7e27^:…`
has zero occurrences of either string and `fbe8e7e27` has both, and the
scaffolding diff (`f76353df0..e3f3a91da`) does not touch them. **Whether that
panel is approved content is an owner decision, and it is recorded here as open.**
The rendered surface is not free of competency vocabulary, and this record does
not claim it was cleaned.

## 6. Mission-marked rows

Read with `node <missionDir>/tools/l03-row-state.mjs` (read-only). The owner
decided the synthetic rows stay; `reverse-l03-identities.mjs` was not run.

| When                                         | `training_session_messages` total | Marked | orgA | orgB |
| -------------------------------------------- | --------------------------------- | ------ | ---- | ---- |
| Before the pointer probe (05:35:31Z)         | 143                               | 143    | 132  | 11   |
| After it (05:37:08Z)                         | 144                               | 144    | 133  | 11   |
| After the 2026-11-12 matrix runs (06:05:51Z) | 150                               | 150    | 136  | 14   |

Structural marked rows unchanged: 2 `workspaces`, 2 `users`, 2 `auth_accounts`,
2 `sessions`. Both session hashes are byte-identical across the window
(`16c99c27c729d95ce741ded2e8596d91`, `f520f64c6c53018fe13ac30a4e29fd46`). The
three later rows are the L03 matrix's own-session POST legs (§7).

## 7. Residual observations

- **No product link to a session.** `/training` renders a hardcoded empty
  `activeTrainingSessions` list, so the inline reply/coaching scaffolds on
  `/training/session/<id>` cannot be reached by navigation on this release. They
  are reachable through `/training/coaching` (linked), which renders both seams.
  This is a consequence of the scaffold state (no sessions exist to list), not a
  missing scaffold.
- **`Quality` is red on the pin on one job.** `ai submodule strict ratchet`
  reports 5 858 strict errors against a pinned 5 791 and 25 new entries under
  `ai/training/`. None of the three scaffolding PRs touches `ai/`
  (`git diff --stat f76353df0 e3f3a91da -- ai` is empty). Recorded in the
  decision record, not attributed to this milestone.
- **The Vercel standby is unavailable by cause.** Team `Wutang`
  `billing.status: "overdue"`, `softBlock.reason: "UNPAID_INVOICE"`, zero
  deployments; `www` is now served by the Worker and `301`s to the apex, so the
  old `402 DEPLOYMENT_DISABLED` symptom is gone while the standby origin is still
  unpaid. Not a code defect and never reported as passing.

## 8. What this record does not establish

- It does not approve any content: the scenario catalog, client persona,
  coaching rubric and competency framework remain owner decisions.
- It does not prove `VAL-SCAF-001` as a contract pass. The rendered evidence is
  here; `validation-state.json` still reads `pending` pending the milestone
  validator.
- It says nothing about session creation actually working, because creation is
  deliberately disabled until the catalog and template are approved.
- It makes no launch-readiness claim and authorizes no enrollment.
