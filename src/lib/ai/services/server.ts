// IMPORTANT: Import Sentry instrumentation at the very top
import "../../../../config/instrument.mjs";

import { createServer } from 'http'
import { parse } from 'url'
import type { AIMessage, AIServiceOptions } from '../models/ai-types'
import {
  getAIServiceByProvider,
  getAvailableProviders,
  initializeProviders,
} from '../providers'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { apiMetrics, emotionMetrics } from '../../sentry/utils'

const appLogger = createBuildSafeLogger('ai-server')

const AI_SERVICE_PORT = parseInt(process.env['PORT'] || '8002', 10)

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
    res: any,
    statusCode: number,
    data: ServerResponse,
  ): void {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.end(JSON.stringify(data))
  }

  private async handleHealthCheck(res: any): Promise<void> {
    try {
      const availableProviders = getAvailableProviders()
      const services = availableProviders.map((provider) => {
        try {
          const service = getAIServiceByProvider(provider)
          return {
            provider,
            status: service ? 'available' : 'unavailable',
          }
        } catch (error) {
          return {
            provider,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      })

      this.sendJsonResponse(res, 200, {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services,
          uptime: process.uptime(),
        },
      })
    } catch (error) {
      appLogger.error('Health check failed:', error)
      this.sendJsonResponse(res, 500, {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      })
    }
  }

  private async handleChatCompletion(res: any, body: any): Promise<void> {
    try {
      const { messages, provider, options = {} } = body

      if (!messages || !Array.isArray(messages)) {
        this.sendJsonResponse(res, 400, {
          success: false,
          error: 'Messages array is required',
        })
        return
      }

      let service: ReturnType<typeof getAIServiceByProvider> = null
      let selectedProvider = provider

      // If specific provider requested, try it first
      if (provider) {
        service = getAIServiceByProvider(provider as any)
        if (!service) {
          this.sendJsonResponse(res, 400, {
            success: false,
            error: `Requested provider '${provider}' is not available. Available providers: ${getAvailableProviders().join(', ')}`,
          })
          return
        }
      } else {
        // Try providers in order of preference
        const providers = ['together', 'openai', 'anthropic', 'huggingface']
        for (const name of providers) {
          service = getAIServiceByProvider(name as any)
          if (service) {
            break
          }
        }

        if (!service) {
          this.sendJsonResponse(res, 503, {
            success: false,
            error:
              'No AI providers are currently available. Please configure API keys for Together, OpenAI, Anthropic, or Hugging Face.',
          })
          return
        }
      }

      // Convert messages to expected format
      const formattedMessages: AIMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        name: msg.name,
      }))

      const completion = await service.createChatCompletion(
        formattedMessages,
        options as AIServiceOptions,
      )

      this.sendJsonResponse(res, 200, {
        success: true,
        data: {
          ...completion,
          provider: selectedProvider,
        },
      })
    } catch (error) {
      appLogger.error('Chat completion failed:', error)
      this.sendJsonResponse(res, 500, {
        success: false,
        error:
          error instanceof Error ? error.message : 'Chat completion failed',
      })
    }
  }

  private async handleEmotionAnalysis(
    _unused: any,
    res: any,
    body: any,
  ): Promise<void> {
    try {
      const { text, provider, options = {} } = body

      if (!text || typeof text !== 'string') {
        this.sendJsonResponse(res, 400, {
          success: false,
          error: 'Text is required for emotion analysis',
        })
        return
      }

      let service: ReturnType<typeof getAIServiceByProvider> = null

      // If specific provider requested, try it first
      if (provider) {
        service = getAIServiceByProvider(provider as any)
        if (!service) {
          this.sendJsonResponse(res, 400, {
            success: false,
            error: `Requested provider '${provider}' is not available. Available providers: ${getAvailableProviders().join(', ')}`,
          })
          return
        }
      } else {
        // Try providers in order of preference
        const providers = ['together', 'openai', 'anthropic', 'huggingface']
        for (const name of providers) {
          service = getAIServiceByProvider(name as any)
          if (service) {
            break
          }
        }

        if (!service) {
          this.sendJsonResponse(res, 503, {
            success: false,
            error:
              'No AI providers are currently available. Please configure API keys for Together, OpenAI, Anthropic, or Hugging Face.',
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
        options as AIServiceOptions,
      )

      // Parse the response as JSON if possible
      let analysisResult
      try {
        const { content } = completion
        analysisResult = JSON.parse(content)
      } catch {
        // If parsing fails, return the raw response
        analysisResult = { rawResponse: completion.content }
      }

      this.sendJsonResponse(res, 200, {
        success: true,
        data: {
          analysis: analysisResult,
          usage: completion.usage,
          model: completion.model,
        },
      })
    } catch (error) {
      appLogger.error('Emotion analysis failed:', error)
      this.sendJsonResponse(res, 500, {
        success: false,
        error:
          error instanceof Error ? error.message : 'Emotion analysis failed',
      })
    }
  }

  private async handleStreamingChat(
    _unused: any,
    res: any,
    body: any,
  ): Promise<void> {
    try {
      const { messages, provider, options = {} } = body

      if (!messages || !Array.isArray(messages)) {
        this.sendJsonResponse(res, 400, {
          success: false,
          error: 'Messages array is required',
        })
        return
      }

      let service: ReturnType<typeof getAIServiceByProvider> = null

      // If specific provider requested, try it first
      if (provider) {
        service = getAIServiceByProvider(provider as any)
        if (!service) {
          this.sendJsonResponse(res, 400, {
            success: false,
            error: `Requested provider '${provider}' is not available. Available providers: ${getAvailableProviders().join(', ')}`,
          })
          return
        }
      } else {
        // Try providers in order of preference
        const providers = ['together', 'openai', 'anthropic', 'huggingface']
        for (const name of providers) {
          service = getAIServiceByProvider(name as any)
          if (service) {
            break
          }
        }

        if (!service) {
          this.sendJsonResponse(res, 503, {
            success: false,
            error:
              'No AI providers are currently available. Please configure API keys for Together, OpenAI, Anthropic, or Hugging Face.',
          })
          return
        }
      }

      // Set headers for SSE
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      })

      const formattedMessages: AIMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        name: msg.name,
      }))

      const stream = await service.createStreamingChatCompletion(
        formattedMessages,
        options as AIServiceOptions,
      )

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`)
      }

      res.write('data: [DONE]\n\n')
      res.end()
    } catch (error) {
      appLogger.error('Streaming chat failed:', error)
      if (!res.headersSent) {
        this.sendJsonResponse(res, 500, {
          success: false,
          error: error instanceof Error ? error.message : 'Streaming failed',
        })
      } else {
        res.write(
          `data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Streaming failed' })}\n\n`,
        )
        res.end()
      }
    }
  }

  private async parseRequestBody(req: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {})
        } catch (error) {
          reject(
            new Error(
              `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
            ),
          )
        }
      })
      req.on('error', reject)
    })
  }

  private async handleRequest(req: any, res: any): Promise<void> {
    const { method, url } = req
    const parsedUrl = parse(url || '', true)
    const path = parsedUrl.pathname
    const startTime = Date.now()

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
      res.end()
      return
    }

    try {
      switch (`${method} ${path}`) {
        case 'GET /health':
          await this.handleHealthCheck(res)
          break

        case 'POST /chat': {
          const chatBody = await this.parseRequestBody(req)
          await this.handleChatCompletion(res, chatBody)
          const durationMs = Date.now() - startTime
          apiMetrics.request('/ai-service/chat', 'POST', res.statusCode || 200)
          apiMetrics.responseTime('/ai-service/chat', durationMs, 'POST')
          break
        }

        case 'POST /analyze-emotion': {
          const emotionBody = await this.parseRequestBody(req)
          const analysisStartTime = Date.now()
          await this.handleEmotionAnalysis(req, res, emotionBody)
          const durationMs = Date.now() - startTime
          const analysisDurationMs = Date.now() - analysisStartTime
          apiMetrics.request('/ai-service/analyze-emotion', 'POST', res.statusCode || 200)
          apiMetrics.responseTime('/ai-service/analyze-emotion', durationMs, 'POST')
          emotionMetrics.analysisLatency(analysisDurationMs, 'ai-service')
          break
        }

        case 'POST /chat/stream': {
          const streamBody = await this.parseRequestBody(req)
          await this.handleStreamingChat(req, res, streamBody)
          const durationMs = Date.now() - startTime
          apiMetrics.request('/ai-service/chat/stream', 'POST', res.statusCode || 200)
          apiMetrics.responseTime('/ai-service/chat/stream', durationMs, 'POST')
          break
        }

        default:
          this.sendJsonResponse(res, 404, {
            success: false,
            error: 'Endpoint not found',
          })
          apiMetrics.request('/ai-service/unknown', method, 404)
      }
    } catch (error) {
      const durationMs = Date.now() - startTime
      const errorType = error instanceof Error ? error.constructor.name : 'UnknownError'
      apiMetrics.error('/ai-service', errorType)
      apiMetrics.responseTime('/ai-service', durationMs, method)
      appLogger.error('Request handling error:', error)
      this.sendJsonResponse(res, 500, {
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
            if (!res.headersSent) {
              this.sendJsonResponse(res, 500, {
                success: false,
                error: 'Internal server error',
              })
            }
          })
        })

        this.server.listen(AI_SERVICE_PORT, () => {
          this.isRunning = true
          appLogger.info(`AI Service started on port ${AI_SERVICE_PORT}`)
          console.log(`AI Service started on port ${AI_SERVICE_PORT}`)
          console.log('Available endpoints:')
          console.log('  GET /health - Health check')
          console.log('  POST /chat - Chat completion')
          console.log('  POST /chat/stream - Streaming chat completion')
          console.log('  POST /analyze-emotion - Emotion analysis')

          // Keep-alive logging
          setInterval(() => {
            appLogger.debug('AI Service is running...')
          }, 30000)

          resolve({ status: 'running', port: AI_SERVICE_PORT })
        })

        this.server.on('error', (error) => {
          appLogger.error('Server error:', error)
          reject(error)
        })
      } catch (error) {
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
          console.log('AI Service stopped')
          resolve()
        })
      })
    }
  }
}

// Create and export server instance
const aiServer = new AIServer()

// Graceful shutdown
process.on('SIGTERM', () => aiServer.stop().then(() => process.exit(0)))
process.on('SIGINT', () => aiServer.stop().then(() => process.exit(0)))

// Start server
aiServer.start().catch((error) => {
  console.error('Failed to start AI service:', error)
  process.exit(1)
})
