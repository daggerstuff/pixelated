export const prerender = false

/**
 * Simple health check endpoint for Docker containers
 * Returns basic service status without external dependencies
 */
export const GET = async () => {
  const startTime = Date.now()

  try {
    // Basic health response without external dependencies
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'pixelated-astro-app',
      version: '1.0.0',
      uptime: typeof process !== 'undefined' ? process.uptime() : 0,
      memory:
        typeof process !== 'undefined'
          ? {
              used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
              total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            }
          : { used: 0, total: 0 },
      responseTimeMs: Date.now() - startTime,
    }

    return new Response(JSON.stringify(healthStatus, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        responseTimeMs: Date.now() - startTime,
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
