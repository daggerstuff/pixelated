/**
 * @module adapter
 * @description module provides adapter transforming outputs LLM providers into unified format.
 * allows MetaAligner pipeline process responses various LLMs in standardized way.
 */

import type { LLMResponse as MentalLLaMAResponse } from '../../ai/mental-llama/types/mentalLLaMATypes'
import type {
  LLMOutput,
  UnifiedContext,
  UnifiedProcessingRequest,
} from './unified-api'

/**
 * Represents supported LLM providers.
 * enum used identify source LLM output.
 */
export type LLMProvider = 'MentalLLaMA' | 'OpenAI' | 'Anthropic' | 'Gemini'

/**
 * Raw output shapes from each supported provider's chat completion API.
 */
export interface OpenAIRawOutput {
  id?: string
  choices?: Array<{
    message?: { role?: string; content?: string }
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  model?: string
}

export interface AnthropicRawOutput {
  id?: string
  content?: Array<{ type?: string; text?: string }>
  usage?: { input_tokens?: number; output_tokens?: number }
  stop_reason?: string
  model?: string
}

export interface GeminiRawOutput {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }>; role?: string }
    finishReason?: string
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
  model?: string
}

/**
 * LLM adapter class.
 * responsible transforming provider-specific LLM outputs into unified format.
 */
export class LLMAdapter {
  /**
   * Transforms raw output LLM provider into {@link UnifiedProcessingRequest}.
   * main method adapter, dispatches appropriate provider-specific transformer.
   *
   * @param provider - LLM provider, e.g., 'MentalLLaMA', 'OpenAI'.
   * @param rawOutput - raw output LLM provider.
   * @param context - context processing request.
   * @returns transformed processing request, ready sent MetaAligner pipeline.
   * @throws An error provider not supported.
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
        return this.transformOpenAI(rawOutput as OpenAIRawOutput, context)
      case 'Anthropic':
        return this.transformAnthropic(rawOutput as AnthropicRawOutput, context)
      case 'Gemini':
        return this.transformGemini(rawOutput as GeminiRawOutput, context)
      default: {
        const exhaustive: never = provider
        throw new Error(`Unsupported LLM provider: ${String(exhaustive)}`)
      }
    }
  }

  /**
   * Transforms raw output from the MentalLLaMA provider into unified format.
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

    return { llmOutput, context }
  }

  /**
   * Transforms raw output from the OpenAI Chat Completions API into unified format.
   */
  private transformOpenAI(
    rawOutput: OpenAIRawOutput,
    context: UnifiedContext,
  ): UnifiedProcessingRequest {
    const choice = rawOutput.choices?.[0]
    const content = choice?.message?.content ?? ''
    const llmOutput: LLMOutput = {
      content,
      metadata: {
        provider: 'OpenAI',
        model: rawOutput.model,
        finishReason: choice?.finish_reason,
        tokenUsage: rawOutput.usage
          ? {
              promptTokens: rawOutput.usage.prompt_tokens ?? 0,
              completionTokens: rawOutput.usage.completion_tokens ?? 0,
              totalTokens: rawOutput.usage.total_tokens ?? 0,
            }
          : undefined,
      },
    }
    return { llmOutput, context }
  }

  /**
   * Transforms raw output from the Anthropic Messages API into unified format.
   */
  private transformAnthropic(
    rawOutput: AnthropicRawOutput,
    context: UnifiedContext,
  ): UnifiedProcessingRequest {
    const content =
      rawOutput.content?.map((block) => block.text ?? '').join('') ?? ''
    const llmOutput: LLMOutput = {
      content,
      metadata: {
        provider: 'Anthropic',
        model: rawOutput.model,
        finishReason: rawOutput.stop_reason,
        tokenUsage:
          rawOutput.usage != null
            ? {
                promptTokens: rawOutput.usage.input_tokens ?? 0,
                completionTokens: rawOutput.usage.output_tokens ?? 0,
                totalTokens:
                  (rawOutput.usage.input_tokens ?? 0) +
                  (rawOutput.usage.output_tokens ?? 0),
              }
            : undefined,
      },
    }
    return { llmOutput, context }
  }

  /**
   * Transforms raw output from the Google Gemini generateContent API into unified format.
   */
  private transformGemini(
    rawOutput: GeminiRawOutput,
    context: UnifiedContext,
  ): UnifiedProcessingRequest {
    const candidate = rawOutput.candidates?.[0]
    const content =
      candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
    const llmOutput: LLMOutput = {
      content,
      metadata: {
        provider: 'Gemini',
        model: rawOutput.model,
        finishReason: candidate?.finishReason,
        tokenUsage: rawOutput.usageMetadata
          ? {
              promptTokens: rawOutput.usageMetadata.promptTokenCount ?? 0,
              completionTokens:
                rawOutput.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: rawOutput.usageMetadata.totalTokenCount ?? 0,
            }
          : undefined,
      },
    }
    return { llmOutput, context }
  }
}
