// API endpoint for bias detection analysis

import {
  calculateBiasFactors,
  generateCounterfactualScenarios,
  generateHistoricalComparison,
  generateRecommendations,
  generateSessionId,
  determineAlertLevel,
} from '../../../../lib/utils/demo-helpers'
import type {
  SessionData,
  BiasAnalysisResults,
} from '../../../../lib/types/bias-detection'

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse request body
    const body = await request.json()

    // Validate required fields
    if (!body.content || !body.demographics) {
      return new Response(
        JSON.stringify({
          error:
            'Missing required fields: content and demographics are required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Create session data
    const sessionData: SessionData = {
      sessionId: body.sessionId || generateSessionId(),
      scenario: body.scenario,
      demographics: {
        age: body.demographics.age || '26-35',
        gender: body.demographics.gender || 'female',
        ethnicity: body.demographics.ethnicity || 'white',
        primaryLanguage: body.demographics.primaryLanguage || 'en',
      },
      content: body.content,
      timestamp: new Date(),
    }

    // Validate content length
    if (sessionData.content.length < 10) {
      return new Response(
        JSON.stringify({
          error: 'Content must be at least 10 characters long',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    if (sessionData.content.length > 10000) {
      return new Response(
        JSON.stringify({
          error: 'Content must be less than 10,000 characters',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Perform bias analysis
    const biasFactors = calculateBiasFactors(sessionData)
    const alertLevel = determineAlertLevel(biasFactors.overall)

    // Generate additional analysis components
    const counterfactualScenarios = generateCounterfactualScenarios(
      sessionData,
      biasFactors,
    )
    const historicalComparison = generateHistoricalComparison(
      biasFactors.overall,
    )
    const recommendations = generateRecommendations(
      biasFactors,
      sessionData.demographics,
    )

    // Create comprehensive analysis results
    const analysisResults: BiasAnalysisResults = {
      sessionId: sessionData.sessionId,
      timestamp: sessionData.timestamp,
      overallBiasScore: biasFactors.overall,
      alertLevel,
      confidence: 0.85 + Math.random() * 0.1, // Simulated confidence with some variance
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
            diversityIndex: Math.max(0, 1 - biasFactors.overall),
            underrepresentedGroups: [
              ...(biasFactors.age > 0.5 ? ['elderly'] : []),
              ...(biasFactors.racial > 0.6 ? ['racial minorities'] : []),
              ...(biasFactors.linguistic > 0.5 ? ['non-native speakers'] : []),
            ],
          },
        },
        modelLevel: {
          biasScore: biasFactors.model,
          fairnessMetrics: {
            demographicParity: Math.max(0, 1 - biasFactors.model),
            equalizedOdds: Math.max(0, 1 - biasFactors.model * 0.8),
            calibration: Math.max(0, 1 - biasFactors.model * 0.6),
          },
        },
        interactive: {
          biasScore: biasFactors.interactive,
          counterfactualAnalysis: {
            scenariosAnalyzed: counterfactualScenarios.length,
            biasDetected: biasFactors.interactive > 0.3,
            consistencyScore: Math.max(0, 1 - biasFactors.interactive),
          },
        },
        evaluation: {
          biasScore: biasFactors.evaluation,
          huggingFaceMetrics: {
            bias: biasFactors.evaluation,
            stereotype: biasFactors.cultural,
            regard: {
              positive: Math.max(0, 1 - biasFactors.overall),
              negative: biasFactors.overall,
            },
          },
        },
      },
      recommendations,
      demographics: sessionData.demographics,
    }

    // Prepare response data
    const responseData = {
      success: true,
      analysis: analysisResults,
      counterfactualScenarios,
      historicalComparison,
      processingTime: Math.round(50 + Math.random() * 200), // Simulated processing time
      metadata: {
        version: '2.0.0',
        analysisType: 'enhanced-bias-detection',
        timestamp: new Date().toISOString(),
      },
    }

    // Log analysis for monitoring (in production, this would go to proper logging)
    console.log(
      `Bias analysis completed for session ${sessionData.sessionId}:`,
      {
        overallScore: biasFactors.overall,
        alertLevel,
        contentLength: sessionData.content.length,
        demographics: sessionData.demographics,
      },
    )

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: unknown) {
    console.error('Bias analysis API error:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal server error during bias analysis',
        message:
          error instanceof Error ? String(error) : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

// GET endpoint for health check and API info
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      service: 'Bias Detection Analysis API',
      version: '2.0.0',
      status: 'operational',
      endpoints: {
        analyze: 'POST /api/demos/bias-detection/analyze',
        presets: 'GET /api/demos/bias-detection/presets',
        export: 'POST /api/demos/bias-detection/export',
      },
      capabilities: [
        'Multi-dimensional bias analysis',
        'Counterfactual scenario generation',
        'Historical progress tracking',
        'Real-time confidence scoring',
        'Comprehensive recommendations',
      ],
      limits: {
        maxContentLength: 10000,
        minContentLength: 10,
        rateLimit: '100 requests per minute',
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}
