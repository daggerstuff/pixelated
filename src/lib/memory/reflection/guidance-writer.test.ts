/**
 * Tests for src/lib/memory/reflection/guidance-writer.ts — PIX-3899.
 *
 * A mock `GuidanceWriter` records writes instead of hitting the Foresight
 * MCP server, fulfilling the "mock reflection loop" AC.
 *
 * Coverage:
 * - High-confidence insights (>= 0.8) are promoted
 * - Low-confidence insights are NOT promoted
 * - The correct block labels are targeted
 * - Async write is deferred (microtask) yet completes within test lifetime
 * - Optional recommendedAction is included in the formatted text
 * - Custom confidence threshold overrides the default
 * - Custom writer is called with formatted text
 */

import type { ReflectionInsight } from '@pixelated/memory-schema'
import { describe, test, expect, vi } from 'vitest'

import { proposeGuidanceUpdate, NoopGuidanceWriter } from './guidance-writer'
import type { GuidanceWriter } from './guidance-writer'

// ---------------------------------------------------------------------------
// Mock writer
// ---------------------------------------------------------------------------

class MockGuidanceWriter implements GuidanceWriter {
  readonly writes: Array<{ label: string; content: string }> = []

  async writeGuidance(text: string): Promise<void> {
    this.writes.push({ label: 'guidance', content: text })
  }

  async writeGuidanceToBlock(label: string, content: string): Promise<void> {
    this.writes.push({ label, content })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInsight(
  overrides: Partial<
    Pick<
      ReflectionInsight,
      | 'summary'
      | 'insightType'
      | 'confidence'
      | 'recommendedAction'
      | 'evidenceIds'
      | 'metadata'
    >
  > = {},
): Pick<
  ReflectionInsight,
  'summary' | 'insightType' | 'confidence' | 'recommendedAction'
> {
  return {
    summary: overrides.summary ?? 'Test insight',
    insightType: overrides.insightType ?? 'improvement',
    confidence: overrides.confidence ?? 0.85,
    recommendedAction: overrides.recommendedAction,
  }
}

// ---------------------------------------------------------------------------
// proposeGuidanceUpdate
// ---------------------------------------------------------------------------

describe('proposeGuidanceUpdate', () => {
  describe('confidence threshold (default 0.8)', () => {
    test('promotes insight when confidence >= 0.8', () => {
      const insight = makeInsight({ confidence: 0.8 })
      const mockWriter = new MockGuidanceWriter()

      const result = proposeGuidanceUpdate(insight, { writer: mockWriter })

      expect(result.promoted).toBe(true)
      expect(result.guidanceText).toContain('Test insight')
      expect(result.targetLabels).toEqual(['guidance', 'self_improvement'])
    })

    test('promotes insight when confidence > 0.8', () => {
      const insight = makeInsight({ confidence: 0.95 })
      const mockWriter = new MockGuidanceWriter()

      const result = proposeGuidanceUpdate(insight, { writer: mockWriter })

      expect(result.promoted).toBe(true)
    })

    test('does NOT promote insight when confidence < 0.8', () => {
      const insight = makeInsight({ confidence: 0.79 })

      const result = proposeGuidanceUpdate(insight)

      expect(result.promoted).toBe(false)
      // Result still carries formatted text for logging / transparency
      expect(result.guidanceText).toBeTruthy()
    })

    test('does NOT promote insight when confidence is 0', () => {
      const insight = makeInsight({ confidence: 0 })

      const result = proposeGuidanceUpdate(insight)

      expect(result.promoted).toBe(false)
    })
  })

  describe('async write behavior', () => {
    test('schedules a microtask write that reaches the writer', async () => {
      const insight = makeInsight({ confidence: 0.9 })
      const mockWriter = new MockGuidanceWriter()

      proposeGuidanceUpdate(insight, { writer: mockWriter })

      // Flush microtasks so the deferred write completes.
      await vi.waitFor(() => {
        expect(mockWriter.writes.length).toBeGreaterThanOrEqual(1)
      })

      // Verify write content
      const write = mockWriter.writes[0]
      expect(write.content).toContain('Test insight')
      expect(write.content).toContain('improvement')
      expect(write.content).toContain('90%')
    })

    test('writes to both guidance and self_improvement blocks', async () => {
      const insight = makeInsight({ confidence: 0.9 })
      const mockWriter = new MockGuidanceWriter()

      proposeGuidanceUpdate(insight, { writer: mockWriter })

      await vi.waitFor(() => {
        expect(mockWriter.writes.length).toBe(2)
      })

      const labels = mockWriter.writes.map((w) => w.label).sort()
      expect(labels).toEqual(['guidance', 'self_improvement'])
    })

    test('write completes within a microtask (within 5s AC)', async () => {
      const insight = makeInsight({ confidence: 0.9 })
      const mockWriter = new MockGuidanceWriter()

      const t0 = performance.now()
      proposeGuidanceUpdate(insight, { writer: mockWriter })

      await vi.waitFor(() => {
        expect(mockWriter.writes.length).toBeGreaterThan(0)
      })
      const elapsed = performance.now() - t0

      // The write completed far below 5 seconds (typically < 1 ms).
      expect(elapsed).toBeLessThan(5000)
    })
  })

  describe('formatted guidance text', () => {
    test('includes ISO date prefix, insight type, and confidence percentage', () => {
      const insight = makeInsight({
        summary: 'Prioritize empathetic tone over clinical jargon',
        insightType: 'improvement',
        confidence: 0.88,
      })

      const result = proposeGuidanceUpdate(insight)

      expect(result.guidanceText).toMatch(/^\[\d{4}-\d{2}-\d{2}\]/) // date
      expect(result.guidanceText).toContain('(improvement, 88% confidence)')
      expect(result.guidanceText).toContain(
        'Prioritize empathetic tone over clinical jargon.',
      )
    })

    test('appends recommendedAction when present', () => {
      const insight = makeInsight({
        summary: 'Review session transcripts for missed cues',
        recommendedAction: 'Add a post-session cue review step',
      })

      const result = proposeGuidanceUpdate(insight)

      expect(result.guidanceText).toContain('| Recommended:')
      expect(result.guidanceText).toContain(
        'Add a post-session cue review step',
      )
    })

    test('omits recommendedAction pipe when not present', () => {
      const insight = makeInsight({ recommendedAction: undefined })

      const result = proposeGuidanceUpdate(insight)

      expect(result.guidanceText).not.toContain('| Recommended:')
    })
  })

  describe('custom options', () => {
    test('uses custom confidenceThreshold when provided', () => {
      const insight = makeInsight({ confidence: 0.5 })
      const mockWriter = new MockGuidanceWriter()

      // With default threshold of 0.8, this would NOT be promoted.
      // With custom 0.4, it IS promoted.
      const result = proposeGuidanceUpdate(insight, {
        writer: mockWriter,
        confidenceThreshold: 0.4,
      })

      expect(result.promoted).toBe(true)
    })

    test('uses custom targetLabels when provided', () => {
      const insight = makeInsight({ confidence: 0.9 })
      const customLabels = ['guidance']

      const result = proposeGuidanceUpdate(insight, {
        targetLabels: customLabels,
      })

      expect(result.targetLabels).toEqual(['guidance'])
    })

    test('custom writer receives writes on next microtask', async () => {
      const insight = makeInsight({ confidence: 0.9 })
      const mockWriter = new MockGuidanceWriter()

      proposeGuidanceUpdate(insight, {
        writer: mockWriter,
        targetLabels: ['guidance'],
      })

      await vi.waitFor(() => {
        expect(mockWriter.writes.length).toBe(1)
      })

      expect(mockWriter.writes[0].label).toBe('guidance')
    })
  })

  describe('NoopGuidanceWriter', () => {
    test('writes succeed silently (no throw)', async () => {
      const writer = new NoopGuidanceWriter()
      await expect(writer.writeGuidance('test')).resolves.toBeUndefined()
      await expect(
        writer.writeGuidanceToBlock('guidance', 'test'),
      ).resolves.toBeUndefined()
    })
  })

  describe('rejected writes do not throw', () => {
    test('writer that throws is caught silently (best-effort)', async () => {
      const throwingWriter: GuidanceWriter = {
        writeGuidance: vi.fn().mockRejectedValue(new Error('MCP down')),
        writeGuidanceToBlock: vi.fn().mockRejectedValue(new Error('MCP down')),
      }

      // Should not throw — guidance writes are best-effort.
      expect(() =>
        proposeGuidanceUpdate(makeInsight({ confidence: 0.9 }), {
          writer: throwingWriter,
        }),
      ).not.toThrow()
    })
  })
})
