import type {
  IMentalHealthTaskRouter,
  RoutingInput,
  RoutingDecision,
  LLMInvoker,
} from '../types/mentalLLaMATypes'

export interface RoutingContext {
  userId?: string
  sessionId?: string
  sessionType?: string
  explicitTaskHint?: string
  previousConversationState?: unknown
  failureInfo?: unknown
}

const CRISIS_KEYWORDS = [
  'suicide',
  'kill myself',
  'end it all',
  'want to die',
  'hurt myself',
  'self harm',
  'cutting',
  'overdose',
  'jump off',
  'hanging',
]

const DEPRESSION_KEYWORDS = [
  'depressed',
  'hopeless',
  'worthless',
  'empty',
  'sad all the time',
  'no energy',
  'sleep all day',
  'nothing matters',
]

const ANXIETY_KEYWORDS = [
  'panic',
  'anxious',
  'worried',
  'scared',
  'racing heart',
  "can't breathe",
  'overwhelming',
  'nervous',
]

export class MentalHealthTaskRouter implements IMentalHealthTaskRouter {
  constructor(private llmInvoker: LLMInvoker): void {}

  async route(input: RoutingInput): Promise<RoutingDecision> {
    const text = input.text.toLowerCase()

    // Check for explicit hint first
    if (input.context?.explicitTaskHint) {
      return this.routeByHint(input.context.explicitTaskHint)
    }

    // Crisis detection (highest priority)
    if (this.containsKeywords(text, CRISIS_KEYWORDS)) {
      return {
        targetAnalyzer: 'crisis',
        confidence: 0.9,
        isCritical: true,
        method: 'keyword',
        insights: {
          matchedKeywords: this.getMatchedKeywords(text, CRISIS_KEYWORDS),
          reason: 'Crisis keywords detected',
        },
      }
    }

    // Depression detection
    if (this.containsKeywords(text, DEPRESSION_KEYWORDS)) {
      return {
        targetAnalyzer: 'depression',
        confidence: 0.7,
        isCritical: false,
        method: 'keyword',
        insights: {
          matchedKeywords: this.getMatchedKeywords(text, DEPRESSION_KEYWORDS),
          reason: 'Depression keywords detected',
        },
      }
    }

    // Anxiety detection
    if (this.containsKeywords(text, ANXIETY_KEYWORDS)) {
      return {
        targetAnalyzer: 'anxiety',
        confidence: 0.7,
        isCritical: false,
        method: 'keyword',
        insights: {
          matchedKeywords: this.getMatchedKeywords(text, ANXIETY_KEYWORDS),
          reason: 'Anxiety keywords detected',
        },
      }
    }

    // LLM fallback for ambiguous cases
    try {
      const llmResult = await this.llmInvoker([
        {
          role: 'system',
          content:
            'Classify this mental health text into: crisis, depression, anxiety, or general. Respond with just the category.',
        },
        { role: 'user', content: input.text },
      ])

      const category = llmResult.content.toLowerCase().trim()
      if (['crisis', 'depression', 'anxiety'].includes(category)) {
        return {
          targetAnalyzer: category,
          confidence: 0.6,
          isCritical: category === 'crisis',
          method: 'llm',
          insights: { llmReasoning: llmResult.content },
        }
      }
    } catch {
      // LLM failed, continue to default
    }

    return {
      targetAnalyzer: 'general_mental_health',
      confidence: 0.3,
      isCritical: false,
      method: 'default',
      insights: { reason: 'No keywords matched, LLM unavailable' },
    }
  }

  private routeByHint(hint: string): RoutingDecision {
    const hintLower = hint.toLowerCase()
    if (hintLower.includes('crisis') || hintLower.includes('suicide')) {
      return {
        targetAnalyzer: 'crisis',
        confidence: 0.95,
        isCritical: true,
        method: 'explicit_hint',
        insights: { hintUsed: hint },
      }
    }
    if (hintLower.includes('depression')) {
      return {
        targetAnalyzer: 'depression',
        confidence: 0.8,
        isCritical: false,
        method: 'explicit_hint',
        insights: { hintUsed: hint },
      }
    }
    if (hintLower.includes('anxiety')) {
      return {
        targetAnalyzer: 'anxiety',
        confidence: 0.8,
        isCritical: false,
        method: 'explicit_hint',
        insights: { hintUsed: hint },
      }
    }
    return {
      targetAnalyzer: 'general_mental_health',
      confidence: 0.5,
      isCritical: false,
      method: 'explicit_hint',
      insights: { hintUsed: hint },
    }
  }

  private containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword))
  }

  private getMatchedKeywords(text: string, keywords: string[]): string[] {
    return keywords.filter((keyword) => text.includes(keyword))
  }

  getAvailableAnalyzers(): string[] {
    return [
      'crisis',
      'depression',
      'anxiety',
      'general_mental_health',
      'unknown',
    ]
  }

  updateRoutingRules(_rules: Record<string, unknown>): void {
    // Implementation for updating routing rules
  }
}
