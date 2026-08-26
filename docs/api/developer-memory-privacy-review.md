# Developer Memory API — Privacy Review

**Issue:** PIX-231  
**Date:** 2026-07-20  
**Scope:** `/api/v1/developer/memory/*` public contract  
**Status:** Approved for rollout with the exclusions below

## Summary

The developer-facing Memory API exposes a **strict subset** of the internal
`UnifiedMemory` record. The contract is intentionally narrow and uses the same
canonical `PublicMemory` shape as the product `/api/v1/memory/*` surface. No
internal-only fields are returned to external consumers.

## Public fields (returned)

| Field        | Type              | Rationale                                  |
| ------------ | ----------------- | ------------------------------------------ |
| `id`         | UUID v4           | Required for resource identity.            |
| `content`    | string            | The memory content supplied by the caller. |
| `scope`      | MemoryScope       | Logical lifecycle boundary.                |
| `retention`  | RetentionPolicy   | Eviction / retention policy.               |
| `category`   | string            | Free-form caller-supplied category.        |
| `tags`       | string[]          | Caller-supplied tags.                      |
| `version`    | integer           | Monotonically increasing version counter.  |
| `importance` | number (0–1)      | Caller-supplied importance score.          |
| `createdAt`  | ISO 8601          | Creation timestamp.                        |
| `updatedAt`  | ISO 8601 nullable | Last mutation timestamp.                   |

## Internal fields explicitly excluded

The following fields are present on internal memory records but are **never**
returned by the developer API. The projection is enforced in a single place:
`src/lib/memory/contract/route-helpers.ts` (`toPublicMemory`).

- Identity / tenancy: `userId`, `accountId`, `workspaceId`, `tenantId`, `orgId`,
  `projectId`, `sessionId`, `agentId`, `runId`, `bankId`
- Vector / retrieval internals: `vectorId`, `sourceService`, `activationCount`,
  `retrievalCount`, `accessedAt`, `lastRetrievedAt`, `decayRate`,
  `strengthTrend`
- Derived / ghost records: `isGhost`, `synthesizedFrom`, `schemaVersion`
- Emotional / clinical data: `emotionalContext`, `empathyMetrics`
- Summaries: `gist`

## Request-body restrictions

The developer API rejects any caller-supplied identity or tenancy fields (e.g.
`userId`, `accountId`, `workspaceId`). Identity is resolved server-side from the
validated API key. This is enforced by:

1. Zod `.strict()` on all request schemas in `src/lib/memory/contract/v1.ts`.
2. The `withDeveloperV1Contract` middleware, which resolves the user from
   `X-API-Key` and ignores any identity fields in the body.

## Auth model

- All requests require a valid API key in the `X-API-Key` header.
- Read operations (`GET`, search) require scope `read` or `memory:read`.
- Write operations (`POST`, `PATCH`, `DELETE`) require scope `write` or
  `memory:write`.
- The API key is validated against the database; expired or revoked keys are
  rejected.

## Risks and mitigations

| Risk                                                           | Mitigation                                                                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Internal fields accidentally leaked via the public response.   | Single `toPublicMemory` projection; contract tests assert no forbidden fields.                                                     |
| Caller impersonates another user by supplying identity fields. | Request schemas are strict; identity is resolved from the API key.                                                                 |
| Cross-tenant data access via developer keys.                   | Gateway enforces `userId` / `accountId` / `workspaceId` scoping; tenant isolation tests exist in `product-memory-gateway.test.ts`. |

## Approval

Approved for Phase B implementation and developer onboarding documentation.
