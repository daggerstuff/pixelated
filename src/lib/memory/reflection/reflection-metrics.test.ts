/**
 * Tests for src/lib/memory/reflection/reflection-metrics.ts — PIX-3900.
 *
 * Covers:
 * - Recording a single reflection run
 * - Rolling 30-day window filters out old entries
 * - Empty state returns zeroed aggregates
 * - Approval rate computation
 * - Clear / reset
 * - Capacity trimming
 */

import { describe, test, expect, vi } from 'vitest'

import { ReflectionMetricsRecorder } from './reflection-metrics'
import type { ReflectionMetricsInput } from './reflection-metrics'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sampleInput(
  overrides: Partial<ReflectionMetricsInput> = {},
): ReflectionMetricsInput {
  return {
    tokenCost: overrides.tokenCost ?? 1500,
    generationLatencyMs: overrides.generationLatencyMs ?? 320,
    revisionCount: overrides.revisionCount ?? 1,
    wasApproved: overrides.wasApproved ?? true,
  }
}

// ---------------------------------------------------------------------------
// ReflectionMetricsRecorder
// ---------------------------------------------------------------------------

describe('ReflectionMetricsRecorder', () => {
  describe('record', () => {
    test('records a single reflection run and returns typed metric', () => {
      const recorder = new ReflectionMetricsRecorder()
      const result = recorder.record(sampleInput())

      expect(result.tokenCost).toBe(1500)
      expect(result.generationLatencyMs).toBe(320)
      expect(result.revisionCount).toBe(1)
      expect(result.recordedAt).toBeTruthy()
      // ISO-8601 format
      expect(result.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    test('rolling approval rate is 1.0 after one approved record', () => {
      const recorder = new ReflectionMetricsRecorder()
      const result = recorder.record(sampleInput({ wasApproved: true }))
      expect(result.userApprovalRate).toBe(1)
    })

    test('rolling approval rate is 0 after one rejected record', () => {
      const recorder = new ReflectionMetricsRecorder()
      const result = recorder.record(sampleInput({ wasApproved: false }))
      expect(result.userApprovalRate).toBe(0)
    })
  })

  describe('getMetrics — empty state', () => {
    test('returns zeroed aggregate when no records exist', () => {
      const recorder = new ReflectionMetricsRecorder()
      const agg = recorder.getMetrics()

      expect(agg.totalReflections).toBe(0)
      expect(agg.totalTokenCost).toBe(0)
      expect(agg.averageLatencyMs).toBe(0)
      expect(agg.averageRevisionCount).toBe(0)
      expect(agg.userApprovalRate).toBe(0)
      expect(agg.records).toEqual([])
    })
  })

  describe('getMetrics — aggregates', () => {
    test('computes totals and averages for multiple records', () => {
      const recorder = new ReflectionMetricsRecorder()

      recorder.record({
        tokenCost: 1000,
        generationLatencyMs: 200,
        revisionCount: 1,
        wasApproved: true,
      })
      recorder.record({
        tokenCost: 2000,
        generationLatencyMs: 400,
        revisionCount: 2,
        wasApproved: true,
      })
      recorder.record({
        tokenCost: 3000,
        generationLatencyMs: 600,
        revisionCount: 3,
        wasApproved: false,
      })

      const agg = recorder.getMetrics()
      expect(agg.totalReflections).toBe(3)
      expect(agg.totalTokenCost).toBe(6000)
      expect(agg.averageLatencyMs).toBe(400)
      expect(agg.averageRevisionCount).toBe(2)
      // 2 approved out of 3
      expect(agg.userApprovalRate).toBeCloseTo(0.67, 1)
    })

    test('records are returned in insertion order', () => {
      const recorder = new ReflectionMetricsRecorder()

      recorder.record(sampleInput({ tokenCost: 100 }))
      recorder.record(sampleInput({ tokenCost: 200 }))
      recorder.record(sampleInput({ tokenCost: 300 }))

      const agg = recorder.getMetrics()
      expect(agg.records.map((r) => r.tokenCost)).toEqual([100, 200, 300])
    })
  })

  describe('rolling 30-day window', () => {
    test('filters out records older than 30 days', () => {
      const recorder = new ReflectionMetricsRecorder()

      // Record some entries with a real clock.
      recorder.record(sampleInput({ tokenCost: 100 }))
      recorder.record(sampleInput({ tokenCost: 200 }))

      // Simulate old records by manipulating internal array.
      const oldDate = new Date(
        Date.now() - 31 * 24 * 60 * 60 * 1000,
      ).toISOString()
      // Internal records are `InternalRecord[]` wrapping `{ metric, wasApproved }`.
      const internal = (
        recorder as unknown as {
          records: Array<{ metric: { recordedAt: string } }>
        }
      ).records
      internal[0].metric.recordedAt = oldDate

      const agg = recorder.getMetrics()
      expect(agg.totalReflections).toBe(1)
      expect(agg.records[0].tokenCost).toBe(200)
    })
  })

  describe('clear', () => {
    test('resets all recorded metrics', () => {
      const recorder = new ReflectionMetricsRecorder()
      recorder.record(sampleInput())
      expect(recorder.getMetrics().totalReflections).toBe(1)

      recorder.clear()
      expect(recorder.getMetrics().totalReflections).toBe(0)
    })
  })

  describe('capacity trimming', () => {
    test('drops oldest records when maxRecords is exceeded', () => {
      const recorder = new ReflectionMetricsRecorder(3)

      recorder.record(sampleInput({ tokenCost: 100 }))
      recorder.record(sampleInput({ tokenCost: 200 }))
      recorder.record(sampleInput({ tokenCost: 300 }))
      recorder.record(sampleInput({ tokenCost: 400 })) // should evict 100

      const tokens = recorder.getMetrics().records.map((r) => r.tokenCost)
      expect(tokens).toEqual([200, 300, 400])
      expect(tokens).not.toContain(100)
    })
  })
})
