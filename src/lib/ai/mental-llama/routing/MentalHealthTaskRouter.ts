import type {
  IMentalHealthTaskRouter,
  RoutingInput,
  RoutingDecision,
  LLMInvoker,
  RoutingContext,
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
  constructor(private llmInvoker: LLMInvoker) {}

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

    // LLM-based classification for ambiguous cases: try a structured classification call
    try {
      const llmDecision = await this.performBroadClassificationLLM(
        text,
        input.context,
      )
      // If LLM returned a meaningful decision, use it
      if (llmDecision && llmDecision.targetAnalyzer) {
        return llmDecision
      }
    } catch {
      // LLM failed - fall back to default below
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

  // Map commonly returned LLM categories to internal analyzer names
  private mapLlmCategoryToAnalyzer(category: string): string {
    const normalized = category.trim().toLowerCase()
    const map: Record<string, string> = {
      'suicidal': 'crisis',
      'self-harm': 'crisis',
      'suicide': 'crisis',
      'crisis': 'crisis',
      'depression': 'depression',
      'depressive': 'depression',
      'anxiety': 'anxiety',
      'panic': 'anxiety',
      'worry': 'anxiety',
      'general': 'general_mental_health',
      'general_mental_health': 'general_mental_health',
      'unknown': 'unknown',
      'none': 'none',
    }
    return map[normalized] ?? 'general_mental_health'
  }

  // Try to extract JSON payload from LLM response (handles fenced code blocks too)
  private extractJsonLike(content: string): string | null {
    if (!content) return null
    // Strip markdown code fences
    const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/im)
    if (fencedMatch && fencedMatch[1]) {
      return fencedMatch[1].trim()
    }
    // Sometimes models respond with a JSON-like line or object
    const jsonStart = content.indexOf('{')
    const jsonEnd = content.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      return content.slice(jsonStart, jsonEnd + 1)
    }
    return null
  }

  // Perform a structured LLM classification call and return a RoutingDecision when possible
  private async performBroadClassificationLLM(
    text: string,
    context?: RoutingContext,
  ): Promise<RoutingDecision | null> {
    const system =
      `You are a classification assistant. Classify the user's text into one of: crisis, depression, anxiety, general, none, unknown. Respond with a JSON object: { "category": "<one of the categories>", "confidence": 0.0, "is_critical": false, "reason": "explain briefly" }`.trim()
    const user = `Text: ${text}\nContext: ${context ? JSON.stringify(context) : '{}'}\nRespond only with the JSON object described.`

    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]

    const resp = await this.llmInvoker(messages, {
      temperature: 0.0,
      max_tokens: 300,
    })
    const raw = resp.content || ''
    const jsonLike = this.extractJsonLike(raw)
    if (!jsonLike) {
      // Unable to find JSON in response; as a last resort, try to use the plain text
      const plain = raw.trim().toLowerCase()
      const mapped = this.mapLlmCategoryToAnalyzer(
        plain.split(/\s|\.|,|\n/)[0] || 'general',
      )
      return {
        targetAnalyzer: mapped,
        confidence: 0.5,
        isCritical: mapped === 'crisis',
        method: 'llm',
        insights: { llmReasoning: raw },
      }
    }

    try {
      const parsed = JSON.parse(jsonLike) as {
        category?: string
        confidence?: number
        is_critical?: boolean
        reason?: string
      }
      const category = parsed.category ?? 'general'
      const mapped = this.mapLlmCategoryToAnalyzer(String(category))
      const confidence = Math.max(
        0,
        Math.min(1, Number(parsed.confidence) || 0.5),
      )
      const isCritical = parsed.is_critical === true || mapped === 'crisis'
      return {
        targetAnalyzer: mapped,
        confidence,
        isCritical,
        method: 'llm',
        insights: {
          llmReasoning: parsed.reason || raw,
          llmCategory: parsed.category,
        },
      }
    } catch (err) {
      // Parsing failed - return a conservative fallback decision
      return {
        targetAnalyzer: 'general_mental_health',
        confidence: 0.4,
        isCritical: false,
        method: 'llm',
        insights: { llmReasoning: raw, fallbackReason: 'parsing_failed' },
      }
    }
  }
}
