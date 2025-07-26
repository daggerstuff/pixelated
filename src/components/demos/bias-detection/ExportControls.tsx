// Export controls component for bias detection analysis data

import React, { useState } from 'react'
import type {
  BiasAnalysisResults,
  CounterfactualScenario,
  HistoricalComparison,
} from '../../../lib/types/bias-detection'

interface ExportControlsProps {
  analysisResults: BiasAnalysisResults
  counterfactualScenarios: CounterfactualScenario[]
  historicalComparison: HistoricalComparison | null
  onExport: () => void
}

export const ExportControls: React.FC<ExportControlsProps> = ({
  analysisResults,
  counterfactualScenarios,
  historicalComparison,
  onExport,
}) => {
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf'>(
    'json',
  )
  const [includeComponents, setIncludeComponents] = useState({
    analysis: true,
    counterfactual: true,
    historical: true,
    recommendations: true,
    demographics: true,
  })
  const [isExporting, setIsExporting] = useState(false)

  // Calculate export size estimate
  const getExportSizeEstimate = () => {
    let size = 0
    if (includeComponents.analysis) {
      size += 15 // KB
    }
    if (includeComponents.counterfactual) {
      size += counterfactualScenarios.length * 2
    }
    if (includeComponents.historical) {
      size += 5
    }
    if (includeComponents.recommendations) {
      size += analysisResults.recommendations.length * 0.5
    }
    if (includeComponents.demographics) {
      size += 2
    }
    return Math.max(size, 1)
  }

  // Handle export with different formats
  const handleExport = async () => {
    setIsExporting(true)

    try {
      // Simulate export processing time
      await new Promise((resolve) => setTimeout(resolve, 1000))

      if (exportFormat === 'json') {
        onExport()
      } else if (exportFormat === 'csv') {
        // Handle CSV export
        exportAsCSV()
      } else if (exportFormat === 'pdf') {
        // Handle PDF export
        exportAsPDF()
      }
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  // Export as CSV
  const exportAsCSV = () => {
    const csvData = []

    // Headers
    const headers = ['Metric', 'Value', 'Category']
    csvData.push(headers.join(','))

    // Analysis data
    if (includeComponents.analysis) {
      csvData.push(
        `Overall Bias Score,${analysisResults.overallBiasScore},Analysis`,
      )
      csvData.push(`Alert Level,${analysisResults.alertLevel},Analysis`)
      csvData.push(`Confidence,${analysisResults.confidence},Analysis`)

      // Layer results
      csvData.push(
        `Gender Bias,${analysisResults.layerResults.preprocessing.linguisticBias.genderBiasScore},Preprocessing`,
      )
      csvData.push(
        `Racial Bias,${analysisResults.layerResults.preprocessing.linguisticBias.racialBiasScore},Preprocessing`,
      )
      csvData.push(
        `Age Bias,${analysisResults.layerResults.preprocessing.linguisticBias.ageBiasScore},Preprocessing`,
      )
      csvData.push(
        `Cultural Bias,${analysisResults.layerResults.preprocessing.linguisticBias.culturalBiasScore},Preprocessing`,
      )
    }

    // Counterfactual data
    if (includeComponents.counterfactual) {
      counterfactualScenarios.forEach((scenario, index) => {
        csvData.push(
          `Counterfactual ${index + 1},${scenario.expectedBiasReduction},Counterfactual`,
        )
        csvData.push(
          `Likelihood ${index + 1},${scenario.likelihood},Counterfactual`,
        )
      })
    }

    // Historical data
    if (includeComponents.historical && historicalComparison) {
      csvData.push(
        `30-Day Average,${historicalComparison.thirtyDayAverage},Historical`,
      )
      csvData.push(
        `Percentile Rank,${historicalComparison.percentileRank},Historical`,
      )
      csvData.push(
        `7-Day Trend,${historicalComparison.sevenDayTrend},Historical`,
      )
    }

    // Create and download CSV
    const csvContent = csvData.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bias-analysis-${analysisResults.sessionId}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Export as PDF (simplified - would need proper PDF library in real implementation)
  const exportAsPDF = () => {
    // This would typically use a library like jsPDF
    // For now, we'll create a formatted text version
    const pdfContent = generatePDFContent()
    const blob = new Blob([pdfContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bias-analysis-report-${analysisResults.sessionId}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Generate PDF content
  const generatePDFContent = () => {
    let content = `BIAS DETECTION ANALYSIS REPORT\n`
    content += `Session ID: ${analysisResults.sessionId}\n`
    content += `Generated: ${new Date().toLocaleString()}\n`
    content += `\n${'='.repeat(50)}\n\n`

    if (includeComponents.analysis) {
      content += `ANALYSIS RESULTS\n`
      content += `Overall Bias Score: ${(analysisResults.overallBiasScore * 100).toFixed(1)}%\n`
      content += `Alert Level: ${analysisResults.alertLevel.toUpperCase()}\n`
      content += `Confidence: ${(analysisResults.confidence * 100).toFixed(1)}%\n\n`

      content += `LAYER ANALYSIS\n`
      content += `Gender Bias: ${(analysisResults.layerResults.preprocessing.linguisticBias.genderBiasScore * 100).toFixed(1)}%\n`
      content += `Racial Bias: ${(analysisResults.layerResults.preprocessing.linguisticBias.racialBiasScore * 100).toFixed(1)}%\n`
      content += `Age Bias: ${(analysisResults.layerResults.preprocessing.linguisticBias.ageBiasScore * 100).toFixed(1)}%\n`
      content += `Cultural Bias: ${(analysisResults.layerResults.preprocessing.linguisticBias.culturalBiasScore * 100).toFixed(1)}%\n\n`
    }

    if (includeComponents.recommendations) {
      content += `RECOMMENDATIONS\n`
      analysisResults.recommendations.forEach((rec, index) => {
        content += `${index + 1}. ${rec}\n`
      })
      content += `\n`
    }

    if (includeComponents.counterfactual) {
      content += `COUNTERFACTUAL SCENARIOS\n`
      counterfactualScenarios.forEach((scenario, index) => {
        content += `${index + 1}. ${scenario.change}\n`
        content += `   Expected Reduction: ${(scenario.expectedBiasReduction * 100).toFixed(1)}%\n`
        content += `   Likelihood: ${scenario.likelihood}\n\n`
      })
    }

    if (includeComponents.historical && historicalComparison) {
      content += `HISTORICAL COMPARISON\n`
      content += `30-Day Average: ${(historicalComparison.thirtyDayAverage * 100).toFixed(1)}%\n`
      content += `Percentile Rank: ${historicalComparison.percentileRank}th\n`
      content += `7-Day Trend: ${historicalComparison.sevenDayTrend}\n\n`
    }

    return content
  }

  return (
    <div className="export-controls space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Export Analysis Data
        </h3>
        <p className="text-gray-600">
          Download comprehensive bias analysis results for reporting and
          compliance
        </p>
      </div>

      {/* Export Format Selection */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Export Format</h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* JSON Format */}
          <div
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              exportFormat === 'json'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setExportFormat('json')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setExportFormat('json');
              }
            }}
            tabIndex={0}
            role="radio"
            aria-checked={exportFormat === 'json'}
            aria-label="JSON export format"
          >
            <div className="flex items-center mb-2">
              <input
                type="radio"
                checked={exportFormat === 'json'}
                onChange={() => setExportFormat('json')}
                className="mr-2"
              />
              <span className="font-medium text-gray-900">JSON</span>
            </div>
            <p className="text-sm text-gray-600">
              Complete structured data with all analysis details
            </p>
            <div className="mt-2 text-xs text-gray-500">
              Best for: Technical analysis, data processing
            </div>
          </div>

          {/* CSV Format */}
          <div
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              exportFormat === 'csv'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setExportFormat('csv')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setExportFormat('csv');
              }
            }}
            tabIndex={0}
            role="radio"
            aria-checked={exportFormat === 'csv'}
            aria-label="CSV export format"
          >
            <div className="flex items-center mb-2">
              <input
                type="radio"
                checked={exportFormat === 'csv'}
                onChange={() => setExportFormat('csv')}
                className="mr-2"
              />
              <span className="font-medium text-gray-900">CSV</span>
            </div>
            <p className="text-sm text-gray-600">
              Tabular data format for spreadsheet analysis
            </p>
            <div className="mt-2 text-xs text-gray-500">
              Best for: Excel analysis, statistical processing
            </div>
          </div>

          {/* PDF Format */}
          <div
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              exportFormat === 'pdf'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setExportFormat('pdf')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setExportFormat('pdf');
              }
            }}
            tabIndex={0}
            role="radio"
            aria-checked={exportFormat === 'pdf'}
            aria-label="PDF export format"
          >
            <div className="flex items-center mb-2">
              <input
                id="pdf-format"
                type="radio"
                checked={exportFormat === 'pdf'}
                onChange={() => setExportFormat('pdf')}
                className="mr-2"
              />
              <label htmlFor="pdf-format" className="font-medium text-gray-900">PDF Report</label>
            </div>
            <p className="text-sm text-gray-600">
              Formatted report for documentation and sharing
            </p>
            <div className="mt-2 text-xs text-gray-500">
              Best for: Reports, compliance documentation
            </div>
          </div>
        </div>
      </div>

      {/* Component Selection */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Include Components</h4>

        <div className="space-y-3">
          {/* Analysis Results */}
          <div className="flex items-center">
            <input
              id="include-analysis"
              type="checkbox"
              checked={includeComponents.analysis}
              onChange={(e) =>
                setIncludeComponents((prev) => ({
                  ...prev,
                  analysis: e.target.checked,
                }))
              }
              className="mr-3"
              aria-label="Include analysis results"
            />
            <label htmlFor="include-analysis" className="flex-1">
              <span className="font-medium text-gray-900">
                Analysis Results
              </span>
              <p className="text-sm text-gray-600">
                Overall bias scores, layer analysis, and confidence metrics
              </p>
            </label>
          </div>

          {/* Counterfactual Scenarios */}
          <div className="flex items-center">
            <input
              id="include-counterfactual"
              type="checkbox"
              checked={includeComponents.counterfactual}
              onChange={(e) =>
                setIncludeComponents((prev) => ({
                  ...prev,
                  counterfactual: e.target.checked,
                }))
              }
              className="mr-3"
              aria-label="Include counterfactual scenarios"
            />
            <label htmlFor="include-counterfactual" className="flex-1">
              <span className="font-medium text-gray-900">
                Counterfactual Scenarios
              </span>
              <p className="text-sm text-gray-600">
                Alternative scenarios and expected bias reduction estimates
              </p>
            </label>
          </div>

          {/* Historical Comparison */}
          <div className="flex items-center">
            <input
              id="include-historical"
              type="checkbox"
              checked={includeComponents.historical}
              onChange={(e) =>
                setIncludeComponents((prev) => ({
                  ...prev,
                  historical: e.target.checked,
                }))
              }
              disabled={!historicalComparison}
              className="mr-3"
              aria-label="Include historical comparison"
            />
            <label htmlFor="include-historical" className="flex-1">
              <span
                className={`font-medium ${historicalComparison ? 'text-gray-900' : 'text-gray-400'}`}
              >
                Historical Comparison
              </span>
              <p
                className={`text-sm ${historicalComparison ? 'text-gray-600' : 'text-gray-400'}`}
              >
                Progress tracking and trend analysis data
              </p>
            </label>
          </div>

          {/* Recommendations */}
          <div className="flex items-center">
            <input
              id="include-recommendations"
              type="checkbox"
              checked={includeComponents.recommendations}
              onChange={(e) =>
                setIncludeComponents((prev) => ({
                  ...prev,
                  recommendations: e.target.checked,
                }))
              }
              className="mr-3"
              aria-label="Include recommendations"
            />
            <label htmlFor="include-recommendations" className="flex-1">
              <span className="font-medium text-gray-900">Recommendations</span>
              <p className="text-sm text-gray-600">
                AI-generated suggestions for bias reduction
              </p>
            </label>
          </div>

          {/* Demographics */}
          <div className="flex items-center">
            <input
              id="include-demographics"
              type="checkbox"
              checked={includeComponents.demographics}
              onChange={(e) =>
                setIncludeComponents((prev) => ({
                  ...prev,
                  demographics: e.target.checked,
                }))
              }
              className="mr-3"
              aria-label="Include demographics context"
            />
            <label htmlFor="include-demographics" className="flex-1">
              <span className="font-medium text-gray-900">
                Demographics Context
              </span>
              <p className="text-sm text-gray-600">
                Client demographic information for context
              </p>
            </label>
          </div>
        </div>
      </div>

      {/* Export Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="font-medium text-gray-900">Export Summary</div>
            <div className="text-sm text-gray-600">
              Format: {exportFormat.toUpperCase()} • Size: ~
              {getExportSizeEstimate().toFixed(1)} KB • Components:{' '}
              {Object.values(includeComponents).filter(Boolean).length}/5
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={
              isExporting || Object.values(includeComponents).every((v) => !v)
            }
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Exporting...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-2"
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
                Export Data
              </>
            )}
          </button>
        </div>
      </div>

      {/* Export Guidelines */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h5 className="font-medium text-blue-900 mb-2">Export Guidelines</h5>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Exported data contains sensitive analysis information</li>
          <li>
            • Ensure compliance with your organization&apos;s data handling
            policies
          </li>
          <li>
            • Consider removing demographic information for anonymized reports
          </li>
          <li>• JSON format preserves all data relationships and metadata</li>
          <li>• CSV format is optimized for statistical analysis tools</li>
          <li>• PDF reports are suitable for documentation and sharing</li>
        </ul>
      </div>
    </div>
  )
}

export default ExportControls
