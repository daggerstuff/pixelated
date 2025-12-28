/**
 * @module unified-api
 * @description This module defines the unified API for processing LLM responses with MetaAligner enhancements.
 * It provides a standardized interface for receiving LLM outputs, processing them through the enhancement pipeline,
 * and returning a unified, enhanced response.
 */

import type {
  AlignmentEvaluationResult,
  AlignmentMetrics,
} from '../core/objective-interfaces'
import type { AlignmentContext } from '../core/objectives'

/**
 * Represents a generic output from an LLM provider.
 * This interface is designed to be a common format for outputs from various LLMs.
 */
export interface LLMOutput {
  /**
   * The main content of the LLM's response.
   * This can be a raw string or a JSON object, providing flexibility for different LLM providers.
   * @example "This is a response from the LLM."
   * @example { "key": "value" }
   */
  content: string | Record<string, unknown>

  /**
   * Optional metadata from the LLM provider.
   * This can include information like token usage, finish reason, model ID, etc.
   * @example { "tokenUsage": { "promptTokens": 10, "completionTokens": 20, "totalTokens": 30 } }
   */
  metadata?: Record<string, unknown>
}

/**
 * Represents the context for the processing request.
 * This is a simplified version of {@link AlignmentContext} for the unified API.
 * It includes the user query and conversation history.
 */
export type UnifiedContext = Omit<AlignmentContext, 'detectedContext'>

/**
 * Represents a request to the unified processing API.
 * This is the main input to the {@link IUnifiedMetaAlignerAPI.process} method.
 */
export interface UnifiedProcessingRequest {
  /**
   * The raw output from the LLM, wrapped in the {@link LLMOutput} interface.
   */
  llmOutput: LLMOutput

  /**
   * The context for the processing request, including the user query and conversation history.
   */
  context: UnifiedContext
}

/**
 * Represents the response from the unified processing API.
 * This is the main output from the {@link IUnifiedMetaAlignerAPI.process} method.
 */
export interface UnifiedProcessingResponse {
  /**
   * The enhanced response after being processed by the MetaAligner pipeline.
   */
  enhancedResponse: string

  /**
   * The original, unmodified response from the LLM.
   */
  originalResponse: string

  /**
   * The alignment evaluation result, including scores, metrics, and whether the response was enhanced.
   */
  alignment: {
    evaluation: AlignmentEvaluationResult
    metrics: AlignmentMetrics
    enhanced: boolean
    enhancementAttempts: number
  }

  /**
   * An optional array of errors that occurred during processing.
   * This can be used for debugging and monitoring.
   */
  errors?: { message: string; stage: string }[]
}

/**
 * Defines the interface for the Unified MetaAligner API.
 * This is the main entry point for processing LLM responses.
 */
export interface IUnifiedMetaAlignerAPI {
  /**
   * Processes an LLM response through the enhancement pipeline.
   *
   * @param request - The processing request, containing the LLM output and context.
   * @returns A promise that resolves to the processing response, with the enhanced content and alignment data.
   * @throws An error if the processing fails.
   * @example
   * const response = await api.process({
   *   llmOutput: { content: '...' },
   *   context: { userQuery: '... '}
   * });
   */
  process(request: UnifiedProcessingRequest): Promise<UnifiedProcessingResponse>
}
