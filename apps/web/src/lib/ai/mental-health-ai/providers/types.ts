// Defines interfaces and types for Model Providers

export interface ChatCompletionOptions {
  model?: string // Model name for this specific request
  temperature?: number
  max_tokens?: number
  top_p?: number
  stop?: string | string[]
  presence_penalty?: number
  frequency_penalty?: number
  user?: string // End-user identifier for monitoring/abuse detection

  /**
   * Provider-specific parameters that will be passed through to the underlying model provider.
   * This allows for passing OpenAI-specific parameters (like 'functions', 'function_call', 'response_format', etc.)
   * or parameters specific to other providers without breaking the interface contract.
   *
   * @example
   * // For OpenAI function calling
   * { functions: [...], function_call: 'auto' }
   *
   * // For response format control
   * { response_format: { type: 'json_object' } }
   */
  providerSpecificParams?: Record<string, unknown>

  [key: string]: unknown // Allow other provider-specific options
}

interface ChatCompletionResponseChoice {
  index?: number
  message: {
    role: string // Assistant role, but could be other strings for some models
    content: string | null
  }
  finish_reason?: string // e.g., 'stop', 'length', 'content_filter'
}

/**
 * Interface for a generic Model Provider.
 * This allows different LLM providers (OpenAI, Anthropic, local models etc.)
 * to be used interchangeably by the MentalHealthAI system.
 */
