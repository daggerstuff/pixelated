/**
 * Response Enhancement Pipeline
 * Post-processes LLM responses to improve alignment with mental health objectives
 */

import {
  AlignmentContext,
  AlignmentEvaluationResult,
  AlignmentMetrics,
  ObjectiveDefinition,
} from '../core/objectives'
import { MetaAlignerAPI } from '../api/alignment-api'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('enhancement-pipeline')

export interface EnhancementPipelineConfig {
  enableBatchProcessing?: boolean
  enableStreaming?: boolean
  maxRetries?: number
  retryDelayMs?: number
  objectiveIds?: string[]
  enhancementThreshold?: number
}

export interface PipelineInput {
  response: string
  context: AlignmentContext
  objectives?: ObjectiveDefinition[]
}

export interface PipelineOutput {
  enhancedResponse: string
  originalResponse: string
  improvements: AlignmentImprovement[]
  metrics: {
    original: AlignmentMetrics
    enhanced: AlignmentMetrics
  }
  processingInfo: {
    attempts: number
    durationMs: number
    enhanced: boolean
  }
}

export interface AlignmentImprovement {
  objectiveId: string
  objectiveName: string
  scoreImprovement: number
  explanation: string
}

/**
 * Response Enhancement Pipeline
 * Enhances LLM responses to better align with mental health objectives
 */
export class EnhancementPipeline {
  private config: EnhancementPipelineConfig
  private metaAligner: MetaAlignerAPI

  constructor(
    config: EnhancementPipelineConfig = {},
    metaAligner?: MetaAlignerAPI,
  ) {
    this.config = {
      enableBatchProcessing: false,
      enableStreaming: false,
      maxRetries: 2,
      retryDelayMs: 1000,
      enhancementThreshold: 0.7,
      ...config,
    }

    // Use provided MetaAlignerAPI or create a new one
    this.metaAligner =
      metaAligner ||
      new MetaAlignerAPI({
        enableResponseEnhancement: true,
        enhancementThreshold: this.config.enhancementThreshold,
        maxEnhancementAttempts: this.config.maxRetries,
      })

    logger.info('EnhancementPipeline initialized', {
      config: this.config,
      action: 'initialize',
    })
  }

  /**
   * Process a single response through the enhancement pipeline
   */
  async process(input: PipelineInput): Promise<PipelineOutput> {
    const startTime = Date.now()
    const { response, context, objectives } = input

    logger.info('Starting enhancement pipeline', {
      responseLength: response.length,
      contextType: context.detectedContext,
      action: 'process_start',
    })

    try {
      // Initial evaluation
      const initialEvaluation = await this.metaAligner.evaluateResponse({
        response,
        context,
        objectives,
      })

      // Check if enhancement is needed
      const needsEnhancement =
        initialEvaluation.overallScore <
        (this.config.enhancementThreshold || 0.7)

      if (!needsEnhancement) {
        logger.info('Response quality sufficient, skipping enhancement', {
          score: initialEvaluation.overallScore,
          threshold: this.config.enhancementThreshold,
          action: 'skip_enhancement',
        })

        return {
          enhancedResponse: response,
          originalResponse: response,
          improvements: [],
          metrics: {
            original: initialEvaluation.metrics,
            enhanced: initialEvaluation.metrics,
          },
          processingInfo: {
            attempts: 0,
            durationMs: Date.now() - startTime,
            enhanced: false,
          },
        }
      }

      // Apply enhancements
      const enhancementResult = await this.applyEnhancements(
        response,
        initialEvaluation.evaluation,
        context,
        objectives,
      )

      // Final evaluation of enhanced response
      const finalEvaluation = await this.metaAligner.evaluateResponse({
        response: enhancementResult.enhancedResponse,
        context,
        objectives,
      })

      // Calculate improvements
      const improvements = this.calculateImprovements(
        initialEvaluation.evaluation,
        finalEvaluation.evaluation,
      )

      logger.info('Enhancement pipeline completed', {
        originalScore: initialEvaluation.overallScore.toFixed(3),
        enhancedScore: finalEvaluation.overallScore.toFixed(3),
        improvement: (
          finalEvaluation.overallScore - initialEvaluation.overallScore
        ).toFixed(3),
        durationMs: Date.now() - startTime,
        action: 'process_complete',
      })

      return {
        enhancedResponse: enhancementResult.enhancedResponse,
        originalResponse: response,
        improvements,
        metrics: {
          original: initialEvaluation.metrics,
          enhanced: finalEvaluation.metrics,
        },
        processingInfo: {
          attempts: enhancementResult.attempts,
          durationMs: Date.now() - startTime,
          enhanced: enhancementResult.enhanced,
        },
      }
    } catch (error) {
      logger.error('Enhancement pipeline failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'process_error',
      })

      throw error
    }
  }

  /**
   * Process multiple responses through the enhancement pipeline
   */
  async processBatch(inputs: PipelineInput[]): Promise<PipelineOutput[]> {
    if (!this.config.enableBatchProcessing) {
      logger.warn('Batch processing not enabled, processing sequentially', {
        action: 'batch_warning',
      })
    }

    logger.info('Processing batch of responses', {
      count: inputs.length,
      action: 'batch_start',
    })

    const results: PipelineOutput[] = []

    for (const input of inputs) {
      try {
        const result = await this.process(input)
        results.push(result)
      } catch (error) {
        logger.error('Batch item processing failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          action: 'batch_item_error',
        })

        // Re-throw to maintain error behavior
        throw error
      }
    }

    logger.info('Batch processing completed', {
      processed: results.length,
      action: 'batch_complete',
    })

    return results
  }

  /**
   * Apply iterative enhancements to a response
   */
  private async applyEnhancements(
    originalResponse: string,
    evaluation: AlignmentEvaluationResult,
    context: AlignmentContext,
    objectives?: ObjectiveDefinition[],
  ): Promise<{
    enhancedResponse: string
    attempts: number
    enhanced: boolean
  }> {
    let currentResponse = originalResponse
    let currentEvaluation = evaluation
    let attempts = 0
    const maxAttempts = this.config.maxRetries || 2
    let enhanced = false

    logger.info('Applying enhancements', {
      maxAttempts,
      action: 'apply_enhancements_start',
    })

    while (attempts < maxAttempts) {
      attempts++

      try {
        const enhancement = await this.metaAligner.enhanceResponse({
          originalResponse: currentResponse,
          evaluationResult: currentEvaluation,
          context,
          targetObjectives: this.config.objectiveIds,
        })

        if (enhancement.enhancementApplied) {
          enhanced = true
          currentResponse = enhancement.enhancedResponse

          // Re-evaluate to determine if another iteration is needed
          const reEvaluation = await this.metaAligner.evaluateResponse({
            response: currentResponse,
            context,
            objectives,
          })

          currentEvaluation = reEvaluation.evaluation

          const stillNeedsEnhancement =
            currentEvaluation.overallScore <
            (this.config.enhancementThreshold || 0.7)

          if (!stillNeedsEnhancement) {
            break
          }
        } else {
          // No improvement applied, stop iterations
          break
        }
      } catch (error) {
        logger.warn('Enhancement attempt failed', {
          attempt: attempts,
          error: error instanceof Error ? error.message : 'Unknown error',
          action: 'enhancement_attempt_failed',
        })

        // Delay before retry if not the last attempt
        if (attempts < maxAttempts && this.config.retryDelayMs) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelayMs),
          )
        }
      }
    }

    logger.info('Enhancement iterations completed', {
      attempts,
      enhanced,
      action: 'apply_enhancements_complete',
    })

    return {
      enhancedResponse: currentResponse,
      attempts,
      enhanced,
    }
  }

  /**
   * Calculate improvements between two evaluations
   */
  private calculateImprovements(
    original: AlignmentEvaluationResult,
    enhanced: AlignmentEvaluationResult,
  ): AlignmentImprovement[] {
    const improvements: AlignmentImprovement[] = []

    // Compare overall score

    // Compare individual objective scores
    for (const [objectiveId, enhancedResult] of Object.entries(
      enhanced.objectiveResults,
    )) {
      const originalResult = original.objectiveResults[objectiveId]

      if (originalResult) {
        const scoreImprovement = enhancedResult.score - originalResult.score

        // Only include improvements (positive changes)
        if (scoreImprovement > 0.001) {
          // Small epsilon to account for floating point precision
          improvements.push({
            objectiveId,
            objectiveName: objectiveId, // Would ideally come from objective definition
            scoreImprovement,
            explanation: `Score improved from ${originalResult.score.toFixed(3)} to ${enhancedResult.score.toFixed(3)}`,
          })
        }
      }
    }

    return improvements
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    logger.info('Disposing enhancement pipeline', {
      action: 'dispose',
    })
  }
}
