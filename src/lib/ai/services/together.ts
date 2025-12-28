import type {
  AIMessage,
  AIServiceOptions,
  AICompletion,
  AIUsage,
  AIStreamChunk,
} from '../models/ai-types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const appLogger = createBuildSafeLogger('app')

export interface TogetherAIConfig {
  togetherApiKey: string
  togetherBaseUrl?: string
  apiKey: string
  maxRetries?: number
  timeoutMs?: number
  rateLimitRpm?: number
}

export interface TogetherStreamResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    delta: {
      content?: string
      role?: string
    }
    index: number
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitterMaxMs: number
}

export interface RateLimitInfo {
  requestsPerMinute: number
  tokensPerMinute: number
  requestTimestamps: number[]
  tokenUsageHistory: Array<{ timestamp: number; tokens: number }>
}

export interface TogetherAIService {
  generateCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion | { content: string; usage?: AIUsage }>
  createChatCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AICompletion>
  createStreamingChatCompletion(
    messages: AIMessage[],
    options?: AIServiceOptions,
  ): Promise<AsyncGenerator<AIStreamChunk, void, void>>
  dispose(): void
}

class TogetherAIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public retryable = false,
  ) {
    super(message)
    this.name = 'TogetherAIError'
  }
}

class RateLimitManager {
  private rateLimitInfo: RateLimitInfo

  constructor(config: { requestsPerMinute: number; tokensPerMinute: number }) {
    this.rateLimitInfo = {
      requestsPerMinute: config.requestsPerMinute,
      tokensPerMinute: config.tokensPerMinute,
      requestTimestamps: [],
      tokenUsageHistory: [],
    }
  }

  async checkRateLimit(estimatedTokens: number): Promise<void> {
    const now = Date.now()
    const oneMinute = 60000

    // Clean up entries older than one minute (sliding window)
    this.pruneOldEntries(now, oneMinute)

    // Calculate current usage within the sliding window
    const currentRequestCount = this.rateLimitInfo.requestTimestamps.length
    const currentTokenCount = this.rateLimitInfo.tokenUsageHistory.reduce(
      (sum, entry) => sum + entry.tokens,
      0,
    )

    // Check if we would exceed rate limits
    if (
      currentRequestCount >= this.rateLimitInfo.requestsPerMinute ||
      currentTokenCount + estimatedTokens >= this.rateLimitInfo.tokensPerMinute
    ) {
      // Calculate wait time based on the oldest entry that would be valid after waiting
      const waitTime = this.calculateWaitTime(now, oneMinute, estimatedTokens)

      if (waitTime > 0) {
        appLogger.warn('Rate limit reached, waiting', {
          waitTime,
          currentRequestCount,
          currentTokenCount,
          estimatedTokens,
        })
        await new Promise((resolve) => setTimeout(resolve, waitTime))

        // Clean up again after waiting
        this.pruneOldEntries(Date.now(), oneMinute)
      }
    }

    // Record this request
    this.rateLimitInfo.requestTimestamps.push(now)
    this.rateLimitInfo.tokenUsageHistory.push({
      timestamp: now,
      tokens: estimatedTokens,
    })
  }

  private pruneOldEntries(now: number, windowMs: number): void {
    const cutoff = now - windowMs

    // Remove request timestamps older than the window
    this.rateLimitInfo.requestTimestamps =
      this.rateLimitInfo.requestTimestamps.filter(
        (timestamp) => timestamp > cutoff,
      )

    // Remove token usage entries older than the window
    this.rateLimitInfo.tokenUsageHistory =
      this.rateLimitInfo.tokenUsageHistory.filter(
        (entry) => entry.timestamp > cutoff,
      )
  }

  private calculateWaitTime(
    now: number,
    windowMs: number,
    estimatedTokens: number,
  ): number {
    // Find the oldest entry that would need to be removed to make room
    const oldestRequestTime = this.rateLimitInfo.requestTimestamps[0]
    const oldestTokenTime = this.rateLimitInfo.tokenUsageHistory[0]?.timestamp

    // Calculate wait times based on both request count and token limits
    let requestWaitTime = 0
    let tokenWaitTime = 0

    if (
      this.rateLimitInfo.requestTimestamps.length >=
        this.rateLimitInfo.requestsPerMinute &&
      oldestRequestTime
    ) {
      requestWaitTime = oldestRequestTime + windowMs - now
    }

    const currentTokenCount = this.rateLimitInfo.tokenUsageHistory.reduce(
      (sum, entry) => sum + entry.tokens,
      0,
    )

    if (
      currentTokenCount + estimatedTokens >=
        this.rateLimitInfo.tokensPerMinute &&
      oldestTokenTime
    ) {
      tokenWaitTime = oldestTokenTime + windowMs - now
    }

    // Return the maximum wait time needed
    return Math.max(0, requestWaitTime, tokenWaitTime)
  }
}

async function exponentialBackoffRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      lastError = error as Error

      if (attempt === config.maxRetries) {
        break
      }

      // Don't retry on non-retryable errors
      if (error instanceof TogetherAIError && !error.retryable) {
        throw error
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = Math.min(
        config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelayMs,
      )
      const jitter = Math.random() * config.jitterMaxMs
      const delay = baseDelay + jitter

      appLogger.warn('Request failed, retrying', {
        attempt: attempt + 1,
        maxRetries: config.maxRetries,
        delay,
        error: error instanceof Error ? String(error) : String(error),
      })

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

function estimateTokenCount(messages: AIMessage[]): number {
  // Rough estimation: 1 token ≈ 4 characters
  const totalChars = messages.reduce((acc, msg) => acc + msg.content.length, 0)
  return Math.ceil(totalChars / 4)
}

export function createTogetherAIService(
  config: TogetherAIConfig,
): TogetherAIService {
  const baseUrl = config.togetherBaseUrl || 'https://api.together.xyz'
  const apiKey = config.togetherApiKey
  const timeoutMs = config.timeoutMs || 30000
  const rateLimitRpm = config.rateLimitRpm || 60

  const retryConfig: RetryConfig = {
    maxRetries: config.maxRetries || 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterMaxMs: 500,
  }

  const rateLimitManager = new RateLimitManager({
    requestsPerMinute: rateLimitRpm,
    tokensPerMinute: 150000, // Default Together AI limit
  })

  const createAbortController = (timeoutMs: number): AbortController => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), timeoutMs)
    return controller
  }

  const handleAPIError = (response: Response, data?: unknown): never => {
    const isRetryable = response.status >= 500 || response.status === 429

    let errorMessage = `Together AI API error: ${response.status} ${response.statusText}`
    let errorCode = response.status.toString()

    if (data && typeof data === 'object' && 'error' in data) {
      const errorData = data as { error: { message?: string; code?: string } }
      errorMessage = `Together AI API error: ${errorData.String(error) || errorData.error}`
      errorCode = errorData.error.code || errorCode
    }

    throw new TogetherAIError(
      errorMessage,
      response.status,
      errorCode,
      isRetryable,
    )
  }

  interface TogetherCompletionResponse {
    id: string
    created: number
    model: string
    choices: Array<{
      message: {
        role: string
        content: string
      }
      finish_reason?: string
    }>
    usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
  }

  const makeRequest = async <T>(
    url: string,
    body: Record<string, unknown>,
    stream = false,
  ): Promise<T extends Response ? Response : T> => {
    const messages = body['messages'] as AIMessage[] | undefined
    const estimatedTokens = estimateTokenCount(messages || [])
    await rateLimitManager.checkRateLimit(estimatedTokens)

    const controller = createAbortController(timeoutMs)

    const requestInit: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Together-AI-Client/1.0',
      },
      body: JSON.stringify({ ...body, stream }),
      signal: controller.signal,
    }

    return exponentialBackoffRetry(async () => {
      const response = await fetch(url, requestInit)

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch {
          // If JSON parsing fails, handle without error data
        }
        handleAPIError(response, errorData)
      }

      if (stream) {
        return response as T extends Response ? Response : T
      }

      const data = await response.json()
      return data as T extends Response ? Response : T
    }, retryConfig)
  }

  return {
    async generateCompletion(
      messages: AIMessage[],
      options?: AIServiceOptions,
    ): Promise<AICompletion | { content: string; usage?: AIUsage }> {
      try {
        if (!apiKey) {
          throw new TogetherAIError('Together AI API key is not configured')
        }

        const requestBody = {
          model: options?.model || 'mistralai/Mixtral-8x7B-Instruct-v0.2',
          messages,
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 1024,
          stop: options?.stop,
        }

        const data = await makeRequest<TogetherCompletionResponse>(
          `${baseUrl}/v1/chat/completions`,
          requestBody,
        )

        // Return in expected format
        return {
          id: data.id || `together-${Date.now()}`,
          created: data.created || Date.now(),
          model: data.model || requestBody.model,
          choices: data.choices?.map((choice) => ({
            message: {
              role: choice.message.role as 'assistant',
              content: choice.message.content,
            },
            finishReason: (choice.finish_reason === 'stop'
              ? 'stop'
              : choice.finish_reason === 'length'
                ? 'length'
                : 'stop') as 'stop' | 'length' | 'content_filter',
          })) || [
            {
              message: {
                role: 'assistant',
                content: '',
                name: 'assistant',
              },
              finishReason: 'stop' as const,
            },
          ],
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
          },
          provider: 'together',
          content: data.choices?.[0]?.message?.content || '',
        }
      } catch (error: unknown) {
        if (error instanceof TogetherAIError) {
          throw error
        }

        appLogger.error('Error in Together AI completion:', {
          error:
            error instanceof Error
              ? { message: String(error), stack: (error as Error)?.stack }
              : error,
        })
        throw new TogetherAIError(
          `Together AI service error: ${error instanceof Error ? String(error) : 'Unknown error'}`,
        )
      }
    },

    async createChatCompletion(
      messages: AIMessage[],
      options?: AIServiceOptions,
    ): Promise<AICompletion> {
      const result = await this.generateCompletion(messages, options)

      // Ensure we return an AICompletion object
      if ('id' in result) {
        return result as AICompletion
      }

      // Convert basic response to AICompletion format
      return {
        id: `together-${Date.now()}`,
        created: Date.now(),
        model: options?.model || 'mistralai/Mixtral-8x7B-Instruct-v0.2',
        choices: [
          {
            message: {
              role: 'assistant',
              content: result.content,
            },
            finishReason: 'stop',
          },
        ],
        usage: result.usage || {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        provider: 'together',
        content: result.content,
      }
    },

    async createStreamingChatCompletion(
      messages: AIMessage[],
      options?: AIServiceOptions,
    ): Promise<AsyncGenerator<AIStreamChunk, void, void>> {
      try {
        if (!apiKey) {
          throw new TogetherAIError('Together AI API key is not configured')
        }

        const requestBody = {
          model: options?.model || 'mistralai/Mixtral-8x7B-Instruct-v0.2',
          messages,
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 1024,
          stop: options?.stop,
        }

        const response = await makeRequest<Response>(
          `${baseUrl}/v1/chat/completions`,
          requestBody,
          true,
        )

        if (!response.body) {
          throw new TogetherAIError('No response body received for streaming')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        const streamGenerator = async function* (): AsyncGenerator<
          AIStreamChunk,
          void,
          void
        > {
          let buffer = ''
          let requestId = `together-stream-${Date.now()}`
          const { model } = requestBody

          try {
            while (true) {
              // eslint-disable-next-line no-await-in-loop
              const { done, value } = await reader.read()

              if (done) {
                break
              }

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || '' // Keep incomplete line in buffer

              for (const line of lines) {
                const trimmedLine = line.trim()

                if (trimmedLine === '') {
                  continue
                }
                if (trimmedLine === 'data: [DONE]') {
                  return
                }
                if (!trimmedLine.startsWith('data: ')) {
                  continue
                }

                try {
                  const jsonData = trimmedLine.slice(6) // Remove 'data: ' prefix
                  const parsed: TogetherStreamResponse = JSON.parse(
                    jsonData,
                  ) as unknown

                  if (parsed.id) {
                    requestId = parsed.id
                  }

                  const choice = parsed.choices?.[0]
                  if (choice?.delta?.content) {
                    const finishReason:
                      | 'stop'
                      | 'length'
                      | 'content_filter'
                      | undefined =
                      choice.finish_reason === 'stop'
                        ? 'stop'
                        : choice.finish_reason === 'length'
                          ? 'length'
                          : undefined

                    const chunk: AIStreamChunk = {
                      id: requestId,
                      model: parsed.model || model,
                      created: parsed.created || Date.now(),
                      content: choice.delta.content,
                      done: !!choice.finish_reason,
                      ...(finishReason && { finishReason }),
                    }

                    yield chunk
                  }

                  // Handle completion
                  if (choice?.finish_reason) {
                    const finalFinishReason:
                      | 'stop'
                      | 'length'
                      | 'content_filter' =
                      choice.finish_reason === 'stop'
                        ? 'stop'
                        : choice.finish_reason === 'length'
                          ? 'length'
                          : 'stop'

                    const finalChunk: AIStreamChunk = {
                      id: requestId,
                      model: parsed.model || model,
                      created: parsed.created || Date.now(),
                      content: '',
                      done: true,
                      finishReason: finalFinishReason,
                    }
                    yield finalChunk
                    return
                  }
                } catch (parseError) {
                  appLogger.warn('Failed to parse streaming response line', {
                    line: trimmedLine,
                    error:
                      parseError instanceof Error
                        ? parseError.message
                        : String(parseError),
                  })
                }
              }
            }
          } catch (streamError) {
            appLogger.error('Error in streaming response', {
              error:
                streamError instanceof Error
                  ? streamError.message
                  : String(streamError),
            })
            throw new TogetherAIError(
              `Streaming error: ${streamError instanceof Error ? streamError.message : 'Unknown error'}`,
            )
          } finally {
            try {
              reader.releaseLock()
            } catch {
              // Ignore lock release errors
            }
          }
        }

        return streamGenerator()
      } catch (error: unknown) {
        if (error instanceof TogetherAIError) {
          throw error
        }

        appLogger.error('Error in Together AI streaming completion:', {
          error:
            error instanceof Error
              ? { message: String(error), stack: (error as Error)?.stack }
              : error,
        })
        throw new TogetherAIError(
          `Together AI streaming service error: ${error instanceof Error ? String(error) : 'Unknown error'}`,
        )
      }
    },

    dispose() {
      // Clean up any resources if needed
      appLogger.debug('Together AI service disposed')
    },
  }
}
