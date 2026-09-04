/**
 * Demographic disparity detection for the bias alert system.
 * Extracted from alerts-system.ts.
 */

import { getBiasDetectionLogger } from '../../logging/standardized-logger'
import type { BiasAnalysisResult } from './types'

const logger = getBiasDetectionLogger('alerts-system')

type ProblematicScenario = any
type FeatureImportanceResult = any
type InterventionEffectiveness = any

export function detectDemographicDisparity(result: BiasAnalysisResult): boolean {
  try {
    // Configuration for disparity detection
    const MIN_OVERALL_BIAS_FOR_BASIC_CHECK = 0.6 // Original threshold for fallback
    const LAYER_DISPARITY_THRESHOLD = 0.25 // Threshold for layer-specific disparities
    const HIGH_INDIVIDUAL_BIAS_THRESHOLD = 0.7 // Threshold for individual layer bias scores

    // Check if we have demographic data to analyze
    if (!result.demographics || !result.layerResults) {
      // Fallback to original overall bias score check if no demographic data
      return result.overallBiasScore > MIN_OVERALL_BIAS_FOR_BASIC_CHECK
    }

    // 1. Check for overall bias score disparity indicator
    const hasElevatedOverallBias =
      result.overallBiasScore > MIN_OVERALL_BIAS_FOR_BASIC_CHECK

    // 2. Analyze layer-specific bias scores for demographic concerns
    const layerBiasScores = [
      result.layerResults.preprocessing?.biasScore ?? 0,
      result.layerResults.modelLevel?.biasScore ?? 0,
      result.layerResults.interactive?.biasScore ?? 0,
      result.layerResults.evaluation?.biasScore ?? 0,
    ]

    // Check for high individual layer bias scores
    const hasHighLayerBias = layerBiasScores.some(
      (score) => score > HIGH_INDIVIDUAL_BIAS_THRESHOLD,
    )

    // Calculate layer bias score disparity
    const maxLayerBias = Math.max(...layerBiasScores)
    const minLayerBias = Math.min(...layerBiasScores)
    const layerDisparity = maxLayerBias - minLayerBias
    const hasSignificantLayerDisparity =
      layerDisparity > LAYER_DISPARITY_THRESHOLD

    // 3. Analyze demographic-specific patterns in layer results
    const demographicDisparityIndicators =
      analyzeDemographicLayerDisparities(result)

    // 4. Check for demographic fairness metric disparities
    const fairnessDisparityIndicators =
      analyzeFairnessMetricDisparities(result)

    // 5. Analyze counterfactual and feature importance disparities
    const counterfactualDisparityIndicators =
      analyzeCounterfactualDisparities(result)

    // Combine all disparity indicators
    const disparityIndicators = [
      hasElevatedOverallBias,
      hasHighLayerBias,
      hasSignificantLayerDisparity,
      ...demographicDisparityIndicators,
      ...fairnessDisparityIndicators,
      ...counterfactualDisparityIndicators,
    ]

    // Count positive indicators
    const positiveIndicators = disparityIndicators.filter(
      (indicator) => indicator,
    ).length
    const totalIndicators = disparityIndicators.length

    // Trigger alert if:
    // - Multiple disparity indicators are present (>= 30% of total indicators)
    // - OR any high-severity individual indicator is present
    const INDICATOR_THRESHOLD_PERCENTAGE = 0.3
    const multipleIndicatorsDetected =
      positiveIndicators >=
      Math.ceil(totalIndicators * INDICATOR_THRESHOLD_PERCENTAGE)

    const shouldAlert =
      multipleIndicatorsDetected || hasElevatedOverallBias || hasHighLayerBias

    if (shouldAlert) {
      logger.info('Demographic disparity detected', {
        sessionId: result.sessionId,
        overallBiasScore: result.overallBiasScore,
        layerDisparity,
        positiveIndicators,
        totalIndicators,
        demographicData: result.demographics
          ? {
              age: result.demographics.age,
              gender: result.demographics.gender,
              ethnicity: result.demographics.ethnicity,
            }
          : null,
        layerScores: {
          preprocessing: layerBiasScores[0],
          modelLevel: layerBiasScores[1],
          interactive: layerBiasScores[2],
          evaluation: layerBiasScores[3],
        },
      })
    }

    return shouldAlert
  } catch (error: unknown) {
    logger.error('Error in demographic disparity detection', {
      error: error instanceof Error ? String(error) : String(error),
      sessionId: result.sessionId,
    })

    // Fallback to original logic if disparity detection fails
    return result.overallBiasScore > 0.6
  }
}

/**
 * Analyze demographic-specific patterns in layer results
 */
function analyzeDemographicLayerDisparities(
  result: BiasAnalysisResult,
): boolean[] {
  const indicators: boolean[] = []

  try {
    // Check preprocessing layer for demographic representation issues
    if (result.layerResults.preprocessing?.representationAnalysis) {
      const repr = result.layerResults.preprocessing.representationAnalysis
      // Check for underrepresented groups
      const hasUnderrepresentedGroups =
        repr.underrepresentedGroups?.length > 0
      // Check for low diversity index
      const hasLowDiversity = repr.diversityIndex < 0.3
      indicators.push(hasUnderrepresentedGroups, hasLowDiversity)
    }

    // Check model level for fairness metric disparities
    if (result.layerResults.modelLevel?.fairnessMetrics) {
      const fairness = result.layerResults.modelLevel.fairnessMetrics
      // Check for demographic parity issues
      const hasDemographicParityIssue = fairness.demographicParity < 0.6
      // Check for equalized odds issues
      const hasEqualizedOddsIssue = fairness.equalizedOdds < 0.6
      indicators.push(hasDemographicParityIssue, hasEqualizedOddsIssue)
    }

    // Check interactive layer for engagement pattern disparities
    if (
      result.layerResults.interactive?.counterfactualAnalysis
        ?.problematicScenarios
    ) {
      const scenarios =
        result.layerResults.interactive.counterfactualAnalysis
          .problematicScenarios
      // Check for age-related disparities
      const hasAgeDisparity = scenarios.some(
        (scenario: ProblematicScenario) =>
          scenario.biasType === 'age_bias' && scenario.severity === 'medium',
      )
      // Check for gender-related disparities
      const hasGenderDisparity = scenarios.some(
        (scenario: ProblematicScenario) =>
          scenario.biasType === 'gender_bias' &&
          scenario.severity === 'medium',
      )
      indicators.push(hasAgeDisparity, hasGenderDisparity)
    }
  } catch (error: unknown) {
    logger.warn('Error analyzing demographic layer disparities', { error })
  }

  return indicators
}

/**
 * Analyze fairness metric disparities across demographics
 */
function analyzeFairnessMetricDisparities(
  result: BiasAnalysisResult,
): boolean[] {
  const indicators: boolean[] = []

  try {
    // Check evaluation layer for Hugging Face fairness metrics
    if (result.layerResults.evaluation?.huggingFaceMetrics) {
      const metrics = result.layerResults.evaluation.huggingFaceMetrics

      // Check bias metric
      const hasHighBias = metrics.bias > 0.3
      // Check stereotype metric
      const hasHighStereotype = metrics.stereotype > 0.2
      // Check regard disparity (significant difference between positive and negative)
      const regardPositive = metrics.regard
        ? metrics.regard['positive'] ?? 0
        : 0
      const regardNegative = metrics.regard
        ? metrics.regard['negative'] ?? 0
        : 0
      const regardDisparity = Math.abs(regardPositive - regardNegative)
      const hasRegardDisparity = regardDisparity > 0.4

      indicators.push(hasHighBias, hasHighStereotype, hasRegardDisparity)
    }

    // Check custom therapeutic metrics
    if (result.layerResults.evaluation?.customMetrics) {
      const custom = result.layerResults.evaluation.customMetrics

      // Check therapeutic bias
      const hasTherapeuticBias = custom.therapeuticBias > 0.2
      // Check cultural sensitivity
      const hasLowCulturalSensitivity = custom.culturalSensitivity < 0.7

      indicators.push(hasTherapeuticBias, hasLowCulturalSensitivity)
    }
  } catch (error: unknown) {
    logger.warn('Error analyzing fairness metric disparities', { error })
  }

  return indicators
}

/**
 * Analyze counterfactual analysis for demographic disparities
 */
function analyzeCounterfactualDisparities(
  result: BiasAnalysisResult,
): boolean[] {
  const indicators: boolean[] = []

  try {
    // Check interactive layer feature importance for demographic sensitivity
    if (result.layerResults.interactive?.featureImportance) {
      const features = result.layerResults.interactive.featureImportance

      features.forEach((feature: FeatureImportanceResult) => {
        // Check if demographic features have high bias contribution
        if (
          feature.feature === 'participant_age' &&
          feature.biasContribution > 0.2
        ) {
          indicators.push(true)
        }

        // Check demographic sensitivity across different groups
        if (feature.demographicSensitivity) {
          const sensitivityValues = Object.values(
            feature.demographicSensitivity,
          )
          const numericSensitivities = sensitivityValues
            .map((v) => (typeof v === 'number' ? v : Number(v)))
            .filter((n) => !Number.isNaN(n))
          const maxSensitivity =
            numericSensitivities.length > 0
              ? Math.max(...numericSensitivities)
              : 0
          const minSensitivity =
            numericSensitivities.length > 0
              ? Math.min(...numericSensitivities)
              : 0
          const sensitivityDisparity = maxSensitivity - minSensitivity

          if (sensitivityDisparity > 0.3) {
            indicators.push(true)
          }
        }
      })
    }

    // Check temporal analysis for intervention effectiveness disparities
    if (
      result.layerResults.evaluation?.temporalAnalysis
        ?.interventionEffectiveness
    ) {
      const interventions =
        result.layerResults.evaluation.temporalAnalysis
          .interventionEffectiveness

      interventions.forEach((intervention: InterventionEffectiveness) => {
        // Check if bias mitigation effectiveness is low
        if (intervention.improvement < 0.1) {
          indicators.push(true)
        }

        // Check sustainability of interventions
        if (intervention.sustainabilityScore < 0.7) {
          indicators.push(true)
        }
      })
    }
  } catch (error: unknown) {
    logger.warn('Error analyzing counterfactual disparities', { error })
  }

  return indicators
}
