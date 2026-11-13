# CSRF module decision — cookie double-submit deleted, store-backed path retained

**Feature:** `csrf-module-decision` · **Assertion:** `VAL-CSRF-006` · **Measured
2026-11-11** on pin `d54b8162b825d0098413432c7c860b279cac5725` / Worker
`f7d84c7c-3846-4322-97a7-fb102a8eface` at 100%.

## 1. Decision

**Delete** `apps/web/src/lib/middleware/csrf.ts`. It implemented a cookie
double-submit scheme with zero importers, superseded by the store-backed
`X-CSRF-Token` path that the auth routes already use. No live caller needs it,
so it was not wired in.

## 2. The live CSRF mechanism

Three files carry the whole mechanism; none of them reads a CSRF cookie.

- `apps/web/src/pages/api/auth/csrf.ts` — `GET /api/auth/csrf` mints a 64-hex
  token with `secureRandomHex(32)`, stores it under `csrf:<token>` through
  `resolveCsrfStore`, and answers `200 {csrfToken, expiresAt}`. The token
  lifetime is `CSRF_TOKEN_TTL_SECONDS` = 3 600 s, applied as the KV entry
  expiry.
- `apps/web/src/lib/security/csrf-store.ts` — the store abstraction: Cloudflare
  KV binding `CSRF_TOKENS` when bound, the Redis cache otherwise, an
  unavailable store when neither exists.
- `apps/web/src/lib/auth/auth0-middleware.ts` — `csrfProtection` validates the
  `X-CSRF-Token` header with `store.load()`. A missing header is `403 CSRF token
  required`; an unknown, mismatched, or expired token is `403 Invalid CSRF
  token`.

`apps/web/src/middleware.ts` wires no CSRF middleware at all. Its `onRequest`
sequence is `wwwRedirect`, `normalizeRequestHeadersMiddleware`,
`tracingMiddleware`, `generateCspNonce`, `securityHeaders`, `corsMiddleware`,
`internalRouteGate`, `pilotSurfaceGate`, `projectAuthMiddleware`,
`rateLimitMiddleware`, `apiVersioningMiddleware`, `agentDiscoveryMiddleware`.

The browser client (`apps/web/src/lib/auth-client.ts:134-199`) fetches the token
from `/api/auth/csrf` and echoes it in `X-CSRF-Token`. Nothing in the repository
mints, reads, or validates the cookie module's `__Host-csrf_token` cookie or its
`csrf_token` form field.

## 3. Importer proof, before deletion

Run in the worktree at `d54b8162b`:

```text
$ rg -n "csrfMiddleware|defaultCSRFConfig|CSRFConfig|middleware/csrf" apps/web/src
apps/web/src/lib/middleware/csrf.ts:13  export interface CSRFConfig {
apps/web/src/lib/middleware/csrf.ts:45  export const defaultCSRFConfig: CSRFConfig = {
apps/web/src/lib/middleware/csrf.ts:73  config: CSRFConfig,
apps/web/src/lib/middleware/csrf.ts:132 export const csrfMiddleware = defineMiddleware(
apps/web/src/lib/middleware/csrf.ts:135 const config = defaultCSRFConfig
apps/web/src/lib/middleware/csrf.ts:280 export default csrfMiddleware
```

Every match is inside the module itself: no importer, no re-export, no test.
The cookie artefacts are equally confined:

```text
$ rg -n "__Host-csrf_token|csrf_token" apps/web/src public scripts config
apps/web/src/lib/middleware/csrf.ts:46  cookieName: '__Host-csrf_token',
apps/web/src/lib/middleware/csrf.ts:48  formFieldName: 'csrf_token',
```

A repository-wide search found the path only in two gate-suppression lists —
`knip.json` (`entry` and `ignore`) and
`scripts/ci/check-unused-exports.mjs` (`SCAN_IGNORE`) — which is why the unused
code had never been flagged. No other reference existed.

## 4. Why deletion rather than wiring

Wiring the cookie middleware into `apps/web/src/middleware.ts` would create a
second CSRF mechanism that disagrees with the first. The cookie module compares
the request header to the `__Host-csrf_token` cookie it mints; the live path
compares the header to a store record. A client that follows the documented
contract — mint from `/api/auth/csrf`, send `X-CSRF-Token` — has no such cookie
and would be refused by the cookie middleware, while a cookie-only client would
pass the middleware and be refused by `csrfProtection`. There is no consumer
the store path does not already serve, so wiring it would add a conflicting
gate rather than cover a gap.

## 5. Changes made

| File                                                 | Change                                                                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/lib/middleware/csrf.ts`                | **deleted** (280 lines, zero importers)                                                                                    |
| `apps/web/src/pages/api/auth/__tests__/csrf.test.ts` | added the `CSRF mechanism ownership` guard: the module path does not exist and `middleware.ts` wires no csrf middleware    |
| `knip.json`                                          | removed the module from `entry` and `ignore` (the deleted file's own entries; same pattern as deletion commit `aa813a09a`) |
| `scripts/ci/check-unused-exports.mjs`                | removed the module from `SCAN_IGNORE`                                                                                      |

`apps/web/src/middleware.ts` needed no change: it never referenced the module.
After the change, `rg "csrfMiddleware|defaultCSRFConfig|CSRFConfig|lib/middleware/csrf|__Host-csrf_token"`
matches only the guard test, which names the path in order to assert it is gone.

## 6. Test evidence

The guard fails against the pinned code for the right reason and passes after
the deletion.

```text
# before the deletion
× has no second, unwired cookie double-submit middleware
AssertionError: expected true to be false
Tests  1 failed | 3 passed (4)

# after the deletion
✓ apps/web/src/pages/api/auth/__tests__/csrf.test.ts (4 tests)
Tests  4 passed (4)
```

| Command                                                                                                              | Result                                           |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `vitest run apps/web/src/pages/api/auth apps/web/src/lib/auth apps/web/src/lib/middleware apps/web/src/lib/security` | 41 files, 591 tests, **exit 0**                  |
| milestone gate (the `services.yaml` `commands.test` directory list)                                                  | 69 files, 974 tests, **exit 0**                  |
| `oxlint --type-aware apps/web/src/pages/api/auth apps/web/src/lib/middleware`                                        | 15 warnings (pre-existing), **0 errors**, exit 0 |
| `oxfmt --check` on the changed TS/MJS files                                                                          | clean, exit 0                                    |
| `node scripts/ci/verify-build-contract.mjs`                                                                          | passed, exit 0                                   |

## 7. CSRF contract on the deployed release

Measured on the live pin before the change. This feature stops at an open PR, so
the deployed release is unchanged by it and these are the current production
statuses, not post-fix results.

| Request                                          | Status  | Body                                                                                |
| ------------------------------------------------ | ------- | ----------------------------------------------------------------------------------- |
| `GET https://pixelatedempathy.com/api/auth/csrf` | **200** | keys `csrfToken,expiresAt`; token is a 64-character string; `expiresAt` is a number |
| `POST /api/auth/signin`, no `X-CSRF-Token`       | **403** | `{"error":"CSRF token required"}`                                                   |
| `POST /api/auth/signin`, invalid `X-CSRF-Token`  | **403** | `{"error":"Invalid CSRF token"}`                                                    |

The minted token value is not reproduced in this record.

## 8. Stop point

Branch `mission/csrf-module-decision`, based on the recorded pin `d54b8162b`.
The feature's instruction is to open a PR with green CI and not merge it; the
PR number, head SHA, and CI conclusion are recorded in the mission handoff and
on the pull request itself. No merge, no deploy, and no pin update was performed
by this feature.
