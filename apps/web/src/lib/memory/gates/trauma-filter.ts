/**
 * PIX-511: Trauma Filter — TypeScript mirror of ai/memory/gates/trauma_filter.py
 */

export type TraumaSeverity = 'high' | 'medium' | 'low' | 'none'

export interface TraumaFilterResult {
  triggered: boolean
  indicators: string[]
  confidence: number
  contentWarning: string | null
  userSpecificMatches: string[]
  severity: TraumaSeverity
}

export interface TraumaGateResult {
  gate: string
  decision: 'pass' | 'block' | 'escalate'
  reason: string
  confidence: number
}

const TRAUMA_LEXICON: Record<string, string[]> = {
  abuse: ['abuse', 'abused', 'abuser', 'molestation', 'assault', 'violence'],
  neglect: ['neglect', 'neglected', 'abandoned', 'ignored', 'left alone'],
  trauma: ['trauma', 'traumatic', 'ptsd', 'flashback', 'dissociat'],
  grief: ['grief', 'mourning', 'loss', 'death', 'funeral', 'bereavement'],
  sexual: ['sexual abuse', 'rape', 'molested', 'inappropriate touch'],
  medical: ['medical trauma', 'hospital', 'surgery', 'diagnosis', 'cancer'],
}

const CONTENT_WARNING = 'Content may contain trauma-related material'
const GATE_NAME = 'gate2_trauma'
const SEVERITY_WEIGHTS: Record<TraumaSeverity, number> = {
  none: 0,
  low: 0.6,
  medium: 0.8,
  high: 1,
}

export class TraumaFilter {
  private readonly _patterns: Map<string, RegExp[]>
  private readonly _userTriggers: Map<string, Set<string>> = new Map()

  constructor() {
    this._patterns = new Map(
      Object.entries(TRAUMA_LEXICON).map(([category, terms]) => [
        category,
        terms.map((term) => this.compileTerm(term)),
      ]),
    )
  }

  registerUserTriggers(userId: string, triggers: string[]): void {
    if (!userId) return

    const normalized = triggers
      .map((trigger) => trigger.trim().toLocaleLowerCase())
      .filter((trigger) => trigger.length > 0)

    if (normalized.length === 0) return

    const existingTriggers = this._userTriggers.get(userId) ?? new Set<string>()
    for (const trigger of normalized) {
      existingTriggers.add(trigger)
    }
    this._userTriggers.set(userId, existingTriggers)
  }

  filter(content: string, userId?: string): TraumaFilterResult {
    const matchedCategories = new Set<string>()
    const indicators: string[] = []

    for (const [category, patterns] of this._patterns.entries()) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          matchedCategories.add(category)
          indicators.push(category)
          break
        }
      }
    }

    const userSpecificMatches = this.matchUserTriggers(content, userId)
    const severity = this.severityForCategories(matchedCategories.size)
    const confidence = this.confidence(matchedCategories.size, severity)
    const result: TraumaFilterResult = {
      triggered: matchedCategories.size > 0 || userSpecificMatches.length > 0,
      indicators: [...new Set(indicators)].sort(),
      confidence,
      contentWarning: null,
      userSpecificMatches,
      severity,
    }

    result.contentWarning = this.getContentWarning(result)
    return result
  }

  evaluate(content: string, userId?: string): TraumaGateResult {
    const result = this.filter(content, userId)

    if (result.severity === 'high') {
      return {
        gate: GATE_NAME,
        decision: 'escalate',
        reason: 'Multiple trauma indicators detected',
        confidence: result.confidence,
      }
    }

    if (result.severity === 'medium') {
      return {
        gate: GATE_NAME,
        decision: 'pass',
        reason: 'Trauma content flagged with content warning',
        confidence: result.confidence,
      }
    }

    return {
      gate: GATE_NAME,
      decision: 'pass',
      reason: 'No significant trauma indicators detected',
      confidence: result.confidence,
    }
  }

  getContentWarning(result: TraumaFilterResult): string | null {
    return result.severity === 'medium' || result.severity === 'high'
      ? CONTENT_WARNING
      : null
  }

  private compileTerm(term: string): RegExp {
    const escaped = this.escapeRegExp(term.trim()).replace(/\\ /g, '\\s+')
    const suffix = term === 'dissociat' ? '\\w*' : ''
    return new RegExp(`\\b${escaped}${suffix}\\b`, 'i')
  }

  private matchUserTriggers(content: string, userId?: string): string[] {
    if (userId === undefined) return []

    const triggers = this._userTriggers.get(userId)
    if (!triggers || triggers.size === 0) return []

    const contentTokens = this.tokens(content)
    const matches = [...triggers].filter(
      (trigger) =>
        this.compileTerm(trigger).test(content) ||
        this.semanticMatch(trigger, contentTokens),
    )

    return matches.sort()
  }

  private semanticMatch(trigger: string, contentTokens: Set<string>): boolean {
    const triggerTokens = this.tokens(trigger)
    if (triggerTokens.size === 0) return false

    const overlap = [...triggerTokens].filter((token) =>
      contentTokens.has(token),
    )
    return overlap.length / triggerTokens.size >= 0.75
  }

  private tokens(value: string): Set<string> {
    return new Set(value.toLocaleLowerCase().match(/\b\w+\b/g) ?? [])
  }

  private severityForCategories(matchedCount: number): TraumaSeverity {
    if (matchedCount >= 3) return 'high'
    if (matchedCount === 2) return 'medium'
    if (matchedCount === 1) return 'low'
    return 'none'
  }

  private confidence(matchedCount: number, severity: TraumaSeverity): number {
    const categoryRatio = matchedCount / Object.keys(TRAUMA_LEXICON).length
    return Math.min(1, categoryRatio * SEVERITY_WEIGHTS[severity])
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

export const traumaFilter = new TraumaFilter()
