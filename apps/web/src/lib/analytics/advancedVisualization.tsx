/**
 * Advanced Analytics and Visualization System for Pixelated Empathy
 * Multi-dimensional analysis and interactive data exploration
 */

import React from 'react'

interface DataDimension {
  field: string
  label: string
  type: 'numeric' | 'categorical' | 'temporal' | 'boolean'
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median'
}

interface VisualizationConfig {
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
  filters: Record<string, unknown>
  interactive: boolean
  realTime: boolean
}

interface AnalyticsInsight {
  id: string
  type: 'trend' | 'anomaly' | 'correlation' | 'pattern' | 'prediction'
  title: string
  description: string
  confidence: number
  data: Record<string, unknown>
  recommendations: string[]
  impact: 'low' | 'medium' | 'high'
}

interface DataPoint {
  [key: string]: unknown
}

interface AdvancedVisualizationProps {
  data: DataPoint[]
  config: VisualizationConfig
  onInsightGenerated?: (insight: AnalyticsInsight) => void
  className?: string
}

/**
 * Advanced Analytics Visualization Component
 */
export const AdvancedVisualization: React.FC<AdvancedVisualizationProps> = ({
  data,
  config,
  onInsightGenerated,
  className = '',
}) => {
  const [subsetInsights, setSubsetInsights] = React.useState<
    AnalyticsInsight[]
  >([])
  const [selectedDataPoints, setSelectedDataPoints] = React.useState<
    DataPoint[]
  >([])
  const [viewMode, setViewMode] = React.useState<
    'overview' | 'detailed' | 'comparative'
  >('overview')

  const insights = React.useMemo(
    () => [...generateInsights(data, config), ...subsetInsights],
    [config, data, subsetInsights],
  )

  // Generate insights based on data analysis
  React.useEffect(() => {
    const generatedInsights = generateInsights(data, config)
    if (onInsightGenerated) {
      generatedInsights.forEach(onInsightGenerated)
    }
  }, [data, config, onInsightGenerated])

  const handleDataPointSelection = (points: DataPoint[]) => {
    setSelectedDataPoints(points)
    // Generate insights for selected subset
    if (points.length > 0) {
      const subsetInsights = generateInsights(points, config)
      setSubsetInsights((prev) => [...prev, ...subsetInsights])
    }
  }

  return (
    <div className={`advanced-visualization ${className}`}>
      {/* Visualization Controls */}
      <div className="mb-6 flex items-center justify-between rounded-none border border-border bg-card p-4">
        <div className="flex items-center gap-4">
          <select
            value={viewMode}
            onChange={(e) =>
              setViewMode(
                e.target.value as 'overview' | 'detailed' | 'comparative',
              )
            }
            className="rounded-none border border-input bg-card px-3 py-2"
          >
            <option value="overview">Overview</option>
            <option value="detailed">Detailed</option>
            <option value="comparative">Comparative</option>
          </select>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Interactive:</span>
            <button
              className={`h-5 w-10 rounded-none transition-colors ${
                config.interactive ? 'bg-primary' : 'bg-secondary'
              }`}
            >
              <div
                className={`h-4 w-4 rounded-none bg-background transition-transform ${
                  config.interactive ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {data.length} data points • {insights.length} insights
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chart Area */}
        <div className="lg:col-span-2">
          <div className="rounded-none border border-border bg-card p-6">
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
          <h3 className="mb-4 text-lg font-semibold">AI Insights</h3>

          <div className="max-h-96 space-y-3 overflow-y-auto">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Analysis Panel */}
      {selectedDataPoints.length > 0 && (
        <div className="mt-6 rounded-none border border-border bg-secondary p-4">
          <h4 className="mb-3 font-medium">Selected Data Analysis</h4>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <div className="font-medium text-muted-foreground">Points</div>
              <div className="text-lg font-bold">
                {selectedDataPoints.length}
              </div>
            </div>
            <div>
              <div className="font-medium text-muted-foreground">Avg Value</div>
              <div className="text-lg font-bold">
                {(
                  selectedDataPoints.reduce(
                    (sum, p) =>
                      sum + ((p[config.dimensions.y.field] ?? 0) as number),
                    0,
                  ) / selectedDataPoints.length
                ).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="font-medium text-muted-foreground">Range</div>
              <div className="text-lg font-bold">
                {Math.min(
                  ...selectedDataPoints.map(
                    (p) => (p[config.dimensions.y.field] ?? 0) as number,
                  ),
                ).toFixed(1)}{' '}
                -{' '}
                {Math.max(
                  ...selectedDataPoints.map(
                    (p) => (p[config.dimensions.y.field] ?? 0) as number,
                  ),
                ).toFixed(1)}
              </div>
            </div>
            <div>
              <div className="font-medium text-muted-foreground">Trend</div>
              <div
                className={`text-lg font-bold ${
                  calculateTrend(
                    selectedDataPoints,
                    config.dimensions.x.field,
                  ) > 0
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {calculateTrend(selectedDataPoints, config.dimensions.x.field) >
                0
                  ? '\u2197' // ↗
                  : '\u2198'}{' '}
                {/* ↘ */}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface VisualizationChartProps {
  data: DataPoint[]
  config: VisualizationConfig
  selectedPoints: DataPoint[]
  onSelectionChange: (points: DataPoint[]) => void
}

/**
 * VisualizationChart Component
 */
const VisualizationChart: React.FC<VisualizationChartProps> = ({
  data,
  config,
  selectedPoints,
  onSelectionChange,
}) => {
  const [hoveredPoint, setHoveredPoint] = React.useState<DataPoint | null>(null)

  // Simplified chart rendering
  const chartHeight = 400
  const chartWidth = 600

  const xValues = data.map((d) => (d[config.dimensions.x.field] ?? 0) as number)
  const yValues = data.map((d) => (d[config.dimensions.y.field] ?? 0) as number)

  // Avoid NaN/Infinity with empty/single data
  const xMin = xValues.length ? Math.min(...xValues) : 0
  const xMax = xValues.length ? Math.max(...xValues) : 100
  const yMin = yValues.length ? Math.min(...yValues) : 0
  const yMax = yValues.length ? Math.max(...yValues) : 100

  // Safe checks for zero range
  const xRange = xMax - xMin || 1
  const yRange = yMax - yMin || 1

  const getPointPosition = (point: DataPoint) => {
    const x =
      ((((point[config.dimensions.x.field] ?? 0) as number) - xMin) / xRange) *
        (chartWidth - 40) +
      20
    const y =
      chartHeight -
      20 -
      ((((point[config.dimensions.y.field] ?? 0) as number) - yMin) / yRange) *
        (chartHeight - 40)
    return { x, y }
  }

  return (
    <div className="relative">
      <svg
        width={chartWidth}
        height={chartHeight}
        className="border border-border"
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
              className="text-muted-foreground/30"
            />
            <line
              x1={20 + ratio * (chartWidth - 40)}
              y1="20"
              x2={20 + ratio * (chartWidth - 40)}
              y2={chartHeight - 20}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-muted-foreground/30"
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
              fill={isSelected ? 'var(--np-text)' : 'var(--np-mid)'}
              stroke={
                hoveredPoint === point ? 'var(--np-text)' : 'var(--np-bg)'
              }
              strokeWidth="2"
              className="hover:r-8 cursor-pointer transition-all"
              onMouseEnter={() => setHoveredPoint(point)}
              onMouseLeave={() => setHoveredPoint(null)}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  onSelectionChange([point])
                }
              }}
            />
          )
        })}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div
          className="pointer-events-none absolute z-10 rounded-none bg-foreground px-2 py-1 text-xs text-background"
          style={{
            left: getPointPosition(hoveredPoint).x + 10,
            top: getPointPosition(hoveredPoint).y - 10,
          }}
        >
          {config.dimensions.x.label}:{' '}
          {hoveredPoint[config.dimensions.x.field] as unknown}
          <br />
          {config.dimensions.y.label}:{' '}
          {hoveredPoint[config.dimensions.y.field] as unknown}
        </div>
      )}
    </div>
  )
}

/**
 * Insight Card Component
 */
const InsightCard: React.FC<{ insight: AnalyticsInsight }> = ({ insight }) => {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const impactStyles = {
    low: 'bg-secondary text-muted-foreground',
    medium: 'bg-secondary text-foreground border border-ring',
    high: 'bg-foreground text-background',
  }

  const typeIcons: Record<string, string> = {
    trend: '\uD83D\uDCC8', // 📈
    anomaly: '\u26A0\uFE0F', // ⚠️
    correlation: '\uD83D\uDD17', // 🔗
    pattern: '\uD83D\uDD0D', // 🔍
    prediction: '\uD83D\uDD2E', // 🔮
  }

  return (
    <div className="overflow-hidden rounded-none border border-border bg-card">
      <div className="p-3">
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{typeIcons[insight.type]}</span>
            <h4 className="text-sm font-medium">{insight.title}</h4>
          </div>
          <span
            className={`rounded-none px-2 py-1 text-xs font-medium ${
              impactStyles[insight.impact]
            }`}
          >
            {insight.impact}
          </span>
        </div>

        <p className="mb-3 text-sm text-muted-foreground">
          {insight.description}
        </p>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Confidence: {(insight.confidence * 100).toFixed(0)}%
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-foreground hover:underline"
          >
            {isExpanded ? 'Less' : 'More'}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="space-y-2">
              <div>
                <h5 className="mb-1 text-xs font-medium text-foreground">
                  Recommendations:
                </h5>
                <ul className="space-y-1 text-xs text-muted-foreground">
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
  data: DataPoint[],
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
      description: `The data shows a ${
        trend > 0 ? 'positive' : 'negative'
      } trend in ${config.dimensions.y.label} over ${
        config.dimensions.x.label
      }`,
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
  const yValues = data.map((d) => (d[config.dimensions.y.field] ?? 0) as number)
  const mean = yValues.reduce((sum, val) => sum + val, 0) / yValues.length
  const stdDev = Math.sqrt(
    yValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      yValues.length,
  )

  const anomalies = data.filter((d) => {
    const val = (d[config.dimensions.y.field] ?? 0) as number
    return Math.abs(val - mean) > 2 * stdDev
  })

  if (anomalies.length > 0) {
    insights.push({
      id: `anomaly_${Date.now()}`,
      type: 'anomaly',
      title: 'Data Anomalies Detected',
      description: `${anomalies.length} unusual data point${
        anomalies.length > 1 ? 's' : ''
      } found that deviate significantly from the norm`,
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
        description: `Significant ${
          correlation > 0 ? 'positive' : 'negative'
        } correlation detected between ${config.dimensions.x.label} and ${
          config.dimensions.color.label
        }`,
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
function calculateTrend(data: DataPoint[], xField: string): number {
  const points: [number, number][] = data.map((d, i) => [
    i,
    (d[xField] ?? 0) as number,
  ])

  const n = points.length
  const sumX = points.reduce((sum, p) => sum + p[0], 0)
  const sumY = points.reduce((sum, p) => sum + p[1], 0)
  const sumXY = points.reduce((sum, p) => sum + p[0] * p[1], 0)
  const sumXX = points.reduce((sum, p) => sum + p[0] * p[0], 0)

  // Avoid division by zero
  const denominator = n * sumXX - sumX * sumX
  if (denominator === 0) return 0

  const slope = (n * sumXY - sumX * sumY) / denominator
  return slope
}

/**
 * Calculate correlation between two fields (simplified)
 */
function calculateCorrelation(
  data: DataPoint[],
  field1: string,
  field2: string,
): number {
  const values1 = data.map((d) => (d[field1] ?? 0) as number)
  const values2 = data.map((d) => (d[field2] ?? 0) as number)

  if (values1.length === 0 || values2.length === 0) return 0

  const mean1 = values1.reduce((sum, val) => sum + val, 0) / values1.length
  const mean2 = values2.reduce((sum, val) => sum + val, 0) / values2.length

  const numerator = values1.reduce(
    (sum, val1, i) => sum + (val1 - mean1) * ((values2[i] ?? 0) - mean2),
    0,
  )
  const denom1 = Math.sqrt(
    values1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0),
  )
  const denom2 = Math.sqrt(
    values2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0),
  )

  if (denom1 === 0 || denom2 === 0) return 0

  return numerator / (denom1 * denom2)
}
