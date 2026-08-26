# ADR: Developer Memory API (v2) — Route Shape, Scopes, SDK Layout

| Field                | Value                                                                |
| -------------------- | -------------------------------------------------------------------- |
| **Status**           | Accepted                                                             |
| **Date**             | 2026-07-22                                                           |
| **Owner**            | PIX-231 Phase A                                                      |
| **Epic**             | PIX-231 — Developer API and SDK Rollout                              |
| **Depends on**       | PIX-3925 (Dual-Mode Auth), PIX-227 (Tenancy)                         |
| **Contract Version** | 1.0.0 (schemas reused); route namespace additive                     |
| **Supersedes**       | None — extends [memory-v1-decision.md](../api/memory-v1-decision.md) |

---

## 1. Context

The v1 Memory API ([ADR](../api/memory-v1-decision.md)) was deliberately
**product-only**: session-derived auth, no API key access, sensitive fields
excluded. That decision deferred developer platform exposure until auth and
tenancy stabilized.

Both blockers have since cleared:

- **PIX-3925** (Dual-Mode Auth & API Key Infrastructure) — Done. API key CRUD,
  validation, rate limiting, and route-family scoping are implemented and
  documented in [auth-boundaries.md](./auth-boundaries.md). The OpenAPI spec at
  `docs/api-reference/openapi.yaml` documents the `/api/developer/api-keys`
  surface and the dual-mode auth strategies (`jwtOnly`, `apiKeyOnly`, `either`).
- **PIX-227** (Tenancy Stabilization) — Done 2026-07-16. Scope derivation rules
  in [memory-scope-model.md](./memory-scope-model.md) are stable.

This ADR ratifies the **developer-facing memory API** — the route shape,
authentication model, scope requirements, SDK package layout, and privacy gating
rules that govern external access to the memory service via API keys.

### 1.1 Non-Goals

- GraphQL federation (tracked separately via PIX-3928, PIX-4064, PIX-4065).
- Rate-limiting improvements (PIX-4040 — Redis sliding window).
- Key rotation endpoint (PIX-4039 — `rotateApiKey()` gap).
- Exposing `emotionalContext` or `empathyMetrics` to developers (deferred —
  requires explicit product review, see §6).

---

## 2. Decision

Expose the memory API to external developers under a **new route namespace**
`/api/v1/developer/memory/*` using **API key authentication** with **scope-gated
access**. The v1.0.0 Zod schemas are reused unchanged; the new namespace is
additive and does not alter existing product-only routes.

### 2.1 Route Shape

| Method | Path                                  | Scope Required | Description                     |
| ------ | ------------------------------------- | -------------- | ------------------------------- |
| GET    | `/api/v1/developer/memory`            | `memory:read`  | List memories (paginated)       |
| POST   | `/api/v1/developer/memory`            | `memory:write` | Create a memory                 |
| GET    | `/api/v1/developer/memory/{memoryId}` | `memory:read`  | Get a single memory by ID       |
| PATCH  | `/api/v1/developer/memory/{memoryId}` | `memory:write` | Update a memory                 |
| DELETE | `/api/v1/developer/memory/{memoryId}` | `memory:write` | Delete (archive) a memory       |
| POST   | `/api/v1/developer/memory/search`     | `memory:read`  | Search memories by content/tags |

**Design rationale:**

- Mirrors `/api/v1/memory/*` (product-only) one-to-one, so the same
  `ProductMemoryGateway` and Zod schemas serve both surfaces.
- The `/developer/` prefix places these routes in the `developer` route family
  (per
  [auth-boundaries.md §3.1](./auth-boundaries.md#31-defined-route-configurations)),
  which defaults to `either` auth strategy and `read, write` scopes.
- `apiKeyOnly` is **not** used — `either` allows JWT-authenticated admin tools
  to hit the same endpoints if needed, while API keys are the primary developer
  credential.

### 2.2 Authentication Model

| Aspect        | Product Routes (`/api/v1/memory/*`) | Developer Routes (`/api/v1/developer/memory/*`) |
| ------------- | ----------------------------------- | ----------------------------------------------- |
| Credential    | JWT Bearer token                    | API Key (`X-API-Key` header)                    |
| Auth strategy | `jwtOnly` (via family inference)    | `either` (explicit in route config)             |
| Scope source  | Auth0 permissions in JWT            | `scopes[]` column on `developer_api_keys`       |
| Identity      | `token.userId` from JWT `sub`       | `key.user_id` from API key validation           |
| Rate limiting | Redis (IP-based)                    | PostgreSQL (`api_key_rate_limits` table)        |

**Key validation flow** (per
[auth-boundaries.md §1.1](./auth-boundaries.md#11-request-flow)):

1. Extract `X-API-Key` header → `DeveloperApiKeyManager.validateApiKey(rawKey)`
2. SHA-256 hash match + expiry check + rate limit check
3. Scope validation: require `memory:read` or `memory:write` per route
4. Resolve `AuthenticatedRequest` with `authMode='api_key'`,
   `user.id = key.user_id`
5. Route to `ProductMemoryGateway` using scope derived from `key.user_id`

### 2.3 Scope Requirements

API keys must declare scopes at creation time. The memory API requires:

| Scope          | Grants Access To                               |
| -------------- | ---------------------------------------------- |
| `memory:read`  | `GET /api/v1/developer/memory/*`               |
| `memory:write` | `POST/PATCH/DELETE /api/v1/developer/memory/*` |

A key with only `memory:read` cannot mutate memories. A key with `memory:write`
but not `memory:read` cannot list or search — this is intentional; write-only
keys are valid for fire-and-forget ingestion.

Scope enforcement uses the existing `requiredScopes` mechanism in `RouteConfig`
(see `src/lib/auth/route-config.ts`).

### 2.4 Request/Response Contract

**Schemas are reused from v1.0.0 unchanged.** All request bodies and response
envelopes use the Zod schemas defined in `src/lib/memory/contract/v1.ts`:

- `PublicMemory` — the memory resource (id, content, scope, retention, category,
  tags, version, importance, createdAt, updatedAt)
- `CreateMemoryRequest`, `UpdateMemoryRequest`, `SearchMemoriesRequest`
- `CreateMemoryResponse`, `GetMemoryResponse`, `UpdateMemoryResponse`,
  `DeleteMemoryResponse`, `ListMemoriesResponse`, `SearchMemoriesResponse`
- `V1Error` — error envelope (error + message + optional code)

**No new schemas are introduced.** The developer API is a thin route layer over
the existing gateway, differing only in auth and scope derivation.

---

## 3. SDK Layout

### 3.1 Package Structure

```
packages/pixelated-sdk/
├── src/
│   ├── index.ts                 # Public exports
│   ├── client.ts                # PixelatedClient — dual-mode auth
│   ├── memory/
│   │   ├── index.ts             # MemoryModule export
│   │   ├── memory-client.ts     # Mirrors src/lib/memory/memory-api-client.ts
│   │   └── types.ts             # Re-exports from src/lib/memory/contract/v1.ts
│   ├── api-keys/
│   │   ├── index.ts             # ApiKeyModule export
│   │   └── api-key-client.ts    # CRUD for /api/developer/api-keys
│   └── errors.ts                # Typed error classes matching V1Error
├── package.json
└── tsconfig.json
```

### 3.2 Client Initialization

```typescript
import { PixelatedClient } from '@pixelated-empathy/sdk'

// API key mode (developer / machine-to-machine)
const client = new PixelatedClient({
  apiKey: 'dev_a1b2c3d4...',
  baseUrl: 'https://api.pixelatedempathy.com',
})

// JWT mode (user sessions — product routes only)
const client = new PixelatedClient({
  token: 'eyJ...',
  baseUrl: 'https://api.pixelatedempathy.com',
})
```

### 3.3 Memory Module

```typescript
// List memories
const { data, pagination } = await client.memory.list({
  limit: 20,
  offset: 0,
})

// Create a memory
const { memory } = await client.memory.create({
  content: 'User prefers dark mode',
  scope: 'preference',
  retention: 'long_term',
  category: 'ui',
  tags: ['theme', 'dark-mode'],
  importance: 0.7,
})

// Search
const { results, pagination } = await client.memory.search({
  query: 'theme preferences',
  limit: 10,
})
```

### 3.4 Design Principles

1. **Mirror, not fork** — `memory-client.ts` mirrors
   `src/lib/memory/memory-api-client.ts` method-for-method. The source client
   already handles pagination, error parsing, and response typing.
2. **Import Zod schemas** — `types.ts` re-exports from
   `src/lib/memory/contract/v1.ts`, which is explicitly SDK-importable (per file
   header lines 37-39). No schema duplication.
3. **Dual-mode auth in one client** — `PixelatedClient` accepts either `apiKey`
   or `token`. API key mode sends `X-API-Key`; JWT mode sends
   `Authorization: Bearer`. The memory module routes to
   `/api/v1/developer/memory/*` for API key auth and `/api/v1/memory/*` for JWT
   auth — the client detects mode and selects the base path.
4. **No `.passthrough()` schemas** — SDK consumers get strict type safety. This
   addresses GAP-04 in
   [auth-boundaries.md §8](./auth-boundaries.md#8-gap-summary).

---

## 4. Scope Derivation for API Keys

Per [memory-scope-model.md](./memory-scope-model.md), scope dimensions are
**always server-derived from authentication** — never from client input.

For API key auth, the derivation chain is:

```
X-API-Key header
  │
  ▼
DeveloperApiKeyManager.validateApiKey()
  │  → { user_id, scopes[] }
  ▼
AuthenticatedRequest.user.id = key.user_id
  │
  ▼
toMemoryScope(user_id, accountId?, workspaceId?)
  │  → ProductMemoryScope
  ▼
ProductMemoryGateway → toInternalScope() → InternalMemoryServiceClient
```

**Key difference from JWT flow:** `accountId` and `workspaceId` are not present
in the API key record. They must be resolved via:

1. Look up the user's default account/workspace from the `user_identities`
   mapping (same table used for Auth0 ↔ platform ID resolution).
2. If the user has no account, `accountId` and `workspaceId` are `null` —
   memories are scoped to `userId` only (same as a consumer user with no org).

This ensures API key auth never bypasses tenancy isolation. A developer key
issued to user A cannot access user B's memories, even if both belong to the
same workspace — unless the API key explicitly includes a workspace-scoped claim
(future enhancement, not in Phase A scope).

---

## 5. Key Management

Developer API keys are managed via the existing CRUD surface documented in
[auth-boundaries.md §4](./auth-boundaries.md#4-api-key-lifecycle):

| Operation | Endpoint                              | Auth           |
| --------- | ------------------------------------- | -------------- |
| Create    | `POST /api/developer/api-keys`        | JWT or API key |
| List      | `GET /api/developer/api-keys`         | JWT or API key |
| Revoke    | `DELETE /api/developer/api-keys/{id}` | JWT or API key |
| Rotate    | `PATCH /api/developer/api-keys/{id}`  | JWT or API key |

**Phase A scope:** Rotation (PATCH) is documented in the OpenAPI spec but
`rotateApiKey()` is not yet implemented (GAP-01, PIX-4039). Developers must
delete-and-recreate until PIX-4039 ships. This is a known gap, not a blocker —
key revocation works.

**Key creation with memory scopes:**

```bash
curl -X POST https://api.pixelatedempathy.com/api/developer/api-keys \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Memory Integration",
    "scopes": ["memory:read", "memory:write"],
    "expires_in_days": 90
  }'
```

Response includes `plain_key` (shown once, store securely).

---

## 6. Privacy Gating

### 6.1 Current State

The v1.0.0 `PublicMemory` schema deliberately **excludes** the following fields
that exist in the internal `UnifiedMemory` type:

| Field              | Contains                                         | Present in PublicMemory |
| ------------------ | ------------------------------------------------ | ----------------------- |
| `emotionalContext` | Plutchik 8-category + valence/arousal/dominance  | ❌ No                   |
| `empathyMetrics`   | Reciprocity, validationAccuracy, resistanceLevel | ❌ No                   |

These fields are referenced only in a comment in `src/lib/memory/contract/v1.ts`
(line 14) listing deliberately-omitted fields. They do not appear in:

- Any Zod schema in the contract module
- The `ProductMemoryGateway` response payloads
- The `MemoryApiClient` (SDK mirror source)
- The OpenAPI `V1PublicMemory` schema (line 1414 of `openapi.yaml`)

### 6.2 Developer API Policy

The developer memory API **inherits the v1.0.0 exclusion**. External developers
receive `PublicMemory` payloads only — no `emotionalContext`, no
`empathyMetrics`.

**Future exposure** would require:

1. A new scope (e.g. `memory:emotional:read`) granted at key creation
2. Product review and privacy impact assessment
3. A contract version bump (v1.1.0 or v2.0.0)
4. Updated OpenAPI spec with the new schema variant
5. This ADR amended with the elevated-scope section

This is a **hard gate**, not a soft recommendation. No code path may return
emotional context data to an API-key-authenticated request without all five
conditions above being met.

### 6.3 Audit Checklist

- [ ] `ProductMemoryGateway` does not return `emotionalContext` or
      `empathyMetrics` in any response shape
- [ ] Developer route handlers use `PublicMemory` schema for serialization
- [ ] No Zod schema in the contract module includes emotional fields
- [ ] OpenAPI `V1PublicMemory` schema has `additionalProperties: false`
- [ ] Integration test: API key auth returns memory without emotional fields

---

## 7. OpenAPI Spec Integration

The developer memory routes must be added to `docs/api-reference/openapi.yaml`:

1. Add paths under `/api/v1/developer/memory` (6 operations — list, create, get,
   patch, delete, search)
2. Reference existing `V1PublicMemory`, `V1Error`, `V1Pagination` schemas
3. Tag operations with `Developer Memory API`
4. Set security: `apiKeyOnly` (X-API-Key header)
5. Document required scopes per operation in the `description` field

No new schema components are needed — all types already exist in the spec from
PIX-3925 Phase 5.

---

## 8. Route Configuration

Add to `ROUTE_CONFIGS` in `src/lib/auth/route-config.ts`:

```typescript
// Developer Memory API — API key + JWT
{ path: '/api/v1/developer/memory',         strategy: 'either', family: 'developer', requiredScopes: ['memory:read']  },
{ path: '/api/v1/developer/memory/search',  strategy: 'either', family: 'developer', requiredScopes: ['memory:read']  },
{ path: '/api/v1/developer/memory/:id',     strategy: 'either', family: 'developer', requiredScopes: ['memory:read', 'memory:write'] },
```

The `:id` route uses a combined scope check: `memory:read` for GET/PATCH,
`memory:write` for PATCH/DELETE. The middleware checks the request method
against the granted scopes.

---

## 9. Consequences

### Positive

- Developers can access the memory API via API keys — unblocks partner
  integrations and SDK rollout
- Reuses v1.0.0 schemas — no contract drift, no breaking changes
- Privacy-safe by default — emotional fields excluded without explicit elevated
  scope
- SDK mirrors existing client — minimal new code surface
- Route family inference already supports `/developer/` prefix

### Negative

- Two route namespaces for the same resource (`/api/v1/memory/*` and
  `/api/v1/developer/memory/*`) — acceptable trade-off for auth isolation
- API key scope derivation lacks `accountId`/`workspaceId` — developer keys are
  user-scoped only until future enhancement
- Key rotation gap (PIX-4039) means delete-and-recreate workflow

### Neutral

- Product-only routes (`/api/v1/memory/*`) remain unchanged
- Legacy routes (`/api/memory/*`) remain for deprecation window (PIX-230)
- GraphQL federation (PIX-3928) can build on this surface later

---

## 10. Verification Criteria (Phase A Exit)

This ADR is **Accepted**. The following verification items are complete:

- [x] Route config entries added to `ROUTE_CONFIGS`
- [x] OpenAPI spec updated with developer memory paths
- [x] SDK package scaffolds `packages/pixelated-sdk/` with memory module
      (`PixelatedClient.developer.memory` → `ForesightClient`)
- [x] Integration test: API key with `memory:read` can list/search
      (`scope authorization > allows read with memory:read scope`)
- [x] Integration test: API key with `memory:write` can create/update/delete
      (`scope authorization > allows create with memory:write scope`,
      `happy paths > PATCH /developer/memory/:id`,
      `DELETE /developer/memory/:id`)
- [x] Integration test: API key without `memory:read` gets 403
      (`scope authorization > forbids read with only write scope`)
- [x] Integration test: response payloads exclude `emotionalContext` and
      `empathyMetrics` (`privacy > does not leak internal fields`)
- [x] This ADR reviewed and marked **Accepted**

---

## 11. References

- [Memory API v1 ADR](../api/memory-v1-decision.md) — Product-only decision
- [Memory API v1 Contract](../api/memory-v1-contract.md) — Full spec
- [Auth Boundary Design](./auth-boundaries.md) — Dual-mode auth architecture
- [Memory Scope Model](./memory-scope-model.md) — Scope derivation rules
- [`src/lib/memory/contract/v1.ts`](../../src/lib/memory/contract/v1.ts) — Zod
  schemas
- [`src/lib/memory/memory-api-client.ts`](../../src/lib/memory/memory-api-client.ts)
  — SDK mirror source
- [`src/lib/services/product-memory-gateway.ts`](../../src/lib/services/product-memory-gateway.ts)
  — Gateway
- [`docs/api-reference/openapi.yaml`](../api-reference/openapi.yaml) — OpenAPI
  3.1.0 spec
- [PIX-231](https://linear.app/pixelated/issue/PIX-231) — Developer API and SDK
  rollout
- [PIX-3925](https://linear.app/pixelated/issue/PIX-3925) — Dual-mode auth and
  API key infrastructure
- [PIX-227](https://linear.app/pixelated/issue/PIX-227) — Tenancy stabilization
- [PIX-4039](https://linear.app/pixelated/issue/PIX-4039) — Key rotation gap
