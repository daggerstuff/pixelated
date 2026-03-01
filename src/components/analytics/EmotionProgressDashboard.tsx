import type { FC } from 'react'

interface EmotionProgressData {
  date: string
  overallProgress: number
  valenceScore: number
  arousalStability: number
  dominanceGains: number
  riskFactors: number
  goalProgress: number
}

interface EmotionProgressDashboardProps {
  data?: EmotionProgressData[]
  isLoading?: boolean
  error?: Error | null
  timeRange?: 'week' | 'month' | 'quarter' | 'year'
}

const EmotionProgressDashboard: FC<EmotionProgressDashboardProps> = ({
  data = [],
  isLoading = false,
  error = null,
  timeRange = 'month',
}) => {
  // Mock data for demo purposes
  const mockData: EmotionProgressData[] = [
    {
      date: '2024-01-01',
      overallProgress: 65,
      valenceScore: 72,
      arousalStability: 68,
      dominanceGains: 58,
      riskFactors: 25,
      goalProgress: 70,
    },
    {
      date: '2024-01-08',
      overallProgress: 72,
      valenceScore: 75,
      arousalStability: 74,
      dominanceGains: 65,
      riskFactors: 20,
      goalProgress: 78,
    },
    {
      date: '2024-01-15',
      overallProgress: 78,
      valenceScore: 80,
      arousalStability: 76,
      dominanceGains: 72,
      riskFactors: 18,
      goalProgress: 82,
    },
    {
      date: '2024-01-22',
      overallProgress: 85,
      valenceScore: 82,
      arousalStability: 84,
      dominanceGains: 79,
      riskFactors: 15,
      goalProgress: 88,
    },
  ]

  const displayData = data.length > 0 ? data : mockData

  const getProgressColor = (score: number) => {
    if (score >= 80) {
      return 'text-green-600 bg-green-100'
    } else if (score >= 60) {
      return 'text-yellow-600 bg-yellow-100'
    } else {
      return 'text-red-600 bg-red-100'
    }
  }

  const getRiskColor = (risk: number) => {
    if (risk <= 20) {
      return 'text-green-600 bg-green-100'
    } else if (risk <= 40) {
      return 'text-yellow-600 bg-yellow-100'
    } else {
      return 'text-red-600 bg-red-100'
    }
  }

  if (isLoading) {
    return (
      <div className='mx-auto w-full max-w-6xl p-6'>
        <div className='animate-pulse space-y-6'>
          <div className='bg-gray-200 h-8 w-1/3 rounded'></div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {[...Array(6)].map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className='bg-gray-200 h-32 rounded'
              ></div>
            ))}
          </div>
          <div className='bg-gray-200 h-64 rounded'></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='mx-auto w-full max-w-6xl p-6'>
        <div className='bg-red-50 border-red-200 rounded-lg border p-4'>
          <h3 className='text-red-800 mb-2 font-semibold'>
            Error Loading Progress Data
          </h3>
          <p className='text-red-600'>{String(error)}</p>
        </div>
      </div>
    )
  }

  const latestData = displayData[displayData.length - 1]

  return (
    <div className='mx-auto w-full max-w-6xl space-y-6 p-6'>
      <div className='mb-8 text-center'>
        <h1 className='text-gray-900 mb-2 text-3xl font-bold'>
          Emotion Progress Dashboard
        </h1>
        <p className='text-gray-600'>
          Tracking emotional health improvements over {timeRange}
        </p>
      </div>

      {/* Key Metrics */}
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
        <div className='bg-white rounded-lg border p-6 shadow-md'>
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='text-gray-900 text-lg font-semibold'>
                Overall Progress
              </h3>
              <p className='text-blue-600 mt-2 text-3xl font-bold'>
                {latestData?.overallProgress || 0}%
              </p>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-sm font-medium ${getProgressColor(latestData?.overallProgress || 0)}`}
            >
              {(latestData?.overallProgress || 0) >= 80
                ? 'Excellent'
                : (latestData?.overallProgress || 0) >= 60
                  ? 'Good'
                  : 'Needs Attention'}
            </div>
          </div>
        </div>

        <div className='bg-white rounded-lg border p-6 shadow-md'>
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='text-gray-900 text-lg font-semibold'>
                Valence Score
              </h3>
              <p className='text-green-600 mt-2 text-3xl font-bold'>
                {latestData?.valenceScore || 0}%
              </p>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-sm font-medium ${getProgressColor(latestData?.valenceScore || 0)}`}
            >
              Positive Emotions
            </div>
          </div>
        </div>

        <div className='bg-white rounded-lg border p-6 shadow-md'>
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='text-gray-900 text-lg font-semibold'>
                Risk Factors
              </h3>
              <p className='text-orange-600 mt-2 text-3xl font-bold'>
                {latestData?.riskFactors || 0}%
              </p>
            </div>
            <div
              className={`rounded-full px-3 py-1 text-sm font-medium ${getRiskColor(latestData?.riskFactors || 0)}`}
            >
              {(latestData?.riskFactors || 0) <= 20
                ? 'Low Risk'
                : (latestData?.riskFactors || 0) <= 40
                  ? 'Moderate'
                  : 'High Risk'}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <div className='bg-white rounded-lg border p-6 shadow-md'>
          <h3 className='text-gray-900 mb-4 text-xl font-semibold'>
            Emotional Dimensions
          </h3>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <span className='text-gray-700'>Arousal Stability</span>
              <div className='flex items-center space-x-2'>
                <div className='bg-gray-200 h-2 w-32 rounded-full'>
                  <div
                    className='bg-blue-600 h-2 rounded-full transition-all duration-300'
                    style={{ width: `${latestData?.arousalStability || 0}%` }}
                  ></div>
                </div>
                <span className='text-sm font-medium'>
                  {latestData?.arousalStability || 0}%
                </span>
              </div>
            </div>

            <div className='flex items-center justify-between'>
              <span className='text-gray-700'>Dominance Gains</span>
              <div className='flex items-center space-x-2'>
                <div className='bg-gray-200 h-2 w-32 rounded-full'>
                  <div
                    className='bg-purple-600 h-2 rounded-full transition-all duration-300'
                    style={{ width: `${latestData?.dominanceGains || 0}%` }}
                  ></div>
                </div>
                <span className='text-sm font-medium'>
                  {latestData?.dominanceGains || 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className='bg-white rounded-lg border p-6 shadow-md'>
          <h3 className='text-gray-900 mb-4 text-xl font-semibold'>
            Goal Achievement
          </h3>
          <div className='text-center'>
            <div className='from-green-400 to-blue-500 text-white mb-4 inline-flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-r text-xl font-bold'>
              {latestData?.goalProgress || 0}%
            </div>
            <p className='text-gray-600'>
              {(latestData?.goalProgress || 0) >= 80
                ? 'Exceeding expectations!'
                : (latestData?.goalProgress || 0) >= 60
                  ? 'Great progress!'
                  : 'Keep working toward your goals'}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Chart */}
      <div className='bg-white rounded-lg border p-6 shadow-md'>
        <h3 className='text-gray-900 mb-4 text-xl font-semibold'>
          Progress Over Time
        </h3>
        <div className='bg-gray-50 flex h-64 items-end justify-center space-x-4 rounded p-4'>
          {displayData.map((point) => (
            <div
              key={point.date}
              className='flex flex-col items-center space-y-2'
            >
              <div className='flex flex-col items-center space-y-1'>
                {/* Overall Progress Bar */}
                <div
                  className='bg-blue-500 w-8 rounded-t'
                  style={{ height: `${(point.overallProgress / 100) * 200}px` }}
                  title={`Overall: ${point.overallProgress}%`}
                ></div>
                {/* Valence Bar */}
                <div
                  className='bg-green-500 w-6 rounded-t'
                  style={{ height: `${(point.valenceScore / 100) * 160}px` }}
                  title={`Valence: ${point.valenceScore}%`}
                ></div>
                {/* Goal Progress Bar */}
                <div
                  className='bg-purple-500 w-4 rounded-t'
                  style={{ height: `${(point.goalProgress / 100) * 120}px` }}
                  title={`Goals: ${point.goalProgress}%`}
                ></div>
              </div>
              <span className='text-gray-600 origin-left rotate-45 transform text-xs'>
                {new Date(point.date).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className='mt-4 flex justify-center space-x-6 text-sm'>
          <div className='flex items-center'>
            <div className='bg-blue-500 mr-2 h-4 w-4 rounded'></div>
            <span>Overall Progress</span>
          </div>
          <div className='flex items-center'>
            <div className='bg-green-500 mr-2 h-4 w-4 rounded'></div>
            <span>Valence Score</span>
          </div>
          <div className='flex items-center'>
            <div className='bg-purple-500 mr-2 h-4 w-4 rounded'></div>
            <span>Goal Progress</span>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className='from-blue-50 to-purple-50 rounded-lg border bg-gradient-to-r p-6'>
        <h3 className='text-gray-900 mb-4 text-xl font-semibold'>
          Key Insights
        </h3>
        <div className='grid grid-cols-1 gap-4 text-sm md:grid-cols-2'>
          <div className='bg-white rounded p-4'>
            <h4 className='text-green-700 mb-2 font-semibold'>
              ✓ Positive Trends
            </h4>
            <ul className='text-gray-600 space-y-1'>
              <li>• Overall emotional stability has improved by 20%</li>
              <li>• Positive emotion frequency increased</li>
              <li>• Risk factors have decreased significantly</li>
            </ul>
          </div>
          <div className='bg-white rounded p-4'>
            <h4 className='text-blue-700 mb-2 font-semibold'>
              💡 Recommendations
            </h4>
            <ul className='text-gray-600 space-y-1'>
              <li>• Continue current coping strategies</li>
              <li>• Focus on arousal regulation techniques</li>
              <li>• Maintain regular check-ins</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmotionProgressDashboard
