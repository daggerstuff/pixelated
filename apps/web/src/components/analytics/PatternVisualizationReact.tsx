import type { FC } from 'react'

import type {
  TrendPattern,
  CrossSessionPattern,
  RiskCorrelation,
} from '@/lib/fhe/pattern-recognition'

export interface PatternVisualizationProps {
  trends?: TrendPattern[]
  crossSessionPatterns?: CrossSessionPattern[]
  riskCorrelations?: RiskCorrelation[]
  className?: string
  showControls?: boolean
  onPatternSelect?: (
    pattern: TrendPattern | CrossSessionPattern | RiskCorrelation,
  ) => void
}

export const PatternVisualization: FC<PatternVisualizationProps> = ({
  trends = [],
  crossSessionPatterns = [],
  riskCorrelations = [],
  className = '',
  showControls = true,
  onPatternSelect,
}) => {
  const handleSelect = (
    pattern: TrendPattern | CrossSessionPattern | RiskCorrelation,
  ) => {
    onPatternSelect?.(pattern)
  }

  return (
    <div className={`pattern-visualization ${className}`}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Trends Section */}
        <div className="rounded-none border border-border bg-card p-4">
          <h3 className="mb-3 text-lg font-semibold">Trend Patterns</h3>
          {trends.length > 0 ? (
            <div className="space-y-2">
              {trends.map((trend: TrendPattern) => (
                <button
                  key={trend.id}
                  className="w-full cursor-pointer rounded-none border border-border p-2 text-left transition-colors hover:bg-secondary"
                  onClick={() => handleSelect(trend)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSelect(trend)
                    }
                  }}
                  aria-label={`Select trend pattern: ${trend.description}`}
                >
                  <div className="font-medium">{trend.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {trend.indicators.join(', ')}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No trends found</div>
          )}
        </div>

        {/* Cross-Session Patterns Section */}
        <div className="rounded-none border border-border bg-card p-4">
          <h3 className="mb-3 text-lg font-semibold">Cross-Session Patterns</h3>
          {crossSessionPatterns.length > 0 ? (
            <div className="space-y-2">
              {crossSessionPatterns.map((pattern: CrossSessionPattern) => (
                <button
                  key={pattern.id}
                  className="w-full cursor-pointer rounded-none border border-border p-2 text-left transition-colors hover:bg-secondary"
                  onClick={() => handleSelect(pattern)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSelect(pattern)
                    }
                  }}
                  aria-label={`Select cross-session pattern: ${pattern.description}`}
                >
                  <div className="font-medium">{pattern.description}</div>
                  <div className="text-xs text-muted-foreground">
                    Sessions: {pattern.sessions.length}
                    {pattern.timeSpanDays &&
                      `, Span: ${pattern.timeSpanDays} days`}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No cross-session patterns found
            </div>
          )}
        </div>

        {/* Risk Correlations Section */}
        <div className="rounded-none border border-border bg-card p-4">
          <h3 className="mb-3 text-lg font-semibold">Risk Correlations</h3>
          {riskCorrelations.length > 0 ? (
            <div className="space-y-2">
              {riskCorrelations.map((correlation: RiskCorrelation) => (
                <button
                  key={correlation.id}
                  className="w-full cursor-pointer rounded-none border border-border p-2 text-left transition-colors hover:bg-secondary"
                  onClick={() => handleSelect(correlation)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSelect(correlation)
                    }
                  }}
                  aria-label={`Select risk correlation: ${correlation.description ?? correlation.riskFactor}`}
                >
                  <div className="font-medium">
                    {correlation.description ?? correlation.riskFactor}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Strength: {correlation.severityScore.toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No risk correlations found
            </div>
          )}
        </div>
      </div>

      {showControls && (
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">Controls are visible.</p>
        </div>
      )}
    </div>
  )
}
