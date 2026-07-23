/**
 * ExplainabilityService
 *
 * Wraps AI responses with confidence normalization and source attribution.
 * Enriches EmotionAnalysis and TherapeuticResponse payloads with:
 * - Normalized confidence (0-1)
 * - Sources array documenting where each result component originated
 * - Technique attribution linking to therapeutic framework
 */

import type {
  ExplainabilitySource,
  ExplainabilityContext,
  TechniqueAttribution,
  ExplainabilitySourceType,
} from './types'

const TECHNIQUE_MAP: Record<string, string[]> = {
  joy: ['VALIDATION', 'STRENGTH_BASED'],
  sadness: ['ACTIVE_LISTENING', 'VALIDATION'],
  anger: ['COGNITIVE_RESTRUCTURING', 'GROUNDING_TECHNIQUES'],
  fear: ['GROUNDING_TECHNIQUES', 'MINDFULNESS'],
  surprise: ['OPEN_ENDED_QUESTIONS'],
  disgust: ['COGNITIVE_RESTRUCTURING', 'REFRAMING'],
  trust: ['REFLECTIVE_STATEMENTS', 'ACTIVE_LISTENING'],
  anticipation: ['GOAL_SETTING', 'MOTIVATIONAL_INTERVIEWING'],
}

export class ExplainabilityService {
  private static instance: ExplainabilityService | null = null

  static getInstance(): ExplainabilityService {
    if (ExplainabilityService.instance === null) {
      ExplainabilityService.instance = new ExplainabilityService()
    }
    return ExplainabilityService.instance
  }

  static reset(): void {
    ExplainabilityService.instance = null
  }

  /**
   * Normalize confidence to 0-1 range
   */
  normalizeConfidence(raw: number): number {
    if (typeof raw !== 'number' || isNaN(raw)) return 0
    return Math.max(0, Math.min(1, raw))
  }

  /**
   * Build sources array for an emotion analysis result
   */
  buildSources(context: ExplainabilityContext): ExplainabilitySource[] {
    const sources: ExplainabilitySource[] = []
    const timestamp = new Date().toISOString()

    if (context.neutralBaseline) {
      sources.push({
        type: 'neutral-baseline' as ExplainabilitySourceType,
        reference: 'empty-input',
        confidenceContribution: 1.0,
        description:
          'Neutral baseline returned for empty or whitespace-only input',
        timestamp,
      })
      return sources
    }

    if (context.fallbackUsed) {
      sources.push({
        type: 'keyword-fallback' as ExplainabilitySourceType,
        reference: 'detectEmotionsLocally',
        confidenceContribution: 0.6,
        description:
          'Local keyword-based emotion detection used as fallback when LLM API was unavailable',
        timestamp,
      })
    } else {
      sources.push({
        type: 'llm' as ExplainabilitySourceType,
        reference: context.modelVersion,
        confidenceContribution: 0.85,
        description: `LLM analysis via ${context.provider} (${context.modelVersion})`,
        timestamp,
      })
      sources.push({
        type: 'fhe' as ExplainabilitySourceType,
        reference: 'encrypt/decrypt',
        confidenceContribution: 0.95,
        description:
          'Input encrypted via FHE (BFV scheme) before LLM inference; result decrypted locally',
        timestamp,
      })
    }

    sources.push({
      type: 'dimensional-model' as ExplainabilitySourceType,
      reference: 'russell-circumplex',
      confidenceContribution: 0.8,
      description:
        'Valence/arousal/dominance dimensions computed via Russell Circumplex Model mapping',
      timestamp,
    })

    if (context.perEmotionConfidence) {
      sources.push({
        type: 'metadata' as ExplainabilitySourceType,
        reference: 'per-emotion-confidence',
        confidenceContribution: this.averagePerEmotionConfidence(
          context.perEmotionConfidence,
        ),
        description: 'Per-emotion confidence scores from classifier output',
        timestamp,
      })
    }

    return sources
  }

  /**
   * Determine technique attribution from dominant emotions
   */
  attributeTechnique(
    emotions: Record<string, number>,
  ): TechniqueAttribution | undefined {
    const entries = Object.entries(emotions).filter(
      ([, v]) => typeof v === 'number' && v > 0,
    )
    if (entries.length === 0) return undefined

    entries.sort((a, b) => b[1] - a[1])
    const dominantEmotion = entries[0][0]
    const techniques = TECHNIQUE_MAP[dominantEmotion] ?? ['ACTIVE_LISTENING']

    const primary = techniques[0]
    const confidence = Math.min(0.5 + entries[0][1] * 0.4, 0.95)

    const reasoning: string[] = [
      `Dominant emotion: ${dominantEmotion} (intensity ${entries[0][1].toFixed(2)})`,
      `Mapped to therapeutic technique: ${primary}`,
    ]

    if (entries.length > 1) {
      reasoning.push(
        `Secondary emotions: ${entries
          .slice(1, 3)
          .map(([k, v]) => `${k}(${v.toFixed(2)})`)
          .join(', ')}`,
      )
    }

    const alternatives =
      techniques.length > 1
        ? techniques.slice(1).map((t) => ({
            technique: t,
            confidence: Math.max(confidence - 0.15, 0.3),
          }))
        : undefined

    return {
      technique: primary,
      confidence,
      reasoning,
      alternatives,
    }
  }

  /**
   * Enrich an arbitrary payload with explainability fields
   */
  enrich<T extends Record<string, unknown>>(
    payload: T,
    context: ExplainabilityContext,
    emotions?: Record<string, number>,
  ): T & {
    confidence: number
    sources: ExplainabilitySource[]
    techniqueAttribution?: TechniqueAttribution
  } {
    const sources = this.buildSources(context)
    const techniqueAttribution = emotions
      ? this.attributeTechnique(emotions)
      : undefined

    return {
      ...payload,
      confidence: this.normalizeConfidence(payload.confidence as number),
      sources,
      ...(techniqueAttribution ? { techniqueAttribution } : {}),
    }
  }

  private averagePerEmotionConfidence(
    confidences: Record<string, number>,
  ): number {
    const values = Object.values(confidences)
    if (values.length === 0) return 0
    const sum = values.reduce((a, b) => a + b, 0)
    return sum / values.length
  }
}

export function getExplainabilityService(): ExplainabilityService {
  return ExplainabilityService.getInstance()
}

export function resetExplainabilityService(): void {
  ExplainabilityService.reset()
}
