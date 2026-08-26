# Dual-Mode Auth Boundary Design

> **Part of**: Platform Maturity & Clinical Readiness (Initiative) **Epic**:
> PIX-3925 — Dual-Mode Auth & API Key Infrastructure **Status**: Design Complete
> — Implementation in progress **Last updated**: 2026-07-15

---

## 1. Architecture Overview

The platform supports **two authentication modes** that can be applied per-route
or per-route-family:

| Mode    | Credential                  | Source                 | Primary Use Case             |
| ------- | --------------------------- | ---------------------- | ---------------------------- |
| JWT     | Auth0-issued `Bearer` token | `Authorization` header | User sessions (web, SPA)     |
| API Key | `dev_`-prefixed key         | `X-API-Key` header     | External developer / machine |

A route-level **strategy** selects which mode(s) are accepted:

- `jwtOnly` — only JWT Bearer tokens
- `apiKeyOnly` — only API keys (internal services, SDK clients)
- `either` — accept either mode (graceful fallback between both)

### 1.1 Request Flow

```
Client Request
  │
  ├─ X-API-Key header present?
  │   ├─ Yes → DeveloperApiKeyManager.validateApiKey(rawKey)
  │   │          ├─ SHA-256 hash match against DB
  │   │          ├─ Expiry check
  │   │          ├─ Rate limit check (DB-based `api_key_rate_limits`)
  │   │          ├─ Scope validation
  │   │          └─ → AuthenticatedRequest (authMode='api_key')
  │   │
  │   └─ No / Strategy=jwtOnly → validateToken(token)
  │          ├─ Auth0 JWKS signature verification
  │          ├─ resolveIdentity() → internal UUID (Auth0 sub → platform PK)
  │          ├─ Session binding (TOFU IP binding)
  │          ├─ Adaptive MFA check
  │          ├─ Scope validation (from Auth0 permissions)
  │          └─ → AuthenticatedRequest (authMode='jwt')
  │
  └─ Route scope check
       ├─ requiredScopes satisfied? → handler executes
       └─ Missing scope → 403 Insufficient permissions
```

### 1.2 Key Architectural Decisions

| Decision            | Choice                              | Rationale                                                                                           |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| Key hashing         | SHA-256 (not bcrypt)                | API keys are high-entropy random values (256-bit); bcrypt adds unnecessary latency on every request |
| Key prefix indexing | First 8 chars (`dev_XXXX`)          | Enables fast DB lookup without scanning all rows; full hash verified on match                       |
| Rate limiting       | DB for API keys, Redis for IP-based | API key rate limits persist across restarts; IP rate limits need fast TTL-based expiry              |
| Identity resolution | Redis cache → Postgres fallback     | Avoids DB lookup on every JWT-authenticated request after first use                                 |
| Auth0 ↔ Platform ID | Separate `user_identities` mapping  | Platform UUIDs never leak to Auth0; Auth0 `sub` never stored as FK in domain tables                 |

---

## 2. Core Types & Interfaces

### 2.1 `AuthenticatedRequest`

Defined in `src/lib/auth/auth0-middleware.ts:482-498`. Extends the standard
`Request` with:

```typescript
interface AuthenticatedRequest extends Request {
  user?: {
    id: string // Internal platform UUID (never Auth0 sub)
    email: string
    role: string // 'user' | 'developer' | 'admin' | etc.
    emailVerified?: boolean
    fullName?: string
    avatarUrl?: string
    createdAt?: string
    lastLogin?: string
    appMetadata?: Record<string, unknown>
    userMetadata?: Record<string, unknown>
  }
  tokenId?: string // JWT token ID (for refresh/revocation)
  sessionId?: string // Auth0 session ID
  authMode?: 'jwt' | 'api_key'
  scopes?: string[]
}
```

### 2.2 Route Configuration

Defined in `src/lib/auth/route-config.ts`:

```typescript
type AuthStrategy = 'jwtOnly' | 'apiKeyOnly' | 'either'
type RouteFamily = 'public' | 'user' | 'developer' | 'admin' | 'system'

interface RouteConfig {
  path: string
  strategy: AuthStrategy
  family: RouteFamily
  requiredScopes?: string[]
  rateLimit?: { requests: number; windowMs: number }
}
```

### 2.3 API Key Model

Defined in `src/lib/db/developer-api-keys.ts:10-24`, backed by
`developer_api_keys` table:

| Column                      | Type        | Notes                                         |
| --------------------------- | ----------- | --------------------------------------------- |
| `id`                        | UUID        | Primary key                                   |
| `user_id`                   | VARCHAR     | Owner of the key                              |
| `key_hash`                  | VARCHAR(64) | SHA-256 hex digest of raw key                 |
| `key_prefix`                | VARCHAR(8)  | First 8 chars (`dev_XXXX`) for indexed lookup |
| `name`                      | VARCHAR     | Human-readable label                          |
| `scopes`                    | TEXT[]      | Array of valid scope strings                  |
| `rate_limit`                | INTEGER     | Max requests per-minute window                |
| `is_active`                 | BOOLEAN     | Soft-delete flag                              |
| `last_used_at`              | TIMESTAMPTZ | Updated on successful validation              |
| `last_failed_at`            | TIMESTAMPTZ | Updated on failed validation                  |
| `expires_at`                | TIMESTAMPTZ | Null = no expiry                              |
| `created_at` / `updated_at` | TIMESTAMPTZ | Standard audit columns                        |

### 2.4 Scope Model

Defined in `src/lib/auth/scopes.ts` and `route-config.ts:24-60`:

| Scope              | Description              | Route Pattern                           |
| ------------------ | ------------------------ | --------------------------------------- |
| `read`             | Read access to resources | `GET /api/v1/*`, `GET /api/developer/*` |
| `write`            | Write access             | `POST/PUT/PATCH /api/v1/*`              |
| `admin`            | Administrative access    | `* /api/admin/*`                        |
| `memory:read`      | Memory endpoints (read)  | `GET /api/memory/*`                     |
| `memory:write`     | Memory endpoints (write) | `POST/PUT/DELETE /api/memory/*`         |
| `developer:manage` | API key management       | `* /api/developer/api-keys/*`           |
| `analytics:read`   | Analytics access         | `GET /api/analytics/*`                  |

---

## 3. Route Family Strategy

### 3.1 Defined Route Configurations

| Path Pattern                      | Strategy     | Family    | Required Scopes    |
| --------------------------------- | ------------ | --------- | ------------------ |
| `/api/health`, `/api/v1/health`   | `either`     | public    | —                  |
| `/api/session/*`                  | `jwtOnly`    | user      | —                  |
| `/api/v1/profile`                 | `jwtOnly`    | user      | —                  |
| `/api/v1/preferences`             | `jwtOnly`    | user      | —                  |
| `/api/memory/*`                   | `either`     | user      | `memory:read`      |
| `/api/developer/api-keys`         | `either`     | developer | `developer:manage` |
| `/api/v1/analytics/*`             | `either`     | developer | `analytics:read`   |
| `/api/admin/*`, `/api/v1/admin/*` | `jwtOnly`    | admin     | `admin`            |
| `/api/internal/*`                 | `apiKeyOnly` | system    | —                  |

### 3.2 Family Defaults (for unregistered routes)

Routes not explicitly listed in `ROUTE_CONFIGS` fall back to family inference
based on path prefix:

| Inferred Family | Strategy     | Default Scopes           |
| --------------- | ------------ | ------------------------ |
| public          | `either`     | —                        |
| user            | `jwtOnly`    | `read`                   |
| developer       | `either`     | `read`, `write`          |
| admin           | `jwtOnly`    | `admin`                  |
| system          | `apiKeyOnly` | `read`, `write`, `admin` |

---

## 4. API Key Lifecycle

### 4.1 Creation

```
POST /api/developer/api-keys
Authorization: Bearer <jwt>  (or X-API-Key with developer:manage scope)

Request:
{
  "name": "My Integration Key",
  "scopes": ["read", "memory:read"],
  "rate_limit": 100,
  "expires_in_days": 90
}

Response 201:
{
  "api_key": { /* key metadata, no hash */ },
  "plain_key": "dev_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
  // ⚠ plain_key returned ONCE — store securely
}
```

Generation: `randomBytes(32)` → base64url → `dev_` prefix → total 47 chars.

### 4.2 Validation

- Extract prefix (`dev_XXXX`) from raw key
- `SELECT ... WHERE key_prefix = $1 AND key_hash = SHA256(rawKey) AND is_active = true`
- Check `expires_at`, check rate limit window in `api_key_rate_limits` table
- On success: update `last_used_at`, increment rate limit counter
- On failure: update `last_failed_at`, log security event
- After 10 consecutive failed attempts: auto-revoke key (in-memory counter,
  resets on success)

### 4.3 Revocation

Two paths:

- **User-initiated**: `DELETE /api/developer/api-keys/:id` →
  `revokeApiKey(id, userId)` (scoped to owner)
- **System-initiated**: `revokeApiKeySystem(id)` (admin/internal use, no userId
  guard)

Both set `is_active = false`.

### 4.4 Rotation (Gap — Needs Implementation)

`rotateApiKey(apiKeyId, userId)` should:

1. Look up existing key (verify ownership via userId)
2. Generate new raw key + hash
3. Replace `key_hash`, `key_prefix` on same record
4. Reset `last_failed_at`, update `updated_at`
5. Return new `plain_key` (shown once)

**Rate limit, scopes, name, expiry all preserved from original.**

---

## 5. Rate Limiting Architecture

### 5.1 Current Implementation

| Scope        | Mechanism                                 | Storage                                  | Window                          |
| ------------ | ----------------------------------------- | ---------------------------------------- | ------------------------------- |
| Per API key  | `DeveloperApiKeyManager.checkRateLimit()` | `api_key_rate_limits` table (PostgreSQL) | 1-minute aligned windows        |
| Per IP (JWT) | `rateLimitMiddleware()`                   | Redis via `getFromCache`/`setInCache`    | Configurable (endpoint-defined) |

### 5.2 Gap — Redis Sliding Window for API Keys (PIX-4040)

The DB-based rate limit for API keys works but has drawbacks:

- Window is **aligned** (not sliding) — burst at minute boundary resets
- DB writes on every request add latency
- `api_key_rate_limits` table requires periodic cleanup

**Target**: Add an optional Redis-backed sliding window rate limiter that can be
used at the middleware level (before `authenticateRequest`) for higher-traffic
endpoints.

---

## 6. Security Considerations

### 6.1 In Place

| Measure                                     | Location                               |
| ------------------------------------------- | -------------------------------------- |
| SHA-256 hashing of stored keys              | `developer-api-keys.ts:320`            |
| No plaintext key persistence after creation | `developer-api-keys.ts:78-86`          |
| CORS allows `X-API-Key` header              | `auth0-middleware.ts:457`              |
| CSRF protection for mutating requests       | `auth0-middleware.ts:288-397`          |
| Security headers (HSTS, CSP, XFO, etc.)     | `auth0-middleware.ts:402-477`          |
| Session IP binding (TOFU)                   | `auth0-middleware.ts:812-843`          |
| Adaptive MFA                                | `auth0-middleware.ts:846-896`          |
| Audit logging (security events)             | `auth0-middleware.ts:565-573, 898-908` |
| Auto-revoke after N failed attempts         | `developer-api-keys.ts:293-308`        |

### 6.2 Needed (Gaps to Close)

- **Rate limit on auth endpoints**: No rate limiting on `/api/auth/login` or
  `/api/auth/refresh` at middleware level (only key-level rate limit for API
  keys)
- **Key rotation endpoint**: No way to rotate a key without delete-and-recreate
- **OpenAPI spec**: No documented contract to audit against

---

## 7. SDK Integration

The `@pixelated-empathy/sdk` package at `packages/pixelated-sdk/` supports
dual-mode auth:

```typescript
// JWT mode (user sessions)
const client = new PixelatedClient({ token: 'eyJ...' })

// API key mode (machine-to-machine)
const client = new PixelatedClient({ apiKey: 'dev_a1b2...' })
```

SDK concerns identified during audit:

- Some Zod schemas use `.passthrough()` — reduces type safety for consumers
- Rate limit response handling needs verification
- No automatic retry on 429 responses

---

## 8. Gap Summary

| ID     | Gap                                             | Priority | Effort | Status   |
| ------ | ----------------------------------------------- | -------- | ------ | -------- |
| GAP-01 | `rotateApiKey()` not implemented                | High     | Small  | PIX-4039 |
| GAP-02 | Redis sliding window rate limiter for API keys  | Medium   | Medium | PIX-4040 |
| GAP-03 | OpenAPI spec generation                         | Medium   | Medium | PIX-4042 |
| GAP-04 | SDK Zod schema tightening                       | Low      | Small  | PIX-4043 |
| GAP-05 | Rate limiting on auth endpoints (login/refresh) | Medium   | Small  | Future   |
| GAP-06 | Auth boundary design formalized (this doc)      | Done     | Small  | PIX-4038 |

---

## 9. Dependencies & Graph

```
PIX-3925 (Dual-Mode Auth)
  ├── PIX-4038 [Auth Boundary Design]       ← YOU ARE HERE
  ├── PIX-4039 [Credential Model]            → Implements rotateApiKey()
  ├── PIX-4040 [Auth Middleware]             → Redis sliding window rate limiter
  ├── PIX-4041 [Route Scoping]              → Route config (done)
  ├── PIX-4042 [OpenAPI Contract]           → Spec generation
  ├── PIX-4043 [SDK Rollout]                → Schema tightening, verification
  └── PIX-4044 [Launch Gates]               → Coverage, integration test, security

Blocks: GraphQL federation (PIX-3928), partner integrations
```

---

## 10. References

- `src/lib/auth/auth0-middleware.ts` — Core middleware (1025 lines)
- `src/lib/auth/route-config.ts` — Route configuration
- `src/lib/auth/route-protection.ts` — Route protection helpers
- `src/lib/auth/scopes.ts` — Scope definitions
- `src/lib/db/developer-api-keys.ts` — API key manager (325 lines)
- `src/lib/db/developer-api-keys.test.ts` — API key tests
- `db/migrations/008_add_developer_api_keys.sql` — Schema migration
- `db/migrations/009_add_last_failed_at_to_developer_api_keys.sql` — Schema
  migration
