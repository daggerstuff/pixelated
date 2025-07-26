import React, { useState } from 'react'
import EmotionProgressDashboard from '../../components/analytics/EmotionProgressDashboard'
import useEmotionProgress from '../../hooks/useEmotionProgress'

const EmotionProgressDemo: React.FC = () => {
  const [timeRange, setTimeRange] = useState<
    'week' | 'month' | 'quarter' | 'year'
  >('month')

  const { data, isLoading, error } = useEmotionProgress({ timeRange })

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Emotion Progress Dashboard</h1>

      <p className="text-gray-600 mb-8">
        This dashboard visualizes emotional health progress over time, showing
        improvements across multiple dimensions, tracking risk factors, and
        measuring progress toward goals.
      </p>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p className="font-bold">Error</p>
          <p>{error.message}</p>
        </div>
      )}

      {data ? (
        <EmotionProgressDashboard
          progressData={data}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          isLoading={isLoading}
          className="mb-8"
        />
      ) : isLoading ? (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-10 bg-gray-200 rounded w-full"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-40 bg-gray-200 rounded"></div>
              <div className="h-40 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-100 rounded-lg p-6 text-center mb-8">
          <p className="text-gray-500">No emotion progress data available</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">
          About Emotion Progress Tracking
        </h2>

        <div className="space-y-4">
          <p>
            The Emotion Progress Dashboard provides a comprehensive view of
            emotional health improvements over time, helping users visualize
            their journey and identify areas of growth.
          </p>

          <h3 className="text-lg font-medium">Key Features:</h3>

          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Overall Progress:</strong> Track improvements in emotional
              well-being with metrics for overall improvement, stability, and
              changes in positive and negative emotions.
            </li>
            <li>
              <strong>Trend Analysis:</strong> Visualize emotional health trends
              over time to identify patterns, progress, and areas that may need
              attention.
            </li>
            <li>
              <strong>Risk Factor Tracking:</strong> Monitor changes in
              identified risk factors and track improvements over time.
            </li>
            <li>
              <strong>Goals & Achievements:</strong> Measure progress toward
              specific emotional health goals and track achievements.
            </li>
          </ul>

          <p>
            This visualization tool helps users understand their emotional
            health journey, celebrate progress, and identify areas for continued
            growth and improvement.
          </p>
        </div>
      </div>
    </div>
  )
}

export default EmotionProgressDemo
