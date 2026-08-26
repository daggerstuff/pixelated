# Memory API Documentation — **DEPRECATED**

> **Status: Deprecated since 2026-06-13 (PIX-1908).** **Sunset:
> `Sat, 01 Jan 2027 00:00:00 GMT`** (advertised via `Sunset` response header on
> every legacy route). **Do not build new integrations against these
> endpoints.**
>
> This document remains here as a **migration reference** only, so teams
> currently calling the legacy `/api/memory/*` routes can find their way to the
> supported v1 surface and the deprecation timeline.

---

## 1. Where to go instead

| If you want to…                                          | Use                                                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Build a **new** product integration                      | [`docs/api/memory-v1-contract.md`](./memory-v1-contract.md) — the canonical public contract. |
| Read the ADR that explains the **product-only** decision | [`docs/api/memory-v1-decision.md`](./memory-v1-decision.md) — ADR-0003.                      |
| Generate a client or inspect the OpenAPI 3.1 spec        | [`docs/api-reference/openapi.yaml`](../api-reference/openapi.yaml).                          |
| See the deprecation policy and migration plan            | §4 below.                                                                                    |
| Read about an internal-only route                        | The contract doc explicitly excludes it — these routes are out of scope for any consumer.    |

The v1 routes live at `/api/v1/memory/*` and use
`X-Memory-Contract-Version: 1.0.0` on every response. Canonical v1 schemas are
in `src/lib/memory/contract/v1.ts`.

---

## 2. Why these routes are deprecated

The legacy `/api/memory/*` routes — including the action-named internal shapes
`/api/memory/add`, `/api/memory/list`, `/api/memory/search`,
`/api/memory/update`, `/api/memory/delete`, `/api/memory/stats` — were the
historical public memory surface. They expose internal implementation shapes
(Hindsight/MCP route names, full `UnifiedMemory` fields, gateway-internal error
mapping) that are not safe for external consumers and not aligned with the
product gateway implementation.

The v1 contract at `/api/v1/memory/*` provides:

- A **strict, curated public resource** (cf. `memory-v1-contract.md` §4).
- **Correct HTTP status mapping** for auth/scope failures (401/403 instead of
  the legacy 502 leak — see `memory-v1-contract.md` §1).
- The **`{ data, pagination?, query? }` envelope** instead of the legacy
  `{ success, memory, ... }` shape.
- **Versioned URI namespacing** and an explicit deprecation policy via the
  contract version constant.

The ADR for this decision: `docs/api/memory-v1-decision.md`.

---

## 3. What stayed (legacy behavior, for reference)

If you must keep calling the legacy routes during the deprecation window, the
behavior below remains accurate. The legacy routes return the legacy envelope
`{ success, data, message }` or `{ success, error, message }` on errors, and
respond with `Deprecation: true` and `Sunset: Sat, 01 Jan 2027 00:00:00 GMT` on
every successful response. They are not yet hard-removed.

### 3.1 Authentication

All requests require a Bearer JWT in the `Authorization` header:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

JWT validation and scope derivation are framework-default — no per-route
override.

### 3.2 Error envelope

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": "Additional error details (optional)"
}
```

Note: v1 returns `{ error, message }` only; it no longer carries a top-level
`details` field. Plan your migration accordingly.

### 3.3 HTTP status codes used by the legacy routes

- `200` — Success
- `201` — Created
- `400` — Bad Request
- `401` — Unauthorized
- `403` — Forbidden
- `404` — Not Found
- `429` — Too Many Requests
- `500` — Internal Server Error
- `502` — **Legacy quirk.** Auth/scope failures (the gateway's `401`/`403`) are
  surfaced as `502 Bad Gateway` by the legacy `handleMemoryApiError` helper. v1
  fixes this — see `memory-v1-contract.md` §1.

### 3.4 Endpoints (legacy, for reference only)

| Method   | Legacy path                     | Replaced by (v1)                                        |
| -------- | ------------------------------- | ------------------------------------------------------- |
| `POST`   | `/api/memory`                   | `POST /api/v1/memory`                                   |
| `GET`    | `/api/memory`                   | `GET /api/v1/memory`                                    |
| `GET`    | `/api/memory/{memoryId}`        | `GET /api/v1/memory/{memoryId}`                         |
| `PATCH`  | `/api/memory/{memoryId}`        | `PATCH /api/v1/memory/{memoryId}`                       |
| `DELETE` | `/api/memory/{memoryId}`        | `DELETE /api/v1/memory/{memoryId}`                      |
| `GET`    | `/api/memory/{memoryId}`        | `GET /api/v1/memory/{memoryId}`                         |
| `POST`   | `/api/memory/search`            | `POST /api/v1/memory/search`                            |
| `GET`    | `/api/memory/search?q=...`      | `GET /api/v1/memory/search?q=...`                       |
| `GET`    | `/api/memory/stats`             | Not exposed in v1. Use `/api/v1/memory` + scope filters |
| `POST`   | `/api/memory/add` _(action)_    | Use `POST /api/v1/memory`                               |
| `GET`    | `/api/memory/list` _(action)_   | Use `GET /api/v1/memory`                                |
| `PATCH`  | `/api/memory/update` _(action)_ | Use `PATCH /api/v1/memory/{memoryId}`                   |
| `DELETE` | `/api/memory/delete` _(action)_ | Use `DELETE /api/v1/memory/{memoryId}`                  |

> Action-named internal shapes (`/api/memory/add`, `/list`, `/update`,
> `/delete`) are implementation leftovers and have never been part of the public
> contract. They are listed here only so existing callers can find their
> migration path — do not document them anywhere new.

### 3.5 Legacy response field surface

The legacy routes return the **full** `UnifiedMemory` object, including fields
the v1 contract deliberately omits (`emotionalContext`, `empathyMetrics`,
`vectorId`, `sourceService`, `isGhost`, `synthesizedFrom`, etc.). On migration
to v1, callers must stop relying on these fields — they are not exposed and not
safe to depend on.

---

## 4. Deprecation timeline

| Phase               | Window                  | Action                                                                                                                         |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Advertise (current) | 2026-06-13 → 2026-10-01 | `Deprecation: true` + `Sunset: Sat, 01 Jan 2027` headers on every legacy response. **Documented here and at contract doc §6.** |
| Warn in logs        | 2026-10-01 → 2027-01-01 | Legacy routes emit operator-visible warnings (`memory-api` logger WARN) on every call. No change to response.                  |
| Hard removal        | 2027-01-01 →            | Legacy routes return `410 Gone`. Follow-up issue will track the deletion of `src/pages/api/memory/*` and this file.            |

The dates are deliberately conservative — they exist to give the in-app frontend
time to migrate, not because the routes are unsafe. New external consumers must
target v1 only.

---

## 5. Consumer migration checklist

For any consumer currently calling the legacy routes:

1. Switch the base path from `/api/memory` to `/api/v1/memory`. Keep the v1
   contract version (`1.0.0`) pinned in your client.
2. Drop `tenantId`, `userId`, `accountId`, `workspaceId`, `bankId` from request
   bodies — v1 schemas are `.strict()` and reject these with
   `400 validation_failed`. Identity is resolved server-side from the session.
3. Update your response parser from
   `{ success, data } | { success, error, message, details }` to
   `{ data, pagination?, query? } | { error, message }`.
4. Switch your error switch from HTTP status alone to switch on the stable
   `error` code (`memory-v1-contract.md` §7). Auth failures that were returning
   `502` will now correctly return `401`/`403`.
5. Remove any reliance on the fields listed in §3.5. The v1 surface is the
   curated subset only.
6. Update SDK / client code to read the `X-Memory-Contract-Version` header and
   surface version mismatches to operators.

For new code, skip the legacy routes entirely — start at
`memory-v1-contract.md`.

---

## 6. References

- `docs/api/memory-v1-contract.md` — Canonical public contract (v1)
- `docs/api/memory-v1-decision.md` — ADR for the product-only decision
- `docs/api-reference/openapi.yaml` — OpenAPI 3.1 spec (generated from the v1
  Zod schemas)
- `src/lib/memory/contract/v1.ts` — Zod schemas (source of truth)
- `src/pages/api/v1/memory/*` — v1 route handlers
- `src/pages/api/memory/*` — Legacy route handlers (deprecation window)
- `src/pages/api/memory/__tests__/legacy-deprecation.test.ts` — Verifies header
  emission and `PublicMemory` envelope compatibility
- Linear: [PIX-230](https://linear.app/pixelated/issue/PIX-230) (this doc
  rewrite), [PIX-231](https://linear.app/pixelated/issue/PIX-231) (developer API
  / SDK rollout — gated on auth stabilization)
