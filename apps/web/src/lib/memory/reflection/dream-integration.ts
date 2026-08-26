import { PatternReport } from './pattern-detection'
// Dream-Reflection Integration — Sprint 4, Task 4 (TypeScript mirror)
import { SessionSummary } from './session-consolidation'

export interface DreamReflectionInsight {
  insightId: string
  source: 'dream' | 'reflection' | 'pattern'
  content: string
  confidence: number
  relatedMemoryIds: string[]
}

export interface DreamReflectionResult {
  insights: DreamReflectionInsight[]
  dreamPriorities: Record<string, number>
  reflectionEnhancements: string[]
  elapsedMs: number
}

export interface DreamSchema {
  schemaId: string
  title: string
  generalization: string
  sourceMemoryIds: string[]
  confidence: number
}

export interface DreamCrossLink {
  memoryAId: string
  memoryBId: string
  similarity: number
  linkType: string
}

export interface DreamResult {
  schemas: DreamSchema[]
  crossLinks: DreamCrossLink[]
}

export class DreamReflectionIntegrator {
  private insightCounter = 0

  integrate(
    dreamResult: DreamResult,
    sessionSummary: SessionSummary,
    patternReport?: PatternReport,
  ): DreamReflectionResult {
    const insights: DreamReflectionInsight[] = []

    insights.push(...this.extractDreamInsights(dreamResult))
    insights.push(...this.extractSessionInsights(sessionSummary))
    if (patternReport) {
      insights.push(...this.extractPatternInsights(patternReport))
    }

    const dreamPriorities = this.computeDreamPriorities(
      dreamResult,
      sessionSummary,
      patternReport,
    )
    const reflectionEnhancements = this.buildReflectionEnhancements(
      insights,
      sessionSummary,
    )

    return {
      insights,
      dreamPriorities,
      reflectionEnhancements,
      elapsedMs: 0,
    }
  }

  private extractDreamInsights(
    dreamResult: DreamResult,
  ): DreamReflectionInsight[] {
    const insights: DreamReflectionInsight[] = []

    for (const schema of dreamResult.schemas) {
      this.insightCounter++
      insights.push({
        insightId: `insight_dream_${this.insightCounter}`,
        source: 'dream',
        content: schema.generalization,
        confidence: schema.confidence,
        relatedMemoryIds: schema.sourceMemoryIds,
      })
    }

    for (const link of dreamResult.crossLinks) {
      if (link.linkType === 'emotional_co_occurrence') {
        this.insightCounter++
        insights.push({
          insightId: `insight_dream_${this.insightCounter}`,
          source: 'dream',
          content: `Emotional co-occurrence: memories ${link.memoryAId} and ${link.memoryBId} (similarity ${link.similarity.toFixed(2)})`,
          confidence: link.similarity,
          relatedMemoryIds: [link.memoryAId, link.memoryBId],
        })
      }
    }

    return insights
  }

  private extractSessionInsights(
    summary: SessionSummary,
  ): DreamReflectionInsight[] {
    const insights: DreamReflectionInsight[] = []

    if (summary.unresolvedTopics.length > 0) {
      this.insightCounter++
      insights.push({
        insightId: `insight_session_${this.insightCounter}`,
        source: 'reflection',
        content: `Unresolved topics: ${summary.unresolvedTopics.join(', ')}`,
        confidence: 0.8,
        relatedMemoryIds: [],
      })
    }

    const arc = summary.emotionalArc
    if (arc.trend !== 'stable') {
      this.insightCounter++
      insights.push({
        insightId: `insight_session_${this.insightCounter}`,
        source: 'reflection',
        content: `Emotional trajectory: ${arc.trend} (${arc.startValence} → ${arc.endValence})`,
        confidence: 0.7,
        relatedMemoryIds: [],
      })
    }

    return insights
  }

  private extractPatternInsights(
    report: PatternReport,
  ): DreamReflectionInsight[] {
    const insights: DreamReflectionInsight[] = []

    for (const theme of report.recurringThemes) {
      if (theme.frequency >= 3) {
        this.insightCounter++
        insights.push({
          insightId: `insight_pattern_${this.insightCounter}`,
          source: 'pattern',
          content: `Recurring theme '${theme.theme}' across ${theme.frequency} sessions (trend: ${theme.trend})`,
          confidence: Math.min(theme.frequency / 5, 1),
          relatedMemoryIds: [],
        })
      }
    }

    for (const trigger of report.triggerPatterns) {
      this.insightCounter++
      insights.push({
        insightId: `insight_pattern_${this.insightCounter}`,
        source: 'pattern',
        content: `Trigger pattern: '${trigger.trigger}' → '${trigger.response}' (confidence ${trigger.confidence.toFixed(2)})`,
        confidence: trigger.confidence,
        relatedMemoryIds: [],
      })
    }

    return insights
  }

  private computeDreamPriorities(
    dreamResult: DreamResult,
    summary: SessionSummary,
    patternReport?: PatternReport,
  ): Record<string, number> {
    const priorities: Record<string, number> = {}

    for (const topic of summary.unresolvedTopics) {
      priorities[topic] = 0.9
    }

    if (summary.emotionalArc.trend === 'declining') {
      priorities['crisis_monitoring'] = 0.95
    }

    if (patternReport) {
      for (const theme of patternReport.recurringThemes) {
        if (theme.trend === 'declining') {
          priorities[`theme:${theme.theme}`] = 0.85
        }
      }
    }

    for (const schema of dreamResult.schemas) {
      if (schema.confidence >= 0.5) {
        priorities[`schema:${schema.schemaId}`] = schema.confidence * 0.7
      }
    }

    return priorities
  }

  private buildReflectionEnhancements(
    insights: DreamReflectionInsight[],
    summary: SessionSummary,
  ): string[] {
    const enhancements: string[] = []

    const dreamInsights = insights.filter((i) => i.source === 'dream')
    if (dreamInsights.length > 0) {
      enhancements.push(
        `Dream analysis identified ${dreamInsights.length} patterns to reflect on`,
      )
    }

    const patternInsights = insights.filter((i) => i.source === 'pattern')
    if (patternInsights.length > 0) {
      enhancements.push(
        `Cross-session patterns detected: ${patternInsights
          .slice(0, 3)
          .map((i) => i.content.slice(0, 50))
          .join(', ')}`,
      )
    }

    if (summary.emotionalArc.volatility > 0.3) {
      enhancements.push(
        'High emotional volatility detected — prioritize stability in next session',
      )
    }

    return enhancements
  }
}
