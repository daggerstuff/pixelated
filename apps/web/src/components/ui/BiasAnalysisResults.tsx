import React, { useState, useCallback, useMemo } from 'react'

import { InputValidator } from '@/middleware/security'

interface BiasAnalysisResult {
  id: string
  overallBiasScore: number
  alertLevel: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  layerResults: {
    [layer: string]: {
      bias_score: number
      layer: string
      confidence?: number
      details?: any
    }
  }
  recommendations: string[]
  demographics: {
    gender: string
    ethnicity: string
    age: string
    primaryLanguage: string
  }
  sessionType: string
  processingTimeMs: number
  createdAt: string
  contentHash: string
}

interface BiasAnalysisResultsProps {
  result: BiasAnalysisResult
  onExport?: (format: 'json' | 'csv' | 'pdf') => void
  onNewAnalysis?: () => void
  onViewHistory?: () => void
  className?: string
}

const SCORE_TIER_FILL = (score: number): string =>
  score < 0.2
    ? 'bg-green-500'
    : score < 0.4
      ? 'bg-yellow-500'
      : score < 0.6
        ? 'bg-orange-500'
        : 'bg-red-500'

export const BiasAnalysisResults: React.FC<BiasAnalysisResultsProps> = ({
  result,
  onExport,
  onNewAnalysis,
  onViewHistory,
  className = '',
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview']),
  )
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null)

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }, [])

  const getAlertLevelColor = useCallback((level: string) => {
    switch (level) {
      case 'low':
        return 'bg-secondary border border-input text-foreground'
      case 'medium':
        return 'bg-secondary border border-ring text-foreground font-medium'
      case 'high':
        return 'bg-secondary border border-ring text-foreground font-semibold'
      case 'critical':
        return 'bg-primary text-primary-foreground font-semibold'
      default:
        return 'bg-secondary border border-border text-muted-foreground'
    }
  }, [])

  const getBiasScoreColor = useCallback((score: number) => {
    if (score < 0.2) {
      return 'text-muted-foreground'
    }
    if (score < 0.4) {
      return 'text-foreground'
    }
    if (score < 0.6) {
      return 'text-foreground font-semibold'
    }
    return 'text-foreground font-bold'
  }, [])

  const formatBiasScore = useCallback((score: number) => {
    return `${(score * 100).toFixed(1)}%`
  }, [])

  const layerResults = useMemo(() => {
    return Object.entries(result.layerResults)
      .map(([key, value]) => ({
        name: key,
        ...value,
      }))
      .sort((a, b) => b.bias_score - a.bias_score)
  }, [result.layerResults])

  const handleExport = useCallback(
    (format: 'json' | 'csv' | 'pdf') => {
      if (onExport) {
        onExport(format)
      }
    },
    [onExport],
  )

  const renderBiasScoreBar = useCallback(
    (score: number, label: string) => {
      const percentage = Math.min(score * 100, 100)
      return (
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <span
              className={`text-sm font-semibold ${getBiasScoreColor(score)}`}
            >
              {formatBiasScore(score)}
            </span>
          </div>
          <div className="h-2 w-full rounded-none bg-secondary">
            <div
              className={`h-2 rounded-none transition-all duration-300 ${SCORE_TIER_FILL(score)}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )
    },
    [getBiasScoreColor, formatBiasScore],
  )

  const renderRecommendations = useCallback(() => {
    if (!result.recommendations || result.recommendations.length === 0) {
      return (
        <div className="py-8 text-center text-muted-foreground">
          <div className="mb-2 text-4xl">✅</div>
          <p>No specific recommendations at this time.</p>
          <p className="mt-1 text-sm">
            The analysis indicates low bias levels.
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {result.recommendations.map((recommendation, index) => (
          <div
            key={index}
            className="flex items-start gap-3 rounded-none border border-input bg-secondary p-3"
          >
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-none bg-primary text-sm font-semibold text-primary-foreground">
              {index + 1}
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {InputValidator.sanitizeString(recommendation)}
            </p>
          </div>
        ))}
      </div>
    )
  }, [result.recommendations])

  const renderLayerDetails = useCallback(
    (layer: any) => {
      if (!selectedLayer || selectedLayer !== layer.name) return null

      return (
        <div className="mt-4 rounded-none border bg-secondary p-4">
          <h4 className="mb-3 font-semibold text-foreground">
            {layer.name} Analysis Details
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">
                Bias Score:
              </span>
              <span
                className={`ml-2 font-semibold ${getBiasScoreColor(layer.bias_score)}`}
              >
                {formatBiasScore(layer.bias_score)}
              </span>
            </div>
            {layer.confidence && (
              <div>
                <span className="font-medium text-muted-foreground">
                  Confidence:
                </span>
                <span className="ml-2 font-semibold text-foreground">
                  {formatBiasScore(layer.confidence)}
                </span>
              </div>
            )}
          </div>
          {layer.details && (
            <div className="mt-3">
              <span className="font-medium text-muted-foreground">
                Additional Details:
              </span>
              <pre className="mt-1 overflow-x-auto rounded-none border border-input bg-secondary p-2 text-xs">
                {JSON.stringify(layer.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )
    },
    [selectedLayer, getBiasScoreColor, formatBiasScore],
  )

  return (
    <div className={`bias-analysis-results ${className}`}>
      {/* Header */}
      <div className="border border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Bias Analysis Results
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Analysis completed on{' '}
              {new Date(result.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {onExport && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('json')}
                  className="btn-secondary text-xs"
                >
                  Export JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="btn-secondary text-xs"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="btn-secondary text-xs"
                >
                  Export PDF
                </button>
              </div>
            )}
            {onNewAnalysis && (
              <button onClick={onNewAnalysis} className="btn-primary">
                New Analysis
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {/* Overview Section */}
        <div className="overflow-hidden rounded-none border border-border bg-card">
          <button
            onClick={() => toggleSection('overview')}
            className="w-full border border-b border-border bg-secondary px-6 py-4 text-left transition-colors hover:bg-accent"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Analysis Overview
              </h2>
              <div
                className={`transform transition-transform ${expandedSections.has('overview') ? 'rotate-180' : ''}`}
              >
                ▼
              </div>
            </div>
          </button>

          {expandedSections.has('overview') && (
            <div className="p-6">
              <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
                {/* Overall Bias Score */}
                <div className="text-center">
                  <div
                    className={`inline-flex items-center rounded-none border px-4 py-2 text-sm font-semibold ${getAlertLevelColor(result.alertLevel)}`}
                  >
                    {result.alertLevel.toUpperCase()} BIAS LEVEL
                  </div>
                  <div className="mt-3">
                    <div
                      className={`text-3xl font-bold ${getBiasScoreColor(result.overallBiasScore)}`}
                    >
                      {formatBiasScore(result.overallBiasScore)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Overall Bias Score
                    </div>
                  </div>
                </div>

                {/* Confidence */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground">
                    {formatBiasScore(result.confidence)}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Analysis Confidence
                  </div>
                </div>

                {/* Processing Time */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-foreground">
                    {result.processingTimeMs}ms
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Processing Time
                  </div>
                </div>
              </div>

              {/* Demographics Summary */}
              <div className="rounded-none bg-secondary p-4">
                <h3 className="mb-3 font-semibold text-foreground">
                  Patient Demographics
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <div>
                    <span className="font-medium text-muted-foreground">
                      Gender:
                    </span>
                    <span className="ml-2 capitalize">
                      {result.demographics.gender}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">
                      Ethnicity:
                    </span>
                    <span className="ml-2 capitalize">
                      {result.demographics.ethnicity}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">
                      Age:
                    </span>
                    <span className="ml-2">{result.demographics.age}</span>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">
                      Language:
                    </span>
                    <span className="ml-2 uppercase">
                      {result.demographics.primaryLanguage}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Layer Analysis Section */}
        <div className="overflow-hidden rounded-none border border-border bg-card">
          <button
            onClick={() => toggleSection('layers')}
            className="w-full border border-b border-border bg-secondary px-6 py-4 text-left transition-colors hover:bg-accent"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Layer-by-Layer Analysis
              </h2>
              <div
                className={`transform transition-transform ${expandedSections.has('layers') ? 'rotate-180' : ''}`}
              >
                ▼
              </div>
            </div>
          </button>

          {expandedSections.has('layers') && (
            <div className="p-6">
              <div className="space-y-4">
                {layerResults.map((layer, _index) => (
                  <div
                    key={layer.name}
                    className="rounded-none border border-border p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-semibold capitalize text-foreground">
                        {layer.name.replace(/_/g, ' ')}
                      </h3>
                      <button
                        onClick={() =>
                          setSelectedLayer(
                            selectedLayer === layer.name ? null : layer.name,
                          )
                        }
                        className="text-sm font-medium text-muted-foreground hover:text-foreground"
                      >
                        {selectedLayer === layer.name
                          ? 'Hide Details'
                          : 'View Details'}
                      </button>
                    </div>
                    {renderBiasScoreBar(layer.bias_score, 'Bias Score')}
                    {renderLayerDetails(layer)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recommendations Section */}
        <div className="overflow-hidden rounded-none border border-border bg-card">
          <button
            onClick={() => toggleSection('recommendations')}
            className="w-full border border-b border-border bg-secondary px-6 py-4 text-left transition-colors hover:bg-accent"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Recommendations & Insights
              </h2>
              <div
                className={`transform transition-transform ${expandedSections.has('recommendations') ? 'rotate-180' : ''}`}
              >
                ▼
              </div>
            </div>
          </button>

          {expandedSections.has('recommendations') && (
            <div className="p-6">{renderRecommendations()}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col justify-center gap-4 border border-t border-border pt-6 sm:flex-row">
          {onViewHistory && (
            <button onClick={onViewHistory} className="btn-secondary">
              View Analysis History
            </button>
          )}
          {onNewAnalysis && (
            <button onClick={onNewAnalysis} className="btn-primary">
              Start New Analysis
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default BiasAnalysisResults
