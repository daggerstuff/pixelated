import React, { useState } from 'react'

import EmotionProgressDashboard from '../../components/analytics/EmotionProgressDashboard'
import useEmotionProgress from '../../hooks/useEmotionProgress'

const EmotionProgressDemo: FC = () => {
  const [timeRange, setTimeRange] = useState<
    'week' | 'month' | 'quarter' | 'year'
  >('month')

  const { data, isLoading, error } = useEmotionProgress({ timeRange })

  return (
    <div className='container mx-auto px-4 py-8'>
      <h1 className='mb-6 text-3xl font-bold'>Emotion Progress Dashboard</h1>

      <p className='text-gray-600 mb-8'>
        This dashboard visualizes emotional health progress over time, showing
        improvements across multiple dimensions, tracking risk factors, and
        measuring progress toward goals.
      </p>

      {error && (
        <div className='bg-red-100 border-red-500 text-red-700 mb-6 border-l-4 p-4'>
          <p className='font-bold'>Error</p>
          <p>{String(error)}</p>
        </div>
      )}

      {data ? (
        <EmotionProgressDashboard
          progressData={data}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          isLoading={isLoading}
          className='mb-8'
        />
      ) : isLoading ? (
        <div className='bg-white mb-8 rounded-lg p-6 shadow'>
          <div className='animate-pulse space-y-4'>
            <div className='bg-gray-200 h-4 w-1/4 rounded'></div>
            <div className='bg-gray-200 h-10 w-full rounded'></div>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div className='bg-gray-200 h-40 rounded'></div>
              <div className='bg-gray-200 h-40 rounded'></div>
            </div>
          </div>
        </div>
      ) : (
        <div className='bg-gray-100 mb-8 rounded-lg p-6 text-center'>
          <p className='text-gray-500'>No emotion progress data available</p>
        </div>
      )}

      <div className='bg-white rounded-lg p-6 shadow-md'>
        <h2 className='mb-4 text-xl font-semibold'>
          About Emotion Progress Tracking
        </h2>

        <div className='space-y-4'>
          <p>
            The Emotion Progress Dashboard provides a comprehensive view of
            emotional health improvements over time, helping users visualize
            their journey and identify areas of growth.
          </p>

          <h3 className='text-lg font-medium'>Key Features:</h3>

          <ul className='list-disc space-y-2 pl-5'>
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
