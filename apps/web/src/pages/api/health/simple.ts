import type { APIRoute } from 'astro'

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('health-simple-api')

export const GET: APIRoute = async () => {
  try {
    const healthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        webServer: {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version,
        },
      },
      version: '2.0.0',
      environment: process.env['NODE_ENV'] ?? 'development',
    }

    return new Response(JSON.stringify(healthResponse, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: unknown) {
    logger.error('Error in GET /api/health/simple', {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
    })

    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Internal server error',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
