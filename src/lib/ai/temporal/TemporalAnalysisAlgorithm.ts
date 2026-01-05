/**
 * Temporal Analysis Algorithm
 * Analyzes multidimensional emotion patterns and trends over time
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  EmotionAnalysis,
  DimensionalMap,
  MultidimensionalPattern,
  EmotionStatistics,
  EmotionDimensions,
} from '../emotions/types'

const logger = createBuildSafeLogger('temporal-analysis-algorithm')

/**
 * Analyze multidimensional patterns in emotion data over time
 */
export function analyzeMultidimensionalPatterns(
  emotionData: EmotionAnalysis[],
  dimensionalMaps: DimensionalMap[],
): MultidimensionalPattern[] {
  logger.info('Analyzing multidimensional patterns', {
    dataPoints: emotionData.length,
    dimensionalMaps: dimensionalMaps.length,
  })

  const patterns: MultidimensionalPattern[] = []

  // Ensure we have enough data for analysis
  if (dimensionalMaps.length < 3) {
    logger.warn('Insufficient data for pattern analysis', {
      required: 3,
      actual: dimensionalMaps.length,
    })
    return patterns
  }

  // Sort by timestamp to ensure chronological order
  const sortedMaps = [...dimensionalMaps].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  // Analyze different pattern types
  patterns.push(...detectTrends(sortedMaps))
  patterns.push(...detectCycles(sortedMaps))
  patterns.push(...detectShifts(sortedMaps))
  patterns.push(...detectStability(sortedMaps))

  // Filter out low-confidence patterns
  const filteredPatterns = patterns.filter(
    (pattern) => pattern.confidence > 0.5,
  )

  logger.info('Pattern analysis complete', {
    totalPatterns: patterns.length,
    filteredPatterns: filteredPatterns.length,
  })

  return filteredPatterns
}

/**
 * Detect trending patterns in dimensional data
 */
function detectTrends(maps: DimensionalMap[]): MultidimensionalPattern[] {
  const trends: MultidimensionalPattern[] = []
  const windowSize = Math.min(10, Math.floor(maps.length / 3))

  if (windowSize < 3) {
    return trends
  }

  for (let i = 0; i <= maps.length - windowSize; i++) {
    const window = maps.slice(i, i + windowSize)

    // Calculate trend slopes for each dimension
    const valenceTrend = calculateTrendSlope(window, 'valence')
    const arousalTrend = calculateTrendSlope(window, 'arousal')
    const dominanceTrend = calculateTrendSlope(window, 'dominance')

    // Check if any dimension shows significant trend
    const significantThreshold = 0.1
    const hasSignificantTrend =
      Math.abs(valenceTrend) > significantThreshold ||
      Math.abs(arousalTrend) > significantThreshold ||
      Math.abs(dominanceTrend) > significantThreshold

    if (hasSignificantTrend) {
      const confidence = calculateTrendConfidence(window)

      trends.push({
        id: `trend-${i}-${Date.now()}`,
        type: 'trend',
        timeRange: {
          start: window[0].timestamp,
          end: window[window.length - 1].timestamp,
        },
        description: describeTrend(valenceTrend, arousalTrend, dominanceTrend),
        dimensions: window.map((w) => w.dimensions),
        confidence,
        significance: Math.max(
          Math.abs(valenceTrend),
          Math.abs(arousalTrend),
          Math.abs(dominanceTrend),
        ),
      })
    }
  }

  return trends
}

/**
 * Detect cyclical patterns
 */
function detectCycles(maps: DimensionalMap[]): MultidimensionalPattern[] {
  const cycles: MultidimensionalPattern[] = []

  // Look for periodic patterns using autocorrelation
  const minCycleLength = 4
  const maxCycleLength = Math.floor(maps.length / 3)

  for (
    let cycleLength = minCycleLength;
    cycleLength <= maxCycleLength;
    cycleLength++
  ) {
    const correlation = calculateAutocorrelation(maps, cycleLength)

    if (correlation > 0.6) {
      // Strong correlation threshold
      cycles.push({
        id: `cycle-${cycleLength}-${Date.now()}`,
        type: 'cycle',
        timeRange: {
          start: maps[0].timestamp,
          end: maps[maps.length - 1].timestamp,
        },
        description: `Cyclical pattern with period of ${cycleLength} data points`,
        dimensions: maps.map((m) => m.dimensions),
        confidence: correlation,
        significance: correlation,
      })
    }
  }

  return cycles
}

/**
 * Detect sudden shifts or transitions
 */
function detectShifts(maps: DimensionalMap[]): MultidimensionalPattern[] {
  const shifts: MultidimensionalPattern[] = []
  const changeThreshold = 0.5 // Minimum change to consider a shift

  for (let i = 1; i < maps.length - 1; i++) {
    const prev = maps[i - 1]?.dimensions
    const curr = maps[i]?.dimensions
    const next = maps[i + 1]?.dimensions

    if (!prev || !curr || !next) {
      continue
    }

    // Calculate magnitude of change
    const changeMagnitude = calculateDimensionalDistance(prev, curr)

    // Check if change is sustained (not just noise)
    const nextChangeMagnitude = calculateDimensionalDistance(curr, next)
    const isSustained = nextChangeMagnitude < changeMagnitude * 0.5

    if (changeMagnitude > changeThreshold && isSustained) {
      shifts.push({
        id: `shift-${i}-${Date.now()}`,
        type: 'shift',
        timeRange: {
          start: maps[i - 1].timestamp,
          end: maps[i + 1].timestamp,
        },
        description: describeShift(prev, curr),
        dimensions: [prev, curr, next],
        confidence: Math.min(changeMagnitude / changeThreshold, 1),
        significance: changeMagnitude,
      })
    }
  }

  return shifts
}

/**
 * Detect stability periods
 */
function detectStability(maps: DimensionalMap[]): MultidimensionalPattern[] {
  const stablePatterns: MultidimensionalPattern[] = []
  const stabilityThreshold = 0.2
  const minStabilityLength = 5

  let stableStart = 0
  let isStable = true

  for (let i = 1; i < maps.length; i++) {
    const prevMap = maps[i - 1]
    const currMap = maps[i]
    if (!prevMap?.dimensions || !currMap?.dimensions) {
      continue
    }

    const change = calculateDimensionalDistance(
      prevMap.dimensions,
      currMap.dimensions,
    )

    if (change > stabilityThreshold) {
      // End of stable period
      if (isStable && i - stableStart >= minStabilityLength) {
        const stableWindow = maps.slice(stableStart, i)
        const firstWindow = stableWindow[0]
        const lastWindow = stableWindow[stableWindow.length - 1]
        if (firstWindow && lastWindow) {
          stablePatterns.push({
            id: `stability-${stableStart}-${Date.now()}`,
            type: 'stability',
            timeRange: {
              start: firstWindow.timestamp,
              end: lastWindow.timestamp,
            },
            description: 'Stable emotional state period',
            dimensions: stableWindow.map((w) => w.dimensions),
            confidence: calculateStabilityConfidence(stableWindow),
            significance: i - stableStart,
          })
        }
      }
      stableStart = i
      isStable = false
    } else {
      isStable = true
    }
  }

  return stablePatterns
}

/**
 * Calculate trend slope for a dimension
 */
function calculateTrendSlope(
  window: DimensionalMap[],
  dimension: keyof EmotionDimensions,
): number {
  if (window.length < 2) {
    return 0
  }

  const values = window.map((w) => w.dimensions[dimension])
  const n = values.length

  // Simple linear regression slope calculation
  const sumX = (n * (n - 1)) / 2 // Sum of indices 0, 1, 2, ...
  const sumY = values.reduce((sum, val) => sum + val, 0)
  const sumXY = values.reduce((sum, val, idx) => sum + idx * val, 0)
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6 // Sum of squares

  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
}

/**
 * Calculate autocorrelation for cycle detection
 */
function calculateAutocorrelation(maps: DimensionalMap[], lag: number): number {
  if (maps.length <= lag) {
    return 0
  }

  const values = maps.map(
    (m) =>
      (m.dimensions.valence + m.dimensions.arousal + m.dimensions.dominance) /
      3,
  )

  const n = values.length - lag
  let correlation = 0

  for (let i = 0; i < n; i++) {
    const value = values[i]
    const lagValue = values[i + lag]
    if (value !== undefined && lagValue !== undefined) {
      correlation += value * lagValue
    }
  }

  return correlation / n
}

/**
 * Calculate Euclidean distance between two dimensional points
 */
function calculateDimensionalDistance(
  dim1: EmotionDimensions,
  dim2: EmotionDimensions,
): number {
  const valenceDiff = dim1.valence - dim2.valence
  const arousalDiff = dim1.arousal - dim2.arousal
  const dominanceDiff = dim1.dominance - dim2.dominance

  return Math.sqrt(valenceDiff ** 2 + arousalDiff ** 2 + dominanceDiff ** 2)
}

/**
 * Calculate confidence for trend patterns
 */
function calculateTrendConfidence(window: DimensionalMap[]): number {
  // R-squared calculation for trend confidence
  const values = window.map(
    (w) =>
      (w.dimensions.valence + w.dimensions.arousal + w.dimensions.dominance) /
      3,
  )

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const totalVariance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0)

  if (totalVariance === 0) {
    return 0
  }

  // Simple linear regression
  const n = values.length
  const sumX = (n * (n - 1)) / 2
  const sumY = values.reduce((sum, val) => sum + val, 0)
  const sumXY = values.reduce((sum, val, idx) => sum + idx * val, 0)
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  const residualVariance = values.reduce((sum, val, idx) => {
    const predicted = slope * idx + intercept
    return sum + (val - predicted) ** 2
  }, 0)

  return Math.max(0, 1 - residualVariance / totalVariance)
}

/**
 * Calculate stability confidence
 */
function calculateStabilityConfidence(window: DimensionalMap[]): number {
  if (window.length < 2) {
    return 0
  }

  const changes = []
  for (let i = 1; i < window.length; i++) {
    changes.push(
      calculateDimensionalDistance(
        window[i - 1].dimensions,
        window[i].dimensions,
      ),
    )
  }

  const avgChange =
    changes.reduce((sum, change) => sum + change, 0) / changes.length
  return Math.max(0, 1 - avgChange * 2) // Inverse relationship with average change
}

/**
 * Describe trend pattern
 */
function describeTrend(
  valenceTrend: number,
  arousalTrend: number,
  dominanceTrend: number,
): string {
  const descriptions = []

  if (Math.abs(valenceTrend) > 0.1) {
    descriptions.push(
      `${valenceTrend > 0 ? 'Improving' : 'Declining'} emotional valence`,
    )
  }
  if (Math.abs(arousalTrend) > 0.1) {
    descriptions.push(
      `${arousalTrend > 0 ? 'Increasing' : 'Decreasing'} emotional arousal`,
    )
  }
  if (Math.abs(dominanceTrend) > 0.1) {
    descriptions.push(
      `${dominanceTrend > 0 ? 'Gaining' : 'Losing'} emotional control`,
    )
  }

  return descriptions.length > 0
    ? descriptions.join(', ')
    : 'Subtle emotional trend'
}

/**
 * Describe shift pattern
 */
function describeShift(from: EmotionDimensions, to: EmotionDimensions): string {
  const valenceDiff = to.valence - from.valence
  const arousalDiff = to.arousal - from.arousal
  const dominanceDiff = to.dominance - from.dominance

  const changes = []

  if (Math.abs(valenceDiff) > 0.3) {
    changes.push(
      `Shift to ${valenceDiff > 0 ? 'more positive' : 'more negative'} emotions`,
    )
  }
  if (Math.abs(arousalDiff) > 0.3) {
    changes.push(
      `${arousalDiff > 0 ? 'Increased' : 'Decreased'} emotional intensity`,
    )
  }
  if (Math.abs(dominanceDiff) > 0.3) {
    changes.push(
      `Shift to ${dominanceDiff > 0 ? 'more' : 'less'} emotional control`,
    )
  }

  return changes.length > 0
    ? changes.join(', ')
    : 'Sudden emotional state change'
}

/**
 * Calculate comprehensive emotion statistics
 */
export function calculateEmotionStatistics(
  emotionData: EmotionAnalysis[],
): EmotionStatistics {
  if (emotionData.length === 0) {
    throw new Error('Cannot calculate statistics for empty emotion data')
  }

  const dimensions = emotionData.map((e) => e.dimensions)

  // Calculate means
  const mean: EmotionDimensions = {
    valence:
      dimensions.reduce((sum, d) => sum + d.valence, 0) / dimensions.length,
    arousal:
      dimensions.reduce((sum, d) => sum + d.arousal, 0) / dimensions.length,
    dominance:
      dimensions.reduce((sum, d) => sum + d.dominance, 0) / dimensions.length,
  }

  // Calculate variances
  const variance: EmotionDimensions = {
    valence:
      dimensions.reduce((sum, d) => sum + (d.valence - mean.valence) ** 2, 0) /
      dimensions.length,
    arousal:
      dimensions.reduce((sum, d) => sum + (d.arousal - mean.arousal) ** 2, 0) /
      dimensions.length,
    dominance:
      dimensions.reduce(
        (sum, d) => sum + (d.dominance - mean.dominance) ** 2,
        0,
      ) / dimensions.length,
  }

  // Calculate trends (using first and last quarters)
  const quarterSize = Math.floor(dimensions.length / 4)
  const firstQuarter = dimensions.slice(0, quarterSize)
  const lastQuarter = dimensions.slice(-quarterSize)

  const firstMean = {
    valence:
      firstQuarter.reduce((sum, d) => sum + d.valence, 0) / firstQuarter.length,
    arousal:
      firstQuarter.reduce((sum, d) => sum + d.arousal, 0) / firstQuarter.length,
    dominance:
      firstQuarter.reduce((sum, d) => sum + d.dominance, 0) /
      firstQuarter.length,
  }

  const lastMean = {
    valence:
      lastQuarter.reduce((sum, d) => sum + d.valence, 0) / lastQuarter.length,
    arousal:
      lastQuarter.reduce((sum, d) => sum + d.arousal, 0) / lastQuarter.length,
    dominance:
      lastQuarter.reduce((sum, d) => sum + d.dominance, 0) / lastQuarter.length,
  }

  const trend: EmotionDimensions = {
    valence: lastMean.valence - firstMean.valence,
    arousal: lastMean.arousal - firstMean.arousal,
    dominance: lastMean.dominance - firstMean.dominance,
  }

  // Calculate stability (inverse of average variance)
  const stability =
    1 / (1 + (variance.valence + variance.arousal + variance.dominance) / 3)

  // Calculate volatility (average change between consecutive points)
  let totalChange = 0
  for (let i = 1; i < dimensions.length; i++) {
    totalChange += calculateDimensionalDistance(
      dimensions[i - 1],
      dimensions[i],
    )
  }
  const volatility = totalChange / (dimensions.length - 1)

  return {
    mean,
    variance,
    trend,
    stability,
    volatility,
  }
}
