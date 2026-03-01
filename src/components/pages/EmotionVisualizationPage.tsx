import React, { useState } from 'react'
import { useParams } from 'react-router-dom'

import useMultidimensionalEmotions from '../../hooks/useMultidimensionalEmotions'
import MultidimensionalEmotionChart from '../dashboard/MultidimensionalEmotionChart'

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
    <div className='container mx-auto px-4 py-8'>
      <h1 className='mb-6 text-3xl font-bold'>3D Emotion Visualization</h1>

      {error && (
        <div className='bg-red-100 border-red-400 text-red-700 mb-4 rounded border px-4 py-3'>
          Error: {String(error)}
        </div>
      )}

      <div className='mb-6 flex flex-wrap gap-4'>
        <div>
          <label htmlFor='timeRange' className='mb-1 block text-sm font-medium'>
            Time Range
          </label>
          <select
            id='timeRange'
            value={timeRange}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setTimeRange(e.target.value as 'day' | 'week' | 'month' | 'year')
            }
            className='rounded border px-3 py-2'
          >
            <option value='day'>Day</option>
            <option value='week'>Week</option>
            <option value='month'>Month</option>
            <option value='year'>Year</option>
          </select>
        </div>

        <div>
          <label
            htmlFor='dataPoints'
            className='mb-1 block text-sm font-medium'
          >
            Data Points
          </label>
          <input
            id='dataPoints'
            type='number'
            min='5'
            max='200'
            value={dataPoints}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setDataPoints(Number(e.target.value))
            }
            className='w-24 rounded border px-3 py-2'
          />
        </div>
      </div>

      <div className='bg-white rounded-lg p-4 shadow-lg'>
        <div className='h-[600px]'>
          <MultidimensionalEmotionChart
            emotionData={emotionData}
            isLoading={isLoading}
          />
        </div>
      </div>

      <div className='bg-gray-100 mt-8 rounded-lg p-4'>
        <h2 className='mb-3 text-xl font-semibold'>
          About the 3D Emotion Visualization
        </h2>
        <p className='mb-3'>
          This visualization uses the PAD (Pleasure-Arousal-Dominance) emotional
          state model to represent emotions in a three-dimensional space:
        </p>
        <ul className='mb-3 list-disc pl-5'>
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
