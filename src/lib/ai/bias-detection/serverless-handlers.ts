/**
 * Bias Detection Engine - Serverless Handlers
 *
 * Lightweight stub implementation for deployment compatibility.
 * TODO: Implement full serverless utilities when ready for full feature.
 */

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
        body: event.body ? JSON.parse(event.body) : null,
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
    } catch (error) {
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
