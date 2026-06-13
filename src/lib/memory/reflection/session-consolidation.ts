// Session Consolidation — Sprint 4, Task 2 (TypeScript mirror)
import { MemoryBlock } from '../../../types/memory'
export type { MemoryBlock }

export interface EmotionalArc {
  startValence: number
  endValence: number
  minValence: number
  maxValence: number
  avgValence: number
  trend: 'improving' | 'declining' | 'stable'
  volatility: number
}

export interface SessionSummary {
  sessionId: string
  tenantId: string
  themes: string[]
  emotionalArc: EmotionalArc
  unresolvedTopics: string[]
  summaryText: string
  memoryCount: number
  timestampMs: number
}

export type SummarizerFn = (
  memories: MemoryBlock[],
  themes: string[],
  arc: EmotionalArc,
) => string

export class SessionConsolidator {
  private readonly summarizer: SummarizerFn

  constructor(summarizer?: SummarizerFn) {
    this.summarizer = summarizer ?? SessionConsolidator.defaultSummarizer
  }

  consolidate(memories: MemoryBlock[]): SessionSummary {
    if (memories.length === 0)
      throw new Error('Cannot consolidate empty memory list')

    const first = memories[0]
    const tenantId = first.tenantId
    const sessionId = first.sessionId
    const themes = this.extractThemes(memories)
    const emotionalArc = this.computeEmotionalArc(memories)
    const unresolved = this.identifyUnresolved(memories)
    const summaryText = this.summarizer(memories, themes, emotionalArc)

    return {
      sessionId,
      tenantId,
      themes,
      emotionalArc,
      unresolvedTopics: unresolved,
      summaryText,
      memoryCount: memories.length,
      timestampMs: Date.now(),
    }
  }

  private extractThemes(memories: MemoryBlock[]): string[] {
    const counter: Record<string, number> = {}
    for (const m of memories) {
      const cats =
        m.emotions.categories.length > 0 ? m.emotions.categories : ['general']
      for (const cat of cats) {
        counter[cat] = (counter[cat] ?? 0) + 1
      }
    }
    return Object.entries(counter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cat]) => cat)
  }

  private computeEmotionalArc(memories: MemoryBlock[]): EmotionalArc {
    const sorted = [...memories].sort((a, b) => a.timestamp - b.timestamp)
    const valences = sorted.map((m) => m.emotions.valence)

    if (valences.length === 0) {
      return {
        startValence: 0,
        endValence: 0,
        minValence: 0,
        maxValence: 0,
        avgValence: 0,
        trend: 'stable',
        volatility: 0,
      }
    }

    const start = valences[0]
    const end = valences[valences.length - 1]
    const avg = valences.reduce((s, v) => s + v, 0) / valences.length
    const minV = Math.min(...valences)
    const maxV = Math.max(...valences)

    let trend: 'improving' | 'declining' | 'stable' = 'stable'
    if (valences.length >= 3) {
      const mid = Math.floor(valences.length / 2)
      const firstHalf = valences.slice(0, mid).reduce((s, v) => s + v, 0) / mid
      const secondHalf =
        valences.slice(mid).reduce((s, v) => s + v, 0) / (valences.length - mid)
      if (secondHalf > firstHalf + 0.1) trend = 'improving'
      else if (secondHalf < firstHalf - 0.1) trend = 'declining'
    }

    const volatility = Math.sqrt(
      valences.reduce((s, v) => s + (v - avg) ** 2, 0) / valences.length,
    )

    return {
      startValence: Math.round(start * 1000) / 1000,
      endValence: Math.round(end * 1000) / 1000,
      minValence: Math.round(minV * 1000) / 1000,
      maxValence: Math.round(maxV * 1000) / 1000,
      avgValence: Math.round(avg * 1000) / 1000,
      trend,
      volatility: Math.round(volatility * 1000) / 1000,
    }
  }

  private identifyUnresolved(memories: MemoryBlock[]): string[] {
    const crisisMemories = memories.filter((m) => m.gating.crisisFlag)
    const highArousal = memories.filter((m) => m.emotions.arousal > 0.7)
    const maxTimestamp = Math.max(...memories.map((m) => m.timestamp))
    const negativeEnd = memories.filter(
      (m) => m.emotions.valence < -0.3 && m.timestamp === maxTimestamp,
    )

    const unresolved: string[] = []
    if (crisisMemories.length > 0)
      unresolved.push('crisis_content_requires_followup')

    if (highArousal.length > 0) {
      const topics = new Set(
        highArousal.flatMap((m) =>
          m.emotions.categories.length > 0
            ? m.emotions.categories
            : ['high_arousal'],
        ),
      )
      for (const t of topics) unresolved.push(`high_arousal:${t}`)
    }

    if (negativeEnd.length > 0) {
      const topics = new Set(
        negativeEnd.flatMap((m) =>
          m.emotions.categories.length > 0
            ? m.emotions.categories
            : ['negative_ending'],
        ),
      )
      for (const t of topics) unresolved.push(`unresolved:${t}`)
    }

    return [...new Set(unresolved)]
  }

  private static defaultSummarizer(
    this: void,
    memories: MemoryBlock[],
    themes: string[],
    arc: EmotionalArc,
  ): string {
    const topThemes = themes.slice(0, 3).join(', ') || 'no clear themes'
    return `Session with ${memories.length} memories. Key themes: ${topThemes}. Emotional arc: ${arc.trend} (valence ${arc.startValence} → ${arc.endValence}). Volatility: ${arc.volatility.toFixed(2)}.`
  }
}
