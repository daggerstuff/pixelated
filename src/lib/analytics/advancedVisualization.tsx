/**
 * Advanced Analytics and Visualization System for Pixelated Empathy
 * Multi-dimensional analysis and interactive data exploration
 */

import type { FC } from 'react'
import React from 'react'

export interface DataDimension {
  field: string
  label: string
  type: 'numeric' | 'categorical' | 'temporal' | 'boolean'
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median'
}

export interface VisualizationConfig {
  type:
    | 'scatter'
    | 'line'
    | 'bar'
    | 'heatmap'
    | 'network'
    | 'parallel'
    | 'treemap'
  dimensions: {
    x: DataDimension
    y: DataDimension
    color?: DataDimension
    size?: DataDimension
  }
  filters: Record<string, any>
  interactive: boolean
  realTime: boolean
}

export interface AnalyticsInsight {
  id: string
  type: 'trend' | 'anomaly' | 'correlation' | 'pattern' | 'prediction'
  title: string
  description: string
  confidence: number
  data: any
  recommendations: string[]
  impact: 'low' | 'medium' | 'high'
}

/**
 * Advanced Analytics Visualization Component
 */
export const AdvancedVisualization: FC<{
  data: any[]
  config: VisualizationConfig
  onInsightGenerated?: (insight: AnalyticsInsight) => void
  className?: string
}> = ({ data, config, onInsightGenerated, className = '' }) => {
  const [insights, setInsights] = React.useState<AnalyticsInsight[]>([])
  const [selectedDataPoints, setSelectedDataPoints] = React.useState<any[]>([])
  const [viewMode, setViewMode] = React.useState<
    'overview' | 'detailed' | 'comparative'
  >('overview')

  // Generate insights based on data analysis
  React.useEffect(() => {
    const generatedInsights = generateInsights(data, config)
    setInsights(generatedInsights)
    generatedInsights.forEach(onInsightGenerated)
  }, [data, config, onInsightGenerated])

  const handleDataPointSelection = (points: any[]) => {
    setSelectedDataPoints(points)
    // Generate insights for selected subset
    if (points.length > 0) {
      const subsetInsights = generateInsights(points, config)
      setInsights((prev) => [...prev, ...subsetInsights])
    }
  }

  return (
    <div className={`advanced-visualization ${className}`}>
      {/* Visualization Controls */}
      <div className="flex items-center justify-between mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border">
        <div className="flex items-center gap-4">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
          >
            <option value="overview">Overview</option>
            <option value="detailed">Detailed</option>
            <option value="comparative">Comparative</option>
          </select>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Interactive:</span>
            <button
              className={`w-10 h-5 rounded-full transition-colors ${
                config.interactive
                  ? 'bg-blue-500'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full transition-transform ${
                  config.interactive ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          {data.length} data points • {insights.length} insights
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Area */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg border p-6">
            <VisualizationChart
              data={data}
              config={config}
              selectedPoints={selectedDataPoints}
              onSelectionChange={handleDataPointSelection}
            />
          </div>
        </div>

        {/* Insights Panel */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-4">AI Insights</h3>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Analysis Panel */}
      {selectedDataPoints.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-medium mb-3">Selected Data Analysis</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-600 dark:text-gray-400">
                Points
              </div>
              <div className="text-lg font-bold">
                {selectedDataPoints.length}
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-600 dark:text-gray-400">
                Avg Value
              </div>
              <div className="text-lg font-bold">
                {(
                  selectedDataPoints.reduce(
                    (sum, p) => sum + (p[config.dimensions.y.field] || 0),
                    0,
                  ) / selectedDataPoints.length
                ).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-600 dark:text-gray-400">
                Range
              </div>
              <div className="text-lg font-bold">
                {Math.min(
                  ...selectedDataPoints.map(
                    (p) => p[config.dimensions.y.field] || 0,
                  ),
                ).toFixed(1)}{' '}
                -{' '}
                {Math.max(
                  ...selectedDataPoints.map(
                    (p) => p[config.dimensions.y.field] || 0,
                  ),
                ).toFixed(1)}
              </div>
            </div>
            <div>
              <div className="font-medium text-gray-600 dark:text-gray-400">
                Trend
              </div>
              <div
                className={`text-lg font-bold ${
                  calculateTrend(
                    selectedDataPoints,
                    config.dimensions.x.field,
                  ) > 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {calculateTrend(selectedDataPoints, config.dimensions.x.field) >
                0
                  ? '↗'
                  : '↘'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Visualization Chart Component (Simplified for demo)
 */
const VisualizationChart: FC<{
  data: any[]
  config: VisualizationConfig
  selectedPoints: any[]
  onSelectionChange: (points: any[]) => void
}> = ({ data, config, selectedPoints, onSelectionChange }) => {
  const [hoveredPoint, setHoveredPoint] = React.useState<any>(null)

  // Simplified chart rendering - in real implementation would use D3/Chart.js
  const chartHeight = 400
  const chartWidth = 600

  const xValues = data.map((d) => d[config.dimensions.x.field] || 0)
  const yValues = data.map((d) => d[config.dimensions.y.field] || 0)

  const xMin = Math.min(...xValues)
  const xMax = Math.max(...xValues)
  const yMin = Math.min(...yValues)
  const yMax = Math.max(...yValues)

  const getPointPosition = (point: any) => {
    const x =
      (((point[config.dimensions.x.field] || 0) - xMin) / (xMax - xMin)) *
        (chartWidth - 40) +
      20
    const y =
      chartHeight -
      20 -
      (((point[config.dimensions.y.field] || 0) - yMin) / (yMax - yMin)) *
        (chartHeight - 40)
    return { x, y }
  }

  return (
    <div className="relative">
      <svg
        width={chartWidth}
        height={chartHeight}
        className="border border-gray-200 dark:border-gray-700"
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((ratio) => (
          <g key={ratio}>
            <line
              x1="20"
              y1={20 + ratio * (chartHeight - 40)}
              x2={chartWidth - 20}
              y2={20 + ratio * (chartHeight - 40)}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-gray-300 dark:text-gray-600"
            />
            <line
              x1={20 + ratio * (chartWidth - 40)}
              y1="20"
              x2={20 + ratio * (chartWidth - 40)}
              y2={chartHeight - 20}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-gray-300 dark:text-gray-600"
            />
          </g>
        ))}

        {/* Data points */}
        {data.map((point, index) => {
          const position = getPointPosition(point)
          const isSelected = selectedPoints.includes(point)

          return (
            <circle
              key={index}
              cx={position.x}
              cy={position.y}
              r={isSelected ? 6 : 4}
              fill={isSelected ? '#3b82f6' : '#10b981'}
              stroke={hoveredPoint === point ? '#ef4444' : 'white'}
              strokeWidth="2"
              className="cursor-pointer transition-all hover:r-8"
              onMouseEnter={() => setHoveredPoint(point)}
              onMouseLeave={() => setHoveredPoint(null)}
              onClick={(e) => {
                e.ctrlKey || e.metaKey
                  ? onSelectionChange([...selectedPoints, point])
                  : onSelectionChange([point])
              }}
            />
          )
        })}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          className="absolute bg-gray-900 text-white text-xs rounded-lg px-2 py-1 pointer-events-none z-10"
          style={{
            left: getPointPosition(hoveredPoint).x + 10,
            top: getPointPosition(hoveredPoint).y - 10,
          }}
        >
          {config.dimensions.x.label}: {hoveredPoint[config.dimensions.x.field]}
          <br />
          {config.dimensions.y.label}: {hoveredPoint[config.dimensions.y.field]}
        </div>
      )}
    </div>
  )
}

/**
 * Insight Card Component
 */
const InsightCard: FC<{ insight: AnalyticsInsight }> = ({ insight }) => {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const impactColors = {
    low: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    high: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  }

  const typeIcons = {
    trend: '📈',
    anomaly: '⚠️',
    correlation: '🔗',
    pattern: '🔍',
    prediction: '🔮',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{typeIcons[insight.type]}</span>
            <h4 className="font-medium text-sm">{insight.title}</h4>
          </div>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${impactColors[insight.impact]}`}
          >
            {insight.impact}
          </span>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {insight.description}
        </p>

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">
            Confidence: {(insight.confidence * 100).toFixed(0)}%
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isExpanded ? 'Less' : 'More'}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-2">
              <div>
                <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Recommendations:
                </h5>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  {insight.recommendations.map((rec, index) => (
                    <li key={index}>• {rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Generate insights from data analysis
 */
function generateInsights(
  data: any[],
  config: VisualizationConfig,
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []

  if (data.length < 5) return insights

  // Trend analysis
  const trend = calculateTrend(data, config.dimensions.x.field)
  if (Math.abs(trend) > 0.1) {
    insights.push({
      id: `trend_${Date.now()}`,
      type: 'trend',
      title: `${trend > 0 ? 'Increasing' : 'Decreasing'} Trend Detected`,
      description: `The data shows a ${trend > 0 ? 'positive' : 'negative'} trend in ${config.dimensions.y.label} over ${config.dimensions.x.label}`,
      confidence: Math.min(Math.abs(trend) * 2, 0.95),
      data: { trend, field: config.dimensions.y.field },
      recommendations: [
        'Monitor this trend in future sessions',
        'Investigate factors contributing to this pattern',
        'Consider adjusting intervention strategies',
      ],
      impact: Math.abs(trend) > 0.3 ? 'high' : 'medium',
    })
  }

  // Anomaly detection (simplified)
  const yValues = data.map((d) => d[config.dimensions.y.field] || 0)
  const mean = yValues.reduce((sum, val) => sum + val, 0) / yValues.length
  const stdDev = Math.sqrt(
    yValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      yValues.length,
  )

  const anomalies = data.filter((d) => {
    const val = d[config.dimensions.y.field] || 0
    return Math.abs(val - mean) > 2 * stdDev
  })

  if (anomalies.length > 0) {
    insights.push({
      id: `anomaly_${Date.now()}`,
      type: 'anomaly',
      title: 'Data Anomalies Detected',
      description: `${anomalies.length} unusual data point${anomalies.length > 1 ? 's' : ''} found that deviate significantly from the norm`,
      confidence: 0.85,
      data: { anomalies: anomalies.length, threshold: 2 * stdDev },
      recommendations: [
        'Review anomalous sessions for clinical significance',
        'Check for data collection errors',
        'Investigate external factors that may explain deviations',
      ],
      impact: anomalies.length > 3 ? 'high' : 'medium',
    })
  }

  // Correlation analysis (simplified)
  if (config.dimensions.color) {
    const correlation = calculateCorrelation(
      data,
      config.dimensions.x.field,
      config.dimensions.color.field,
    )
    if (Math.abs(correlation) > 0.5) {
      insights.push({
        id: `correlation_${Date.now()}`,
        type: 'correlation',
        title: 'Strong Correlation Found',
        description: `Significant ${correlation > 0 ? 'positive' : 'negative'} correlation detected between ${config.dimensions.x.label} and ${config.dimensions.color.label}`,
        confidence: Math.abs(correlation),
        data: {
          correlation,
          fields: [config.dimensions.x.field, config.dimensions.color.field],
        },
        recommendations: [
          'Explore causal relationships between correlated factors',
          'Consider this correlation in treatment planning',
          'Monitor how changes in one area affect the other',
        ],
        impact: Math.abs(correlation) > 0.7 ? 'high' : 'medium',
      })
    }
  }

  return insights
}

/**
 * Calculate trend (slope) of data points
 */
function calculateTrend(data: any[], xField: string): number {
  const points = data.map((d, i) => [i, d[xField] || 0])

  const n = points.length
  const sumX = points.reduce((sum, [x]) => sum + x, 0)
  const sumY = points.reduce((sum, [, y]) => sum + y, 0)
  const sumXY = points.reduce((sum, [x, y]) => sum + x * y, 0)
  const sumXX = points.reduce((sum, [x]) => sum + x * x, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  return slope
}

/**
 * Calculate correlation between two fields (simplified)
 */
function calculateCorrelation(
  data: any[],
  field1: string,
  field2: string,
): number {
  const values1 = data.map((d) => d[field1] || 0)
  const values2 = data.map((d) => d[field2] || 0)

  const mean1 = values1.reduce((sum, val) => sum + val, 0) / values1.length
  const mean2 = values2.reduce((sum, val) => sum + val, 0) / values2.length

  const numerator = values1.reduce(
    (sum, val1, i) => sum + (val1 - mean1) * (values2[i] - mean2),
    0,
  )
  const denom1 = Math.sqrt(
    values1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0),
  )
  const denom2 = Math.sqrt(
    values2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0),
  )

  return numerator / (denom1 * denom2)
}

export default AdvancedVisualization
