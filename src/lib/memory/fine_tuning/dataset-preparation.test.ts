import { describe, expect, test } from 'vitest'

import type { MemoryBlock } from '../../../types/memory'
import { DatasetPreparator } from './dataset-preparation'

function makeMemory(
  overrides: Partial<Record<string, unknown>> = {},
): MemoryBlock {
  return {
    id: (overrides['id'] as string) ?? 'mem_001',
    tenantId: (overrides['tenantId'] as string) ?? 't1',
    sessionId: (overrides['sessionId'] as string) ?? 's1',
    content: (overrides['content'] as string) ?? 'test memory content',
    timestamp: (overrides['timestamp'] as number) ?? Date.now(),
    importance: {
      raw: 0.5,
      recency: 0.5,
      relevance: 0.5,
      emotionalWeight: 1.0,
      actionability: 0.3,
    },
    emotions: {
      valence: (overrides['valence'] as number) ?? 0.0,
      arousal: (overrides['arousal'] as number) ?? 0.5,
      categories: (overrides['categories'] as string[]) ?? [],
    },
    gating: {
      piiStatus: (overrides['piiStatus'] as string) ?? 'absent',
      crisisFlag: (overrides['crisisFlag'] as boolean) ?? false,
      traumaIndicators: (overrides['traumaIndicators'] as string[]) ?? [],
      consentGate: (overrides['consentGate'] as string) ?? 'open',
    },
    consolidation: {
      phase: 'raw',
      lastProcessed: 0,
      remCycles: 3,
      schemaReferences: [],
    },
  } as unknown as MemoryBlock
}

describe('DatasetPreparator', () => {
  describe('determinism', () => {
    test('same seed produces identical split', () => {
      const memories = Array.from({ length: 10 }, (_, i) =>
        makeMemory({ id: `mem_${i}`, sessionId: `s${i % 3}` }),
      )

      const p1 = new DatasetPreparator(0.7, 0.15, 42)
      const p2 = new DatasetPreparator(0.7, 0.15, 42)

      const [split1] = p1.prepare(memories)
      const [split2] = p2.prepare(memories)

      expect(split1.train.map((e) => e.metadata['memory_id'])).toEqual(
        split2.train.map((e) => e.metadata['memory_id']),
      )
      expect(split1.val.map((e) => e.metadata['memory_id'])).toEqual(
        split2.val.map((e) => e.metadata['memory_id']),
      )
      expect(split1.test.map((e) => e.metadata['memory_id'])).toEqual(
        split2.test.map((e) => e.metadata['memory_id']),
      )
    })

    test('different seeds produce different splits', () => {
      const memories = Array.from({ length: 10 }, (_, i) =>
        makeMemory({ id: `mem_${i}`, sessionId: `s${i % 3}` }),
      )

      const p1 = new DatasetPreparator(0.7, 0.15, 42)
      const p2 = new DatasetPreparator(0.7, 0.15, 99)

      const [split1] = p1.prepare(memories)
      const [split2] = p2.prepare(memories)

      const train1 = split1.train.map((e) => e.metadata['memory_id']).join(',')
      const train2 = split2.train.map((e) => e.metadata['memory_id']).join(',')
      expect(train1).not.toBe(train2)
    })
  })

  describe('split ratios', () => {
    test('produces correct split sizes', () => {
      const memories = Array.from({ length: 100 }, (_, i) =>
        makeMemory({ id: `mem_${i}`, sessionId: `s${i % 5}` }),
      )

      const preparator = new DatasetPreparator(0.7, 0.15)
      const [split] = preparator.prepare(memories)

      expect(split.train.length).toBe(70)
      expect(split.val.length).toBe(15)
      expect(split.test.length).toBe(15)
    })

    test('handles small dataset', () => {
      const memories = [
        makeMemory({ id: 'mem_1', sessionId: 's1' }),
        makeMemory({ id: 'mem_2', sessionId: 's1' }),
      ]

      const preparator = new DatasetPreparator()
      const [split, stats] = preparator.prepare(memories)

      expect(split.train.length).toBeGreaterThanOrEqual(1)
      expect(stats.totalExamples).toBe(2)
    })

    test('handles empty input', () => {
      const preparator = new DatasetPreparator()
      const [split, stats] = preparator.prepare([])

      expect(split.train).toEqual([])
      expect(split.val).toEqual([])
      expect(split.test).toEqual([])
      expect(stats.totalExamples).toBe(0)
    })
  })

  describe('PII detection', () => {
    test('detects email addresses', () => {
      const preparator = new DatasetPreparator()
      const memories = [makeMemory({ content: 'my email is user@example.com' })]
      const [, stats] = preparator.prepare(memories)
      expect(stats.piiLeakDetected).toBe(true)
    })

    test('detects phone numbers', () => {
      const preparator = new DatasetPreparator()
      const memories = [makeMemory({ content: 'call me at 555-123-4567' })]
      const [, stats] = preparator.prepare(memories)
      expect(stats.piiLeakDetected).toBe(true)
    })

    test('detects SSN patterns', () => {
      const preparator = new DatasetPreparator()
      const memories = [makeMemory({ content: 'my SSN is 123-45-6789' })]
      const [, stats] = preparator.prepare(memories)
      expect(stats.piiLeakDetected).toBe(true)
    })

    test('reports clean data', () => {
      const preparator = new DatasetPreparator()
      const memories = [
        makeMemory({ content: 'I feel anxious about my job interview' }),
      ]
      const [, stats] = preparator.prepare(memories)
      expect(stats.piiLeakDetected).toBe(false)
    })
  })

  describe('stats', () => {
    test('computes avgValence correctly', () => {
      const preparator = new DatasetPreparator()
      const memories = [
        makeMemory({
          id: 'mem_neg',
          valence: -0.5,
          content: 'negative memory',
        }),
        makeMemory({
          id: 'mem_pos',
          valence: 0.5,
          content: 'positive memory',
        }),
      ]
      const [, stats] = preparator.prepare(memories)
      expect(stats.avgValence).toBe(0)
    })

    test('tracks crisis ratio', () => {
      const preparator = new DatasetPreparator()
      const memories = [
        makeMemory({ id: 'mem_1', crisisFlag: true, content: 'crisis' }),
        makeMemory({ id: 'mem_2', crisisFlag: false, content: 'normal' }),
        makeMemory({ id: 'mem_3', crisisFlag: false, content: 'normal' }),
      ]
      const [, stats] = preparator.prepare(memories)
      expect(stats.crisisRatio).toBeCloseTo(1 / 3, 3)
    })
  })

  describe('valence balancing', () => {
    test('produces examples across all splits', () => {
      const preparator = new DatasetPreparator()
      const memories = [
        makeMemory({
          id: 'mem_1',
          sessionId: 's1',
          valence: -0.5,
          content: 'anxiety',
        }),
        makeMemory({
          id: 'mem_2',
          sessionId: 's1',
          valence: 0.5,
          content: 'joy',
        }),
        makeMemory({
          id: 'mem_3',
          sessionId: 's1',
          valence: 0.0,
          content: 'neutral',
        }),
      ]
      const [split] = preparator.prepare(memories)
      const allExamples = [...split.train, ...split.val, ...split.test]
      expect(allExamples.length).toBeGreaterThanOrEqual(3)
    })
  })
})
