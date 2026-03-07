import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import {
  type RecommendationRequest,
  type TreatmentForecast,
  RecommendationRequestSchema,
  TreatmentForecastSchema,
  ValidationError,
  ProcessingError,
} from './outcome-recommendation-types'

const logger = createBuildSafeLogger('outcome-recommendation')

/**
 * Generates treatment recommendations based on the provided context and desired outcomes.
 *
 * @param request - The recommendation request containing context and parameters
 * @returns Array of treatment forecasts
 * @throws {ValidationError} If the request is invalid
 * @throws {ProcessingError} If there's an error generating recommendations
 */
export function recommend(request: RecommendationRequest): TreatmentForecast[] {
  try {
    // Validate request
    try {
      RecommendationRequestSchema.parse(request)
    } catch (error: unknown) {
      throw new ValidationError('Invalid recommendation request', error)
    }

    logger.info('Generating treatment recommendations', {
      desiredOutcomes: request.desiredOutcomes,
      maxResults: request.maxResults,
      clientId: request.context.session.clientId,
      therapistId: request.context.session.therapistId,
    })

    // Generate forecasts
    const forecasts = generateForecasts(request)

    // Validate forecasts
    const validatedForecasts = forecasts.filter((forecast) => {
      try {
        TreatmentForecastSchema.parse(forecast)
        return true
      } catch (error: unknown) {
        logger.warn('Invalid forecast generated:', {
          outcomeId: forecast.outcomeId,
          error: error instanceof Error ? String(error) : 'Unknown error',
        })
        return false
      }
    })

    // Apply confidence threshold if specified
    const filteredForecasts = request.minConfidence
      ? validatedForecasts.filter(
          (f) => f.confidence >= (request.minConfidence || 0),
        )
      : validatedForecasts

    // Sort by confidence and limit results
    return filteredForecasts
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, request.maxResults)
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      throw error
    }
    logger.error('Error generating recommendations:', {
      error: error instanceof Error ? String(error) : 'Unknown error',
      desiredOutcomes: request.desiredOutcomes,
      maxResults: request.maxResults,
    })
    throw new ProcessingError('Failed to generate recommendations', error)
  }
}

/**
 * Internal helper to generate treatment forecasts.
 * This is currently a mock implementation - replace with actual ML model.
 */
function generateForecasts(
  request: RecommendationRequest,
): TreatmentForecast[] {
  const { context, desiredOutcomes } = request

  // Get base interventions based on mental health analysis
  const baseInterventions = context.mentalHealthAnalysis
    ?.recommendedApproaches || ['CBT', 'Mindfulness', 'Behavioral activation']

  // Consider recent emotion state for risk assessment
  const emotionIntensity = context.recentEmotionState.intensity
  const baseRisk: 'low' | 'moderate' | 'high' =
    emotionIntensity > 0.7
      ? 'high'
      : emotionIntensity > 0.4
        ? 'moderate'
        : 'low'

  return desiredOutcomes.map((outcome, index) => {
    // Calculate confidence based on multiple factors
    const confidenceFactors = [
      0.75, // Base confidence
      context.mentalHealthAnalysis ? 0.1 : 0, // Bonus for having analysis
      context.recentEmotionState.confidence * 0.1, // Factor in emotion confidence
      Math.random() * 0.2, // Random variation
    ]
    const confidence = Math.min(
      1,
      confidenceFactors.reduce((sum, factor) => sum + factor, 0),
    )

    // Adjust risk based on multiple factors
    const riskFactors: Array<'low' | 'moderate' | 'high'> = [
      baseRisk,
      context.mentalHealthAnalysis?.riskLevel || 'low',
      index > desiredOutcomes.length / 2 ? 'high' : 'low', // Later outcomes are riskier
    ]
    const risk = calculateRisk(riskFactors)

    // Generate forecast with detailed information
    return {
      outcomeId: `forecast-${index + 1}`,
      description: `Treatment plan for ${outcome}`,
      confidence,
      timeEstimate: `${4 + index * 2}-${8 + index * 2} weeks`,
      interventions: [
        ...baseInterventions,
        ...context.recentInterventions.slice(-2), // Include recent successful interventions
      ],
      risk,
      details: {
        expectedDuration: (4 + index * 2) * 7, // Duration in days
        successRate: Math.round(confidence * 100),
        contraindications: generateContraindications(risk),
        sideEffects: generateSideEffects(risk),
      },
      metadata: {
        generatedAt: new Date(),
        basedOn: {
          emotionState: context.recentEmotionState.currentEmotion,
          riskLevel: context.mentalHealthAnalysis?.riskLevel,
        },
      },
    }
  })
}

/**
 * Calculate overall risk level based on multiple risk factors.
 */
function calculateRisk(
  factors: Array<'low' | 'moderate' | 'high'>,
): 'low' | 'moderate' | 'high' {
  const riskScores = {
    low: 0,
    moderate: 1,
    high: 2,
  }

  const avgScore =
    factors.reduce((sum, factor) => {
      return sum + riskScores[factor]
    }, 0) / factors.length

  if (avgScore > 1.5) {
    return 'high'
  }
  if (avgScore > 0.5) {
    return 'moderate'
  }
  return 'low'
}

/**
 * Generate contraindications based on risk level.
 */
function generateContraindications(
  risk: 'low' | 'moderate' | 'high',
): string[] {
  const base = ['Acute suicidal ideation', 'Active psychosis']

  if (risk === 'high') {
    return [...base, 'Severe depression', 'Unstable environment']
  }
  if (risk === 'moderate') {
    return [...base, 'Moderate depression']
  }
  return base
}

/**
 * Generate potential side effects based on risk level.
 */
function generateSideEffects(risk: 'low' | 'moderate' | 'high'): string[] {
  const base = ['Temporary mood fluctuations', 'Initial anxiety increase']

  if (risk === 'high') {
    return [...base, 'Significant emotional distress', 'Sleep pattern changes']
  }
  if (risk === 'moderate') {
    return [...base, 'Moderate emotional distress']
  }
  return base
}
