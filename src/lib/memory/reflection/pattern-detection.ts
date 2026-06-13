// Pattern Detection — Sprint 4, Task 3 (TypeScript mirror)
import { MemoryBlock } from '../../../types/memory'
import { SessionSummary } from './session-consolidation'

export interface RecurringTheme {
  theme: string
  frequency: number
  sessions: string[]
  avgValence: number
  trend: 'improving' | 'declining' | 'stable'
}

export interface ProgressTrend {
  metric: string
  direction: 'improving' | 'declining' | 'stable'
  confidence: number
  dataPoints: number[]
  slope: number
}

export interface TriggerPattern {
  trigger: string
  response: string
  coOccurrenceCount: number
  confidence: number
  exampleSessions: string[]
}

export interface InterventionResult {
  intervention: string
  effectivenessScore: number
  sessionsApplied: number
  avgValenceBefore: number
  avgValenceAfter: number
}

export interface PatternReport {
  recurringThemes: RecurringTheme[]
  progressTrends: ProgressTrend[]
  triggerPatterns: TriggerPattern[]
  interventionResults: InterventionResult[]
  elapsedMs: number
}

export class PatternDetector {
  private readonly minFreq: number
  private readonly minConfidence: number

  constructor(minFreq = 2, minConfidence = 0.6) {
    this.minFreq = minFreq
    this.minConfidence = minConfidence
  }

  analyze(
    sessions: SessionSummary[],
    rawMemories?: MemoryBlock[],
  ): PatternReport {
    const themes = this.detectRecurringThemes(sessions)
    const trends = this.detectProgressTrends(sessions)
    const triggers = this.detectTriggers(sessions, rawMemories)
    const interventions = this.analyzeInterventions(sessions)

    return {
      recurringThemes: themes,
      progressTrends: trends,
      triggerPatterns: triggers,
      interventionResults: interventions,
      elapsedMs: 0,
    }
  }

  private detectRecurringThemes(sessions: SessionSummary[]): RecurringTheme[] {
    const themeSessions: Record<string, string[]> = {}
    const themeValences: Record<string, number[]> = {}

    for (const s of sessions) {
      for (const theme of s.themes) {
        if (!themeSessions[theme]) {
          themeSessions[theme] = []
          themeValences[theme] = []
        }
        themeSessions[theme].push(s.sessionId)
        themeValences[theme].push(s.emotionalArc.avgValence)
      }
    }

    const results: RecurringTheme[] = []
    for (const [theme, sessionList] of Object.entries(themeSessions)) {
      if (sessionList.length < this.minFreq) continue
      const valences = themeValences[theme]
      let trend: 'improving' | 'declining' | 'stable' = 'stable'
      if (valences.length >= 2) {
        const mid = Math.floor(valences.length / 2)
        const firstHalf =
          valences.slice(0, mid).reduce((s, v) => s + v, 0) / mid
        const secondHalf =
          valences.slice(mid).reduce((s, v) => s + v, 0) /
          (valences.length - mid)
        if (secondHalf > firstHalf + 0.05) trend = 'improving'
        else if (secondHalf < firstHalf - 0.05) trend = 'declining'
      }

      results.push({
        theme,
        frequency: sessionList.length,
        sessions: sessionList,
        avgValence:
          Math.round(
            (valences.reduce((s, v) => s + v, 0) / valences.length) * 1000,
          ) / 1000,
        trend,
      })
    }

    return results.sort((a, b) => b.frequency - a.frequency)
  }

  private detectProgressTrends(sessions: SessionSummary[]): ProgressTrend[] {
    if (sessions.length < 2) return []

    const sorted = [...sessions].sort((a, b) => a.timestampMs - b.timestampMs)
    const valences = sorted.map((s) => s.emotionalArc.avgValence)
    const slope = this.linearSlope(valences)

    const direction =
      slope > 0.02 ? 'improving' : slope < -0.02 ? 'declining' : 'stable'
    const confidence = Math.min(Math.abs(slope) * 10, 1)

    return [
      {
        metric: 'avg_valence',
        direction,
        confidence: Math.round(confidence * 100) / 100,
        dataPoints: valences,
        slope: Math.round(slope * 10000) / 10000,
      },
    ]
  }

  private detectTriggers(
    sessions: SessionSummary[],
    rawMemories?: MemoryBlock[],
  ): TriggerPattern[] {
    if (!rawMemories) return []

    const crisisSessions = new Set(
      rawMemories.filter((m) => m.gating.crisisFlag).map((m) => m.sessionId),
    )

    const themeCounts: Record<string, number> = {}
    const themeCrisis: Record<string, number> = {}

    for (const s of sessions) {
      for (const theme of s.themes) {
        themeCounts[theme] = (themeCounts[theme] ?? 0) + 1
        if (crisisSessions.has(s.sessionId)) {
          themeCrisis[theme] = (themeCrisis[theme] ?? 0) + 1
        }
      }
    }

    const patterns: TriggerPattern[] = []
    for (const [theme, count] of Object.entries(themeCounts)) {
      const crisisCount = themeCrisis[theme] ?? 0
      if (crisisCount >= this.minFreq) {
        const confidence = crisisCount / count
        if (confidence >= this.minConfidence) {
          patterns.push({
            trigger: theme,
            response: 'crisis_escalation',
            coOccurrenceCount: crisisCount,
            confidence: Math.round(confidence * 100) / 100,
            exampleSessions: sessions
              .filter(
                (s) =>
                  s.themes.includes(theme) && crisisSessions.has(s.sessionId),
              )
              .slice(0, 3)
              .map((s) => s.sessionId),
          })
        }
      }
    }

    return patterns
  }

  private analyzeInterventions(
    sessions: SessionSummary[],
  ): InterventionResult[] {
    if (sessions.length < 2) return []

    const sorted = [...sessions].sort((a, b) => a.timestampMs - b.timestampMs)
    const mid = Math.floor(sorted.length / 2)
    const early = sorted.slice(0, mid)
    const late = sorted.slice(mid)

    const earlyValence =
      early.reduce((s, session) => s + session.emotionalArc.avgValence, 0) /
      early.length
    const lateValence =
      late.reduce((s, session) => s + session.emotionalArc.avgValence, 0) /
      late.length
    const effectiveness = lateValence - earlyValence

    return [
      {
        intervention: 'ongoing_therapy',
        effectivenessScore: Math.round(effectiveness * 1000) / 1000,
        sessionsApplied: sessions.length,
        avgValenceBefore: Math.round(earlyValence * 1000) / 1000,
        avgValenceAfter: Math.round(lateValence * 1000) / 1000,
      },
    ]
  }

  private linearSlope(values: number[]): number {
    const n = values.length
    if (n < 2) return 0
    const xMean = (n - 1) / 2
    const yMean = values.reduce((s, v) => s + v, 0) / n
    const numerator = values.reduce(
      (s, v, i) => s + (i - xMean) * (v - yMean),
      0,
    )
    const denominator = Array.from(
      { length: n },
      (_, i) => (i - xMean) ** 2,
    ).reduce((s, v) => s + v, 0)
    return denominator === 0 ? 0 : numerator / denominator
  }
}
