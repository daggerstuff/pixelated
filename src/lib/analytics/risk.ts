/**
 * Risk Scoring Module
 *
 * Production-grade risk assessment system for security breaches.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { SecurityError } from '../security/errors'
import { Cache } from '../cache'
// Import shared types to avoid circular dependencies
import type { BreachSeverity } from './types'

const logger = createBuildSafeLogger('risk-scoring')
const cache = new Cache({ ttl: 3600 }) // 1 hour cache

// Re-export types for backward compatibility
export { BreachSeverity, type RiskAssessmentResult } from './types'

// Lazy import to avoid circular dependency
const getBreachDataService = async () => {
  const { BreachDataService } = await import('./breach')
  return BreachDataService
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  overallScore: number
  factors: Array<{
    name: string
    score: number
    contribution: number
    metadata?: Record<string, unknown>
  }>
  timestamp: Date
  confidence: number
  recommendations: string[]
}

/**
 * Risk factor interface with dynamic scoring
 */
export interface RiskFactor {
  name: string
  weight: number
  score: number
  description: string
  calculateScore: (breach: SecurityBreach) => number | Promise<number>
  metadata?: Record<string, unknown>
}

export interface SecurityBreach {
  id: string
  severity: BreachSeverity
  timestamp: Date
  affectedUsers: string[]
  dataTypes: string[]
  attackVector?: string
  detectionTime: Date
  responseTime: Date
  remediationStatus: 'pending' | 'in_progress' | 'completed'
  description: string
  metadata?: Record<string, unknown>
}

/**
 * Production-grade risk scoring system
 */
// Base risk constant
const BASE_RISK = 0.15

// Dynamic risk factors with scoring logic
const RISK_FACTORS: RiskFactor[] = [
  {
    name: 'data_sensitivity',
    weight: 0.25,
    score: 0,
    description: 'Sensitivity level of compromised data',
    calculateScore: (breach: SecurityBreach): number => {
      const sensitiveTypes = ['phi', 'pii', 'financial', 'credentials']
      const hasHighSensitivity = breach.dataTypes.some((type) =>
        sensitiveTypes.includes(type.toLowerCase()),
      )
      return hasHighSensitivity ? 0.9 : 0.3
    },
  },
  {
    name: 'breach_frequency',
    weight: 0.2,
    score: 0,
    description: 'Frequency of similar breaches',
    calculateScore: async (breach: SecurityBreach): Promise<number> => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const recentBreaches =
        await getBreachDataService().getBreachesSince(thirtyDaysAgo)
      const similarBreaches = recentBreaches.filter(
        (b: SecurityBreach) => b.attackVector === breach.attackVector,
      )
      return Math.min(similarBreaches.length * 0.1, 1)
    },
  },
  {
    name: 'response_time',
    weight: 0.15,
    score: 0,
    description: 'Time to detect and respond to breaches',
    calculateScore: (breach: SecurityBreach): number => {
      const detectionMs =
        breach.detectionTime.getTime() - breach.timestamp.getTime()
      const responseMs =
        breach.responseTime.getTime() - breach.detectionTime.getTime()
      const totalResponseTime = detectionMs + responseMs

      // Score decreases as response time increases
      return Math.max(0, 1 - totalResponseTime / (24 * 60 * 60 * 1000)) // Normalized to 24 hours
    },
  },
  {
    name: 'affected_users',
    weight: 0.15,
    score: 0,
    description: 'Number and type of affected users',
    calculateScore: (breach: SecurityBreach): number => {
      const userCount = breach.affectedUsers.length
      // Logarithmic scaling to handle large numbers
      return Math.min(1, Math.log10(userCount + 1) / 5)
    },
  },
  {
    name: 'attack_sophistication',
    weight: 0.15,
    score: 0,
    description: 'Sophistication level of attack vectors',
    calculateScore: (breach: SecurityBreach): number => {
      const sophisticatedVectors = [
        'zero-day',
        'apt',
        'supply-chain',
        'ransomware',
      ]
      return breach.attackVector &&
        sophisticatedVectors.includes(breach.attackVector.toLowerCase())
        ? 0.9
        : 0.4
    },
  },
  {
    name: 'remediation_effectiveness',
    weight: 0.1,
    score: 0,
    description: 'Effectiveness of remediation measures',
    calculateScore: (breach: SecurityBreach): number => {
      const scores = {
        pending: 1,
        in_progress: 0.6,
        completed: 0.2,
      }
      return scores[breach.remediationStatus]
    },
  },
]

/**
 * Calculates overall risk score based on breach data
 *
 * @param breaches Array of security breaches to analyze
 * @returns Detailed risk assessment
 * @throws {SecurityError} If risk calculation fails
 */
export async function calculateOverallRisk(
  breaches: SecurityBreach[],
): Promise<RiskAssessment> {
  try {
    logger.info('Calculating overall risk score', {
      breachCount: breaches.length,
    })

    // Input validation
    if (!Array.isArray(breaches)) {
      throw new SecurityError('Invalid input: breaches must be an array')
    }

    // Check cache first
    const cacheKey = generateCacheKey(breaches)
    const cachedResult = await cache.get<RiskAssessment>(cacheKey)
    if (cachedResult) {
      logger.debug('Returning cached risk assessment')
      return cachedResult
    }

    // Base risk level
    let overallScore = BASE_RISK
    const factorResults = []

    // Calculate individual factor scores
    for (const factor of RISK_FACTORS) {
      try {
        // Handle both synchronous and asynchronous score calculations
        const scores = await Promise.all(
          breaches.map((breach) =>
            Promise.resolve(factor.calculateScore(breach)),
          ),
        )

        const avgScore =
          scores.reduce((sum, score) => sum + score, 0) / scores.length
        factor.score = avgScore

        const contribution = factor.weight * avgScore
        overallScore += contribution

        const factorResult: {
          name: string
          score: number
          contribution: number
          metadata?: Record<string, unknown>
        } = {
          name: factor.name,
          score: avgScore,
          contribution,
        }
        if (factor.metadata !== undefined) {
          factorResult.metadata = factor.metadata
        }
        factorResults.push(factorResult)
      } catch (error: unknown) {
        logger.error('Error calculating factor score', {
          factor: factor.name,
          error,
        })
        // Continue with other factors
      }
    }

    // Ensure score is between 0 and 1
    overallScore = Math.min(1, Math.max(0, overallScore))

    // Generate recommendations based on highest risk factors
    const recommendations = generateRecommendations(factorResults)

    // Calculate confidence score based on data quality
    const confidence = calculateConfidence(breaches, factorResults)

    const assessment: RiskAssessment = {
      overallScore,
      factors: factorResults,
      timestamp: new Date(),
      confidence,
      recommendations,
    }

    // Cache the result
    await cache.set(cacheKey, assessment)

    logger.info('Risk assessment completed', {
      score: overallScore,
      confidence,
      recommendationCount: recommendations.length,
    })

    return assessment
  } catch (error: unknown) {
    logger.error('Failed to calculate risk score', { error })
    throw new SecurityError('Risk calculation failed', { cause: error })
  }
}

/**
 * Calculates daily risk score with higher weight for recent events
 *
 * @param breaches Array of breach objects for a specific day
 * @returns Daily risk assessment
 */
export async function calculateDailyRisk(
  breaches: SecurityBreach[],
): Promise<RiskAssessment> {
  const assessment = await calculateOverallRisk(breaches)

  // Apply recency bias
  const now = Date.now()
  const recencyMultiplier =
    breaches.reduce((acc, breach) => {
      const age = now - breach.timestamp.getTime()
      return acc + (1 - Math.min(age / (24 * 60 * 60 * 1000), 1)) // Higher weight for newer breaches
    }, 1) / breaches.length

  assessment.overallScore = Math.min(
    1,
    assessment.overallScore * recencyMultiplier,
  )
  return assessment
}

/**
 * Returns current risk factors with their weights and scores
 *
 * @returns Array of risk factors
 */
export async function getFactors(): Promise<RiskFactor[]> {
  return RISK_FACTORS.map((factor) => ({
    ...factor,
    // Remove the function reference for external API
    calculateScore: undefined as unknown as (breach: SecurityBreach) => number,
  }))
}

/**
 * Generates cache key for breach array
 */
function generateCacheKey(breaches: SecurityBreach[]): string {
  return `risk_score:${breaches
    .map((b) => b.id)
    .sort()
    .join(':')}`
}

/**
 * Generates recommendations based on risk factors
 */
function generateRecommendations(
  factorResults: Array<{ name: string; score: number; contribution: number }>,
): string[] {
  const recommendations: string[] = []
  const highRiskFactors = factorResults
    .filter((f) => f.score > 0.7)
    .sort((a, b) => b.contribution - a.contribution)

  for (const factor of highRiskFactors) {
    switch (factor.name) {
      case 'data_sensitivity':
        recommendations.push(
          'Implement additional encryption for sensitive data',
        )
        recommendations.push('Review data classification policies')
        break
      case 'breach_frequency':
        recommendations.push('Conduct thorough attack pattern analysis')
        recommendations.push('Enhance monitoring for similar attack vectors')
        break
      case 'response_time':
        recommendations.push('Improve incident response procedures')
        recommendations.push('Implement automated detection systems')
        break
      case 'attack_sophistication':
        recommendations.push('Enhance threat detection capabilities')
        recommendations.push('Update security controls for advanced threats')
        break
      case 'affected_users':
        recommendations.push('Review access control policies')
        recommendations.push('Implement additional user monitoring')
        break
      case 'remediation_effectiveness':
        recommendations.push('Streamline incident response workflow')
        recommendations.push('Enhance remediation automation')
        break
    }
  }

  return recommendations
}

/**
 * Calculates confidence score for the risk assessment
 */
function calculateConfidence(
  breaches: SecurityBreach[],
  factorResults: Array<{ name: string; score: number }>,
): number {
  let confidence = 1.0

  // Reduce confidence if we have incomplete data
  const hasIncompleteData = breaches.some(
    (breach) => !breach.attackVector || !breach.dataTypes.length,
  )
  if (hasIncompleteData) {
    confidence *= 0.8
  }

  // Reduce confidence if we have high variance in factor scores
  const scores = factorResults.map((f) => f.score)
  const variance = calculateVariance(scores)
  if (variance > 0.3) {
    confidence *= 0.9
  }

  // Reduce confidence for small sample sizes
  if (breaches.length < 5) {
    confidence *= 0.7
  }

  return Math.max(0.1, confidence)
}

/**
 * Calculates variance of an array of numbers
 */
function calculateVariance(numbers: number[]): number {
  // Handle edge cases up front
  if (numbers.length === 0) {
    return 0
  }

  if (numbers.length === 1) {
    return 0
  }

  const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length

  // Calculate variance in a single pass to avoid creating intermediate arrays
  return (
    numbers.reduce((sum, num) => {
      const diff = num - mean
      return sum + diff * diff
    }, 0) / numbers.length
  )
}
