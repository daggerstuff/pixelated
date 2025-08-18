/**
 * Enhanced Evidence Service Integration
 *
 * This service integrates the comprehensive EvidenceExtractor
 * with the existing MentalLLaMA adapter system.
 */

import { getClinicalAnalysisLogger } from '@/lib/logging/standardized-logger'
import {
  EvidenceExtractor,
  type EvidenceItem,
  type EvidenceExtractionResult,
} from './EvidenceExtractor'
import type {
  IModelProvider,
  MentalHealthAnalysisResult,
  RoutingContext,
} from '../types/mentalLLaMATypes'

const logger = getClinicalAnalysisLogger('general')

/**
 * Configuration for evidence service
 */
export interface EvidenceServiceConfig {
  enableLLMEnhancement: boolean
  enableCaching: boolean
  cacheExpirationMs: number
  maxCacheSize: number
  enableMetrics: boolean
}

/**
 * Evidence cache entry
 */
interface CacheEntry {
  result: EvidenceExtractionResult
  timestamp: number
  textHash: string
  category: string
}

/**
 * Evidence service metrics
 */
interface EvidenceMetrics {
  totalExtractions: number
  cacheHits: number
  cacheMisses: number
  averageProcessingTime: number
  errorCount: number
  lastError?: string
}

/**
 * Enhanced Evidence Service
 */
export class EvidenceService {
  private extractor: EvidenceExtractor
  private config: EvidenceServiceConfig
  private cache: Map<string, CacheEntry> = new Map()
  private metrics: EvidenceMetrics = {
    totalExtractions: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageProcessingTime: 0,
    errorCount: 0,
  }

  constructor(
    modelProvider?: IModelProvider,
    config: Partial<EvidenceServiceConfig> = {},
  ) {
    this.config = {
      enableLLMEnhancement: true,
      enableCaching: true,
      cacheExpirationMs: 300000, // 5 minutes
      maxCacheSize: 1000,
      enableMetrics: true,
      ...config,
    }

    this.extractor = new EvidenceExtractor(
      {
        enableSemanticAnalysis:
          this.config.enableLLMEnhancement && !!modelProvider,
        maxEvidenceItems: 12,
        minConfidenceThreshold: 0.4,
        prioritizeRiskIndicators: true,
      },
      modelProvider,
    )

    logger.info('EvidenceService initialized', {
      llmEnhanced: this.config.enableLLMEnhancement && !!modelProvider,
      cachingEnabled: this.config.enableCaching,
    })
  }

  /**
   * Extract supporting evidence for mental health analysis
   */
  async extractSupportingEvidence(
    text: string,
    category: string,
    baseAnalysis?: MentalHealthAnalysisResult,
    routingContext?: RoutingContext,
  ): Promise<{
    evidenceItems: string[]
    detailedEvidence: EvidenceExtractionResult
    processingMetadata: {
      cacheUsed: boolean
      processingTime: number
      evidenceStrength: 'strong' | 'moderate' | 'weak'
    }
  }> {
    const startTime = Date.now()
    let cacheUsed = false

    try {
      this.metrics.totalExtractions++

      // Generate cache key
      const cacheKey = this.generateCacheKey(text, category)

      // Check cache first
      let detailedEvidence: EvidenceExtractionResult | undefined
      if (this.config.enableCaching) {
        const cached = this.getCachedEvidence(cacheKey)
        if (cached) {
          detailedEvidence = cached
          cacheUsed = true
          this.metrics.cacheHits++
          logger.debug('Using cached evidence', { category, cacheKey })
        } else {
          this.metrics.cacheMisses++
        }
      }

      // Extract evidence if not cached
      if (!detailedEvidence) {
        detailedEvidence = await this.extractor.extractEvidence(
          text,
          category,
          baseAnalysis,
        )

        // Cache the result
        if (this.config.enableCaching) {
          this.setCachedEvidence(cacheKey, detailedEvidence, text, category)
        }
      }

      // Convert to simple string array for backward compatibility
      const evidenceItems = this.convertToStringArray(
        detailedEvidence.evidenceItems,
      )

      // Add routing context insights if available
      if (routingContext && baseAnalysis?._routingDecision) {
        const contextualEvidence = this.extractContextualInsights(
          detailedEvidence,
          baseAnalysis._routingDecision,
          routingContext,
        )
        evidenceItems.unshift(...contextualEvidence)
      }

      const processingTime = Date.now() - startTime
      this.updateMetrics(processingTime)

      const result = {
        evidenceItems: evidenceItems.slice(0, 8), // Limit for readability
        detailedEvidence,
        processingMetadata: {
          cacheUsed,
          processingTime,
          evidenceStrength: detailedEvidence.summary.overallStrength,
        },
      }

      logger.info('Evidence extraction completed', {
        category,
        evidenceCount: evidenceItems.length,
        overallStrength: detailedEvidence.summary.overallStrength,
        processingTime,
        cacheUsed,
      })

      return result
    } catch (error: unknown) {
      this.metrics.errorCount++
      this.metrics.lastError =
        error instanceof Error ? String(error) : 'Unknown error'

      logger.error('Evidence extraction failed', {
        error,
        category,
        textLength: text.length,
      })

      // Return fallback evidence
      return {
        evidenceItems: this.extractFallbackEvidence(text, category),
        detailedEvidence: {
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
            errors: ['Evidence extraction failed'],
          },
        },
        processingMetadata: {
          cacheUsed: false,
          processingTime: Date.now() - startTime,
          evidenceStrength: 'weak',
        },
      }
    }
  }

  /**
   * Extract crisis-specific evidence with high priority
   */
  async extractCrisisEvidence(
    text: string,
    baseAnalysis: MentalHealthAnalysisResult,
  ): Promise<{
    immediateRiskIndicators: string[]
    planningIndicators: string[]
    contextualFactors: string[]
    protectiveFactors: string[]
  }> {
    try {
      const evidenceResult = await this.extractor.extractEvidence(
        text,
        'crisis',
        baseAnalysis,
      )

      const immediateRiskIndicators: string[] = []
      const planningIndicators: string[] = []
      const contextualFactors: string[] = []
      const protectiveFactors: string[] = []

      evidenceResult.evidenceItems.forEach((item) => {
        if (item.clinicalRelevance === 'critical') {
          if (
            item.category.includes('direct') ||
            item.category.includes('planning')
          ) {
            immediateRiskIndicators.push(item.text)
          } else if (
            item.category.includes('means') ||
            item.category.includes('method')
          ) {
            planningIndicators.push(item.text)
          }
        } else if (item.category.includes('protective')) {
          protectiveFactors.push(item.text)
        } else {
          contextualFactors.push(item.text)
        }
      })

      return {
        immediateRiskIndicators: immediateRiskIndicators.slice(0, 5),
        planningIndicators: planningIndicators.slice(0, 3),
        contextualFactors: contextualFactors.slice(0, 4),
        protectiveFactors: protectiveFactors.slice(0, 3),
      }
    } catch (error: unknown) {
      logger.error('Crisis evidence extraction failed', { error })
      return {
        immediateRiskIndicators: [],
        planningIndicators: [],
        contextualFactors: [],
        protectiveFactors: [],
      }
    }
  }

  /**
   * Get evidence quality assessment
   */
  assessEvidenceQuality(evidenceResult: EvidenceExtractionResult): {
    overallQuality: 'excellent' | 'good' | 'fair' | 'poor'
    completeness: number
    specificity: number
    clinicalRelevance: number
    recommendations: string[]
  } {
    const { qualityMetrics, summary } = evidenceResult

    // Calculate overall quality score
    const overallScore =
      qualityMetrics.completeness * 0.3 +
      qualityMetrics.specificity * 0.4 +
      qualityMetrics.clinicalRelevance * 0.3

    let overallQuality: 'excellent' | 'good' | 'fair' | 'poor'
    if (overallScore >= 0.8) {
      overallQuality = 'excellent'
    } else if (overallScore >= 0.6) {
      overallQuality = 'good'
    } else if (overallScore >= 0.4) {
      overallQuality = 'fair'
    } else {
      overallQuality = 'poor'
    }

    // Generate recommendations
    const recommendations: string[] = []
    if (qualityMetrics.completeness < 0.5) {
      recommendations.push(
        'Consider requesting more detailed information from the user',
      )
    }
    if (qualityMetrics.specificity < 0.5) {
      recommendations.push(
        'Look for more specific behavioral or symptom indicators',
      )
    }
    if (summary.riskIndicatorCount > 0) {
      recommendations.push(
        'Prioritize immediate risk assessment and safety planning',
      )
    }
    if (summary.supportiveFactorCount > 0) {
      recommendations.push(
        'Leverage identified protective factors in treatment planning',
      )
    }

    return {
      overallQuality,
      completeness: qualityMetrics.completeness,
      specificity: qualityMetrics.specificity,
      clinicalRelevance: qualityMetrics.clinicalRelevance,
      recommendations,
    }
  }

  /**
   * Get service metrics
   */
  getMetrics(): EvidenceMetrics {
    return { ...this.metrics }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear()
    logger.info('Evidence cache cleared')
  }

  // Private helper methods

  private generateCacheKey(text: string, category: string): string {
    // Simple hash function for cache key
    const textHash = this.simpleHash(text.toLowerCase().trim())
    return `${category}:${textHash}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash &= hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  private getCachedEvidence(cacheKey: string): EvidenceExtractionResult | null {
    const entry = this.cache.get(cacheKey)
    if (!entry) {
      return null
    }

    // Check expiration
    if (Date.now() - entry.timestamp > this.config.cacheExpirationMs) {
      this.cache.delete(cacheKey)
      return null
    }

    return entry.result
  }

  private setCachedEvidence(
    cacheKey: string,
    result: EvidenceExtractionResult,
    text: string,
    category: string,
  ): void {
    // Manage cache size
    if (this.cache.size >= this.config.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value as string
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      textHash: this.simpleHash(text),
      category,
    })
  }

  private convertToStringArray(evidenceItems: EvidenceItem[]): string[] {
    return evidenceItems
      .filter((item) => item.confidence > 0.5)
      .sort((a, b) => {
        // Prioritize crisis indicators
        if (a.category.includes('crisis') && !b.category.includes('crisis')) {
          return -1
        }
        if (!a.category.includes('crisis') && b.category.includes('crisis')) {
          return 1
        }
        // Then by confidence
        return b.confidence - a.confidence
      })
      .map((item) => item.text)
      .slice(0, 10)
  }

  private extractContextualInsights(
    _evidenceResult: EvidenceExtractionResult,
    routingDecision: unknown,
    routingContext: RoutingContext,
  ): string[] {
    const insights: string[] = []
    const decision = routingDecision as Record<string, unknown>

    // Add routing insights
    const decisionInsights = decision?.['insights'] as Record<string, unknown>
    if (
      decisionInsights?.['matchedKeywords'] &&
      Array.isArray(decisionInsights['matchedKeywords'])
    ) {
      insights.push(
        `Routing keywords: ${(decisionInsights['matchedKeywords'] as string[]).join(', ')}`,
      )
    }

    // Add session context
    if (routingContext.sessionType) {
      insights.push(`Session context: ${routingContext.sessionType}`)
    }

    return insights.slice(0, 2)
  }

  private extractFallbackEvidence(text: string, category: string): string[] {
    // Simple keyword-based fallback
    const fallbackKeywords: Record<string, string[]> = {
      depression: ['sad', 'depressed', 'hopeless', 'down', 'empty'],
      anxiety: ['anxious', 'worried', 'nervous', 'panic', 'fear'],
      crisis: ['suicide', 'kill', 'die', 'end it'],
      stress: ['stressed', 'overwhelmed', 'pressure', 'too much'],
    }

    const keywords = fallbackKeywords[category] || []
    const found: string[] = []

    keywords.forEach((keyword) => {
      if (text.toLowerCase().includes(keyword)) {
        const index = text.toLowerCase().indexOf(keyword)
        const start = Math.max(0, index - 20)
        const end = Math.min(text.length, index + keyword.length + 20)
        found.push(text.substring(start, end).trim())
      }
    })

    return found.slice(0, 3)
  }

  private updateMetrics(processingTime: number): void {
    if (!this.config.enableMetrics) {
      return
    }

    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime *
        (this.metrics.totalExtractions - 1) +
        processingTime) /
      this.metrics.totalExtractions
  }
}

/**
 * Factory function to create evidence service
 */
export function createEvidenceService(
  modelProvider?: IModelProvider,
  config?: Partial<EvidenceServiceConfig>,
): EvidenceService {
  return new EvidenceService(modelProvider, config)
}

/**
 * Helper to convert detailed evidence to simple string array
 */
export function evidenceToStringArray(
  evidenceResult: EvidenceExtractionResult,
): string[] {
  return EvidenceExtractor.convertToStringArray(evidenceResult.evidenceItems)
}
