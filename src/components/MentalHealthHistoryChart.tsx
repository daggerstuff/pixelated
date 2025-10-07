import { useMemo } from 'react'
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
    scores: {
      depression: number
      anxiety: number
      stress: number
      anger: number
      socialIsolation: number
      bipolarDisorder: number
      ocd: number
      eatingDisorder: number
      socialAnxiety: number
      panicDisorder: number
    }
  }>
}

const SCORE_COLORS = {
  depression: '#ef4444',
  anxiety: '#f97316',
  stress: '#eab308',
  anger: '#dc2626',
  socialIsolation: '#8b5cf6',
  bipolarDisorder: '#06b6d4',
  ocd: '#10b981',
  eatingDisorder: '#f59e0b',
  socialAnxiety: '#ec4899',
  panicDisorder: '#6366f1',
}

const SCORE_LABELS = {
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

export function MentalHealthHistoryChart({
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
      ? Object.entries(latest.scores)
          .filter(([, value]) => value > 0)
          .map(([key, value]) => ({
            metric: SCORE_LABELS[key as keyof typeof SCORE_LABELS] || key,
            score: Math.round(value * 100),
            fullMark: 100,
          }))
          .sort((a, b) => b.score - a.score)
      : []

    return { timeSeriesData, latestScores, hasData: true }
  }, [analysisHistory])

  if (!hasData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20 rounded-lg border-2 border-dashed border-muted-foreground/20">
        <div className="text-center">
          <div className="text-muted-foreground mb-2">
            <svg
              className="w-8 h-8 mx-auto mb-2"
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
          <p className="text-sm text-muted-foreground font-medium">
            No Analysis Data
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Charts will appear after message analysis
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full space-y-4">
      {/* Current State Radar Chart */}
      <div className="h-48">
        <h4 className="text-sm font-medium mb-2 text-muted-foreground">
          Current Mental Health Profile
        </h4>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={latestScores}>
            <PolarGrid
              gridType="polygon"
              className="stroke-muted-foreground/20"
            />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              className="text-xs"
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
              tickCount={4}
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.1}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '12px',
              }}
              formatter={(value: number) => [`${value}%`, 'Score']}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Trend Lines */}
      {timeSeriesData.length > 1 && (
        <div className="h-32">
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">
            Trend Analysis
          </h4>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeriesData}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-muted-foreground/10"
              />
              <XAxis
                dataKey="session"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{
                  stroke: 'hsl(var(--muted-foreground))',
                  strokeWidth: 0.5,
                }}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{
                  stroke: 'hsl(var(--muted-foreground))',
                  strokeWidth: 0.5,
                }}
                tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '11px',
                }}
                formatter={(value: number, name: string) => [
                  `${Math.round(value * 100)}%`,
                  SCORE_LABELS[name as keyof typeof SCORE_LABELS] || name,
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
                formatter={(value: string) =>
                  SCORE_LABELS[value as keyof typeof SCORE_LABELS] || value
                }
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
