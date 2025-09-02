import React, { useState } from 'react'
import type { FC } from 'react'
import { useParams } from 'react-router-dom'
import MultidimensionalEmotionChart from '../dashboard/MultidimensionalEmotionChart'
import useMultidimensionalEmotions from '../../hooks/useMultidimensionalEmotions'

const EmotionVisualizationPage: FC = () => {
  const { clientId } = useParams<{ clientId: string }>()
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>(
    'week',
  )
  const [dataPoints, setDataPoints] = useState<number>(50)

  const {
    data: emotionData,
    isLoading,
    error,
  } = useMultidimensionalEmotions(clientId || 'unknown', timeRange, dataPoints)

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">3D Emotion Visualization</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {String(error)}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label htmlFor="timeRange" className="block text-sm font-medium mb-1">
            Time Range
          </label>
          <select
            id="timeRange"
            value={timeRange}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setTimeRange(e.target.value as 'day' | 'week' | 'month' | 'year')
            }
            className="border rounded px-3 py-2"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="dataPoints"
            className="block text-sm font-medium mb-1"
          >
            Data Points
          </label>
          <input
            id="dataPoints"
            type="number"
            min="5"
            max="200"
            value={dataPoints}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setDataPoints(Number(e.target.value))
            }
            className="border rounded px-3 py-2 w-24"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="h-[600px]">
          <MultidimensionalEmotionChart
            emotionData={emotionData}
            isLoading={isLoading}
          />
        </div>
      </div>

      <div className="mt-8 bg-gray-100 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">
          About the 3D Emotion Visualization
        </h2>
        <p className="mb-3">
          This visualization uses the PAD (Pleasure-Arousal-Dominance) emotional
          state model to represent emotions in a three-dimensional space:
        </p>
        <ul className="list-disc pl-5 mb-3">
          <li>
            <strong>Valence (X-axis):</strong> Represents pleasure-displeasure,
            ranging from negative to positive feelings.
          </li>
          <li>
            <strong>Arousal (Y-axis):</strong> Represents
            activation-deactivation, ranging from calm to excited states.
          </li>
          <li>
            <strong>Dominance (Z-axis):</strong> Represents
            dominance-submissiveness, ranging from feeling controlled to in
            control.
          </li>
        </ul>
        <p>
          The connected points show how emotional states have changed over time,
          with the newest data points appearing in brighter colors.
        </p>
      </div>
    </div>
  )
}

export default EmotionVisualizationPage
