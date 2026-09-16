/**
 * @module unified-pipeline
 * @description Concrete {@link IUnifiedMetaAlignerAPI} implementation that
 * wires the MetaAligner pipeline stages (query preprocessing, context
 * injection, objective injection, enhancement, error handling) together with
 * the evaluation/enhancement engine in `alignment-api.ts`.
 */

import { QueryPreprocessor } from '../query-preparation/query-preprocessor'
import { ContextInjector } from '../context/context-injector'
import { ObjectiveInjector } from '../objectives/objective-injector'
import { ErrorHandler } from '../error-handling/error-handler'
import {
  MetaAlignerError,
  ProcessingError,
  ValidationError,
  EnhancementError,
} from '../error-handling/error-handler'
import { MetaAlignerAPI } from './alignment-api'
import type { AlignmentContext, ContextType } from '../core/objectives'
import type {
  IUnifiedMetaAlignerAPI,
  UnifiedProcessingRequest,
  UnifiedProcessingResponse,
  UnifiedContext,
} from './unified-api'

export interface UnifiedPipelineConfig {
  /** Skip enhancement when evaluation meets the threshold */
  enhancementThreshold?: number
  /** Limit conversation history forwarded to the alignment engine */
  maxHistoryLength?: number
}

const DEFAULT_MAX_HISTORY = 20

export class UnifiedMetaAlignerPipeline implements IUnifiedMetaAlignerAPI {
  private readonly preprocessor = new QueryPreprocessor()
  private readonly contextInjector = new ContextInjector()
  private readonly objectiveInjector = new ObjectiveInjector()
  private readonly errorHandler = new ErrorHandler()
  private readonly metaAligner: MetaAlignerAPI
  private readonly config: Required<UnifiedPipelineConfig>

  constructor(
    config: UnifiedPipelineConfig = {},
    metaAligner?: MetaAlignerAPI,
  ) {
    this.config = {
      enhancementThreshold: config.enhancementThreshold ?? 0.7,
      maxHistoryLength: config.maxHistoryLength ?? DEFAULT_MAX_HISTORY,
    }
    this.metaAligner =
      metaAligner ??
      new MetaAlignerAPI({
        enableResponseEnhancement: true,
        enhancementThreshold: this.config.enhancementThreshold,
      })
  }

  async process(
    request: UnifiedProcessingRequest,
  ): Promise<UnifiedProcessingResponse> {
    try {
      if (!request || typeof request !== 'object') {
        throw new ValidationError('Request must be an object')
      }
      if (typeof request.context?.userQuery !== 'string') {
        throw new ValidationError('Request context.userQuery must be a string')
      }

      const prepared = await this.preprocessor.preprocess(request)
      const withContext = await this.contextInjector.inject(prepared)
      const withObjectives = await this.objectiveInjector.inject(withContext)

      return await this.evaluateAndEnhance(withObjectives)
    } catch (error: unknown) {
      const normalized =
        error instanceof MetaAlignerError ? error : new ProcessingError(
          error instanceof Error ? error.message : 'Unknown processing error',
        )
      return this.errorHandler.handle(normalized)
    }
  }

  private async evaluateAndEnhance(
    request: UnifiedProcessingRequest,
  ): Promise<UnifiedProcessingResponse> {
    const content =
      typeof request.llmOutput.content === 'string'
        ? request.llmOutput.content
        : JSON.stringify(request.llmOutput.content)
    const context = this.toAlignmentContext(request.context)
    const truncatedHistory = (request.context.conversationHistory ?? []).slice(
      -this.config.maxHistoryLength,
    )
    const historyContext: AlignmentContext = {
      ...context,
      conversationHistory: truncatedHistory,
    }

    const evaluation = await this.metaAligner.evaluateResponse({
      response: content,
      context: historyContext,
    })

    let finalResponse = content
    let enhanced = false
    let enhancementAttempts = 0
    let currentEvaluation = evaluation

    if (
      evaluation.needsEnhancement &&
      evaluation.evaluation.overallScore < this.config.enhancementThreshold
    ) {
      const maxAttempts = this.metaAligner['config'].maxEnhancementAttempts ?? 2

      while (
        enhancementAttempts < maxAttempts &&
        currentEvaluation.needsEnhancement
      ) {
        enhancementAttempts++

        try {
          const enhancement = await this.metaAligner.enhanceResponse({
            originalResponse: finalResponse,
            evaluationResult: currentEvaluation.evaluation,
            context: historyContext,
          })

          if (enhancement.enhancementApplied) {
            finalResponse = enhancement.enhancedResponse
            enhanced = true

            const reEvaluation = await this.metaAligner.evaluateResponse({
              response: finalResponse,
              context: historyContext,
            })
            currentEvaluation = reEvaluation
            if (!reEvaluation.needsEnhancement) {
              break
            }
          } else {
            break
          }
        } catch (error: unknown) {
          throw new EnhancementError(
            error instanceof Error
              ? error.message
              : 'Enhancement attempt failed',
          )
        }
      }
    }

    return {
      enhancedResponse: finalResponse,
      originalResponse: content,
      alignment: {
        evaluation: currentEvaluation.evaluation,
        metrics: currentEvaluation.metrics,
        enhanced,
        enhancementAttempts,
      },
    }
  }

  private toAlignmentContext(context: UnifiedContext): AlignmentContext {
    const detected =
      context.detectedContext ?? ContextType.GENERAL
    return {
      ...context,
      detectedContext: detected as ContextType,
    }
  }
}

export const unifiedMetaAlignerPipeline = new UnifiedMetaAlignerPipeline()
