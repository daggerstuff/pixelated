import { useState } from 'react'
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
  AreaChart,
  Area,
} from 'recharts'
import type { TemporalEmotionAnalysis } from '../../lib/ai/temporal/EmotionTemporalAnalyzer'
import { cn } from '@/lib/utils'

type EmotionTemporalAnalysisChartProps = {
  data: TemporalEmotionAnalysis
  className?: string
  isLoading?: boolean
  height?: number
  clientId?: string
}

// Color map for common emotions
const emotionColors: Record<string, string> = {
  happiness: '#4ade80', // green-400
  joy: '#22c55e', // green-500
  excitement: '#10b981', // emerald-500
  contentment: '#60a5fa', // blue-400
  gratitude: '#3b82f6', // blue-500
  neutral: '#94a3b8', // slate-400
  surprise: '#c084fc', // purple-400
  anxiety: '#f59e0b', // amber-500
  fear: '#f97316', // orange-500
  anger: '#ef4444', // red-500
  sadness: '#6366f1', // indigo-500
  disgust: '#8b5cf6', // violet-500
}

// Get color for an emotion type, with fallback
const getEmotionColor = (emotion: string): string => {
  return emotionColors[emotion.toLowerCase()] || '#94a3b8' // slate-400 default
}

/**
 * Component for visualizing temporal emotion analysis
 * Displays charts for emotional trends, critical points, and progression
 */
export default function EmotionTemporalAnalysisChart({
  data,
  className,
  isLoading = false,
  height = 400,
}: EmotionTemporalAnalysisChartProps) {
  const [viewMode, setViewMode] = useState<
    'trends' | 'critical' | 'progression' | 'transitions' | 'relationships'
  >('trends')
  const [emotionFilters, setEmotionFilters] = useState<Record<string, boolean>>(
    {},
  )

  // Format data for trend visualization
  const prepareTrendData = () => {
    // Get all emotion types with trendlines
    const emotionTypes = Object.keys(data.trendlines)

    // Initialize emotion filters if not already set
    if (Object.keys(emotionFilters).length === 0 && emotionTypes.length > 0) {
      const initialFilters: Record<string, boolean> = {}
      // Show top 5 emotions by default or all if less than 5
      const topEmotions = emotionTypes.slice(
        0,
        Math.min(5, emotionTypes.length),
      )
      emotionTypes.forEach((type) => {
        initialFilters[type] = topEmotions.includes(type)
      })
      setEmotionFilters(initialFilters)
    }

    // Get filtered emotions
    const filteredEmotions = Object.entries(emotionFilters)
      .filter(([_, isSelected]) => isSelected)
      .map(([emotion]) => emotion)

    // Create trendline data with selected emotions
    return filteredEmotions.map((emotion) => {
      const trendline = data.trendlines[emotion]
      const volatility = data.volatility[emotion] || 0

      return {
        name: emotion,
        slope: trendline.slope,
        correlation: trendline.correlation,
        significance: trendline.significance,
        volatility,
        color: getEmotionColor(emotion),
      }
    })
  }

  // Format data for critical points visualization
  const prepareCriticalPointsData = () => {
    return data.criticalPoints.map((point) => ({
      name: point.emotion,
      intensity: point.intensity,
      timestamp: point.timestamp.toLocaleString(),
      sessionId: point.sessionId,
      color: getEmotionColor(point.emotion),
    }))
  }

  // Format data for progression visualization
  const prepareProgressionData = () => {
    const { progression } = data

    return [
      {
        name: 'Overall Improvement',
        value: progression.overallImprovement,
        fill: progression.overallImprovement >= 0 ? '#22c55e' : '#ef4444',
      },
      {
        name: 'Stability Change',
        value: progression.stabilityChange,
        fill: progression.stabilityChange >= 0 ? '#3b82f6' : '#f97316',
      },
      {
        name: 'Positive Emotion Change',
        value: progression.positiveEmotionChange,
        fill: progression.positiveEmotionChange >= 0 ? '#4ade80' : '#f59e0b',
      },
      {
        name: 'Negative Emotion Change',
        value: progression.negativeEmotionChange,
        fill: progression.negativeEmotionChange >= 0 ? '#8b5cf6' : '#6366f1',
      },
    ]
  }

  // Format data for transitions visualization
  const prepareTransitionsData = () => {
    // Get top 10 most frequent transitions
    return data.transitions.slice(0, 10).map((transition) => ({
      name: `${transition.from} → ${transition.to}`,
      frequency: transition.frequency,
      duration: transition.avgDuration / (1000 * 60), // Convert to minutes
      from: transition.from,
      to: transition.to,
      fromColor: getEmotionColor(transition.from),
      toColor: getEmotionColor(transition.to),
    }))
  }

  // Format data for relationships visualization
  const prepareRelationshipsData = () => {
    return data.dimensionalRelationships.map((rel) => ({
      name: `${rel.dimensions[0]} & ${rel.dimensions[1]}`,
      correlation: rel.correlation,
      description: rel.description,
      color: rel.correlation >= 0 ? '#22c55e' : '#ef4444',
    }))
  }

  // Toggle emotion selection in filters
  const toggleEmotionFilter = (emotion: string) => {
    setEmotionFilters((prev) => ({
      ...prev,
      [emotion]: !prev[emotion],
    }))
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg">
        <div className="animate-pulse flex flex-col w-full">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2.5"></div>
          <div className="h-40 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    )
  }

  // Empty state (no data)
  if (
    !data ||
    (Object.keys(data.trendlines).length === 0 &&
      data.criticalPoints.length === 0 &&
      data.transitions.length === 0)
  ) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
        <p className="text-gray-500 mb-2">
          No temporal analysis data available
        </p>
        <p className="text-sm text-gray-400">
          More data needs to be collected across sessions
        </p>
      </div>
    )
  }

  // Render the appropriate chart based on view mode
  const renderChart = () => {
    if (viewMode === 'trends') {
      return (
        <AreaChart
          data={prepareTrendData()}
          margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis domain={[-1, 1]} />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'slope') {
                return [
                  `${(value as number).toFixed(2)} (${(value as number) > 0 ? 'increasing' : 'decreasing'})`,
                  'Trend',
                ]
              }
              if (name === 'correlation') {
                return [(value as number).toFixed(2), 'Correlation']
              }
              if (name === 'significance') {
                return [(value as number).toFixed(2), 'Significance']
              }
              return [value, name]
            }}
          />

          <Legend />
          <ReferenceLine y={0} stroke="#666" />
          <defs>
            {prepareTrendData().map((item) => (
              <linearGradient
                key={item.name}
                id={`gradient-${item.name}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={item.color} stopOpacity={0.8} />

                <stop offset="95%" stopColor={item.color} stopOpacity={0.2} />
              </linearGradient>
            ))}
          </defs>
          <Area
            type="monotone"
            dataKey="slope"
            stroke="#8884d8"
            fill="#8884d8"
            strokeWidth={2}
            fillOpacity={0.6}
            name="Trend"
          />

          <Area
            type="monotone"
            dataKey="correlation"
            stroke="#82ca9d"
            fill="#82ca9d"
            strokeWidth={2}
            fillOpacity={0.6}
            name="Correlation"
          />
        </AreaChart>
      )
    }

    if (viewMode === 'critical') {
      return (
        <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="category" dataKey="name" name="Emotion" />

          <YAxis type="number" dataKey="intensity" name="Intensity" />

          <ZAxis type="category" dataKey="sessionId" name="Session" />

          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(value, name, _props) => {
              if (name === 'Intensity') {
                return [value, name]
              }
              if (name === 'Session') {
                return [_props.payload.sessionId, 'Session']
              }
              if (name === 'Timestamp') {
                return [_props.payload.timestamp, 'Timestamp']
              }
              return [value, name]
            }}
          />

          <Legend />
          {prepareCriticalPointsData().map((point) => (
            <Scatter
              key={`${point.name}-${point.sessionId}-${point.timestamp}`}
              name={point.name}
              data={[point]}
              fill={point.color}
            />
          ))}
        </ScatterChart>
      )
    }

    if (viewMode === 'progression') {
      return (
        <AreaChart
          data={prepareProgressionData()}
          margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <ReferenceLine y={0} stroke="#666" />
          {prepareProgressionData().map((item) => (
            <Area
              key={item.name}
              type="monotone"
              dataKey="value"
              name={item.name}
              stroke={item.fill}
              fill={item.fill}
              fillOpacity={0.6}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      )
    }

    if (viewMode === 'transitions') {
      return (
        <AreaChart
          data={prepareTransitionsData()}
          margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis
            yAxisId="left"
            orientation="left"
            dataKey="frequency"
            name="Frequency"
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            dataKey="duration"
            name="Avg. Duration (min)"
          />

          <Tooltip
            formatter={(value, name, _props) => {
              if (name === 'frequency') {
                return [value, 'Frequency']
              }
              if (name === 'duration') {
                return [(value as number).toFixed(1), 'Avg Duration (min)']
              }
              return [value, name]
            }}
          />

          <Legend />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="frequency"
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.6}
            strokeWidth={2}
            name="Frequency"
          />

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="duration"
            stroke="#82ca9d"
            strokeWidth={2}
            name="Avg Duration (min)"
          />
        </AreaChart>
      )
    }

    if (viewMode === 'relationships') {
      return (
        <AreaChart
          data={prepareRelationshipsData()}
          margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis domain={[-1, 1]} />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'correlation') {
                return [(value as number).toFixed(2), 'Correlation']
              }
              return [value, name]
            }}
          />

          <Legend />
          <ReferenceLine y={0} stroke="#666" />
          <Area
            type="monotone"
            dataKey="correlation"
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.6}
            strokeWidth={2}
            name="Correlation"
          />
        </AreaChart>
      )
    }

    // Default fallback - return an empty chart if no condition matches
    return (
      <AreaChart data={[]} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis />
        <YAxis />
        <Tooltip />
      </AreaChart>
    )
  }

  return (
    <div className={cn('p-4 bg-white rounded-lg shadow-sm', className)}>
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h3 className="text-lg font-medium text-gray-900">
          Temporal Emotion Analysis
        </h3>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewMode('trends')}
            className={cn(
              'px-3 py-1 text-sm rounded-full',
              viewMode === 'trends'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-gray-100 text-gray-600',
            )}
          >
            Trends
          </button>
          <button
            onClick={() => setViewMode('critical')}
            className={cn(
              'px-3 py-1 text-sm rounded-full',
              viewMode === 'critical'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-gray-100 text-gray-600',
            )}
          >
            Critical Points
          </button>
          <button
            onClick={() => setViewMode('progression')}
            className={cn(
              'px-3 py-1 text-sm rounded-full',
              viewMode === 'progression'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600',
            )}
          >
            Progression
          </button>
          <button
            onClick={() => setViewMode('transitions')}
            className={cn(
              'px-3 py-1 text-sm rounded-full',
              viewMode === 'transitions'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600',
            )}
          >
            Transitions
          </button>
          <button
            onClick={() => setViewMode('relationships')}
            className={cn(
              'px-3 py-1 text-sm rounded-full',
              viewMode === 'relationships'
                ? 'bg-indigo-100 text-indigo-800'
                : 'bg-gray-100 text-gray-600',
            )}
          >
            Relationships
          </button>
        </div>
      </div>

      {/* Emotion filters (only show for trend view) */}
      {viewMode === 'trends' && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(emotionFilters).map(([emotion, isSelected]) => (
            <button
              key={emotion}
              onClick={() => toggleEmotionFilter(emotion)}
              className={cn(
                'px-2 py-1 text-xs rounded-full border',
                isSelected ? 'text-white' : 'bg-white text-gray-600',
              )}
              style={{
                backgroundColor: isSelected
                  ? getEmotionColor(emotion)
                  : undefined,
              }}
            >
              {emotion}
            </button>
          ))}
        </div>
      )}

      {/* Chart based on selected view */}
      <div style={{ width: '100%', height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Summary text based on view */}
      <div className="mt-4 text-sm text-gray-600">
        {viewMode === 'trends' && (
          <p>
            This chart shows emotional trend patterns over time, helping to
            identify which emotions are increasing or decreasing in intensity
            across sessions. Positive slopes indicate increasing emotions, while
            negative slopes show decreasing trends.
          </p>
        )}

        {viewMode === 'critical' && (
          <p>
            Critical emotional points represent significant moments with high
            emotional intensity. These points often indicate important
            therapeutic breakthroughs or challenges.
          </p>
        )}

        {viewMode === 'progression' && (
          <p>
            The progression chart shows overall emotional improvement metrics.
            Positive values indicate beneficial changes, while negative values
            may indicate areas needing attention.
          </p>
        )}

        {viewMode === 'transitions' && (
          <p>
            This view shows the most common emotional transitions and their
            frequency. Understanding emotional shifts provides insight into
            emotional regulation patterns.
          </p>
        )}

        {viewMode === 'relationships' && (
          <p>
            Emotional relationships show correlations between different
            emotions. Positive correlations indicate emotions that tend to occur
            together, while negative correlations show emotions that rarely
            co-occur.
          </p>
        )}
      </div>
    </div>
  )
}
