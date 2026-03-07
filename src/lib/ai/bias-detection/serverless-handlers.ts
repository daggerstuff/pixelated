/**
 * Bias Detection Engine - Serverless Handlers
 *
 * Lightweight stub implementation for deployment compatibility.
 * Production: Includes serverless bias detection handler for real endpoint deployment.
 */
import { BiasDetectionEngine } from './BiasDetectionEngine'

/**
 * Creates a serverless-compatible handler wrapper
 */
export function createServerlessHandler(handler: (req: any) => Promise<any>) {
  return async (event: any) => {
    try {
      // Transform serverless event to standard request format
      const req = {
        method: event.httpMethod || event.method || 'GET',
        headers: event.headers || {},
        query: event.queryStringParameters || {},
        body: event.body ? (JSON.parse(event.body) as unknown) : null,
        path: event.path || event.rawPath || '/',
      }

      const response = await handler(req)

      // Return serverless response format
      return {
        statusCode: response.statusCode || 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          ...response.headers,
        },
        body: response.body || JSON.stringify({ message: 'OK' }),
      }
    } catch (error: unknown) {
      console.error('Serverless handler error:', error)

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Internal server error',
          message: 'Bias detection service temporarily unavailable',
        }),
      }
    }
  }
}

/**
 * Validates request format for serverless compatibility
 */
export function validateServerlessRequest(event: any): boolean {
  return !!(event && (event.httpMethod || event.method))
}

/**
 * Serverless handler for bias detection.
 * Receives session data in event.body, returns BiasDetectionEngine analysis.
 */
export const detectBiasServerlessHandler = createServerlessHandler(
  async (req) => {
    // CORS preflight and method guard
    if (req.method === 'OPTIONS') {
      return createCorsResponse()
    }
    if (req.method !== 'POST') {
      return {
        statusCode: 405,
        headers: { Allow: 'POST, OPTIONS' },
        body: JSON.stringify({ success: false, error: 'Method Not Allowed' }),
      }
    }

    // Defensive body parsing + validation
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    if (!body || typeof body !== 'object' || !('session' in body)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing session data for bias detection.',
        }),
      }
    }

    // Initialize engine (ideally reuse a singleton in production)
    const engine = new BiasDetectionEngine()
    try {
      await engine.initialize()
      const analysis = await engine.analyzeSession(body.session)
      return {
        // ...rest of the original response
        statusCode: 200,
        body: JSON.stringify({ success: true, data: analysis }),
      }
    } catch (error: unknown) {
      console.error('Bias detection error:', error)
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Bias detection failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      }
    }
  },
)

/**
 * Creates CORS preflight response
 */
export function createCorsResponse() {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
    body: '',
  }
}
