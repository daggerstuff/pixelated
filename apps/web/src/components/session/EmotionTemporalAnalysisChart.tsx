import { useState } from 'react'
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ScatterChart,
  Scatter,
  ZAxis,
  AreaChart,
  Area,
} from 'recharts'
import type {
  ValueType,
  NameType,
} from 'recharts/types/component/DefaultTooltipContent'

// Per-view caption. Title in mono label role + body description per doctrine §3.
const VIEW_MODES = [
  { key: 'trends', label: 'Trends' },
  { key: 'critical', label: 'Critical Points' },
  { key: 'progression', label: 'Progression' },
  { key: 'transitions', label: 'Transitions' },
  { key: 'relationships', label: 'Relationships' },
] as const

const VIEW_CAPTIONS: Record<ViewMode, string> = {
  trends:
    'Emotional trend patterns across sessions. Positive slopes = increasing intensity; negative = decreasing.',
  critical:
    'High-intensity emotional moments — often breakthroughs or challenges.',
  progression:
    'Overall emotional improvement. Positive = beneficial change; negative may need attention.',
  transitions:
    'Most common emotional shifts and their frequency — insight into regulation patterns.',
  relationships:
    'Correlations between emotions. Positive co-occur; negative rarely co-occur.',
}

type ViewMode = (typeof VIEW_MODES)[number]['key']

import { cn } from '@/lib/utils'

import type {
  TemporalCriticalPoint,
  TemporalDimensionalRelationship,
  TemporalEmotionAnalysis,
  TemporalTransition,
} from '../../lib/ai/temporal/EmotionTemporalAnalyzer'

// Zero-chroma chart chrome (DESIGN.md §2.1): axes/gridlines/refs/tooltip frames
// stay on the np neutral ramp. Only data marks earn hue (Okabe-Ito palette above).
const axisTick = { fontSize: 10, fill: 'var(--np-muted)' }
const axisLineProps = { stroke: 'var(--np-line)', strokeWidth: 0.5 }
const gridProps = { strokeDasharray: '3 3', stroke: 'var(--np-line)' }
const tooltipStyle = {
  backgroundColor: 'var(--np-elevated)',
  border: '1px solid var(--np-line)',
  borderRadius: '0px',
  fontSize: '12px',
  color: 'var(--np-text)',
}
const refLineProps = { stroke: 'var(--np-muted)', strokeWidth: 1 }

type EmotionTemporalAnalysisChartProps = {
  data: TemporalEmotionAnalysis
  className?: string
  isLoading?: boolean
  height?: number
  clientId?: string
}

// Bounded categorical palette (Okabe-Ito, colorblind-safe) — series marks only per DESIGN.md §2.1.
// Chart chrome (axes, labels, tooltips, container) stays zero-chroma via np-tokens.
const emotionPalette = [
  '#E69F00', // orange
  '#56B4E9', // sky blue
  '#009E73', // bluish green
  '#F0E442', // yellow
  '#0072B2', // blue
  '#D55E00', // vermillion
  '#CC79A7', // reddish purple
  '#999999', // grey
]

// Color map for common emotions — maps each emotion to a bounded palette entry.
const emotionColors: Record<string, string> = {
  happiness: emotionPalette[2],
  joy: emotionPalette[2],
  excitement: emotionPalette[0],
  contentment: emotionPalette[4],
  gratitude: emotionPalette[1],
  neutral: emotionPalette[7],
  surprise: emotionPalette[6],
  anxiety: emotionPalette[3],
  fear: emotionPalette[5],
  anger: emotionPalette[5],
  sadness: emotionPalette[4],
  disgust: emotionPalette[6],
}

// Get color for an emotion type, with fallback to the first palette entry
const getEmotionColor = (emotion: string): string => {
  return emotionColors[emotion.toLowerCase()] ?? emotionPalette[7]
}

// Named series colors for the recharts multi-series trend/correlation views.
const seriesTrendColor = emotionPalette[4] // blue — Trend series
const seriesCorrelationColor = emotionPalette[2] // green — Correlation series

const toNumber = (value: unknown): number => {
  return typeof value === 'number' ? value : 0
}

const formatNumber = (value: unknown, digits = 2): string => {
  return toNumber(value).toFixed(digits)
}

/**
 * Component for visualizing temporal emotion analysis
 * Displays charts for emotional trends, critical points, and progression
 */
export default function EmotionTemporalAnalysisChart({
  data,
  className,
  isLoading = false,
  height = 400,
}: EmotionTemporalAnalysisChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('trends')
  const [emotionFilters, setEmotionFilters] = useState<Record<string, boolean>>(
    {},
  )

  // Format data for trend visualization
  const prepareTrendData = () => {
    // Get all emotion types with trendlines
    const emotionTypes = Object.keys(data.trendlines)

    // Initialize emotion filters if not already set
    if (Object.keys(emotionFilters).length === 0 && emotionTypes.length > 0) {
      const initialFilters: Record<string, boolean> = {}
      // Show top 5 emotions by default or all if less than 5
      const topEmotions = emotionTypes.slice(
        0,
        Math.min(5, emotionTypes.length),
      )
      emotionTypes.forEach((type) => {
        initialFilters[type] = topEmotions.includes(type)
      })
      setEmotionFilters(initialFilters)
    }

    // Get filtered emotions
    const filteredEmotions = Object.entries(emotionFilters)
      .filter(([_, isSelected]) => isSelected)
      .map(([emotion]) => emotion)

    // Create trendline data with selected emotions
    return filteredEmotions.flatMap((emotion) => {
      const trendline = data.trendlines[emotion]
      if (!trendline) {
        return []
      }

      const volatility = data.volatility[emotion] ?? 0

      return [
        {
          name: emotion,
          slope: trendline.slope,
          correlation: trendline.correlation,
          significance: trendline.significance,
          volatility,
          color: getEmotionColor(emotion),
        },
      ]
    })
  }

  // Format data for critical points visualization
  const prepareCriticalPointsData = () => {
    return (data.criticalPoints ?? []).map((point: TemporalCriticalPoint) => ({
      name: point.emotion,
      intensity: point.intensity,
      timestamp: point.timestamp.toLocaleString(),
      sessionId: point.sessionId,
      color: getEmotionColor(point.emotion),
    }))
  }

  // Format data for progression visualization
  const prepareProgressionData = () => {
    const progression: {
      overallImprovement: number
      stabilityChange: number
      positiveEmotionChange: number
      negativeEmotionChange: number
    } = {
      overallImprovement: 0,
      stabilityChange: 0,
      positiveEmotionChange: 0,
      negativeEmotionChange: 0,
    }

    if (data.progression && typeof data.progression === 'object') {
      if (
        'overallImprovement' in data.progression &&
        typeof data.progression.overallImprovement === 'number'
      ) {
        progression.overallImprovement = data.progression.overallImprovement
      }
      if (
        'stabilityChange' in data.progression &&
        typeof data.progression.stabilityChange === 'number'
      ) {
        progression.stabilityChange = data.progression.stabilityChange
      }
      if (
        'positiveEmotionChange' in data.progression &&
        typeof data.progression.positiveEmotionChange === 'number'
      ) {
        progression.positiveEmotionChange =
          data.progression.positiveEmotionChange
      }
      if (
        'negativeEmotionChange' in data.progression &&
        typeof data.progression.negativeEmotionChange === 'number'
      ) {
        progression.negativeEmotionChange =
          data.progression.negativeEmotionChange
      }
    }

    return [
      {
        name: 'Overall Improvement',
        value: progression.overallImprovement,
        fill:
          progression.overallImprovement >= 0
            ? emotionPalette[2]
            : emotionPalette[5],
      },
      {
        name: 'Stability Change',
        value: progression.stabilityChange,
        fill:
          progression.stabilityChange >= 0
            ? emotionPalette[4]
            : emotionPalette[5],
      },
      {
        name: 'Positive Emotion Change',
        value: progression.positiveEmotionChange,
        fill:
          progression.positiveEmotionChange >= 0
            ? emotionPalette[2]
            : emotionPalette[0],
      },
      {
        name: 'Negative Emotion Change',
        value: progression.negativeEmotionChange,
        fill:
          progression.negativeEmotionChange >= 0
            ? emotionPalette[6]
            : emotionPalette[4],
      },
    ]
  }

  // Format data for transitions visualization
  const prepareTransitionsData = () => {
    // Get top 10 most frequent transitions
    return (data.transitions ?? [])
      .slice(0, 10)
      .map((transition: TemporalTransition) => ({
        name: `${transition.from} → ${transition.to}`,
        frequency: transition.frequency,
        duration: transition.avgDuration / (1000 * 60), // Convert to minutes
        from: transition.from,
        to: transition.to,
        fromColor: getEmotionColor(transition.from),
        toColor: getEmotionColor(transition.to),
      }))
  }

  // Format data for relationships visualization
  const prepareRelationshipsData = () => {
    return (data.dimensionalRelationships ?? []).map(
      (rel: TemporalDimensionalRelationship) => ({
        name: `${rel.dimensions[0]} & ${rel.dimensions[1]}`,
        correlation: rel.correlation,
        description: rel.description,
        color: rel.correlation >= 0 ? emotionPalette[2] : emotionPalette[5],
      }),
    )
  }

  // Toggle emotion selection in filters
  const toggleEmotionFilter = (emotion: string) => {
    setEmotionFilters((prev) => ({
      ...prev,
      [emotion]: !prev[emotion],
    }))
  }

  // Loading state
  if (isLoading) {
    return (
      <div
        className="np-surface flex items-center justify-center p-6"
        style={{ border: '1px solid var(--np-line)' }}
      >
        <div className="flex w-full animate-pulse flex-col">
          <div className="np-elevated mb-2.5 h-4 w-3/4"></div>
          <div className="np-elevated h-40 w-full"></div>
        </div>
      </div>
    )
  }

  // Empty state (no data)
  if (
    Object.keys(data.trendlines).length === 0 &&
    (data.criticalPoints?.length ?? 0) === 0 &&
    (data.transitions ?? []).length === 0
  ) {
    return (
      <div
        className="np-surface flex flex-col items-center justify-center p-6"
        style={{ border: '1px solid var(--np-line)' }}
      >
        <p className="np-text mb-2">No temporal analysis data available</p>
        <p className="np-muted text-sm">
          More data needs to be collected across sessions
        </p>
      </div>
    )
  }

  // Render the appropriate chart based on view mode
  const renderChart = () => {
    if (viewMode === 'trends') {
      const trendData = prepareTrendData()
      return (
        <AreaChart
          data={trendData}
          margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
        >
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="name" tick={axisTick} axisLine={axisLineProps} />
          <YAxis domain={[-1, 1]} tick={axisTick} axisLine={axisLineProps} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={
              (value: ValueType, name: NameType) => {
                if (name === 'slope') {
                  const numericValue = toNumber(value)
                  return [
                    `${formatNumber(numericValue, 2)} (${numericValue > 0 ? 'increasing' : 'decreasing'})`,
                    'Trend',
                  ]
                }
                if (name === 'correlation') {
                  return [formatNumber(value, 2), 'Correlation']
                }
                if (name === 'significance') {
                  return [formatNumber(value, 2), 'Significance']
                }
                return [value, name]
              }
            }
          />

          <Legend />
          <ReferenceLine y={0} {...refLineProps} />
          <defs>
            {trendData.map((item) => (
              <linearGradient
                key={item.name}
                id={`gradient-${item.name}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={item.color} stopOpacity={0.8} />

                <stop offset="95%" stopColor={item.color} stopOpacity={0.2} />
              </linearGradient>
            ))}
          </defs>
          <Area
            type="monotone"
            dataKey="slope"
            stroke={seriesTrendColor}
            fill={seriesTrendColor}
            strokeWidth={2}
            fillOpacity={0.6}
            name="Trend"
          />

          <Area
            type="monotone"
            dataKey="correlation"
            stroke={seriesCorrelationColor}
            fill={seriesCorrelationColor}
            strokeWidth={2}
            fillOpacity={0.6}
            name="Correlation"
          />
        </AreaChart>
      )
    }

    if (viewMode === 'critical') {
      return (
        <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
          <CartesianGrid {...gridProps} />
          <XAxis
            type="category"
            dataKey="name"
            name="Emotion"
            tick={axisTick}
            axisLine={axisLineProps}
          />

          <YAxis
            type="number"
            dataKey="intensity"
            name="Intensity"
            tick={axisTick}
            axisLine={axisLineProps}
          />

          <ZAxis type="category" dataKey="sessionId" name="Session" />

          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: 'var(--np-line)' }}
            contentStyle={tooltipStyle}
          />

          <Legend />
          {prepareCriticalPointsData().map((point) => (
            <Scatter
              key={`${point.name}-${point.sessionId}-${point.timestamp}`}
              name={point.name}
              data={[point]}
              fill={point.color}
            />
          ))}
        </ScatterChart>
      )
    }

    if (viewMode === 'progression') {
      const progressionData = prepareProgressionData()
      return (
        <AreaChart
          data={progressionData}
          margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
        >
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="name" tick={axisTick} axisLine={axisLineProps} />
          <YAxis tick={axisTick} axisLine={axisLineProps} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <ReferenceLine y={0} {...refLineProps} />
          {progressionData.map((item) => (
            <Area
              key={item.name}
              type="monotone"
              dataKey="value"
              name={item.name}
              stroke={item.fill}
              fill={item.fill}
              fillOpacity={0.6}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      )
    }

    if (viewMode === 'transitions') {
      return (
        <AreaChart
          data={prepareTransitionsData()}
          margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
        >
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="name" tick={axisTick} axisLine={axisLineProps} />
          <YAxis
            yAxisId="left"
            orientation="left"
            dataKey="frequency"
            name="Frequency"
            tick={axisTick}
            axisLine={axisLineProps}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            dataKey="duration"
            name="Avg. Duration (min)"
            tick={axisTick}
            axisLine={axisLineProps}
          />

          <Tooltip
            contentStyle={tooltipStyle}
            formatter={
              (value: ValueType, name: NameType) => {
                if (name === 'frequency') {
                  return [value, 'Frequency']
                }
                if (name === 'duration') {
                  return [formatNumber(value, 1), 'Avg Duration (min)']
                }
                return [value, name]
              }
            }
          />

          <Legend />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="frequency"
            stroke={seriesTrendColor}
            fill={seriesTrendColor}
            fillOpacity={0.6}
            strokeWidth={2}
            name="Frequency"
          />

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="duration"
            stroke={seriesCorrelationColor}
            strokeWidth={2}
            name="Avg Duration (min)"
          />
        </AreaChart>
      )
    }

    return (
      <AreaChart
        data={prepareRelationshipsData()}
        margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
      >
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="name" tick={axisTick} axisLine={axisLineProps} />
        <YAxis domain={[-1, 1]} tick={axisTick} axisLine={axisLineProps} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: ValueType, name: NameType) => {
            if (name === 'correlation') {
              return [formatNumber(value, 2), 'Correlation']
            }
            return [value, name]
          }}
        />
        <Legend />
        <ReferenceLine y={0} stroke="var(--np-muted)" />
        <Area
          type="monotone"
          dataKey="correlation"
          stroke={seriesTrendColor}
          fill={seriesTrendColor}
          fillOpacity={0.6}
          strokeWidth={2}
          name="Correlation"
        />
      </AreaChart>
    )
  }

  return (
    <div
      className={cn('p-4 np-surface', className)}
      style={{ border: '1px solid var(--np-line)' }}
    >
      <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-baseline">
        <h3
          className="np-text"
          style={{
            fontFamily: 'var(--np-font-display)',
            fontWeight: 'var(--np-weight-headline)',
            fontSize: 'var(--np-text-title)',
            letterSpacing: '-0.01em',
          }}
        >
          Temporal Emotion Analysis
        </h3>

        {/* Segmented control — one shared class, selected via np-elevated fill + np-text. */}
        <div
          role="tablist"
          aria-label="Temporal analysis view"
          className="flex flex-wrap"
          style={{ border: '1px solid var(--np-line)' }}
          onKeyDown={(e) => {
            const keys = VIEW_MODES.map((m) => m.key)
            const idx = keys.indexOf(viewMode)
            let next: number | null = null
            if (e.key === 'ArrowRight') next = (idx + 1) % keys.length
            else if (e.key === 'ArrowLeft')
              next = (idx - 1 + keys.length) % keys.length
            else if (e.key === 'Home') next = 0
            else if (e.key === 'End') next = keys.length - 1
            if (next !== null) {
              e.preventDefault()
              setViewMode(keys[next] as ViewMode)
              document.getElementById(`tab-${keys[next]}`)?.focus()
            }
          }}
        >
          {VIEW_MODES.map((mode) => {
            const selected = viewMode === mode.key
            return (
              <button
                key={mode.key}
                id={`tab-${mode.key}`}
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setViewMode(mode.key)}
                className={cn(
                  'px-3 py-1.5 text-sm transition-colors',
                  selected ? 'np-text' : 'np-muted',
                )}
                style={{
                  fontFamily: 'var(--np-font-body)',
                  background: selected ? 'var(--np-elevated)' : 'transparent',
                  borderRight: '1px solid var(--np-line)',
                }}
              >
                {mode.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Emotion filters (only show for trend view) */}
      {viewMode === 'trends' && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(emotionFilters).map(([emotion, isSelected]) => (
            <button
              key={emotion}
              onClick={() => toggleEmotionFilter(emotion)}
              className={cn(
                'np-surface flex items-center gap-1.5 px-2 py-1 text-xs border',
                isSelected ? 'np-text font-semibold' : 'np-muted',
              )}
              style={{
                backgroundColor: 'var(--np-surface)',
                borderColor: isSelected ? 'var(--np-mid)' : 'var(--np-line)',
              }}
            >
              {/* Emotion-color swatch is the data mark (hue earned); label chrome stays zero-chroma. */}
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2"
                style={{
                  backgroundColor: getEmotionColor(emotion),
                  opacity: isSelected ? 1 : 0.4,
                }}
              />
              {emotion}
            </button>
          ))}
        </div>
      )}

      {/* Chart based on selected view. Keyed wrapper remounts on view change →
          recharts state never leaks + the fade-in replays as a state-change cue.
          Scope: this keyframe is local to this component's key → no global clash. */}
      <style>{`
        @keyframes etac-chart-enter { from { opacity: 0 } to { opacity: 1 } }
        .etac-chart { animation: etac-chart-enter var(--np-duration-normal) var(--np-ease-out) both; }
        @media (prefers-reduced-motion: reduce) {
          .etac-chart { animation: none }
        }
      `}</style>
      <div
        key={viewMode}
        role="tabpanel"
        aria-labelledby={`tab-${viewMode}`}
        className="etac-chart"
        style={{ width: '100%', height: `${height}px` }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Caption — mono label + body description per doctrine §3.
          Replaces the verbose per-view <p> wall with a single dense caption. */}
      <div
        className="mt-4 flex items-start gap-2 pt-3"
        style={{ borderTop: '1px solid var(--np-line)' }}
      >
        <span
          className="np-muted shrink-0 uppercase"
          style={{
            fontFamily: 'var(--np-font-mono)',
            fontSize: 'var(--np-text-caption)',
            letterSpacing: 'var(--np-tracking-label)',
            paddingTop: '2px',
          }}
        >
          {VIEW_MODES.find((m) => m.key === viewMode)?.label}
        </span>
        <p
          className="np-muted"
          style={{ fontSize: 'var(--np-text-small)', lineHeight: 1.5 }}
        >
          {VIEW_CAPTIONS[viewMode]}
        </p>
      </div>
    </div>
  )
}
