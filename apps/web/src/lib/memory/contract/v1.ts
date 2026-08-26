/**
 * @file src/lib/memory/contract/v1.ts
 *
 * Canonical v1 public contract for the Pixelated Memory API.
 *
 * This file is the SINGLE SOURCE OF TRUTH for the shape, validation, and
 * documentation of the versioned public memory surface. Both the route
 * handlers and the OpenAPI spec derive from these schemas.
 *
 * Design principles (see docs/api/memory-v1-contract.md):
 *
 *  1. The contract is INTENTIONALLY NARROW — it exposes only the fields that
 *     are safe and stable across the public product surface. Internal-only
 *     fields (e.g. `vectorId`, `emotionalContext`, `empathyMetrics`,
 *     `synthesizedFrom`, `bankId`, `sourceService`, `decayRate`,
 *     `strengthTrend`, `activationCount`, `retrievalCount`, `isGhost`,
 *     `gist`, `accessedAt`, `lastRetrievedAt`) are deliberately omitted.
 *     Internal Hindsight/MCP route shapes (e.g. `/memory/add`,
 *     `/memory/list`, `/memory/search`, `/memory/update`, `/memory/delete`)
 *     are NOT part of this contract and must never be advertised to external
 *     consumers.
 *
 *  2. The contract is versioned at the URI level: `/api/v1/memory/*`. Any
 *     breaking change requires a new version namespace.
 *
 *  3. Identity and scope are derived from the authenticated session. The
 *     contract never accepts `userId`, `accountId`, `workspaceId`, or
 *     `tenantId` as request inputs — those are resolved server-side from
 *     the caller's session and API key.
 *
 *  4. Pagination uses opaque `limit`/`offset` (small surface, easy to
 *     reason about). Cursor pagination can be added in v2.
 *
 *  5. The error envelope is fixed and small: `{ error, message, code? }`.
 *     See `./errors.ts` for the canonical mapping.
 *
 * NOTE: This file must not import from any server-only module. It is
 * permitted to be imported by client SDKs, the OpenAPI generator, and the
 * route handlers.
 */
import {
  MEMORY_SCOPE_VALUES,
  RETENTION_POLICY_VALUES,
} from '@pixelated/memory-schema'
import type {
  MemoryScope as MemoryScopeType,
  RetentionPolicy as RetentionPolicyType,
} from '@pixelated/memory-schema'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Enumerations — value sets sourced from @pixelated/memory-schema so the
// public contract cannot drift from the canonical schema.
// ---------------------------------------------------------------------------

export const MemoryScope = z.enum(MEMORY_SCOPE_VALUES)
export type MemoryScope = MemoryScopeType

export const RetentionPolicy = z.enum(RETENTION_POLICY_VALUES)
export type RetentionPolicy = RetentionPolicyType

// ---------------------------------------------------------------------------
// Identity / scope envelope — the canonical workspace tenancy model.
//
// These fields are resolved server-side from the authenticated session and
// API key. They NEVER appear in request bodies (enforced by .strict() on
// every request schema). They appear in response envelopes so consumers can
// confirm which scope the operation was executed under.
// ---------------------------------------------------------------------------

export const MemoryApiScope = z.enum(['product', 'developer'])
export type MemoryApiScope = z.infer<typeof MemoryApiScope>

export const MemoryApiRole = z.enum([
  'owner',
  'clinician',
  'member',
  'observer',
])
export type MemoryApiRole = z.infer<typeof MemoryApiRole>

export const IdentityScope = z
  .object({
    workspaceId: z.string().min(1),
    userId: z.string().min(1),
    scope: MemoryApiScope,
    role: MemoryApiRole,
  })
  .strict()
export type IdentityScope = z.infer<typeof IdentityScope>

// ---------------------------------------------------------------------------
// Core resource — the PUBLIC memory record.
//
// This is a STRICT SUBSET of the internal `UnifiedMemory` type. It contains
// only the fields the product public API promises to external consumers.
// ---------------------------------------------------------------------------

export const PublicMemory = z
  .object({
    /** UUID v4 — globally unique. */
    id: z.uuid(),
    /** The memory content. The "what happened" text. */
    content: z.string().min(1).max(64_000),
    /** Memory scope — logical lifecycle boundary. */
    scope: MemoryScope,
    /** Retention / eviction policy. */
    retention: RetentionPolicy,
    /** Free-form category for filtering (e.g. "fact", "preference"). */
    category: z.string().min(1).max(64),
    /** Free-form tags for ad-hoc filtering. */
    tags: z.array(z.string().min(1).max(64)).max(64),
    /** Monotonically increasing version counter. */
    version: z.number().int().nonnegative(),
    /** Current importance score (0.0 → 1.0). */
    importance: z.number().min(0).max(1),
    /** ISO 8601 — when this memory was first created. */
    createdAt: z.iso.datetime(),
    /** ISO 8601 — when this memory was last mutated, or null. */
    updatedAt: z.iso.datetime().nullable(),
  })
  .strict()
export type PublicMemory = z.infer<typeof PublicMemory>

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

export const CreateMemoryRequest = z
  .object({
    content: z.string().min(1).max(64_000),
    scope: MemoryScope.optional(),
    retention: RetentionPolicy.optional(),
    category: z.string().min(1).max(64).optional(),
    tags: z.array(z.string().min(1).max(64)).max(64).optional(),
    importance: z.number().min(0).max(1).optional(),
  })
  .strict()
export type CreateMemoryRequest = z.infer<typeof CreateMemoryRequest>

export const UpdateMemoryRequest = z
  .object({
    content: z.string().min(1).max(64_000),
    scope: MemoryScope.optional(),
    retention: RetentionPolicy.optional(),
    category: z.string().min(1).max(64).optional(),
    tags: z.array(z.string().min(1).max(64)).max(64).optional(),
    importance: z.number().min(0).max(1).optional(),
  })
  .strict()
export type UpdateMemoryRequest = z.infer<typeof UpdateMemoryRequest>

export const DeleteMemoryRequest = z.object({}).strict()
export type DeleteMemoryRequest = z.infer<typeof DeleteMemoryRequest>

export const SearchMemoriesRequest = z
  .object({
    q: z.string().min(1).max(1_000),
    limit: z.number().int().positive().max(100).optional(),
    offset: z.number().int().nonnegative().optional(),
  })
  .strict()
export type SearchMemoriesRequest = z.infer<typeof SearchMemoriesRequest>

/**
 * @deprecated Use SearchMemoriesRequest instead. This alias will be removed
 * in the next contract version.
 */
export const SearchMemoryRequest = SearchMemoriesRequest
export type SearchMemoryRequest = SearchMemoriesRequest

// ---------------------------------------------------------------------------
// Query parameters (string-typed at the boundary; coerced in handlers)
// ---------------------------------------------------------------------------

export const ListMemoriesQuery = z
  .object({
    limit: z.coerce.number().int().positive().max(100).optional(),
    offset: z.coerce.number().int().nonnegative().optional(),
    category: z.string().min(1).max(64).optional(),
    tags: z
      .union([z.string(), z.array(z.string().min(1).max(64))])
      .optional()
      .transform((v) =>
        v === undefined ? undefined : Array.isArray(v) ? v : [v],
      ),
  })
  .strict()
export type ListMemoriesQuery = z.infer<typeof ListMemoriesQuery>

export const SearchMemoriesQuery = z
  .object({
    q: z.string().min(1).max(1_000),
    limit: z.coerce.number().int().positive().max(100).optional(),
    offset: z.coerce.number().int().nonnegative().optional(),
  })
  .strict()
export type SearchMemoriesQuery = z.infer<typeof SearchMemoriesQuery>

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

export const Pagination = z
  .object({
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .strict()
export type Pagination = z.infer<typeof Pagination>

export const CreateMemoryResponse = z
  .object({
    data: PublicMemory,
    identity: IdentityScope.optional(),
  })
  .strict()
export type CreateMemoryResponse = z.infer<typeof CreateMemoryResponse>

export const GetMemoryResponse = z
  .object({
    data: PublicMemory,
    identity: IdentityScope.optional(),
  })
  .strict()
export type GetMemoryResponse = z.infer<typeof GetMemoryResponse>

export const UpdateMemoryResponse = z
  .object({
    data: PublicMemory,
    identity: IdentityScope.optional(),
  })
  .strict()
export type UpdateMemoryResponse = z.infer<typeof UpdateMemoryResponse>

export const DeleteMemoryResponse = z
  .object({
    data: z.object({ id: z.uuid() }).strict(),
    identity: IdentityScope.optional(),
  })
  .strict()
export type DeleteMemoryResponse = z.infer<typeof DeleteMemoryResponse>

export const ListMemoriesResponse = z
  .object({
    data: z.array(PublicMemory),
    pagination: Pagination,
    identity: IdentityScope.optional(),
  })
  .strict()
export type ListMemoriesResponse = z.infer<typeof ListMemoriesResponse>

export const SearchMemoriesResponse = z
  .object({
    data: z.array(PublicMemory),
    query: z.string(),
    pagination: Pagination,
    identity: IdentityScope.optional(),
  })
  .strict()
export type SearchMemoriesResponse = z.infer<typeof SearchMemoriesResponse>

// ---------------------------------------------------------------------------
// Path parameters
// ---------------------------------------------------------------------------

export const MemoryIdParam = z
  .object({
    memoryId: z.uuid(),
  })
  .strict()
export type MemoryIdParam = z.infer<typeof MemoryIdParam>

// ---------------------------------------------------------------------------
// Contract version constant
// ---------------------------------------------------------------------------

/**
 * The public memory API contract version. Bumped when the shape of the
 * Zod schemas above changes in a way that is observable to consumers.
 *
 * Backwards-compatible additions (e.g. optional response fields, new enum
 * values) MAY be made within a single contract version. Breaking changes
 * require a new URI namespace (e.g. /api/v2/memory/*).
 */
export const MEMORY_API_CONTRACT_VERSION = '1.0.0' as const
