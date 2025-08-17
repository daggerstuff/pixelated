// API endpoint for bias detection data export

import { createExportData } from '../../../../lib/utils/demo-helpers'
import type {
  BiasAnalysisResults,
  CounterfactualScenario,
  HistoricalComparison,
  ExportData,
} from '../../../../lib/types/bias-detection'

interface IncludeComponents {
  analysis: boolean
  counterfactual: boolean
  historical: boolean
  recommendations: boolean
  demographics: boolean
}

export const POST = async ({ request }) => {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.analysisResults) {
      return new Response(
        JSON.stringify({
          error: 'Missing required field: analysisResults',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const {
      analysisResults,
      counterfactualScenarios = [],
      historicalComparison = null,
      format = 'json',
      includeComponents: IncludeComponents = {
        analysis: true,
        counterfactual: true,
        historical: true,
        recommendations: true,
        demographics: true,
      },
    } = body

    // Validate format
    const supportedFormats = ['json', 'csv', 'txt']
    if (!supportedFormats.includes(format)) {
      return new Response(
        JSON.stringify({
          error: 'Unsupported export format',
          supportedFormats,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Create export data
    const exportData = createExportData(
      analysisResults as BiasAnalysisResults,
      counterfactualScenarios as CounterfactualScenario[],
      historicalComparison as HistoricalComparison | null,
    )

    // Filter components based on includeComponents
    const filteredExportData = {
      ...exportData,
      analysis: includeComponents.analysis ? exportData.analysis : undefined,
      counterfactualScenarios: includeComponents.counterfactual
        ? exportData.counterfactualScenarios
        : undefined,
      historicalComparison: includeComponents.historical
        ? exportData.historicalComparison
        : undefined,
      metadata: {
        ...exportData.metadata,
        includedComponents: Object.keys(includeComponents).filter(
          (key) => includeComponents[key as keyof typeof includeComponents],
        ),
      },
    }

    // Handle different export formats
    switch (format) {
      case 'json':
        return new Response(JSON.stringify(filteredExportData, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="bias-analysis-${analysisResults.sessionId}.json"`,
          },
        })

      case 'csv': {
        const csvData = convertToCSV(filteredExportData)
        return new Response(csvData, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="bias-analysis-${analysisResults.sessionId}.csv"`,
          },
        })
      }

      case 'txt': {
        const txtData = convertToText(filteredExportData)
        return new Response(txtData, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
            'Content-Disposition': `attachment; filename="bias-analysis-report-${analysisResults.sessionId}.txt"`,
          },
        })
      }

      default:
        return new Response(
          JSON.stringify({
            error: 'Invalid format specified',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        )
    }
  } catch (error) {
    console.error('Export API error:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error during export',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

// Helper function to convert export data to CSV format
function convertToCSV(exportData: ExportData): string {
  const csvRows = []

  // Headers
  csvRows.push('Category,Metric,Value,Details')

  // Analysis data
  if (exportData.analysis) {
    const { analysis } = exportData
    csvRows.push(
      `Analysis,Overall Bias Score,${analysis.overallBiasScore},${analysis.alertLevel}`,
    )
    csvRows.push(`Analysis,Confidence,${analysis.confidence},`)
    csvRows.push(`Analysis,Session ID,${analysis.sessionId},`)

    // Layer results
    const layers = analysis.layerResults
    csvRows.push(
      `Preprocessing,Gender Bias,${layers.preprocessing.linguisticBias.genderBiasScore},`,
    )
    csvRows.push(
      `Preprocessing,Racial Bias,${layers.preprocessing.linguisticBias.racialBiasScore},`,
    )
    csvRows.push(
      `Preprocessing,Age Bias,${layers.preprocessing.linguisticBias.ageBiasScore},`,
    )
    csvRows.push(
      `Preprocessing,Cultural Bias,${layers.preprocessing.linguisticBias.culturalBiasScore},`,
    )

    csvRows.push(
      `Model,Demographic Parity,${layers.modelLevel.fairnessMetrics.demographicParity},`,
    )
    csvRows.push(
      `Model,Equalized Odds,${layers.modelLevel.fairnessMetrics.equalizedOdds},`,
    )
    csvRows.push(
      `Model,Calibration,${layers.modelLevel.fairnessMetrics.calibration},`,
    )

    csvRows.push(
      `Interactive,Scenarios Analyzed,${layers.interactive.counterfactualAnalysis.scenariosAnalyzed},`,
    )
    csvRows.push(
      `Interactive,Bias Detected,${layers.interactive.counterfactualAnalysis.biasDetected},`,
    )
    csvRows.push(
      `Interactive,Consistency Score,${layers.interactive.counterfactualAnalysis.consistencyScore},`,
    )
  }

  // Counterfactual scenarios
  if (exportData.counterfactualScenarios) {
    const scenarios = exportData.counterfactualScenarios as Array<
      Record<string, unknown>
    >
    scenarios.forEach((scenario, index) => {
      csvRows.push(
        `Counterfactual,Scenario ${index + 1},${scenario.expectedBiasReduction},${scenario.change}`,
      )
      csvRows.push(
        `Counterfactual,Likelihood ${index + 1},${scenario.likelihood},${scenario.description}`,
      )
    })
  }

  // Historical comparison
  if (exportData.historicalComparison) {
    const historical = exportData.historicalComparison
    csvRows.push(`Historical,30-Day Average,${historical.thirtyDayAverage},`)
    csvRows.push(`Historical,Percentile Rank,${historical.percentileRank},`)
    csvRows.push(`Historical,7-Day Trend,${historical.sevenDayTrend},`)
  }

  return csvRows.join('\n')
}

// Helper function to convert export data to text format
function convertToText(exportData: ExportData): string {
  let content = `BIAS DETECTION ANALYSIS REPORT\n`
  content += `Generated: ${new Date().toLocaleString()}\n`
  content += `${'='.repeat(50)}\n\n`

  if (exportData.analysis) {
    const { analysis } = exportData
    content += `ANALYSIS RESULTS\n`
    content += `Session ID: ${analysis.sessionId}\n`
    content += `Overall Bias Score: ${(analysis.overallBiasScore * 100).toFixed(1)}%\n`
    content += `Alert Level: ${analysis.alertLevel.toUpperCase()}\n`
    content += `Confidence: ${(analysis.confidence * 100).toFixed(1)}%\n\n`

    content += `LAYER ANALYSIS\n`
    const layers = analysis.layerResults
    content += `Gender Bias: ${(layers.preprocessing.linguisticBias.genderBiasScore * 100).toFixed(1)}%\n`
    content += `Racial Bias: ${(layers.preprocessing.linguisticBias.racialBiasScore * 100).toFixed(1)}%\n`
    content += `Age Bias: ${(layers.preprocessing.linguisticBias.ageBiasScore * 100).toFixed(1)}%\n`
    content += `Cultural Bias: ${(layers.preprocessing.linguisticBias.culturalBiasScore * 100).toFixed(1)}%\n\n`

    if (analysis.recommendations && analysis.recommendations.length > 0) {
      content += `RECOMMENDATIONS\n`
      analysis.recommendations.forEach((rec: string, index: number) => {
        content += `${index + 1}. ${rec}\n`
      })
      content += `\n`
    }
  }

  if (
    exportData.counterfactualScenarios &&
    Array.isArray(exportData.counterfactualScenarios)
  ) {
    content += `COUNTERFACTUAL SCENARIOS\n`
    const scenarios = exportData.counterfactualScenarios as Array<
      Record<string, unknown>
    >
    scenarios.forEach((scenario, index) => {
      content += `${index + 1}. ${scenario.change}\n`
      content += `   Expected Reduction: ${(scenario.expectedBiasReduction * 100).toFixed(1)}%\n`
      content += `   Likelihood: ${scenario.likelihood}\n`
      content += `   Description: ${scenario.description}\n\n`
    })
  }

  if (exportData.historicalComparison) {
    const historical = exportData.historicalComparison
    content += `HISTORICAL COMPARISON\n`
    content += `30-Day Average: ${(historical.thirtyDayAverage * 100).toFixed(1)}%\n`
    content += `Percentile Rank: ${historical.percentileRank}th\n`
    content += `7-Day Trend: ${historical.sevenDayTrend}\n\n`
  }

  content += `Report generated by Pixelated Empathy Bias Detection System v${exportData.metadata.version}\n`

  return content
}

// GET endpoint for export format information
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      service: 'Bias Detection Export API',
      version: '2.0.0',
      supportedFormats: ['json', 'csv', 'txt'],
      usage: {
        endpoint: 'POST /api/demos/bias-detection/export',
        requiredFields: ['analysisResults'],
        optionalFields: [
          'counterfactualScenarios',
          'historicalComparison',
          'format',
          'includeComponents',
        ],
        examples: {
          json: { format: 'json' },
          csv: { format: 'csv' },
          text: { format: 'txt' },
        },
      },
      includeComponents: {
        analysis: 'Core bias analysis results',
        counterfactual: 'Counterfactual scenario analysis',
        historical: 'Historical progress comparison',
        recommendations: 'AI-generated recommendations',
        demographics: 'Client demographic context',
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}
