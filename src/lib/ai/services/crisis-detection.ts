import type { AIService } from '../models/ai-types'
import type {
  CrisisDetectionResult,
  CrisisDetectionOptions,
  RiskAssessment,
} from '../crisis/types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import {
  SUICIDE_EUPHEMISMS as CONFIG_SUICIDE_EUPHEMISMS,
  SAFE_IDIOMATIC_EXCLUSIONS as CONFIG_SAFE_EXCLUSIONS,
} from '../crisis/config/keywords'

const appLogger = createBuildSafeLogger('app')

export interface CrisisDetectionConfig {
  aiService: AIService
  sensitivityLevel: 'low' | 'medium' | 'high'
  model?: string
  defaultPrompt?: string
}

export class CrisisDetectionService {
  private aiService: AIService
  private sensitivityLevel: 'low' | 'medium' | 'high'
  private model?: string
  private defaultPrompt?: string

  // Crisis detection keywords by category
  private static readonly CRISIS_KEYWORDS = {
    self_harm: [
      'self-harm',
      'hurt myself',
      'cutting',
      'self-injury',
      'self-mutilation',
      'harming myself',
      'want to hurt myself',
    ],
    // Common euphemisms and variants that indicate suicide risk in real usage
    // Added to improve recall across cultural/online phrasing patterns
    suicide: [
      'suicide',
      'kill myself',
      'end my life',
      'want to die',
      'suicidal',
      'not worth living',
      'better off dead',
      'suicide plan',
      'take my own life',
      'ending it all',
      "can't take it anymore",
      "can't take it",
      'ending it',
      'end it all',
      // Config-driven euphemisms appended below
      ...CONFIG_SUICIDE_EUPHEMISMS,
    ],
    emergency: [
      'immediate danger',
      'going to hurt',
      'right now',
      'tonight',
      'overdose',
      'pills',
      'weapon',
      'bridge',
      'plan to',
    ],
    severe_depression: [
      'hopeless',
      'worthless',
      'no point',
      'give up',
      "can't go on",
      'unbearable pain',
      'too much pain',
      "can't take it",
    ],
    moderate_concern: [
      'depressed',
      'anxious',
      'panic',
      'overwhelmed',
      'struggling',
      'difficult time',
      'very sad',
      "can't cope",
    ],
  }

  // Exclusions to reduce false positives from idioms/cultural phrases
  // that contain crisis-related keywords but are non-crisis contexts.
  private static readonly SAFE_IDIOMATIC_EXCLUSIONS: RegExp[] = [
    // Built-ins
    /\bkill(?:ed|ing)?\s+it\b/i,
    /\b(dying|die|died)\s+to\b/i,
    /\bdie of (?:laughter|laughing|boredom)\b/i,
    /\bsuicide\s+squad\b/i,
    /\b(homework|traffic|commute|deadline|exam|emoji)\s+is\s+killing\s+me\b/i,
    /\b(?:reading|studying|learning|talking)\s+about\s+suicide\b/i,
    /\b(?:watch(?:ing)?|saw)\s+(?:a\s+)?(?:movie|film|article)\s+about\s+suicide\b/i,
    // Config-appended
    ...CONFIG_SAFE_EXCLUSIONS,
  ]

  private static readonly SENSITIVITY_THRESHOLDS = {
    low: { crisis: 0.8, concern: 0.6 },
    medium: { crisis: 0.6, concern: 0.4 },
    high: { crisis: 0.4, concern: 0.2 },
  }

  constructor(config: CrisisDetectionConfig) {
    this.aiService = config.aiService
    this.sensitivityLevel = config.sensitivityLevel
    this.model = config.model
    this.defaultPrompt = config.defaultPrompt
  }

  async detectCrisis(
    text: string,
    _options: CrisisDetectionOptions,
  ): Promise<CrisisDetectionResult> {
    try {
      // Perform keyword-based analysis first (fast check)
      const keywordAnalysis = this.analyzeKeywords(text)

      // If high-risk keywords found, proceed with AI analysis
      let aiAnalysis: RiskAssessment | null = null
      if (keywordAnalysis.score >= 0.3) {
        try {
          aiAnalysis = await this.performAIAnalysis(text)
        } catch (error: unknown) {
          // Log AI analysis failure but continue with keyword analysis
          appLogger.warn('AI analysis failed, using keyword analysis only', {
            error,
          })
        }
      }

      // Combine results
      const finalScore = Math.max(keywordAnalysis.score, aiAnalysis?.score || 0)

      const thresholds =
        CrisisDetectionService.SENSITIVITY_THRESHOLDS[this.sensitivityLevel]
      const isCrisis = finalScore >= thresholds.crisis

      return {
        isCrisis,
        confidence: finalScore,
        category: this.determineCrisisCategory(
          keywordAnalysis.indicators,
          aiAnalysis?.category,
        ),
        content: text,
        riskLevel: this.determineRiskLevel(finalScore),
        urgency: this.determineUrgency(finalScore, keywordAnalysis.indicators),
        detectedTerms: keywordAnalysis.indicators,
        suggestedActions: this.generateSuggestedActions(finalScore),
        timestamp: new Date().toISOString(),
      }
    } catch (error: unknown) {
      appLogger.error('Error in crisis detection:', {
        message: error instanceof Error ? String(error) : String(error),
        stack: error instanceof Error ? (error as Error)?.stack : '',
        error,
      })

      // Return a safe fallback result instead of throwing
      return {
        isCrisis: false,
        confidence: 0,
        category: 'analysis_error',
        content: text,
        riskLevel: 'unknown',
        urgency: 'low',
        detectedTerms: [],
        suggestedActions: ['Manual review recommended due to analysis error'],
        timestamp: new Date().toISOString(),
      }
    }
  }

  async detectBatch(
    texts: string[],
    options: CrisisDetectionOptions,
  ): Promise<CrisisDetectionResult[]> {
    try {
      return await Promise.all(
        texts.map((text) => this.detectCrisis(text, options)),
      )
    } catch (error: unknown) {
      appLogger.error('Error in batch crisis detection:', {
        message: error instanceof Error ? String(error) : String(error),
        stack: error instanceof Error ? (error as Error)?.stack : '',
        error,
      })
      throw new Error('Batch crisis detection failed', { cause: error })
    }
  }

  private analyzeKeywords(text: string): {
    score: number
    indicators: string[]
  } {
    const lowerText = text.toLowerCase()
    const indicators: string[] = []
    let _score = 0
    let maxCategoryScore = 0

    // Check each category with different weights
    for (const [category, keywords] of Object.entries(
      CrisisDetectionService.CRISIS_KEYWORDS,
    )) {
      const categoryWeight = this.getCategoryWeight(category)
      let categoryMatches = 0

      for (const keyword of keywords) {
        // Handle phrases with spaces differently than single words
        const keywordLower = keyword.toLowerCase()
        let matches = false

        if (keywordLower.includes(' ')) {
          // For phrases, use simple includes check
          matches = lowerText.includes(keywordLower)
        } else {
          // For single words, use word boundaries
          const regex = new RegExp(
            `\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            'i',
          )
          matches = regex.test(lowerText)
        }

        if (matches) {
          // Apply idiom/cultural exclusions to prevent false positives
          const excluded = CrisisDetectionService.SAFE_IDIOMATIC_EXCLUSIONS.some(
            (re) => re.test(text),
          )

          if (!excluded) {
            indicators.push(keyword)
            categoryMatches++
          }
        }
      }

      if (categoryMatches > 0) {
        // Calculate category score based on matches and weight
        const categoryScore = Math.min(
          categoryMatches * categoryWeight * 0.8,
          categoryWeight,
        )
        _score += categoryScore
        maxCategoryScore = Math.max(maxCategoryScore, categoryScore)
      }
    }

    // Use the maximum category score as the final score (less conservative)
    const finalScore = Math.min(maxCategoryScore, 1.0)

    return {
      score: finalScore,
      indicators: [...new Set(indicators)], // Remove duplicates
    }
  }

  private getCategoryWeight(category: string): number {
    const weights = {
      emergency: 1.0,
      suicide: 0.9,
      self_harm: 0.8,
      severe_depression: 0.6,
      moderate_concern: 0.4,
    }
    return weights[category as keyof typeof weights] || 0.2
  }

  private async performAIAnalysis(
    text: string,
  ): Promise<RiskAssessment | null> {
    const prompt = `
        Analyze the following text for mental health crisis indicators.
        Respond with a JSON object containing:
        - score: risk score from 0.0 to 1.0
        - category: primary concern category
        - severity: low, medium, high, or critical
        - indicators: array of specific concerning phrases
        - recommendations: array of suggested actions

        Text to analyze: "${text}"
      `

    try {
      // Check if aiService exists and has the required method
      if (
        !this.aiService ||
        typeof this.aiService.createChatCompletion !== 'function'
      ) {
        appLogger.warn(
          'AI service not available, falling back to keyword analysis only',
        )
        return null
      }

      const response = await this.aiService.createChatCompletion(
        [
          {
            role: 'system',
            content:
              'You are a mental health crisis detection AI. Provide accurate, helpful analysis.',
          },
          { role: 'user', content: prompt },
        ],
        {
          temperature: 0.1, // Low temperature for consistent results
          maxTokens: 500,
        },
      )

      // Validate response structure
      if (!response || !response.content) {
        appLogger.warn(
          'Invalid AI response structure, falling back to keyword analysis',
        )
        return null
      }

      // Parse AI response
      const { content } = response
      try {
        const parsed = JSON.parse(content) as unknown

        if (typeof parsed === 'object' && parsed !== null) {
          return {
            score: Math.min(Math.max(Number(parsed.score) || 0, 0), 1), // Clamp between 0-1
            category: parsed.category || 'general_concern',
            severity: parsed.severity || 'low',
            indicators: Array.isArray(parsed.indicators)
              ? parsed.indicators
              : [],
            recommendations: Array.isArray(parsed.recommendations)
              ? parsed.recommendations
              : [],
          }
        }
        // Throw an error if parsed content is not a valid object
        throw new Error('Parsed AI response is not a valid object.')
      } catch {
        appLogger.error('AI response parsing failed', {
          error,
          responseContent: content,
        })
        // Fallback if JSON parsing fails or content is not an object
        return {
          score: 0.3,
          category: 'analysis_error',
          severity: 'medium',
          indicators: [],
          recommendations: ['Manual review recommended'],
        }
      }
    } catch (error: unknown) {
      // This will catch errors from the AI service itself (e.g., network issues, API errors)
      appLogger.error('AI service call failed in crisis detection', { error })
      // Return null to fall back to keyword analysis instead of throwing
      return null
    }
  }

  private determineCrisisCategory(
    keywords: string[],
    aiCategory?: string,
  ): string {
    if (aiCategory && aiCategory !== 'analysis_error') {
      return aiCategory
    }

    // Determine category based on keywords
    if (
      keywords.some((k) =>
        CrisisDetectionService.CRISIS_KEYWORDS.emergency.includes(k),
      )
    ) {
      return 'emergency'
    }
    if (
      keywords.some((k) =>
        CrisisDetectionService.CRISIS_KEYWORDS.suicide.includes(k),
      )
    ) {
      return 'suicide_risk'
    }
    if (
      keywords.some((k) =>
        CrisisDetectionService.CRISIS_KEYWORDS.self_harm.includes(k),
      )
    ) {
      return 'self_harm_risk'
    }
    if (
      keywords.some((k) =>
        CrisisDetectionService.CRISIS_KEYWORDS.severe_depression.includes(k),
      )
    ) {
      return 'severe_depression'
    }
    return 'general_concern'
  }

  private determineRiskLevel(
    score: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.8) {
      return 'critical'
    }
    if (score >= 0.6) {
      return 'high'
    }
    if (score >= 0.4) {
      return 'medium'
    }
    return 'low'
  }

  private determineUrgency(
    score: number,
    indicators: string[],
  ): 'low' | 'medium' | 'high' | 'immediate' {
    const hasEmergencyKeywords = indicators.some((ind) =>
      CrisisDetectionService.CRISIS_KEYWORDS.emergency.includes(ind),
    )

    if (hasEmergencyKeywords || score >= 0.9) {
      return 'immediate'
    }
    if (score >= 0.7) {
      return 'high'
    }
    if (score >= 0.5) {
      return 'medium'
    }
    return 'low'
  }

  private generateSuggestedActions(score: number): string[] {
    const actions: string[] = []

    if (score >= 0.9) {
      actions.push('Immediate intervention required')
      actions.push('Contact emergency services')
      actions.push('Do not leave individual alone')
    } else if (score >= 0.7) {
      actions.push('Urgent mental health evaluation needed')
      actions.push('Contact crisis hotline')
      actions.push('Remove access to means of harm')
    } else if (score >= 0.5) {
      actions.push('Schedule mental health appointment')
      actions.push('Increase monitoring and support')
      actions.push('Provide crisis resources')
    } else {
      actions.push('Continue supportive conversation')
      actions.push('Monitor for changes')
      actions.push('Provide mental health resources')
    }

    return actions
  }
}
