import React from 'react'
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
  onPatternSelect?: (pattern: TrendPattern | CrossSessionPattern | RiskCorrelation) => void
}

export const PatternVisualization: FC<PatternVisualizationProps> = ({
  trends = [],
  crossSessionPatterns = [],
  riskCorrelations = [],
  className = '',
  showControls = true,
  onPatternSelect
}) => {
  return (
    <div className={`pattern-visualization ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Trends Section */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3">Trend Patterns</h3>
          {trends.length > 0 ? (
            <div className="space-y-2">
              {trends.map((trend) => (
                <button
                  key={trend.id}
                  className="p-2 border rounded cursor-pointer hover:bg-gray-50 text-left w-full"
                  onClick={() => onPatternSelect?.(trend)}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onPatternSelect?.(trend)
                    }
                  }}
                  aria-label={`Select trend pattern: ${trend.description}`}
                  type="button"
                >
                  <div className="font-medium">{trend.description}</div>
                  <div className="text-sm text-gray-600">
                    Confidence: {(trend.confidence * 100).toFixed(1)}%
                  </div>
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
          <h3 className="text-lg font-semibold mb-3">Cross-Session Patterns</h3>
          {crossSessionPatterns.length > 0 ? (
            <div className="space-y-2">
              {crossSessionPatterns.map((pattern) => (
                <button
                  key={pattern.id}
                  className="p-2 border rounded cursor-pointer hover:bg-gray-50 text-left w-full"
                  onClick={() => onPatternSelect?.(pattern)}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onPatternSelect?.(pattern)
                    }
                  }}
                  aria-label={`Select cross-session pattern: ${pattern.description}`}
                  type="button"
                >
                  <div className="font-medium">{pattern.description}</div>
                  <div className="text-sm text-gray-600">
                    Confidence: {(pattern.confidence * 100).toFixed(1)}%
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No cross-session patterns found</div>
          )}
        </div>

        {/* Risk Correlations Section */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3">Risk Correlations</h3>
          {riskCorrelations.length > 0 ? (
            <div className="space-y-2">
              {riskCorrelations.map((correlation) => (
                <button
                  key={correlation.id}
                  className="p-2 border rounded cursor-pointer hover:bg-gray-50 text-left w-full"
                  onClick={() => onPatternSelect?.(correlation)}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onPatternSelect?.(correlation)
                    }
                  }}
                  aria-label={`Select risk correlation: ${correlation.description}`}
                  type="button"
                >
                  <div className="font-medium">{correlation.description}</div>
                  <div className="text-sm text-gray-600">
                    Confidence: {(correlation.confidence * 100).toFixed(1)}%
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">No risk correlations found</div>
          )}
        </div>
      </div>

      {showControls && (
        <div className="mt-4 flex justify-between items-center">
          <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Export Patterns
          </button>
          <button className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
            Refresh Data
          </button>
        </div>
      )}
    </div>
  )
}

export default PatternVisualization
