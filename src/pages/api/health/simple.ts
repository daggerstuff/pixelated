import type { APIRoute } from 'astro'

// Pre-calculate static response parts to minimize execution time
const baseResponse = {
  status: 'healthy',
  version: '2.0.0',
  environment: process.env['NODE_ENV'] || 'development',
  nodeVersion: process.version
}

export const GET: APIRoute = async () => {
  try {
    // Minimal health response optimized for speed
    const healthResponse = {
      ...baseResponse,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime())
    }

    return new Response(JSON.stringify(healthResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error?.message || 'Unknown error'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}