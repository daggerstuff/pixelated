import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import {
  CorrelationAlgorithm,
  GlobalThreatIntelligence,
  RealTimeThreatData,
  ThreatIndicator,
  TimeWindow,
} from '../global/types'

const logger = createBuildSafeLogger('threat-correlation-engine')

export async function calculateSimilarityScore(
  threat1: GlobalThreatIntelligence,
  threat2: GlobalThreatIntelligence,
): Promise<number> {
  try {
    let totalScore = 0
    let weightSum = 0

    // Compare indicators (40% weight)
    const indicatorScore = await compareIndicators(
      threat1.indicators,
      threat2.indicators,
    )
    totalScore += indicatorScore * 0.4
    weightSum += 0.4

    // Compare severity (20% weight)
    const severityScore = compareSeverity(
      threat1.severity,
      threat2.severity,
    )
    totalScore += severityScore * 0.2
    weightSum += 0.2

    // Compare regions (15% weight)
    const regionScore = compareRegions(threat1.regions, threat2.regions)
    totalScore += regionScore * 0.15
    weightSum += 0.15

    // Compare timing (15% weight)
    const timingScore = compareTiming(
      threat1.firstSeen,
      threat2.firstSeen,
    )
    totalScore += timingScore * 0.15
    weightSum += 0.15

    // Compare attribution (10% weight)
    if (threat1.attribution && threat2.attribution) {
      const attributionScore = compareAttribution(
        threat1.attribution,
        threat2.attribution,
      )
      totalScore += attributionScore * 0.1
      weightSum += 0.1
    }

    // Normalize score
    return weightSum > 0 ? totalScore / weightSum : 0
  } catch (error: unknown) {
    logger.error('Failed to calculate similarity score:', { error })
    return 0
  }
}

export async function compareIndicators(
  indicators1: ThreatIndicator[],
  indicators2: ThreatIndicator[],
): Promise<number> {
  try {
    if (indicators1.length === 0 || indicators2.length === 0) {
      return 0
    }

    let matchingIndicators = 0
    let totalComparisons = 0

    // Compare each indicator from first threat with indicators from second threat
    for (const indicator1 of indicators1) {
      for (const indicator2 of indicators2) {
        totalComparisons++

        // Check if indicators are of the same type and have similar values
        if (indicator1.indicatorType === indicator2.indicatorType) {
          const valueSimilarity = calculateValueSimilarity(
            indicator1.value,
            indicator2.value,
          )

          if (valueSimilarity > 0.7) {
            // Threshold for considering indicators similar
            matchingIndicators++
          }
        }
      }
    }

    return totalComparisons > 0 ? matchingIndicators / totalComparisons : 0
  } catch (error: unknown) {
    logger.error('Failed to compare indicators:', { error })
    return 0
  }
}

export function calculateValueSimilarity(value1: string, value2: string): number {
  // Simple string similarity using Levenshtein distance
  const distance = levenshteinDistance(
    value1.toLowerCase(),
    value2.toLowerCase(),
  )
  const maxLength = Math.max(value1.length, value2.length)

  return maxLength > 0 ? 1 - distance / maxLength : 0
}

export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]!
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

export function compareSeverity(severity1: string, severity2: string): number {
  const severityOrder: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }
  const score1 = severityOrder[severity1] ?? 1
  const score2 = severityOrder[severity2] ?? 1

  // Similarity decreases as the difference increases
  const difference = Math.abs(score1 - score2)
  return Math.max(0, 1 - difference / 3)
}

export function compareRegions(regions1: string[], regions2: string[]): number {
  if (regions1.length === 0 || regions2.length === 0) {
    return 0
  }

  const intersection = regions1.filter((region) => regions2.includes(region))
  const union = [...new Set([...regions1, ...regions2])]

  return union.length > 0 ? intersection.length / union.length : 0
}

export function compareTiming(time1: Date, time2: Date): number {
  const timeDiff = Math.abs(time1.getTime() - time2.getTime())
  const hoursDiff = timeDiff / (1000 * 60 * 60)

  // Consider threats within 24 hours as potentially related
  if (hoursDiff <= 24) {
    return Math.max(0, 1 - hoursDiff / 24)
  }

  return 0
}

export function compareAttribution(
  attribution1: unknown,
  attribution2: unknown,
): number {
  let score = 0
  let factors = 0

  // Type guard to check if attribution has the expected structure
  const isValidAttribution = (
    attribution: unknown,
  ): attribution is {
    actor?: string
    campaign?: string
    family?: string
  } => {
    return typeof attribution === 'object' && attribution !== null
  }

  if (isValidAttribution(attribution1) && isValidAttribution(attribution2)) {
    if (attribution1.actor && attribution2.actor) {
      factors++
      score += attribution1.actor === attribution2.actor ? 1 : 0
    }

    if (attribution1.campaign && attribution2.campaign) {
      factors++
      score += attribution1.campaign === attribution2.campaign ? 1 : 0
    }

    if (attribution1.family && attribution2.family) {
      factors++
      score += attribution1.family === attribution2.family ? 1 : 0
    }
  }

  return factors > 0 ? score / factors : 0
}

export async function determineCorrelationType(
  threat1: GlobalThreatIntelligence,
  threat2: GlobalThreatIntelligence,
  similarityScore: number,
): Promise<string> {
  try {
    // Analyze different aspects to determine correlation type

    if (similarityScore < 0.3) {
      return 'weak'
    }

    // Check for temporal correlation
    const timeDiff = Math.abs(
      threat1.firstSeen.getTime() - threat2.firstSeen.getTime(),
    )
    const isTemporal = timeDiff < 24 * 60 * 60 * 1000 // Within 24 hours

    // Check for spatial correlation
    const commonRegions = threat1.regions.filter((region) =>
      threat2.regions.includes(region),
    )
    const isSpatial = commonRegions.length > 0

    // Check for behavioral correlation (similar indicators)
    const similarIndicators = await countSimilarIndicators(
      threat1.indicators,
      threat2.indicators,
    )
    const isBehavioral = similarIndicators > 2

    // Check for attribution correlation
    const isAttribution = hasSimilarAttribution(
      threat1.attribution,
      threat2.attribution,
    )

    // Determine primary correlation type
    if (isAttribution && similarityScore > 0.7) {
      return 'attribution'
    } else if (isBehavioral && similarityScore > 0.6) {
      return 'behavioral'
    } else if (isSpatial && similarityScore > 0.5) {
      return 'spatial'
    } else if (isTemporal && similarityScore > 0.4) {
      return 'temporal'
    } else {
      return 'general'
    }
  } catch (error: unknown) {
    logger.error('Failed to determine correlation type:', { error })
    return 'unknown'
  }
}

export async function countSimilarIndicators(
  indicators1: ThreatIndicator[],
  indicators2: ThreatIndicator[],
): Promise<number> {
  let count = 0

  for (const indicator1 of indicators1) {
    for (const indicator2 of indicators2) {
      if (indicator1.indicatorType === indicator2.indicatorType) {
        const similarity = calculateValueSimilarity(
          indicator1.value,
          indicator2.value,
        )
        if (similarity > 0.7) {
          count++
        }
      }
    }
  }

  return count
}

export function hasSimilarAttribution(
  attribution1: unknown,
  attribution2: unknown,
): boolean {
  if (!attribution1 || !attribution2) {
    return false
  }

  // Type guard to check if attribution has the expected structure
  const isValidAttribution = (
    attribution: unknown,
  ): attribution is {
    actor?: string
    campaign?: string
    family?: string
  } => {
    return typeof attribution === 'object' && attribution !== null
  }

  if (
    !isValidAttribution(attribution1) ||
    !isValidAttribution(attribution2)
  ) {
    return false
  }

  return !!(
    (attribution1.actor &&
      attribution2.actor &&
      attribution1.actor === attribution2.actor) ??
    (attribution1.campaign &&
      attribution2.campaign &&
      attribution1.campaign === attribution2.campaign) ??
    (attribution1.family &&
      attribution2.family &&
      attribution1.family === attribution2.family)
  )
}

export async function calculateCorrelationConfidence(
  threat1: GlobalThreatIntelligence,
  threat2: GlobalThreatIntelligence,
  similarityScore: number,
): Promise<number> {
  try {
    // Base confidence on similarity score
    let confidence = similarityScore

    // Adjust based on data quality
    const qualityFactor = Math.min(threat1.confidence, threat2.confidence)
    confidence *= qualityFactor

    // Adjust based on number of indicators
    const indicatorFactor = Math.min(
      threat1.indicators.length / 10,
      threat2.indicators.length / 10,
      1,
    )
    confidence *= 0.8 + 0.2 * indicatorFactor

    // Adjust based on regional spread
    const regionFactor = calculateRegionalSpreadFactor(
      threat1.regions,
      threat2.regions,
    )
    confidence *= regionFactor

    return Math.min(confidence, 1)
  } catch (error: unknown) {
    logger.error('Failed to calculate correlation confidence:', { error })
    return similarityScore * 0.8 // Fallback confidence
  }
}

export function calculateRegionalSpreadFactor(
  regions1: string[],
  regions2: string[],
): number {
  const allRegions = [...new Set([...regions1, ...regions2])]

  // More regions generally mean higher confidence in correlation
  if (allRegions.length >= 3) return 1.0
  if (allRegions.length === 2) return 0.9
  return 0.7 // Single region
}

export function getDefaultTimeWindow(): TimeWindow {
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  return {
    start: twentyFourHoursAgo,
    end: now,
  }
}

export async function calculateThreatSimilarity(
  threatData: RealTimeThreatData,
  existingThreat: GlobalThreatIntelligence,
): Promise<number> {
  try {
    let score = 0
    let weights = 0

    // Compare severity
    const dataSeverity = mapSeverityToLevel(threatData.severity)
    const existingSeverity = existingThreat.severity
    const severityScore = compareSeverity(dataSeverity, existingSeverity)
    score += severityScore * 0.3
    weights += 0.3

    // Compare regions
    const regionScore = existingThreat.regions.includes(threatData.region)
      ? 1
      : 0
    score += regionScore * 0.2
    weights += 0.2

    // Compare indicators
    const dataIndicators = threatData.indicators.map((i) => ({
      indicatorType: i.indicatorType,
      value: i.value,
    })) as ThreatIndicator[]

    const indicatorScore = await compareIndicators(
      dataIndicators,
      existingThreat.indicators,
    )
    score += indicatorScore * 0.4
    weights += 0.4

    // Compare timing
    const timingScore = compareTiming(
      threatData.timestamp,
      existingThreat.firstSeen,
    )
    score += timingScore * 0.1
    weights += 0.1

    return weights > 0 ? score / weights : 0
  } catch (error: unknown) {
    logger.error('Failed to calculate threat similarity:', { error })
    return 0
  }
}

export function mapSeverityToLevel(
  severity: number,
): 'low' | 'medium' | 'high' | 'critical' {
  if (severity >= 0.8) return 'critical'
  if (severity >= 0.6) return 'high'
  if (severity >= 0.4) return 'medium'
  return 'low'
}

export function validateAlgorithm(algorithm: CorrelationAlgorithm): void {
  if (!algorithm.algorithmId || !algorithm.algorithmType) {
    throw new Error('Algorithm ID and type are required')
  }

  if (
    !['graph', 'statistical', 'ml', 'rule_based'].includes(
      algorithm.algorithmType,
    )
  ) {
    throw new Error('Invalid algorithm type')
  }

  if (
    algorithm.performance.accuracy < 0 ||
    algorithm.performance.accuracy > 1
  ) {
    throw new Error('Algorithm accuracy must be between 0 and 1')
  }
}

export function mapCorrelationTypeToPatternType(correlationType: string): string {
  const mapping: Record<string, string> = {
    temporal: 'temporal',
    spatial: 'spatial',
    behavioral: 'behavioral',
    attribution: 'attribution',
    temporal_spatial: 'spatial',
    strong_multi_factor: 'behavioral',
  }

  return mapping[correlationType] ?? 'general'
}
