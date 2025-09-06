/**
 * Security Trends Module
 *
 * Analyzes security trends over time for predictive insights.
 */

// Trend directions
export const TREND_INCREASING = 'increasing'
export const TREND_DECREASING = 'decreasing'
export const TREND_STABLE = 'stable'

/**
 * Analyzes trend directions for risk factors
 *
 * @param factors Array of risk factors to analyze
 * @returns Array of trend directions ('increasing', 'decreasing', 'stable')
 */
export async function analyze(
  factors: Array<{ name: string; weight: number; score: number }>,
): Promise<Array<'increasing' | 'decreasing' | 'stable'>> {
  // Mock implementation
  return factors.map((factor) => {
    // Generate a deterministic trend based on factor name and score
    // In a real implementation, this would analyze historical data
    const hash = hashString(factor.name)
    const baseValue = (hash % 3) - 1 // -1, 0, or 1

    // Use score to influence the trend
    const scoreInfluence = factor.score > 0.7 ? 1 : factor.score < 0.3 ? -1 : 0

    // Combined influence
    const trendValue = baseValue + scoreInfluence

    // Convert to trend direction
    if (trendValue > 0) {
      return TREND_INCREASING
    }
    if (trendValue < 0) {
      return TREND_DECREASING
    }
    return TREND_STABLE
  })
}

/**
 * Helper function to generate a simple hash value from a string
 * Used to create deterministic but seemingly random trends
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash &= hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Calculates seasonal patterns in security incidents
 *
 * @param timePoints Array of incident timestamps
 * @returns Object with detected seasonal patterns
 */
export function detectSeasonalPatterns(timePoints: number[]): {
  daily: boolean
  weekly: boolean
  monthly: boolean
  confidence: number
} {
  // Mock implementation
  // In a real implementation, this would use Fourier transform or similar techniques
  return {
    daily: timePoints.length > 30,
    weekly: timePoints.length > 60,
    monthly: timePoints.length > 180,
    confidence: timePoints.length > 90 ? 0.8 : 0.5,
  }
}
