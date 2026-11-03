import type { MemoryScope, RetentionPolicy } from './types'

export const MEMORY_SCOPE_VALUES = [
  'session',
  'arc',
  'trait',
  'fact',
] as const satisfies readonly MemoryScope[]

export const RETENTION_POLICY_VALUES = [
  'ephemeral',
  'short_term',
  'long_term',
  'permanent',
] as const satisfies readonly RetentionPolicy[]
