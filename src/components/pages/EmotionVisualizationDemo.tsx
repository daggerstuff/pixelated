import React, { useState } from 'react'
import { useMultidimensionalEmotions } from '../../hooks/useMultidimensionalEmotions'
import MultidimensionalEmotionChart from '../../components/dashboard/MultidimensionalEmotionChart'

type TimeRange = 'day' | 'week' | 'month' | 'year'

const EmotionVisualizationDemo: React.FC = () => {
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm py-4">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            3D Emotion Visualization
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <p className="mb-6 text-gray-700 dark:text-gray-300">
          This demo visualizes emotions in a 3D space using the PAD
          (Pleasure-Arousal-Dominance) model. The visualization shows how
          emotions change over time, with each point representing an emotional
          state.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Controls */}
          <div className="col-span-1 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Controls</h2>

            <div className="mb-4">
              <label
                htmlFor="timeRangeSelect"
                className="block text-sm font-medium mb-1"
              >
                Time Range
              </label>
              <select
                id="timeRangeSelect"
                value={timeRange}
                onChange={handleTimeRangeChange}
                className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:text-white"
              >
                <option value="day">Last 24 Hours</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="year">Last Year</option>
              </select>
            </div>

            <div className="mb-4">
              <label
                htmlFor="dataPointsInput"
                className="block text-sm font-medium mb-1"
              >
                Data Points: {dataPoints}
              </label>
              <input
                id="dataPointsInput"
                type="range"
                min="10"
                max="500"
                step="10"
                value={dataPoints}
                onChange={handleDataPointsChange}
                className="w-full"
              />

              <div className="flex justify-between text-xs mt-1">
                <span>10</span>
                <span>250</span>
                <span>500</span>
              </div>
            </div>

            {selectedEmotion && (
              <div className="mb-4 p-3 border rounded-lg bg-gray-50 dark:bg-gray-700">
                <h3 className="text-lg font-medium mb-2">Selected Emotion</h3>
                <p className="text-sm mb-1">
                  <strong>Time:</strong> {formatDate(selectedEmotion.timestamp)}
                </p>
                <p className="text-sm mb-1">
                  <strong>Valence:</strong> {selectedEmotion.valence.toFixed(2)}
                </p>
                <p className="text-sm mb-1">
                  <strong>Arousal:</strong> {selectedEmotion.arousal.toFixed(2)}
                </p>
                <p className="text-sm mb-1">
                  <strong>Dominance:</strong>{' '}
                  {selectedEmotion.dominance.toFixed(2)}
                </p>
                <p className="text-sm">
                  <strong>Emotion:</strong>{' '}
                  {selectedEmotion.emotion || 'Unknown'}
                </p>
              </div>
            )}

            <h3 className="text-lg font-medium mb-2">Legend</h3>
            <div className="space-y-2 text-sm">
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
          <div className="col-span-1 md:col-span-3 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <div style={{ height: '600px' }}>
              <MultidimensionalEmotionChart
                emotionData={data}
                isLoading={isLoading}
              />

              {error && (
                <p className="text-red-500 mt-2">
                  Error loading emotion data: {error.message}
                </p>
              )}
            </div>
          </div>

          {/* Data Table */}
          <div className="col-span-1 md:col-span-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Emotion Data Points</h2>

            <div className="overflow-auto max-h-[300px]">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <th className="text-left p-2 border-b">Time</th>
                    <th className="text-left p-2 border-b">Valence</th>
                    <th className="text-left p-2 border-b">Arousal</th>
                    <th className="text-left p-2 border-b">Dominance</th>
                    <th className="text-left p-2 border-b">Emotion</th>
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
                      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700
                        ${selectedEmotionIndex === index ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <td className="p-2 border-b">
                        {formatDate(point.timestamp)}
                      </td>
                      <td className="p-2 border-b">
                        {point.valence.toFixed(2)}
                      </td>
                      <td className="p-2 border-b">
                        {point.arousal.toFixed(2)}
                      </td>
                      <td className="p-2 border-b">
                        {point.dominance.toFixed(2)}
                      </td>
                      <td className="p-2 border-b">
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
