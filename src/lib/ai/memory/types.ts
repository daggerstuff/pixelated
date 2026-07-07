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
 * schemas) and have been removed. The foresight submodule keeps
 * its own copy of equivalent Zod schemas under
 * `foresight/packages/foresight-core/src/types.ts`.
 *
 * As of PIX-3905, `StanceShift` and `SynthesisResult` are also
 * re-exported from the package. This file is a pure re-export barrel
 * — no local interface declarations remain.
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

// Stance Shift and SynthesisResult — upstreamed in PIX-3905
export type { StanceShift, SynthesisResult } from '@pixelated/memory-schema';
