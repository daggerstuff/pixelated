/**
 * @module adapter
 * @description This module provides an adapter for transforming outputs from different LLM providers into a unified format.
 * It allows the MetaAligner pipeline to process responses from various LLMs in a standardized way.
 */

import type {
  LLMOutput,
  UnifiedContext,
  UnifiedProcessingRequest,
} from './unified-api'
import type { LLMResponse as MentalLLaMAResponse } from '../../ai/mental-llama/types/mentalLLaMATypes'

/**
 * Represents the supported LLM providers.
 * This enum is used to identify the source of the LLM output.
 */
export type LLMProvider = 'MentalLLaMA' | 'OpenAI' | 'Anthropic' | 'Gemini'

/**
 * The LLM adapter class.
 * This class is responsible for transforming provider-specific LLM outputs into the unified format.
 */
export class LLMAdapter {
  /**
   * Transforms the raw output from an LLM provider into a {@link UnifiedProcessingRequest}.
   * This is the main method of the adapter, which dispatches to the appropriate provider-specific transformer.
   *
   * @param provider - The LLM provider, e.g., 'MentalLLaMA', 'OpenAI'.
   * @param rawOutput - The raw output from the LLM provider.
   * @param context - The context for the processing request.
   * @returns The transformed processing request, ready to be sent to the MetaAligner pipeline.
   * @throws An error if the provider is not supported.
   */
  public transform(
    provider: LLMProvider,
    rawOutput: unknown,
    context: UnifiedContext,
  ): UnifiedProcessingRequest {
    switch (provider) {
      case 'MentalLLaMA':
        return this.transformMentalLLaMA(
          rawOutput as MentalLLaMAResponse,
          context,
        )
      case 'OpenAI':
        // Placeholder for OpenAI adapter
        throw new Error('OpenAI adapter not implemented yet.')
      case 'Anthropic':
        // Placeholder for Anthropic adapter
        throw new Error('Anthropic adapter not implemented yet.')
      case 'Gemini':
        // Placeholder for Gemini adapter
        throw new Error('Gemini adapter not implemented yet.')
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`)
    }
  }

  /**
   * Transforms the output from the MentalLLaMA provider.
   * This method is specific to the MentalLLaMA provider and its {@link MentalLLaMAResponse} format.
   *
   * @param rawOutput - The raw output from the MentalLLaMA provider.
   * @param context - The context for the processing request.
   * @returns The transformed processing request.
   */
  private transformMentalLLaMA(
    rawOutput: MentalLLaMAResponse,
    context: UnifiedContext,
  ): UnifiedProcessingRequest {
    const llmOutput: LLMOutput = {
      content: rawOutput.content,
      metadata: {
        ...rawOutput.metadata,
        finishReason: rawOutput.finishReason,
        tokenUsage: rawOutput.tokenUsage,
        model: rawOutput.model,
      },
    }

    return {
      llmOutput,
      context,
    }
  }
}
