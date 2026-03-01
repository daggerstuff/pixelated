import React, { useState } from 'react'

// Use lazy-loaded chart components to reduce bundle size
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from '@/components/ui/LazyChart'
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
      <div className='bg-gray-50 flex items-center justify-center rounded-lg p-6'>
        <div className='flex w-full animate-pulse flex-col'>
          <div className='bg-gray-200 mb-2.5 h-4 w-3/4 rounded'></div>
          <div className='bg-gray-200 h-40 w-full rounded'></div>
        </div>
      </div>
    )
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className='bg-gray-50 flex flex-col items-center justify-center rounded-lg p-6'>
        <p className='text-gray-500 mb-2'>
          No emotion data available for this session
        </p>
        <p className='text-gray-400 text-sm'>
          Data will appear as the session progresses
        </p>
      </div>
    )
  }

  return (
    <div className={cn('p-4 bg-white rounded-lg shadow-sm', className)}>
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-gray-900 text-lg font-medium'>
          Emotional Dimensions
        </h3>

        <div className='flex space-x-2'>
          <select
            className='rounded border px-2 py-1 text-sm'
            value={timeRange}
            onChange={(e) =>
              setTimeRange(e.target.value as 'full' | '5min' | '10min')
            }
            aria-label='Select time range'
          >
            <option value='full'>Full Session</option>
            <option value='10min'>Last 10 Minutes</option>
            <option value='5min'>Last 5 Minutes</option>
          </select>
        </div>
      </div>

      {/* Dimension toggles */}
      <div className='mb-4 flex flex-wrap gap-2'>
        <button
          onClick={() => toggleDimension('valence')}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            dimensions.includes('valence')
              ? 'bg-blue-100 text-blue-800 border-blue-300 border'
              : 'bg-gray-100 text-gray-600 border-gray-200 border'
          }`}
          aria-pressed={dimensions.includes('valence')}
        >
          Valence (Positive/Negative)
        </button>
        <button
          onClick={() => toggleDimension('arousal')}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            dimensions.includes('arousal')
              ? 'bg-red-100 text-red-800 border-red-300 border'
              : 'bg-gray-100 text-gray-600 border-gray-200 border'
          }`}
          aria-pressed={dimensions.includes('arousal')}
        >
          Arousal (Calm/Excited)
        </button>
        <button
          onClick={() => toggleDimension('dominance')}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            dimensions.includes('dominance')
              ? 'bg-green-100 text-green-800 border-green-300 border'
              : 'bg-gray-100 text-gray-600 border-gray-200 border'
          }`}
          aria-pressed={dimensions.includes('dominance')}
        >
          Dominance (Control)
        </button>
      </div>

      {/* Chart */}
      <ResponsiveContainer width='100%' height={height}>
        <LineChart
          data={processedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis
            dataKey='timestamp'
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
              type='monotone'
              dataKey='valence'
              name='valence'
              stroke='#3b82f6'
              activeDot={{ r: 8 }}
              connectNulls
            />
          )}

          {dimensions.includes('arousal') && (
            <Line
              type='monotone'
              dataKey='arousal'
              name='arousal'
              stroke='#ef4444'
              activeDot={{ r: 8 }}
              connectNulls
            />
          )}

          {dimensions.includes('dominance') && (
            <Line
              type='monotone'
              dataKey='dominance'
              name='dominance'
              stroke='#22c55e'
              activeDot={{ r: 8 }}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend explanation */}
      <div className='border-gray-100 text-gray-500 mt-4 border-t pt-2 text-xs'>
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
