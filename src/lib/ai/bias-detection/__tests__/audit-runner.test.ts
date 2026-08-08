/**
 * Tests for BiasAuditRunner
 *
 * PIX-4046: Bias Audit Runner & Monthly Scheduled Job
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getBiasAuditRunner,
  resetBiasAuditRunner,
  type BiasAuditReport,
  type SegmentResult,
  type VarianceResult,
  type SegmentQualityMetrics,
} from '../audit-runner'
import type { TherapeuticSession, AIResponse } from '../types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeResponse(
  id: string,
  confidence: number,
  text?: string,
): AIResponse {
  return {
    responseId: id,
    text: text ?? `Response ${id}`,
    timestamp: new Date('2026-01-15T10:00:00Z'),
    type: 'intervention',
    confidence,
    modelUsed: 'test-model',
  }
}

function makeSession(
  id: string,
  demo: Record<string, unknown>,
  responses: AIResponse[],
  outcomes?: { outcomeId: string; description: string; achieved: boolean }[],
): TherapeuticSession {
  return {
    sessionId: id,
    participantDemographics: demo,
    aiResponses: responses,
    expectedOutcomes: outcomes ?? [
      { outcomeId: `${id}-o1`, description: 'Engagement', achieved: true },
    ],
  }
}

function makeSyntheticSessions(
  demographicGroups: Array<{
    demo: Record<string, unknown>
    count: number
    confidence: number
  }>,
): TherapeuticSession[] {
  const sessions: TherapeuticSession[] = []
  let counter = 0
  for (const group of demographicGroups) {
    for (let i = 0; i < group.count; i++) {
      const sid = `s-${counter++}`
      const responses: AIResponse[] = []
      for (let j = 0; j < 5; j++) {
        responses.push(
          makeResponse(
            `${sid}-r${j}`,
            group.confidence + (Math.random() - 0.5) * 0.1,
          ),
        )
      }
      sessions.push(makeSession(sid, group.demo, responses))
    }
  }
  return sessions
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('BiasAuditRunner', () => {
  let runner: ReturnType<typeof getBiasAuditRunner>

  beforeEach(() => {
    resetBiasAuditRunner()
    runner = getBiasAuditRunner()
  })

  afterEach(() => {
    resetBiasAuditRunner()
  })

  describe('runAudit', () => {
    it('should produce a report with correct structure', async () => {
      const sessions = makeSyntheticSessions([
        {
          demo: { age: '18-25', gender: 'female' },
          count: 15,
          confidence: 0.8,
        },
        { demo: { age: '26-35', gender: 'male' }, count: 15, confidence: 0.8 },
      ])

      const report = await runner.runAudit(sessions, { month: '2026-01' })

      expect(report).toBeDefined()
      expect(report.reportId).toContain('bias-audit-2026-01')
      expect(report.month).toBe('2026-01')
      expect(report.generatedAt).toBeTruthy()
      expect(report.totalSessions).toBe(30)
      expect(report.totalResponses).toBeGreaterThan(0)
      expect(Array.isArray(report.segments)).toBe(true)
      expect(Array.isArray(report.varianceResults)).toBe(true)
      expect(typeof report.thresholdExceeded).toBe('boolean')
      expect(typeof report.alertLevel).toBe('string')
      expect(typeof report.summary).toBe('string')
      expect(Array.isArray(report.recommendations)).toBe(true)
    })

    it('should group sessions by demographic dimensions', async () => {
      const sessions = makeSyntheticSessions([
        {
          demo: { age: '18-25', gender: 'female' },
          count: 10,
          confidence: 0.75,
        },
        { demo: { age: '26-35', gender: 'male' }, count: 10, confidence: 0.75 },
        {
          demo: { age: '36-50', gender: 'female' },
          count: 10,
          confidence: 0.75,
        },
      ])

      const report = await runner.runAudit(sessions)

      const ageSegments = report.segments.filter((s) => s.segmentKey === 'age')
      expect(ageSegments.length).toBeGreaterThanOrEqual(3)
      expect(ageSegments.some((s) => s.segmentValue === '18-25')).toBe(true)
      expect(ageSegments.some((s) => s.segmentValue === '26-35')).toBe(true)
      expect(ageSegments.some((s) => s.segmentValue === '36-50')).toBe(true)
    })

    it('should detect variance below threshold as passing', async () => {
      // All groups have similar confidence ~0.80
      const sessions: TherapeuticSession[] = []
      const ages = ['18-25', '26-35', '36-50']
      const confidences = [0.8, 0.805, 0.795]
      for (let g = 0; g < ages.length; g++) {
        for (let i = 0; i < 15; i++) {
          sessions.push(
            makeSession(`s-${g}-${i}`, { age: ages[g] }, [
              makeResponse(
                `r-${g}-${i}-0`,
                confidences[g],
                'Fixed length response text.',
              ),
              makeResponse(
                `r-${g}-${i}-1`,
                confidences[g],
                'Fixed length response text.',
              ),
            ]),
          )
        }
      }

      const report = await runner.runAudit(sessions, {
        varianceThreshold: 2.0,
        dimensions: ['age'],
      })

      // With similar confidence, variance should be < 2%
      const confidenceVariance = report.varianceResults.find(
        (v) => v.metric === 'averageConfidence',
      )
      expect(confidenceVariance).toBeDefined()
      expect(confidenceVariance!.variance).toBeLessThan(2.0)
      expect(confidenceVariance!.exceeded).toBe(false)
      expect(report.thresholdExceeded).toBe(false)
      expect(report.alertLevel).toBe('low')
    })

    it('should detect variance above threshold as exceeding', async () => {
      // Groups with very different confidence
      const sessions = makeSyntheticSessions([
        { demo: { age: '18-25' }, count: 15, confidence: 0.5 },
        { demo: { age: '26-35' }, count: 15, confidence: 0.9 },
      ])

      const report = await runner.runAudit(sessions, {
        varianceThreshold: 2.0,
        dimensions: ['age'],
      })

      const confidenceVariance = report.varianceResults.find(
        (v) => v.metric === 'averageConfidence',
      )
      expect(confidenceVariance).toBeDefined()
      expect(confidenceVariance!.variance).toBeGreaterThan(2.0)
      expect(confidenceVariance!.exceeded).toBe(true)
      expect(report.thresholdExceeded).toBe(true)
      expect(report.alertLevel).not.toBe('low')
    })

    it('should set alert level to critical when many metrics exceed', async () => {
      const sessions = makeSyntheticSessions([
        { demo: { age: '18-25' }, count: 15, confidence: 0.3 },
        { demo: { age: '26-35' }, count: 15, confidence: 0.95 },
      ])

      const report = await runner.runAudit(sessions, {
        varianceThreshold: 0.5,
        dimensions: ['age'],
      })

      const exceededCount = report.varianceResults.filter(
        (v) => v.exceeded,
      ).length
      expect(exceededCount).toBeGreaterThan(2)
      expect(report.alertLevel).toBe('critical')
    })

    it('should use default month when not specified', async () => {
      const report = await runner.runAudit([], {})
      const currentMonth = new Date().toISOString().slice(0, 7)
      expect(report.month).toBe(currentMonth)
    })

    it('should handle empty sessions gracefully', async () => {
      const report = await runner.runAudit([])

      expect(report.totalSessions).toBe(0)
      expect(report.totalResponses).toBe(0)
      expect(report.segments).toHaveLength(0)
      expect(report.thresholdExceeded).toBe(false)
      expect(report.alertLevel).toBe('low')
    })

    it('should handle sessions without demographics', async () => {
      const sessions: TherapeuticSession[] = [
        {
          sessionId: 'no-demo',
          aiResponses: [makeResponse('r1', 0.8)],
        },
      ]

      const report = await runner.runAudit(sessions)

      // Sessions without demographics should not contribute to segments
      expect(report.totalSessions).toBe(1)
      expect(report.segments).toHaveLength(0)
    })

    it('should handle culturalBackground array demographics', async () => {
      const sessions = makeSyntheticSessions([
        {
          demo: { culturalBackground: ['east-asian'] },
          count: 10,
          confidence: 0.75,
        },
        {
          demo: { culturalBackground: ['european'] },
          count: 10,
          confidence: 0.75,
        },
      ])

      const report = await runner.runAudit(sessions, {
        dimensions: ['culturalBackground'],
      })

      const culturalSegments = report.segments.filter(
        (s) => s.segmentKey === 'culturalBackground',
      )
      expect(culturalSegments.length).toBe(2)
      expect(
        culturalSegments.some((s) => s.segmentValue === 'east-asian'),
      ).toBe(true)
      expect(culturalSegments.some((s) => s.segmentValue === 'european')).toBe(
        true,
      )
    })

    it('should respect custom dimensions', async () => {
      const sessions = makeSyntheticSessions([
        {
          demo: { age: '18-25', gender: 'female' },
          count: 10,
          confidence: 0.75,
        },
      ])

      const report = await runner.runAudit(sessions, {
        dimensions: ['gender'],
      })

      // Only gender segments, no age segments
      expect(report.segments.every((s) => s.segmentKey === 'gender')).toBe(true)
    })

    it('should compute outcome achievement rate', async () => {
      const sessions: TherapeuticSession[] = []
      for (let i = 0; i < 15; i++) {
        sessions.push(
          makeSession(
            `s-${i}`,
            { age: '18-25' },
            [makeResponse(`s-${i}-r0`, 0.8)],
            [
              { outcomeId: `o1`, description: 'A', achieved: true },
              { outcomeId: `o2`, description: 'B', achieved: false },
            ],
          ),
        )
      }
      for (let i = 0; i < 15; i++) {
        sessions.push(
          makeSession(
            `s2-${i}`,
            { age: '26-35' },
            [makeResponse(`s2-${i}-r0`, 0.8)],
            [
              { outcomeId: `o1`, description: 'A', achieved: true },
              { outcomeId: `o2`, description: 'B', achieved: true },
            ],
          ),
        )
      }

      const report = await runner.runAudit(sessions, {
        dimensions: ['age'],
      })

      const outcomeVariance = report.varianceResults.find(
        (v) => v.metric === 'outcomeAchievementRate',
      )
      expect(outcomeVariance).toBeDefined()
      // Group 1: 50% achievement, Group 2: 100% achievement → 50% variance
      expect(outcomeVariance!.variance).toBeGreaterThan(2.0)
      expect(outcomeVariance!.exceeded).toBe(true)
    })

    it('should generate recommendations when threshold exceeded', async () => {
      const sessions = makeSyntheticSessions([
        { demo: { age: '18-25' }, count: 15, confidence: 0.4 },
        { demo: { age: '26-35' }, count: 15, confidence: 0.9 },
      ])

      const report = await runner.runAudit(sessions, {
        varianceThreshold: 2.0,
        dimensions: ['age'],
      })

      expect(report.recommendations.length).toBeGreaterThan(0)
      const hasVarianceRec = report.recommendations.some((r) =>
        r.includes('exceeds threshold'),
      )
      expect(hasVarianceRec).toBe(true)
    })

    it('should generate no-issue recommendation when within threshold', async () => {
      const sessions: TherapeuticSession[] = []
      for (let i = 0; i < 15; i++) {
        sessions.push(
          makeSession(`s-a-${i}`, { age: '18-25' }, [
            makeResponse(`a-${i}-r0`, 0.8, 'Fixed length response text.'),
            makeResponse(`a-${i}-r1`, 0.81, 'Fixed length response text.'),
          ]),
        )
      }
      for (let i = 0; i < 15; i++) {
        sessions.push(
          makeSession(`s-b-${i}`, { age: '26-35' }, [
            makeResponse(`b-${i}-r0`, 0.8, 'Fixed length response text.'),
            makeResponse(`b-${i}-r1`, 0.81, 'Fixed length response text.'),
          ]),
        )
      }

      const report = await runner.runAudit(sessions, {
        varianceThreshold: 5.0,
        dimensions: ['age'],
      })

      expect(report.recommendations.length).toBeGreaterThan(0)
      expect(report.recommendations[0]).toContain('No bias variance')
    })

    it('should flag underrepresented segments', async () => {
      const sessions = makeSyntheticSessions([
        { demo: { age: '18-25' }, count: 30, confidence: 0.75 },
        { demo: { age: '26-35' }, count: 3, confidence: 0.75 },
      ])

      const report = await runner.runAudit(sessions, {
        dimensions: ['age'],
      })

      const hasUnderrepresentedRec = report.recommendations.some((r) =>
        r.includes('fewer than 10 samples'),
      )
      expect(hasUnderrepresentedRec).toBe(true)
    })
  })

  describe('serializeReport', () => {
    it('should produce valid JSON', async () => {
      const sessions = makeSyntheticSessions([
        { demo: { age: '18-25' }, count: 10, confidence: 0.75 },
      ])

      const report = await runner.runAudit(sessions)
      const json = runner.serializeReport(report)
      const parsed = JSON.parse(json)

      expect(parsed.reportId).toBe(report.reportId)
      expect(parsed.month).toBe(report.month)
      expect(parsed.totalSessions).toBe(report.totalSessions)
      expect(Array.isArray(parsed.segments)).toBe(true)
    })
  })

  describe('getReportPath', () => {
    it('should return correct path format', () => {
      const path = runner.getReportPath('2026-01')
      expect(path).toBe('ai/data/reports/bias-audit-2026-01.json')
    })

    it('should handle different months', () => {
      expect(runner.getReportPath('2025-12')).toBe(
        'ai/data/reports/bias-audit-2025-12.json',
      )
      expect(runner.getReportPath('2026-07')).toBe(
        'ai/data/reports/bias-audit-2026-07.json',
      )
    })
  })

  describe('singleton', () => {
    it('should return same instance', () => {
      const a = getBiasAuditRunner()
      const b = getBiasAuditRunner()
      expect(a).toBe(b)
    })

    it('should return new instance after reset', () => {
      const a = getBiasAuditRunner()
      resetBiasAuditRunner()
      const b = getBiasAuditRunner()
      expect(a).not.toBe(b)
    })
  })
})
