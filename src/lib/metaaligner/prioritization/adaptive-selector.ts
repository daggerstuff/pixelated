/**
 * Adaptive Objective Selector
 * Bridges context detection with objective weighting to select objectives dynamically
 */

import type { AIService } from '../../ai/models/types'
import {
  CORE_MENTAL_HEALTH_OBJECTIVES,
  type AlignmentContext,
  type ObjectiveDefinition,
  ContextType,
  getDefaultObjectiveWeights,
} from '../core/objectives'
import {
  ObjectiveWeightingEngine,
  DEFAULT_WEIGHT_ADJUSTMENT_PARAMS,
  type WeightCalculationResult,
} from '../core/objective-weighting'
import {
  ContextDetector,
  type ContextDetectionResult,
  type ContextDetectorConfig,
} from './context-detector'

export interface AdaptiveSelectorConfig {
  aiService: AIService
  contextDetectorConfig?: Partial<ContextDetectorConfig>
}

export interface SelectedObjective {
  objective: ObjectiveDefinition
  weight: number
}

export interface SelectionResult {
  contextDetectionResult: ContextDetectionResult
  alignmentContext: AlignmentContext
  selectedObjectives: SelectedObjective[]
  weightCalculationResult: WeightCalculationResult
}

export class AdaptiveSelector {
  private aiService: AIService
  private contextDetector: ContextDetector
  private weightingEngine: ObjectiveWeightingEngine
  private lastDetectedContext: ContextType | null = null

  constructor(config: AdaptiveSelectorConfig) {
    this.aiService = config.aiService
    this.contextDetector = new ContextDetector({
      aiService: this.aiService,
      enableCrisisIntegration:
        config.contextDetectorConfig?.enableCrisisIntegration ?? true,
      enableEducationalRecognition:
        config.contextDetectorConfig?.enableEducationalRecognition ?? true,
      model: config.contextDetectorConfig?.model ?? 'gpt-4',
      crisisDetectionService:
        config.contextDetectorConfig?.crisisDetectionService,
      educationalContextRecognizer:
        config.contextDetectorConfig?.educationalContextRecognizer,
    })

    // Use current global/default params (tests may mutate DEFAULT_WEIGHT_ADJUSTMENT_PARAMS.strategy)
    this.weightingEngine = new ObjectiveWeightingEngine(
      DEFAULT_WEIGHT_ADJUSTMENT_PARAMS,
    )
  }

  async selectObjectives(
    userInput: string,
    conversationHistory: string[] = [],
    userId?: string,
    userProfile?: AlignmentContext['userProfile'],
  ): Promise<SelectionResult> {
    // Detect context with defensive fallback
    let detection: ContextDetectionResult
    try {
      detection = await this.contextDetector.detectContext(
        userInput,
        conversationHistory,
        userId,
      )
    } catch (err) {
      // Clinical Decision Support Safeguard: When detection fails, we cannot determine
      // if this is a crisis situation. Flag for human review rather than auto-defaulting to safe.
      detection = {
        detectedContext: ContextType.GENERAL,
        confidence: 0.1,
        contextualIndicators: [
          { type: 'error_fallback', description: 'Context detection failed, flagged for review', confidence: 0.1 },
        ],
        needsSpecialHandling: true, // Flag for human review - could be a crisis
        urgency: 'high', // Default to high urgency to force human review when detection fails
        metadata: {
          error: err instanceof Error ? err.message : 'Unknown error',
          requiresHumanReview: true, // Explicit flag for clinical decision support
          errorFallback: true,
          detectedContext: 'unknown', // Explicitly mark as unknown
          confidence: 0.1,
        },
      }
    }

    // Track transitions (used in tests)
    if (this.lastDetectedContext && this.lastDetectedContext !== detection.detectedContext) {
      detection.metadata = detection.metadata || {}
      ;(detection.metadata as Record<string, unknown>)['transition'] = {
        from: this.lastDetectedContext,
        to: detection.detectedContext,
      }
    }
    this.lastDetectedContext = detection.detectedContext

    const alignmentContext: AlignmentContext = {
      userQuery: userInput,
      conversationHistory,
      detectedContext: detection.detectedContext,
      userProfile,
    }

    // Default objective config and weights
    const defaults = getDefaultObjectiveWeights()

    let selectedObjectives: SelectedObjective[]
    let weightCalculationResult: WeightCalculationResult

    // If detection failed (marked with metadata.error), use exact default weights without recalculation
    const hasDetectionError = 'error' in detection.metadata && detection.metadata.error !== undefined
    if (hasDetectionError) {
      selectedObjectives = CORE_MENTAL_HEALTH_OBJECTIVES.map((objective) => ({
        objective,
        weight: defaults[objective.id] ?? 0,
      }))
      weightCalculationResult = {
        weights: { ...defaults },
        details: {
          strategy: 'default-fallback',
          reason: 'Context detection failed - using default weights with human review flag',
        },
      } as WeightCalculationResult
    } else {
      const objectiveConfig = {
        objectives: defaults,
        contextualWeights: {},
        globalSettings: {
          enableDynamicWeighting: true,
          enableContextualAdjustment: true,
          minObjectiveScore: 0,
          maxObjectiveScore: 1,
          normalizationMethod: 0,
          aggregationMethod: 0,
        },
      }
      weightCalculationResult = this.weightingEngine.calculateWeights(
        CORE_MENTAL_HEALTH_OBJECTIVES,
        alignmentContext,
        objectiveConfig,
      )
      selectedObjectives = CORE_MENTAL_HEALTH_OBJECTIVES.map((objective) => ({
        objective,
        weight: weightCalculationResult.weights[objective.id] ?? 0,
      }))
    }

    return {
      contextDetectionResult: detection,
      alignmentContext,
      selectedObjectives,
      weightCalculationResult,
    }
  }
}
