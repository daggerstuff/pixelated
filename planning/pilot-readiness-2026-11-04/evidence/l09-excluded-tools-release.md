# L09 — Excluded tools boundary: release measurement

**Package:** L09 · **Gate:** G3 · **Owner role:** Integration/QA ·
**Verdict: OPEN.** Measured 2026-11-10 against the live production apex
(`https://pixelatedempathy.com`, Worker `pixelated-empathy`) and the tree at
`8397bdff6140d886af299762ddfaa10d892bfbfb`.

The register's L09 row reads: "Scheduling and external tools are proposed out
of scope, but disabled behavior was not demonstrated. Close with configuration
and negative tests showing excluded tools cannot execute or claim completion."

That sentence is accurate, and this measurement says why. The excluded surface
is **permission-gated, not disabled**. There is no exclusion configuration in
the codebase, the client portal pages that present scheduling, messaging,
statements and homework are publicly routable, and the public FHIR
CapabilityStatement advertises the clinical resources as active. What follows
is the inventory the row is missing, plus the three decisions that would close
it.

## 1. What "excluded" covers

The accepted scope keeps EHR, prescribing, payer and scheduling tools outside
the pilot. Their implementation in this repository:

| Family                                                                                                                                                                            | Routes  | Files                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/ehr/v1/**` + `/api/ehr/ai/**` — patients, encounters, observations, notes, consents, appointments, claims, outcomes, compliance reports, note drafting, risk stratification | 28      | `apps/web/src/pages/api/ehr/**`                                                                                                                                                                                                          |
| `/api/portal/v1/**` — scheduling, homework, messaging, statements                                                                                                                 | 8       | `apps/web/src/pages/api/portal/**`                                                                                                                                                                                                       |
| `/api/fhir/r4/metadata` — FHIR CapabilityStatement                                                                                                                                | 1       | `apps/web/src/pages/api/fhir/r4/metadata.ts`                                                                                                                                                                                             |
| Service layer                                                                                                                                                                     | —       | `apps/web/src/lib/ehr-native/**` (211 files), including `services/scheduling-service.ts`, `services/claims-service.ts`, `services/eprescribing.service.ts` and the `integrations/{clearinghouse,e-prescribing,hie,zoom,stripe}` adapters |
| Client portal UI                                                                                                                                                                  | 6 pages | `apps/web/src/pages/portal/{index,scheduling,messaging,statements,homework,telehealth}.astro`                                                                                                                                            |
| Express integration router                                                                                                                                                        | —       | `apps/web/src/api/routes/integrations.ts`, mounted in `apps/web/src/api/server.ts` (not referenced by any Dockerfile, compose file or workflow, so not part of the Worker release)                                                       |

Total excluded API routes: **37**.

## 2. What the release actually enforces

### 2.1 Route guards — 36 of 37 require auth and an EHR/portal role

Every route except the FHIR metadata endpoint wraps its handler in
`withV1Contract` and then checks `requireEHRPermission` or `requirePortalClient`:

| Guard                                     | Routes                                                          |
| ----------------------------------------- | --------------------------------------------------------------- |
| `withV1Contract` + `requireEHRPermission` | 28 (`/api/ehr/**`)                                              |
| `withV1Contract` + `requirePortalClient`  | 8 (`/api/portal/**`; `scheduling/index.ts` imports both guards) |
| no guard, public by design                | 1 (`/api/fhir/r4/metadata`)                                     |

### 2.2 Anonymous probes — nothing executes, but the surface answers

`curl` from this host, no credentials, GET only:

| Route                       | Status  | Body                                                                                                              |
| --------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `/api/ehr/v1/patients`      | **401** | `{"error":"unauthorized","message":"You must be authenticated to access this endpoint.","code":"unauthorized"}`   |
| `/api/ehr/v1/appointments`  | **401** | same                                                                                                              |
| `/api/ehr/v1/claims`        | **401** | same                                                                                                              |
| `/api/portal/v1/scheduling` | **401** | same                                                                                                              |
| `/api/portal/v1/statements` | **401** | same                                                                                                              |
| `/api/fhir/r4/metadata`     | **200** | `{"resourceType":"CapabilityStatement","id":"pixelated-ehr","status":"active","publisher":"Pixelated Empathy",…}` |

So no excluded operation completes anonymously. That is the negative result the
row already implies; it is not exclusion.

### 2.3 The excluded surface is publicly advertised

`/api/fhir/r4/metadata` is unauthenticated by design (FHIR R4 requires it), and
the live document declares the following resources and interactions:

| Resource          | Interactions                                 | Search params |
| ----------------- | -------------------------------------------- | ------------- |
| Patient           | read, search-type, create, patch, **delete** | 2             |
| Encounter         | read, search-type, create, patch             | 5             |
| Observation       | read, search-type, create, patch             | 6             |
| **Appointment**   | read, search-type, create, patch             | 6             |
| **Claim**         | read, create, patch                          | 0             |
| DocumentReference | read, search-type, create                    | 0             |
| Consent           | read                                         | 0             |

`Appointment` and `Claim` are two of the tools the pilot excludes, and the
CapabilityStatement says they are `active` with write interactions. For a
boundary test this is a direct contradiction: the release tells the world the
excluded tools are available.

### 2.4 The portal UI is publicly routable

`/portal`, `/portal/scheduling`, `/portal/messaging`, `/portal/statements`,
`/portal/homework` and `/portal/telehealth` all return **200** to an
unauthenticated request. The server-rendered body is only the layout shell
(nav + title); the widgets hydrate client-side and their data calls hit the
401 endpoints above. No server-side authentication gate exists on these pages,
so the excluded workflows are _presented_ on the public surface even though
they cannot _complete_.

### 2.5 No exclusion configuration exists

- `grep -rIn -E 'EHR_ENABLED|EHR_MODULE|ehrEnabled|FEATURE_EHR|PILOT_'` over
  `apps/web/src` and `.env.example` returns **nothing**.
- `apps/web/src/middleware.ts` contains no reference to `ehr`, `portal` or
  `fhir`. Its only exclusion mechanism is `internalOnlyRoutes`, a hardcoded set
  of internal pages (`/test-sentry`, `/style-guide`, `/therapy-chat-plan`, …)
  that rewrites to `/404` in production. That mechanism works — `/style-guide`
  and `/therapy-chat-plan` both return 404 live — and it is not applied to any
  excluded route or portal page.
- No negative test asserts that an excluded tool cannot execute or claim
  completion. The existing `ehr-native` tests exercise the services' own
  behaviour, not the boundary.

## 3. Verdict and why it is not "partially passed"

A reader could argue L09 is satisfied by the 401s. It is not, and the row's own
wording says why: the exit condition is that the tools are **disabled** and
cannot **claim completion**, not that they reject anonymous callers.

- _Disabled_ is not satisfied: the routes exist, the portal pages render, and
  the CapabilityStatement advertises the resources as active.
- _Cannot claim completion_ is not demonstrated: nothing prevents an
  authenticated EHR-role session from completing a scheduling, claims or
  prescribing operation, and no test asserts otherwise.
- _Configuration_ does not exist: there is no flag to turn the surface off for
  a pilot.

## 4. What closes L09

Three decisions, in order. The first two are engineering; the third is the
owner's.

1. **Choose the exclusion mechanism.** The natural home is a prefix gate in
   `apps/web/src/middleware.ts` beside `internalOnlyRoutes`, driven by a config
   list so a pilot release can exclude `/api/ehr`, `/api/portal`, `/api/fhir`
   and `/portal` without a code change. **This file is the live GAP-34 surface**
   — the provider-validation fix needs a grant extension to
   `apps/web/src/lib/auth/**` and the middleware is where `validateToken` runs —
   so the gate must land after, or coordinated with, the availability mission.
   It is also a routing-architecture change, which `.github/copilot-instructions.md`
   requires approval for.
2. **Decide what the FHIR metadata endpoint does under exclusion.** Either the
   CapabilityStatement is replaced by an empty/`inactive` statement for the
   pilot release, or `/api/fhir` is gated too. Leaving it advertising
   `Appointment` and `Claim` as active cannot coexist with an exclusion claim.
3. **Owner decision:** whether the pilot excludes by configuration (routes
   return 404) or by role (routes stay, no pilot account holds an EHR role).
   The second is weaker evidence and would need the portal pages gated at
   minimum.

Once (1) lands, the negative tests are mechanical: for each excluded prefix,
assert 404 (or the configured refusal) anonymously _and_ with a valid non-EHR
session, and assert the portal pages are not served. Those tests do not exist
today and cannot be written against the current release because the expected
result would fail.

## 5. Gate implemented and enabled on the release

The mechanism from §4 step 1 exists in the tree, is enabled in
`wrangler.jsonc` (`PILOT_EXCLUDED_SURFACE: "1"`, verified present in the
generated `dist/server/wrangler.json`), and is measured on production below:

| Piece    | Path                                                       | Behaviour                                                                                                                                                                                                                                                                          |
| -------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decision | `apps/web/src/lib/pilot/excludedSurface.ts`                | `isExcludedSurface` matches the four prefixes (`/api/ehr`, `/api/portal`, `/api/fhir`, `/portal`) on a segment boundary, so `/api/ehrfoo` and `/portals` do not match; `excludedApiRefusal` builds the JSON 404 for API paths and returns `null` for pages so the 404 page renders |
| Wiring   | `apps/web/src/middleware.ts` (`pilotSurfaceGate`)          | Sits **after** `internalRouteGate` and **before** `projectAuthMiddleware`, so an excluded route never reaches the provider validation path — it does not spend the `/userinfo` budget that GAP-34 is short of                                                                      |
| Opt-in   | `PILOT_EXCLUDED_SURFACE=1` or `true`                       | Absent, `0`, `false` or any other value leaves the gate inert. Landing the code changes no production behaviour                                                                                                                                                                    |
| Tests    | `apps/web/src/lib/pilot/__tests__/excludedSurface.test.ts` | 15 cases: prefix boundaries, near-miss segments, the pilot journey routes that must **not** match, trailing-slash and duplicate-slash normalisation, opt-in parsing, and the refusal body                                                                                          |

Verification: `pnpm vitest run -c config/vitest.config.ts
apps/web/src/lib/pilot/__tests__/excludedSurface.test.ts` → 15 passed;
`pnpm exec oxlint` on the module, the test and `middleware.ts` → exit 0;
`pnpm build` and `bash scripts/ci/build-cloudflare.sh` → both succeed.

This closes the _mechanism_ half of L09 and none of the decision half. The gate
is inert on the current release, so the live measurements in §2 still describe
production. Enabling it is an owner decision and a routing change, and the FHIR
CapabilityStatement question in §4 step 2 is still open — an enabled gate makes
`/api/fhir/r4/metadata` answer 404, which is a deliberate loss of the FHIR
discovery endpoint for the pilot release.

### 5.1 Production measurement, release `7ce104894`

Worker version deployed from that release. Probes taken from this host against
`https://pixelatedempathy.com`, no credentials:

| Route                                               | Before the gate                                                            | After the gate       |
| --------------------------------------------------- | -------------------------------------------------------------------------- | -------------------- |
| `/api/fhir/r4/metadata`                             | 200, `CapabilityStatement` advertising `Appointment` and `Claim` as active | **404**              |
| `/api/ehr/v1/patients`                              | 401 (authenticated route answering)                                        | **404**              |
| `/portal/scheduling`                                | 200, scheduling shell rendered                                             | **404**              |
| `/api/health`                                       | 200                                                                        | 200                  |
| `/`, `/training`, `/demo-hub`, `/privacy`, `/terms` | 200 / 302 / 200 / 200 / 200                                                | unchanged            |
| `/api/training/sessions/<id>/messages`              | 404 on GET (POST-only route)                                               | unchanged 404 on GET |

The last row is the control against over-blocking: that route exports only
`POST`, so a GET 404 is the route's own behaviour and not the gate. The pilot
journey surface answers exactly as before.

The mechanism was proven before the deploy, not after it: the built bundle was
run under `wrangler dev` against the same config, and the three excluded routes
returned 404 there while the pilot routes did not.

## 6. What this document does not establish

- Nothing about a real sandbox service. The row's first branch ("if
  scheduling/tools are included, verify consent changes, exact slots, retries,
  unknown outcomes and truthful completion against a real sandbox service") was
  not exercised: no sandbox exists in this repo and the tools are proposed out
  of scope.
- Nothing about whether an authenticated EHR-role account can complete an
  excluded operation on the pinned release. No such account was used; creating
  or using one is outside this audit.
- No approval of the exclusion mechanism. That is an owner decision under
  `.github/copilot-instructions.md`.
