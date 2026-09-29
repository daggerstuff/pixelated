import { LightBulbIcon } from '@heroicons/react/24/outline'
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

// Extracted static mockData and helper functions outside component to prevent unnecessary memory allocations on each render.
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

// Bounded §2.1 chart-mark palette: three series in the progress chart.
// Defined once, referenced by both the bars and the legend swatches.
const SERIES_PALETTE = {
  overall: 'bg-blue-500',
  valence: 'bg-green-500',
  goals: 'bg-purple-500',
} as const

const getProgressColor = (score: number) => {
  if (score >= 80) {
    return 'text-foreground bg-secondary border border-input'
  } else if (score >= 60) {
    return 'text-foreground font-medium bg-secondary border border-ring'
  } else {
    return 'text-foreground font-semibold bg-card border border-ring'
  }
}

const getRiskColor = (risk: number) => {
  if (risk <= 20) {
    return 'text-foreground bg-secondary border border-input'
  } else if (risk <= 40) {
    return 'text-foreground font-medium bg-secondary border border-ring'
  } else {
    return 'text-foreground font-semibold bg-card border border-ring'
  }
}

const EmotionProgressDashboard: FC<EmotionProgressDashboardProps> = ({
  data = [],
  isLoading = false,
  error = null,
  timeRange = 'month',
}) => {
  const displayData = data.length > 0 ? data : mockData

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-1/3 rounded-none bg-secondary"></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="h-32 rounded-none bg-secondary"
              ></div>
            ))}
          </div>
          <div className="h-64 rounded-none bg-secondary"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="rounded-none border border-ring bg-card p-4">
          <h3 className="mb-2 font-semibold text-foreground">
            Error Loading Progress Data
          </h3>
          <p className="font-medium text-foreground">{String(error)}</p>
        </div>
      </div>
    )
  }

  const latestData = displayData[displayData.length - 1]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          Emotion Progress Dashboard
        </h1>
        <p className="text-muted-foreground">
          Tracking emotional health improvements over {timeRange}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-none border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Overall Progress
              </h3>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {latestData?.overallProgress ?? 0}%
              </p>
            </div>
            <div
              className={`rounded-none border px-3 py-1 text-sm font-medium ${getProgressColor(latestData?.overallProgress ?? 0)}`}
            >
              {(latestData?.overallProgress ?? 0) >= 80
                ? 'Excellent'
                : (latestData?.overallProgress ?? 0) >= 60
                  ? 'Good'
                  : 'Needs Attention'}
            </div>
          </div>
        </div>

        <div className="rounded-none border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Valence Score
              </h3>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {latestData?.valenceScore ?? 0}%
              </p>
            </div>
            <div
              className={`rounded-none border px-3 py-1 text-sm font-medium ${getProgressColor(latestData?.valenceScore ?? 0)}`}
            >
              Positive Emotions
            </div>
          </div>
        </div>

        <div className="rounded-none border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Risk Factors
              </h3>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {latestData?.riskFactors ?? 0}%
              </p>
            </div>
            <div
              className={`rounded-none border px-3 py-1 text-sm font-medium ${getRiskColor(latestData?.riskFactors ?? 0)}`}
            >
              {(latestData?.riskFactors ?? 0) <= 20
                ? 'Low Risk'
                : (latestData?.riskFactors ?? 0) <= 40
                  ? 'Moderate'
                  : 'High Risk'}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-none border border-border bg-card p-6">
          <h3 className="mb-4 text-xl font-semibold text-foreground">
            Emotional Dimensions
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-foreground">Arousal Stability</span>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-32 rounded-none bg-secondary">
                  <div
                    className="h-2 rounded-none bg-primary transition-all duration-300"
                    style={{ width: `${latestData?.arousalStability ?? 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium">
                  {latestData?.arousalStability ?? 0}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-foreground">Dominance Gains</span>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-32 rounded-none bg-secondary">
                  <div
                    className="h-2 rounded-none bg-primary transition-all duration-300"
                    style={{ width: `${latestData?.dominanceGains ?? 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium">
                  {latestData?.dominanceGains ?? 0}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-none border border-border bg-card p-6">
          <h3 className="mb-4 text-xl font-semibold text-foreground">
            Goal Achievement
          </h3>
          <div className="text-center">
            <div className="mb-4 inline-flex h-24 w-24 items-center justify-center rounded-none bg-primary text-xl font-bold text-primary-foreground">
              {latestData?.goalProgress ?? 0}%
            </div>
            <p className="text-muted-foreground">
              {(latestData?.goalProgress ?? 0) >= 80
                ? 'Exceeding expectations!'
                : (latestData?.goalProgress ?? 0) >= 60
                  ? 'Great progress!'
                  : 'Keep working toward your goals'}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Chart */}
      <div className="rounded-none border border-border bg-card p-6">
        <h3 className="mb-4 text-xl font-semibold text-foreground">
          Progress Over Time
        </h3>
        <div className="flex h-64 items-end justify-center space-x-4 rounded-none bg-secondary p-4">
          {displayData.map((point) => (
            <div
              key={point.date}
              className="flex flex-col items-center space-y-2"
            >
              <div className="flex flex-col items-center space-y-1">
                {/* Overall Progress Bar */}
                <div
                  className={`${SERIES_PALETTE.overall} w-8`}
                  style={{ height: `${(point.overallProgress / 100) * 200}px` }}
                  title={`Overall: ${point.overallProgress}%`}
                ></div>
                {/* Valence Bar */}
                <div
                  className={`${SERIES_PALETTE.valence} w-6`}
                  style={{ height: `${(point.valenceScore / 100) * 160}px` }}
                  title={`Valence: ${point.valenceScore}%`}
                ></div>
                {/* Goal Progress Bar */}
                <div
                  className={`${SERIES_PALETTE.goals} w-4`}
                  style={{ height: `${(point.goalProgress / 100) * 120}px` }}
                  title={`Goals: ${point.goalProgress}%`}
                ></div>
              </div>
              <span className="origin-left rotate-45 transform text-xs text-muted-foreground">
                {new Date(point.date).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex justify-center space-x-6 text-sm">
          <div className="flex items-center">
            <div className={`${SERIES_PALETTE.overall} mr-2 h-4 w-4`}></div>
            <span>Overall Progress</span>
          </div>
          <div className="flex items-center">
            <div className={`${SERIES_PALETTE.valence} mr-2 h-4 w-4`}></div>
            <span>Valence Score</span>
          </div>
          <div className="flex items-center">
            <div className={`${SERIES_PALETTE.goals} mr-2 h-4 w-4`}></div>
            <span>Goal Progress</span>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="rounded-none border border-border bg-secondary p-6">
        <h3 className="mb-4 text-xl font-semibold text-foreground">
          Key Insights
        </h3>
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div className="rounded-none bg-card p-4">
            <h4 className="mb-2 font-semibold text-foreground">
              ✓ Positive Trends
            </h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Overall emotional stability has improved by 20%</li>
              <li>• Positive emotion frequency increased</li>
              <li>• Risk factors have decreased significantly</li>
            </ul>
          </div>
          <div className="rounded-none bg-card p-4">
            <h4 className="mb-2 font-semibold text-foreground">
              <LightBulbIcon className="h-5 w-5" /> Recommendations
            </h4>
            <ul className="space-y-1 text-muted-foreground">
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
