import type { APIRoute } from 'astro'

export const GET: APIRoute = async () => {
  const healthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      webServer: {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      }
    },
    version: '2.0.0',
    environment: process.env['NODE_ENV'] || 'development'
  }

  return new Response(JSON.stringify(healthResponse, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  })
}