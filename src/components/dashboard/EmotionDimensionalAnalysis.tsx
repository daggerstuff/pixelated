import { useState, useEffect } from 'react'
import type { FC } from 'react'

interface EmotionPoint {
  id: string
  timestamp: string
  valence: number
  arousal: number
  dominance: number
  emotion: string
  confidence: number
}

interface EmotionDimensionalAnalysisProps {
  userId: string
  className?: string
}

const EmotionDimensionalAnalysis: FC<EmotionDimensionalAnalysisProps> = ({
  userId,
  className,
}) => {
  const [emotionData, setEmotionData] = useState<EmotionPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDimensions, setSelectedDimensions] = useState({
    valence: true,
    arousal: true,
    dominance: false,
  })

  useEffect(() => {
    // Mock data for demonstration
    const mockData: EmotionPoint[] = [
      {
        id: '1',
        timestamp: '2024-01-15T10:30:00Z',
        valence: 0.7,
        arousal: 0.5,
        dominance: 0.6,
        emotion: 'joy',
        confidence: 0.85,
      },
      {
        id: '2',
        timestamp: '2024-01-15T11:00:00Z',
        valence: -0.3,
        arousal: 0.8,
        dominance: 0.2,
        emotion: 'anxiety',
        confidence: 0.78,
      },
      {
        id: '3',
        timestamp: '2024-01-15T11:30:00Z',
        valence: 0.1,
        arousal: 0.3,
        dominance: 0.5,
        emotion: 'calm',
        confidence: 0.92,
      },
      {
        id: '4',
        timestamp: '2024-01-15T12:00:00Z',
        valence: 0.5,
        arousal: 0.6,
        dominance: 0.7,
        emotion: 'excitement',
        confidence: 0.81,
      },
    ]

    setTimeout(() => {
      setEmotionData(mockData)
      setIsLoading(false)
    }, 1000)
  }, [userId])

  const handleDimensionToggle = (
    dimension: keyof typeof selectedDimensions,
  ) => {
    setSelectedDimensions((prev) => ({
      ...prev,
      [dimension]: !prev[dimension],
    }))
  }

  const getEmotionColor = (emotion: string): string => {
    const colors: Record<string, string> = {
      joy: '#FFC107',
      anxiety: '#F44336',
      calm: '#4CAF50',
      excitement: '#FF9800',
      sadness: '#2196F3',
      anger: '#F44336',
    }
    return colors[emotion] || '#9E9E9E'
  }

  if (isLoading) {
    return (
      <div className={`emotion-dimensional-analysis ${className || ''}`}>
        <div className='flex h-64 items-center justify-center'>
          <div className='text-gray-500 text-lg'>
            Loading emotion analysis...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`emotion-dimensional-analysis ${className || ''} space-y-6`}
    >
      <div className='bg-white rounded-lg p-6 shadow'>
        <h3 className='mb-4 text-xl font-semibold'>Dimensional Controls</h3>
        <div className='space-y-3'>
          {Object.entries(selectedDimensions).map(([dimension, isSelected]) => (
            <label key={dimension} className='flex items-center space-x-2'>
              <input
                type='checkbox'
                checked={isSelected}
                onChange={() =>
                  handleDimensionToggle(
                    dimension as keyof typeof selectedDimensions,
                  )
                }
                className='form-checkbox text-blue-600 h-4 w-4'
              />
              <span className='font-medium capitalize'>{dimension}</span>
              <span className='text-gray-500 text-sm'>
                {dimension === 'valence' && '(Positive/Negative)'}
                {dimension === 'arousal' && '(Energized/Calm)'}
                {dimension === 'dominance' && '(Control/Submissive)'}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className='bg-white rounded-lg p-6 shadow'>
        <h3 className='mb-4 text-xl font-semibold'>Emotion Plot</h3>
        <div
          className='bg-gray-50 relative rounded-lg p-4'
          style={{ height: '400px' }}
        >
          <svg width='100%' height='100%' viewBox='0 0 400 300'>
            {/* Axes */}
            <line
              x1='50'
              y1='250'
              x2='350'
              y2='250'
              stroke='#666'
              strokeWidth='2'
            />
            <line
              x1='50'
              y1='250'
              x2='50'
              y2='50'
              stroke='#666'
              strokeWidth='2'
            />

            {/* Labels */}
            <text
              x='200'
              y='280'
              textAnchor='middle'
              className='fill-gray-600 text-sm'
            >
              {selectedDimensions.valence
                ? 'Valence'
                : selectedDimensions.arousal
                  ? 'Arousal'
                  : 'Dominance'}
            </text>
            <text
              x='30'
              y='150'
              textAnchor='middle'
              className='fill-gray-600 text-sm'
              transform='rotate(-90, 30, 150)'
            >
              {selectedDimensions.arousal && selectedDimensions.valence
                ? 'Arousal'
                : selectedDimensions.dominance
                  ? 'Dominance'
                  : 'Arousal'}
            </text>

            {/* Data points */}
            {emotionData.map((point) => {
              let x = 50,
                y = 250

              if (selectedDimensions.valence && selectedDimensions.arousal) {
                x = 50 + (point.valence + 1) * 150 // Scale from -1,1 to 50,350
                y = 250 - point.arousal * 200 // Scale from 0,1 to 250,50
              } else if (
                selectedDimensions.valence &&
                selectedDimensions.dominance
              ) {
                x = 50 + (point.valence + 1) * 150
                y = 250 - point.dominance * 200
              } else if (
                selectedDimensions.arousal &&
                selectedDimensions.dominance
              ) {
                x = 50 + point.arousal * 300
                y = 250 - point.dominance * 200
              }

              return (
                <circle
                  key={point.id}
                  cx={x}
                  cy={y}
                  r='6'
                  fill={getEmotionColor(point.emotion)}
                  stroke='#fff'
                  strokeWidth='2'
                  opacity={point.confidence}
                >
                  <title>{`${point.emotion} (${new Date(point.timestamp).toLocaleTimeString()})`}</title>
                </circle>
              )
            })}
          </svg>
        </div>
      </div>

      <div className='bg-white rounded-lg p-6 shadow'>
        <h3 className='mb-4 text-xl font-semibold'>Emotion Timeline</h3>
        <div className='space-y-3'>
          {emotionData.map((point) => (
            <div
              key={point.id}
              className='bg-gray-50 flex items-center justify-between rounded-lg p-3'
            >
              <div className='flex items-center space-x-3'>
                <div
                  className='h-4 w-4 rounded-full'
                  style={{ backgroundColor: getEmotionColor(point.emotion) }}
                />
                <span className='font-medium capitalize'>{point.emotion}</span>
                <span className='text-gray-500 text-sm'>
                  {new Date(point.timestamp).toLocaleString()}
                </span>
              </div>
              <div className='text-right'>
                <div className='text-gray-600 text-sm'>
                  V: {point.valence.toFixed(2)} | A: {point.arousal.toFixed(2)}{' '}
                  | D: {point.dominance.toFixed(2)}
                </div>
                <div className='text-gray-500 text-xs'>
                  Confidence: {(point.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className='bg-white rounded-lg p-6 shadow'>
        <h3 className='mb-4 text-xl font-semibold'>Statistics</h3>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
          <div className='bg-blue-50 rounded-lg p-4 text-center'>
            <div className='text-blue-600 text-2xl font-bold'>
              {(
                emotionData.reduce((sum, p) => sum + p.valence, 0) /
                emotionData.length
              ).toFixed(2)}
            </div>
            <div className='text-gray-600 text-sm'>Average Valence</div>
          </div>
          <div className='bg-green-50 rounded-lg p-4 text-center'>
            <div className='text-green-600 text-2xl font-bold'>
              {(
                emotionData.reduce((sum, p) => sum + p.arousal, 0) /
                emotionData.length
              ).toFixed(2)}
            </div>
            <div className='text-gray-600 text-sm'>Average Arousal</div>
          </div>
          <div className='bg-purple-50 rounded-lg p-4 text-center'>
            <div className='text-purple-600 text-2xl font-bold'>
              {(
                emotionData.reduce((sum, p) => sum + p.dominance, 0) /
                emotionData.length
              ).toFixed(2)}
            </div>
            <div className='text-gray-600 text-sm'>Average Dominance</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmotionDimensionalAnalysis
