import React, { useState } from 'react'

import MultidimensionalEmotionChart from '../../components/dashboard/MultidimensionalEmotionChart'
import { useMultidimensionalEmotions } from '../../hooks/useMultidimensionalEmotions'

type TimeRange = 'day' | 'week' | 'month' | 'year'

const EmotionVisualizationDemo: FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [dataPoints, setDataPoints] = useState<number>(100)
  const [selectedEmotionIndex, setSelectedEmotionIndex] = useState<
    number | null
  >(null)

  // Use a demo clientId for visualization purposes
  const DEMO_CLIENT_ID = 'demo-client'
  const { data, isLoading, error } = useMultidimensionalEmotions(
    DEMO_CLIENT_ID,
    timeRange,
    dataPoints,
  )

  const handleTimeRangeChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setTimeRange(event.target.value as TimeRange)
  }

  const handleDataPointsChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setDataPoints(Number(event.target.value))
  }

  const handleEmotionSelect = (index: number) => {
    setSelectedEmotionIndex(index === selectedEmotionIndex ? null : index)
  }

  const selectedEmotion =
    selectedEmotionIndex !== null ? data[selectedEmotionIndex] : null

  // Format timestamp to readable date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className='bg-gray-50 dark:bg-gray-900 min-h-screen'>
      <header className='bg-white dark:bg-gray-800 py-4 shadow-sm'>
        <div className='container mx-auto px-4'>
          <h1 className='text-gray-900 dark:text-white text-2xl font-bold'>
            3D Emotion Visualization
          </h1>
        </div>
      </header>

      <main className='container mx-auto px-4 py-8'>
        <p className='text-gray-700 dark:text-gray-300 mb-6'>
          This demo visualizes emotions in a 3D space using the PAD
          (Pleasure-Arousal-Dominance) model. The visualization shows how
          emotions change over time, with each point representing an emotional
          state.
        </p>

        <div className='grid grid-cols-1 gap-6 md:grid-cols-4'>
          {/* Controls */}
          <div className='bg-white dark:bg-gray-800 col-span-1 rounded-lg p-4 shadow'>
            <h2 className='mb-4 text-xl font-semibold'>Controls</h2>

            <div className='mb-4'>
              <label
                htmlFor='timeRangeSelect'
                className='mb-1 block text-sm font-medium'
              >
                Time Range
              </label>
              <select
                id='timeRangeSelect'
                value={timeRange}
                onChange={handleTimeRangeChange}
                className='bg-white dark:bg-gray-700 dark:text-white w-full rounded border p-2'
              >
                <option value='day'>Last 24 Hours</option>
                <option value='week'>Last Week</option>
                <option value='month'>Last Month</option>
                <option value='year'>Last Year</option>
              </select>
            </div>

            <div className='mb-4'>
              <label
                htmlFor='dataPointsInput'
                className='mb-1 block text-sm font-medium'
              >
                Data Points: {dataPoints}
              </label>
              <input
                id='dataPointsInput'
                type='range'
                min='10'
                max='500'
                step='10'
                value={dataPoints}
                onChange={handleDataPointsChange}
                className='w-full'
              />

              <div className='mt-1 flex justify-between text-xs'>
                <span>10</span>
                <span>250</span>
                <span>500</span>
              </div>
            </div>

            {selectedEmotion && (
              <div className='bg-gray-50 dark:bg-gray-700 mb-4 rounded-lg border p-3'>
                <h3 className='mb-2 text-lg font-medium'>Selected Emotion</h3>
                <p className='mb-1 text-sm'>
                  <strong>Time:</strong> {formatDate(selectedEmotion.timestamp)}
                </p>
                <p className='mb-1 text-sm'>
                  <strong>Valence:</strong> {selectedEmotion.valence.toFixed(2)}
                </p>
                <p className='mb-1 text-sm'>
                  <strong>Arousal:</strong> {selectedEmotion.arousal.toFixed(2)}
                </p>
                <p className='mb-1 text-sm'>
                  <strong>Dominance:</strong>{' '}
                  {selectedEmotion.dominance.toFixed(2)}
                </p>
                <p className='text-sm'>
                  <strong>Emotion:</strong>{' '}
                  {selectedEmotion.emotion || 'Unknown'}
                </p>
              </div>
            )}

            <h3 className='mb-2 text-lg font-medium'>Legend</h3>
            <div className='space-y-2 text-sm'>
              <p>
                <strong>Valence (X-axis):</strong> Pleasure to displeasure
              </p>
              <p>
                <strong>Arousal (Y-axis):</strong> Activation to deactivation
              </p>
              <p>
                <strong>Dominance (Z-axis):</strong> Dominance to submissiveness
              </p>
            </div>
          </div>

          {/* 3D Visualization */}
          <div className='bg-white dark:bg-gray-800 col-span-1 rounded-lg p-4 shadow md:col-span-3'>
            <div
              style={{ height: '600px' }}
              aria-busy={isLoading}
              aria-live='polite'
              aria-describedby={error ? 'emotion-error' : undefined}
            >
              <MultidimensionalEmotionChart
                emotionData={data}
                isLoading={isLoading}
              />

              {error && (
                <p id='emotion-error' className='text-red-500 mt-2'>
                  Error loading emotion data: {String(error)}
                </p>
              )}
            </div>
          </div>

          {/* Data Table */}
          <div className='bg-white dark:bg-gray-800 col-span-1 rounded-lg p-4 shadow md:col-span-4'>
            <h2 className='mb-4 text-xl font-semibold'>Emotion Data Points</h2>

            <div className='max-h-[300px] overflow-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='bg-gray-50 dark:bg-gray-700'>
                    <th className='border-b p-2 text-left'>Time</th>
                    <th className='border-b p-2 text-left'>Valence</th>
                    <th className='border-b p-2 text-left'>Arousal</th>
                    <th className='border-b p-2 text-left'>Dominance</th>
                    <th className='border-b p-2 text-left'>Emotion</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((point, index) => (
                    <tr
                      key={point.timestamp}
                      onClick={() => handleEmotionSelect(index)}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleEmotionSelect(index)
                        }
                      }}
                      tabIndex={0}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${selectedEmotionIndex === index ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <td className='border-b p-2'>
                        {formatDate(point.timestamp)}
                      </td>
                      <td className='border-b p-2'>
                        {point.valence.toFixed(2)}
                      </td>
                      <td className='border-b p-2'>
                        {point.arousal.toFixed(2)}
                      </td>
                      <td className='border-b p-2'>
                        {point.dominance.toFixed(2)}
                      </td>
                      <td className='border-b p-2'>
                        {point.emotion || 'Unknown'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default EmotionVisualizationDemo
