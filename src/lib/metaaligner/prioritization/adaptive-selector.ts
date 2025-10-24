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
    const detection = await this.contextDetector.detectContext(
      userInput,
      conversationHistory,
      userId,
    )

    // Add simple transition metadata expected by tests
    if (
      this.lastDetectedContext &&
      this.lastDetectedContext !== detection.detectedContext
    ) {
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

    // Build a minimal ObjectiveConfiguration
    const objectiveWeights = getDefaultObjectiveWeights()
    const objectiveConfig = {
      objectives: objectiveWeights,
      contextualWeights: {},
      globalSettings: {
        enableDynamicWeighting: true,
        enableContextualAdjustment: true,
        minObjectiveScore: 0,
        maxObjectiveScore: 1,
        // Use numeric placeholders; engine will coerce/validate as needed
        normalizationMethod: 0,
        aggregationMethod: 0,
      },
    }

    const weightCalc = this.weightingEngine.calculateWeights(
      CORE_MENTAL_HEALTH_OBJECTIVES,
      alignmentContext,
      objectiveConfig,
    )

    // Map selected objectives
    const selectedObjectives: SelectedObjective[] =
      CORE_MENTAL_HEALTH_OBJECTIVES.map((objective) => ({
        objective,
        weight: weightCalc.weights[objective.id] ?? 0,
      }))

    return {
      contextDetectionResult: detection,
      alignmentContext,
      selectedObjectives,
      weightCalculationResult: weightCalc,
    }
  }
}
