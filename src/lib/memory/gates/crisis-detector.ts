/**
 * PIX-511: Crisis Detector — TypeScript mirror of ai/memory/gates/crisis_detector.py
 */

export type CrisisTier = 'critical' | 'high' | 'moderate' | 'none'

export interface CrisisDetectionResult {
  tier: CrisisTier
  score: number
  crisisType: string
  matches: string[]
  confidence: number
  crisisFlag: boolean
  evidenceSpans: string[]
  requiresPreservation: boolean
  recommendations: string[]
}

export interface CrisisGateResult {
  gate: string
  decision: 'pass' | 'block' | 'escalate'
  reason: string
  confidence: number
}

const CRITICAL_KEYWORDS = [
  'suicide',
  'kill myself',
  'hurt myself',
  'end it all',
  'want to die',
  'no reason to live',
] as const

const HIGH_KEYWORDS = [
  'hopeless',
  'worthless',
  "can't continue",
  'cut',
  'self-harm',
] as const

const MODERATE_KEYWORDS = [
  'anxious',
  'down',
  'struggling',
  'panic',
  'overwhelmed',
] as const

const KEYWORD_SCORES: Record<Exclude<CrisisTier, 'none'>, number> = {
  critical: 0.8,
  high: 0.5,
  moderate: 0.25,
}

const NEGATION_PATTERN = /\b(no|not|never|denies|denied|without|r\/o)\b/i
const TEMPORAL_PATTERN =
  /\b(used to|previously|in the past|used to be|was feeling|had been)\b/i
const CONTEXT_WINDOW_SIZE = 48

type KeywordTier = Exclude<CrisisTier, 'none'>

interface KeywordMatch {
  tier: KeywordTier
  text: string
  index: number
}

const KEYWORD_PATTERNS: Record<KeywordTier, RegExp[]> = {
  critical: CRITICAL_KEYWORDS.map(keywordPattern),
  high: HIGH_KEYWORDS.map(keywordPattern),
  moderate: MODERATE_KEYWORDS.map(keywordPattern),
}

export class CrisisDetector {
  detect(content: string): CrisisDetectionResult {
    const keywordMatches = this.extractKeywordMatches(content)
    const evidenceSpans = this.uniqueEvidenceSpans(keywordMatches)
    const keywordTier = this.strongestTier(keywordMatches)
    const baseScore = keywordTier === 'none' ? 0 : KEYWORD_SCORES[keywordTier]
    const negated = this.hasNegatedEvidence(content, keywordMatches)
    const historical = this.hasTemporalContext(content, keywordMatches)
    const confidence = roundScore(
      baseScore * (negated ? 0.3 : 1) * (historical ? 0.5 : 1),
    )
    const tier = this.tierForScore(confidence)
    const crisisFlag = tier !== 'none'

    return {
      tier,
      score: confidence,
      crisisType: this.crisisType(keywordTier, evidenceSpans),
      matches: evidenceSpans,
      confidence,
      crisisFlag,
      evidenceSpans,
      requiresPreservation: crisisFlag,
      recommendations: this.recommendations(tier, negated, historical),
    }
  }

  evaluate(content: string): CrisisGateResult {
    const result = this.detect(content)

    if (result.tier === 'critical') {
      return {
        gate: 'gate1_crisis',
        decision: 'block',
        reason: 'Immediate crisis intervention required',
        confidence: result.confidence,
      }
    }

    if (result.tier === 'high') {
      return {
        gate: 'gate1_crisis',
        decision: 'escalate',
        reason: 'Clinical review required for high-risk content',
        confidence: result.confidence,
      }
    }

    if (result.tier === 'moderate') {
      return {
        gate: 'gate1_crisis',
        decision: 'pass',
        reason: 'Moderate risk flagged for monitoring',
        confidence: result.confidence,
      }
    }

    return {
      gate: 'gate1_crisis',
      decision: 'pass',
      reason: 'No crisis indicators detected',
      confidence: result.confidence,
    }
  }

  private extractKeywordMatches(content: string): KeywordMatch[] {
    const matches: KeywordMatch[] = []

    for (const tier of ['critical', 'high', 'moderate'] as const) {
      for (const pattern of KEYWORD_PATTERNS[tier]) {
        pattern.lastIndex = 0
        for (const match of content.matchAll(pattern)) {
          matches.push({
            tier,
            text: match[0],
            index: match.index ?? 0,
          })
        }
      }
    }

    return matches
  }

  private uniqueEvidenceSpans(matches: KeywordMatch[]): string[] {
    return [...new Set(matches.map((match) => match.text))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    )
  }

  private strongestTier(matches: KeywordMatch[]): CrisisTier {
    if (matches.some((match) => match.tier === 'critical')) return 'critical'
    if (matches.some((match) => match.tier === 'high')) return 'high'
    if (matches.some((match) => match.tier === 'moderate')) return 'moderate'
    return 'none'
  }

  private hasNegatedEvidence(
    content: string,
    matches: KeywordMatch[],
  ): boolean {
    if (matches.length === 0) return false

    return matches.every((match) =>
      this.matchHasExternalContext(content, match, NEGATION_PATTERN),
    )
  }

  private hasTemporalContext(
    content: string,
    matches: KeywordMatch[],
  ): boolean {
    if (matches.length === 0) return TEMPORAL_PATTERN.test(content)

    return matches.some((match) =>
      this.matchHasExternalContext(content, match, TEMPORAL_PATTERN),
    )
  }

  private matchHasExternalContext(
    content: string,
    match: KeywordMatch,
    pattern: RegExp,
  ): boolean {
    const start = Math.max(0, match.index - CONTEXT_WINDOW_SIZE)
    const end = Math.min(
      content.length,
      match.index + match.text.length + CONTEXT_WINDOW_SIZE,
    )
    const before = content.slice(start, match.index)
    const after = content.slice(match.index + match.text.length, end)

    return pattern.test(before) || pattern.test(after)
  }

  private tierForScore(score: number): CrisisTier {
    if (score >= 0.8) return 'critical'
    if (score >= 0.5) return 'high'
    if (score >= 0.25) return 'moderate'
    return 'none'
  }

  private crisisType(keywordTier: CrisisTier, evidenceSpans: string[]): string {
    if (keywordTier === 'none' || evidenceSpans.length === 0) return 'none'
    return `${keywordTier}_risk`
  }

  private recommendations(
    tier: CrisisTier,
    negated: boolean,
    historical: boolean,
  ): string[] {
    const recommendations = new Set<string>()

    if (tier === 'critical') {
      recommendations.add(
        'Block deletion and initiate immediate crisis workflow',
      )
    } else if (tier === 'high') {
      recommendations.add('Preserve content and escalate for clinical review')
    } else if (tier === 'moderate') {
      recommendations.add('Flag for monitoring while allowing ingestion')
    }

    if (negated) {
      recommendations.add('Crisis language appears negated; reduced confidence')
    }

    if (historical) {
      recommendations.add(
        'Crisis language appears historical; reduced confidence',
      )
    }

    return [...recommendations].sort()
  }
}

function keywordPattern(keyword: string): RegExp {
  const escaped = escapeRegExp(keyword).replace(/\\-/g, '[-\\s]?')
  return new RegExp(`\\b${escaped}\\b`, 'gi')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function roundScore(value: number): number {
  return Math.round(value * 10000) / 10000
}

export const crisisDetector = new CrisisDetector()
