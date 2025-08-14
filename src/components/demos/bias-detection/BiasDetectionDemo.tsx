// Main bias detection demo component with comprehensive analysis interface

import React, { useState, useCallback } from 'react'
import { BiasAnalysisDisplay } from './BiasAnalysisDisplay'
import { PresetScenarioSelector } from './PresetScenarioSelector'
import { CounterfactualAnalysis } from './CounterfactualAnalysis'
import { HistoricalProgressTracker } from './HistoricalProgressTracker'
import { SessionInputForm } from './SessionInputForm'
import { ExportControls } from './ExportControls'
import {
  PRESET_SCENARIOS,
  calculateBiasFactors,
  generateCounterfactualScenarios,
  generateHistoricalComparison,
  generateRecommendations,
  createExportData,
  generateSessionId,
} from '../../../lib/utils/demo-helpers'
import type {
  SessionData,
  BiasAnalysisResults,
  PresetScenario,
  CounterfactualScenario,
  HistoricalComparison,
} from '../../../lib/types/bias-detection'

interface BiasDetectionDemoProps {
  className?: string
  onAnalysisComplete?: (results: BiasAnalysisResults) => void
  enableExport?: boolean
  showHistoricalData?: boolean
}

export const BiasDetectionDemo: React.FC<BiasDetectionDemoProps> = ({
  className = '',
  onAnalysisComplete,
  enableExport = true,
  showHistoricalData = true,
}) => {
  // Core state
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [analysisResults, setAnalysisResults] =
    useState<BiasAnalysisResults | null>(null)
  const [counterfactualScenarios, setCounterfactualScenarios] = useState<
    CounterfactualScenario[]
  >([])
  const [historicalComparison, setHistoricalComparison] =
    useState<HistoricalComparison | null>(null)

  // UI state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<PresetScenario | null>(
    null,
  )
  const [activeTab, setActiveTab] = useState<
    'analysis' | 'counterfactual' | 'historical' | 'export'
  >('analysis')
  const [error, setError] = useState<string | null>(null)

  // Analysis function
  const performBiasAnalysis = useCallback(
    async (data: SessionData) => {
      setIsAnalyzing(true)
      setError(null)

      try {
        // Calculate bias factors
        const biasFactors = calculateBiasFactors(data)

        // Create comprehensive analysis results
        const results: BiasAnalysisResults = {
          sessionId: data.sessionId,
          timestamp: new Date(),
          overallBiasScore: biasFactors.overall,
          alertLevel:
            biasFactors.overall >= 0.8
              ? 'critical'
              : biasFactors.overall >= 0.6
                ? 'high'
                : biasFactors.overall >= 0.4
                  ? 'medium'
                  : 'low',
          confidence: 0.85 + Math.random() * 0.1, // Simulated confidence
          layerResults: {
            preprocessing: {
              biasScore: biasFactors.linguistic,
              linguisticBias: {
                genderBiasScore: biasFactors.gender,
                racialBiasScore: biasFactors.racial,
                ageBiasScore: biasFactors.age,
                culturalBiasScore: biasFactors.cultural,
              },
              representationAnalysis: {
                diversityIndex: 1 - biasFactors.overall,
                underrepresentedGroups:
                  biasFactors.age > 0.5 ? ['elderly'] : [],
              },
            },
            modelLevel: {
              biasScore: biasFactors.model,
              fairnessMetrics: {
                demographicParity: 1 - biasFactors.model,
                equalizedOdds: 1 - biasFactors.model * 0.8,
                calibration: 1 - biasFactors.model * 0.6,
              },
            },
            interactive: {
              biasScore: biasFactors.interactive,
              counterfactualAnalysis: {
                scenariosAnalyzed: 10,
                biasDetected: biasFactors.interactive > 0.3,
                consistencyScore: 1 - biasFactors.interactive,
              },
            },
            evaluation: {
              biasScore: biasFactors.evaluation,
              huggingFaceMetrics: {
                bias: biasFactors.evaluation,
                stereotype: biasFactors.cultural,
                regard: {
                  positive: 1 - biasFactors.overall,
                  negative: biasFactors.overall,
                },
              },
            },
          },
          recommendations: generateRecommendations(
            biasFactors,
            data.demographics,
          ),
          demographics: data.demographics,
        }

        // Generate counterfactual scenarios
        const scenarios = generateCounterfactualScenarios(data, biasFactors)

        // Generate historical comparison if enabled
        let historical: HistoricalComparison | null = null
        if (showHistoricalData) {
          historical = generateHistoricalComparison(biasFactors.overall)
        }

        // Update state
        setAnalysisResults(results)
        setCounterfactualScenarios(scenarios)
        setHistoricalComparison(historical)

        // Notify parent component
        onAnalysisComplete?.(results)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed')
      } finally {
        setIsAnalyzing(false)
      }
    },
    [onAnalysisComplete, showHistoricalData],
  )

  // Handle session data submission
  const handleSessionSubmit = useCallback(
    (data: Omit<SessionData, 'sessionId' | 'timestamp'>) => {
      const sessionData: SessionData = {
        ...data,
        sessionId: generateSessionId(),
        timestamp: new Date(),
      }

      setSessionData(sessionData)
      performBiasAnalysis(sessionData)
    },
    [performBiasAnalysis],
  )

  // Handle preset scenario selection
  const handlePresetSelect = useCallback(
    (preset: PresetScenario) => {
      setSelectedPreset(preset)

      const sessionData: SessionData = {
        sessionId: generateSessionId(),
        scenario: preset.id,
        demographics: preset.demographics,
        content: preset.content,
        timestamp: new Date(),
      }

      setSessionData(sessionData)
      performBiasAnalysis(sessionData)
    },
    [performBiasAnalysis],
  )

  // Handle export
  const handleExport = useCallback(() => {
    if (!analysisResults || !counterfactualScenarios) {
      return
    }

    const exportData = createExportData(
      analysisResults,
      counterfactualScenarios,
      historicalComparison || {
        thirtyDayAverage: 0,
        sevenDayTrend: 'stable' as const,
        percentileRank: 50,
        comparisonToAverage: 0,
        trendDirection: 'neutral'
      },
    )

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bias-analysis-${analysisResults.sessionId}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [analysisResults, counterfactualScenarios, historicalComparison])

  // Tab navigation
  const tabs = [
    {
      id: 'analysis' as const,
      label: 'Bias Analysis',
      disabled: !analysisResults,
    },
    {
      id: 'counterfactual' as const,
      label: 'Counterfactual Analysis',
      disabled: !counterfactualScenarios.length,
    },
    {
      id: 'historical' as const,
      label: 'Historical Progress',
      disabled: !historicalComparison,
    },
    { id: 'export' as const, label: 'Export Data', disabled: !analysisResults },
  ]

  return (
    <div className={`bias-detection-demo ${className}`}>
      {/* Header */}
      <div className="demo-header mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Advanced Bias Detection Demo
        </h2>
        <p className="text-gray-600">
          Analyze therapeutic conversations for bias patterns across multiple
          dimensions
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Analysis Error
              </h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Preset Scenarios */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Preset Scenarios
          </h3>
          <PresetScenarioSelector
            scenarios={PRESET_SCENARIOS}
            selectedScenario={selectedPreset}
            onScenarioSelect={handlePresetSelect}
            disabled={isAnalyzing}
          />
        </div>

        {/* Custom Input */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Custom Analysis
          </h3>
          <SessionInputForm
            onSubmit={handleSessionSubmit}
            disabled={isAnalyzing}
            initialData={
              selectedPreset
                ? {
                    scenario: selectedPreset.id,
                    demographics: selectedPreset.demographics,
                    content: selectedPreset.content,
                  }
                : undefined
            }
          />
        </div>
      </div>

      {/* Loading State */}
      {isAnalyzing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-blue-800 font-medium">
              Analyzing bias patterns...
            </span>
          </div>
        </div>
      )}

      {/* Results Section */}
      {analysisResults && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : tab.disabled
                        ? 'border-transparent text-gray-400 cursor-not-allowed'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'analysis' && (
              <BiasAnalysisDisplay
                results={analysisResults}
                sessionData={sessionData}
              />
            )}

            {activeTab === 'counterfactual' &&
              counterfactualScenarios.length > 0 && (
                <CounterfactualAnalysis
                  scenarios={counterfactualScenarios}
                  originalSession={sessionData}
                />
              )}

            {activeTab === 'historical' && historicalComparison && (
              <HistoricalProgressTracker
                comparison={historicalComparison}
                currentScore={analysisResults.overallBiasScore}
              />
            )}

            {activeTab === 'export' && enableExport && (
              <ExportControls
                analysisResults={analysisResults}
                counterfactualScenarios={counterfactualScenarios}
                historicalComparison={historicalComparison}
                onExport={handleExport}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default BiasDetectionDemo
