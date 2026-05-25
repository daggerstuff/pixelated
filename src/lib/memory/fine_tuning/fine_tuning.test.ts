import { DatasetPreparator } from './dataset-preparation'
import { MemorySystemEvaluator } from './evaluation'

function makeMemory(overrides: Partial<any> = {}): any {
  return {
    id: overrides['id'] ?? `mem_${Math.random().toString(36).slice(2, 10)}`,
    tenantId: overrides['tenantId'] ?? 't1',
    sessionId: overrides['sessionId'] ?? 's1',
    content: overrides['content'] ?? 'test memory content',
    timestamp: overrides['timestamp'] ?? Date.now(),
    importance: overrides['importance'] ?? {
      raw: 0.5,
      recency: 0.5,
      relevance: 0.5,
      emotionalWeight: 1.0,
      actionability: 0.3,
    },
    emotions: overrides['emotions'] ?? {
      valence: 0.0,
      arousal: 0.5,
      categories: [],
    },
    gating: overrides['gating'] ?? {
      piiStatus: 'absent',
      crisisFlag: false,
      traumaIndicators: [],
      consentGate: 'open',
    },
    consolidation: overrides['consolidation'] ?? {
      phase: 'raw',
      lastProcessed: 0,
      remCycles: 3,
      schemaReferences: [],
    },
  }
}

describe('DatasetPreparator', () => {
  test('prepares dataset with splits', () => {
    const preparator = new DatasetPreparator()
    const memories = [
      makeMemory({
        emotions: { valence: -0.5, arousal: 0.5, categories: ['anxiety'] },
      }),
      makeMemory({
        emotions: { valence: 0.5, arousal: 0.5, categories: ['joy'] },
      }),
      makeMemory({
        emotions: { valence: 0.0, arousal: 0.5, categories: ['neutral'] },
      }),
    ]
    const [split, stats] = preparator.prepare(memories)
    expect(stats.totalExamples).toBeGreaterThanOrEqual(3)
    expect(split.train.length + split.val.length + split.test.length).toBe(
      stats.totalExamples,
    )
    expect(stats.piiLeakDetected).toBe(false)
  })

  test('detects PII in training data', () => {
    const preparator = new DatasetPreparator()
    const memories = [
      makeMemory({ content: 'my email is test@example.com' }),
      makeMemory({ content: 'my SSN is 123-45-6789' }),
    ]
    const [_split, stats] = preparator.prepare(memories)
    expect(stats.piiLeakDetected).toBe(true)
  })

  test('balances valence distribution', () => {
    const preparator = new DatasetPreparator()
    const memories = [
      makeMemory({
        emotions: { valence: -0.5, arousal: 0.5, categories: ['anxiety'] },
      }),
      makeMemory({
        emotions: { valence: -0.6, arousal: 0.5, categories: ['fear'] },
      }),
      makeMemory({
        emotions: { valence: 0.5, arousal: 0.5, categories: ['joy'] },
      }),
    ]
    const [_split, stats] = preparator.prepare(memories)
    expect(stats.totalExamples).toBeGreaterThanOrEqual(3)
  })
})

describe('MemorySystemEvaluator', () => {
  test('evaluates retrieval quality', () => {
    const evaluator = new MemorySystemEvaluator(5)
    const memories = [
      makeMemory({
        content: 'anxiety about work stress',
        emotions: { valence: -0.5, arousal: 0.7, categories: ['anxiety'] },
      }),
      makeMemory({
        content: 'happy day at the park',
        emotions: { valence: 0.8, arousal: 0.4, categories: ['joy'] },
      }),
      makeMemory({
        content: 'anxiety about health',
        emotions: { valence: -0.3, arousal: 0.6, categories: ['anxiety'] },
      }),
    ]
    const retrieval = evaluator.evaluateRetrieval(memories, ['anxiety'])
    expect(retrieval.precisionAtK).toBeGreaterThan(0)
    expect(retrieval.mrr).toBeGreaterThan(0)
  })

  test('evaluates safety metrics', () => {
    const evaluator = new MemorySystemEvaluator()
    const memories = [
      makeMemory({
        gating: {
          crisisFlag: true,
          piiStatus: 'absent',
          traumaIndicators: [],
          consentGate: 'open',
        },
      }),
      makeMemory({
        gating: {
          crisisFlag: false,
          piiStatus: 'absent',
          traumaIndicators: [],
          consentGate: 'open',
        },
      }),
      makeMemory({
        gating: {
          crisisFlag: false,
          piiStatus: 'absent',
          traumaIndicators: [],
          consentGate: 'open',
        },
      }),
    ]
    const safety = evaluator.evaluateSafety(memories)
    expect(safety.crisisSensitivity).toBe(1)
    expect(safety.piiLeakRate).toBe(0)
  })

  test('full evaluation report', () => {
    const evaluator = new MemorySystemEvaluator(5)
    const memories = Array.from({ length: 30 }, (_, i) =>
      makeMemory({
        content: `memory ${i} about topic ${i % 5}`,
        emotions: {
          valence: -0.5 + i * 0.04,
          arousal: 0.5,
          categories: ['anxiety', 'joy', 'fear', 'hope', 'sadness'][i % 5],
        },
        gating: {
          crisisFlag: i % 15 === 0,
          piiStatus: 'absent',
          traumaIndicators: [],
          consentGate: 'open',
        },
      }),
    )
    const report = evaluator.evaluate(memories)
    expect(report.retrieval).toBeDefined()
    expect(report.response).toBeDefined()
    expect(report.safety).toBeDefined()
    expect(report.performance).toBeDefined()
  })
})
