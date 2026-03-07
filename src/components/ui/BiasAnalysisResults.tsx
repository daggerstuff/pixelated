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
        return 'text-green-600 bg-green-50 border-green-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }, [])

  const getBiasScoreColor = useCallback((score: number) => {
    if (score < 0.2) {
      return 'text-green-600'
    }
    if (score < 0.4) {
      return 'text-yellow-600'
    }
    if (score < 0.6) {
      return 'text-orange-600'
    }
    return 'text-red-600'
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
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-700">{label}</span>
            <span
              className={`text-sm font-semibold ${getBiasScoreColor(score)}`}
            >
              {formatBiasScore(score)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                score < 0.2
                  ? 'bg-green-500'
                  : score < 0.4
                    ? 'bg-yellow-500'
                    : score < 0.6
                      ? 'bg-orange-500'
                      : 'bg-red-500'
              }`}
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
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">✅</div>
          <p>No specific recommendations at this time.</p>
          <p className="text-sm mt-1">
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
            className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200"
          >
            <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
              {index + 1}
            </div>
            <p className="text-blue-800 text-sm leading-relaxed">
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
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
          <h4 className="font-semibold text-gray-800 mb-3">
            {layer.name} Analysis Details
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600">Bias Score:</span>
              <span
                className={`ml-2 font-semibold ${getBiasScoreColor(layer.bias_score)}`}
              >
                {formatBiasScore(layer.bias_score)}
              </span>
            </div>
            {layer.confidence && (
              <div>
                <span className="font-medium text-gray-600">Confidence:</span>
                <span className="ml-2 font-semibold text-gray-800">
                  {formatBiasScore(layer.confidence)}
                </span>
              </div>
            )}
          </div>
          {layer.details && (
            <div className="mt-3">
              <span className="font-medium text-gray-600">
                Additional Details:
              </span>
              <pre className="mt-1 text-xs bg-white p-2 rounded border overflow-x-auto">
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
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Bias Analysis Results
            </h1>
            <p className="text-sm text-gray-600 mt-1">
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

      <div className="p-6 space-y-6">
        {/* Overview Section */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection('overview')}
            className="w-full px-6 py-4 text-left bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Overall Bias Score */}
                <div className="text-center">
                  <div
                    className={`inline-flex items-center px-4 py-2 rounded-full border text-sm font-semibold ${getAlertLevelColor(result.alertLevel)}`}
                  >
                    {result.alertLevel.toUpperCase()} BIAS LEVEL
                  </div>
                  <div className="mt-3">
                    <div
                      className={`text-3xl font-bold ${getBiasScoreColor(result.overallBiasScore)}`}
                    >
                      {formatBiasScore(result.overallBiasScore)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Overall Bias Score
                    </div>
                  </div>
                </div>

                {/* Confidence */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {formatBiasScore(result.confidence)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Analysis Confidence
                  </div>
                </div>

                {/* Processing Time */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {result.processingTimeMs}ms
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Processing Time
                  </div>
                </div>
              </div>

              {/* Demographics Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Patient Demographics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Gender:</span>
                    <span className="ml-2 capitalize">
                      {result.demographics.gender}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">
                      Ethnicity:
                    </span>
                    <span className="ml-2 capitalize">
                      {result.demographics.ethnicity}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Age:</span>
                    <span className="ml-2">{result.demographics.age}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Language:</span>
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
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection('layers')}
            className="w-full px-6 py-4 text-left bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
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
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800 capitalize">
                        {layer.name.replace(/_/g, ' ')}
                      </h3>
                      <button
                        onClick={() =>
                          setSelectedLayer(
                            selectedLayer === layer.name ? null : layer.name,
                          )
                        }
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
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
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection('recommendations')}
            className="w-full px-6 py-4 text-left bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
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
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6 border-t border-gray-200">
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
