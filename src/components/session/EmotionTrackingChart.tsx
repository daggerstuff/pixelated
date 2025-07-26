import React, { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'

// Define types for our component

type EmotionTimelineData = {
  timestamp: string
  valence: number
  arousal: number
  dominance: number
  label?: string
}

interface EmotionTrackingChartProps {
  data?: EmotionTimelineData[]
  height?: number
  className?: string
  isLoading?: boolean
}

/**
 * EmotionTrackingChart - Visualizes emotional states during therapy sessions
 *
 * This component creates a timeline visualization of emotional dimensions (valence,
 * arousal, dominance) to help therapists identify patterns during sessions.
 */
export default function EmotionTrackingChart({
  data = [],
  height = 300,
  className,
  isLoading = false,
}: EmotionTrackingChartProps) {
  const [timeRange, setTimeRange] = useState<'full' | '5min' | '10min'>('full')
  const [dimensions, setDimensions] = useState<string[]>([
    'valence',
    'arousal',
    'dominance',
  ])

  // Process the data based on selected time range
  const processedData = React.useMemo(() => {
    if (data.length === 0) {
      return []
    }

    // Time filtering logic
    let filteredData = [...data]
    if (timeRange !== 'full') {
      const now = new Date()
      const cutoffTime = new Date(
        now.getTime() - (timeRange === '5min' ? 5 : 10) * 60000,
      )
      filteredData = data.filter(
        (item) => new Date(item.timestamp) >= cutoffTime,
      )
    }

    return filteredData
  }, [data, timeRange])

  const toggleDimension = (dimension: string) => {
    setDimensions((prev) =>
      prev.includes(dimension)
        ? prev.filter((d) => d !== dimension)
        : [...prev, dimension],
    )
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

  // Empty state
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg">
        <p className="text-gray-500 mb-2">
          No emotion data available for this session
        </p>
        <p className="text-sm text-gray-400">
          Data will appear as the session progresses
        </p>
      </div>
    )
  }

  return (
    <div className={cn('p-4 bg-white rounded-lg shadow-sm', className)}>
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">
          Emotional Dimensions
        </h3>

        <div className="flex space-x-2">
          <select
            className="text-sm border rounded px-2 py-1"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as 'full' | '5min' | '10min')}
            aria-label="Select time range"
          >
            <option value="full">Full Session</option>
            <option value="10min">Last 10 Minutes</option>
            <option value="5min">Last 5 Minutes</option>
          </select>
        </div>
      </div>

      {/* Dimension toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => toggleDimension('valence')}
          className={`text-xs px-3 py-1 rounded-full transition-colors ${
            dimensions.includes('valence')
              ? 'bg-blue-100 text-blue-800 border border-blue-300'
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}
          aria-pressed={dimensions.includes('valence')}
        >
          Valence (Positive/Negative)
        </button>
        <button
          onClick={() => toggleDimension('arousal')}
          className={`text-xs px-3 py-1 rounded-full transition-colors ${
            dimensions.includes('arousal')
              ? 'bg-red-100 text-red-800 border border-red-300'
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}
          aria-pressed={dimensions.includes('arousal')}
        >
          Arousal (Calm/Excited)
        </button>
        <button
          onClick={() => toggleDimension('dominance')}
          className={`text-xs px-3 py-1 rounded-full transition-colors ${
            dimensions.includes('dominance')
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-gray-100 text-gray-600 border border-gray-200'
          }`}
          aria-pressed={dimensions.includes('dominance')}
        >
          Dominance (Control)
        </button>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={processedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(tick) =>
              new Date(tick).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            }
          />

          <YAxis domain={[0, 10]} />
          <Tooltip
            formatter={(value, name) => {
              const dimensionLabels: Record<string, string> = {
                valence: 'Valence (Positive/Negative)',
                arousal: 'Arousal (Calm/Excited)',
                dominance: 'Dominance (Control)',
              }
              return [`${value}/10`, dimensionLabels[name] || name]
            }}
            labelFormatter={(label) => new Date(label).toLocaleTimeString()}
          />

          <Legend />

          {dimensions.includes('valence') && (
            <Line
              type="monotone"
              dataKey="valence"
              name="valence"
              stroke="#3b82f6"
              activeDot={{ r: 8 }}
              connectNulls
            />
          )}

          {dimensions.includes('arousal') && (
            <Line
              type="monotone"
              dataKey="arousal"
              name="arousal"
              stroke="#ef4444"
              activeDot={{ r: 8 }}
              connectNulls
            />
          )}

          {dimensions.includes('dominance') && (
            <Line
              type="monotone"
              dataKey="dominance"
              name="dominance"
              stroke="#22c55e"
              activeDot={{ r: 8 }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend explanation */}
      <div className="mt-4 pt-2 border-t border-gray-100 text-xs text-gray-500">
        <p>
          <strong>Valence:</strong> How positive or negative the emotional state
          (0-10)
        </p>
        <p>
          <strong>Arousal:</strong> The intensity level of the emotion (0-10)
        </p>
        <p>
          <strong>Dominance:</strong> Feeling of control over the emotional
          state (0-10)
        </p>
      </div>
    </div>
  )
}
