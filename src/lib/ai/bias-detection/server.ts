// IMPORTANT: Import Sentry instrumentation at the very top
import '../../../../config/instrument.mjs'

import { IncomingMessage, ServerResponse as NodeServerResponse } from 'http'
import { createServer } from 'http'
import { parse } from 'url'
import type { TherapeuticSession } from './types'
import { BiasDetectionEngine } from './BiasDetectionEngine'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const appLogger = createBuildSafeLogger('bias-detection-server')

const BIAS_DETECTION_PORT = parseInt(process.env['PORT'] || '8001', 10)

interface ApiResponse {
  success: boolean
  data?: unknown
  error?: string
}

class BiasDetectionServer {
  private server: ReturnType<typeof createServer> | null = null
  private isRunning = false
  private engine: BiasDetectionEngine

  constructor() {
    // Initialize bias detection engine
    this.engine = new BiasDetectionEngine()
  }

  private sendJsonResponse(
    res: NodeServerResponse,
    statusCode: number,
    data: ApiResponse,
  ): void {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.end(JSON.stringify(data))
  }

  private async handleHealthCheck(res: NodeServerResponse): Promise<void> {
    try {
      const engineHealth = await this.engine.getHealthStatus()
      const serverHealth = {
        status: this.isRunning ? 'healthy' : 'unhealthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      }

      const engineHealthy =
        typeof engineHealth.overall === 'string'
          ? engineHealth.overall === 'healthy'
          : Boolean(engineHealth.overall)
      const overallHealth =
        engineHealthy && this.isRunning ? 'healthy' : 'degraded'

      this.sendJsonResponse(res, 200, {
        success: true,
        data: {
          status: overallHealth,
          timestamp: new Date().toISOString(),
          services: {
            server: serverHealth,
            engine: engineHealth,
          },
          version: process.env['npm_package_version'] || '1.0.0',
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

  private async handleBiasAnalysis(
    res: NodeServerResponse,
    body: unknown,
  ): Promise<void> {
    try {
      const { session } = body as { session: TherapeuticSession }

      if (!session || !session.sessionId) {
        this.sendJsonResponse(res, 400, {
          success: false,
          error: 'Session data with sessionId is required',
        })
        return
      }

      // Validate session structure
      if (
        !session.participantDemographics ||
        !session.content ||
        !session.aiResponses
      ) {
        this.sendJsonResponse(res, 400, {
          success: false,
          error:
            'Session must include participantDemographics, content, and aiResponses',
        })
        return
      }

      // Ensure timestamp is a Date object
      const sessionData: TherapeuticSession = {
        ...session,
        timestamp: session.timestamp ? new Date(session.timestamp) : new Date(),
      }

      const startTime = Date.now()
      const result = await this.engine.analyzeSession(sessionData)
      const processingTime = Date.now() - startTime

      this.sendJsonResponse(res, 200, {
        success: true,
        data: {
          ...result,
          processingTime,
        },
      })
    } catch (error) {
      appLogger.error('Bias analysis failed:', error)
      this.sendJsonResponse(res, 500, {
        success: false,
        error: error instanceof Error ? error.message : 'Bias analysis failed',
      })
    }
  }

  private async handleBatchAnalysis(
    res: NodeServerResponse,
    body: unknown,
  ): Promise<void> {
    try {
      const { sessions, options = {} } = body as {
        sessions: TherapeuticSession[]
        options?: {
          concurrency?: number
          batchSize?: number
          logProgress?: boolean
          logErrors?: boolean
        }
      }

      if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
        this.sendJsonResponse(res, 400, {
          success: false,
          error: 'Array of sessions is required',
        })
        return
      }

      // Validate each session
      for (const session of sessions) {
        if (!session.sessionId) {
          this.sendJsonResponse(res, 400, {
            success: false,
            error: 'All sessions must include sessionId',
          })
          return
        }
      }

      // Convert timestamps and prepare session data
      const sessionData: TherapeuticSession[] = sessions.map((session) => ({
        ...session,
        timestamp: session.timestamp ? new Date(session.timestamp) : new Date(),
      }))

      const startTime = Date.now()
      const result = await this.engine.batchAnalyzeSessions(sessionData, {
        concurrency: options.concurrency || 3,
        batchSize: options.batchSize || 10,
        logProgress: options.logProgress !== false,
        logErrors: options.logErrors !== false,
      })
      const processingTime = Date.now() - startTime

      this.sendJsonResponse(res, 200, {
        success: true,
        data: {
          results: result.results,
          errors: result.errors,
          metrics: {
            ...result.metrics,
            totalProcessingTime: processingTime,
            averageTimePerSession: processingTime / sessions.length,
          },
        },
      })
    } catch (error) {
      appLogger.error('Batch analysis failed:', error)
      this.sendJsonResponse(res, 500, {
        success: false,
        error: error instanceof Error ? error.message : 'Batch analysis failed',
      })
    }
  }

  private async handleDashboardData(
    res: NodeServerResponse,
    body: unknown,
  ): Promise<void> {
    try {
      const { timeRange, includeDetails = true } = body as {
        timeRange?: { start: Date; end: Date }
        includeDetails?: boolean
      }

      const dashboardData = await this.engine.getDashboardData({
        timeRange: timeRange ? JSON.stringify(timeRange) : undefined,
        includeDetails,
      })

      this.sendJsonResponse(res, 200, {
        success: true,
        data: dashboardData,
      })
    } catch (error) {
      appLogger.error('Dashboard data retrieval failed:', error)
      this.sendJsonResponse(res, 500, {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Dashboard data retrieval failed',
      })
    }
  }

  private async handleGetSessionAnalysis(
    res: NodeServerResponse,
    sessionId: string,
  ): Promise<void> {
    try {
      const result = await this.engine.getSessionAnalysis(sessionId)

      if (!result) {
        this.sendJsonResponse(res, 404, {
          success: false,
          error: `Analysis result not found for session ${sessionId}`,
        })
        return
      }

      this.sendJsonResponse(res, 200, {
        success: true,
        data: result,
      })
    } catch (error) {
      appLogger.error('Session analysis retrieval failed:', error)
      this.sendJsonResponse(res, 500, {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Session analysis retrieval failed',
      })
    }
  }

  private async handlePerformanceStats(res: NodeServerResponse): Promise<void> {
    try {
      const stats = await this.engine.getPerformanceStats()

      this.sendJsonResponse(res, 200, {
        success: true,
        data: stats,
      })
    } catch (error) {
      appLogger.error('Performance stats retrieval failed:', error)
      this.sendJsonResponse(res, 500, {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Performance stats retrieval failed',
      })
    }
  }

  private async parseRequestBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
      })
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {})
        } catch {
          reject(new Error('Invalid JSON'))
        }
      })
      req.on('error', reject)
    })
  }

  private async handleRequest(
    req: IncomingMessage,
    res: NodeServerResponse,
  ): Promise<void> {
    const { method, url } = req
    const parsedUrl = parse(url || '', true)
    const path = parsedUrl.pathname

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

        case 'POST /analyze': {
          const analyzeBody = await this.parseRequestBody(req)
          await this.handleBiasAnalysis(res, analyzeBody)
          break
        }

        case 'POST /analyze/batch': {
          const batchBody = await this.parseRequestBody(req)
          await this.handleBatchAnalysis(res, batchBody)
          break
        }

        case 'GET /dashboard': {
          const dashboardBody = await this.parseRequestBody(req)
          await this.handleDashboardData(res, dashboardBody)
          break
        }

        case 'GET /performance':
          await this.handlePerformanceStats(res)
          break

        default: {
          // Handle dynamic routes like /session/{sessionId}
          if (method === 'GET' && path?.startsWith('/session/')) {
            const sessionId = path.substring('/session/'.length)
            await this.handleGetSessionAnalysis(res, sessionId)
            break
          }

          this.sendJsonResponse(res, 404, {
            success: false,
            error: 'Endpoint not found',
          })
        }
      }
    } catch (error) {
      appLogger.error('Request handling error:', error)
      this.sendJsonResponse(res, 500, {
        success: false,
        error: 'Internal server error',
      })
    }
  }

  async start(): Promise<{ status: string; port: number }> {
    // Initialize the bias detection engine
    await this.engine.initialize()

    this.server = createServer(
      (req: IncomingMessage, res: NodeServerResponse) => {
        this.handleRequest(req, res).catch((error) => {
          appLogger.error('Unhandled request error:', error)
          if (!res.headersSent) {
            this.sendJsonResponse(res, 500, {
              success: false,
              error: 'Internal server error',
            })
          }
        })
      },
    )

    return new Promise((resolve, reject) => {
      this.server!.listen(BIAS_DETECTION_PORT, () => {
        this.isRunning = true
        appLogger.info(
          `Bias Detection Service started on port ${BIAS_DETECTION_PORT}`,
        )
        console.log(
          `Bias Detection Service started on port ${BIAS_DETECTION_PORT}`,
        )
        console.log('Available endpoints:')
        console.log('  GET /health - Health check')
        console.log('  POST /analyze - Single session bias analysis')
        console.log('  POST /analyze/batch - Batch session bias analysis')
        console.log('  GET /dashboard - Dashboard data')
        console.log('  GET /performance - Performance statistics')
        console.log(
          '  GET /session/{sessionId} - Get analysis result for specific session',
        )

        // Keep-alive logging
        setInterval(() => {
          appLogger.debug('Bias Detection Service is running...')
        }, 30000)

        resolve({ status: 'running', port: BIAS_DETECTION_PORT })
      })

      this.server!.on('error', (error) => {
        appLogger.error('Server error:', error)
        reject(error)
      })
    })
  }

  async stop(): Promise<void> {
    if (this.server && this.isRunning) {
      // Dispose of the engine
      try {
        await this.engine.dispose()
      } catch (error) {
        appLogger.error('Error disposing engine:', error)
      }

      return new Promise((resolve) => {
        this.server!.close(() => {
          this.isRunning = false
          appLogger.info('Bias Detection Service stopped')
          console.log('Bias Detection Service stopped')
          resolve()
        })
      })
    }
  }
}

// Create and export server instance
const biasDetectionServer = new BiasDetectionServer()

// Graceful shutdown
process.on('SIGTERM', () =>
  biasDetectionServer.stop().then(() => process.exit(0)),
)
process.on('SIGINT', () =>
  biasDetectionServer.stop().then(() => process.exit(0)),
)

// Start server
biasDetectionServer.start().catch((error) => {
  console.error('Failed to start Bias Detection service:', error)
  process.exit(1)
})
