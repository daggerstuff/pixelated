import { useMemo, memo } from 'react'

// Use lazy-loaded chart components to reduce bundle size
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from '@/components/ui/LazyChart'

interface MentalHealthHistoryChartProps {
  analysisHistory: Array<{
    hasMentalHealthIssue: boolean
    confidence: number
    supportingEvidence: string[]
    scores: ScoreValues
  }>
}

const SCORE_KEYS = [
  'anger',
  'anxiety',
  'bipolarDisorder',
  'depression',
  'eatingDisorder',
  'ocd',
  'panicDisorder',
  'socialAnxiety',
  'socialIsolation',
  'stress',
] as const

type ScoreMetric = (typeof SCORE_KEYS)[number]

type ScoreValues = {
  [K in ScoreMetric]: number
}

// Bounded categorical palette (Okabe-Ito, colorblind-safe) — series marks per DESIGN.md §2.1.
const scorePalette = [
  '#E69F00', // orange
  '#56B4E9', // sky blue
  '#009E73', // bluish green
  '#F0E442', // yellow
  '#0072B2', // blue
  '#D55E00', // vermillion
  '#CC79A7', // reddish purple
  '#999999', // grey
]

const SCORE_COLORS: Record<ScoreMetric, string> = {
  depression: scorePalette[5],
  anxiety: scorePalette[0],
  stress: scorePalette[3],
  anger: scorePalette[5],
  socialIsolation: scorePalette[6],
  bipolarDisorder: scorePalette[4],
  ocd: scorePalette[2],
  eatingDisorder: scorePalette[0],
  socialAnxiety: scorePalette[6],
  panicDisorder: scorePalette[4],
}

const SCORE_LABELS: Record<ScoreMetric, string> = {
  depression: 'Depression',
  anxiety: 'Anxiety',
  stress: 'Stress',
  anger: 'Anger',
  socialIsolation: 'Social Isolation',
  bipolarDisorder: 'Bipolar',
  ocd: 'OCD',
  eatingDisorder: 'Eating Disorder',
  socialAnxiety: 'Social Anxiety',
  panicDisorder: 'Panic Disorder',
}

const isScoreMetric = (metric: string): metric is ScoreMetric =>
  Object.prototype.hasOwnProperty.call(SCORE_LABELS, metric)

const getScoreLabel = (metric: string): string =>
  isScoreMetric(metric) ? SCORE_LABELS[metric] : metric

// Zero-chroma tooltip chrome (DESIGN.md §2.1). Shared across both charts.
const chartTooltipStyle = {
  backgroundColor: 'var(--np-elevated)',
  border: '1px solid var(--np-line)',
  borderRadius: '0px',
  color: 'var(--np-text)',
}

const mapLatestScore = (
  scoreMetric: ScoreMetric,
  scoreValue: number,
): {
  metric: string
  score: number
  fullMark: number
} => ({
  metric: getScoreLabel(scoreMetric),
  score: Math.round(scoreValue * 100),
  fullMark: 100,
})

// ⚡ Bolt: Prevent expensive re-renders of Recharts SVG components on every keystroke in parent
export const MentalHealthHistoryChart = memo(function MentalHealthHistoryChart({
  analysisHistory,
}: MentalHealthHistoryChartProps) {
  const { timeSeriesData, latestScores, hasData } = useMemo(() => {
    if (!analysisHistory.length) {
      return { timeSeriesData: [], latestScores: [], hasData: false }
    }

    const timeSeriesData = analysisHistory.map((analysis, index) => ({
      session: index + 1,
      ...analysis.scores,
      confidence: analysis.confidence * 100,
    }))

    const latest = analysisHistory[analysisHistory.length - 1]
    const latestScores = latest?.scores
      ? SCORE_KEYS.map((key) => mapLatestScore(key, latest.scores[key]))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
      : []

    return { timeSeriesData, latestScores, hasData: true }
  }, [analysisHistory])

  if (!hasData) {
    return (
      <div
        className="np-surface flex h-full w-full items-center justify-center"
        style={{ border: '2px dashed var(--np-line)' }}
      >
        <div className="text-center">
          <div className="np-muted mb-2">
            <svg
              className="mx-auto mb-2 h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <p className="np-text text-sm font-medium">No Analysis Data</p>
          <p className="np-muted mt-1 text-xs">
            Charts will appear after message analysis
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full space-y-4">
      {/* Current State Radar Chart */}
      <div className="h-48">
        <h4
          className="np-muted mb-2"
          style={{
            fontFamily: 'var(--np-font-display)',
            fontWeight: 'var(--np-weight-headline)',
            fontSize: 'var(--np-text-small)',
            letterSpacing: '-0.01em',
          }}
        >
          Current Mental Health Profile
        </h4>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={latestScores}>
            <PolarGrid gridType="polygon" stroke="var(--np-line)" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fontSize: 10, fill: 'var(--np-muted)' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 8, fill: 'var(--np-muted)' }}
              tickCount={4}
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke={scorePalette[4]}
              fill={scorePalette[4]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{ ...chartTooltipStyle, fontSize: '12px' }}
              formatter={(value: number) => [`${value}%`, 'Score']}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Trend Lines */}
      {timeSeriesData.length > 1 && (
        <div className="h-32">
          <h4
            className="np-muted mb-2"
            style={{
              fontFamily: 'var(--np-font-display)',
              fontWeight: 'var(--np-weight-headline)',
              fontSize: 'var(--np-text-small)',
              letterSpacing: '-0.01em',
            }}
          >
            Trend Analysis
          </h4>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--np-line)" />
              <XAxis
                dataKey="session"
                tick={{ fontSize: 10, fill: 'var(--np-muted)' }}
                axisLine={{
                  stroke: 'var(--np-line)',
                  strokeWidth: 0.5,
                }}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 10, fill: 'var(--np-muted)' }}
                axisLine={{
                  stroke: 'var(--np-line)',
                  strokeWidth: 0.5,
                }}
                tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
              />
              <Tooltip
                contentStyle={{ ...chartTooltipStyle, fontSize: '11px' }}
                formatter={(value: number, name: string) => [
                  `${Math.round(value * 100)}%`,
                  getScoreLabel(name),
                ]}
                labelFormatter={(label: string | number) => `Session ${label}`}
              />
              {Object.entries(SCORE_COLORS).map(([key, color]) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                  connectNulls={false}
                />
              ))}
              <Legend
                wrapperStyle={{ fontSize: '10px' }}
                formatter={(value: string) => getScoreLabel(value)}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
})
