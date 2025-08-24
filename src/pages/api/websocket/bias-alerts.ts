// Note: Avoid importing Astro types here to prevent version/type mismatches; rely on inference.
/**
 * WebSocket API endpoint for real-time bias alerts
 *
 * This endpoint establishes WebSocket connections for real-time
 * bias detection alerts and dashboard updates.
 */

import { BiasWebSocketServer } from '../../../lib/services/websocket/BiasWebSocketServer'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('BiasAlertsWebSocketAPI')

// Singleton WebSocket server instance
let wsServer: BiasWebSocketServer | null = null

const wsConfig = {
  port: parseInt(process.env['WS_PORT'] || '8080'),
  heartbeatInterval: 30000, // 30 seconds
  maxConnections: parseInt(process.env['WS_MAX_CONNECTIONS'] || '1000'),
  authRequired: process.env['WS_AUTH_REQUIRED'] === 'true',
  corsOrigins: process.env['WS_CORS_ORIGINS']?.split(',') || [
    'http://localhost:3000',
    'http://localhost:4321',
  ],
  rateLimitConfig: {
    maxMessagesPerMinute: parseInt(process.env['WS_RATE_LIMIT'] || '60'),
    banDurationMs: parseInt(process.env['WS_BAN_DURATION'] || '300000'), // 5 minutes
  },
}

/**
 * Initialize WebSocket server if not already running
 */
async function initializeWebSocketServer(): Promise<BiasWebSocketServer> {
  if (!wsServer) {
    wsServer = new BiasWebSocketServer(wsConfig)

    try {
      await wsServer.start()
      logger.info('WebSocket server initialized successfully', {
        port: wsConfig.port,
        maxConnections: wsConfig.maxConnections,
      })
    } catch (error: unknown) {
      logger.error('Failed to initialize WebSocket server', { error })
      throw error
    }
  }

  return wsServer
}

/**
 * Get WebSocket server status
 */
export const GET = async () => {
  try {
    const server = await initializeWebSocketServer()
    const status = server.getStats()
    const clients = server.getClients()

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          status,
          clients: clients.map((client) => ({
            id: client.id,
            isAuthenticated: client.isAuthenticated,
            subscriptions: client.subscriptions,
            connectedSince: client.connectedSince,
          })),
          config: {
            port: wsConfig.port,
            heartbeatInterval: wsConfig.heartbeatInterval,
            maxConnections: wsConfig.maxConnections,
            authRequired: wsConfig.authRequired,
          },
        },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      },
    )
  } catch (error: unknown) {
    logger.error('Failed to get WebSocket server status', { error })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to get WebSocket server status',
        message: error instanceof Error ? String(error) : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}

/**
 * Send test bias alert (for development/testing)
 */
export const POST = async ({ request }: { request: Request }) => {
  try {
    const body = await request.json()
    const { type = 'test', level = 'medium', message, sessionId } = body

    const server = await initializeWebSocketServer()

    // Create test alert
    const testAlert = {
      alertId: `test_${Date.now()}`,
      type,
      level,
      message: message || `Test bias alert - ${level} level`,
      timestamp: new Date(),
      sessionId: sessionId || `test_session_${Date.now()}`,
      acknowledged: false,
      details: {
        test: true,
        generatedBy: 'API',
        requestId: crypto.randomUUID(),
      },
    }

    // Create test analysis result
    const testAnalysisResult = {
      sessionId: testAlert.sessionId,
      timestamp: new Date(),
      overallBiasScore:
        Math.random() * 0.5 +
        (level === 'critical' ? 0.8 : level === 'high' ? 0.6 : 0.3),
      alertLevel: level,
      confidence: Math.random() * 0.3 + 0.7,
      layerResults: {
        preprocessing: {
          biasScore: Math.random() * 0.4 + 0.2,
          linguisticBias: {
            genderBiasScore: Math.random() * 0.3,
            racialBiasScore: Math.random() * 0.3,
            ageBiasScore: Math.random() * 0.3,
            culturalBiasScore: Math.random() * 0.3,
            biasedTerms: [],
            sentimentAnalysis: {
              overallSentiment: 0.5,
              emotionalValence: 0.5,
              subjectivity: 0.5,
              demographicVariations: {},
            },
          },
          representationAnalysis: {
            demographicDistribution: {},
            underrepresentedGroups: [],
            overrepresentedGroups: [],
            diversityIndex: 0.5,
            intersectionalityAnalysis: [],
          },
          dataQualityMetrics: {
            completeness: 0.8,
            consistency: 0.8,
            accuracy: 0.8,
            timeliness: 0.8,
            validity: 0.8,
            missingDataByDemographic: {},
          },
          recommendations: [`Test preprocessing recommendation for ${level}`],
        },
        modelLevel: {
          biasScore: Math.random() * 0.4 + 0.2,
          fairnessMetrics: {
            demographicParity: 0.75,
            equalizedOdds: 0.8,
            equalOpportunity: 0.8,
            calibration: 0.8,
            individualFairness: 0.8,
            counterfactualFairness: 0.8,
          },
          performanceMetrics: {
            accuracy: 0.8,
            precision: 0.8,
            recall: 0.8,
            f1Score: 0.8,
            auc: 0.8,
            calibrationError: 0.1,
            demographicBreakdown: {},
          },
          groupPerformanceComparison: [],
          recommendations: [`Test model-level recommendation for ${level}`],
        },
        interactive: {
          biasScore: Math.random() * 0.4 + 0.2,
          counterfactualAnalysis: {
            scenariosAnalyzed: 3,
            biasDetected: Math.random() > 0.5,
            consistencyScore: Math.random() * 0.3 + 0.7,
            problematicScenarios: [],
          },
          featureImportance: [],
          whatIfScenarios: [],
          recommendations: [`Test interactive recommendation for ${level}`],
        },
        evaluation: {
          biasScore: Math.random() * 0.4 + 0.2,
          huggingFaceMetrics: {
            toxicity: 0.05,
            bias: Math.random() * 0.4 + 0.2,
            regard: {},
            stereotype: Math.random() * 0.3 + 0.1,
            fairness: Math.random() * 0.3 + 0.7,
          },
          customMetrics: {
            therapeuticBias: Math.random() * 0.3 + 0.1,
            culturalSensitivity: Math.random() * 0.3 + 0.7,
            professionalEthics: Math.random() * 0.2 + 0.8,
            patientSafety: Math.random() * 0.2 + 0.8,
          },
          temporalAnalysis: {
            trendDirection: 'stable' as const,
            changeRate: 0,
            seasonalPatterns: [],
            interventionEffectiveness: [],
          },
          recommendations: [`Test evaluation recommendation for ${level}`],
        },
      },
      recommendations: [`Test recommendation for ${level} bias alert`],
      demographics: {
        age: '25',
        gender: 'other',
        ethnicity: 'test',
        primaryLanguage: 'en',
        totalSamples: 100,
        categories: {
          test: 100,
        },
      },
    }

    // Broadcast the test alert
    await server.broadcastBiasAlert(testAlert, testAnalysisResult)

    logger.info('Test bias alert sent', {
      alertId: testAlert.alertId,
      level: testAlert.level,
      sessionId: testAlert.sessionId,
    })

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          alert: testAlert,
          analysisResult: testAnalysisResult,
          broadcastStatus: 'sent',
        },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    logger.error('Failed to send test bias alert', { error })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to send test bias alert',
        message: error instanceof Error ? String(error) : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}

/**
 * Update WebSocket server configuration
 */
export const PATCH = async ({ request }: { request: Request }) => {
  try {
    const body = await request.json()
    const { action } = body

    const server = await initializeWebSocketServer()

    switch (action) {
      case 'restart':
        await server.stop()
        await server.start()
        logger.info('WebSocket server restarted')
        break

      case 'status':
        // Just return current status
        break

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    const status = server.getStats()

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          action,
          status,
          message: `Action '${action}' completed successfully`,
        },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    logger.error('Failed to update WebSocket server', { error })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to update WebSocket server',
        message: error instanceof Error ? String(error) : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}

/**
 * Gracefully shutdown WebSocket server
 */
export const DELETE = async () => {
  try {
    if (wsServer) {
      await wsServer.stop()
      wsServer = null
      logger.info('WebSocket server stopped')
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          message: 'WebSocket server stopped successfully',
        },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    logger.error('Failed to stop WebSocket server', { error })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to stop WebSocket server',
        message: error instanceof Error ? String(error) : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}

// Export the WebSocket server instance for use by other modules
export function getWebSocketServer(): BiasWebSocketServer | null {
  return wsServer
}

// Initialize server on module load in production
if (
  process.env['NODE_ENV'] === 'production' &&
  process.env['WS_AUTO_START'] === 'true'
) {
  initializeWebSocketServer().catch((error) => {
    logger.error('Failed to auto-start WebSocket server', { error })
  })
}
