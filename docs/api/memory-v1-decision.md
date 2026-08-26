# ADR: Product-Only Memory API in v1

| Field                | Value      |
| -------------------- | ---------- |
| **Status**           | Accepted   |
| **Date**             | 2026-06-13 |
| **Owner**            | Chad       |
| **Contract Version** | 1.0.0      |

## Context

The Memory API could be exposed in two ways:

1. **Developer platform** — API keys, explicit scope declarations, public SDK
   rollout
2. **Product-only** — Session-derived auth, internal use first, developer access
   deferred

This choice affects:

- SDK design and authentication patterns
- Which fields are safe to expose externally
- Auth and tenancy architecture stability
- Privacy compliance for sensitive clinical data

The decision needs to be documented because it constrains:

- Route naming (no internal Hindsight/MCP shapes)
- Response fields (privacy-sensitive fields excluded)
- Future developer platform work (PIX-231)

## Decision

The v1 Memory API is **product-only**. Developer platform exposure is deferred
to a future contract version.

The public contract (`/api/v1/memory/*`) is the narrowest safe surface that
satisfies existing product use cases. External developers cannot access the
memory API via API keys in v1.

## Rationale

Three factors drove this decision (see contract doc §6 for full discussion):

1. **No internal Hindsight/MCP route shapes may leak into the public contract**

   The action-named internal routes (`/memory/add`, `/memory/list`, etc.) and
   Hindsight/MCP terminology are implementation details. Exposing them would
   lock us into a route shape that doesn't match the gateway implementation.

2. **Auth and tenancy are still stabilizing**

   The `ProductMemoryGateway` derives scope from the caller's session, not from
   developer API keys with explicit account/workspace context. Until that
   surface is ratified (PIX-3925, PIX-227), there is no safe developer-platform
   contract to expose.

3. **Privacy-sensitive fields need product review**

   Fields like `emotionalContext` and `empathyMetrics` contain Plutchik/VAD
   emotional metadata and therapeutic quality scores. These require product
   review before external developer exposure.

## Consequences

### Positive

- Narrowest safe surface for v1
- Avoids premature commitment to developer API patterns
- Privacy-safe by default (sensitive fields excluded)
- Keeps SDK design aligned with session-based auth

### Negative

- External developers cannot use the memory API yet
- SDK must use session auth rather than API keys
- Developer platform work (PIX-231) is blocked until auth stabilizes

### Neutral

- Developer platform tracked as follow-up (PIX-231)
- Legacy `/api/memory/*` routes remain for deprecation window (PIX-230)

## References

- [Memory API v1 Contract](./memory-v1-contract.md) — Full specification, §6 for
  detailed rationale
- [`src/lib/memory/contract/v1.ts`](../../src/lib/memory/contract/v1.ts) — Zod
  schemas (source of truth)
- [`src/pages/api/v1/memory/*`](../../src/pages/api/v1/memory/) — Route handlers
- [Error Contract](./memory-v1-contract.md#7-error-contract) — Status codes and
  error codes
- [PIX-231](https://linear.app/pixelated/issue/PIX-231) — Developer API and SDK
  rollout
- [PIX-3925](https://linear.app/pixelated/issue/PIX-3925) — Dual-mode auth and
  API key infrastructure
- [PIX-227](https://linear.app/pixelated/issue/PIX-227) — Tenancy stabilization
- [PIX-230](https://linear.app/pixelated/issue/PIX-230) — Legacy route
  deprecation
