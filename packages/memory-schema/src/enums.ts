/**
 * @pixelated/memory-schema — Canonical enum value sets
 *
 * Single source of truth for primitive enum literals. Consumed by runtime
 * guards, the public v1 API Zod contract, and OpenAPI generation.
 */

import type { MemoryScope, RetentionPolicy } from './types'

/** Canonical MemoryScope values. */
export const MEMORY_SCOPE_VALUES = [
  'session',
  'arc',
  'trait',
  'fact',
] as const satisfies readonly MemoryScope[]

/** Canonical RetentionPolicy values. */
export const RETENTION_POLICY_VALUES = [
  'ephemeral',
  'short_term',
  'long_term',
  'permanent',
] as const satisfies readonly RetentionPolicy[]
