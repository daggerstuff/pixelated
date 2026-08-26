/**
 * Unit tests for src/lib/memory/importance-scorer.ts — PIX-510 Task 2.
 * Mirrors ai/memory/test_importance_scorer.py exactly.
 */

import type { MemoryBlock } from '@/types/memory'

import {
  exponentialDecay,
  cosineSimilarity as cosSim,
  emotionalWeight,
  ImportanceScorer,
  DEFAULT_WEIGHTS,
} from '../importance-scorer'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMemory(
  categories: string[] = [],
  actionability = 0.5,
  timestampMs: number = Date.now(),
): MemoryBlock {
  return {
    id: 'test',
    tenantId: 't1',
    sessionId: 's1',
    content: 'Therapeutic session discussing coping strategies for anxiety',
    timestamp: timestampMs,
    importance: {
      raw: 0,
      recency: 0,
      relevance: 0,
      emotionalWeight: 1,
      actionability,
      reveriePotential: 0.1,
    },
    emotions: { valence: -0.3, arousal: 0.7, categories },
    gating: {
      piiStatus: 'absent',
      crisisFlag: false,
      traumaIndicators: [],
      consentGate: 'open',
    },
    consolidation: {
      phase: 'raw',
      lastProcessed: 0,
      remCycles: 0,
      schemaReferences: [],
      reverieEligible: false,
      reveriePhase: 'dormant',
    },
  }
}

// ─── Cosine similarity ───────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('identical texts → 1.0', () => {
    expect(cosSim('hello world', 'hello world')).toBeCloseTo(1, 3)
  })

  it('same tokens different order → 1.0', () => {
    expect(cosSim('hello world', 'world hello')).toBeCloseTo(1, 3)
  })

  it('partial overlap → between 0.3 and 0.8', () => {
    const s = cosSim('hello world', 'world')
    expect(s).toBeGreaterThan(0.3)
    expect(s).toBeLessThan(0.8)
  })

  it('no common tokens → ~0', () => {
    expect(cosSim('hello world', 'foo bar baz qux')).toBeLessThan(0.01)
  })

  it('empty string a → 0', () => expect(cosSim('', 'hello')).toBe(0))
  it('empty string b → 0', () => expect(cosSim('hello', '')).toBe(0))
  it('both empty → 0', () => expect(cosSim('', '')).toBe(0))

  it('tokenisation is case-insensitive', () => {
    expect(cosSim('HELLO WORLD', 'hello world')).toBeCloseTo(1, 3)
  })
})

// ─── Exponential decay ────────────────────────────────────────────────────────

describe('exponentialDecay', () => {
  const now = Date.now()
  const day = 86_400_000
  const week = 7 * day

  it('fresh memory → ~1.0', () => {
    expect(exponentialDecay(now, now)).toBeCloseTo(1, 2)
  })

  it('7-day-old memory with τ=7 → ~0.368', () => {
    expect(exponentialDecay(now - week, now, 7)).toBeCloseTo(0.3679, 1)
  })

  it('14-day-old memory with τ=7 → ~0.135', () => {
    expect(exponentialDecay(now - 2 * week, now, 7)).toBeCloseTo(0.1353, 1)
  })

  it('future timestamp clamps to 1.0', () => {
    expect(exponentialDecay(now + day, now)).toBeCloseTo(1, 2)
  })

  it('τ=1 day: 1-day-old → ~0.368', () => {
    expect(exponentialDecay(now - day, now, 1)).toBeCloseTo(0.3679, 1)
  })

  it('zero age → 1.0', () => expect(exponentialDecay(now, now)).toBe(1))
})

// ─── Emotional weight ─────────────────────────────────────────────────────────

describe('emotionalWeight', () => {
  const CRISIS = ['suicide', 'self-harm', 'overdose', 'panic', 'psychosis']
  const HIGH = [
    'grief',
    'trauma',
    'anxiety',
    'fear',
    'anger',
    'despair',
    'hopelessness',
  ]
  const NORMAL = ['joy', 'trust', 'anticipation', 'surprise', 'disgust']

  it('crisis categories → 5.0', () => {
    CRISIS.forEach((cat) => expect(emotionalWeight([cat])).toBe(5.0))
  })

  it('high categories → 2.0', () => {
    HIGH.forEach((cat) => expect(emotionalWeight([cat])).toBe(2.0))
  })

  it('normal categories → 1.0', () => {
    NORMAL.forEach((cat) => expect(emotionalWeight([cat])).toBe(1.0))
  })

  it('mixed: highest priority wins', () => {
    expect(emotionalWeight(['joy', 'anxiety'])).toBe(2.0) // high > normal
    expect(emotionalWeight(['anxiety', 'suicide'])).toBe(5.0) // crisis > high
  })

  it('empty → 1.0 (normal)', () => expect(emotionalWeight([])).toBe(1.0))

  it('case-insensitive', () => {
    expect(emotionalWeight(['ANXIETY'])).toBe(2.0)
    expect(emotionalWeight(['Suicide'])).toBe(5.0)
  })
})

// ─── ImportanceScorer ────────────────────────────────────────────────────────

describe('ImportanceScorer', () => {
  describe('score()', () => {
    it('returns value in [0, 1]', () => {
      const scorer = new ImportanceScorer()
      const m = makeMemory()
      const s = scorer.score(m)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    })

    it('is deterministic — same input → same output', () => {
      const scorer = new ImportanceScorer()
      const m = makeMemory()
      const s1 = scorer.score(m)
      const s2 = scorer.score(m)
      expect(s1).toBe(s2)
    })

    it('anxiety memory scores higher than joy memory', () => {
      const scorer = new ImportanceScorer()
      const anxiety = makeMemory(['anxiety'])
      const joy = makeMemory(['joy'])
      expect(scorer.score(anxiety)).toBeGreaterThan(scorer.score(joy))
    })

    it('crisis memory scores highest', () => {
      const scorer = new ImportanceScorer()
      const crisis = makeMemory(['suicide'])
      const high = makeMemory(['anxiety'])
      expect(scorer.score(crisis)).toBeGreaterThan(scorer.score(high))
    })

    it('context improves relevance score', () => {
      const scorer = new ImportanceScorer()
      const m = makeMemory()
      const sNoCtx = scorer.score(m, '')
      const sWithCtx = scorer.score(m, 'coping strategies anxiety therapy')
      expect(sWithCtx).toBeGreaterThan(sNoCtx)
    })
  })

  describe('scoreComponents()', () => {
    it('returns all component fields', () => {
      const scorer = new ImportanceScorer()
      const comps = scorer.scoreComponents(makeMemory(['grief']))
      expect(comps).toHaveProperty('recency')
      expect(comps).toHaveProperty('relevance')
      expect(comps.emotionalWeight).toBe(2.0)
      expect(comps.raw).toBeGreaterThanOrEqual(0)
      expect(comps.raw).toBeLessThanOrEqual(1)
    })
  })

  describe('fromEnv()', () => {
    it('creates an ImportanceScorer', () => {
      const scorer = ImportanceScorer.fromEnv()
      expect(scorer).toBeInstanceOf(ImportanceScorer)
    })
  })

  describe('latency benchmark', () => {
    it('scores in under 10ms each on average', () => {
      const scorer = new ImportanceScorer()
      const ms = scorer.benchmark(500)
      expect(ms).toBeLessThan(10)
    })
  })
})

// ─── ScoringWeights defaults ─────────────────────────────────────────────────

describe('DEFAULT_WEIGHTS', () => {
  it('has all required weight fields', () => {
    expect(DEFAULT_WEIGHTS.alpha).toBe(0.25)
    expect(DEFAULT_WEIGHTS.beta).toBe(0.25)
    expect(DEFAULT_WEIGHTS.gamma).toBe(0.3)
    expect(DEFAULT_WEIGHTS.delta).toBe(0.2)
    expect(DEFAULT_WEIGHTS.decayTauDays).toBe(7)
  })
})
