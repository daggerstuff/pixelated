import type { FC } from 'react';
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
              {trends.map((trend: TrendPattern) => (
                <button
                  key={trend.id}
                  className="p-2 border rounded cursor-pointer hover:bg-gray-50 text-left w-full"
              {trends.map((trend: TrendPattern) => (
                    }
                  }}
                  aria-label={`Select trend pattern: ${trend.description}`}
              {trends.map((trend: TrendPattern) => (
                  </div>
                  <div className="text-xs text-gray-500">
                    {trend.indicators.join(', ')}
              {trends.map((trend: TrendPattern) => (
            <div className="text-gray-500 text-sm">No trends found</div>
          )}
        </div>
              {trends.map((trend: TrendPattern) => (
            <div className="space-y-2">
              {crossSessionPatterns.map((pattern: CrossSessionPattern) => (
                <button
              {trends.map((trend: TrendPattern) => (
                    if (e.key === 'Enter' || e.key === ' ') {
              {crossSessionPatterns.map((pattern: CrossSessionPattern) => (
                >
              {trends.map((trend: TrendPattern) => (
              ))}
              {crossSessionPatterns.map((pattern: CrossSessionPattern) => (

        {/* Risk Correlations Section */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-3">Risk Correlations</h3>
          {riskCorrelations.length > 0 ? (
            <div className="space-y-2">
              {riskCorrelations.map((correlation: RiskCorrelation) => (
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
              {riskCorrelations.map((correlation: RiskCorrelation) => (
              {crossSessionPatterns.map((pattern: CrossSessionPattern) => (
            <div className="text-gray-500 text-sm">No risk correlations found</div>
          )}
        </div>
      </div>

      {showControls && (
              {riskCorrelations.map((correlation: RiskCorrelation) => (
              {crossSessionPatterns.map((pattern: CrossSessionPattern) => (
  )
}

export default PatternVisualization
              {riskCorrelations.map((correlation: RiskCorrelation) => (
              {riskCorrelations.map((correlation: RiskCorrelation) => (
              {riskCorrelations.map((correlation: RiskCorrelation) => (
              {crossSessionPatterns.map((pattern: CrossSessionPattern) => (
              {riskCorrelations.map((correlation: RiskCorrelation) => (
