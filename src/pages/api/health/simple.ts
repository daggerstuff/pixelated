import type { APIRoute, APIContext } from 'astro'
export const prerender = false

/**
 * Simple health check endpoint for Docker containers
 * Returns basic service status without external dependencies
 */
export const GET: APIRoute = async () => {
  const startTime = performance.now()

  try {
    // Basic health response without external dependencies
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'pixelated-astro-app',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      responseTimeMs: Math.round(performance.now() - startTime),
    }

    return new Response(JSON.stringify(healthStatus, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        responseTimeMs: Math.round(performance.now() - startTime),
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    )
  }
}
