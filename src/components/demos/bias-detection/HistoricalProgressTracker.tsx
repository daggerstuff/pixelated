// Historical progress tracking dashboard component

import type { FC } from 'react'
import type { HistoricalComparison } from '../../../lib/types/bias-detection'

interface HistoricalProgressTrackerProps {
  comparison: HistoricalComparison
  currentScore: number
}

export const HistoricalProgressTracker: FC<
  HistoricalProgressTrackerProps
> = ({ comparison, currentScore }) => {
  // Helper function to get trend styling
  const getTrendStyle = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-green-600 bg-green-100'
      case 'worsening':
        return 'text-red-600 bg-red-100'
      case 'stable':
        return 'text-blue-600 bg-blue-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  // Helper function to get trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )
      case 'worsening':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )
      case 'stable':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
        )
      default:
        return null
    }
  }

  // Helper function to format percentage
  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`

  // Helper function to get percentile color
  const getPercentileColor = (percentile: number) => {
    if (percentile >= 80) {
      return 'text-green-600'
    }
    if (percentile >= 60) {
      return 'text-yellow-600'
    }
    if (percentile >= 40) {
      return 'text-orange-600'
    }
    return 'text-red-600'
  }

  // Calculate improvement/decline from 30-day average
  const scoreDifference = currentScore - comparison.thirtyDayAverage
  const isImprovement = scoreDifference < 0 // Lower bias score is better

  return (
    <div className="historical-progress-tracker space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Historical Progress Tracking
        </h3>
        <p className="text-gray-600">
          Compare current performance against historical bias detection patterns
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Current vs Average */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {formatPercentage(currentScore)}
            </div>
            <div className="text-sm text-gray-600 mb-2">Current Score</div>
            <div
              className={`text-sm font-medium ${isImprovement ? 'text-green-600' : 'text-red-600'}`}
            >
              {isImprovement ? '↓' : '↑'}{' '}
              {formatPercentage(Math.abs(scoreDifference))}
              <span className="text-gray-500 ml-1">vs avg</span>
            </div>
          </div>
        </div>

        {/* 30-Day Average */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {formatPercentage(comparison.thirtyDayAverage)}
            </div>
            <div className="text-sm text-blue-800 mb-2">30-Day Average</div>
            <div className="text-xs text-blue-600">Historical baseline</div>
          </div>
        </div>

        {/* Percentile Rank */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-center">
            <div
              className={`text-2xl font-bold mb-1 ${getPercentileColor(comparison.percentileRank)}`}
            >
              {comparison.percentileRank}th
            </div>
            <div className="text-sm text-purple-800 mb-2">Percentile</div>
            <div className="text-xs text-purple-600">
              {comparison.percentileRank >= 80
                ? 'Excellent'
                : comparison.percentileRank >= 60
                  ? 'Good'
                  : comparison.percentileRank >= 40
                    ? 'Fair'
                    : 'Needs Improvement'}
            </div>
          </div>
        </div>

        {/* 7-Day Trend */}
        <div
          className={`border rounded-lg p-4 ${getTrendStyle(comparison.sevenDayTrend)}`}
        >
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              {getTrendIcon(comparison.sevenDayTrend)}
              <span className="ml-2 text-lg font-bold">
                {comparison.sevenDayTrend.charAt(0).toUpperCase() +
                  comparison.sevenDayTrend.slice(1)}
              </span>
            </div>
            <div className="text-sm opacity-80 mb-1">7-Day Trend</div>
            <div className="text-xs opacity-70">
              {comparison.sevenDayTrend === 'improving' &&
                'Bias scores decreasing'}
              {comparison.sevenDayTrend === 'worsening' &&
                'Bias scores increasing'}
              {comparison.sevenDayTrend === 'stable' &&
                'Consistent performance'}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Visualization */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4">
          Performance Comparison
        </h4>

        {/* Score Comparison Bar */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Current Session
              </span>
              <span className="text-sm font-bold text-gray-900">
                {formatPercentage(currentScore)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${
                  currentScore >= 0.8
                    ? 'bg-red-500'
                    : currentScore >= 0.6
                      ? 'bg-orange-500'
                      : currentScore >= 0.4
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                }`}
                style={{ width: `${currentScore * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                30-Day Average
              </span>
              <span className="text-sm font-bold text-blue-600">
                {formatPercentage(comparison.thirtyDayAverage)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-blue-500"
                style={{ width: `${comparison.thirtyDayAverage * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Performance Insights */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h5 className="font-medium text-gray-900 mb-2">
            Performance Insights
          </h5>
          <ul className="text-sm text-gray-700 space-y-1">
            {isImprovement ? (
              <>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Current session shows{' '}
                  {formatPercentage(Math.abs(scoreDifference))} improvement over
                  historical average
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  Performance is trending in the right direction
                </li>
              </>
            ) : (
              <>
                <li className="flex items-start">
                  <span className="text-orange-500 mr-2">⚠</span>
                  Current session shows{' '}
                  {formatPercentage(Math.abs(scoreDifference))} higher bias than
                  historical average
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2">ℹ</span>
                  Consider reviewing recent changes in approach or client
                  demographics
                </li>
              </>
            )}

            <li className="flex items-start">
              <span className="text-blue-500 mr-2">ℹ</span>
              You&apos;re performing better than {comparison.percentileRank}% of
              similar sessions
            </li>

            {comparison.sevenDayTrend === 'improving' && (
              <li className="flex items-start">
                <span className="text-green-500 mr-2">📈</span>
                Recent 7-day trend shows consistent improvement
              </li>
            )}

            {comparison.sevenDayTrend === 'worsening' && (
              <li className="flex items-start">
                <span className="text-red-500 mr-2">📉</span>
                Recent 7-day trend indicates need for attention
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Recommendations Based on Historical Data */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-semibold text-blue-900 mb-4">
          Historical Recommendations
        </h4>
        <div className="space-y-3">
          {comparison.percentileRank < 50 && (
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-600 mr-2 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <div className="font-medium text-blue-900">
                  Focus on Improvement
                </div>
                <div className="text-sm text-blue-800">
                  Your current performance is below the median. Consider
                  additional bias awareness training.
                </div>
              </div>
            </div>
          )}

          {comparison.sevenDayTrend === 'worsening' && (
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-600 mr-2 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <div className="font-medium text-blue-900">
                  Address Recent Decline
                </div>
                <div className="text-sm text-blue-800">
                  Recent trend shows increasing bias. Review recent sessions and
                  identify potential causes.
                </div>
              </div>
            </div>
          )}

          {comparison.percentileRank >= 80 && (
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-600 mr-2 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <div className="font-medium text-blue-900">
                  Excellent Performance
                </div>
                <div className="text-sm text-blue-800">
                  You&apos;re performing in the top 20%. Consider mentoring
                  others or sharing best practices.
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-blue-600 mr-2 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <div className="font-medium text-blue-900">
                Continue Monitoring
              </div>
              <div className="text-sm text-blue-800">
                Regular analysis helps maintain awareness and track long-term
                progress patterns.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HistoricalProgressTracker
