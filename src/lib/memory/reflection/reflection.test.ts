import { ActionPipeline, ActionPriority } from './action-pipeline'
import { DreamReflectionIntegrator } from './dream-integration'
import { PatternDetector } from './pattern-detection'
import { ReflexionEngine, FeedbackType } from './reflexion'
import { SessionConsolidator } from './session-consolidation'
import type { MemoryBlock, SessionSummary } from './session-consolidation'

function makeMemory(overrides: Partial<MemoryBlock> = {}): MemoryBlock {
  return {
    id: overrides.id ?? `mem_${Math.random().toString(36).slice(2, 10)}`,
    tenantId: overrides.tenantId ?? 't1',
    sessionId: overrides.sessionId ?? 's1',
    content: overrides.content ?? 'test memory',
    timestamp: overrides.timestamp ?? Date.now(),
    importance: overrides.importance ?? {
      raw: 0.5,
      recency: 0.5,
      relevance: 0.5,
      emotionalWeight: 1.0,
      actionability: 0.3,
      reveriePotential: 0.1,
    },
    emotions: overrides.emotions ?? {
      valence: 0.0,
      arousal: 0.5,
      categories: [],
    },
    gating: overrides.gating ?? {
      piiStatus: 'absent',
      crisisFlag: false,
      traumaIndicators: [],
      consentGate: 'open',
    },
    consolidation: overrides.consolidation ?? {
      phase: 'raw',
      lastProcessed: 0,
      remCycles: 3,
      schemaReferences: [],
      reverieEligible: false,
      reveriePhase: 'dormant',
    },
  }
}

describe('ReflexionEngine', () => {
  test('requires minimum pairs for reflection', () => {
    const engine = new ReflexionEngine(undefined, 3)
    engine.recordAction('a1', 'ok', FeedbackType.SUCCESS, 's1')
    engine.recordAction('a2', 'ok', FeedbackType.SUCCESS, 's1')
    expect(engine.reflect('s1')).toBeNull()
  })

  test('generates reflection with sufficient pairs', () => {
    const engine = new ReflexionEngine(undefined, 2)
    engine.recordAction('a1', 'good', FeedbackType.SUCCESS, 's1')
    engine.recordAction('a2', 'bad', FeedbackType.FAILURE, 's1')
    const result = engine.reflect('s1')
    expect(result).not.toBeNull()
    expect(result!.reflections.length).toBe(1)
  })

  test('tracks sessions', () => {
    const engine = new ReflexionEngine()
    engine.recordAction('a', 'ok', FeedbackType.NEUTRAL, 's1')
    engine.recordAction('b', 'ok', FeedbackType.NEUTRAL, 's2')
    expect(engine.sessionCount).toBe(2)
    expect(engine.totalPairs).toBe(2)
  })
})

describe('SessionConsolidator', () => {
  test('consolidates improving session', () => {
    const consolidator = new SessionConsolidator()
    const memories = [
      makeMemory({
        sessionId: 's1',
        emotions: { valence: -0.5, arousal: 0.5, categories: ['anxiety'] },
        timestamp: 1000,
      }),
      makeMemory({
        sessionId: 's1',
        emotions: { valence: -0.1, arousal: 0.5, categories: ['neutral'] },
        timestamp: 2000,
      }),
      makeMemory({
        sessionId: 's1',
        emotions: { valence: 0.5, arousal: 0.5, categories: ['hope'] },
        timestamp: 3000,
      }),
    ]
    const summary = consolidator.consolidate(memories)
    expect(summary.sessionId).toBe('s1')
    expect(summary.emotionalArc.trend).toBe('improving')
  })

  test('identifies unresolved crisis topics', () => {
    const consolidator = new SessionConsolidator()
    const memories = [
      makeMemory({
        sessionId: 's1',
        gating: {
          crisisFlag: true,
          piiStatus: 'absent',
          traumaIndicators: [],
          consentGate: 'open',
        },
      }),
    ]
    const summary = consolidator.consolidate(memories)
    expect(summary.unresolvedTopics).toContain(
      'crisis_content_requires_followup',
    )
  })
})

describe('PatternDetector', () => {
  test('detects recurring themes', () => {
    const detector = new PatternDetector(2)
    const sessions: SessionSummary[] = [
      {
        sessionId: 's1',
        tenantId: 't1',
        themes: ['anxiety'],
        emotionalArc: {
          startValence: 0,
          endValence: 0,
          minValence: 0,
          maxValence: 0,
          avgValence: 0,
          trend: 'stable',
          volatility: 0,
        },
        unresolvedTopics: [],
        summaryText: '',
        memoryCount: 1,
        timestampMs: 1000,
      },
      {
        sessionId: 's2',
        tenantId: 't1',
        themes: ['anxiety'],
        emotionalArc: {
          startValence: 0,
          endValence: 0,
          minValence: 0,
          maxValence: 0,
          avgValence: 0,
          trend: 'stable',
          volatility: 0,
        },
        unresolvedTopics: [],
        summaryText: '',
        memoryCount: 1,
        timestampMs: 2000,
      },
    ]
    const report = detector.analyze(sessions)
    expect(report.recurringThemes.some((t) => t.theme === 'anxiety')).toBe(true)
  })
})

describe('DreamReflectionIntegrator', () => {
  test('integrates dream and session insights', () => {
    const integrator = new DreamReflectionIntegrator()
    const dreamResult = {
      schemas: [
        {
          schemaId: 's1',
          title: 'test',
          generalization: 'test pattern',
          sourceMemoryIds: ['m1'],
          confidence: 0.7,
        },
      ],
      crossLinks: [],
    }
    const summary: SessionSummary = {
      sessionId: 's1',
      tenantId: 't1',
      themes: ['anxiety'],
      emotionalArc: {
        startValence: -0.5,
        endValence: 0.5,
        minValence: -0.5,
        maxValence: 0.5,
        avgValence: 0,
        trend: 'improving',
        volatility: 0.3,
      },
      unresolvedTopics: [],
      summaryText: 'test',
      memoryCount: 2,
      timestampMs: Date.now(),
    }
    const result = integrator.integrate(dreamResult, summary)
    expect(result.insights.length).toBeGreaterThan(0)
  })
})

describe('ActionPipeline', () => {
  test('generates crisis notifications', () => {
    const pipeline = new ActionPipeline()
    const summary: SessionSummary = {
      sessionId: 's1',
      tenantId: 't1',
      themes: ['crisis'],
      emotionalArc: {
        startValence: -0.5,
        endValence: -0.8,
        minValence: -0.8,
        maxValence: -0.5,
        avgValence: -0.65,
        trend: 'declining',
        volatility: 0.2,
      },
      unresolvedTopics: ['crisis_content_requires_followup'],
      summaryText: 'crisis',
      memoryCount: 2,
      timestampMs: Date.now(),
    }
    const result = pipeline.execute(summary)
    expect(result.notifications.some((n) => n.severity === 'critical')).toBe(
      true,
    )
  })

  test('generates recommendations for unresolved topics', () => {
    const pipeline = new ActionPipeline()
    const summary: SessionSummary = {
      sessionId: 's1',
      tenantId: 't1',
      themes: ['anxiety'],
      emotionalArc: {
        startValence: 0,
        endValence: 0,
        minValence: 0,
        maxValence: 0,
        avgValence: 0,
        trend: 'stable',
        volatility: 0,
      },
      unresolvedTopics: ['high_arousal:anxiety'],
      summaryText: 'test',
      memoryCount: 2,
      timestampMs: Date.now(),
    }
    const result = pipeline.execute(summary)
    expect(result.recommendations.length).toBeGreaterThan(0)
    expect(result.recommendations.at(-1)?.priority).toBe(ActionPriority.HIGH)
  })
})
