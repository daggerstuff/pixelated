/**
 * Memory-system types — re-exported from the canonical
 * `@pixelated/memory-schema` package.
 *
 * The local memory system (gate, linker, synthesizer, tagger) used to
 * define its own `MemoryObject`, `EmotionalMetadata`, `EmpathyMetrics`,
 * and `GateResult` shapes that drifted from the package (snake_case vs
 * camelCase, missing fields). As of PIX-3890, this file is a thin
 * barrel: the package is the single source of truth, and the local
 * type names are preserved as aliases so existing import paths keep
 * working.
 *
 * The Zod validation schemas that previously lived here were dead code
 * in this directory (consumers used the TypeScript types, not the
 * schemas) and have been removed. The foresight-mcp submodule keeps
 * its own copy of equivalent Zod schemas under
 * `foresight-mcp/packages/foresight-core/src/types.ts`.
 *
 * Local-only types that are not yet upstream (`StanceShift`,
 * `SynthesisResult`) remain defined here until the package grows them.
 */

// Primitive enums and shared types — re-exported as-is
export type {
  MemoryScope,
  RetentionPolicy,
  GateDecision,
  SourceService,
  StrengthTrend,
} from '@pixelated/memory-schema';

// Sub-objects — re-exported under the local names
export type { EmotionalContext as EmotionalMetadata } from '@pixelated/memory-schema';
export type { UnifiedMemory as MemoryObject } from '@pixelated/memory-schema';
export type { EmpathyMetrics } from '@pixelated/memory-schema';

// Gate result — re-exported as-is
export type { GateResult } from '@pixelated/memory-schema';

// Input / query shapes (available if local code needs them)
export type {
  CreateMemoryInput,
  UpdateMemoryInput,
  MemoryQueryOptions,
} from '@pixelated/memory-schema';

// Local-only types not yet in the package. These are Foresight-specific
// (stance-shift detection, reconciliation synthesis) and should be
// proposed upstream in a follow-up.
export interface StanceShift {
  attribute: string;
  old_value: number;
  new_value: number;
  delta: number;
  evidence_ids: string[];
  confidence: number;
}

export interface SynthesisResult {
  merged_ids: string[];
  new_memory_id: string;
  stance_shifts: StanceShift[];
  compression_ratio: number;
}
