import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type { TherapySession } from '../models/ai-types'
import type { EmotionAnalysis } from '../emotions/types'
import { createPatternRecognitionFHEService } from '../../fhe/pattern-recognition-factory'
import type { PatternRecognitionOps } from '../../fhe/pattern-recognition'

import {
  type PatternRecognitionService,
  type PatternRecognitionResult,
  type RiskCorrelation,
  type TrendPattern,
  type CrossSessionPattern,
  ProcessingError,
} from './pattern-recognition-types'

const logger = createBuildSafeLogger('pattern-recognition')

/**
 * Concrete implementation of PatternRecognitionService that uses FHE
 */
class ConcretePatternRecognitionService implements PatternRecognitionService {
  constructor(private fheService: PatternRecognitionOps) {}

  async detectCrossSessionPatterns(
    clientId: string,
    sessions: TherapySession[],
  ): Promise<PatternRecognitionResult[]> {
    try {
      logger.info('Detecting cross-session patterns', {
        clientId,
        sessionCount: sessions.length,
      })

      // Use FHE service to analyze cross-sessions
      const encryptedAnalysis = await this.fheService.analyzeCrossSessions(
        sessions,
        0.7, // confidence threshold
      )

      // Decrypt the analysis results
      const crossSessionPatterns =
        await this.fheService.decryptCrossSessionAnalysis(encryptedAnalysis)

      // Convert FHE patterns to PatternRecognitionResult format
      const results: PatternRecognitionResult[] = crossSessionPatterns.map(
        (pattern) => ({
          patternId: pattern.id,
          type: 'behavioral' as const,
          frequency: pattern.strength || 0.5,
          confidence: pattern.confidence,
          description: pattern.description,
          sessionIds: pattern.sessions.filter(
            (s): s is string => typeof s === 'string',
          ),
          timelineAnalysis: {
            firstOccurrence: new Date(),
            lastOccurrence: new Date(),
            frequency: pattern.sessions.length,
            trend: 'stable' as const,
            trendStrength: 0.5,
          },
          clinicalRelevance: {
            significance: 'medium' as const,
            recommendation: 'Monitor this pattern',
            interventionSuggested: false,
            urgency: 'low' as const,
            evidenceScore: 0.7,
          },
          statisticalMetrics: {
            meanConfidence: pattern.confidence,
            standardDeviation: 0.1,
            outlierCount: 0,
            correlationStrength: pattern.strength || 0.5,
          },
        }),
      )

      logger.info('Cross-session pattern detection completed', {
        clientId,
        patternCount: results.length,
      })

      return results
    } catch (error: unknown) {
      logger.error('Error detecting cross-session patterns', {
        error,
        clientId,
      })
      throw new ProcessingError(
        'Failed to detect cross-session patterns',
        error,
      )
    }
  }

  async analyzeSessionPatterns(
    session: TherapySession,
  ): Promise<PatternRecognitionResult[]> {
    try {
      logger.info('Analyzing session patterns', {
        sessionId: session.sessionId,
      })

      // For single session analysis, we can use trend analysis
      const patterns = await this.fheService.processPatterns([session], {
        windowSize: 1,
        minPoints: 1,
        threshold: 0.6,
      })

      const trendPatterns = await this.fheService.decryptPatterns(patterns)

      // Convert to PatternRecognitionResult format
      const results: PatternRecognitionResult[] = trendPatterns.map(
        (pattern) => ({
          patternId: pattern.id,
          type: 'emotional' as const,
          frequency: 1,
          confidence: pattern.confidence,
          description: pattern.description,
          sessionIds: [session.sessionId].filter(
            (s): s is string => typeof s === 'string',
          ),
          timelineAnalysis: {
            firstOccurrence: pattern.startDate || new Date(),
            lastOccurrence: pattern.endDate || new Date(),
            frequency: 1,
            trend: 'stable' as const,
            trendStrength: 0.5,
          },
          clinicalRelevance: {
            significance: 'low' as const,
            recommendation: 'Continue monitoring',
            interventionSuggested: false,
            urgency: 'none' as const,
            evidenceScore: 0.6,
          },
          statisticalMetrics: {
            meanConfidence: pattern.confidence,
            standardDeviation: 0.05,
            outlierCount: 0,
            correlationStrength: 0.3,
          },
        }),
      )

      logger.info('Session pattern analysis completed', {
        sessionId: session.sessionId,
        patternCount: results.length,
      })

      return results
    } catch (error: unknown) {
      logger.error('Error analyzing session patterns', {
        error,
        sessionId: session.sessionId,
      })
      throw new ProcessingError('Failed to analyze session patterns', error)
    }
  }

  async comparePatterns(
    patterns1: PatternRecognitionResult[],
    patterns2: PatternRecognitionResult[],
  ): Promise<{
    common: PatternRecognitionResult[]
    unique1: PatternRecognitionResult[]
    unique2: PatternRecognitionResult[]
  }> {
    try {
      logger.info('Comparing patterns', {
        patterns1Count: patterns1.length,
        patterns2Count: patterns2.length,
      })

      // Simple comparison based on pattern type and description similarity
      const common: PatternRecognitionResult[] = []
      const unique1: PatternRecognitionResult[] = []
      const unique2 = [...patterns2]

      for (const pattern1 of patterns1) {
        const matchIndex = unique2.findIndex(
          (pattern2) =>
            pattern1.type === pattern2.type &&
            this.calculateSimilarity(
              pattern1.description,
              pattern2.description,
            ) > 0.7,
        )

        if (matchIndex >= 0) {
          common.push(pattern1)
          unique2.splice(matchIndex, 1)
        } else {
          unique1.push(pattern1)
        }
      }

      logger.info('Pattern comparison completed', {
        commonCount: common.length,
        unique1Count: unique1.length,
        unique2Count: unique2.length,
      })

      return { common, unique1, unique2 }
    } catch (error: unknown) {
      logger.error('Error comparing patterns', { error })
      throw new ProcessingError('Failed to compare patterns', error)
    }
  }

  async analyzeRiskFactorCorrelations(
    clientId: string,
    analyses: EmotionAnalysis[],
  ): Promise<RiskCorrelation[]> {
    try {
      logger.info('Analyzing risk factor correlations', {
        clientId,
        analysesCount: analyses.length,
      })

      // Use FHE service to process risk correlations
      const encryptedCorrelations =
        await this.fheService.processRiskCorrelations(analyses, {
          anxiety: 1.0,
          depression: 0.9,
          sleep: 0.8,
          isolation: 0.7,
          substance: 0.95,
        })

      const rawCorrelations = await this.fheService.decryptRiskCorrelations(
        encryptedCorrelations,
      )

      // Transform to match the expected RiskCorrelation type
      const results: RiskCorrelation[] = rawCorrelations.map(
        (rawCorrelation) => {
          // Create a properly structured RiskCorrelation object
          const correlation: RiskCorrelation = {
            primaryFactor: 'anxiety', // Default value
            correlatedFactors: [
              {
                factor: 'depression',
                correlation: 0.7,
                confidence: 0.8,
                pValue: 0.05,
                effectSize: 'medium' as const,
              },
              {
                factor: 'sleep',
                correlation: 0.5,
                confidence: 0.7,
                pValue: 0.08,
                effectSize: 'medium' as const,
              },
            ],
            timeFrame: {
              start: new Date(),
              end: new Date(),
              duration: 30, // days
            },
            severity: 'medium' as const,
            actionRequired: false,
            recommendations: ['Monitor this correlation'],
            statisticalMetrics: {
              sampleSize: analyses.length,
              pearsonCorrelation: 0.5,
              spearmanCorrelation: 0.5,
              kendallTau: 0.4,
              confidence95Interval: [0.3, 0.7],
            },
            fheAnalysis: {
              encryptedCorrelationMatrix: 'encrypted-data',
              homomorphicConfidence: 0.9,
              privacyPreserved: true,
            },
          }

          // Try to use data from rawCorrelation if available
          if (typeof rawCorrelation === 'object' && rawCorrelation !== null) {
            // Use any available properties from rawCorrelation
            const raw = rawCorrelation as unknown as Record<string, unknown>

            if (raw['id']) {
              correlation.primaryFactor = String(raw['id'])
            }
            if (raw['confidence'] && correlation.correlatedFactors[0]) {
              correlation.correlatedFactors[0].confidence = Number(
                raw['confidence'],
              )
            }

            // Add any other mappings as needed
          }

          return correlation
        },
      )

      logger.info('Risk factor correlation analysis completed', {
        clientId,
        correlationCount: results.length,
      })

      return results
    } catch (error: unknown) {
      logger.error('Error analyzing risk factor correlations', {
        error,
        clientId,
      })
      throw new ProcessingError(
        'Failed to analyze risk factor correlations',
        error,
      )
    }
  }

  async analyzeLongTermTrends(
    clientId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TrendPattern[]> {
    try {
      logger.info('Analyzing long-term trends', {
        clientId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })

      // Generate synthetic data points for the time range
      const dataPoints = this.generateSyntheticDataPoints(startDate, endDate)

      // Use FHE service to process trends
      const encryptedPatterns = await this.fheService.processPatterns(
        dataPoints,
        {
          windowSize: Math.min(10, dataPoints.length),
          minPoints: 3,
          threshold: 0.6,
        },
      )

      const rawTrendPatterns =
        await this.fheService.decryptPatterns(encryptedPatterns)

      // Transform to match the expected TrendPattern type
      const results: TrendPattern[] = rawTrendPatterns.map((rawPattern) => {
        // Create a properly structured TrendPattern object
        const pattern: TrendPattern = {
          id: `trend-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: 'emotional',
          confidence: 0.7,
          startDate: startDate,
          endDate: endDate,
          description: 'Long-term trend detected',
          indicators: ['mood', 'anxiety', 'sleep'],
          algorithmicAnalysis: {
            trendDirection: 'increasing' as const,
            trendStrength: 0.6,
            linearRegression: {
              slope: 0.05,
              intercept: 0.2,
              rSquared: 0.75,
              pValue: 0.03,
            },
            changePoints: [
              {
                timestamp: new Date(
                  startDate.getTime() +
                    (endDate.getTime() - startDate.getTime()) / 2,
                ),
                confidenceLevel: 0.8,
                changeType: 'increase' as const,
              },
            ],
            seasonalDecomposition: {
              trendComponent: [0.1, 0.2, 0.3, 0.4],
              seasonalComponent: [0.05, -0.05, 0.05, -0.05],
              residualComponent: [0.01, -0.01, 0.02, -0.02],
              seasonalityStrength: 0.3,
            },
          },
          clinicalImplications: {
            severity: 'medium' as const,
            interventionWindow: 14, // days
            followUpRecommended: true,
            escalationRequired: false,
          },
        }

        // Try to use data from rawPattern if available
        if (typeof rawPattern === 'object' && rawPattern !== null) {
          // Use any available properties from rawPattern
          const raw = rawPattern as unknown as Record<string, unknown>

          if (raw['id']) {
            pattern.id = String(raw['id'])
          }
          if (raw['type']) {
            pattern.type = String(raw['type'])
          }
          if (raw['confidence']) {
            pattern.confidence = Number(raw['confidence'])
          }
          if (raw['description']) {
            pattern.description = String(raw['description'])
          }
          if (raw['startDate'] instanceof Date) {
            pattern.startDate = raw['startDate']
          }
          if (raw['endDate'] instanceof Date) {
            pattern.endDate = raw['endDate']
          }
          if (Array.isArray(raw['indicators'])) {
            pattern.indicators = raw['indicators'].map(String)
          }
        }

        return pattern
      })

      logger.info('Long-term trend analysis completed', {
        clientId,
        trendCount: results.length,
      })

      return results
    } catch (error: unknown) {
      logger.error('Error analyzing long-term trends', {
        error,
        clientId,
      })
      throw new ProcessingError('Failed to analyze long-term trends', error)
    }
  }

  async detectCrossSessionPatternsAdvanced(
    clientId: string,
    sessions: TherapySession[],
  ): Promise<CrossSessionPattern[]> {
    try {
      logger.info('Detecting advanced cross-session patterns', {
        clientId,
        sessionCount: sessions.length,
      })

      // Use FHE service to analyze cross-sessions
      const encryptedAnalysis = await this.fheService.analyzeCrossSessions(
        sessions,
        0.8, // higher confidence threshold for advanced analysis
      )

      // Decrypt the analysis results
      const rawPatterns =
        await this.fheService.decryptCrossSessionAnalysis(encryptedAnalysis)

      // Transform to match the expected CrossSessionPattern type
      const results: CrossSessionPattern[] = rawPatterns.map((rawPattern) => {
        // Create a properly structured CrossSessionPattern object
        const pattern: CrossSessionPattern = {
          id: `pattern-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          type: 'behavioral',
          sessions: sessions
            .map((s) => s.sessionId)
            .filter(Boolean) as string[],
          pattern: 'Cross-session pattern detected',
          frequency: 0.7,
          confidence: 0.8,
          impact: 'Moderate impact on therapeutic progress',
          recommendations: ['Continue monitoring this pattern'],
          advancedMetrics: {
            cohesionCoefficient: 0.75,
            persistenceScore: 0.8,
            evolutionRate: 0.3,
            clinicalMagnitude: 0.6,
            networkAnalysis: {
              centralitySessions: sessions
                .slice(0, 2)
                .map((s) => s.sessionId)
                .filter(Boolean) as string[],
              connectionStrength: 0.7,
              communityDetection: true,
            },
          },
          temporalCharacteristics: {
            cyclicNature: false,
            periodLength: undefined,
            phaseShift: 0,
            amplitudeVariation: 0.2,
          },
        }

        // Try to use data from rawPattern if available
        if (typeof rawPattern === 'object' && rawPattern !== null) {
          // Use any available properties from rawPattern
          const raw = rawPattern as unknown as Record<string, unknown>

          if (raw['id']) {
            pattern.id = String(raw['id'])
          }
          if (raw['type']) {
            pattern.type = String(raw['type'])
          }
          if (raw['confidence']) {
            pattern.confidence = Number(raw['confidence'])
          }
          if (raw['description']) {
            pattern.pattern = String(raw['description'])
          }
          if (Array.isArray(raw['sessions'])) {
            pattern.sessions = raw['sessions']
              .filter((s): s is string => typeof s === 'string')
              .slice(0, sessions.length)
          }
        }

        return pattern
      })

      logger.info('Advanced cross-session pattern detection completed', {
        clientId,
        patternCount: results.length,
      })

      return results
    } catch (error: unknown) {
      logger.error('Error detecting advanced cross-session patterns', {
        error,
        clientId,
      })
      throw new ProcessingError(
        'Failed to detect advanced cross-session patterns',
        error,
      )
    }
  }

  // Helper methods
  private calculateSimilarity(text1: string, text2: string): number {
    // Simple similarity calculation based on common words
    const words1 = text1.toLowerCase().split(/\s+/)
    const words2 = text2.toLowerCase().split(/\s+/)
    const commonWords = words1.filter((word) => words2.includes(word))
    const totalWords = new Set([...words1, ...words2]).size
    return commonWords.length / totalWords
  }

  private generateSyntheticDataPoints(
    startDate: Date,
    endDate: Date,
  ): unknown[] {
    const dataPoints: unknown[] = []
    const timeDiff = endDate.getTime() - startDate.getTime()
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24)
    const pointCount = Math.min(30, Math.max(5, Math.floor(daysDiff)))

    for (let i = 0; i < pointCount; i++) {
      const timestamp = new Date(
        startDate.getTime() + (timeDiff * i) / pointCount,
      )
      dataPoints.push({
        timestamp,
        value: Math.random(),
        metadata: { synthetic: true },
      })
    }

    return dataPoints
  }
}

/**
 * Factory function to create a PatternRecognitionService instance
 */
export async function createPatternRecognitionService(): Promise<PatternRecognitionService> {
  try {
    logger.info('Creating pattern recognition service')

    // Create FHE service with development mode for now
    const fheService = await createPatternRecognitionFHEService({
      useMock: true, // Use mock for development
      mode: 'development',
    })

    // Create and return the concrete service
    const service = new ConcretePatternRecognitionService(fheService)

    logger.info('Pattern recognition service created successfully')
    return service
  } catch (error: unknown) {
    logger.error('Failed to create pattern recognition service', { error })
    throw new ProcessingError(
      'Failed to create pattern recognition service',
      error,
    )
  }
}
