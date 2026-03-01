import { motion, AnimatePresence } from 'framer-motion'
import React, { useState, useCallback, useEffect } from 'react'

import type {
  SessionData,
  BiasAnalysisResults,
  PresetScenario,
  CounterfactualScenario,
  HistoricalComparison,
} from '../../../lib/types/bias-detection'
import {
  PRESET_SCENARIOS,
  calculateBiasFactors,
  generateCounterfactualScenarios,
  generateHistoricalComparison,
  generateRecommendations,
  createExportData,
  generateSessionId,
} from '../../../lib/utils/demo-helpers'
import { BiasAnalysisDisplay } from './BiasAnalysisDisplay'
import { CounterfactualAnalysis } from './CounterfactualAnalysis'
import { ExportControls } from './ExportControls'
import { HistoricalProgressTracker } from './HistoricalProgressTracker'
import { PresetScenarioSelector } from './PresetScenarioSelector'
import { SessionInputForm } from './SessionInputForm'

interface EnhancedBiasDetectionInterfaceProps {
  className?: string
}

type AnalysisStep = 'input' | 'analyzing' | 'results' | 'insights'

export const EnhancedBiasDetectionInterface: React.FC<
  EnhancedBiasDetectionInterfaceProps
> = ({ className = '' }) => {
  // Core state management
  const [currentStep, setCurrentStep] = useState<AnalysisStep>('input')
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [analysisResults, setAnalysisResults] =
    useState<BiasAnalysisResults | null>(null)
  const [counterfactualScenarios, setCounterfactualScenarios] = useState<
    CounterfactualScenario[]
  >([])
  const [historicalComparison, setHistoricalComparison] =
    useState<HistoricalComparison | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [activeTab, setActiveTab] = useState<
    'analysis' | 'counterfactual' | 'historical' | 'export'
  >('analysis')
  const [progressPercent, setProgressPercent] = useState(0)

  // Enhanced state for improved UX
  const [savedSessions, setSavedSessions] = useState<SessionData[]>([])
  const [quickFilters, setQuickFilters] = useState({
    riskLevel: 'all' as 'all' | 'low' | 'medium' | 'high' | 'critical',
    category: 'all' as
      | 'all'
      | 'cultural'
      | 'gender'
      | 'age'
      | 'linguistic'
      | 'intersectional',
  })
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [analysisSettings, setAnalysisSettings] = useState({
    sensitivity: 0.7,
    includeCounterfactuals: true,
    includeHistorical: true,
    confidenceThreshold: 0.6,
  })

  // Simulate analysis progress
  useEffect(() => {
    if (isAnalyzing) {
      const interval = setInterval(() => {
        setProgressPercent((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            return 100
          }
          return prev + Math.random() * 15
        })
      }, 200)

      return () => clearInterval(interval)
    }
  }, [isAnalyzing])

  const handleAnalyze = useCallback(
    async (data: SessionData) => {
      setIsAnalyzing(true)
      setCurrentStep('analyzing')
      setSessionData(data)
      setProgressPercent(0)

      try {
        // Simulate realistic analysis time
        await new Promise((resolve) => setTimeout(resolve, 2500))

        // Calculate bias factors with enhanced settings
        const biasFactors = calculateBiasFactors(data)

        // Apply sensitivity adjustment
        const adjustedFactors = {
          ...biasFactors,
          overall: Math.min(
            1,
            biasFactors.overall * analysisSettings.sensitivity,
          ),
        }

        // Create comprehensive analysis results
        const results: BiasAnalysisResults = {
          sessionId: generateSessionId(),
          timestamp: new Date(),
          overallBiasScore: adjustedFactors.overall,
          alertLevel:
            adjustedFactors.overall >= 0.8
              ? 'critical'
              : adjustedFactors.overall >= 0.6
                ? 'high'
                : adjustedFactors.overall >= 0.4
                  ? 'medium'
                  : 'low',
          confidence: Math.min(1, 0.6 + Math.random() * 0.3),
          layerResults: {
            preprocessing: {
              biasScore: adjustedFactors.linguistic,
              linguisticBias: {
                genderBiasScore: adjustedFactors.gender,
                racialBiasScore: adjustedFactors.racial,
                ageBiasScore: adjustedFactors.age,
                culturalBiasScore: adjustedFactors.cultural,
              },
              representationAnalysis: {
                diversityIndex: 1 - adjustedFactors.overall,
                underrepresentedGroups:
                  adjustedFactors.age > 0.5 ? ['elderly'] : [],
              },
            },
            modelLevel: {
              biasScore: adjustedFactors.model,
              fairnessMetrics: {
                demographicParity: 1 - adjustedFactors.model,
                equalizedOdds: 1 - adjustedFactors.model * 0.8,
                calibration: 1 - adjustedFactors.model * 0.6,
              },
            },
            interactive: {
              biasScore: adjustedFactors.interactive,
              counterfactualAnalysis: {
                scenariosAnalyzed: 8,
                biasDetected: adjustedFactors.interactive > 0.3,
                consistencyScore: 1 - adjustedFactors.interactive,
              },
            },
            evaluation: {
              biasScore: adjustedFactors.evaluation,
              huggingFaceMetrics: {
                bias: adjustedFactors.evaluation,
                stereotype: adjustedFactors.cultural,
                regard: {
                  positive: 1 - adjustedFactors.overall,
                  negative: adjustedFactors.overall,
                },
              },
            },
          },
          recommendations: generateRecommendations(adjustedFactors),
          demographics: data.demographics,
        }

        setAnalysisResults(results)

        // Generate additional insights if enabled
        if (analysisSettings.includeCounterfactuals) {
          const scenarios = generateCounterfactualScenarios(adjustedFactors)
          setCounterfactualScenarios(scenarios)
        }

        if (analysisSettings.includeHistorical) {
          const historical = generateHistoricalComparison(
            adjustedFactors.overall,
          )
          setHistoricalComparison(historical)
        }

        // Save session to history
        setSavedSessions((prev) => [data, ...prev.slice(0, 9)]) // Keep last 10 sessions

        setCurrentStep('results')
      } catch (error) {
        console.error('Analysis failed:', error)
        setCurrentStep('input')
      } finally {
        setIsAnalyzing(false)
        setProgressPercent(0)
      }
    },
    [analysisSettings],
  )

  const handleLoadPreset = useCallback(
    (preset: PresetScenario) => {
      const sessionData: SessionData = {
        sessionId: generateSessionId(),
        scenario: preset.scenario,
        demographics: preset.demographics,
        content: preset.content,
        timestamp: new Date(),
      }
      void handleAnalyze(sessionData)
    },
    [handleAnalyze],
  )

  const handleExport = useCallback(() => {
    if (analysisResults) {
      const exportData = createExportData(
        analysisResults,
        counterfactualScenarios,
        historicalComparison,
      )
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `enhanced-bias-analysis-${analysisResults.sessionId}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }, [analysisResults, counterfactualScenarios, historicalComparison])

  const resetAnalysis = useCallback(() => {
    setCurrentStep('input')
    setSessionData(null)
    setAnalysisResults(null)
    setCounterfactualScenarios([])
    setHistoricalComparison(null)
    setActiveTab('analysis')
  }, [])

  // Filter presets based on quick filters
  const filteredPresets = PRESET_SCENARIOS.filter((preset) => {
    if (
      quickFilters.riskLevel !== 'all' &&
      preset.riskLevel !== quickFilters.riskLevel
    ) {
      return false
    }
    if (
      quickFilters.category !== 'all' &&
      preset.category !== quickFilters.category
    ) {
      return false
    }
    return true
  })

  return (
    <div className={`enhanced-bias-detection-interface ${className}`}>
      {/* Enhanced Header with Progress */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className='bg-white border-gray-100 mb-6 rounded-2xl border p-6 shadow-lg'
      >
        <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <h1 className='text-gray-900 mb-2 text-3xl font-bold'>
              Enhanced Bias Detection
            </h1>
            <p className='text-gray-600'>
              Advanced AI-powered analysis with real-time insights and
              recommendations
            </p>
          </div>

          {/* Step Indicator */}
          <div className='flex items-center space-x-2'>
            {(
              ['input', 'analyzing', 'results', 'insights'] as AnalysisStep[]
            ).map((step, index) => (
              <div
                key={step}
                className={`flex items-center ${index < 3 ? 'mr-2' : ''}`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${
                    currentStep === step
                      ? 'bg-blue-600 text-white'
                      : index <
                          (
                            [
                              'input',
                              'analyzing',
                              'results',
                              'insights',
                            ] as AnalysisStep[]
                          ).indexOf(currentStep)
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {index + 1}
                </div>
                {index < 3 && (
                  <div
                    className={`mx-1 h-0.5 w-8 transition-all duration-300 ${
                      index <
                      (
                        [
                          'input',
                          'analyzing',
                          'results',
                          'insights',
                        ] as AnalysisStep[]
                      ).indexOf(currentStep)
                        ? 'bg-green-500'
                        : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Progress Bar for Analysis */}
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className='mt-4'
          >
            <div className='text-gray-600 mb-2 flex items-center justify-between text-sm'>
              <span>Analyzing bias patterns...</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className='bg-gray-200 h-2 w-full rounded-full'>
              <motion.div
                className='from-blue-500 to-purple-600 h-2 rounded-full bg-gradient-to-r'
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Main Content Area */}
      <AnimatePresence mode='wait'>
        {currentStep === 'input' && (
          <motion.div
            key='input'
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className='space-y-6'
          >
            {/* Quick Filters */}
            <div className='bg-white border-gray-100 rounded-xl border p-6 shadow-sm'>
              <h3 className='text-gray-900 mb-4 text-lg font-semibold'>
                Quick Start Options
              </h3>

              <div className='mb-6 grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div>
                  <label className='text-gray-700 mb-2 block text-sm font-medium'>
                    Risk Level Filter
                  </label>
                  <select
                    value={quickFilters.riskLevel}
                    onChange={(e) =>
                      setQuickFilters((prev) => ({
                        ...prev,
                        riskLevel: e.target.value as typeof prev.riskLevel,
                      }))
                    }
                    className='border-gray-300 focus:ring-blue-500 focus:border-blue-500 w-full rounded-lg border px-3 py-2 focus:ring-2'
                  >
                    <option value='all'>All Risk Levels</option>
                    <option value='low'>Low Risk</option>
                    <option value='medium'>Medium Risk</option>
                    <option value='high'>High Risk</option>
                    <option value='critical'>Critical Risk</option>
                  </select>
                </div>

                <div>
                  <label className='text-gray-700 mb-2 block text-sm font-medium'>
                    Bias Category Filter
                  </label>
                  <select
                    value={quickFilters.category}
                    onChange={(e) =>
                      setQuickFilters((prev) => ({
                        ...prev,
                        category: e.target.value as typeof prev.category,
                      }))
                    }
                    className='border-gray-300 focus:ring-blue-500 focus:border-blue-500 w-full rounded-lg border px-3 py-2 focus:ring-2'
                  >
                    <option value='all'>All Categories</option>
                    <option value='cultural'>Cultural Bias</option>
                    <option value='gender'>Gender Bias</option>
                    <option value='age'>Age Bias</option>
                    <option value='linguistic'>Linguistic Bias</option>
                    <option value='intersectional'>Intersectional</option>
                  </select>
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <div className='border-t pt-4'>
                <button
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className='text-blue-600 hover:text-blue-700 flex items-center gap-2 text-sm font-medium transition-colors'
                >
                  <span>Advanced Settings</span>
                  <motion.svg
                    animate={{ rotate: showAdvancedSettings ? 180 : 0 }}
                    className='h-4 w-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M19 9l-7 7-7-7'
                    />
                  </motion.svg>
                </button>

                <AnimatePresence>
                  {showAdvancedSettings && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className='mt-4 grid grid-cols-1 gap-4 md:grid-cols-2'
                    >
                      <div>
                        <label className='text-gray-700 mb-2 block text-sm font-medium'>
                          Sensitivity: {analysisSettings.sensitivity.toFixed(1)}
                        </label>
                        <input
                          type='range'
                          min='0.3'
                          max='1.0'
                          step='0.1'
                          value={analysisSettings.sensitivity}
                          onChange={(e) =>
                            setAnalysisSettings((prev) => ({
                              ...prev,
                              sensitivity: parseFloat(e.target.value),
                            }))
                          }
                          className='w-full'
                        />
                      </div>

                      <div>
                        <label className='text-gray-700 mb-2 block text-sm font-medium'>
                          Confidence Threshold:{' '}
                          {analysisSettings.confidenceThreshold.toFixed(1)}
                        </label>
                        <input
                          type='range'
                          min='0.4'
                          max='0.9'
                          step='0.1'
                          value={analysisSettings.confidenceThreshold}
                          onChange={(e) =>
                            setAnalysisSettings((prev) => ({
                              ...prev,
                              confidenceThreshold: parseFloat(e.target.value),
                            }))
                          }
                          className='w-full'
                        />
                      </div>

                      <div className='flex items-center'>
                        <input
                          type='checkbox'
                          id='includeCounterfactuals'
                          checked={analysisSettings.includeCounterfactuals}
                          onChange={(e) =>
                            setAnalysisSettings((prev) => ({
                              ...prev,
                              includeCounterfactuals: e.target.checked,
                            }))
                          }
                          className='mr-2'
                        />
                        <label
                          htmlFor='includeCounterfactuals'
                          className='text-gray-700 text-sm'
                        >
                          Include Counterfactual Analysis
                        </label>
                      </div>

                      <div className='flex items-center'>
                        <input
                          type='checkbox'
                          id='includeHistorical'
                          checked={analysisSettings.includeHistorical}
                          onChange={(e) =>
                            setAnalysisSettings((prev) => ({
                              ...prev,
                              includeHistorical: e.target.checked,
                            }))
                          }
                          className='mr-2'
                        />
                        <label
                          htmlFor='includeHistorical'
                          className='text-gray-700 text-sm'
                        >
                          Include Historical Comparison
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Enhanced Preset Scenarios */}
            <div className='bg-white border-gray-100 rounded-xl border p-6 shadow-sm'>
              <h3 className='text-gray-900 mb-4 text-lg font-semibold'>
                Preset Scenarios ({filteredPresets.length} available)
              </h3>
              <PresetScenarioSelector
                presets={filteredPresets}
                onSelectPreset={handleLoadPreset}
                className='enhanced-preset-selector'
              />
            </div>

            {/* Custom Session Input */}
            <div className='bg-white border-gray-100 rounded-xl border p-6 shadow-sm'>
              <h3 className='text-gray-900 mb-4 text-lg font-semibold'>
                Custom Analysis
              </h3>
              <SessionInputForm
                onSubmit={handleAnalyze}
                className='enhanced-session-form'
              />
            </div>

            {/* Session History */}
            {savedSessions.length > 0 && (
              <div className='bg-white border-gray-100 rounded-xl border p-6 shadow-sm'>
                <h3 className='text-gray-900 mb-4 text-lg font-semibold'>
                  Recent Sessions
                </h3>
                <div className='space-y-2'>
                  {savedSessions.slice(0, 5).map((session, _index) => (
                    <div
                      key={session.sessionId}
                      className='bg-gray-50 hover:bg-gray-100 flex cursor-pointer items-center justify-between rounded-lg p-3 transition-colors'
                      onClick={() => handleAnalyze(session)}
                    >
                      <div>
                        <div className='text-sm font-medium'>
                          {session.scenario || 'Custom Session'}
                        </div>
                        <div className='text-gray-500 text-xs'>
                          {session.timestamp.toLocaleDateString()} -
                          {session.demographics.age},{' '}
                          {session.demographics.gender},{' '}
                          {session.demographics.ethnicity}
                        </div>
                      </div>
                      <button className='text-blue-600 hover:text-blue-700 text-sm font-medium'>
                        Re-analyze
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {currentStep === 'analyzing' && (
          <motion.div
            key='analyzing'
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className='bg-white border-gray-100 rounded-xl border p-12 text-center shadow-sm'
          >
            <div className='mx-auto mb-6 h-16 w-16'>
              <svg
                className='text-blue-600 h-full w-full animate-spin'
                fill='none'
                viewBox='0 0 24 24'
              >
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                />
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                />
              </svg>
            </div>
            <h3 className='text-gray-900 mb-2 text-xl font-semibold'>
              Analyzing Bias Patterns
            </h3>
            <p className='text-gray-600 mb-4'>
              Running comprehensive analysis across multiple bias detection
              layers...
            </p>
            <div className='mx-auto max-w-md'>
              <div className='text-gray-600 mb-2 flex items-center justify-between text-sm'>
                <span>Progress</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className='bg-gray-200 h-2 w-full rounded-full'>
                <motion.div
                  className='from-blue-500 to-purple-600 h-2 rounded-full bg-gradient-to-r'
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {(currentStep === 'results' || currentStep === 'insights') &&
          analysisResults && (
            <motion.div
              key='results'
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className='space-y-6'
            >
              {/* Results Header */}
              <div className='bg-white border-gray-100 rounded-xl border p-6 shadow-sm'>
                <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                  <div>
                    <h2 className='text-gray-900 text-2xl font-bold'>
                      Analysis Results
                    </h2>
                    <p className='text-gray-600'>
                      Session ID: {analysisResults.sessionId} • Confidence:{' '}
                      {(analysisResults.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className='flex gap-2'>
                    <button
                      onClick={handleExport}
                      className='bg-green-600 text-white hover:bg-green-700 flex items-center gap-2 rounded-lg px-4 py-2 transition-colors'
                    >
                      <svg
                        className='h-4 w-4'
                        fill='none'
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                        />
                      </svg>
                      Export
                    </button>
                    <button
                      onClick={resetAnalysis}
                      className='bg-gray-600 text-white hover:bg-gray-700 rounded-lg px-4 py-2 transition-colors'
                    >
                      New Analysis
                    </button>
                  </div>
                </div>

                {/* Enhanced Tab Navigation */}
                <div className='border-gray-200 mt-6 border-b'>
                  <div className='flex space-x-8'>
                    {[
                      { id: 'analysis', label: 'Main Analysis', icon: '📊' },
                      {
                        id: 'counterfactual',
                        label: 'What-If Scenarios',
                        icon: '🔍',
                        badge: counterfactualScenarios.length,
                      },
                      {
                        id: 'historical',
                        label: 'Historical Trends',
                        icon: '📈',
                      },
                      { id: 'export', label: 'Export & Share', icon: '💾' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`flex items-center gap-2 border-b-2 px-1 pb-4 text-sm font-medium transition-colors ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                        {tab.badge && (
                          <span className='bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs'>
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tab Content */}
              <AnimatePresence mode='wait'>
                {activeTab === 'analysis' && (
                  <motion.div
                    key='analysis-tab'
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <BiasAnalysisDisplay
                      results={analysisResults}
                      sessionData={sessionData}
                    />
                  </motion.div>
                )}

                {activeTab === 'counterfactual' && (
                  <motion.div
                    key='counterfactual-tab'
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <CounterfactualAnalysis
                      scenarios={counterfactualScenarios}
                      originalSession={sessionData}
                    />
                  </motion.div>
                )}

                {activeTab === 'historical' && historicalComparison && (
                  <motion.div
                    key='historical-tab'
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <HistoricalProgressTracker
                      comparison={historicalComparison}
                    />
                  </motion.div>
                )}

                {activeTab === 'export' && (
                  <motion.div
                    key='export-tab'
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <ExportControls
                      data={analysisResults}
                      counterfactual={counterfactualScenarios}
                      historical={historicalComparison}
                      onExport={handleExport}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  )
}

export default EnhancedBiasDetectionInterface
