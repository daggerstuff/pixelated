import { ChartBar, Search, TrendingUp, Save } from 'lucide-react'
import React, { useState, useCallback, useEffect, JSX } from 'react'

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
type AnalysisTab = 'analysis' | 'counterfactual' | 'historical' | 'export'
type QuickFilterState = {
  riskLevel: RiskLevelFilter
  category: BiasCategoryFilter
}
type TabItem = {
  id: AnalysisTab
  label: string
  icon: 'chart' | 'search' | 'trending' | 'save'
  badge?: number
}
type RiskLevelFilter = 'all' | 'low' | 'medium' | 'high' | 'critical'
type BiasCategoryFilter =
  | 'all'
  | 'cultural'
  | 'gender'
  | 'age'
  | 'linguistic'
  | 'intersectional'

// Performance optimization: Extract static tabIcons out of component to prevent recreation on every render
const TAB_ICONS: Record<TabItem['icon'], JSX.Element> = {
  chart: <ChartBar className="h-5 w-5" />,
  search: <Search className="h-5 w-5" />,
  trending: <TrendingUp className="h-5 w-5" />,
  save: <Save className="h-5 w-5" />,
}

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
  const [activeTab, setActiveTab] = useState<AnalysisTab>('analysis')
  const [progressPercent, setProgressPercent] = useState(0)

  // Enhanced state for improved UX
  const [savedSessions, setSavedSessions] = useState<SessionData[]>([])
  const [quickFilters, setQuickFilters] = useState<QuickFilterState>({
    riskLevel: 'all',
    category: 'all',
  })
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [analysisSettings, setAnalysisSettings] = useState({
    sensitivity: 0.7,
    includeCounterfactuals: true,
    includeHistorical: true,
    confidenceThreshold: 0.6,
  })
  const analysisStepOrder: AnalysisStep[] = [
    'input',
    'analyzing',
    'results',
    'insights',
  ]
  const [selectedPreset, setSelectedPreset] = useState<PresetScenario | null>(
    null,
  )

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
    return undefined
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
          recommendations: generateRecommendations(
            adjustedFactors,
            data.demographics,
          ),
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
      setSelectedPreset(preset)
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

  const handleSessionSubmit = useCallback(
    (data: Omit<SessionData, 'sessionId' | 'timestamp'>) => {
      const sessionData: SessionData = {
        ...data,
        sessionId: generateSessionId(),
        timestamp: new Date(),
      }
      void handleAnalyze(sessionData)
    },
    [handleAnalyze],
  )

  const handleExport = useCallback(() => {
    if (analysisResults) {
      const fallbackHistoricalComparison: HistoricalComparison = {
        thirtyDayAverage: 0,
        sevenDayTrend: 'stable',
        percentileRank: 50,
        comparisonToAverage: 0,
        trendDirection: 'neutral',
      }
      const exportData = createExportData(
        analysisResults,
        counterfactualScenarios,
        historicalComparison ?? fallbackHistoricalComparison,
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

  const tabConfig: TabItem[] = [
    { id: 'analysis', label: 'Main Analysis', icon: 'chart' },
    {
      id: 'counterfactual',
      label: 'What-If Scenarios',
      icon: 'search',
      badge: counterfactualScenarios.length,
    },
    {
      id: 'historical',
      label: 'Historical Trends',
      icon: 'trending',
    },
    { id: 'export', label: 'Export & Share', icon: 'save' },
  ]

  return (
    <div className={`enhanced-bias-detection-interface ${className}`}>
      {/* Enhanced Header with Progress */}
      <div className="mb-6 rounded-none border border-border bg-card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">
              Enhanced Bias Detection
            </h1>
            <p className="text-muted-foreground">
              Advanced AI-powered analysis with real-time insights and
              recommendations
            </p>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center space-x-2">
            {analysisStepOrder.map((step, index) => (
              <div
                key={step}
                className={`flex items-center ${index < 3 ? 'mr-2' : ''}`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-none text-sm font-medium transition-all duration-300 ${
                    currentStep === step
                      ? 'bg-primary text-primary-foreground'
                      : index < analysisStepOrder.indexOf(currentStep)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {index + 1}
                </div>
                {index < 3 && (
                  <div
                    className={`mx-1 h-0.5 w-8 transition-all duration-300 ${
                      index < analysisStepOrder.indexOf(currentStep)
                        ? 'bg-primary'
                        : 'bg-secondary'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Progress Bar for Analysis */}
        {isAnalyzing && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>Analyzing bias patterns...</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-2 w-full rounded-none bg-secondary">
              <div
                className="h-2 rounded-none bg-primary"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {currentStep === 'input' && (
        <div className="space-y-6">
          {/* Quick Filters */}
          <div className="rounded-none border border-border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Quick Start Options
            </h3>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="risk-level-filter"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Risk Level Filter
                </label>
                <select
                  id="risk-level-filter"
                  value={quickFilters.riskLevel}
                  onChange={(e) => {
                    const value = e.target.value
                    if (
                      value === 'all' ||
                      value === 'low' ||
                      value === 'medium' ||
                      value === 'high' ||
                      value === 'critical'
                    ) {
                      setQuickFilters((prev) => ({
                        ...prev,
                        riskLevel: value,
                      }))
                    }
                  }}
                  className="w-full rounded-none border border-input px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Risk Levels</option>
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                  <option value="critical">Critical Risk</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="bias-category-filter"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Bias Category Filter
                </label>
                <select
                  id="bias-category-filter"
                  value={quickFilters.category}
                  onChange={(e) => {
                    const value = e.target.value
                    if (
                      value === 'all' ||
                      value === 'cultural' ||
                      value === 'gender' ||
                      value === 'age' ||
                      value === 'linguistic' ||
                      value === 'intersectional'
                    ) {
                      setQuickFilters((prev) => ({
                        ...prev,
                        category: value,
                      }))
                    }
                  }}
                  className="w-full rounded-none border border-input px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Categories</option>
                  <option value="cultural">Cultural Bias</option>
                  <option value="gender">Gender Bias</option>
                  <option value="age">Age Bias</option>
                  <option value="linguistic">Linguistic Bias</option>
                  <option value="intersectional">Intersectional</option>
                </select>
              </div>
            </div>

            {/* Advanced Settings Toggle */}
            <div className="border-t pt-4">
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-foreground"
              >
                <span>Advanced Settings</span>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{
                    transform: `rotate(${showAdvancedSettings ? 180 : 0}deg)`,
                    transition: 'transform 150ms ease',
                  }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showAdvancedSettings && (
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Sensitivity: {analysisSettings.sensitivity.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0.3"
                      max="1.0"
                      step="0.1"
                      value={analysisSettings.sensitivity}
                      onChange={(e) =>
                        setAnalysisSettings((prev) => ({
                          ...prev,
                          sensitivity: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Confidence Threshold:{' '}
                      {analysisSettings.confidenceThreshold.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0.4"
                      max="0.9"
                      step="0.1"
                      value={analysisSettings.confidenceThreshold}
                      onChange={(e) =>
                        setAnalysisSettings((prev) => ({
                          ...prev,
                          confidenceThreshold: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="includeCounterfactuals"
                      checked={analysisSettings.includeCounterfactuals}
                      onChange={(e) =>
                        setAnalysisSettings((prev) => ({
                          ...prev,
                          includeCounterfactuals: e.target.checked,
                        }))
                      }
                      className="mr-2"
                    />
                    <label
                      htmlFor="includeCounterfactuals"
                      className="text-sm text-foreground"
                    >
                      Include Counterfactual Analysis
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="includeHistorical"
                      checked={analysisSettings.includeHistorical}
                      onChange={(e) =>
                        setAnalysisSettings((prev) => ({
                          ...prev,
                          includeHistorical: e.target.checked,
                        }))
                      }
                      className="mr-2"
                    />
                    <label
                      htmlFor="includeHistorical"
                      className="text-sm text-foreground"
                    >
                      Include Historical Comparison
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Preset Scenarios */}
          <div className="rounded-none border border-border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Preset Scenarios ({filteredPresets.length} available)
            </h3>
            <PresetScenarioSelector
              scenarios={filteredPresets}
              selectedScenario={selectedPreset}
              onScenarioSelect={handleLoadPreset}
              disabled={isAnalyzing}
            />
          </div>

          {/* Custom Session Input */}
          <div className="rounded-none border border-border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              Custom Analysis
            </h3>
            <SessionInputForm
              onSubmit={handleSessionSubmit}
              disabled={isAnalyzing}
            />
          </div>

          {/* Session History */}
          {savedSessions.length > 0 && (
            <div className="rounded-none border border-border bg-card p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">
                Recent Sessions
              </h3>
              <div className="space-y-2">
                {savedSessions.slice(0, 5).map((session) => (
                  <button
                    type="button"
                    key={session.sessionId}
                    className="flex w-full cursor-pointer items-center justify-between rounded-none bg-secondary p-3 text-left transition-colors hover:bg-secondary"
                    onClick={() => {
                      void handleAnalyze(session)
                    }}
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {session.scenario || 'Custom Session'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {session.timestamp.toLocaleDateString()} -
                        {session.demographics.age},{' '}
                        {session.demographics.gender},{' '}
                        {session.demographics.ethnicity}
                      </div>
                    </div>
                    <span className="text-sm font-medium text-foreground hover:text-foreground">
                      Re-analyze
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {currentStep === 'analyzing' && (
        <div className="rounded-none border border-border bg-card p-12 text-center">
          <div className="mx-auto mb-6 h-16 w-16">
            <svg
              className="h-full w-full animate-spin text-foreground"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-xl font-semibold text-foreground">
            Analyzing Bias Patterns
          </h3>
          <p className="mb-4 text-muted-foreground">
            Running comprehensive analysis across multiple bias detection
            layers...
          </p>
          <div className="mx-auto max-w-md">
            <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-2 w-full rounded-none bg-secondary">
              <div
                className="h-2 rounded-none bg-primary"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {(currentStep === 'results' || currentStep === 'insights') &&
        analysisResults &&
        sessionData && (
          <div className="space-y-6">
            {/* Results Header */}
            <div className="rounded-none border border-border bg-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    Analysis Results
                  </h2>
                  <p className="text-muted-foreground">
                    Session ID: {analysisResults.sessionId} • Confidence:{' '}
                    {(analysisResults.confidence * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 rounded-none bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-accent"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Export
                  </button>
                  <button
                    onClick={resetAnalysis}
                    className="rounded-none bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-accent"
                  >
                    New Analysis
                  </button>
                </div>
              </div>

              {/* Enhanced Tab Navigation */}
              <div className="mt-6 border-b border-border">
                <div className="flex space-x-8">
                  {tabConfig.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 border-b-2 px-1 pb-4 text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'border-ring text-foreground'
                          : 'border-transparent text-muted-foreground hover:border-input hover:text-foreground'
                      }`}
                    >
                      {TAB_ICONS[tab.icon]}
                      <span>{tab.label}</span>
                      {tab.badge && (
                        <span className="rounded-none border border-input bg-secondary px-2 py-0.5 text-xs text-foreground">
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'analysis' && (
              <div>
                <BiasAnalysisDisplay
                  results={analysisResults}
                  sessionData={sessionData}
                />
              </div>
            )}

            {activeTab === 'counterfactual' && (
              <div>
                <CounterfactualAnalysis
                  scenarios={counterfactualScenarios}
                  originalSession={sessionData}
                />
              </div>
            )}

            {activeTab === 'historical' && historicalComparison && (
              <div>
                <HistoricalProgressTracker
                  comparison={historicalComparison}
                  currentScore={analysisResults.overallBiasScore}
                />
              </div>
            )}

            {activeTab === 'export' && (
              <div>
                <ExportControls
                  analysisResults={analysisResults}
                  counterfactualScenarios={counterfactualScenarios}
                  historicalComparison={historicalComparison}
                  onExport={handleExport}
                />
              </div>
            )}
          </div>
        )}
    </div>
  )
}

export default EnhancedBiasDetectionInterface
