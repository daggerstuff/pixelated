/**
 * Guidance update mechanism for the reflection loop.
 *
 * Translates high-confidence `ReflectionInsight`s into writes to the
 * Foresight `guidance` and `self_improvement` context blocks so the
 * next session can benefit from what was learned.
 *
 * PIX-3899 — Sprint 4: Reflection & Learning
 */

import type { ReflectionInsight } from '@pixelated/memory-schema'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
const logger = createBuildSafeLogger('guidance-writer')

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Injectable writer that performs the actual block storage.
 *
 * Consumers provide their own implementation (e.g. one that calls the
 * Foresight MCP `manage_context_blocks` tool).  Tests use a mock.
 */
export interface GuidanceWriter {
  /** Write a single line of guidance text to the default block(s). */
  writeGuidance(text: string): Promise<void>
  /** Write content to a specific named block (e.g. "guidance", "self_improvement"). */
  writeGuidanceToBlock(label: string, content: string): Promise<void>
}

/** Options for {@link proposeGuidanceUpdate}. */
export interface ProposeGuidanceOptions {
  /**
   * Minimum confidence to promote an insight to the guidance block.
   * @default 0.8
   */
  confidenceThreshold?: number
  /**
   * Writer instance to use for block writes.
   * @default NoopGuidanceWriter
   */
  writer?: GuidanceWriter
  /**
   * Context block labels to update.
   * @default ["guidance", "self_improvement"]
   */
  targetLabels?: string[]
}

/** Result of a single `proposeGuidanceUpdate` call. */
export interface ProposeGuidanceResult {
  /** Whether the insight met the confidence threshold and was promoted. */
  promoted: boolean
  /** The formatted guidance text (written or not). */
  guidanceText: string
  /** Labels the text was (or would have been) written to. */
  targetLabels: string[]
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIDENCE_THRESHOLD = 0.8
const DEFAULT_TARGET_LABELS: string[] = ['guidance', 'self_improvement']

// ---------------------------------------------------------------------------
// NoopGuidanceWriter — default writer (safe for tests and no-connect setups)
// ---------------------------------------------------------------------------

/**
 * A writer that discards all writes.
 *
 * Used as the default when no writer is provided.  Production code should
 * supply a writer that calls the Foresight MCP `manage_context_blocks` tool
 * (e.g. via `ForesightClient` or a direct MCP transport).
 */
export class NoopGuidanceWriter implements GuidanceWriter {
  async writeGuidance(_text: string): Promise<void> {
    // no-op
  }

  async writeGuidanceToBlock(_label: string, _content: string): Promise<void> {
    // no-op
  }
}

// ---------------------------------------------------------------------------
// proposeGuidanceUpdate
// ---------------------------------------------------------------------------

/**
 * Propose a reflection insight for promotion to the Foresight guidance block.
 *
 * When `insight.confidence >= confidenceThreshold` (default 0.8) the insight
 * is formatted as guidance text and written **asynchronously** to the
 * configured target context blocks via the provided `writer`.
 *
 * The write is deferred to the next microtask so the caller is not blocked.
 * The returned `ProposeGuidanceResult` indicates whether promotion occurred.
 *
 * **Usage:**
 * ```ts
 * const result = proposeGuidanceUpdate(insight, { writer: myMcpWriter })
 * if (result.promoted) {
 *   logger.info(`Promoted: ${result.guidanceText}`)
 * }
 * ```
 */
export function proposeGuidanceUpdate(
  insight: Pick<
    ReflectionInsight,
    'summary' | 'insightType' | 'confidence' | 'recommendedAction'
  >,
  options: ProposeGuidanceOptions = {},
): ProposeGuidanceResult {
  const {
    confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
    writer = new NoopGuidanceWriter(),
    targetLabels = DEFAULT_TARGET_LABELS,
  } = options

  const guidanceText = formatGuidanceText(insight)

  if (insight.confidence < confidenceThreshold) {
    return { promoted: false, guidanceText, targetLabels }
  }

  // Schedule an async write to all target blocks.
  // The write is deferred so the caller is not blocked (fulfilling the
  // "within 5 seconds" AC — even a microtask completes well within that).
  queueMicrotask(() => {
    void writeToAllBlocks(guidanceText, targetLabels, writer)
  })

  return { promoted: true, guidanceText, targetLabels }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Format a reflection insight as human-readable guidance text.
 *
 * Output format:
 * ```
 * [2026-06-13] (improvement, 85% confidence) Insight summary here.
 * ```
 *
 * When a `recommendedAction` is present, it is appended after a pipe:
 * ```
 * [2026-06-13] (improvement, 85% confidence) Summary. | Recommended: action.
 * ```
 */
function formatGuidanceText(
  insight: Pick<
    ReflectionInsight,
    'summary' | 'insightType' | 'confidence' | 'recommendedAction'
  >,
): string {
  const today = new Date().toISOString().slice(0, 10)
  const confidencePct = Math.round(insight.confidence * 100)
  const action = insight.recommendedAction
    ? ` | Recommended: ${insight.recommendedAction}`
    : ''

  return `[${today}] (${insight.insightType}, ${confidencePct}% confidence) ${insight.summary}.${action}`
}

/**
 * Write `text` to every label in `labels` via `writer`.
 *
 * Individual failures are silently caught — guidance writes are best-effort
 * and must not crash the reflection loop.
 */
async function writeToAllBlocks(
  text: string,
  labels: string[],
  writer: GuidanceWriter,
): Promise<void> {
  for (const label of labels) {
    try {
      await writer.writeGuidanceToBlock(label, text)
    } catch {
      // Guidance writes are best-effort; do not propagate.
    }
  }
}
