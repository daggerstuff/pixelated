// Import getEnv with a specifier that matches tests' vi.mock
import { getEnv } from '@/config/env.config.ts'
// Config imported lazily to avoid initialization order issues
import { getHipaaCompliantLogger } from '@/lib/logging/standardized-logger'

import type { MentalHealthAIModelConfig } from '../types/index.js'
import type {
  IModelProvider,
  LLMInvocationOptions,
  LLMResponse,
} from '../types/mentalHealthAITypes.ts'

const logger = getHipaaCompliantLogger('general')

export class MentalHealthAIModelProvider implements IModelProvider {
  /**
   * Returns the model tier (e.g., '7B', '13B') this provider was initialized with.
   */
  public getModelTier(): string {
    return this.modelTier
  }

  /**
   * Returns the current model configuration (for diagnostics/testing).
   */
  public getModelConfig(): MentalHealthAIModelConfig {
    return this.modelConfig
  }

  /**
   * For test compatibility: invokes the model and returns the content string (like OpenAI chat API).
   * Throws if not properly configured.
   */
  public async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: LLMInvocationOptions,
  ): Promise<string> {
    let result: LLMResponse
    try {
      result = await this.invoke(messages, options)
    } catch (error: unknown) {
      const msg = error instanceof Error ? String(error) : String(error)
      if (
        msg.includes(
          'Unrecognized or invalid response structure from MentalHealthAI API',
        )
      ) {
        // Normalize error message to what tests expect
        throw new Error('Invalid response structure from MentalHealthAI API.', {
          cause: error,
        })
      }
      throw error
    }
    if (!result || typeof result.content !== 'string') {
      throw new Error('Invalid response structure from MentalHealthAI API.')
    }
    return result.content
  }
  private readonly modelConfig: MentalHealthAIModelConfig
  private readonly modelTier: string

  /**
   * Creates an instance of MentalHealthAIModelProvider.
   * Initializes configuration based on the specified model tier and environment variables.
   * @param {('7B' | '13B' | string)} [modelTier='7B'] - The model tier to use (e.g., '7B', '13B').
   * @throws Error if essential configuration (API key, endpoint URL for the tier) is missing.
   */
  constructor(modelTier: '7B' | '13B' = '7B') {
    this.modelTier = modelTier

    // Cloudflare Workers AI (OpenAI-compatible chat completions).
    // Standing rule (see .foresight/rules/model_age.md): Mistral Small 3.1 24B only.
    // modelTier ('7B' | '13B') is retained as a compat label only.
    const env = getEnv()
    const apiKey = env.CLOUDFLARE_AI_API_KEY
    const accountId = env.CLOUDFLARE_ACCOUNT_ID
    const endpointUrl = accountId
      ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`
      : undefined

    if (!apiKey || !endpointUrl) {
      logger.warn(
        `Workers AI credentials are not configured for MentalHealthAI model tier ${modelTier}. Using mock provider.`,
      )
      this.modelConfig = {
        modelId: `mock-mental-health-ai-${modelTier}`,
        providerType: 'custom_api',
      }
    } else {
      this.modelConfig = {
        modelId: '@cf/mistralai/mistral-small-3.1-24b-instruct',
        endpointUrl,
        apiKey,
        providerType: 'custom_api',
      }
    }
    logger.info(
      `MentalHealthAIModelProvider initialized for tier ${this.modelTier}`,
      { config: this.modelConfig.modelId },
    )
  }
  /**
   * Checks if the MentalHealthAI model API is available and properly configured.
   * Returns true if the endpoint and API key are set and the API responds to a health check.
   */
  async isAvailable(): Promise<boolean> {
    if (
      !this.modelConfig.endpointUrl ||
      !this.modelConfig.apiKey ||
      this.modelConfig.modelId.startsWith('mock-')
    ) {
      logger.warn(
        `MentalHealthAI model ${this.modelConfig.modelId} is not properly configured or is a mock.`,
      )
      return false
    }
    try {
      // Attempt a lightweight health check or OPTIONS request
      const response = await fetch(this.modelConfig.endpointUrl, {
        method: 'OPTIONS',
        headers: {
          Authorization: `Bearer ${this.modelConfig.apiKey}`,
        },
      })
      if (response.ok) {
        return true
      }
      logger.warn(
        `MentalHealthAI API health check failed with status ${response.status}`,
      )
      return false
    } catch (error: unknown) {
      logger.error('Error during MentalHealthAI API health check', {
        modelId: this.modelConfig.modelId,
        errorMessage: error instanceof Error ? String(error) : String(error),
      })
      return false
    }
  }

  /**
   * Invokes the configured MentalHealthAI model and returns a structured LLMResponse.
   * @param messages Array of chat messages.
   * @param options Optional invocation options.
   */
  async invoke(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: LLMInvocationOptions,
  ): Promise<LLMResponse> {
    if (
      !this.modelConfig.endpointUrl ||
      !this.modelConfig.apiKey ||
      this.modelConfig.modelId.startsWith('mock-')
    ) {
      const errorMsg = `MentalHealthAI model ${this.modelConfig.modelId} is not properly configured for actual API calls.`
      logger.error(errorMsg)
      throw new Error(errorMsg)
    }

    logger.info(`Invoking MentalHealthAI model ${this.modelConfig.modelId}`, {
      messageCount: messages.length,
      options,
    })

    try {
      const response = await fetch(this.modelConfig.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.modelConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelConfig.modelId,
          messages,
          ...options,
        }),
      })

      if (!response.ok) {
        const errorBody = await response
          .text()
          .catch(() => 'Could not retrieve error body')
        logger.error('MentalHealthAI API request failed', {
          status: response.status,
          body: errorBody,
          endpoint: this.modelConfig.endpointUrl,
          modelId: this.modelConfig.modelId,
        })
        throw new Error(
          `API request to ${this.modelConfig.modelId} failed with status ${response.status}: ${errorBody}`,
        )
      }

      const data = await response.json()

      // Parse response for OpenAI-like and custom formats
      let content: string | undefined
      let finishReason: string | undefined
      let tokenUsage: LLMResponse['tokenUsage'] | undefined

      if (
        data.choices &&
        Array.isArray(data.choices) &&
        data.choices.length > 0
      ) {
        if (
          data.choices[0].message &&
          typeof data.choices[0].message.content === 'string'
        ) {
          content = data.choices[0].message.content
        } else if (typeof data.choices[0].text === 'string') {
          content = data.choices[0].text
        }
        finishReason = data.choices[0].finish_reason
      } else if (typeof data.content === 'string') {
        content = data.content
      } else if (typeof data.result === 'string') {
        content = data.result
      }

      if (data.usage) {
        tokenUsage = {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      }

      if (typeof content === 'string' && content.length > 0) {
        const response: LLMResponse = {
          content,
          model: this.modelConfig.modelId,
          metadata: data,
          ...(tokenUsage !== undefined ? { tokenUsage } : {}),
          ...(finishReason !== undefined
            ? {
                finishReason: finishReason as
                  | 'stop'
                  | 'length'
                  | 'content_filter'
                  | 'function_call',
              }
            : {}),
        }
        return response
      } else {
        logger.error(
          'Unrecognized or invalid response structure from MentalHealthAI API',
          { responseData: data },
        )
        throw new Error(
          'Unrecognized or invalid response structure from MentalHealthAI API.',
        )
      }
    } catch (error: unknown) {
      logger.error(
        'Error calling MentalHealthAI model or processing its response:',
        {
          modelId: this.modelConfig.modelId,
          errorMessage: error instanceof Error ? String(error) : String(error),
          stack: error instanceof Error ? (error)?.stack : undefined,
        },
      )
      throw error
    }
  }

  /**
   * Returns model info for UI or diagnostics.
   */
  getModelInfo(): { name: string; version: string; capabilities: string[] } {
    return {
      name: this.modelConfig.modelId,
      version: this.modelTier,
      capabilities: ['chat', 'completion'],
    }
  }
}

// Export the class and potentially instances or a factory function
export default MentalHealthAIModelProvider
