// Defines interfaces and types for Model Providers

export interface ModelProviderOptions {
  apiKey?: string
  baseUrl?: string
  modelName?: string
  // Other common options like temperature, maxTokens can be part of request options
}

export interface ChatCompletionRequestMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  name?: string // Optional name for the message participant
}

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

export interface ChatCompletionResponseChoice {
  index?: number
  message: {
    role: 'assistant' | string // Assistant role, but could be other strings for some models
    content: string | null
  }
  finish_reason?: string // e.g., 'stop', 'length', 'content_filter'
}

export interface ChatCompletionResponse {
  id?: string // Unique ID for the completion
  object?: string // e.g., 'chat.completion'
  created?: number // Timestamp
  model: string // Model used for the completion
  choices: ChatCompletionResponseChoice[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  error?: {
    message: string
    status?: number
    data?: unknown
  } // To include any error messages from the provider if not throwing
}

export interface TextGenerationOptions {
  model?: string // Model name for this specific request
  temperature?: number
  max_tokens?: number
  top_p?: number
  stop?: string | string[]
  providerSpecificParams?: Record<string, unknown> // Allow provider-specific parameters
  // Other common options
  [key: string]: unknown
}

export interface TextGenerationResponse {
  text: string
  finish_reason?: string | undefined
  error?: {
    message: string
    status?: number
    data?: unknown
  } // To include any error messages from the provider if not throwing
  // Other relevant fields
}

/**
 * Interface for a generic Model Provider.
 * This allows different LLM providers (OpenAI, Anthropic, local models etc.)
 * to be used interchangeably by the MentalLLaMA system.
 */
export interface IModelProvider {
  /**
   * Initializes the provider with necessary configuration.
   * @param options - Configuration options for the provider.
   */
  initialize(options: ModelProviderOptions): Promise<void>

  /**
   * Generates a chat completion based on a sequence of messages.
   * @param messages - An array of message objects.
   * @param options - Optional parameters for the completion request.
   * @returns A promise that resolves to the chat completion response.
   */
  chatCompletion(
    messages: ChatCompletionRequestMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResponse>

  /**
   * Generates text based on a given prompt.
   * (Optional method, as chatCompletion is often preferred and more capable)
   * @param prompt - The text prompt for generation.
   * @param options - Optional parameters for the text generation request.
   * @returns A promise that resolves to the generated text.
   */
  textGeneration?(
    prompt: string,
    options?: TextGenerationOptions,
  ): Promise<TextGenerationResponse>

  /**
   * Gets the name or identifier of the model provider (e.g., "OpenAI", "Anthropic").
   */
  getProviderName(): string
}
