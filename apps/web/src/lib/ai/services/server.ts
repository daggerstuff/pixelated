import {
  createServer,
  type IncomingMessage,
  type ServerResponse as NodeServerResponse,
} from 'http'
import { parse } from 'url'

import { closeSentry, Sentry } from '../../../../../../config/instrument.mjs'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
const logger = createBuildSafeLogger('server')
import { safeJsonParse } from '../../utils/json-extraction'
import { apiMetrics, emotionMetrics } from '../../sentry/utils'
import { getAllowedOrigin } from '../bias-detection/utils'
import type { AIMessage, AIServiceOptions } from '../models/ai-types'
import {
  getAIServiceByProvider,
  getAvailableProviders,
  initializeProviders,
} from '../providers'
import type { AIProviderType } from '../providers'

function formatErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

const appLogger = createBuildSafeLogger('ai-server')

const AI_SERVICE_PORT = parseInt(process.env['PORT'] ?? '8002', 10)

type HttpResponse = NodeServerResponse
type HttpRequest = IncomingMessage

type AIServiceRequestBody = Record<string, unknown>

type AIChatRequest = {
  messages: unknown
  provider: unknown
  options: unknown
}

type AIEmotionRequest = {
  text: unknown
  provider: unknown
  options: unknown
}

type AIStreamRequest = {
  messages: unknown
  provider: unknown
  options: unknown
}

interface ServerResponse {
  success: boolean
  data?: unknown
  error?: string
}

class AIServer {
  private server: ReturnType<typeof createServer> | null = null
  private isRunning = false

   constructor() {
     // Initialize AI providers on startup
     initializeProviders()
   }

   private sendJsonResponse(
    req: HttpRequest,
    res: HttpResponse,
    statusCode: number,
    data: ServerResponse,
  ): void {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getAllowedOrigin(req.headers.origin),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.end(JSON.stringify(data))
  }

  private captureCaughtError(error: unknown): void {
    Sentry.captureException(error)
  }

  private getProviderPreference(): AIProviderType[] {
    const preference = process.env['AI_PROVIDER_PREFERENCE']
    if (preference) {
      return preference
        .split(',')
        .map((value) => this.normalizeProvider(value.trim()))
        .filter((value): value is AIProviderType => Boolean(value))
    }
    // Default fallback order
    return ['local', 'llm', 'openai', 'anthropic', 'huggingface']
  }

  private isRecord(value: unknown): value is AIServiceRequestBody {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }

  private isAIMessage(value: unknown): value is AIMessage {
    if (!value || typeof value !== 'object') {
      return false
    }
    const message = value as { role?: unknown; content?: unknown; name?: unknown }
    return (
      (message.role === 'user' ||
        message.role === 'assistant' ||
        message.role === 'system') &&
      typeof message.content === 'string' &&
      (typeof message.name === 'undefined' || typeof message.name === 'string')
    )
  }

  private parseProvider(value: unknown): AIProviderType | undefined {
    if (typeof value !== 'string') {
      return undefined
    }

    const trimmedValue = value.trim()
    switch (trimmedValue) {
      case 'anthropic':
      case 'openai':
      case 'azure-openai':
      case 'llm':
      case 'huggingface':
      case 'local':
        return trimmedValue
    }

    return undefined
  }

  private parseMessages(value: unknown): AIMessage[] | null {
    if (!Array.isArray(value)) {
      return null
    }

    const parsed: AIMessage[] = []
    for (const message of value) {
      if (!this.isAIMessage(message)) {
        return null
      }
      parsed.push(message)
    }

    return parsed
  }

  private parseOptions(value: unknown): AIServiceOptions {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return value
  }

  private parseChatRequest(
    body: AIServiceRequestBody,
  ): AIChatRequest {
    return {
      messages: body['messages'],
      provider: body['provider'],
      options: body['options'],
    }
  }

  private parseEmotionRequest(
    body: AIServiceRequestBody,
  ): AIEmotionRequest {
    return {
      text: body['text'],
      provider: body['provider'],
      options: body['options'],
    }
  }

  private parseStreamRequest(
    body: AIServiceRequestBody,
  ): AIStreamRequest {
    return {
      messages: body['messages'],
      provider: body['provider'],
      options: body['options'],
    }
  }

  private parseResponseContent(content: string): unknown {
    const parsed = safeJsonParse(content)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
    return { rawResponse: content }
  }

  private normalizeProvider(value: string): AIProviderType | undefined {
    if (!value) return undefined
    return this.parseProvider(value)
  }

  private async handleHealthCheck(req: HttpRequest, res: HttpResponse): Promise<void> {
    try {
      const availableProviders = getAvailableProviders()
      const services = availableProviders.map((provider) => {
        try {
          const service = getAIServiceByProvider(provider)
          return {
            provider,
            status: service ? 'available' : 'unavailable',
          }
        } catch (error: unknown) {
          return {
            provider,
            status: 'error',
            error: formatErrorMessage(error, 'Unknown error'),
          }
        }
      })

      this.sendJsonResponse(req, res, 200, {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services,
          uptime: process.uptime(),
        },
      })
     } catch (error: unknown) {
       appLogger.error('Health check failed:', error)
       this.captureCaughtError(error)
       this.sendJsonResponse(req, res, 500, {
         success: false,
         error: formatErrorMessage(error, 'Health check failed'),
       })
     }
  }

  private async handleChatCompletion(
    req: HttpRequest,
    res: HttpResponse,
    body: AIServiceRequestBody,
  ): Promise<void> {
    try {
      const { messages, provider, options } = this.parseChatRequest(body)
      const parsedMessages = this.parseMessages(messages)
      const parsedOptions = this.parseOptions(options)
      const parsedProvider = this.parseProvider(provider)

      if (!parsedMessages) {
        this.sendJsonResponse(req, res, 400, {
          success: false,
          error: 'Messages array is required',
        })
        return
      }

      let service: ReturnType<typeof getAIServiceByProvider> = null
      let selectedProvider: AIProviderType | undefined

      // If specific provider requested, try it first
      if (parsedProvider) {
        service = getAIServiceByProvider(parsedProvider)
        selectedProvider = parsedProvider
        if (!service) {
          this.sendJsonResponse(req, res, 400, {
            success: false,
            error: `Requested provider '${parsedProvider}' is not available. Available providers: ${getAvailableProviders().join(', ')}`,
          })
          return
        }
      } else {
        // Try providers in order of preference
        const providers = this.getProviderPreference()
        for (const name of providers) {
          service = getAIServiceByProvider(name)
          if (service) {
            selectedProvider = name
            break
          }
        }

        if (!service) {
          this.sendJsonResponse(req, res, 503, {
            success: false,
            error:
              'No AI providers are currently available. Please configure API keys for the LLM API, OpenAI, Anthropic, or Hugging Face.',
          })
          return
        }
      }

      // Convert messages to expected format
      const formattedMessages: AIMessage[] = parsedMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        name: msg.name,
      }))

      const completion = await service.createChatCompletion(
        formattedMessages,
        parsedOptions,
      )

      this.sendJsonResponse(req, res, 200, {
        success: true,
        data: {
          ...completion,
          provider: selectedProvider,
        },
      })
     } catch (error: unknown) {
       appLogger.error('Chat completion failed:', error)
       this.captureCaughtError(error)
       this.sendJsonResponse(req, res, 500, {
         success: false,
         error: formatErrorMessage(error, 'Chat completion failed'),
       })
     }
  }

  private async handleEmotionAnalysis(
    req: HttpRequest,
    res: HttpResponse,
    body: AIServiceRequestBody,
  ): Promise<void> {
    try {
      const { text, provider, options } = this.parseEmotionRequest(body)
      const parsedProvider = this.parseProvider(provider)
      const parsedOptions = this.parseOptions(options)

      if (!text || typeof text !== 'string') {
        this.sendJsonResponse(req, res, 400, {
          success: false,
          error: 'Text is required for emotion analysis',
        })
        return
      }

      let service: ReturnType<typeof getAIServiceByProvider> = null

      // If specific provider requested, try it first
      if (parsedProvider) {
        service = getAIServiceByProvider(parsedProvider)
        if (!service) {
          this.sendJsonResponse(req, res, 400, {
            success: false,
            error: `Requested provider '${parsedProvider}' is not available. Available providers: ${getAvailableProviders().join(', ')}`,
          })
          return
        }
      } else {
        // Try providers in order of preference
        const providers = this.getProviderPreference()
        for (const name of providers) {
          service = getAIServiceByProvider(name)
          if (service) {
            break
          }
        }

        if (!service) {
          this.sendJsonResponse(req, res, 503, {
            success: false,
            error:
              'No AI providers are currently available. Please configure API keys for the LLM API, OpenAI, Anthropic, or Hugging Face.',
          })
          return
        }
      }

      // Create emotion analysis prompt
      const messages: AIMessage[] = [
        {
          role: 'system',
          content: `You are an expert emotion analyst. Analyze the following text and provide:
1. Primary emotions detected (e.g., joy, sadness, anger, fear, surprise, disgust)
2. Emotional intensity (low, medium, high)
3. Context clues that support your analysis
4. Any potential emotional triggers or concerns

Respond in JSON format with the following structure:
{
  "primaryEmotions": ["emotion1", "emotion2"],
  "intensity": "medium",
  "contextClues": ["clue1", "clue2"],
  "triggers": ["trigger1", "trigger2"],
  "confidence": 0.85
}`,
        },
        {
          role: 'user',
          content: `Please analyze the emotional content of this text: "${text}"`,
        },
      ]

      const completion = await service.createChatCompletion(
        messages,
        parsedOptions,
      )

      // Parse the response as JSON if possible
      let analysisResult: unknown
      try {
        analysisResult = this.parseResponseContent(completion.content)
      } catch {
        // If parsing fails, return the raw response
        analysisResult = { rawResponse: completion.content }
      }

      this.sendJsonResponse(req, res, 200, {
        success: true,
        data: {
          analysis: analysisResult,
          usage: completion.usage,
          model: completion.model,
        },
      })
     } catch (error: unknown) {
       appLogger.error('Emotion analysis failed:', error)
       this.captureCaughtError(error)
       this.sendJsonResponse(req, res, 500, {
         success: false,
         error: formatErrorMessage(error, 'Emotion analysis failed'),
       })
     }
  }

  private async handleStreamingChat(
    req: HttpRequest,
    res: HttpResponse,
    body: AIServiceRequestBody,
  ): Promise<void> {
    try {
      const { messages, provider, options } = this.parseStreamRequest(body)
      const parsedMessages = this.parseMessages(messages)
      const parsedOptions = this.parseOptions(options)
      const parsedProvider = this.parseProvider(provider)

      if (!parsedMessages) {
        this.sendJsonResponse(req, res, 400, {
          success: false,
          error: 'Messages array is required',
        })
        return
      }

      let service: ReturnType<typeof getAIServiceByProvider> = null

      // If specific provider requested, try it first
      if (parsedProvider) {
        service = getAIServiceByProvider(parsedProvider)
        if (!service) {
          this.sendJsonResponse(req, res, 400, {
            success: false,
            error: `Requested provider '${parsedProvider}' is not available. Available providers: ${getAvailableProviders().join(', ')}`,
          })
          return
        }
      } else {
        // Try providers in order of preference
        const providers = this.getProviderPreference()
        for (const name of providers) {
          service = getAIServiceByProvider(name)
          if (service) {
            break
          }
        }

        if (!service) {
          this.sendJsonResponse(req, res, 503, {
            success: false,
            error:
              'No AI providers are currently available. Please configure API keys for the LLM API, OpenAI, Anthropic, or Hugging Face.',
          })
          return
        }
      }

      // Set headers for SSE
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': getAllowedOrigin(req.headers.origin),
        'Access-Control-Allow-Headers': 'Cache-Control',
      })

      const formattedMessages: AIMessage[] = parsedMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        name: msg.name,
      }))

      const stream = await service.createStreamingChatCompletion(
        formattedMessages,
        parsedOptions,
      )

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}

`)
      }

      res.write('data: [DONE]\n\n')
      res.end()
     } catch (error: unknown) {
       appLogger.error('Streaming chat failed:', error)
       this.captureCaughtError(error)
       if (!res.headersSent) {
         this.sendJsonResponse(req, res, 500, {
           success: false,
           error: formatErrorMessage(error, 'Streaming failed'),
         })
       } else {
         res.write(
           `data: ${JSON.stringify({ error: formatErrorMessage(error, 'Streaming failed') })}

`,
         )
        res.end()
      }
    }
  }

  private async parseRequestBody(req: HttpRequest): Promise<AIServiceRequestBody> {
    return new Promise((resolve, reject) => {
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        try {
          if (!body) {
            resolve({})
            return
          }

          const parsed: unknown = JSON.parse(body)
          resolve(
            this.isRecord(parsed) ? parsed : {},
          )
        } catch (error: unknown) {
           reject(
             new Error(
               `Invalid JSON: ${formatErrorMessage(error, String(error))}`,
             ),
           )
        }
      })
      req.on('error', reject)
    })
  }

  private async handleRequest(req: HttpRequest, res: HttpResponse): Promise<void> {
    const { method, url } = req
    const requestMethod = method ?? 'UNKNOWN'
    const parsedUrl = parse(url ?? '', true)
    const path = parsedUrl.pathname
    const startTime = Date.now()

    // Handle CORS preflight
    if (requestMethod === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': getAllowedOrigin(req.headers.origin),
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
      res.end()
      return
    }

    try {
      switch (`${requestMethod} ${path}`) {
        case 'GET /health':
          await this.handleHealthCheck(req, res)
          break

        case 'POST /chat': {
      const chatBody = await this.parseRequestBody(req)
          await this.handleChatCompletion(req, res, chatBody)
          const durationMs = Date.now() - startTime
           apiMetrics.request('/ai-service/chat', 'POST', res.statusCode ?? 200)
          apiMetrics.responseTime('/ai-service/chat', durationMs, 'POST')
          break
        }

        case 'POST /analyze-emotion': {
          const emotionBody = await this.parseRequestBody(req)
          const analysisStartTime = Date.now()
          await this.handleEmotionAnalysis(req, res, emotionBody)
          const durationMs = Date.now() - startTime
          const analysisDurationMs = Date.now() - analysisStartTime
          apiMetrics.request(
             '/ai-service/analyze-emotion',
             'POST',
             res.statusCode ?? 200,
          )
          apiMetrics.responseTime(
            '/ai-service/analyze-emotion',
            durationMs,
            'POST',
          )
          emotionMetrics.analysisLatency(analysisDurationMs, 'ai-service')
          break
        }

        case 'POST /chat/stream': {
          const streamBody = await this.parseRequestBody(req)
          await this.handleStreamingChat(req, res, streamBody)
          const durationMs = Date.now() - startTime
           apiMetrics.request(
             '/ai-service/chat/stream',
             'POST',
             res.statusCode ?? 200,
           )
          apiMetrics.responseTime('/ai-service/chat/stream', durationMs, 'POST')
          break
        }

        default:
          this.sendJsonResponse(req, res, 404, {
            success: false,
            error: 'Endpoint not found',
          })
          apiMetrics.request('/ai-service/unknown', requestMethod, 404)
      }
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime
      const errorType =
        error instanceof Error ? error.constructor.name : 'UnknownError'
      apiMetrics.error('/ai-service', errorType)
      apiMetrics.responseTime('/ai-service', durationMs, method)
      appLogger.error('Request handling error:', error)
      this.captureCaughtError(error)
      this.sendJsonResponse(req, res, 500, {
        success: false,
        error: 'Internal server error',
      })
    }
  }

  async start(): Promise<{ status: string; port: number }> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer((req, res) => {
          this.handleRequest(req, res).catch((error) => {
            appLogger.error('Unhandled request error:', error)
            Sentry.captureException(error)
            if (!res.headersSent) {
              this.sendJsonResponse(req, res, 500, {
                success: false,
                error: 'Internal server error',
              })
            }
          })
        })

        this.server.listen(AI_SERVICE_PORT, () => {
          this.isRunning = true
          appLogger.info(`AI Service started on port ${AI_SERVICE_PORT}`)
          appLogger.info(`AI Service started on port ${AI_SERVICE_PORT}`)
          appLogger.info('Available endpoints:')
          appLogger.info('  GET /health - Health check')
          appLogger.info('  POST /chat - Chat completion')
          appLogger.info('  POST /chat/stream - Streaming chat completion')
          appLogger.info('  POST /analyze-emotion - Emotion analysis')

          // Keep-alive logging
          setInterval(() => {
            appLogger.debug('AI Service is running...')
          }, 30000)

          resolve({ status: 'running', port: AI_SERVICE_PORT })
        })

        this.server.on('error', (error) => {
          appLogger.error('Server error:', error)
          Sentry.captureException(error)
          reject(error)
        })
      } catch (error: unknown) {
        reject(error)
      }
    })
  }

  async stop(): Promise<void> {
    if (this.server && this.isRunning) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.isRunning = false
          appLogger.info('AI Service stopped')
          appLogger.info('AI Service stopped')
          resolve()
        })
      })
    }
  }
}

// Create and export server instance
const aiServer = new AIServer()

// Graceful shutdown
process.on('SIGTERM', () => {
  void aiServer
    .stop()
    .finally(() => {
      void closeSentry()
    })
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
})
process.on('SIGINT', () => {
  void aiServer
    .stop()
    .finally(() => {
      void closeSentry()
    })
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
})

// Start server
aiServer.start().catch((error) => {
  appLogger.error('Failed to start AI service:', error)
  Sentry.captureException(error)
  void closeSentry()
  process.exit(1)
})
