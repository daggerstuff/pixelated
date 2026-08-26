# Public Memory API — Canonical v1 Contract (PIX-1908)

> Status: **Implemented (Sprint 3) — Contract tests + OpenAPI added (PIX-3904)**
> Owner: Chad Contract version: `1.0.0` Source of truth:
> `src/lib/memory/contract/v1.ts`

## 1. Background

Public docs and runtime behavior used to drift. The public product surface
needed **one canonical memory API**, backed by the actual gateway implementation
— not aspirational docs and not leaked internal routes.

This document defines that contract, justifies the product-only vs
developer-platform decision, and lists the rules any future change must follow.

### Deliberate behavioral change vs the legacy `/api/memory/*` routes

The v1 contract differs from the legacy `/api/memory/*` routes in three ways
consumers should know about:

1. **401/403 mapping.** The legacy `handleMemoryApiError` helper in
   `src/pages/api/memory/_shared.ts` maps any `ProductMemoryGatewayError` with
   `status === 401 || status === 403` to **502 Bad Gateway**. v1 maps them to
   **401 Unauthorized** and **403 Forbidden** respectively (see
   `mapGatewayError` in `src/lib/memory/contract/errors.ts`). This is a **fix**,
   not a bug — the legacy behavior leaks an internal authorization failure as a
   transport error.
2. **Response envelope.** The legacy routes return `{ success, memory, ... }`.
   v1 returns `{ data, pagination?, query? }`.
3. **Field surface.** The legacy routes return every `UnifiedMemory` field,
   including internal ones. v1 returns the curated public subset only (see §4).

## 2. Scope of the public contract

The v1 contract covers the following operations:

| Method   | Path                          | Purpose               |
| -------- | ----------------------------- | --------------------- |
| `GET`    | `/api/v1/memory`              | List memories         |
| `POST`   | `/api/v1/memory`              | Create a memory       |
| `GET`    | `/api/v1/memory/:memoryId`    | Get a memory by id    |
| `PATCH`  | `/api/v1/memory/:memoryId`    | Update a memory       |
| `DELETE` | `/api/v1/memory/:memoryId`    | Delete a memory       |
| `GET`    | `/api/v1/memory/search?q=...` | Search (query string) |
| `POST`   | `/api/v1/memory/search`       | Search (JSON body)    |

The pre-versioned `/api/memory/*` routes (including the action-named internal
shapes `/api/memory/add`, `/api/memory/list`, `/api/memory/search`,
`/api/memory/update`, `/api/memory/delete`, `/api/memory/stats`) are **NOT**
part of the public contract. They remain in place for backwards compatibility
with the in-app frontend during the deprecation window but must never be
advertised to external consumers. See §6 for the deprecation plan.

## 3. Versioning

- The contract is **URI-versioned** (`/api/v1/memory/*`).
- The contract version string is also surfaced in the
  `X-Memory-Contract-Version: 1.0.0` response header on every v1 route.
- Backwards-compatible additions (new optional response fields, new enum values,
  new query parameters) MAY be made within a single contract version.
- **Breaking changes** (renaming/removing fields, tightening validation,
  changing status codes, changing pagination semantics) require a new URI
  namespace (e.g. `/api/v2/memory/*`).
- The contract version constant lives in `src/lib/memory/contract/v1.ts` as
  `MEMORY_API_CONTRACT_VERSION`.

## 4. Resource shape

The public `Memory` object is a **strict subset** of the internal
`UnifiedMemory` type. The following fields are **deliberately omitted** from v1
and must never be added without bumping the contract version:

| Field              | Why it's internal                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `tenantId`         | Derived from the session; never caller-supplied.                                         |
| `bankId`           | Internal memory-bank grouping (e.g. `default`, `session:<id>`); product doesn't need it. |
| `vectorId`         | Internal pointer into the vector store; opaque to consumers.                             |
| `sourceService`    | Audit / provenance; not a product concern.                                               |
| `isGhost`          | Synthesis-internal flag.                                                                 |
| `synthesizedFrom`  | Synthesis-internal.                                                                      |
| `decayRate`        | Internal scheduler concern.                                                              |
| `strengthTrend`    | Internal scheduler concern.                                                              |
| `activationCount`  | Internal retrieval stats.                                                                |
| `retrievalCount`   | Internal retrieval stats.                                                                |
| `accessedAt`       | Internal retrieval stats.                                                                |
| `lastRetrievedAt`  | Internal retrieval stats.                                                                |
| `schemaVersion`    | Internal version of the UnifiedMemory schema, not the public contract.                   |
| `emotionalContext` | Plutchik/VAD emotional metadata. Not exposed in v1 (privacy + product review pending).   |
| `empathyMetrics`   | Therapeutic quality scores. Not exposed in v1 (privacy + product review pending).        |
| `gist`             | Ghost-node summary. Internal.                                                            |

The full Zod schema is the source of truth — see
`src/lib/memory/contract/v1.ts`. The OpenAPI spec at
`docs/api-reference/openapi.yaml` is generated from it.

## 5. Identity and scope

Identity and scope fields are **never** accepted as request inputs:

- `userId`, `user_id`
- `accountId`, `account_id`
- `workspaceId`, `workspace_id`
- `tenantId`, `tenant_id`
- `bankId`, `bank_id`

These are always resolved server-side from the authenticated session (JWT) or
API key. The Zod schemas are `.strict()`, so any caller that attempts to supply
these fields receives a `400 validation_failed` response.

The public product API scopes memory to **user + account + workspace**, matching
the existing `toMemoryScope()` helper in `src/pages/api/memory/_shared.ts`.
Higher-level scope dimensions (`orgId`, `projectId`, `sessionId`, `agentId`,
`runId`) are intentionally NOT exposed in v1 — they are internal-service
concerns (see `ProductMemoryScope` in
`src/lib/services/product-memory-gateway.ts`).

## 6. Product-only vs developer-platform

The decision: **the memory API is product-only in v1.** The developer-platform
surface (e.g. a separate `/api/v1/developer/memory/*` namespace accessible via
API keys with `memory:read` / `memory:write` scopes) is explicitly **out of
scope for v1** and is tracked as a follow-up (see PIX-231: "Prepare the
developer API and SDK rollout after gateway stabilization").

Rationale:

1. **No internal Hindsight/MCP route shape may leak into the public contract.**
   The action-named internal routes (`/memory/add`, `/memory/list`, etc.) and
   the `Hindsight`/`MCP` terminology are internal-implementation details.
   Exposing them — even under a developer-platform label — would lock us into a
   route shape that doesn't match the gateway implementation.
2. **Auth and tenancy are still stabilizing.** The current
   `ProductMemoryGateway` derives scope from the caller's session, not from a
   developer API key + explicit account/workspace context. Until that surface is
   ratified (see PIX-3925, PIX-227), there is no safe developer-platform
   contract to expose.
3. **Privacy-sensitive fields (emotional context, empathy metrics) need a
   product review** before they can be advertised to external developers. That
   work is out of scope for v1.

The v1 contract is therefore deliberately the **narrowest safe surface** that
satisfies the existing product use cases.

## 7. Error contract

Every error response uses the canonical envelope:

```json
{ "error": "<stable_code>", "message": "<human_readable>" }
```

The `error` field is a stable machine-readable code from `MemoryApiErrorCode` in
`src/lib/memory/contract/errors.ts`:

| Status | Code                   | When                                                      |
| ------ | ---------------------- | --------------------------------------------------------- |
| 400    | `bad_request`          | Malformed request (e.g. invalid JSON).                    |
| 400    | `validation_failed`    | Request fails Zod validation.                             |
| 401    | `unauthorized`         | Missing / invalid session or API key.                     |
| 403    | `forbidden`            | Authenticated but not permitted.                          |
| 404    | `not_found`            | Memory id does not exist (or is not visible to caller).   |
| 409    | `conflict`             | Versioning / state conflict.                              |
| 413    | `payload_too_large`    | Request body exceeds limits.                              |
| 429    | `rate_limited`         | Caller exceeded their quota.                              |
| 500    | `internal_error`       | Unexpected server error.                                  |
| 502    | `upstream_unavailable` | Gateway could not reach the internal memory service.      |
| 504    | `upstream_timeout`     | Gateway timed out waiting on the internal memory service. |

Adding a new code is backwards-compatible. Renaming or removing a code is a
**breaking change** and requires a new contract version.

The HTTP status carries the coarse-grained category; the `error` code carries
the fine-grained reason. This separation lets the API evolve retry semantics
(e.g. switching 502 → 503) without breaking consumers that switch on the `error`
code.

Internal error messages, stack traces, and correlation IDs are NEVER exposed in
`message`. (A separate `X-Correlation-Id` header MAY be added later for support
workflows; it is not part of v1.)

## 8. Implementation rules

Any change to the v1 contract MUST:

1. Update the Zod schemas in `src/lib/memory/contract/v1.ts` (or a new `v2.ts`
   for breaking changes).
2. Update the route handlers in `src/pages/api/v1/memory/*` to match.
3. Update the contract tests in
   `src/pages/api/v1/memory/__tests__/v1-memory-routes.test.ts` — if you can't
   express the change as a test assertion, it's not a contract.
4. Update the OpenAPI spec at `docs/api-reference/openapi.yaml` to match.
5. Bump `MEMORY_API_CONTRACT_VERSION` for any observable change, or create a new
   `vN.ts` namespace for a breaking change.

## 9. Out of scope for v1

- Conversation / session sync (listed as "optional" in the original task
  description; deferred to product review).
- Bulk operations (`POST /memory/bulk`, `DELETE /memory/bulk`).
- Cursor-based pagination.
- Webhooks / push notifications.
- Vector / semantic search (the current `search` is keyword/lexical through the
  gateway; semantic search is an internal-MCP concern in v1).
- Developer-platform exposure of any memory endpoint (see §6).
- The `/api/memory/*` deprecation. v1 ships alongside the existing routes; the
  deprecation window and migration plan are tracked in PIX-230.

## 10. References

- `src/lib/memory/contract/v1.ts` — Zod schemas (source of truth)
- `src/lib/memory/contract/errors.ts` — Error contract
- `src/lib/memory/contract/route-helpers.ts` — Shared route helpers
- `src/pages/api/v1/memory/*` — Route handlers
- `src/lib/services/product-memory-gateway.ts` — Gateway
- `docs/api-reference/openapi.yaml` — OpenAPI 3.1 spec
- `packages/memory-schema/src/types.ts` — Internal `UnifiedMemory` type (wider
  than the public contract)
