/**
 * Statistical Analysis Module
 *
 * Provides statistical analysis capabilities for security breach data.
 */

/**
 * Namespace for statistical analysis operations
 */
export const StatisticalAnalysis = {
  /**
   * Calculates the trend in a time series of data points
   *
   * @param dataPoints Array of numeric data points
   * @returns Trend coefficient (positive = increasing, negative = decreasing, near zero = stable)
   */
  calculateTrend(dataPoints: number[]): number {
    // Mock implementation of a simple linear regression slope
    if (!dataPoints || dataPoints.length < 2) {
      return 0
    }

    const n = dataPoints.length

    // Calculate x values (just the indices)
    const xValues = Array.from({ length: n }, (_, i) => i)

    // Calculate means
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n
    const yMean = dataPoints.reduce((sum, y) => sum + y, 0) / n

    // Calculate slope using least squares method
    let numerator = 0
    let denominator = 0

    for (let i = 0; i < n; i++) {
      const xDiff = xValues[i] - xMean
      const yDiff = dataPoints[i] - yMean

      numerator += xDiff * yDiff
      denominator += xDiff * xDiff
    }

    // Avoid division by zero
    if (denominator === 0) {
      return 0
    }

    // Return slope (normalized to -1 to 1 range)
    const slope = numerator / denominator

    // Normalize by dividing by mean (if mean is not zero)
    return yMean !== 0 ? slope / Math.abs(yMean) : slope
  },

  /**
   * Calculates a moving average of data points
   *
   * @param dataPoints Array of numeric data points
   * @param windowSize Size of the moving window
   * @returns Array of moving averages
   */
  calculateMovingAverage(
    dataPoints: number[],
    windowSize: number = 3,
  ): number[] {
    if (!dataPoints || dataPoints.length === 0) {
      return []
    }
    if (windowSize <= 1 || windowSize > dataPoints.length) {
      windowSize = Math.min(3, dataPoints.length)
    }

    const result: number[] = []

    for (let i = 0; i <= dataPoints.length - windowSize; i++) {
      const window = dataPoints.slice(i, i + windowSize)
      const avg = window.reduce((sum, val) => sum + val, 0) / windowSize
      result.push(avg)
    }

    return result
  },
}
