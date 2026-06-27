/**
 * Reflection metrics recorder — PIX-3900.
 *
 * Records per-reflection-run instrumentation and exposes rolling aggregates
 * for the trailing 30-day window.
 *
 * Trigger policy (reproduced here for reference):
 *   Reflection runs are triggered by:
 *   1. **Task completion** — after each action/feedback pair is appended
 *      to a trajectory and the pair count reaches the engine threshold.
 *   2. **Explicit user feedback** — when user rates a reflection output
 *      or corrects a guidance suggestion.
 *   3. **Scheduled (nightly)** — via the dream scheduler, which runs
 *      the full reflection pipeline on accumulated session data.
 */

import {
  type ReflectionMetrics,
  ReflectionMetricsSchema,
} from '@pixelated/memory-schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input to record a single reflection run. */
export interface ReflectionMetricsInput {
  tokenCost: number
  generationLatencyMs: number
  revisionCount: number
  /** Whether the user approved or accepted this reflection's output. */
  wasApproved: boolean
}

/** Rolling aggregates over the trailing 30-day window. */
export interface ReflectionMetricsAggregate {
  /** Total reflection runs in the window. */
  totalReflections: number
  /** Sum of tokenCost across all runs in the window. */
  totalTokenCost: number
  /** Mean generation latency in milliseconds. */
  averageLatencyMs: number
  /** Mean revision count per reflection run. */
  averageRevisionCount: number
  /** Rolling user approval rate (approved / total). */
  userApprovalRate: number
  /** The raw recorded metrics in the window. */
  records: ReflectionMetrics[]
}

// ---------------------------------------------------------------------------
// Internal storage
// ---------------------------------------------------------------------------

interface InternalRecord {
  metric: ReflectionMetrics
  wasApproved: boolean
}

// ---------------------------------------------------------------------------
// ReflectionMetricsRecorder
// ---------------------------------------------------------------------------

const DEFAULT_MAX_RECORDS = 10_000
const ROLLING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

/**
 * Records per-reflection-run metrics and exposes rolling aggregates.
 *
 * Storage is an in-memory array bounded by `maxRecords` — the oldest entries
 * are silently dropped when the cap is reached.  For production persistence,
 * wire this to a database-backed store.
 *
 * Thread-safe for single-threaded JS runtimes.  No external dependencies.
 */
export class ReflectionMetricsRecorder {
  private readonly records: InternalRecord[] = []
  private readonly maxRecords: number

  constructor(maxRecords: number = DEFAULT_MAX_RECORDS) {
    this.maxRecords = maxRecords
  }

  /**
   * Record a single reflection run's metrics.
   *
   * The `userApprovalRate` field in the stored entry is the *rolling* rate
   * over the trailing 30 days at the time of recording, computed from the
   * per-record `wasApproved` flags of trailing entries.
   */
  record(input: ReflectionMetricsInput): ReflectionMetrics {
    const now = new Date().toISOString()
    const trailing = this.trailingInternal(now)

    // Compute rolling approval rate from per-record flags.
    const totalInWindow = trailing.length + 1
    const approvedInWindow =
      trailing.filter((r) => r.wasApproved).length + (input.wasApproved ? 1 : 0)
    const rollingRate = approvedInWindow / totalInWindow

    const metric: ReflectionMetrics = ReflectionMetricsSchema.parse({
      tokenCost: input.tokenCost,
      generationLatencyMs: input.generationLatencyMs,
      revisionCount: input.revisionCount,
      userApprovalRate: Math.round(rollingRate * 100) / 100,
      recordedAt: now,
    })

    this.records.push({ metric, wasApproved: input.wasApproved })

    // Trim oldest entries when over capacity.
    if (this.records.length > this.maxRecords) {
      this.records.splice(0, this.records.length - this.maxRecords)
    }

    return metric
  }

  /**
   * Return aggregate metrics for the trailing 30-day window.
   */
  getMetrics(): ReflectionMetricsAggregate {
    const now = new Date().toISOString()
    const windowed = this.trailingInternal(now)

    if (windowed.length === 0) {
      return {
        totalReflections: 0,
        totalTokenCost: 0,
        averageLatencyMs: 0,
        averageRevisionCount: 0,
        userApprovalRate: 0,
        records: [],
      }
    }

    const totalTokenCost = windowed.reduce((s, r) => s + r.metric.tokenCost, 0)
    const totalLatency = windowed.reduce(
      (s, r) => s + r.metric.generationLatencyMs,
      0,
    )
    const totalRevisions = windowed.reduce(
      (s, r) => s + r.metric.revisionCount,
      0,
    )
    const approved = windowed.filter((r) => r.wasApproved).length

    return {
      totalReflections: windowed.length,
      totalTokenCost,
      averageLatencyMs: Math.round(totalLatency / windowed.length),
      averageRevisionCount:
        Math.round((totalRevisions / windowed.length) * 100) / 100,
      userApprovalRate: Math.round((approved / windowed.length) * 100) / 100,
      records: windowed.map((r) => ({ ...r.metric })),
    }
  }

  /**
   * Return internal records within the trailing 30-day window.
   */
  private trailingInternal(nowIso: string): InternalRecord[] {
    const cutoff = new Date(
      new Date(nowIso).getTime() - ROLLING_WINDOW_MS,
    ).toISOString()
    return this.records.filter((r) => r.metric.recordedAt >= cutoff)
  }

  /** Clear all recorded metrics (for testing / reset). */
  clear(): void {
    this.records.length = 0
  }
}

/**
 * Module-level default recorder singleton.
 *
 * Consumers who do not need a custom instance can import this directly:
 * ```ts
 * import { defaultRecorder } from "./reflection-metrics"
 * defaultRecorder.record({ tokenCost: 500, generationLatencyMs: 120, revisionCount: 1, wasApproved: true })
 * const agg = defaultRecorder.getMetrics()
 * ```
 */
export const defaultRecorder = new ReflectionMetricsRecorder()
