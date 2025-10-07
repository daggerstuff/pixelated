import type { FC } from 'react'
/**
 * TEMP LOCAL PATCH: Placeholder types for TrendPattern, CrossSessionPattern, RiskCorrelation.
 * Remove when project types module is restored.
 */
export interface TrendPattern {
  id: string;
  description: string;
  indicators: string[];
}

export interface CrossSessionPattern {
  id: string;
  description: string;
  sessionIds: string[];
  timeSpanDays: number;
}

export interface RiskCorrelation {
  id: string;
  description: string;
  strength: number;
}


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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Trends Section */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3">Trend Patterns</h3>
          {trends.length > 0 ? (
            <div className="space-y-2">
              {trends.map((trend: TrendPattern) => (
                <button
                  key={trend.id}
                  className="p-2 border rounded cursor-pointer hover:bg-gray-50 text-left w-full"
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
                  <div className="text-xs text-gray-500">
                    {trend.indicators.join(', ')}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No trends found</div>
          )}
        </div>

        {/* Cross-Session Patterns Section */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3">
            Cross-Session Patterns
          </h3>
          {crossSessionPatterns.length > 0 ? (
            <div className="space-y-2">
              {crossSessionPatterns.map((pattern: CrossSessionPattern) => (
                <button
                  key={pattern.id}
                  className="p-2 border rounded cursor-pointer hover:bg-gray-50 text-left w-full"
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
                  <div className="text-xs text-gray-500">
                    Sessions: {pattern.sessionIds.length}, Span: {pattern.timeSpanDays} days
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">
              No cross-session patterns found
            </div>
          )}
        </div>

        {/* Risk Correlations Section */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3">Risk Correlations</h3>
          {riskCorrelations.length > 0 ? (
            <div className="space-y-2">
              {riskCorrelations.map((correlation: RiskCorrelation) => (
                <button
                  key={correlation.id}
                  className="p-2 border rounded cursor-pointer hover:bg-gray-50 text-left w-full"
                  onClick={() => handleSelect(correlation)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSelect(correlation)
                    }
                  }}
                  aria-label={`Select risk correlation: ${correlation.description}`}
                >
                  <div className="font-medium">{correlation.description}</div>
                  <div className="text-xs text-gray-500">
                    Strength: {correlation.strength.toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">
              No risk correlations found
            </div>
          )}
        </div>
      </div>

      {showControls && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Controls are visible.
          </p>
        </div>
      )}
    </div>
  )
}

export default PatternVisualization
