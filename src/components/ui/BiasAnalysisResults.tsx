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
        <div className='mb-3'>
          <div className='mb-1 flex items-center justify-between'>
            <span className='text-gray-700 text-sm font-medium'>{label}</span>
            <span
              className={`text-sm font-semibold ${getBiasScoreColor(score)}`}
            >
              {formatBiasScore(score)}
            </span>
          </div>
          <div className='bg-gray-200 h-2 w-full rounded-full'>
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
        <div className='text-gray-500 py-8 text-center'>
          <div className='mb-2 text-4xl'>✅</div>
          <p>No specific recommendations at this time.</p>
          <p className='mt-1 text-sm'>
            The analysis indicates low bias levels.
          </p>
        </div>
      )
    }

    return (
      <div className='space-y-3'>
        {result.recommendations.map((recommendation, index) => (
          <div
            key={index}
            className='bg-blue-50 border-blue-200 flex items-start gap-3 rounded-lg border p-3'
          >
            <div className='bg-blue-500 text-white flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold'>
              {index + 1}
            </div>
            <p className='text-blue-800 text-sm leading-relaxed'>
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
        <div className='bg-gray-50 mt-4 rounded-lg border p-4'>
          <h4 className='text-gray-800 mb-3 font-semibold'>
            {layer.name} Analysis Details
          </h4>
          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='text-gray-600 font-medium'>Bias Score:</span>
              <span
                className={`ml-2 font-semibold ${getBiasScoreColor(layer.bias_score)}`}
              >
                {formatBiasScore(layer.bias_score)}
              </span>
            </div>
            {layer.confidence && (
              <div>
                <span className='text-gray-600 font-medium'>Confidence:</span>
                <span className='text-gray-800 ml-2 font-semibold'>
                  {formatBiasScore(layer.confidence)}
                </span>
              </div>
            )}
          </div>
          {layer.details && (
            <div className='mt-3'>
              <span className='text-gray-600 font-medium'>
                Additional Details:
              </span>
              <pre className='bg-white mt-1 overflow-x-auto rounded border p-2 text-xs'>
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
      <div className='bg-white border-gray-200 border-b px-6 py-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-gray-900 text-2xl font-bold'>
              Bias Analysis Results
            </h1>
            <p className='text-gray-600 mt-1 text-sm'>
              Analysis completed on{' '}
              {new Date(result.createdAt).toLocaleString()}
            </p>
          </div>
          <div className='flex items-center gap-3'>
            {onExport && (
              <div className='flex gap-2'>
                <button
                  onClick={() => handleExport('json')}
                  className='btn-secondary text-xs'
                >
                  Export JSON
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className='btn-secondary text-xs'
                >
                  Export CSV
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className='btn-secondary text-xs'
                >
                  Export PDF
                </button>
              </div>
            )}
            {onNewAnalysis && (
              <button onClick={onNewAnalysis} className='btn-primary'>
                New Analysis
              </button>
            )}
          </div>
        </div>
      </div>

      <div className='space-y-6 p-6'>
        {/* Overview Section */}
        <div className='bg-white border-gray-200 overflow-hidden rounded-lg border'>
          <button
            onClick={() => toggleSection('overview')}
            className='bg-gray-50 border-gray-200 hover:bg-gray-100 w-full border-b px-6 py-4 text-left transition-colors'
          >
            <div className='flex items-center justify-between'>
              <h2 className='text-gray-900 text-lg font-semibold'>
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
            <div className='p-6'>
              <div className='mb-6 grid grid-cols-1 gap-6 md:grid-cols-3'>
                {/* Overall Bias Score */}
                <div className='text-center'>
                  <div
                    className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold ${getAlertLevelColor(result.alertLevel)}`}
                  >
                    {result.alertLevel.toUpperCase()} BIAS LEVEL
                  </div>
                  <div className='mt-3'>
                    <div
                      className={`text-3xl font-bold ${getBiasScoreColor(result.overallBiasScore)}`}
                    >
                      {formatBiasScore(result.overallBiasScore)}
                    </div>
                    <div className='text-gray-600 mt-1 text-sm'>
                      Overall Bias Score
                    </div>
                  </div>
                </div>

                {/* Confidence */}
                <div className='text-center'>
                  <div className='text-blue-600 text-3xl font-bold'>
                    {formatBiasScore(result.confidence)}
                  </div>
                  <div className='text-gray-600 mt-1 text-sm'>
                    Analysis Confidence
                  </div>
                </div>

                {/* Processing Time */}
                <div className='text-center'>
                  <div className='text-purple-600 text-3xl font-bold'>
                    {result.processingTimeMs}ms
                  </div>
                  <div className='text-gray-600 mt-1 text-sm'>
                    Processing Time
                  </div>
                </div>
              </div>

              {/* Demographics Summary */}
              <div className='bg-gray-50 rounded-lg p-4'>
                <h3 className='text-gray-800 mb-3 font-semibold'>
                  Patient Demographics
                </h3>
                <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
                  <div>
                    <span className='text-gray-600 font-medium'>Gender:</span>
                    <span className='ml-2 capitalize'>
                      {result.demographics.gender}
                    </span>
                  </div>
                  <div>
                    <span className='text-gray-600 font-medium'>
                      Ethnicity:
                    </span>
                    <span className='ml-2 capitalize'>
                      {result.demographics.ethnicity}
                    </span>
                  </div>
                  <div>
                    <span className='text-gray-600 font-medium'>Age:</span>
                    <span className='ml-2'>{result.demographics.age}</span>
                  </div>
                  <div>
                    <span className='text-gray-600 font-medium'>Language:</span>
                    <span className='ml-2 uppercase'>
                      {result.demographics.primaryLanguage}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Layer Analysis Section */}
        <div className='bg-white border-gray-200 overflow-hidden rounded-lg border'>
          <button
            onClick={() => toggleSection('layers')}
            className='bg-gray-50 border-gray-200 hover:bg-gray-100 w-full border-b px-6 py-4 text-left transition-colors'
          >
            <div className='flex items-center justify-between'>
              <h2 className='text-gray-900 text-lg font-semibold'>
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
            <div className='p-6'>
              <div className='space-y-4'>
                {layerResults.map((layer, _index) => (
                  <div
                    key={layer.name}
                    className='border-gray-200 rounded-lg border p-4'
                  >
                    <div className='mb-3 flex items-center justify-between'>
                      <h3 className='text-gray-800 font-semibold capitalize'>
                        {layer.name.replace(/_/g, ' ')}
                      </h3>
                      <button
                        onClick={() =>
                          setSelectedLayer(
                            selectedLayer === layer.name ? null : layer.name,
                          )
                        }
                        className='text-blue-600 hover:text-blue-800 text-sm font-medium'
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
        <div className='bg-white border-gray-200 overflow-hidden rounded-lg border'>
          <button
            onClick={() => toggleSection('recommendations')}
            className='bg-gray-50 border-gray-200 hover:bg-gray-100 w-full border-b px-6 py-4 text-left transition-colors'
          >
            <div className='flex items-center justify-between'>
              <h2 className='text-gray-900 text-lg font-semibold'>
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
            <div className='p-6'>{renderRecommendations()}</div>
          )}
        </div>

        {/* Actions */}
        <div className='border-gray-200 flex flex-col justify-center gap-4 border-t pt-6 sm:flex-row'>
          {onViewHistory && (
            <button onClick={onViewHistory} className='btn-secondary'>
              View Analysis History
            </button>
          )}
          {onNewAnalysis && (
            <button onClick={onNewAnalysis} className='btn-primary'>
              Start New Analysis
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default BiasAnalysisResults
