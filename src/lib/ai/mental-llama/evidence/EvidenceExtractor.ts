/**
 * Production-grade Evidence Extraction Service for MentalLLaMA
 *
 * This service provides comprehensive evidence extraction capabilities
 * for mental health analysis, including text-based evidence, contextual
 * indicators, and clinical markers.
 */

import { getClinicalAnalysisLogger } from '@/lib/logging/standardized-logger'
import type {
  IModelProvider,
  MentalHealthAnalysisResult,
} from '../types/mentalLLaMATypes'
import { parseSemanticEvidenceResponse } from './utils/semanticEvidenceParser'

const logger = getClinicalAnalysisLogger('general')

/**
 * Configuration for evidence extraction
 */
export interface EvidenceExtractionConfig {
  maxEvidenceItems: number
  minConfidenceThreshold: number
  includeContextualEvidence: boolean
  includeLinguisticPatterns: boolean
  includeEmotionalMarkers: boolean
  enableSemanticAnalysis: boolean
  prioritizeRiskIndicators: boolean
}

/**
 * Detailed evidence item with metadata
 */
export interface EvidenceItem {
  text: string
  type:
    | 'direct_quote'
    | 'paraphrase'
    | 'linguistic_pattern'
    | 'emotional_marker'
    | 'contextual_indicator'
  confidence: number
  relevance: 'high' | 'medium' | 'low'
  category: string // e.g., 'crisis_indicator', 'mood_symptom', 'cognitive_pattern'
  position?: {
    start: number
    end: number
  }
  semanticWeight?: number
  clinicalRelevance?: 'critical' | 'significant' | 'supportive' | 'contextual'
  metadata?: {
    keyword?: string
    pattern?: string
    emotionalValence?: 'positive' | 'negative' | 'neutral'
    intensity?: 'high' | 'medium' | 'low'
    temporalContext?: 'current' | 'past' | 'future' | 'ongoing'
    contextualContext?: string // Additional contextual information
    semanticRationale?: string // Rationale from semantic analysis
  }
}

/**
 * Evidence extraction result with comprehensive analysis
 */
export interface EvidenceExtractionResult {
  evidenceItems: EvidenceItem[]
  summary: {
    totalEvidence: number
    highConfidenceCount: number
    riskIndicatorCount: number
    supportiveFactorCount: number
    overallStrength: 'strong' | 'moderate' | 'weak'
  }
  categorizedEvidence: {
    [category: string]: EvidenceItem[]
  }
  qualityMetrics: {
    completeness: number // 0-1 scale
    specificity: number // 0-1 scale
    clinicalRelevance: number // 0-1 scale
  }
  extractionMetadata: {
    method: 'llm_enhanced' | 'pattern_based' | 'hybrid'
    processingTime: number
    tokensUsed?: number
    errors?: string[]
  }
}

/**
 * Clinical evidence patterns for mental health categories
 */
const CLINICAL_EVIDENCE_PATTERNS = {
  depression: {
    direct: [
      {
        pattern: /\b(depressed|depression|sad|down|blue|empty)\b/gi,
        weight: 0.8,
      },
      { pattern: /\b(hopeless|helpless|worthless|useless)\b/gi, weight: 0.9 },
      { pattern: /\b(can't (sleep|eat|concentrate|focus))\b/gi, weight: 0.7 },
      { pattern: /\b(no (energy|motivation|interest))\b/gi, weight: 0.8 },
      {
        pattern: /\b(everything (feels|seems) (pointless|meaningless))\b/gi,
        weight: 0.9,
      },
    ],
    behavioral: [
      {
        pattern:
          /\b(staying in bed|isolating|avoiding (people|friends|family))\b/gi,
        weight: 0.7,
      },
      { pattern: /\b(stopped (doing|enjoying|caring about))\b/gi, weight: 0.8 },
      { pattern: /\b(can't (get up|function|work))\b/gi, weight: 0.8 },
    ],
    cognitive: [
      {
        pattern: /\b(can't (think|concentrate|remember|decide))\b/gi,
        weight: 0.7,
      },
      {
        pattern: /\b(my mind (is|feels) (blank|foggy|scattered))\b/gi,
        weight: 0.6,
      },
      { pattern: /\b(negative thoughts|racing thoughts)\b/gi, weight: 0.7 },
    ],
  },
  anxiety: {
    direct: [
      {
        pattern: /\b(anxious|anxiety|worried|nervous|panicked?)\b/gi,
        weight: 0.8,
      },
      { pattern: /\b(can't (calm down|relax|stop worrying))\b/gi, weight: 0.8 },
      { pattern: /\b(what if|catastrophizing|worst case)\b/gi, weight: 0.7 },
    ],
    physical: [
      { pattern: /\b(heart (racing|pounding)|palpitations)\b/gi, weight: 0.8 },
      {
        pattern: /\b(shortness of breath|can't breathe|hyperventilating)\b/gi,
        weight: 0.9,
      },
      { pattern: /\b(sweating|trembling|shaking|nausea)\b/gi, weight: 0.6 },
      { pattern: /\b(tight chest|chest pain|dizziness)\b/gi, weight: 0.7 },
    ],
    avoidance: [
      {
        pattern: /\b(avoiding|scared to|afraid of|can't face)\b/gi,
        weight: 0.7,
      },
      { pattern: /\b(making excuses|cancelled|didn't go)\b/gi, weight: 0.6 },
    ],
  },
  crisis: {
    direct: [
      {
        pattern:
          /\b(suicide|kill myself|end (my life|it all)|not worth living)\b/gi,
        weight: 1.0,
      },
      {
        pattern: /\b(want to die|better off dead|can't go on)\b/gi,
        weight: 1.0,
      },
      {
        pattern: /\b(no point (in )?living|life (isn't|is not) worth)\b/gi,
        weight: 0.9,
      },
    ],
    planning: [
      {
        pattern:
          /\b(plan to|thinking about|considering|going to)\s+(kill|hurt|harm)/gi,
        weight: 1.0,
      },
      { pattern: /\b(pills|gun|bridge|rope|method)\b/gi, weight: 0.8 },
      { pattern: /\b(when I('m| am) gone|after I die)\b/gi, weight: 0.9 },
    ],
    means: [
      {
        pattern: /\b(have (pills|gun|weapon)|bought|collected)\b/gi,
        weight: 0.9,
      },
      {
        pattern: /\b(researched (methods|ways to)|looked up how)\b/gi,
        weight: 0.8,
      },
    ],
  },
  stress: {
    direct: [
      {
        pattern: /\b(stressed|overwhelmed|under pressure|too much)\b/gi,
        weight: 0.7,
      },
      { pattern: /\b(can't (cope|handle|manage))\b/gi, weight: 0.8 },
      { pattern: /\b(breaking point|at my limit|can't take)\b/gi, weight: 0.8 },
    ],
    sources: [
      {
        pattern: /\b(work|job|boss|deadline|bills|money|relationship)\b/gi,
        weight: 0.6,
      },
      {
        pattern: /\b(school|exams|grades|family|health|finances)\b/gi,
        weight: 0.6,
      },
    ],
  },
}

/**
 * Emotional and linguistic markers
 */
const EMOTIONAL_MARKERS = {
  negative: {
    high: [
      'devastating',
      'terrible',
      'awful',
      'horrible',
      'unbearable',
      'excruciating',
    ],
    medium: ['bad', 'difficult', 'hard', 'tough', 'challenging', 'struggling'],
    low: ['okay', 'fine', 'alright', 'manageable'],
  },
  positive: {
    high: [
      'amazing',
      'wonderful',
      'fantastic',
      'great',
      'excellent',
      'perfect',
    ],
    medium: ['good', 'nice', 'pleasant', 'positive', 'hopeful'],
    low: ['okay', 'fine', 'alright', 'decent'],
  },
}

/**
 * Production-grade Evidence Extractor
 */
export class EvidenceExtractor {
  private config: EvidenceExtractionConfig
  private modelProvider: IModelProvider | undefined

  constructor(
    config: Partial<EvidenceExtractionConfig> = {},
    modelProvider?: IModelProvider,
  ) {
    this.config = {
      maxEvidenceItems: 15,
      minConfidenceThreshold: 0.3,
      includeContextualEvidence: true,
      includeLinguisticPatterns: true,
      includeEmotionalMarkers: true,
      enableSemanticAnalysis: true,
      prioritizeRiskIndicators: true,
      ...config,
    }
    this.modelProvider = modelProvider
  }

  /**
   * Extract comprehensive evidence from text for mental health analysis
   */
  async extractEvidence(
    text: string,
    category: string,
    baseAnalysis?: MentalHealthAnalysisResult,
  ): Promise<EvidenceExtractionResult> {
    const startTime = Date.now()
    const evidenceItems: EvidenceItem[] = []
    const errors: string[] = []

    try {
      logger.info('Starting evidence extraction', {
        category,
        textLength: text.length,
        hasBaseAnalysis: !!baseAnalysis,
      })

      // 1. Pattern-based evidence extraction
      const patternEvidence = this.extractPatternBasedEvidence(text, category)
      evidenceItems.push(...patternEvidence)

      // 2. Linguistic and emotional markers
      if (this.config.includeLinguisticPatterns) {
        const linguisticEvidence = this.extractLinguisticEvidence(text)
        evidenceItems.push(...linguisticEvidence)
      }

      if (this.config.includeEmotionalMarkers) {
        const emotionalEvidence = this.extractEmotionalMarkers(text)
        evidenceItems.push(...emotionalEvidence)
      }

      // 3. Contextual evidence
      if (this.config.includeContextualEvidence) {
        const contextualEvidence = this.extractContextualEvidence(
          text,
          baseAnalysis,
        )
        evidenceItems.push(...contextualEvidence)
      }

      // 4. LLM-enhanced evidence extraction (if model provider available)
      if (this.config.enableSemanticAnalysis && this.modelProvider) {
        try {
          const semanticEvidence = await this.extractSemanticEvidence(
            text,
            category,
            baseAnalysis,
          )
          evidenceItems.push(...semanticEvidence)
        } catch (error: unknown) {
          logger.error('LLM-enhanced evidence extraction failed', { error })
          errors.push('Semantic analysis unavailable')
        }
      }

      // 5. Filter and rank evidence
      const filteredEvidence = this.filterAndRankEvidence(evidenceItems)

      // 6. Categorize evidence
      const categorizedEvidence = this.categorizeEvidence(filteredEvidence)

      // 7. Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(
        filteredEvidence,
        text,
      )

      // 8. Generate summary
      const summary = this.generateEvidenceSummary(filteredEvidence)

      const processingTime = Date.now() - startTime

      const result: EvidenceExtractionResult = {
        evidenceItems: filteredEvidence,
        summary,
        categorizedEvidence,
        qualityMetrics,
        extractionMetadata: {
          method: this.modelProvider ? 'llm_enhanced' : 'pattern_based',
          processingTime,
          ...(errors.length > 0 && { errors }),
        },
      }

      logger.info('Evidence extraction completed', {
        evidenceCount: filteredEvidence.length,
        processingTime,
        overallStrength: summary.overallStrength,
      })

      return result
    } catch (error: unknown) {
      logger.error('Evidence extraction failed', { error, category })

      // Return minimal evidence on error
      return {
        evidenceItems: [],
        summary: {
          totalEvidence: 0,
          highConfidenceCount: 0,
          riskIndicatorCount: 0,
          supportiveFactorCount: 0,
          overallStrength: 'weak',
        },
        categorizedEvidence: {},
        qualityMetrics: {
          completeness: 0,
          specificity: 0,
          clinicalRelevance: 0,
        },
        extractionMetadata: {
          method: 'pattern_based',
          processingTime: Date.now() - startTime,
          errors: [
            `Evidence extraction failed: ${error instanceof Error ? String(error) : 'Unknown error'}`,
          ],
        },
      }
    }
  }

  /**
   * Extract pattern-based evidence using clinical patterns
   */
  private extractPatternBasedEvidence(
    text: string,
    category: string,
  ): EvidenceItem[] {
    const evidence: EvidenceItem[] = []
    const patterns =
      CLINICAL_EVIDENCE_PATTERNS[
        category as keyof typeof CLINICAL_EVIDENCE_PATTERNS
      ]

    if (!patterns) {
      return evidence
    }

    Object.entries(patterns).forEach(([subCategory, patternList]) => {
      patternList.forEach(({ pattern, weight }) => {
        const matches = text.match(pattern)
        if (matches) {
          matches.forEach((match) => {
            const startIndex = text.indexOf(match)
            evidence.push({
              text: match,
              type: 'direct_quote',
              confidence: weight,
              relevance:
                weight > 0.8 ? 'high' : weight > 0.6 ? 'medium' : 'low',
              category: `${category}_${subCategory}`,
              position: {
                start: startIndex,
                end: startIndex + match.length,
              },
              clinicalRelevance: weight > 0.8 ? 'significant' : 'supportive',
              metadata: {
                pattern: pattern.source,
                keyword: match.toLowerCase(),
              },
            })
          })
        }
      })
    })

    return evidence
  }

  /**
   * Extract linguistic patterns and speech markers
   */
  private extractLinguisticEvidence(text: string): EvidenceItem[] {
    const evidence: EvidenceItem[] = []

    // Negation patterns that might indicate mental health issues
    const negationPatterns = [
      {
        pattern: /\b(never|nothing|no one|nobody|nowhere)\b/gi,
        category: 'absolutist_thinking',
      },
      {
        pattern: /\b(can't|won't|don't|isn't|aren't|wasn't|weren't)\b/gi,
        category: 'negative_capability',
      },
      {
        pattern:
          /\b(always|everything|everyone|everywhere)\s+(is|are|feels?|seems?)\s+\w*(bad|wrong|awful|terrible)\b/gi,
        category: 'overgeneralization',
      },
    ]

    // Modal verbs indicating uncertainty or distress
    const modalPatterns = [
      {
        pattern: /\b(should|shouldn't|must|mustn't|have to|need to)\b/gi,
        category: 'pressure_language',
      },
      {
        pattern:
          /\b(might|maybe|perhaps|possibly|probably)\s+\w*(die|hurt|fail|wrong)\b/gi,
        category: 'uncertainty_with_risk',
      },
    ]

    // Temporal patterns indicating duration of symptoms
    const temporalPatterns = [
      {
        pattern:
          /\b(for (weeks|months|years)|since|constantly|always|never)\b/gi,
        category: 'symptom_duration',
      },
      {
        pattern: /\b(getting worse|deteriorating|declining|spiral(l)?ing)\b/gi,
        category: 'symptom_progression',
      },
    ]

    ;[negationPatterns, modalPatterns, temporalPatterns].forEach(
      (patternGroup) => {
        patternGroup.forEach(({ pattern, category }) => {
          const matches = text.match(pattern)
          if (matches) {
            matches.forEach((match) => {
              evidence.push({
                text: match,
                type: 'linguistic_pattern',
                confidence: 0.6,
                relevance: 'medium',
                category,
                metadata: {
                  pattern: pattern.source,
                },
              })
            })
          }
        })
      },
    )

    return evidence
  }

  /**
   * Extract emotional markers and intensity indicators
   */
  private extractEmotionalMarkers(text: string): EvidenceItem[] {
    const evidence: EvidenceItem[] = []

    Object.entries(EMOTIONAL_MARKERS).forEach(([valence, intensityLevels]) => {
      Object.entries(intensityLevels).forEach(([intensity, words]) => {
        words.forEach((word) => {
          const regex = new RegExp(`\\b${word}\\b`, 'gi')
          const matches = text.match(regex)
          if (matches) {
            matches.forEach((match) => {
              evidence.push({
                text: match,
                type: 'emotional_marker',
                confidence:
                  intensity === 'high'
                    ? 0.8
                    : intensity === 'medium'
                      ? 0.6
                      : 0.4,
                relevance: intensity === 'high' ? 'high' : 'medium',
                category: 'emotional_expression',
                metadata: {
                  emotionalValence: valence as 'positive' | 'negative',
                  intensity: intensity as 'high' | 'medium' | 'low',
                  keyword: word,
                },
              })
            })
          }
        })
      })
    })

    return evidence
  }

  /**
   * Extract contextual evidence based on base analysis
   */
  private extractContextualEvidence(
    text: string,
    baseAnalysis?: MentalHealthAnalysisResult,
  ): EvidenceItem[] {
    const evidence: EvidenceItem[] = []

    if (!baseAnalysis) {
      return evidence
    }

    // If crisis detected, look for additional crisis context
    if (baseAnalysis.isCrisis) {
      const crisisContextPatterns = [
        /\b(plan|method|when|where|how)\b/gi,
        /\b(final|last|goodbye|sorry)\b/gi,
        /\b(insurance|will|belongings|pets)\b/gi,
      ]

      crisisContextPatterns.forEach((pattern) => {
        const matches = text.match(pattern)
        if (matches) {
          matches.forEach((match) => {
            evidence.push({
              text: match,
              type: 'contextual_indicator',
              confidence: 0.9,
              relevance: 'high',
              category: 'crisis_context',
              clinicalRelevance: 'critical',
              metadata: {
                contextualContext: 'crisis_amplification',
              },
            })
          })
        }
      })
    }

    // Look for supporting/protective factors
    const protectivePatterns = [
      /\b(support|help|therapy|treatment|doctor|counselor|family|friends)\b/gi,
      /\b(hope|future|goals|plans|better|improve|recover)\b/gi,
      /\b(grateful|thankful|blessed|lucky|fortunate)\b/gi,
    ]

    protectivePatterns.forEach((pattern) => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach((match) => {
          evidence.push({
            text: match,
            type: 'contextual_indicator',
            confidence: 0.7,
            relevance: 'medium',
            category: 'protective_factors',
            clinicalRelevance: 'supportive',
            metadata: {
              contextualContext: 'protective_factor',
            },
          })
        })
      }
    })

    return evidence
  }

  /**
   * Extract semantic evidence using LLM analysis
   */
  private async extractSemanticEvidence(
    text: string,
    category: string,
    baseAnalysis?: MentalHealthAnalysisResult,
  ): Promise<EvidenceItem[]> {
    if (!this.modelProvider) {
      return []
    }

    const prompt = this.buildSemanticExtractionPrompt(
      text,
      category,
      baseAnalysis,
    )

    try {
      const response = await this.modelProvider.invoke(prompt, {
        temperature: 0.2,
        max_tokens: 600,
      })

      // Parse using utils parser (shared EvidenceItem shape)
      const parsed = parseSemanticEvidenceResponse(response.content)

      // Map shared EvidenceItem -> extractor EvidenceItem
      const mapped: EvidenceItem[] = parsed.map((item) => {
        // clinicalRelevance mapping: prefer categorical where possible
        // If numeric present, bucket into categories; if string provided, preserve it; otherwise default to 'supportive'
        let clinical: EvidenceItem['clinicalRelevance']
        if (typeof item.clinicalRelevance === 'number') {
          const v = item.clinicalRelevance
          if (v >= 0.95) {
            clinical = 'critical'
          } else if (v >= 0.7) {
            clinical = 'significant'
          } else if (v >= 0.4) {
            clinical = 'supportive'
          } else {
            clinical = 'contextual'
          }
        } else if (typeof item.clinicalRelevance === 'string') {
          // Parser may emit 'supportive' default; preserve valid string
          clinical = item.clinicalRelevance as EvidenceItem['clinicalRelevance']
        } else {
          // Default when missing
          clinical = 'supportive'
        }

        // severity mapping to relevance/intensity
        const relevance: EvidenceItem['relevance'] =
          item.severity === 'high'
            ? 'high'
            : item.severity === 'moderate'
              ? 'medium'
              : 'low'

        return {
          text: item.content,
          type: 'direct_quote',
          confidence: item.confidence ?? 0.5,
          relevance,
          category: item.source || `${category}_semantic`,
          clinicalRelevance: clinical,
          metadata: {
            semanticRationale: (item.context &&
              (item.context as Record<string, unknown>)[
                'semanticRationale'
              ]) as string | undefined,
          },
        }
      })

      return mapped
    } catch (error: unknown) {
      logger.error('Semantic evidence extraction failed', { error })
      return []
    }
  }

  /**
   * Build prompt for semantic evidence extraction
   */
  private buildSemanticExtractionPrompt(
    text: string,
    category: string,
    baseAnalysis?: MentalHealthAnalysisResult,
  ): Array<{ role: 'system' | 'user'; content: string }> {
    const systemPrompt = `You are a clinical psychology expert analyzing text for mental health evidence. 
Extract specific, clinically relevant evidence from the text that supports or contradicts mental health concerns.

Focus on:
1. Specific phrases or sentences that indicate mental health symptoms
2. Behavioral indicators mentioned in the text
3. Emotional expressions and their context
4. Temporal markers (duration, frequency, onset)
5. Functional impairment indicators
6. Risk or protective factors

For each piece of evidence, provide:
- The exact text excerpt (keep original wording)
- Clinical relevance (critical/significant/supportive/contextual)
- Confidence level (0.0-1.0)
- Brief clinical rationale

Respond in JSON format:
{
  "evidence": [
    {
      "text": "exact quote from text",
      "clinicalRelevance": "significant",
      "confidence": 0.8,
      "rationale": "brief clinical explanation",
      "category": "symptom_type"
    }
  ]
}`

    const userPrompt = `Analyze this text for mental health evidence in the context of ${category}:

"${text}"

${baseAnalysis ? `Previous analysis detected: ${baseAnalysis.mentalHealthCategory} (confidence: ${baseAnalysis.confidence.toFixed(2)})` : ''}

Extract evidence that is clinically meaningful and specific to mental health assessment.`

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]
  }

  /**
   * Filter and rank evidence by relevance and confidence
   */
  private filterAndRankEvidence(evidenceItems: EvidenceItem[]): EvidenceItem[] {
    // Remove duplicates and low-confidence items
    const filtered = evidenceItems
      .filter((item) => item.confidence >= this.config.minConfidenceThreshold)
      .filter(
        (item, index, array) =>
          array.findIndex(
            (other) => other.text.toLowerCase() === item.text.toLowerCase(),
          ) === index,
      )

    // Sort by priority: crisis indicators first, then by confidence
    const sorted = filtered.sort((a, b) => {
      // Prioritize crisis indicators
      const aCrisis = a.category.includes('crisis') ? 1 : 0
      const bCrisis = b.category.includes('crisis') ? 1 : 0
      if (aCrisis !== bCrisis) {
        return bCrisis - aCrisis
      }

      // Then by clinical relevance
      const relevanceOrder = {
        critical: 4,
        significant: 3,
        supportive: 2,
        contextual: 1,
      }
      const aRelevance = relevanceOrder[a.clinicalRelevance || 'supportive']
      const bRelevance = relevanceOrder[b.clinicalRelevance || 'supportive']
      if (aRelevance !== bRelevance) {
        return bRelevance - aRelevance
      }

      // Finally by confidence
      return b.confidence - a.confidence
    })

    // Limit to max items
    return sorted.slice(0, this.config.maxEvidenceItems)
  }

  /**
   * Categorize evidence by type and clinical relevance
   */
  private categorizeEvidence(evidenceItems: EvidenceItem[]): {
    [category: string]: EvidenceItem[]
  } {
    const categorized: { [category: string]: EvidenceItem[] } = {}

    evidenceItems.forEach((item) => {
      if (!categorized[item.category]) {
        categorized[item.category] = []
      }
      categorized[item.category]!.push(item)
    })

    return categorized
  }

  /**
   * Calculate quality metrics for evidence
   */
  private calculateQualityMetrics(
    evidenceItems: EvidenceItem[],
    originalText: string,
  ): {
    completeness: number
    specificity: number
    clinicalRelevance: number
  } {
    if (evidenceItems.length === 0) {
      return { completeness: 0, specificity: 0, clinicalRelevance: 0 }
    }

    // Completeness: coverage of original text
    const evidenceTextLength = evidenceItems.reduce(
      (sum, item) => sum + item.text.length,
      0,
    )
    const completeness = Math.min(
      evidenceTextLength / (originalText.length * 0.3),
      1,
    ) // Target 30% coverage

    // Specificity: proportion of high-confidence, specific evidence
    const specificEvidence = evidenceItems.filter(
      (item) => item.confidence > 0.7 && item.type === 'direct_quote',
    )
    const specificity = specificEvidence.length / evidenceItems.length

    // Clinical relevance: weighted by clinical importance
    const relevanceWeights = {
      critical: 1.0,
      significant: 0.8,
      supportive: 0.6,
      contextual: 0.4,
    }
    const totalRelevance = evidenceItems.reduce(
      (sum, item) =>
        sum + (relevanceWeights[item.clinicalRelevance || 'supportive'] || 0.4),
      0,
    )
    const clinicalRelevance = totalRelevance / evidenceItems.length

    return {
      completeness: Math.round(completeness * 100) / 100,
      specificity: Math.round(specificity * 100) / 100,
      clinicalRelevance: Math.round(clinicalRelevance * 100) / 100,
    }
  }

  /**
   * Generate evidence summary
   */
  private generateEvidenceSummary(evidenceItems: EvidenceItem[]): {
    totalEvidence: number
    highConfidenceCount: number
    riskIndicatorCount: number
    supportiveFactorCount: number
    overallStrength: 'strong' | 'moderate' | 'weak'
  } {
    const totalEvidence = evidenceItems.length
    const highConfidenceCount = evidenceItems.filter(
      (item) => item.confidence > 0.7,
    ).length
    const riskIndicatorCount = evidenceItems.filter(
      (item) =>
        item.category.includes('crisis') ||
        item.category.includes('risk') ||
        item.clinicalRelevance === 'critical',
    ).length
    const supportiveFactorCount = evidenceItems.filter(
      (item) =>
        item.category.includes('protective') ||
        item.metadata?.emotionalValence === 'positive',
    ).length

    // Determine overall strength
    let overallStrength: 'strong' | 'moderate' | 'weak' = 'weak'
    if (highConfidenceCount >= 3 && totalEvidence >= 5) {
      overallStrength = 'strong'
    } else if (highConfidenceCount >= 1 && totalEvidence >= 2) {
      overallStrength = 'moderate'
    }

    return {
      totalEvidence,
      highConfidenceCount,
      riskIndicatorCount,
      supportiveFactorCount,
      overallStrength,
    }
  }

  /**
   * Convert evidence items to simple string array for backward compatibility
   */
  static convertToStringArray(evidenceItems: EvidenceItem[]): string[] {
    return evidenceItems
      .filter((item) => item.confidence > 0.5) // Only include medium+ confidence
      .sort((a, b) => b.confidence - a.confidence) // Sort by confidence
      .map((item) => item.text)
      .slice(0, 10) // Limit for readability
  }

  /**
   * Get evidence for specific clinical category
   */
  getCategoryEvidence(
    evidenceResult: EvidenceExtractionResult,
    category: string,
  ): EvidenceItem[] {
    return evidenceResult.categorizedEvidence[category] || []
  }

  /**
   * Get high-priority evidence (crisis, high confidence, etc.)
   */
  getHighPriorityEvidence(
    evidenceResult: EvidenceExtractionResult,
  ): EvidenceItem[] {
    return evidenceResult.evidenceItems.filter(
      (item) =>
        item.clinicalRelevance === 'critical' ||
        item.confidence > 0.8 ||
        item.category.includes('crisis'),
    )
  }
}
