import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'
import React, { useEffect, useState } from 'react'

type MeasureType = 'phq-9' | 'gad-7' | 'oq-45'

interface OutcomeTrendPoint {
  administeredAt: string
  totalScore: number
  severity: string
  alertFlag: boolean
  alertReason?: string
  changeFromPrevious?: number
}

interface OutcomeTrendResult {
  measureType: MeasureType
  points: OutcomeTrendPoint[]
  latestScore?: {
    measureType: MeasureType
    totalScore: number
    maxScore: number
    severity: string
    administeredAt: string
    alertFlag: boolean
    alertReason?: string
    changeFromPrevious?: number
  }
}

interface ErrorResponse {
  error: { code: string; message: string }
}

const MEASURE_LABELS: Record<MeasureType, string> = {
  'phq-9': 'PHQ-9',
  'gad-7': 'GAD-7',
  'oq-45': 'OQ-45',
}

const SEVERITY_COLORS: Record<string, string> = {
  'minimal': 'var(--np-success, #22c55e)',
  'mild': 'var(--np-success, #22c55e)',
  'moderate': 'var(--np-muted)',
  'moderately-severe': 'var(--np-danger, #ef4444)',
  'severe': 'var(--np-danger, #ef4444)',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function getColorForSeverity(severity: string): string {
  return SEVERITY_COLORS[severity] ?? 'var(--np-muted)'
}

interface OutcomeTrendChartProps {
  patientId: string
  measureType: MeasureType
}

export function OutcomeTrendChart({
  patientId,
  measureType,
}: OutcomeTrendChartProps) {
  const [trend, setTrend] = useState<OutcomeTrendResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const params = new URLSearchParams({
          patient: patientId,
          measure: measureType,
        })
        const res = await fetch(
          `/api/ehr/v1/outcomes/trending?${params.toString()}`,
        )
        if (!cancelled && !res.ok) {
          const err = (await res.json()) as ErrorResponse
          throw new Error(err.error?.message ?? 'Failed to load trend data')
        }
        if (!cancelled) {
          const result = (await res.json()) as { data: OutcomeTrendResult }
          if (!cancelled) setTrend(result.data)
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load trend')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [patientId, measureType])

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          color: 'var(--np-muted)',
        }}
      >
        <div
          style={{
            width: '1rem',
            height: '1rem',
            border: '2px solid var(--np-line)',
            borderTopColor: 'var(--np-text)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>
          Loading trend…
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          padding: '0.75rem',
          color: 'var(--np-danger, #ef4444)',
          fontSize: '0.8125rem',
        }}
      >
        <AlertTriangle
          size={16}
          style={{ verticalAlign: 'middle', marginRight: '0.25rem' }}
        />
        {error}
      </div>
    )
  }

  if (!trend || trend.points.length === 0) {
    return (
      <div
        style={{
          padding: '1.5rem',
          textAlign: 'center',
          color: 'var(--np-muted)',
          fontSize: '0.875rem',
        }}
      >
        No trend data available for {MEASURE_LABELS[measureType]}.
      </div>
    )
  }

  const points = trend.points
  const scores = points.map((p) => p.totalScore)
  const maxScore = Math.max(...scores, 1)
  const chartWidth = 320
  const chartHeight = 140
  const padding = { top: 10, right: 10, bottom: 24, left: 28 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom
  const xStep = points.length > 1 ? innerWidth / (points.length - 1) : 0
  const yScale = innerHeight / maxScore

  const pathData = points
    .map((p, i) => {
      const x = padding.left + i * xStep
      const y = padding.top + innerHeight - p.totalScore * yScale
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  const areaPath =
    pathData +
    ` L ${padding.left + (points.length - 1) * xStep} ${padding.top + innerHeight} L ${padding.left} ${padding.top + innerHeight} Z`

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        background: 'var(--np-surface)',
        borderRadius: '0.5rem',
        border: '1px solid var(--np-line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <h4
            style={{
              margin: 0,
              color: 'var(--np-text)',
              fontSize: '0.9375rem',
              fontWeight: 600,
            }}
          >
            {MEASURE_LABELS[measureType]} Trend
          </h4>
        </div>
        {trend.latestScore && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.8125rem',
            }}
          >
            <span style={{ color: 'var(--np-muted)' }}>Latest:</span>
            <span style={{ color: 'var(--np-text)', fontWeight: 600 }}>
              {trend.latestScore.totalScore}
            </span>
            <span
              style={{
                color: getColorForSeverity(trend.latestScore.severity),
                textTransform: 'capitalize',
              }}
            >
              {trend.latestScore.severity}
            </span>
            {trend.latestScore.changeFromPrevious !== undefined &&
              trend.latestScore.changeFromPrevious !== 0 && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.125rem',
                    color:
                      trend.latestScore.changeFromPrevious > 0
                        ? 'var(--np-danger, #ef4444)'
                        : 'var(--np-success, #22c55e)',
                  }}
                >
                  {trend.latestScore.changeFromPrevious > 0 ? (
                    <TrendingUp size={12} />
                  ) : (
                    <TrendingDown size={12} />
                  )}
                  {trend.latestScore.changeFromPrevious > 0 ? '+' : ''}
                  {trend.latestScore.changeFromPrevious}
                </span>
              )}
          </div>
        )}
      </div>

      <svg
        width={chartWidth}
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient
            id={`grad-${measureType}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="var(--np-text)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--np-text)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            y1={padding.top + innerHeight * (1 - ratio)}
            x2={padding.left + innerWidth}
            y2={padding.top + innerHeight * (1 - ratio)}
            stroke="var(--np-line)"
            strokeWidth="0.5"
            strokeDasharray="2 2"
          />
        ))}
        {areaPath && <path d={areaPath} fill={`url(#grad-${measureType})`} />}
        {pathData && (
          <path
            d={pathData}
            fill="none"
            stroke="var(--np-text)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((p, i) => {
          const cx = padding.left + i * xStep
          const cy = padding.top + innerHeight - p.totalScore * yScale
          const color = p.alertFlag
            ? 'var(--np-danger, #ef4444)'
            : getColorForSeverity(p.severity)
          return (
            <g key={i}>
              <circle
                cx={cx}
                cy={cy}
                r="3"
                fill={color}
                stroke="var(--np-surface)"
                strokeWidth="1"
              />
              <text
                x={cx}
                y={padding.top + innerHeight + 14}
                textAnchor="middle"
                fontSize="9"
                fill="var(--np-muted)"
              >
                {formatDate(p.administeredAt)}
              </text>
            </g>
          )
        })}
        <text x="2" y={padding.top + 8} fontSize="9" fill="var(--np-muted)">
          {maxScore}
        </text>
        <text
          x="2"
          y={padding.top + innerHeight + 2}
          fontSize="9"
          fill="var(--np-muted)"
        >
          0
        </text>
      </svg>

      {trend.latestScore?.alertFlag && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.375rem',
            padding: '0.5rem',
            background: 'var(--np-bg)',
            borderRadius: '0.375rem',
            border: '1px solid var(--np-danger, #ef4444)',
          }}
        >
          <AlertTriangle
            size={14}
            style={{
              color: 'var(--np-danger, #ef4444)',
              flexShrink: 0,
              marginTop: '0.125rem',
            }}
          />
          <span style={{ color: 'var(--np-text)', fontSize: '0.75rem' }}>
            {trend.latestScore.alertReason ?? 'Significant change detected.'}
          </span>
        </div>
      )}
    </div>
  )
}
